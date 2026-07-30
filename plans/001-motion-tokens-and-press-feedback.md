# 001 — 모션 토큰을 만들고 누름 피드백을 하나로 합친다

- **Status**: DONE
- **Commit**: a1516a1
- **Severity**: LOW
- **Category**: 7 응집·토큰 / 2 이징·지속시간
- **Estimated scope**: 1 파일 (`src/index.css`), 약 20줄

## Problem

이 저장소는 색은 토큰으로 관리하는데 모션은 전부 손으로 박아 넣었다.

`src/index.css:1-10` — `:root` 에 색 토큰 7개가 있고 모션 토큰은 0개다:

```css
/* src/index.css:1 — 현재 */
:root {
  --paper: #f7f1e3;
  --ink: #23201c;
  --wall: #23201c;
  --tile: #fdfaf2;
  --tile-line: #e0d8c6;
  --accent: #c0392b;
  --muted: #7d7466;
  color-scheme: light;
}
```

그 결과 타이밍 값 4종(`0.08s`, `0.15s`, `0.18s`, `0.3s`)과 이징 2종(`ease`, `ease-out`)이 파일 전체에 흩어져 있고, 같은 선언이 **글자 그대로 두 곳에 중복**된다:

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

```css
/* src/index.css:478-484 — 현재 */
  cursor: pointer;
  font-weight: 700;
  transition: transform 0.08s ease, background 0.15s ease;
}
.brush:active {
  transform: scale(0.96);
}
```

두 가지가 잘못됐다:

1. **누름 지속시간 80ms 는 예산 미달이다.** 버튼 누름 피드백 예산은 100–160ms 다. 80ms 는 눈이 인지하기 전에 끝나 "딱딱한 점멸"로 느껴진다.
2. **`ease` 는 누름에 맞지 않는 곡선이다.** `ease` = `cubic-bezier(0.25, 0.1, 0.25, 1)` 로 시작 구간이 느리다(ease-in 성분). 누르는 순간은 사용자가 정확히 보고 있는 순간이라 즉시 반응하는 `ease-out` 이어야 한다.

이 계획은 다른 모든 계획(002~005)이 참조할 토큰을 먼저 심는 **선행 작업**이다.

## Target

`:root` 에 모션 토큰 3개를 추가한다. 값은 그대로 복사할 것 — 근사치를 쓰지 말 것:

```css
/* target — src/index.css:1 의 :root 안, color-scheme 바로 위 */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --dur-press: 160ms;
  --dur-fast: 180ms;
```

`.chip` 과 `.brush` 의 중복된 transition 을 공용 규칙 하나로 합치고, 누름 크기를 `0.97` 로, 지속시간을 `--dur-press` 로, 이징을 `--ease-out` 으로 바꾼다:

```css
/* target — .chip 규칙과 .brush 규칙 사이 어디든, 두 선택자를 함께 */
.chip,
.brush {
  transition: transform var(--dur-press) var(--ease-out), background var(--dur-fast) var(--ease-out);
}
.chip:active,
.brush:active {
  transform: scale(0.97);
}
```

`.notice` 와 `.verdict` 의 `0.18s ease-out` 도 토큰으로 바꾼다:

```css
/* target — src/index.css:255 */
  animation: notice-in var(--dur-fast) var(--ease-out);
```

```css
/* target — src/index.css:530 */
  animation: verdict-in var(--dur-fast) var(--ease-out);
```

`src/index.css:304` 의 `animation: cell-nope 0.3s ease-out` 은 **건드리지 말 것**. 흔들림은 지속시간이 다른 별개의 성격이고 계획 003 이 다룬다.

## Repo conventions to follow

- 커스텀 프로퍼티는 `src/index.css` 맨 위 `:root` 한 곳에만 선언한다. 다른 파일이나 다른 블록에 만들지 말 것.
- 이 프로젝트는 **플레인 CSS 한 파일**이다. CSS 파일을 새로 만들거나 CSS-in-JS 를 도입하지 말 것.
- 섹션은 `/* ---- top bar ---- */` 같은 주석으로 구분한다 (예: `src/index.css:42`). 새 공용 규칙에도 같은 형식의 주석을 붙일 것.
- 주석은 한국어로 쓴다.
- 예시로 삼을 곳: `src/index.css:1-10` 의 `:root` 색 토큰 선언 방식을 그대로 따를 것.

## Steps

