# 004 — 터치에서 hover 가 눌러붙는 문제와 과잉 reduced-motion 을 고친다

- **Status**: DONE
- **Commit**: a1516a1
- **Severity**: MEDIUM
- **Category**: 6 접근성
- **Estimated scope**: 1 파일 (`src/index.css`), 약 20줄

## Problem

접근성 관련 문제 두 가지가 같은 파일의 같은 성격의 코드에 있다. 하나로 묶어 처리한다.

### (가) 터치 기기에서 칩이 들린 채 고정된다

```css
/* src/index.css:99-108 — 현재 */
  cursor: pointer;
  font-size: 14px;
  transition: transform 0.08s ease, background 0.15s ease;
}
.chip:hover {
  transform: translateY(-1px);
}
.chip:active {
  transform: scale(0.96);
}
```

`.chip:hover` 가 미디어 쿼리로 감싸여 있지 않다(`grep -c "hover: hover" src/index.css` → `0`). 터치 기기의 브라우저는 탭한 요소에 `:hover` 를 붙이고 **다른 곳을 탭할 때까지 유지**한다. 그래서 모바일에서 난이도 칩을 한 번 누르면 그 칩만 1px 들린 채 남아, 선택 상태처럼 오해된다. 난이도 3개 · 새 사건 · 지목하기 · 피드백 · 열기 버튼이 전부 `.chip` 이다.

`.cell:hover`(`src/index.css:289`) 는 배경색만 바꾸고 `transform` 이 없으므로 이 계획의 대상이 아니다.

### (나) reduced-motion 이 색 피드백까지 없앤다

```css
/* src/index.css:595-607 — 현재 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
  .chip:hover,
  .chip:active,
  .brush:active {
    transform: none;
  }
}
```

`prefers-reduced-motion` 은 **모션을 줄여달라는 요청이지 피드백을 없애달라는 요청이 아니다.** 지금 구현은 전형적인 과잉 대응이다:

- `transition-duration: 0.01ms !important` 가 `.chip` / `.brush` 의 `background` 전환까지 죽인다. 이 앱에서 `transition` 은 단 두 곳이고 둘 다 `transform … , background …` 형태다. `transform` 은 바로 아래 `transform: none` 이 이미 막고 있으므로, 이 blanket 규칙이 실제로 없애는 건 **색 전환뿐**이다.
- `animation-duration: 0.01ms !important` 가 `notice-in`(가구 거절 토스트)과 `verdict-in`(정답/오답 판정)의 **페이드인까지** 한 프레임으로 만든다. 이 둘은 화면에 새 정보가 나타났다는 유일한 시각 신호다. 이동만 빼고 투명도는 남겨야 한다.

즉 모션 민감 사용자는 지금 **다른 사용자보다 적은 피드백**을 받는다. 접근성 설정이 경험을 악화시키고 있다.

## Target

### (가) hover 를 진짜 포인터가 있는 기기로 한정

```css
/* target — src/index.css:103-105 을 대체 */
@media (hover: hover) and (pointer: fine) {
  .chip:hover {
    transform: translateY(-1px);
  }
}
```

### (나) 이동만 끄고 투명도·색은 남긴다

파일 어딘가(`@keyframes notice-in` 근처)에 이동 없는 페이드 키프레임을 추가한다:

```css
/* target — 새 키프레임 */
/* reduced-motion 에서 등장 모션을 대체한다. 이동만 빼고 투명도는 남긴다. */
@keyframes fade-in {
  from {
    opacity: 0;
  }
}
```

reduced-motion 블록을 아래로 대체한다:

```css
/* target — src/index.css:595-607 을 대체 */
@media (prefers-reduced-motion: reduce) {
  /* 기본은 전부 정지. 아래에서 이동 없는 피드백만 되살린다. */
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
  /* 새 정보가 나타났다는 신호는 남겨야 한다 — 이동 없이 투명도만 */
  .notice,
  .verdict {
    animation: fade-in 0.18s ease-out !important;
  }
  .chip:hover,
  .chip:active,
  .brush:active {
    transform: none;
  }
}
```

바뀐 점 세 가지:

1. `transition-duration: 0.01ms !important` **삭제** → `background` 색 전환이 살아난다. `transform` 은 아래 `transform: none` 이 계속 막는다.
2. `animation-iteration-count: 1 !important` **추가** → 앞으로 반복 애니메이션이 생겨도 무한 반복되지 않는다.
3. `.notice` / `.verdict` 만 `fade-in` 으로 **되살린다**. `!important` 가 붙은 `animation` 단축 속성이라 위 blanket 의 duration 을 이긴다.

`cell-nope`(가구 거절 흔들림)은 blanket 규칙에 그대로 걸려 정지한다 — 의도된 것이다. 흔들림이 없어도 `.cell.denied` 의 `background: #f7e2dc` 붉은 기와 토스트가 남으므로 거절 사실은 여전히 전달된다.

## Repo conventions to follow

- 모든 스타일은 `src/index.css` 한 파일에 있다. 새 CSS 파일을 만들지 말 것.
- 주석은 한국어로 쓴다.
- 이 저장소는 이미 `@media (max-width: 760px)`(`src/index.css:608`) 로 미디어 쿼리를 쓴다. 같은 위치·같은 서식(파일 하단, 블록 사이 빈 줄 하나)을 따를 것.
- `!important` 는 이 파일에서 reduced-motion 블록 안에서만 쓰인다. 그 관례를 유지하고 다른 곳에 `!important` 를 추가하지 말 것.

