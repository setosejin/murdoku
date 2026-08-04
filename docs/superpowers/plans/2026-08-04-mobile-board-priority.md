# 모바일 보드 우선 배분 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모바일에서 난이도가 올라도 보드가 깎이지 않게 세로 공간 배분을 뒤집고, 증언 목록에 스크롤 신호를 주고, 상단에 게임 이름을 세운다.

**Architecture:** 순수 레이아웃 변경이다. `.mplay` 에 `aspect-ratio: 1` 로 flex 기준 크기를 주고 `flex-shrink` 를 보드 1 : 증언 목록 100 으로 벌려, 부족분을 증언 목록이 먼저 진다. 증언 목록은 안에서 스크롤하고 잘린 가장자리를 `mask-image` 로 흐리게 한다. 퍼즐 생성·판정 로직(`generate.ts`·`solve.ts`·`clues.ts`)은 건드리지 않는다.

**Tech Stack:** React 19 + Vite 8 + TypeScript, 플레인 CSS(프레임워크 없음), Vitest 4 (`renderToStaticMarkup` 기반, jsdom 없음), oxlint. 검증은 `/tmp/pw` 의 Playwright WebKit.

**설계 문서:** `docs/superpowers/specs/2026-08-04-mobile-board-priority-design.md`

## Global Constraints

