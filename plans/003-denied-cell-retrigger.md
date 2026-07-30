# 003 — 같은 가구 칸을 다시 눌러도 거절 피드백이 다시 재생되게 한다

- **Status**: DONE
- **Commit**: a1516a1
- **Severity**: HIGH
- **Category**: 4 상호중단성
- **Estimated scope**: 2 파일 (`src/components/Board.tsx`, `src/index.css`), 약 15줄

## Problem

**같은 가구 칸(책장·냉장고 등)을 연속으로 두 번 누르면 두 번째부터 아무 반응이 없다.** 흔들림도 안 나오고 토스트도 다시 안 뜬다. 사용자는 "왜 여기에 메모가 안 되지?" 를 확인하려고 다시 누르는 건데, 바로 그 순간 피드백이 사라진다.

거절 상태는 칸 좌표를 키로 들고 있다:

```tsx
// src/components/Board.tsx:27-33 — 현재
  // 가구 칸을 눌렀을 때 잠깐 띄우는 거절 표시
  const [denied, setDenied] = useState<{ key: string; text: string } | null>(null);
  useEffect(() => {
    if (!denied) return;
    const t = setTimeout(() => setDenied(null), 1600);
    return () => clearTimeout(t);
  }, [denied]);
```

```tsx
// src/components/Board.tsx:70-77 — 현재
          className={`cell${blocked ? ' blocked' : ''}${denied?.key === k ? ' denied' : ''}`}
          aria-label={blocked ? `${desc} (가구라 설 수 없음)` : desc}
          onClick={() =>
            blocked
              ? setDenied({ key: k, text: `${fur?.f.label ?? '가구'} 위에는 설 수 없어` })
              : onCell(k)
          }
```

```tsx
// src/components/Board.tsx:131-135 — 현재
      {denied && (
        <p className="notice" role="status">
          🚫 {denied.text}
        </p>
      )}
```

같은 칸을 다시 누르면 `denied.key` 가 이전과 같다. 그래서:

- **칸**: `className` 문자열이 `"cell blocked denied"` 로 동일 → DOM 의 class 속성이 바뀌지 않음 → **CSS 키프레임은 재시작하지 않는다.** 키프레임은 요소가 새로 나타나거나 `animation-name` 이 바뀔 때만 처음부터 돈다.
- **토스트**: `<p className="notice">` 도 같은 위치·같은 클래스라 재마운트되지 않음 → `notice-in` 도 재시작하지 않는다. 게다가 `useEffect` 의 의존성이 `[denied]` 이고 매 클릭마다 **새 객체**가 들어오므로 1600ms 타이머만 리셋된다 — 즉 토스트는 계속 떠 있지만 아무 변화 없이 조용히 머문다.

실제 브라우저에서 `animationstart` 를 세어 확인했다: 첫 클릭 `cell-nope` 1회, 400ms 뒤 **같은 칸** 재클릭 시 **여전히 1회**(증가 없음).

## Target

거절 상태에 단조 증가 카운터 `n` 을 추가하고, 그것으로 두 가지를 각각 재시작시킨다.

**토스트는 `key` 로 재마운트한다** — `<p>` 는 포커스를 받지 않는 요소라 재마운트해도 잃을 게 없다.

**칸은 재마운트하면 안 된다.** `<button>` 이라 키보드로 Enter 를 눌러 거절을 유발한 사용자의 포커스가 `<body>` 로 날아간다. 대신 `animation-name` 을 번갈아 바꿔서 재시작시킨다 — 짝수 번째 클릭과 홀수 번째 클릭이 이름만 다른 쌍둥이 키프레임을 쓰게 한다.

```tsx
// target — src/components/Board.tsx:28
  const [denied, setDenied] = useState<{ key: string; text: string; n: number } | null>(null);
```

```tsx
// target — src/components/Board.tsx:70-77
          className={`cell${blocked ? ' blocked' : ''}${
            denied?.key === k ? (denied.n % 2 ? ' denied alt' : ' denied') : ''
          }`}
          aria-label={blocked ? `${desc} (가구라 설 수 없음)` : desc}
          onClick={() =>
            blocked
              ? setDenied((prev) => ({
                  key: k,
                  text: `${fur?.f.label ?? '가구'} 위에는 설 수 없어`,
                  n: (prev?.n ?? 0) + 1,
                }))
              : onCell(k)
          }
```

```tsx
// target — src/components/Board.tsx:131-135
      {denied && (
        <p key={denied.n} className="notice" role="status">
          🚫 {denied.text}
        </p>
      )}
```

```css
/* target — src/index.css:301-322 을 대체 */
/* 가구 칸을 눌렀을 때: 흔들림 + 붉은 기 */
.cell.denied {
  background: #f7e2dc;
  animation: cell-nope 0.3s ease-out;
  z-index: 3;
}
/* ponytail: 이름만 다른 쌍둥이 키프레임. 같은 칸을 연속으로 누를 때
   animation-name 이 바뀌어야 흔들림이 처음부터 다시 돈다.
   버튼을 재마운트하면 키보드 포커스를 잃으므로 이 방법을 쓴다. */
.cell.denied.alt {
  animation-name: cell-nope-alt;
}
@keyframes cell-nope {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  50% {
    transform: translateX(4px);
  }
  75% {
    transform: translateX(-2px);
  }
}
@keyframes cell-nope-alt {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  50% {
    transform: translateX(4px);
  }
  75% {
    transform: translateX(-2px);
  }
}
```

두 키프레임의 **본문은 완전히 동일해야 한다.** 값이 다르면 클릭할 때마다 흔들림이 달라 보인다.

## Repo conventions to follow