## Steps

1. `src/index.css:103-105` 의 `.chip:hover { transform: translateY(-1px); }` 규칙 전체를 `@media (hover: hover) and (pointer: fine) { … }` 로 감싼다. 들여쓰기를 2칸 더 넣을 것.
2. `src/index.css` 의 `@keyframes notice-in { … }` 블록(256-263행, 263행이 닫는 `}`) 바로 아래에 Target 의 주석과 `@keyframes fade-in { from { opacity: 0; } }` 를 추가한다.
3. `src/index.css:600` 의 `transition-duration: 0.01ms !important;` 줄을 **삭제**한다 (바로 위 599행의 `animation-duration: 0.01ms !important;` 는 **남긴다** — 헷갈리지 말 것).
4. 같은 자리(3단계에서 지운 줄이 있던 곳)에 `animation-iteration-count: 1 !important;` 를 추가한다.
5. reduced-motion 블록의 `*` 규칙이 끝난 직후, `.chip:hover, .chip:active, .brush:active` 규칙 **앞에** Target 의 `.notice, .verdict { animation: fade-in 0.18s ease-out !important; }` 규칙과 그 위 한국어 주석을 추가한다.
6. **토큰 사용 여부 확인**: `grep -n "\-\-dur-fast" src/index.css` 를 실행한다. 결과가 있으면(계획 001 이 이미 적용된 상태) 5단계에서 추가한 값을 `animation: fade-in var(--dur-fast) var(--ease-out) !important;` 로 바꾼다. 결과가 없으면 `0.18s ease-out` 그대로 둔다.
7. `.chip:active` 와 `.brush:active` 규칙 자체는 건드리지 말 것 — hover 와 달리 `:active` 는 터치에서도 올바르게 동작한다(누르는 동안만 유지).

## Boundaries

- `src/index.css` **외의 파일을 수정하지 말 것.** `.tsx` 파일과 마크업은 전혀 건드리지 않는다.
- `.cell:hover`(`src/index.css:289`)를 미디어 쿼리로 감싸지 말 것. 배경색만 바꾸고 `transform` 이 없어 터치에서 문제가 되지 않으며, 감싸면 데스크톱 격자 hover 가 사라질 위험만 생긴다.
- `transform: translateY(-1px)` 의 값을 바꾸지 말 것.
- `cell-nope` 을 reduced-motion 에서 되살리지 말 것. 흔들림은 순수한 이동이라 정지가 맞다.
- `.cell.denied` 의 `background: #f7e2dc` 를 건드리지 말 것 — reduced-motion 에서 거절을 알리는 신호가 여기에 걸려 있다.
- `@media (max-width: 760px)` 블록을 건드리지 말 것.
- 의존성을 추가하지 말 것.
- 커밋 스탬프(`a1516a1`) 이후 코드가 달라져 위 인용문과 일치하지 않으면 **즉시 중단하고 보고할 것.**

## Verification

- **기계적**: `npm run lint && npm run build` 오류 0. `npm test` 19개 통과.
- **정적 확인**: `grep -c "transition-duration: 0.01ms" src/index.css` → `0`. `grep -c "hover: hover" src/index.css` → `1`.
- **Feel check (가) — 터치**: `npm run dev` 후 DevTools → 우측 상단 ⋮ → More tools → **Rendering** 은 아니고, **기기 툴바(Cmd+Shift+M)** 를 켜서 iPhone 프로필을 고른다.
  - 난이도 칩을 탭한다 → 탭한 뒤 칩이 **들린 채 남아 있으면 안 된다.** 다른 곳을 탭하기 전에 원래 높이여야 한다.
  - 기기 툴바를 끄고 데스크톱으로 돌아와 마우스를 칩 위에 올린다 → **1px 올라가야 한다.** 안 올라가면 1단계 미디어 쿼리가 너무 좁게 걸린 것이다.
- **Feel check (나) — reduced motion**: DevTools → Cmd+Shift+P → `Show Rendering` → **Emulate CSS media feature prefers-reduced-motion** 을 `reduce` 로 설정한 뒤
  - 가구 칸을 누른다 → 칸이 **흔들리지 않아야** 하고, 붉은 배경과 토스트는 **떠야** 한다. 토스트는 튀어 올라오지 않고 **부드럽게 나타나야**(페이드) 한다. 한 프레임에 툭 나타나면 5단계가 안 먹은 것이다.
  - 용의자를 지목한다 → 판정 문구가 위로 이동하지 않고 **페이드로만** 나타나야 한다.
  - 난이도 칩에 마우스를 올린다 → 올라가지 않지만 **배경색은 부드럽게 변해야** 한다. 색이 뚝 끊기듯 바뀌면 3단계가 안 먹은 것이다.
  - DevTools → Animations 패널에서 재생 속도를 10% 로 놓고 지목하기를 누르면 `fade-in` 이 목록에 잡혀야 한다.
- **Done when**: 터치 에뮬레이션에서 칩이 눌러붙지 않고, 데스크톱 hover 는 그대로이며, reduced-motion 에서 이동은 사라지되 페이드·색 전환은 남고, lint·build·test 가 통과한다.
