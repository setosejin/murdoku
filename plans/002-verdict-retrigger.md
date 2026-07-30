# 002 — 같은 오답을 다시 지목해도 판정이 다시 뜨게 한다

- **Status**: DONE
- **Commit**: a1516a1
- **Severity**: HIGH
- **Category**: 4 상호중단성
- **Estimated scope**: 1 파일 (`src/App.tsx`), 약 6줄

## Problem

**"아니야… 다시 생각해봐." 가 떠 있는 상태에서 같은 용의자를 다시 지목하면 화면에서 아무 일도 일어나지 않는다.** 지목하기 버튼이 고장난 것처럼 보인다.

원인은 React 의 상태 동일성 + CSS 키프레임의 재시작 규칙이다.

```tsx
// src/App.tsx:41-44 — 현재
  const accuse = () => {
    if (!accused) return;
    const ok = accused === puzzle.culpritId;
    setResult(ok ? 'correct' : 'wrong');
```

```tsx
// src/App.tsx:180-184 — 현재
            {result === 'wrong' && (
              <p className="verdict no" role="status">
                아니야… 다시 생각해봐.
              </p>
            )}
```

```css
/* src/index.css:529-537 — 현재 */
/* 결과는 자주 안 뜨는 상태 변화라 등장 모션이 값을 한다 */
.verdict {
  animation: verdict-in 0.18s ease-out;
}
@keyframes verdict-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}
```

`result` 가 이미 `'wrong'` 인데 `setResult('wrong')` 을 부르면 React 는 값이 같다고 보고 리렌더를 건너뛴다. 설령 리렌더하더라도 `<p>` 엘리먼트는 같은 위치·같은 `className` 이라 DOM 이 유지되고, **CSS 키프레임은 요소가 새로 나타나거나 애니메이션 선언이 바뀔 때만 재시작**하므로 `verdict-in` 은 다시 돌지 않는다.

실제 브라우저에서 `animationstart` 이벤트를 세어 확인했다: 첫 지목 1회, 같은 오답 재지목 **0회**.

이건 응답성 문제다. 사용자는 버튼을 눌렀고, 시스템은 요청을 정상 처리했는데, 화면은 그 사실을 알려주지 않는다.

## Target

지목 시도마다 증가하는 카운터를 두고 그것을 `<p>` 의 `key` 로 준다. `key` 가 바뀌면 React 가 엘리먼트를 언마운트 후 재마운트하고, 새 DOM 노드에 `.verdict` 가 붙으면서 키프레임이 처음부터 다시 돈다.

```tsx
// target — src/App.tsx:15 아래
  const [attempt, setAttempt] = useState(0);
```

```tsx
// target — src/App.tsx:41-45
  const accuse = () => {
    if (!accused) return;
    const ok = accused === puzzle.culpritId;
    setResult(ok ? 'correct' : 'wrong');
    setAttempt((v) => v + 1);
  };
```

```tsx
// target — src/App.tsx:175-184 의 두 <p> 에 key 추가
            {result === 'correct' && (
              <p key={attempt} className="verdict ok" role="status">
                정답! 범인은 {puzzle.people.find((p) => p.id === puzzle.culpritId)!.name}!
              </p>
            )}
            {result === 'wrong' && (
              <p key={attempt} className="verdict no" role="status">
                아니야… 다시 생각해봐.
              </p>
            )}
```

`src/index.css` 는 **전혀 수정하지 않는다.** 키프레임은 이미 옳다 — 재시작만 안 되고 있었을 뿐이다.

## Repo conventions to follow

- 상태는 `src/App.tsx` 상단에 `useState` 로 나란히 선언한다 (`src/App.tsx:13-16` 참고). 새 상태도 그 묶음에 넣는다.
- 갱신 함수는 이전 값을 인자로 받는 형태를 쓴다. 이미 `setRevealed((v) => !v)` (`src/App.tsx:185`) 가 그 형태다 — `setAttempt((v) => v + 1)` 도 동일하게 쓸 것.
- 주석은 한국어로 쓴다. 이 변경에는 왜 `key` 가 필요한지 한 줄 주석을 달아둘 것 (아래 5단계).
- 의도적으로 단순하게 둔 지점은 `ponytail:` 주석으로 표시하는 관례가 있다 (`src/game/` 안에 예시가 있다). 이 변경은 단순함이 정답이므로 별도 표시가 필요 없다.