1. `src/index.css` 의 `:root` 블록에서 `--muted: #7d7466;` 다음 줄에 위 Target 의 토큰 3줄을 추가한다. `color-scheme: light;` 는 그대로 마지막에 둔다.
2. `src/index.css:101` 의 `transition: transform 0.08s ease, background 0.15s ease;` 줄을 **삭제**한다 (`.chip` 규칙 안).
3. `src/index.css:106-108` 의 `.chip:active { transform: scale(0.96); }` 규칙을 **삭제**한다.
4. `src/index.css:480` 의 `transition: transform 0.08s ease, background 0.15s ease;` 줄을 **삭제**한다 (`.brush` 규칙 안).
5. `src/index.css:482-484` 의 `.brush:active { transform: scale(0.96); }` 규칙을 **삭제**한다.
6. `.brush` 규칙 바로 뒤에 Target 의 `.chip, .brush` 공용 transition 규칙과 `.chip:active, .brush:active` 규칙을 추가하고, 위에 `/* ---- 누름 피드백 (칩·브러시 공용) ---- */` 주석을 단다.
7. `src/index.css:255` 의 `animation: notice-in 0.18s ease-out;` 를 `animation: notice-in var(--dur-fast) var(--ease-out);` 로 바꾼다.
8. `src/index.css:530` 의 `animation: verdict-in 0.18s ease-out;` 를 `animation: verdict-in var(--dur-fast) var(--ease-out);` 로 바꾼다.
9. `src/index.css` 의 `@media (prefers-reduced-motion: reduce)` 블록(약 595행)에 `.chip:active`, `.brush:active` 선택자가 이미 있다. 그대로 두고 손대지 말 것 — 계획 004 가 이 블록을 다룬다.

## Boundaries

- `src/index.css` **외의 파일을 수정하지 말 것.** `.tsx` 파일, 마크업, 클래스명은 전혀 건드리지 않는다.
- `.chip:hover { transform: translateY(-1px) }` 를 건드리지 말 것 — 계획 004 의 범위다.
- `@media (prefers-reduced-motion: reduce)` 블록을 건드리지 말 것 — 계획 004 의 범위다.
- `cell-nope` 키프레임과 그 `animation` 선언을 건드리지 말 것 — 계획 003 의 범위다.
- 색 토큰의 값을 바꾸지 말 것.
- 의존성을 추가하지 말 것. 이 프로젝트는 모션 라이브러리 없이 돌아간다.
- 커밋 스탬프(`a1516a1`) 이후 코드가 달라져 위 인용문과 일치하지 않으면 **즉시 중단하고 보고할 것.** 임의로 맞추지 말 것.

## Verification

- **기계적**: 프로젝트 루트에서 `npm run lint && npm run build` — 둘 다 오류 0으로 끝나야 한다. `npm test` 는 19개 전부 통과해야 한다 (이 계획은 테스트에 영향이 없다).
- **토큰 확인**: `npm run dev` 로 띄운 뒤 DevTools 콘솔에서
  ```js
  getComputedStyle(document.documentElement).getPropertyValue('--ease-out')
  ```
  → `cubic-bezier(0.23, 1, 0.32, 1)` 이 나와야 한다.
- **중복 제거 확인**: `grep -c "transform 0.08s ease" src/index.css` → `0` 이어야 한다.
- **Feel check**: `npm run dev` 후
  - 난이도 칩(`쉬움 (4×4)`)을 마우스로 누르고 있어 본다. 눌린 상태로 살짝 작아진 채 **머물러야** 하고, 떼면 원래 크기로 돌아온다. 이전(80ms)처럼 "깜빡"하고 끝나면 안 된다.
  - 메모 브러시(A/B/C/V/✕ 원형 버튼)를 눌러도 칩과 **똑같은 느낌**이어야 한다. 둘 중 하나만 다르게 반응하면 6단계가 잘못된 것이다.
  - DevTools → Animations 패널에서 재생 속도를 10% 로 놓고 칩을 누른다. 축소가 **처음에 빠르고 끝에서 감속**해야 한다(ease-out). 처음이 느리면 `ease` 가 남아 있는 것이다.
- **Done when**: `--ease-out`/`--dur-press`/`--dur-fast` 가 `:root` 에 있고, `transform 0.08s ease` 문자열이 파일에서 사라졌고, 칩과 브러시가 동일한 누름 반응을 보이며, lint·build·test 가 통과한다.