- 의도적으로 단순하게 둔 지점은 `ponytail:` 주석으로 한계와 이유를 적어둔다. 위 CSS 주석이 그 형식이다 — 그대로 넣을 것.
- 주석은 한국어로 쓴다.
- `Board.tsx` 는 이미 템플릿 리터럴로 클래스명을 조립한다 (`src/components/Board.tsx:70`). 같은 방식을 유지하고 `clsx` 같은 라이브러리를 들이지 말 것.
- 상태 갱신은 이전 값을 인자로 받는 형태를 쓴다 (`src/App.tsx:185` 의 `setRevealed((v) => !v)` 참고).
- 이 저장소의 테스트는 `src/game/game.test.ts` 한 파일뿐이고 `react-dom/server` 의 `renderToStaticMarkup` 으로 Board 를 렌더한다. 클릭 상태는 SSR 로 재현되지 않으므로 이 변경에 대한 테스트는 추가하지 않아도 된다.

## Steps

1. `src/components/Board.tsx:28` 의 `useState` 제네릭에 `n: number` 를 추가한다: `useState<{ key: string; text: string; n: number } | null>(null)`.
2. `src/components/Board.tsx:73-76` 의 `onClick` 안 `setDenied({...})` 를 Target 의 함수형 갱신(`setDenied((prev) => ({ ... n: (prev?.n ?? 0) + 1 }))`) 으로 바꾼다.
3. `src/components/Board.tsx:70` 의 `className` 표현식을 Target 대로 바꿔, `denied.n` 이 홀수면 `' denied alt'`, 짝수면 `' denied'` 가 붙게 한다.
4. `src/components/Board.tsx:132` 의 `<p className="notice" role="status">` 를 `<p key={denied.n} className="notice" role="status">` 로 바꾼다.
5. `src/index.css:302-306` 의 `.cell.denied` 규칙 **바로 아래**에 Target 의 `ponytail:` 주석과 `.cell.denied.alt { animation-name: cell-nope-alt; }` 규칙을 추가한다.
6. `src/index.css` 의 `@keyframes cell-nope { ... }` 블록 바로 아래에 `@keyframes cell-nope-alt` 를 추가한다. 본문은 `cell-nope` 과 **한 글자도 다르지 않게** 복사한다.
7. `useEffect` 의 의존성 배열 `[denied]` 는 그대로 둔다. 매 클릭마다 새 객체가 들어와 1600ms 타이머가 리셋되는 건 의도된 동작이다(다시 눌렀으니 다시 1.6초 보여주는 게 맞다).

## Boundaries

- `src/components/Board.tsx` 와 `src/index.css` **외의 파일을 수정하지 말 것.**
- `<button className="cell">` 의 `key={k}` 를 바꾸지 말 것. 바꾸면 재마운트가 일어나 키보드 포커스를 잃는다 — 이 계획이 피하려는 바로 그 문제다.
- `aria-label` 의 `(가구라 설 수 없음)` 문구와 `role="status"` 를 건드리지 말 것.
- 흔들림의 지속시간(`0.3s`), 이징(`ease-out`), 진폭(`4px`/`2px`)을 바꾸지 말 것. 이번 변경은 **재시작**만 고치는 것이다.
- 1600ms 표시 시간을 바꾸지 말 것.
- `@media (prefers-reduced-motion: reduce)` 블록(약 595행)을 건드리지 말 것 — 계획 004 의 범위다. 그 블록의 `*` 선택자가 새 `cell-nope-alt` 도 자동으로 덮으므로 지금 손댈 필요가 없다.
- 게임 로직(어떤 칸이 `blocked` 인지 판정하는 `idx.free`)을 건드리지 말 것.
- 의존성을 추가하지 말 것.
- 커밋 스탬프(`a1516a1`) 이후 코드가 달라져 위 인용문과 일치하지 않으면 **즉시 중단하고 보고할 것.**

## Verification

- **기계적**: `npm run lint && npm run build` 오류 0. `npm test` 19개 통과.
- **Feel check**: `npm run dev` 로 띄우고
  - 책장·냉장고 같은 **가구 칸을 한 번 누른다** → 칸이 좌우로 흔들리고 화면 아래에 `🚫 … 위에는 설 수 없어` 토스트가 뜬다.
  - **같은 칸을 0.5초 뒤 다시 누른다** → 흔들림과 토스트가 **다시 재생**되어야 한다. 이전에는 아무 변화가 없었다.
  - 5번 연속으로 눌러 매번 흔들리는지 본다. 홀수 번째와 짝수 번째의 흔들림이 **똑같아 보여야** 한다. 다르게 보이면 6단계에서 키프레임 본문을 잘못 복사한 것이다.
  - **키보드로 확인**: Tab 으로 가구 칸에 포커스를 옮기고 Enter 를 두 번 누른다. 흔들림이 두 번 다 재생되고, **포커스 링이 그 칸에 그대로 남아 있어야 한다.** 포커스가 사라지면 칸을 재마운트한 것이므로 잘못됐다.
  - 가구가 없는 빈 칸은 여전히 정상적으로 메모가 찍혀야 한다.
- **계측으로 증명**: DevTools 콘솔에 붙여넣고 같은 가구 칸을 4번 클릭한다.
  ```js
  let n = 0;
  document.addEventListener('animationstart', (e) => {
    if (e.animationName.startsWith('cell-nope')) console.log(e.animationName, ++n);
  }, true);
  ```
  → `cell-nope 1`, `cell-nope-alt 2`, `cell-nope 3`, `cell-nope-alt 4` 가 찍혀야 한다.
- **Done when**: 같은 가구 칸을 반복해서 눌러도 매번 흔들림과 토스트가 재생되고, 키보드 포커스가 유지되며, lint·build·test 가 통과한다.