## Steps

1. `src/App.tsx:15` 의 `const [result, setResult] = useState<'correct' | 'wrong' | null>(null);` 바로 다음 줄에 `const [attempt, setAttempt] = useState(0);` 를 추가한다.
2. `src/App.tsx:44` 의 `setResult(ok ? 'correct' : 'wrong');` 다음 줄에 `setAttempt((v) => v + 1);` 를 추가한다.
3. `src/App.tsx:176` 의 `<p className="verdict ok" role="status">` 를 `<p key={attempt} className="verdict ok" role="status">` 로 바꾼다.
4. `src/App.tsx:181` 의 `<p className="verdict no" role="status">` 를 `<p key={attempt} className="verdict no" role="status">` 로 바꾼다.
5. 1단계에서 추가한 상태 줄 위에 주석을 단다: `// 같은 결과를 다시 지목해도 등장 모션이 재생되도록 key 를 갈아끼우는 카운터`
6. `src/App.tsx:28` 의 `setResult(null);`(새 사건 생성 시 초기화) 은 **그대로 둔다.** `attempt` 는 초기화할 필요가 없다 — 단조 증가만 하면 목적을 달성한다.

## Boundaries

- `src/App.tsx` **외의 파일을 수정하지 말 것.** 특히 `src/index.css` 의 `.verdict` / `verdict-in` 은 손대지 않는다.
- `verdict-in` 키프레임의 값(`opacity: 0`, `translateY(4px)`, 지속시간)을 바꾸지 말 것.
- 판정 문구("정답! 범인은 …", "아니야… 다시 생각해봐.")를 바꾸지 말 것.
- `role="status"` 를 제거하거나 다른 ARIA 속성으로 바꾸지 말 것 — 스크린리더 안내가 여기에 걸려 있다.
- 게임 로직(`accused === puzzle.culpritId` 판정)을 건드리지 말 것.
- 의존성을 추가하지 말 것.
- 커밋 스탬프(`a1516a1`) 이후 코드가 달라져 위 인용문과 일치하지 않으면 **즉시 중단하고 보고할 것.**

## Verification

- **기계적**: `npm run lint && npm run build` 오류 0. `npm test` 19개 통과.
- **Feel check**: `npm run dev` 로 띄우고
  - 용의자를 하나 골라 **지목하기**를 누른다 → "아니야… 다시 생각해봐." 가 아래에서 살짝 올라오며 뜬다.
  - **선택을 바꾸지 말고** 지목하기를 한 번 더 누른다 → 문구가 **다시 한 번 올라오며 재생**되어야 한다. 이전에는 아무 변화가 없었다.
  - 세 번, 네 번 연속으로 눌러도 매번 재생되어야 한다.
  - 정답을 맞힌 뒤 다시 눌러도 마찬가지로 재생되어야 한다.
- **계측으로 증명** (눈으로 애매하면): DevTools 콘솔에 아래를 붙여넣고 지목하기를 3번 누른다.
  ```js
  let n = 0;
  document.addEventListener('animationstart', (e) => {
    if (e.animationName === 'verdict-in') console.log('verdict-in 재생', ++n);
  }, true);
  ```
  → 3번 눌렀으면 `3` 까지 찍혀야 한다. 계획 적용 전에는 `1` 에서 멈춘다.
- **접근성 확인**: 재마운트 때문에 `role="status"` 가 매번 새로 삽입되므로 스크린리더(macOS VoiceOver: `Cmd+F5`)가 지목할 때마다 문구를 읽어야 한다. 침묵하면 잘못된 것이다.
- **Done when**: 같은 용의자를 반복 지목할 때마다 판정 문구의 등장 모션이 재생되고, `animationstart` 카운트가 클릭 수와 일치하며, lint·build·test 가 통과한다.
