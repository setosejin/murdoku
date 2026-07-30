# 005 — 피드백 모달과 거절 토스트에 등장·퇴장 모션을 넣는다

- **Status**: DONE
- **Commit**: a1516a1
- **Severity**: MEDIUM
- **Category**: 8 누락된 기회 / 3 물리성 / 4 상호중단성
- **Estimated scope**: 1 파일 (`src/index.css`), 약 45줄

## Problem

### (가) 피드백 모달이 모션 0으로 순간 등장한다

```tsx
// src/components/FeedbackDialog.tsx:40-45 — 현재
      <button type="button" className="chip" onClick={() => ref.current?.showModal()}>
        피드백
      </button>

      {/* 네이티브 dialog: 포커스 가둠·ESC 닫기·backdrop 을 브라우저가 준다 */}
      <dialog ref={ref} className="feedback" aria-labelledby="fb-title">
```

```css
/* src/index.css:539-552 — 현재 */
/* ---- 피드백 모달 ---- */
.feedback {
  border: 3px solid var(--wall);
  /* 안쪽 입력 6 + 패딩 16 = 22 */
  border-radius: 22px;
  background: #fffdf7;
  color: var(--ink);
  padding: 0;
  width: min(440px, calc(100vw - 32px));
  box-shadow: 4px 4px 0 var(--wall);
}
.feedback::backdrop {
  background: rgb(35 32 28 / 0.45);
}
```

`showModal()` 이 호출되면 화면의 절반을 덮는 어두운 backdrop 과 440px 카드가 **한 프레임에 툭 나타난다.** 실제 브라우저에서 열기 동작 중 발생한 `animationstart`/`transitionstart` 이벤트를 셌더니 **0건**이었고, 파일 전체에 `@starting-style` 은 한 번도 쓰이지 않는다.

이건 "모션이 없어서 빠르다" 가 아니라 **공간 관계가 끊기는** 경우다. 화면 전체가 갑자기 어두워지면 눈이 무슨 일이 일어났는지 재구성해야 한다. 게다가 피드백 모달은 세션당 0~1회 열리는 **드문 상호작용**이라, 자주 쓰는 요소와 달리 200–500ms 예산을 쓸 자격이 있는 이 앱의 거의 유일한 자리다.

### (나) 거절 토스트가 한 프레임에 사라진다

```css
/* src/index.css:255 — 현재 */
  animation: notice-in 0.18s ease-out;
```

```tsx
// src/components/Board.tsx:29-33 — 현재
  useEffect(() => {
    if (!denied) return;
    const t = setTimeout(() => setDenied(null), 1600);
    return () => clearTimeout(t);
  }, [denied]);
```

토스트는 180ms 에 걸쳐 부드럽게 올라왔다가 1600ms 뒤 **한 프레임에 증발한다.** 등장보다 퇴장이 거친 건 거꾸로다 — 등장은 시선을 끌어야 하니 뚜렷해도 되지만, 퇴장은 시선을 뺏지 않아야 하므로 오히려 더 부드러워야 한다.

## Target

두 문제 모두 CSS 만으로 해결한다. **`.tsx` 파일은 한 줄도 고치지 않는다.** 최신 브라우저의 discrete transition 기능(`@starting-style` + `transition-behavior: allow-discrete`)을 쓰면 React 쪽 상태 관리 없이 등장·퇴장이 붙는다.

### (가) 모달

```css
/* target — src/index.css:540-552 를 대체 */
.feedback {
  border: 3px solid var(--wall);
  /* 안쪽 입력 6 + 패딩 16 = 22 */
  border-radius: 22px;
  background: #fffdf7;
  color: var(--ink);
  padding: 0;
  width: min(440px, calc(100vw - 32px));
  box-shadow: 4px 4px 0 var(--wall);
  opacity: 1;
  transform: scale(1);
  transition: opacity 200ms cubic-bezier(0.23, 1, 0.32, 1),
    transform 200ms cubic-bezier(0.23, 1, 0.32, 1), overlay 200ms allow-discrete,
    display 200ms allow-discrete;
}
/* 닫힌 상태 = 열기 전의 시작값이자 닫힐 때의 목표값 */
.feedback:not([open]) {
  opacity: 0;
  transform: scale(0.96);
}
@starting-style {
  .feedback[open] {
    opacity: 0;
    transform: scale(0.96);
  }
}

.feedback::backdrop {
  background: rgb(35 32 28 / 0);
  transition: background 200ms cubic-bezier(0.23, 1, 0.32, 1), overlay 200ms allow-discrete,
    display 200ms allow-discrete;
}
.feedback[open]::backdrop {
  background: rgb(35 32 28 / 0.45);
}
@starting-style {
  .feedback[open]::backdrop {
    background: rgb(35 32 28 / 0);
  }
}
```