- **의존성을 추가하지 않는다.** 솔버는 라이브러리 없는 백트래킹이고 스타일도 플레인 CSS다. Playwright 는 저장소 밖(`/tmp/pw`)에만 둔다.
- **UI 문자열·주석은 한국어로 쓴다.**
- **소스 파일은 500줄을 넘지 않는다** (`src/repo.test.ts` 가 검사).
- **CSS 어디에도 `repeat(var(` 를 쓰지 않는다** (`src/repo.test.ts` 가 검사, webkit#202259). 같은 이유로 값이 바뀌는 자리의 `calc()` 안에 `var()` 를 넣지 않는다.
- **`src/index.css` 의 `@import` 순서 = 캐스케이드 순서.** 이번 작업은 새 CSS 파일을 만들지 않으므로 진입점을 건드리지 않는다.
- **터치 타깃은 40px 아래로 내리지 않는다.** 증언 줄은 이 화면에서 가장 자주 누르는 컨트롤이다.
- **`src/hooks/useMediaQuery.ts` 의 `MOBILE_QUERY` 와 `src/styles/mobile.css` 의 미디어 쿼리는 글자까지 같아야 한다** (`mobile.test.ts` 가 검사). 이번 작업은 쿼리 자체를 바꾸지 않는다.
- **전역 클래스(`.chip`·`.link`·`.ver`)를 부모 선택자로 묶지 않는다.**
- **커밋 메시지는 한국어**로 쓰고 끝에 `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>` 를 붙인다.
- **`transition` 에 `all` 을 쓰지 않는다** — 속성을 명시한다.

## File Structure

새로 만드는 소스 파일은 없다. 전부 기존 파일 수정이다.

| 파일 | 책임 | 이번에 바뀌는 것 |
|---|---|---|
| `src/styles/mobile.css` | 모바일 셸 세로 배분 | 보드 우선 배분, 워드마크 스타일, 되돌림 블록 둘 |
| `src/components/MobileShell.tsx` | 모바일 셸 마크업 | 상단바에 `<h1>` 추가 |
| `src/components/ClueList.tsx` | 증언 목록 겸 브러시 (두 셸 공용) | 고른 줄 `scrollIntoView`, `data-fade` 상태 |
| `src/styles/clues.css` | 증언 목록 모양 (두 셸 공용) | `scroll-behavior`, `[data-fade]` 마스크 |
| `src/styles/motion.css` | `prefers-reduced-motion` 되돌림 (맨 마지막 import) | `scroll-behavior` 되돌림 |
| `src/hooks/useGame.ts` | 게임 상태 (두 셸 공용) | `reset` 이 브러시도 되돌린다 |
| `src/components/mobile.test.ts` | 모바일 셸·증언 목록·`mobile.css` 불변식 | 새 불변식 5개 |
| `CHANGELOG.md` | 버전 기록 겸 앱 안 모달 | v0.9.0 항목 |

`ClueList.tsx` 는 45줄 → 약 85줄이 된다. 500줄 규약에 여유가 크다.

---

### Task 1: 보드 우선 배분

`.mplay` 에 정사각 기준 크기를 주고 `flex-shrink` 가중치를 뒤집는다. 이 작업만으로 "난이도가 오르면 보드가 깎인다" 가 사라진다.

**Files:**
- Modify: `src/styles/mobile.css:81-89` (`.mplay` 주 블록), `:103-107` (`@supports not` 블록), `:127-132` (`.mshell > .clue-list`), `:248-255` (가로 모드 블록)
- Test: `src/components/mobile.test.ts` — `describe('모바일 스타일 불변식')` 안 (파일 끝 `노치 안전영역을 쓴다` 바로 뒤)

**Interfaces:**
- Consumes: 없음 (첫 작업)
- Produces: `.mplay { aspect-ratio: 1 }` 와 `.mshell > .clue-list { flex: 0 100 auto; min-height: 132px }`. Task 3·4 가 증언 목록이 실제로 스크롤한다는 전제를 여기서 얻는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/components/mobile.test.ts` 의 `describe('모바일 스타일 불변식', ...)` 안, `it('노치 안전영역을 쓴다', ...)` 바로 뒤에 붙인다.

```ts
  // 인원수가 곧 증언 줄 수라, 보드에 기준 크기가 없으면 목록이 세로 공간을 먼저
  // 다 챙겨서 난이도가 오를수록 보드가 깎인다 (iPhone SE 에서 355 → 247px 이었다).
  // .mplay 는 container-type: size 라 내용이 크기에 관여하지 못한다 —
  // aspect-ratio 가 유일한 기준값이다
  it('보드에 정사각 기준 크기가 있다', () => {
    expect(mobileCss).toContain('aspect-ratio: 1;');
  });

  // 부족분을 누가 지느냐. 보드 1 : 목록 100 이라 사실상 목록이 다 진다 —
  // 보드 높이를 calc() 로 역산하지 않고 순환 참조를 flex 가중치로 푼 것
  it('자리가 모자라면 증언 목록이 보드보다 먼저 줄어든다', () => {
    expect(mobileCss).toContain('flex: 1 1 auto'); // .mplay
    expect(mobileCss).toContain('flex: 0 100 auto'); // .mshell > .clue-list
    expect(mobileCss).toContain('min-height: 132px'); // 증언 3줄 바닥
  });

  // 가로 모드는 grid 라 aspect-ratio 가 트랙 계산을 어긋나게 하고,
  // 구형 Safari 경로는 폭에만 맞추고 넘치면 스크롤하는 다른 배분이다
  it('가로 모드와 구형 Safari 경로에서는 정사각 기준을 되돌린다', () => {
    expect((mobileCss.match(/aspect-ratio: auto;/g) ?? []).length).toBe(2);
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run -t "모바일 스타일 불변식"`
Expected: FAIL — `aspect-ratio: 1;`, `flex: 0 100 auto`, `min-height: 132px`, `aspect-ratio: auto;` 모두 `mobile.css` 에 없다.

- [ ] **Step 3: `.mplay` 주 블록에 기준 크기를 준다**

`src/styles/mobile.css:81-89` 를 통째로 바꾼다.

```css
  /* ---- 보드: 폭과 높이 중 작은 쪽에 맞춘 정사각 ---- */
  .mplay {
    flex: 1 1 auto;
    /* 가로에 맞춘 정사각이 flex 기준 크기가 된다. container-type: size 라
       내용이 크기에 관여하지 못해서, 이게 없으면 기준이 0 이 되고 증언 목록이
       제 내용 높이를 먼저 다 챙겨간다 — 인원이 늘수록 보드가 깎이던 원인이다.
       남는 몫도 여기가 받는다(flex-grow). 보드는 정사각이 상한이라 더 커지지
       않고 가운데 설 뿐이라, 세로 여유가 있는 큰 폰은 예전 화면 그대로다 */
    aspect-ratio: 1;
    /* 목록이 3줄 바닥에 닿은 뒤에야 보드가 여기까지 작아진다 */
    min-height: 200px;
    display: grid;
    place-items: center;
    container-type: size;
  }
```

- [ ] **Step 4: 구형 Safari 경로에서 되돌린다**

`src/styles/mobile.css:104-107` 의 `@supports not (container-type: size)` 안 `.mplay` 규칙을 바꾼다.

```css
    .mplay {
      display: block;
      overflow: auto;
      /* 폭에만 맞추고 넘치면 스크롤하는 옛 경로다 — 정사각 기준은 여기 오면 안 된다 */
      aspect-ratio: auto;
    }
```

- [ ] **Step 5: 증언 목록이 먼저 줄어들게 한다**

`src/styles/mobile.css:127-132` 을 바꾼다.

```css
  .mshell > .clue-list {
    /* 자리가 모자라면 보드보다 100배 빨리 줄어든다 — 부족분은 사실상 여기가 다 진다.
       자라지는 않는다(grow 0): 남는 몫은 .mplay 가 받아 보드를 가운데 세운다 */
    flex: 0 100 auto;
    /* 증언 3줄(40px × 3 + 간격 3px × 2)은 지킨다. 여기 닿으면 보드가 줄기 시작한다 */
    min-height: 132px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
```

- [ ] **Step 6: 가로 모드에서 되돌린다**

`src/styles/mobile.css:248-255` 의 `.mplay` 와 `.mshell > .clue-list` 를 바꾼다.

```css
  .mplay {
    grid-area: board;
    /* 여기는 세로로 쌓는 배분이 아니다. aspect-ratio 를 남기면 grid 트랙
       계산이 어긋난다 — 세로 배분의 기준값과 바닥을 둘 다 되돌린다 */
    aspect-ratio: auto;
    min-height: 0;
    min-width: 0;
  }
  .mshell > .clue-list {
    grid-area: clues;
    min-height: 0;
  }
```

- [ ] **Step 7: 테스트가 통과하는지 본다**

Run: `npx vitest run src/components/mobile.test.ts src/repo.test.ts`
Expected: PASS (전부)

- [ ] **Step 8: 커밋**

```bash
git add src/styles/mobile.css src/components/mobile.test.ts
git commit -m "$(cat <<'EOF'
모바일에서 보드가 자리를 먼저 잡는다

인원수가 곧 증언 줄 수라 목록이 세로로 자라는 만큼 보드가 깎이고 있었다.
.mplay 는 container-type: size 라 flex 기준이 0 이어서 목록이 제 내용
높이를 먼저 다 챙겨갔다. aspect-ratio 로 기준을 주고 flex-shrink 를
보드 1 : 목록 100 으로 벌린다.

iPhone SE 7×7 기준 보드 247 → 354px, 칸 34 → 49px.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 2: 모바일 상단에 게임 이름

데스크톱 `.topbar` 에만 있던 `<h1>` 을 모바일 셸에도 세운다. 상단바 높이는 옆의 44px 버튼이 정하므로 **세로 비용이 0** 이다 — Task 1 에서 되찾은 보드 크기가 그대로 남는다.

**Files:**
- Modify: `src/components/MobileShell.tsx:29-51` (`<header className="mtop">`)
- Modify: `src/styles/mobile.css:30-36` 바로 뒤 (`.mtop` 규칙과 `.mtitle` 규칙 사이)
- Test: `src/components/mobile.test.ts` — `describe('모바일 셸 렌더링')` 안

**Interfaces:**
- Consumes: Task 1 의 배분 (워드마크가 세로를 안 먹는다는 전제)
- Produces: `<h1 class="mbrand">murdoku</h1>` 마크업. 이후 작업이 참조하지 않는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/components/mobile.test.ts` 의 `describe('모바일 셸 렌더링', ...)` 안, `it('붙박이는 상단바·보드·증언 목록·액션바 넷뿐이다', ...)` 바로 뒤에 붙인다.

```ts
  // 데스크톱 .topbar 에만 게임 이름이 있어서 모바일에는 h1 자체가 없었다.
  // 상단바 높이는 옆의 44px 버튼이 정하므로 여기 넣는 건 세로 비용이 0 이다
  it('게임 이름을 h1 으로 세운다', () => {
    expect(html).toContain('<h1 class="mbrand">murdoku</h1>');
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run -t "게임 이름을 h1 으로 세운다"`
Expected: FAIL — 마크업에 `mbrand` 가 없다.

- [ ] **Step 3: 마크업을 넣는다**

`src/components/MobileShell.tsx` 의 `<header className="mtop">` 바로 다음 줄에 넣는다. 기존 `<button className="mtitle" …>` 앞이다.

```tsx
      <header className="mtop">
        {/* 데스크톱 .topbar 의 h1 에 대응한다. 이 자리는 세로 비용이 0 이다 —
            상단바 높이는 옆의 44px 버튼들이 정하고 워드마크는 그 안에 든다.
            대가는 사건 제목의 가로 폭이고, .mtitle b 의 말줄임이 받는다 */}
        <h1 className="mbrand">murdoku</h1>
        <button
          type="button"
          className="mtitle"
```

- [ ] **Step 4: 스타일을 넣는다**

`src/styles/mobile.css` 의 `.mtop { … }` 블록(30-36행) 바로 뒤, `.mtitle` 앞에 넣는다.

```css
  /* 게임 이름. 데스크톱 부제(`머도쿠`)는 안 붙인다 — 45px 을 더 먹고,
     이름은 `murdoku` 하나로 선다 */
  .mbrand {
    flex: none;
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1;
    white-space: nowrap;
  }
```

- [ ] **Step 5: 테스트가 통과하는지 본다**

Run: `npx vitest run src/components/mobile.test.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/components/MobileShell.tsx src/styles/mobile.css src/components/mobile.test.ts
git commit -m "$(cat <<'EOF'
모바일 상단에 게임 이름

데스크톱 .topbar 에만 murdoku 가 있어서 모바일에는 h1 자체가 없었다.
상단바 높이는 옆의 44px 버튼이 정하므로 세로 비용이 0 이다 — 보드는
그대로다. 대가는 사건 제목의 가로 폭이고 말줄임이 받는다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 3: 고른 증언 줄을 보이게

목록이 넘치면 마지막으로 보이는 줄이 반쯤 걸친다. 그 줄을 눌러 브러시로 삼았을 때 걸친 채로 두지 않는다.

**Files:**
- Modify: `src/components/ClueList.tsx` (전체 45줄)
- Modify: `src/styles/clues.css:4-15` (`.clue-list`)
- Modify: `src/styles/motion.css` (`@media (prefers-reduced-motion: reduce)` 안)
- Test: `src/components/mobile.test.ts` — `describe('증언 목록 = 메모 브러시')` 안

**Interfaces:**
- Consumes: Task 1 의 `.mshell > .clue-list { flex: 0 100 auto; min-height: 132px }` — 목록이 실제로 스크롤한다는 전제
- Produces: `ClueList` 안의 `listRef: RefObject<HTMLUListElement | null>` 와 `<ul ref={listRef}>`. **Task 4 가 같은 ref 를 재사용한다** — Task 4 에서 새로 만들지 말 것.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/components/mobile.test.ts` 의 `describe('증언 목록 = 메모 브러시', ...)` 안 맨 뒤에 붙인다. 파일 맨 위 import 에 `clues.css`·`motion.css` 원문을 추가한다.

```ts
// 파일 상단, `import mobileCss from '../styles/mobile.css?raw';` 바로 뒤
import cluesCss from '../styles/clues.css?raw';
import motionCss from '../styles/motion.css?raw';
```

```ts
  // 목록이 넘치면 마지막 줄이 반쯤 걸친다. 그 줄을 골랐을 때 걸친 채로 두지 않는다 —
  // 어디로 갈지는 JS(scrollIntoView), 어떻게 갈지는 CSS 가 정한다
  it('고른 줄로 미끄러진다 (모션은 CSS 가 정한다)', () => {
    expect(cluesCss).toContain('scroll-behavior: smooth');
    expect(motionCss).toContain('scroll-behavior: auto !important');
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run -t "고른 줄로 미끄러진다"`
Expected: FAIL — 두 CSS 어디에도 `scroll-behavior` 가 없다.

- [ ] **Step 3: `ClueList` 에 ref 와 effect 를 넣는다**

`src/components/ClueList.tsx` 를 아래로 바꾼다. import 줄과 `<ul>` 태그가 바뀐다.

```tsx
import { useEffect, useRef } from 'react';
import type { Puzzle } from '../game/types';
import { VICTIM_LINE } from './CaseCards';

/**
 * 증언 목록 겸 메모 브러시 선택기.
 *
 * 모바일에서 증언과 브러시를 따로 두면 둘이 한 화면에 못 들어온다. 한 덩어리로 합치면
 * "이 사람이 여기 있었다고 표시한다" 는 조작이 증언을 읽는 자리에서 그대로 이어진다.
 */
export default function ClueList({
  puzzle,
  brush,
  setBrush,
}: {
  puzzle: Puzzle;
  brush: string;
  setBrush: (id: string) => void;
}) {
  const clueOf = (id: string) => puzzle.clues.find((c) => c.personId === id)?.text ?? '';
  const listRef = useRef<HTMLUListElement>(null);

  // 자리가 좁으면 목록이 안에서 스크롤하고 마지막 줄이 반쯤 걸친다. 걸친 줄을
  // 골랐을 때 그대로 두지 않는다. block: 'nearest' 라 이미 다 보이면 아무 일도
  // 하지 않는다 — 부드럽게 갈지는 clues.css 의 scroll-behavior 가 정한다
  useEffect(() => {
    listRef.current?.querySelector('.clue-row.on')?.scrollIntoView({ block: 'nearest' });
  }, [brush]);

  return (
    // 사건이 바뀌면 목록을 통째로 갈아끼운다. <li> 의 key 가 A/B/C/V 로 고정이라
    // 그냥 두면 React 가 DOM 을 재사용해서, 보드는 페이드하는데 이름만 제자리에서
    // 바뀐다. 여기에 key 를 두면 두 셸이 다 고쳐진다 (등장 페이드는 clues.css)
    <ul className="clue-list" key={`${puzzle.seed}:${puzzle.n}`} ref={listRef}>
      {puzzle.people.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            className={`clue-row${brush === p.id ? ' on' : ''}`}
            aria-pressed={brush === p.id}
            aria-label={`${p.name} 로 표시하기`}
            onClick={() => setBrush(p.id)}
          >
            <span className="clue-badge" style={{ background: p.color }}>
              {p.id}
            </span>
            <b>{p.name}</b>
            <span className="clue-text">{p.isVictim ? VICTIM_LINE : clueOf(p.id)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: `clues.css` 에 모션을 넣는다**

`src/styles/clues.css` 의 `.clue-list { … }` 블록(4-15행) 안, `transition` 선언 바로 뒤에 넣는다.

```css
  /* 고른 줄을 끌어올 때 튀지 않게 (ClueList 의 scrollIntoView).
     두 셸 모두 이 요소가 스크롤 주체다 — mobile.css 와 desktop.css 가 각자 건다 */
  scroll-behavior: smooth;
```

- [ ] **Step 5: `motion.css` 에 되돌림을 넣는다**

`src/styles/motion.css` 의 `@media (prefers-reduced-motion: reduce) { … }` 안, `.seg-pill` 규칙 바로 앞에 넣는다.

```css
  /* 증언 목록은 고른 줄로 미끄러지지 않고 바로 옮겨 간다 */
  .clue-list {
    scroll-behavior: auto !important;
  }
```

- [ ] **Step 6: 테스트가 통과하는지 본다**

Run: `npx vitest run src/components/mobile.test.ts src/components/render.test.ts`
Expected: PASS (전부). `renderToStaticMarkup` 은 effect 를 실행하지 않으므로 기존 마크업 단언은 그대로 통과한다.

- [ ] **Step 7: 린트**

Run: `npm run lint`
Expected: 경고·오류 없음. `react/rules-of-hooks` 가 켜져 있으므로 `useRef`/`useEffect` 가 컴포넌트 최상단에 있어야 한다.

- [ ] **Step 8: 커밋**

```bash
git add src/components/ClueList.tsx src/styles/clues.css src/styles/motion.css src/components/mobile.test.ts
git commit -m "$(cat <<'EOF'
고른 증언 줄이 걸친 채로 남지 않는다

목록이 넘치면 마지막 줄이 반쯤 걸치는데, 그 줄을 브러시로 골라도
걸친 상태 그대로였다. block: 'nearest' 라 이미 다 보이면 아무 일도
안 한다. 어디로 갈지는 JS, 어떻게 갈지는 CSS 가 정한다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 4: 증언 목록 스크롤 페이드

잘린 가장자리를 흐리게 해서 "더 있다"를 말한다. 끝에 닿은 쪽은 걷는다.

**Files:**
- Modify: `src/components/ClueList.tsx` (Task 3 의 결과물 위에)
- Modify: `src/styles/clues.css` (`.clue-list` 블록 바로 뒤)
- Test: `src/components/mobile.test.ts` — `describe('증언 목록 = 메모 브러시')` 안

**Interfaces:**
- Consumes: Task 3 의 `listRef` (**새로 만들지 말고 그대로 쓴다**), Task 3 이 추가한 `cluesCss` import
- Produces: `<ul data-fade={fade || undefined}>` — `fade` 는 `'' | 'top' | 'bottom' | 'both'`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/components/mobile.test.ts` 의 `describe('증언 목록 = 메모 브러시', ...)` 안 맨 뒤에 붙인다.

```ts
  // 넘치는 쪽 가장자리만 흐리게 한다. 늘 켜두면 끝까지 내려도 마지막 줄이
  // 영영 흐려 보인다 — 끝에 닿은 쪽은 ClueList 가 data-fade 에서 뺀다
  it('잘린 가장자리만 흐리게 하고 끝에 닿은 쪽은 걷는다', () => {
    for (const state of ['top', 'bottom', 'both'])
      expect(cluesCss).toContain(`.clue-list[data-fade='${state}']`);
    // 안 넘치면 속성 자체가 없다 (서버 렌더에는 effect 가 안 돈다)
    expect(html('X')).not.toContain('data-fade');
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run -t "잘린 가장자리만 흐리게"`
Expected: FAIL — `clues.css` 에 `[data-fade=` 규칙이 없다.

- [ ] **Step 3: `ClueList` 에 상태와 관찰을 넣는다**

`src/components/ClueList.tsx` 의 import 줄을 바꾸고, Task 3 이 넣은 `useEffect` 바로 뒤에 새 effect 를 넣는다.

```tsx
import { useEffect, useRef, useState } from 'react';
```

```tsx
  const [fade, setFade] = useState('');

  // 잘린 가장자리를 흐리게 해서 "더 있다" 를 말한다. 끝에 닿은 쪽은 걷는다 —
  // 늘 켜두면 마지막 줄이 영영 흐려 보인다.
  // 의존성이 필요하다: key 가 <ul> 에 붙어 있어서 사건이 바뀌면 DOM 노드가
  // 갈리는데, 빈 배열로 두면 리스너가 떨어져 나간 옛 노드에 남는다.
  // ResizeObserver 는 창 크기·회전을, 이 의존성은 난이도 교체를 잡는다
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const read = () => {
      const over = el.scrollHeight - el.clientHeight;
      if (over <= 1) return setFade('');
      const up = el.scrollTop > 1;
      const down = el.scrollTop < over - 1;
      setFade(up && down ? 'both' : up ? 'top' : down ? 'bottom' : '');
    };
    read();
    el.addEventListener('scroll', read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', read);
      ro.disconnect();
    };
  }, [puzzle.seed, puzzle.n]);
```

`<ul>` 에 속성을 붙인다. 넘치지 않으면 `fade` 가 빈 문자열이고 `undefined` 로 떨어져 속성 자체가 안 나간다.

```tsx
    <ul
      className="clue-list"
      key={`${puzzle.seed}:${puzzle.n}`}
      ref={listRef}
      data-fade={fade || undefined}
    >
```

- [ ] **Step 4: `clues.css` 에 마스크를 넣는다**

`src/styles/clues.css` 의 `@starting-style { .clue-list { opacity: 0; } }` 블록 바로 뒤, `.clue-row` 앞에 넣는다.

```css
/* 넘치는 목록의 잘린 가장자리를 흐리게 — "더 있다" 는 신호다.
   끝에 닿은 쪽은 걷는다(ClueList 가 data-fade 로 알려준다). 늘 켜두면
   끝까지 내려도 마지막 줄이 영영 흐려 보인다.
   calc() 안에 var() 를 쓰지 않는다 — WebKit 이 값을 캐싱한다 (webkit#202259).
   mask-image 는 Safari 15.4+ 다. 그 아래는 페이드만 없고 스크롤은 그대로 된다 */
.clue-list[data-fade='top'] {
  mask-image: linear-gradient(to bottom, transparent, #000 24px);
}
.clue-list[data-fade='bottom'] {
  mask-image: linear-gradient(to top, transparent, #000 24px);
}
.clue-list[data-fade='both'] {
  mask-image: linear-gradient(
    to bottom,
    transparent,
    #000 24px,
    #000 calc(100% - 24px),
    transparent
  );
}
```

- [ ] **Step 5: 테스트가 통과하는지 본다**

Run: `npx vitest run`
Expected: PASS (전체 스위트). `repo.test.ts` 의 `repeat(var(` 금지와 500줄 규약도 함께 본다.

- [ ] **Step 6: 린트**

Run: `npm run lint`
Expected: 경고·오류 없음

- [ ] **Step 7: 커밋**

```bash
git add src/components/ClueList.tsx src/styles/clues.css src/components/mobile.test.ts
git commit -m "$(cat <<'EOF'
증언 목록의 잘린 가장자리를 흐리게

자리가 좁으면 목록이 안에서 스크롤하는데 더 있다는 신호가 없었다.
끝에 닿은 쪽은 걷는다 — 늘 켜두면 마지막 줄이 영영 흐려 보인다.
JS 는 상태만 읽고 그림은 CSS 가 그린다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 5: 사건이 바뀌면 브러시도 돌려놓는다

`reset()` 이 `marks`·`accused` 는 비우면서 `brush` 는 그대로 뒀다. 7×7 에서 `F` 를 고른 채 4×4 로 가면 `F` 인 사람이 없어 켜진 줄이 하나도 없고, 칸에는 색 없는 `F` 토큰이 찍힌다. 스크롤하는 목록에서는 이게 "내가 뭘 고른 거지"가 된다.

**Files:**
- Modify: `src/hooks/useGame.ts:39-50` (`reset`)

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (동작만 바뀐다)

**테스트가 없는 이유:** `useGame` 은 훅이라 상태를 바꾸고 다시 그리려면 테스트 렌더러(jsdom 또는 testing-library)가 필요하다. 이 저장소는 jsdom 없이 `renderToStaticMarkup` 만 쓰고 "의존성 추가는 기본적으로 하지 않는다"가 규약이다. 이 한 줄을 지키자고 테스트 스택을 통째로 들이지는 않는다. 대신 **아래 Step 1·3 이 실제 브라우저에서 고치기 전/후를 대조하는 것으로 테스트를 대신한다** — 실패를 먼저 보고 고친다는 순서는 그대로다.

- [ ] **Step 1: 고치기 전 상태를 브라우저에서 확인한다**

개발 서버가 없으면 띄운다.

```bash
npm run dev -- --port 5199 --host 127.0.0.1
```

`/tmp/pw` 에서 아래를 돌린다. 하단 액션바의 `빈칸` 버튼은 브러시가 `X` 일 때만
`aria-pressed="true"` 다 — 브러시가 어디를 가리키는지 이걸로 본다.

```bash
cd /tmp/pw && cat > brush-check.mjs <<'EOF'
import { webkit } from 'playwright';
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle' });
await p.click('.micon'); await p.waitForTimeout(250);
await p.click('.seg-btn[aria-label*="(7×7)"]'); await p.waitForTimeout(450);
await p.click('.clue-row >> nth=5');            // 여섯째 사람(F)을 브러시로 고른다
await p.click('.micon'); await p.waitForTimeout(250);
await p.click('.seg-btn[aria-label*="(4×4)"]'); await p.waitForTimeout(450);
console.log('켜진 증언 줄:', await p.locator('.clue-row.on').count());
console.log('빈칸 버튼 눌림:', await p.locator('.mbar-btn[aria-pressed="true"]').count());
await b.close();
EOF
node brush-check.mjs
```

Expected (고치기 전): `켜진 증언 줄: 0`, `빈칸 버튼 눌림: 0` — 브러시가 없는 사람 `F` 를
가리켜 아무것도 안 켜져 있다. 버그가 재현된다.

- [ ] **Step 2: `reset` 이 브러시도 돌려놓게 한다**

`src/hooks/useGame.ts` 의 `reset` 에서 `setMarks({});` 바로 뒤에 넣는다.

```ts
    setMarks({});
    // 브러시도 같이 돌려놓는다. 7×7 에서 F 를 고른 채 4×4 로 가면 F 인 사람이
    // 없어 목록에 켜진 줄이 하나도 없고, 칸에는 색 없는 F 토큰이 찍힌다
    setBrush('X');
```

- [ ] **Step 3: 고쳐졌는지 같은 방법으로 확인한다**

Run: `cd /tmp/pw && node brush-check.mjs`

Expected (고친 뒤): `켜진 증언 줄: 0`, `빈칸 버튼 눌림: 1` — 브러시가 `X` 로 돌아왔다.
증언 줄이 0 인 건 이제 정상이다(`X` 는 목록에 줄이 없다).

- [ ] **Step 4: 회귀가 없는지 본다**

Run: `npx vitest run`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add src/hooks/useGame.ts
git commit -m "$(cat <<'EOF'
사건이 바뀌면 메모 브러시도 돌려놓는다

reset 이 marks·accused 는 비우면서 brush 는 그대로 뒀다. 7×7 에서 F 를
고른 채 4×4 로 가면 F 인 사람이 없어 켜진 줄이 하나도 없고 칸에는 색
없는 F 토큰이 찍혔다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 6: WebKit 실측 검증

Chromium 에서 멀쩡한 레이아웃 버그는 대부분 Safari 전용이다. 실제 엔진으로 잰다.

**Files:**
- Create: `/tmp/pw/verify-board.mjs` (**저장소 밖**에 둔다 — 의존성 규약)

**Interfaces:**
- Consumes: Task 1~5 의 결과 전부
- Produces: 검증 수치. Task 7 의 CHANGELOG 문구가 이 숫자를 쓴다.

- [ ] **Step 1: Playwright 를 준비한다 (없을 때만)**

```bash
ls /tmp/pw/node_modules/playwright >/dev/null 2>&1 || \
  (mkdir -p /tmp/pw && cd /tmp/pw && npm init -y && npm i playwright && npx playwright install webkit)
```

- [ ] **Step 2: 개발 서버를 띄운다**

```bash
cd <저장소> && npm run dev -- --port 5199 --host 127.0.0.1
```

다른 셸에서 `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5199/` 가 `200` 이어야 한다.

- [ ] **Step 3: 검증 스크립트를 쓴다**

`/tmp/pw/verify-board.mjs`:

```js
import { webkit } from 'playwright';

const measure = () => {
  const board = document.querySelector('.mplay .board');
  const cell = document.querySelector('.mplay .cell');
  const doc = document.scrollingElement;
  return {
    board: board ? Math.round(board.getBoundingClientRect().height) : 0,
    cell: cell ? Math.round(cell.getBoundingClientRect().width) : 0,
    clipped: board ? board.scrollWidth - board.clientWidth : -1,
    overflow: doc.scrollHeight - doc.clientHeight,
    brand: !!document.querySelector('.mbrand'),
  };
};

const VPS = [
  { name: 'iPhone SE   375x667', width: 375, height: 667, want: { min: 350 } },
  { name: 'iPhone 13   390x844', width: 390, height: 844, want: { min: 365 } },
  { name: '아주 낮음   360x560', width: 360, height: 560, want: { min: 300 } },
  { name: '가로        844x390', width: 844, height: 390, want: { min: 365 } },
];

let bad = 0;
const b = await webkit.launch();
for (const vp of VPS) {
  const ctx = await b.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: true,
    isMobile: true,
  });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle' });
  console.log(`\n=== ${vp.name} ===`);
  // 4 → 7 → 4 → 7 왕복. webkit#202259 는 첫 진입에 안 터진다
  for (const n of [4, 7, 4, 7]) {
    await p.click('.micon');
    await p.waitForTimeout(220);
    await p.click(`.seg-btn[aria-label*="(${n}×${n})"]`);
    await p.waitForTimeout(450);
    const m = await p.evaluate(measure);
    const fail = [];
    if (m.board < vp.want.min) fail.push(`보드 ${m.board} < ${vp.want.min}`);
    if (m.clipped > 0) fail.push(`보드 잘림 ${m.clipped}`);
    if (m.overflow > 0) fail.push(`페이지 넘침 ${m.overflow}`);
    if (!m.brand) fail.push('워드마크 없음');
    if (fail.length) bad++;
    console.log(
      `n=${n} 보드 ${String(m.board).padStart(3)} 칸 ${String(m.cell).padStart(3)} ` +
        (fail.length ? `❌ ${fail.join(', ')}` : '✅'),
    );
  }
  await ctx.close();
}
await b.close();
console.log(bad ? `\n실패 ${bad} 건` : '\n전부 통과');
process.exit(bad ? 1 : 0);
```

- [ ] **Step 4: 돌리고 수치를 확인한다**

Run: `cd /tmp/pw && node verify-board.mjs`

Expected: `전부 통과`. 그리고 아래 수치가 나와야 한다.

| 화면 | n=4 보드/칸 | n=7 보드/칸 |
|---|---|---|
| iPhone SE 375×667 | 355 / 86px | **354 / 49px** (고치기 전 247 / 34px) |
| iPhone 13 390×844 | 370 / 90px | 370 / 51px |
| 360×560 | 306 / 74px | 306 / 42px |
| 가로 844×390 | 374 / 91px | 374 / 52px |

**보드가 난이도에 따라 바뀌지 않는 것이 이 작업의 합격 기준이다.** 칸 크기는 격자가 촘촘해지니 줄어드는 게 맞다.

- [ ] **Step 5: 눈으로도 본다**

```bash
cd /tmp/pw && cat > after-shot.mjs <<'EOF'
import { webkit } from 'playwright';
const b = await webkit.launch();
for (const vp of [
  { tag: 'se-7', width: 375, height: 667, n: 7 },
  { tag: 'land-7', width: 844, height: 390, n: 7 },
]) {
  const ctx = await b.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: true, isMobile: true, deviceScaleFactor: 2,
  });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle' });
  await p.click('.micon'); await p.waitForTimeout(250);
  await p.click(`.seg-btn[aria-label*="(${vp.n}×${vp.n})"]`); await p.waitForTimeout(500);
  await p.screenshot({ path: `/tmp/pw/after-${vp.tag}.png` });
  await ctx.close();
}
await b.close();
EOF
node after-shot.mjs
```

세로(`after-se-7.png`)에서 확인할 것 넷: 보드가 가로를 꽉 채운다 · 상단 왼쪽에
`murdoku` 가 있다 · 증언 목록 아래쪽 가장자리가 흐리다 · 하단 액션바가 제자리에 있다.

가로(`after-land-7.png`)에서 확인할 것 셋: 보드가 왼쪽에 정사각으로 선다(374px) ·
오른쪽 열 상단에 `murdoku` + 사건 제목 + `☰` 가 한 줄로 든다 · 증언 목록이 안 잘린다.
가로 상단바 열은 `minmax(190px, 300px)` 이라 워드마크 65px 이 들어가면 제목 글자가
94px 로 줄어 말줄임된다 — 이건 의도한 대가다.

- [ ] **Step 6: 전체 검사**

```bash
npm test && npm run lint && npm run build
```

Expected: 전부 통과

---

### Task 7: CHANGELOG 와 버전

`main` 푸시는 버전이 올라가야 통과한다. `.githooks/pre-push` 와 `render.test.ts` 가 이중으로 막는다. 기능이 늘었으므로 `minor` 다 (0.8.1 → 0.9.0).

**Files:**
- Modify: `CHANGELOG.md` (맨 위)
- Modify: `package.json` (`npm version` 이 자동으로)

**Interfaces:**
- Consumes: Task 6 의 실측 수치
- Produces: `v0.9.0` 태그

- [ ] **Step 1: CHANGELOG 맨 위에 항목을 쓴다**

`CHANGELOG.md` 의 `# 버전 기록` 바로 다음, `## v0.8.1` 앞에 넣는다.

`ChangelogDialog.tsx` 의 렌더러는 `##`/`###`/`-`/`**굵게**`/`` `코드` ``/`[링크](url)` 만 안다. 표나 중첩 목록을 쓰면 조용히 문단으로 떨어진다.

```markdown
## v0.9.0 — 2026-08-04

### 바뀜

- **모바일에서 난이도를 올려도 보드가 안 줄어든다.** 인원이 곧 증언 줄 수라, 증언 목록이 세로로 자라는 만큼 보드가 깎이고 있었다 — iPhone SE 에서 4×4 355px 이던 판이 7×7 에서 247px 까지, 칸은 34px 까지 내려가 손가락으로 누르기 어려웠다. 이제 보드가 제 자리를 먼저 잡고 모자란 몫은 증언 목록이 진다(7×7 에서 354px, 칸 49px). 세로 여유가 있는 큰 폰은 예전 화면 그대로다.
- **증언 목록에 스크롤 신호가 생겼다.** 자리가 좁아 목록이 잘리면 그쪽 가장자리가 흐려지고, 끝까지 내리면 걷힌다. 반쯤 걸친 줄을 브러시로 고르면 제자리로 끌어온다.
- **모바일 상단에도 `murdoku` 가 선다.** 데스크톱에만 있던 이름이다. 상단바 높이를 안 건드리는 자리라 보드는 그대로다.

### 고침

- **난이도를 바꿔도 메모 브러시가 예전 사람을 가리키고 있었다.** 7×7 에서 `F` 를 고른 채 4×4 로 가면 켜진 줄이 하나도 없고, 칸에는 색 없는 `F` 가 찍혔다.
```

- [ ] **Step 2: 커밋**

```bash
git add CHANGELOG.md
git commit -m "$(cat <<'EOF'
v0.9.0 변경 내용

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

- [ ] **Step 3: 버전을 올린다**

커밋과 태그는 npm 이 만든다.

```bash
npm version minor
```

Expected: `v0.9.0` 출력. `package.json` 이 0.9.0 이 되고 `v0.9.0` 태그가 생긴다.

- [ ] **Step 4: 버전 불변식이 통과하는지 본다**

Run: `npx vitest run -t "CHANGELOG 에 현재 버전 항목이 있다"`
Expected: PASS — `## v0.9.0 — ` 가 CHANGELOG 에 있다.

- [ ] **Step 5: 마지막 전체 검사**

```bash
npm test && npm run lint && npm run build
```

Expected: 전부 통과

- [ ] **Step 6: 푸시는 사람의 판단으로**

푸시·PR 은 **주입된 토큰을 벗겨야** 저장소 주인 계정으로 나간다. 먼저 활성 계정을 확인한다.

```bash
env -u GH_TOKEN -u GITHUB_TOKEN gh auth status
```

주인 계정이면:

```bash
env -u GH_TOKEN -u GITHUB_TOKEN \
git -c credential.https://github.com.helper= \
    -c credential.https://github.com.helper='!gh auth git-credential' \
    -c credential.interactive=auto \
    push -u origin copilot/mobile-board-priority-layout --follow-tags
```

`create_pull_request` 툴은 이 저장소에서 못 쓴다. `env -u GH_TOKEN -u GITHUB_TOKEN gh pr create` 를 쓴다. 머지는 **squash 가 아니라 머지 커밋**이다 — squash·rebase 는 버전 커밋을 다시 써서 `v0.9.0` 태그를 `main` 히스토리 밖으로 떨어뜨린다.

---

## 정리

- [ ] `/tmp/pw` 의 임시 스크립트·스크린샷은 저장소 밖이라 그대로 둬도 되지만, 개발 서버는 끈다.
- [ ] `docs/superpowers/` 의 설계·계획 문서는 커밋된 상태로 남긴다.