값 근거:

- **200ms** — UI 전환은 300ms 미만이어야 하고, 드물게 열리는 모달이라 하한(100ms)보다 넉넉히 쓸 수 있다.
- **`cubic-bezier(0.23, 1, 0.32, 1)`** — ease-out. 등장은 빠르게 시작해 감속하며 자리를 잡아야 한다.
- **`scale(0.96)` → `scale(1)`** — 4% 만 움직인다. `scale(0)` 에서 시작하면 안 된다(어디서 왔는지 알 수 없는 "뿅" 하는 등장). 모달은 화면 중앙에서 열리므로 `transform-origin` 은 기본값(center)이 맞다 — **바꾸지 말 것.**
- `overlay`/`display` 에 `allow-discrete` 를 주지 않으면 `close()` 순간 요소가 즉시 사라져 퇴장 전환이 보이지 않는다.

### (나) 토스트 퇴장

```css
/* target — src/index.css:254-256 부근, .notice 규칙의 animation 줄을 대체 */
  animation: notice-in 0.18s ease-out;
  transition: opacity 200ms cubic-bezier(0.23, 1, 0.32, 1);
}
@starting-style {
  .notice {
    opacity: 0;
  }
}
```

토스트는 React 가 DOM 에서 제거하므로 CSS 만으로는 퇴장을 잡을 수 없다. **`.tsx` 를 고치지 않는다는 제약 안에서 할 수 있는 건 여기까지다.** 완전한 퇴장 페이드는 `Board.tsx` 수정이 필요하므로 이 계획의 범위 밖이고, 아래 `ponytail:` 주석으로 한계를 남긴다:

```css
/* ponytail: 퇴장 페이드는 없다. React 가 노드를 즉시 제거하기 때문.
   필요해지면 Board.tsx 에서 exiting 상태를 두고 200ms 뒤 언마운트할 것. */
```

## Repo conventions to follow

- 모든 스타일은 `src/index.css` 한 파일. 새 파일을 만들지 말 것.
- 섹션 구분 주석은 `/* ---- 피드백 모달 ---- */` 형식이다 (`src/index.css:539`). 그대로 유지할 것.
- 의도적 한계는 `ponytail:` 주석으로 남긴다. 위 (나) 의 주석을 그대로 넣을 것.
- 주석은 한국어로 쓴다.
- 이 저장소는 모션 라이브러리가 없다. `framer-motion` / `motion` / `react-transition-group` 같은 걸 들이지 말 것 — 네이티브 CSS 로 끝난다.
- **토큰 사용 여부 확인**: `grep -n "\-\-ease-out" src/index.css` 결과가 있으면(계획 001 적용됨) 위 CSS 의 `cubic-bezier(0.23, 1, 0.32, 1)` 을 전부 `var(--ease-out)` 으로 바꿔 쓸 것. 없으면 리터럴 그대로 둘 것.

## Steps

1. `src/index.css:540-549` 의 `.feedback` 규칙에 Target 의 `opacity: 1;`, `transform: scale(1);`, `transition: …` 세 선언을 추가한다. 기존 선언은 하나도 지우지 말 것.
2. `.feedback` 규칙 바로 아래에 주석 `/* 닫힌 상태 = 열기 전의 시작값이자 닫힐 때의 목표값 */` 과 `.feedback:not([open]) { opacity: 0; transform: scale(0.96); }` 를 추가한다.
3. 그 아래에 `@starting-style { .feedback[open] { opacity: 0; transform: scale(0.96); } }` 를 추가한다.
4. `src/index.css:550-552` 의 `.feedback::backdrop` 규칙에서 `background: rgb(35 32 28 / 0.45);` 를 `background: rgb(35 32 28 / 0);` 로 바꾸고 Target 의 `transition` 을 추가한다.
5. 그 아래에 `.feedback[open]::backdrop { background: rgb(35 32 28 / 0.45); }` 와 `@starting-style { .feedback[open]::backdrop { background: rgb(35 32 28 / 0); } }` 를 추가한다.
6. `src/index.css:255` 의 `animation: notice-in 0.18s ease-out;` 다음 줄에 `transition: opacity 200ms cubic-bezier(0.23, 1, 0.32, 1);` 를 추가하고, `.notice` 규칙이 끝난 뒤 Target 의 `@starting-style { .notice { opacity: 0; } }` 를 추가한다.
7. 6단계에서 추가한 `@starting-style` 아래에 Target 의 `ponytail:` 주석 2줄을 넣는다.
8. **reduced-motion 확인**: `src/index.css` 하단 `@media (prefers-reduced-motion: reduce)` 블록에 `.feedback` 관련 규칙을 추가한다 — 모달의 `transform` 이동을 없애고 페이드는 남긴다:
   ```css
   .feedback,
   .feedback:not([open]) {
     transform: none !important;
   }
   ```
   이 블록의 다른 줄은 건드리지 말 것.

## Boundaries

- `src/index.css` **외의 파일을 수정하지 말 것.** 특히 `src/components/FeedbackDialog.tsx` 와 `src/components/Board.tsx` 는 한 줄도 고치지 않는다.
- `showModal()` 을 `show()` 로 바꾸지 말 것 — 포커스 가둠과 backdrop 이 `showModal()` 에만 있다.
- `<dialog>` 를 커스텀 오버레이 컴포넌트로 대체하지 말 것. 네이티브 `dialog` 의 포커스 가둠·ESC 닫기·inert 처리는 손으로 다시 만들 가치가 없다.
- `.feedback` 에 `transform-origin` 을 추가하지 말 것. 중앙 모달은 기본값이 옳다.
- `scale` 시작값을 `0.96` 보다 작게(예: `0.8`, `0`) 잡지 말 것.
- 지속시간을 300ms 이상으로 올리지 말 것.
- `.feedback` 의 `border`, `border-radius: 22px`, `box-shadow: 4px 4px 0` 를 건드리지 말 것 — 이 UI 의 디자인 언어다.
- `notice-in` 키프레임을 삭제하거나 값을 바꾸지 말 것.
- 의존성을 추가하지 말 것.
- 커밋 스탬프(`a1516a1`) 이후 코드가 달라져 위 인용문과 일치하지 않으면 **즉시 중단하고 보고할 것.**

## Verification

- **기계적**: `npm run lint && npm run build` 오류 0. `npm test` 19개 통과.
- **브라우저 지원 확인**: `@starting-style` 과 `transition-behavior: allow-discrete` 는 Chrome/Edge 117+, Safari 17.4+, Firefox 129+ 에서 동작한다. 미지원 브라우저에서는 **전환 없이 즉시 열린다** — 즉 현재 동작으로 안전하게 퇴화한다. 이 점을 확인만 하고 폴리필을 넣지 말 것.
- **Feel check (가)**: `npm run dev` 후 **피드백** 버튼을 누른다.
  - 카드가 아주 살짝 커지며(96%→100%) 떠오르고, backdrop 이 함께 어두워져야 한다. "뿅" 하고 확대되면 scale 시작값이 너무 작은 것이다.
  - **ESC 를 눌러 닫는다** → 카드와 backdrop 이 **사라지며 페이드아웃**해야 한다. 툭 사라지면 `allow-discrete` 가 빠진 것이다.
  - DevTools → Animations 패널에서 재생 속도를 **10%** 로 놓고 다시 열어본다. 카드와 backdrop 이 **같은 타이밍**으로 움직여야 한다. backdrop 이 먼저 끝나면 4단계의 duration 이 다르다.
  - 열기/닫기를 빠르게 반복해도 카드가 중간 크기에 끼거나 깜빡이지 않아야 한다.
- **Feel check (나)**: 가구 칸을 눌러 토스트를 띄운다. 등장이 이전과 같아야 하고, 1.6초 뒤 사라지는 건 여전히 즉시다(문서화된 한계).
- **Feel check — reduced motion**: DevTools → Rendering → `prefers-reduced-motion: reduce` 로 두고 모달을 연다. **크기 변화 없이 페이드만** 있어야 한다. 확대가 보이면 8단계가 안 먹은 것이다.
- **접근성 확인**: 모달을 연 뒤 Tab 을 반복해서 눌러 포커스가 모달 안에만 머무는지 확인한다. 밖으로 나가면 `<dialog>` 를 잘못 건드린 것이다.
- **Done when**: 피드백 모달이 열릴 때와 닫힐 때 200ms 페이드+스케일이 보이고, backdrop 이 함께 페이드하며, reduced-motion 에서는 페이드만 남고, `.tsx` 파일에 변경이 없으며(`git diff --name-only` 결과가 `src/index.css` 뿐), lint·build·test 가 통과한다.
