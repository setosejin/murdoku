# 플레이 도중 피해자 안내 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 튜토리얼을 안 봤거나 대충 본 사람도 플레이 도중에 두 사실을 알게 만든다 — **`V` 는 죽은 사람이고, 피해자와 같은 방에 있던 용의자가 범인이다.**

**Architecture:** 화면에 자리를 더 내지 않는다. 세 가지 다 이미 있는 것 위에 얹는다. ① 빨간 X(브리핑 카드가 이미 쓰는 기호)를 피해자 전용으로 증언 줄 뱃지·지목 문장·보드의 정답 공개 토큰에 심는다. ② 승리 조건을 `AccusePanel` 맨 위에 상시 한 줄로 둔다 — 두 셸 공용이라 한 번이면 양쪽이 고쳐진다. ③ 모바일 첫 방문에 사건 시트를 저절로 연다(브리핑·카드·범례·규칙이 이미 그 안에 다 있다). 게임 로직은 손대지 않는다.

**Tech Stack:** React 19 · Vite · TypeScript · Vitest · 플레인 CSS. 의존성 추가 없음.

**설계문:** `docs/superpowers/specs/2026-08-04-in-play-victim-hints-design.md`

## Global Constraints

- **UI 문자열·주석·커밋 메시지는 한국어로 쓴다.**
- **소스 파일은 500줄을 넘지 않는다** (`repo.test.ts` 가 검사).
- **게임 로직(`src/game/` 의 `clues`·`solve`·`generate`·`floorplan`)은 건드리지 않는다.** 같은 시드가 같은 답을 유지해야 한다. `history.ts` 는 로직이 아니라 저장소라 예외다.
- **의존성을 추가하지 않는다.** Playwright 는 저장소 밖(`/tmp/pw`)에 설치한다.
- **두 셸(`App.tsx` · `MobileShell.tsx`)은 상태(`useGame`)와 패널 컴포넌트를 함께 쓴다.** 마크업을 복제하지 않는다.
- **`repeat()`·`calc()` 안에 값이 바뀌는 `var()` 를 넣지 않는다** (webkit#202259). `repo.test.ts` 가 `repeat(var(` 를 금지한다.
- **스타일은 `src/styles/<컴포넌트>.css`, `src/index.css` 의 `@import` 순서가 곧 캐스케이드 순서다.** 이 작업은 새 CSS 파일을 만들지 않는다.
- **전역 클래스(`.chip`·`.link`·`.clue-badge`)의 기본 스타일을 부모 선택자 밑으로 옮기지 않는다.** 문맥별 배치 조정만 허용.
- **사선 `repeating-linear-gradient` 를 새로 만들지 않는다** — 형제 세션이 `설 수 없음` 전용으로 예약 중이다. `--dead-x` 는 반복 아닌 `linear-gradient` 두 겹이라 무관하다.
- **커밋·푸시·PR 은 저장소 주인 계정으로.** 푸시·PR 은 `env -u GH_TOKEN -u GITHUB_TOKEN` 으로 주입 토큰을 벗긴다. **`create_pull_request` 툴은 이 저장소에서 쓸 수 없다.**
- **머지는 squash 가 아니라 머지 커밋.**
- **`main` 푸시는 버전을 올려야만 통과한다** — `CHANGELOG.md` 항목 + `npm version patch`.

## 파일 구조

| 파일 | 이 작업에서 맡는 것 |
|---|---|
| `src/styles/base.css` | `--dead-x` — 빨간 X 그림의 **유일한 출처** |
| `src/styles/clues.css` | `.clue-badge.dead` · `.dead-tag` |
| `src/components/ClueList.tsx` | 피해자 줄에 `dead` 뱃지 + `피해자` 꼬리표 + `aria-label` |
| `src/styles/board.css` | `.token.dead` |
| `src/components/Board.tsx` | **정답 공개 토큰만** `dead` 를 받는다 |
| `src/components/GamePanels.tsx` | `AccusePanel` 에 `victim` prop + 승리 조건 한 줄 |
| `src/styles/panels.css` | `.accuse-why` |
| `src/App.tsx` · `src/components/MobileShell.tsx` | `victim` 전달 |
| `src/game/history.ts` | `seenBrief()` · `markBriefSeen()` (키 `murdoku.brief`) |
| `src/components/MobileShell.tsx` | 첫 방문 사건 시트 자동 열기 + `.brief-again` |
| `src/styles/case.css` | `.brief-again` |
| `src/components/mobile.test.ts` | 피해자 줄 · 첫 브리핑 안내 |
| `src/components/board.test.ts` | 공개 토큰만 `dead`, 메모 화면엔 없음 |
| `src/components/render.test.ts` | 지목 패널 승리 조건 한 줄 |
| `src/game/history.test.ts` | 브리핑 키와 온보딩 키가 갈린다 |
| `src/repo.test.ts` | `--dead-x` 단일 출처 |
| `.github/copilot-instructions.md` · `CHANGELOG.md` | 규약 · 릴리스 |

---

### Task 1: 의존성 설치 + 계획문 커밋

**Files:**
- Create: `docs/superpowers/plans/2026-08-04-in-play-victim-hints.md`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (문서·환경만)

- [ ] **Step 1: 의존성 설치**

이 워크트리에는 `node_modules` 가 없다. `prepare` 스크립트가 `core.hooksPath` 를 `.githooks` 로 맞추는 부수 효과도 있으므로 먼저 돌린다.

```bash
npm install
```

- [ ] **Step 2: 기준선 확인**

손대기 전에 전부 초록인지 본다. 나중에 깨진 게 내 것인지 원래 것인지 헷갈리지 않게.

```bash
npm test 2>&1 | tail -20
```

Expected: 전부 PASS.

- [ ] **Step 3: 계획문 저장**

이 문서를 `docs/superpowers/plans/2026-08-04-in-play-victim-hints.md` 로 저장한다.

- [ ] **Step 4: 커밋**

```bash
git add docs/superpowers/plans
git commit -m "$(cat <<'EOF'
문서: 플레이 도중 피해자 안내 구현 계획

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 2: 빨간 X 단일 출처 + 증언 목록의 피해자 줄

증언 목록은 두 셸의 붙박이다 — 플레이어가 가장 오래 보는 자리인데, 지금 피해자 줄이 용의자 줄과 픽셀 단위로 같다.

**Files:**
- Modify: `src/styles/base.css:1-13` (`:root`)
- Modify: `src/styles/clues.css:91-101` (`.clue-badge`)
- Modify: `src/components/ClueList.tsx:60-78`
- Test: `src/components/mobile.test.ts:16-64` (`describe('증언 목록 = 메모 브러시')`)

**Interfaces:**
- Consumes: 없음
- Produces:
  - CSS 변수 `--dead-x` (`base.css` 의 `:root`) — Task 3 의 `.token.dead` 가 쓴다
  - CSS 클래스 `.clue-badge.dead` — Task 4 의 `.accuse-why` 가 쓴다
  - CSS 클래스 `.dead-tag`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/components/mobile.test.ts` 의 `describe('증언 목록 = 메모 브러시')` 안, `'용의자와 피해자를 한 줄씩 그린다'` **바로 아래**에 넣는다.

```ts
  // V 뱃지가 죽은 사람이라는 걸 몰라 헤맸다는 피드백에서 나왔다. 튜토리얼을 안 봤어도
  // 증언 목록은 늘 보인다 — 그림(빨간 X)·글자(꼬리표)·낭독(aria-label) 셋이 같은 말을 한다
  it('피해자 줄만 죽음 표시를 갖는다', () => {
    const out = html('X');
    expect((out.match(/class="clue-badge dead"/g) ?? []).length).toBe(1);
    expect((out.match(/class="dead-tag"/g) ?? []).length).toBe(1);
    expect(out).toContain('(피해자) 로 표시하기');
    // 용의자 줄은 그대로다
    expect((out.match(/class="clue-badge"/g) ?? []).length).toBe(puzzle.people.length - 1);
  });

  // 피해자가 어디 있었는지도 추리해서 표시해야 한다. 비활성처럼 보이면 안 된다
  it('피해자 줄도 여전히 눌리는 브러시다', () => {
    const out = html(puzzle.people.find((p) => p.isVictim)!.id);
    expect((out.match(/class="clue-row on"/g) ?? []).length).toBe(1);
    expect(out).not.toContain('disabled');
  });
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run -t "피해자 줄만 죽음 표시를 갖는다"
```

Expected: FAIL — `expected 0 to be 1` (아직 `dead` 클래스가 없다).

- [ ] **Step 3: `--dead-x` 를 `base.css` 에 넣는다**

`src/styles/base.css` 의 `:root` 안, `--dur-fast` 줄 **아래**에 넣는다.

```css
  /* 피해자 표시. 브리핑 카드의 초상 X(.card.victim)가 쓰던 기호를 증언 뱃지와
     보드의 정답 토큰까지 넓힌 것 — 값이 두 벌이면 언젠가 갈라지므로 여기 한 번만 둔다.
     굵기가 px 이 아니라 퍼센트인 이유: 24px 뱃지와 보드 토큰(20~40px)에서 같은 비율로
     보여야 한다. 두 자리 다 정사각이라 축마다 왜곡되지 않는다.
     calc() 안에 var() 가 없다 — 값이 바뀌는 자리에서 WebKit 이 캐싱한다 (webkit#202259) */
  --dead-x:
    linear-gradient(to bottom right, #0000 calc(50% - 4%), var(--accent) calc(50% - 4%) calc(50% + 4%), #0000 calc(50% + 4%)),
    linear-gradient(to bottom left, #0000 calc(50% - 4%), var(--accent) calc(50% - 4%) calc(50% + 4%), #0000 calc(50% + 4%));
```

`4%` 는 출발값이다. Task 6 에서 실물을 보고 확정한다.

- [ ] **Step 4: `clues.css` 에 `.clue-badge.dead` 와 `.dead-tag` 를 넣는다**

`src/styles/clues.css` 의 `.clue-badge { … }` 블록 **아래**, `.clue-row b` **위**에 넣는다.

```css
/* 피해자 뱃지. X 를 글자 위에 그리면 V 를 먹으므로 음수 z-index 로 깐다 —
   음수 z-index 자식은 부모의 배경 위·인라인 내용 아래에 그려진다.
   isolation 이 없으면 스태킹 컨텍스트가 없어 X 가 .clue-row 배경 뒤로 빠져 아예 안 보인다 */
.clue-badge.dead {
  position: relative;
  isolation: isolate;
}
.clue-badge.dead::before {
  content: '';
  position: absolute;
  inset: 15%;
  z-index: -1;
  background: var(--dead-x);
}
/* 그림만으로는 "죽었다" 가 안 읽힐 수 있다. 범례의 `설 수 없음` 알약과 같은 모양·같은 색 */
.dead-tag {
  flex: none;
  font-style: normal;
  font-size: 11px;
  font-weight: 700;
  border: 2px solid var(--wall);
  border-radius: 999px;
  padding: 0 6px;
  background: #f2dcd8;
  white-space: nowrap;
}
```

- [ ] **Step 5: `ClueList.tsx` 를 고친다**

`src/components/ClueList.tsx` 의 `<li>` 안을 이렇게 바꾼다.

```tsx
        <li key={p.id}>
          <button
            type="button"
            className={`clue-row${brush === p.id ? ' on' : ''}`}
            aria-pressed={brush === p.id}
            /* 피해자는 여전히 눌리는 브러시다 — 자리를 추리해서 표시해야 한다.
               비활성으로 보이게 하지 않고, 죽었다는 사실만 덧붙인다 */
            aria-label={`${p.name}${p.isVictim ? ' (피해자)' : ''} 로 표시하기`}
            onClick={() => setBrush(p.id)}
          >
            <span
              className={`clue-badge${p.isVictim ? ' dead' : ''}`}
              style={{ background: p.color }}
            >
              {p.id}
            </span>
            <b>{p.name}</b>
            {p.isVictim && <em className="dead-tag">피해자</em>}
            <span className="clue-text">{p.isVictim ? VICTIM_LINE : clueOf(p.id)}</span>
          </button>
        </li>
```

`VICTIM_LINE` 은 그대로 둔다 — 브리핑 카드에서는 말풍선이라 1인칭이 맞고, 여기서는 이제 뱃지와 꼬리표가 사실을 말한다.

- [ ] **Step 6: 테스트가 통과하는지 본다**

```bash
npx vitest run src/components/mobile.test.ts
```

Expected: PASS (기존 것 포함 전부).

- [ ] **Step 7: 커밋**

```bash
git add src/styles/base.css src/styles/clues.css src/components/ClueList.tsx src/components/mobile.test.ts
git commit -m "$(cat <<'EOF'
증언 목록에서 피해자가 죽은 사람으로 보이게 한다

V 뱃지가 죽은 사람인지 모르고 용의자인 줄 알았다는 피드백을 받았다.
증언 줄은 용의자와 픽셀 단위로 같았고 문구마저 피해자가 말하는 투였다.

브리핑 카드의 초상 X 가 쓰던 빨간 X 를 증언 뱃지로 넓히고 `피해자`
꼬리표를 붙인다. X 는 음수 z-index 로 깔아 V 글자를 가리지 않는다.
값은 base.css 의 --dead-x 한 곳에만 둔다.

피해자 줄은 여전히 눌리는 브러시다 — 자리를 추리해서 표시해야 한다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 3: 보드의 정답 공개 토큰 + 단일 출처 불변식

보드에는 이미 `✕` 가 있다 — `.mark-x`, 메모 브러시의 `✕ 빈칸`, 뜻은 "여긴 아무도 없다". 피해자 X 를 **메모 토큰**에 얹으면 같은 화면에 두 뜻의 X 가 놓인다(`Board.tsx` 의 `mark` 분기는 공개 前이고 `.mark-x` 도 공개 前이다). 그래서 **정답 공개 토큰만** 받는다.

**Files:**
- Modify: `src/components/Board.tsx:240-250`
- Modify: `src/styles/board.css:361-370` 부근 (`.token.solved` 뒤)
- Test: `src/components/board.test.ts` (`describe('Board 렌더링')` 안)
- Test: `src/repo.test.ts` (`describe('저장소 규약')` 안)

**Interfaces:**
- Consumes: `--dead-x` (Task 2)
- Produces: CSS 클래스 `.token.dead`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/components/board.test.ts` 의 `describe('Board 렌더링')` 안, `'칸 수와 방 이름을 모두 그린다'` **아래**에 넣는다. 파일 맨 위의 `render` 헬퍼(`render(revealed, marks)`)를 그대로 쓴다.

```ts
  /* 보드에는 이미 ✕ 가 있다 — .mark-x, 메모 브러시의 `✕ 빈칸`, 뜻은 "여긴 아무도 없다".
     피해자 X 는 정반대에 가까운 뜻이라 한 화면에 같이 두면 안 된다.
     Board 가 revealed 로 둘을 시간으로 가른다: 메모는 공개 前, 정답 토큰은 공개 後.
     그래서 빨간 X 는 공개 화면에만 산다 */
  it('정답을 공개하면 피해자 토큰만 죽음 표시를 갖는다', () => {
    const { p, html } = render(true);
    expect((html.match(/class="token solved dead"/g) ?? []).length).toBe(1);
    // 범인은 용의자다 — 피해자와 겹치지 않는다
    expect(p.people.find((x) => x.id === p.culpritId)!.isVictim).toBe(false);
    expect((html.match(/class="token solved/g) ?? []).length).toBe(p.people.length);
  });

  it('메모 화면에는 죽음 표시가 없다 (빈칸 ✕ 와 한 화면에 놓이지 않는다)', () => {
    const p = generatePuzzle(5, 'render-check');
    const v = p.solution.V;
    const a = p.solution.A;
    const { html } = {
      html: renderToStaticMarkup(
        createElement(Board, {
          puzzle: p,
          marks: { [`${v.r},${v.c}`]: 'V', [`${a.r},${a.c}`]: 'X' },
          onCell: () => {},
          revealed: false,
        }),
      ),
    };
    expect(html).toContain('class="mark-x"');
    expect(html).toContain('>V</span>');
    expect(html).not.toContain('dead');
  });
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run -t "정답을 공개하면 피해자 토큰만"
```

Expected: FAIL — `expected 0 to be 1`.

두 번째 테스트(`메모 화면에는 죽음 표시가 없다`)는 지금도 PASS 다. 회귀 방지용이라 정상이다.

- [ ] **Step 3: `Board.tsx` 를 고친다**

`src/components/Board.tsx` 의 정답 토큰 `className` 만 바꾼다. **메모 토큰(`) : mark ? (` 가지)은 건드리지 않는다.**

```tsx
            <span
              className={`token solved${person.isVictim ? ' dead' : ''}${
                person.id === puzzle.culpritId ? ' culprit' : ''
              }`}
```

그리고 그 `{person ? (` 줄 **위**에 이유를 남긴다.

```tsx
          {/* 빨간 X 는 공개 화면에만 얹는다. 메모 화면에는 .mark-x(`✕ 빈칸` = "아무도 없다")가
              있어서, 거기 피해자 X 를 더하면 같은 글리프가 정반대 뜻을 같이 갖는다.
              공개하면 marks 가 통째로 가려지므로(위의 mark 계산) 두 뜻이 만날 일이 없다.
              공개 화면이 더 말하는 것은 이미 이 보드의 방식이다 — .token.solved.culprit 참고 */}
```

- [ ] **Step 4: `board.css` 에 `.token.dead` 를 넣는다**

`src/styles/board.css` 의 `@keyframes token-in { … }` 블록 **아래**, `.token.solved.culprit` 주석 **위**에 넣는다.

```css
/* 피해자 토큰. 뱃지와 같은 그림을 쓴다 (base.css 의 --dead-x 가 유일한 출처).
   .token 은 이미 position: relative + z-index: 2 라 스태킹 컨텍스트가 있다 —
   음수 z-index 가 토큰 배경 위·글자 아래에 그려진다 */
.token.dead::before {
  content: '';
  position: absolute;
  inset: 12%;
  z-index: -1;
  background: var(--dead-x);
}
```

- [ ] **Step 5: 단일 출처 불변식을 `repo.test.ts` 에 넣는다**

이제 소비자가 둘 다 있다. `src/repo.test.ts` 의 `describe('저장소 규약')` 안, `'스타일 어디에도 repeat() 안의 var() 가 없다 (Safari)'` **아래**에 넣는다.

```ts
  // 빨간 X 는 `피해자` 하나만 뜻한다. 값이 두 벌이면 언젠가 갈라져서
  // 같은 뜻인데 다르게 생긴 표시가 두 개 생긴다
  it('피해자 X 는 base.css 한 곳에서만 정의된다', () => {
    const defs = Object.entries(sources)
      .filter(([, text]) => text.includes('--dead-x:'))
      .map(([path]) => path);
    expect(defs).toEqual(['/src/styles/base.css']);

    for (const path of ['/src/styles/clues.css', '/src/styles/board.css'])
      expect(sources[path]).toContain('var(--dead-x)');
  });
```

- [ ] **Step 6: 테스트가 통과하는지 본다**

```bash
npx vitest run src/components/board.test.ts src/repo.test.ts
```

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/components/Board.tsx src/styles/board.css src/components/board.test.ts src/repo.test.ts
git commit -m "$(cat <<'EOF'
정답을 공개하면 보드가 시신이 어디 있었는지 말한다

증언 뱃지에서 배운 빨간 X 가 보드로 이어지게 한다. 단 공개 화면에만
얹는다 — 메모 화면에는 .mark-x(`✕ 빈칸` = "아무도 없다")가 있어서,
거기 피해자 X 를 더하면 같은 글리프가 정반대 뜻을 같이 갖는다.

Board 가 revealed 로 둘을 시간으로 가르므로 두 뜻이 한 화면에 놓일
일이 없다. 테스트가 그 배타성을 직접 검사한다.

--dead-x 가 base.css 한 곳에만 있는지도 repo 규약으로 못박는다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 4: 지목 패널의 승리 조건 한 줄

규칙이 필요한 순간은 지목할 때다. `AccusePanel` 은 두 셸 공용이라 여기 한 번 넣으면 데스크톱 사이드 열과 모바일 지목 시트가 같이 고쳐진다. 이 한 줄이 **V 가 용의자 목록에 없는 이유**까지 같이 답한다.

**Files:**
- Modify: `src/components/GamePanels.tsx:135-180` (`AccuseProps` · `AccusePanel`)
- Modify: `src/App.tsx:140-153`
- Modify: `src/components/MobileShell.tsx:113-128`
- Modify: `src/styles/panels.css` (`.verdict` 앞)
- Test: `src/components/render.test.ts:121-159` (`describe('정답을 본 사건')`)

**Interfaces:**
- Consumes: `.clue-badge.dead` (Task 2)
- Produces: `AccuseProps` 에 `victim: Person` 필드 (필수). `App.tsx`·`MobileShell.tsx`·`render.test.ts` 가 전부 넘겨야 컴파일된다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/components/render.test.ts` 의 `describe('정답을 본 사건')` 안. 먼저 `props` 상수에 `victim` 을 더한다 — 안 그러면 타입이 안 맞는다.

```ts
describe('정답을 본 사건', () => {
  const puzzle = generatePuzzle(4, 'peek-check');
  const suspects = puzzle.people.filter((p) => !p.isVictim);
  const victim = puzzle.people.find((p) => p.isVictim)!;
  const props = {
    suspects,
    victim,
    accused: suspects[0].id,
    setAccused: () => {},
    accuse: () => {},
    result: null,
    attempt: 0,
    culpritName: '아무개',
    earned: 0,
    revealed: false,
    setRevealed: () => {},
    detective: '',
  } as const;
```

그리고 `describe` 안 맨 아래에 검사를 더한다.

```ts
  // 무엇을 맞히는 게임인지 모르고 헤맸다는 피드백에서 나왔다. 규칙 전문은 모달 안에만
  // 있어서, 모달을 안 연 사람에게는 없는 것과 같다. 지목하는 자리에 늘 둔다
  it('지목하는 자리에서 승리 조건을 말한다', () => {
    for (const bare of [false, true]) {
      const html = render({ bare });
      expect(html).toContain(victim.name);
      expect(html).toContain('그와 같은 방에 있던 용의자가 범인이야');
      // 문장 속 기호가 화면의 기호와 같아야 이어진다
      expect(html).toContain('class="clue-badge dead"');
    }
  });

  // V 가 왜 목록에 없는지도 이 한 줄이 답한다 — 지목 후보는 용의자뿐이다
  it('피해자는 지목 후보에 없다', () => {
    const html = render({});
    expect((html.match(/aria-pressed/g) ?? []).length).toBe(suspects.length);
  });
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run -t "지목하는 자리에서 승리 조건을 말한다"
```

Expected: FAIL — `victim` prop 이 없어 타입 에러이거나, 문구를 못 찾는다.

- [ ] **Step 3: `AccusePanel` 을 고친다**

`src/components/GamePanels.tsx` 의 `AccuseProps` 에 필드를 더한다 — `suspects` **바로 아래**.

```ts
export type AccuseProps = {
  suspects: Person[];
  /** 피해자. 지목 후보가 아니라 규칙을 말하기 위해 받는다 */
  victim: Person;
  accused: string;
```

`AccusePanel` 의 인자 목록 `suspects,` 아래에 `victim,` 을 더하고, `{!bare && <b>범인은?</b>}` **아래**에 한 줄을 넣는다.

```tsx
      {/* 규칙 전문은 브리핑 모달 안에만 있어서, 모달을 안 연 사람에게는 없는 것과 같다.
          지목하는 순간이 규칙이 필요한 순간이라 여기 상시로 둔다.
          조사(와/과)를 피하려고 이름 뒤에서 문장을 끊는다 — 받침에 상관없이 늘 맞는다.
          앞의 뱃지는 증언 목록의 그것과 같은 모양이다: 문장 속 기호가 화면의 기호와 같아야 이어진다 */}
      <p className="accuse-why">
        <span className="clue-badge dead" style={{ background: victim.color }} aria-hidden="true">
          V
        </span>
        피해자는 <b>{victim.name}</b>. 그와 같은 방에 있던 용의자가 범인이야.
      </p>
```

- [ ] **Step 4: `panels.css` 에 `.accuse-why` 를 넣는다**

`src/styles/panels.css` 의 `.verdict { … }` **위**에 넣는다.

```css
/* 지목하는 자리의 승리 조건 한 줄. 두 셸이 함께 쓴다 */
.accuse-why {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--muted);
  word-break: keep-all;
}
.accuse-why b {
  color: var(--ink);
}
/* 전역 .clue-badge 의 기본 스타일은 clues.css 가 그대로 갖는다.
   여기서는 문단 안에 앉히는 배치만 맞춘다 */
.accuse-why .clue-badge {
  display: inline-grid;
  vertical-align: -7px;
  margin-right: 5px;
}
```

- [ ] **Step 5: 두 셸에서 `victim` 을 넘긴다**

`src/App.tsx` 의 `<AccusePanel` 에서 `suspects={game.suspects}` **아래**:

```tsx
            victim={game.victim}
```

`src/components/MobileShell.tsx` 의 `<AccusePanel` 에서도 같은 자리에 같은 줄을 넣는다.

- [ ] **Step 6: 테스트와 타입을 확인한다**

```bash
npx vitest run src/components/render.test.ts src/components/mobile.test.ts && npx tsc -b --noEmit
```

Expected: PASS · 타입 에러 없음.

- [ ] **Step 7: 커밋**

```bash
git add src/components/GamePanels.tsx src/styles/panels.css src/App.tsx src/components/MobileShell.tsx src/components/render.test.ts
git commit -m "$(cat <<'EOF'
지목하는 자리에서 무엇을 맞히는 게임인지 말한다

승리 조건이 규칙 패널 8번과 온보딩 3단계에만 있었다. 둘 다 모달 안이라
모달을 안 연 사람에게는 없는 것과 같았다.

지목 패널 맨 위에 피해자 이름을 넣은 한 줄을 상시로 둔다. AccusePanel 이
두 셸 공용이라 데스크톱 사이드 열과 모바일 지목 시트가 같이 고쳐진다.
이 한 줄이 V 가 용의자 목록에 없는 이유까지 답한다.

조사(와/과)를 피하려고 이름 뒤에서 문장을 끊는다 — 받침에 상관없이 맞는다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 5: 모바일 첫 방문에 사건 브리핑 열기

`Tour` 는 데스크톱 셸 전용이다(겨누는 `.dclues`·`.legend` 가 모바일 메인 화면에 없다). 다시 여는 `?` 도 데스크톱만 받는다. **모바일 사용자는 온보딩을 건너뛴 게 아니라 본 적이 없다.**

사건 시트 안에는 브리핑·인물 카드·범례·규칙 전문이 이미 다 있다. 새 문구를 만들지 않고 그걸 첫 방문에 연다.

**Files:**
- Modify: `src/game/history.ts:217-226`
- Modify: `src/components/MobileShell.tsx:1-35, 103-111`
- Modify: `src/styles/case.css:4-8` (`.brief` 뒤)
- Test: `src/game/history.test.ts` (새 `describe`)
- Test: `src/components/mobile.test.ts` (`describe('모바일 셸 렌더링')` 안)

**Interfaces:**
- Consumes: 없음
- Produces: `seenBrief(): boolean` · `markBriefSeen(): void` (`src/game/history.ts`)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/game/history.test.ts` 의 import 에 넷을 더한다.

```ts
import { describe, expect, it, vi } from 'vitest';
```

그리고 `history.ts` import 목록에 `markBriefSeen, markTourSeen, seenBrief, seenTour` 를 더한다.

파일 맨 아래에 `describe` 를 새로 넣는다.

```ts
/* 모바일 첫 브리핑과 데스크톱 온보딩은 다른 물건이다 — 앞은 사건과 규칙을,
   뒤는 화면 구조를 가르친다. 키를 합치면 모바일로 먼저 본 사람이 데스크톱에서
   스포트라이트 온보딩을 영영 못 보는데, 화면으로는 안 보이는 고장이다.
   테스트 환경에 jsdom 이 없지만 readLS/writeLS 가 try/catch 라 가짜를 끼우면 그대로 돈다 */
describe('첫 방문 안내', () => {
  it('모바일 브리핑과 데스크톱 온보딩을 따로 기억한다', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    try {
      expect(seenBrief()).toBe(false);
      expect(seenTour()).toBe(false);

      markBriefSeen();
      expect(seenBrief()).toBe(true);
      expect(seenTour()).toBe(false);

      markTourSeen();
      expect(seenTour()).toBe(true);
      expect(store.size).toBe(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run -t "모바일 브리핑과 데스크톱 온보딩을 따로 기억한다"
```

Expected: FAIL — `seenBrief` 를 못 찾는다.

- [ ] **Step 3: `history.ts` 에 브리핑 표시를 넣는다**

`src/game/history.ts` 의 `markTourSeen` **아래**에 넣는다.

```ts
/* 모바일에는 스포트라이트 온보딩이 없다(겨눌 자리가 메인 화면에 없다). 대신 첫 방문에
   사건 브리핑 시트를 연다 — 그 안에 인물·범례·규칙이 이미 다 있다.
   키를 TOUR_KEY 와 나눈 이유: 합치면 모바일로 먼저 본 사람이 데스크톱에서 온보딩을
   영영 못 본다. 반대로 창을 좁혀 브리핑이 한 번 열리는 건 그 화면을 처음 보는 것이라 맞다 */
const BRIEF_KEY = 'murdoku.brief';

/** 모바일 사건 브리핑을 한 번이라도 봤나 */
export function seenBrief(): boolean {
  return readLS(BRIEF_KEY) !== null;
}

export function markBriefSeen() {
  writeLS(BRIEF_KEY, '1');
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
npx vitest run src/game/history.test.ts
```

Expected: PASS.

- [ ] **Step 5: 시트 안내 문구 테스트를 쓴다**

`src/components/mobile.test.ts` 의 `describe('모바일 셸 렌더링')` 안, `'범례가 브리핑 시트 안에 있다'` **아래**에 넣는다.

```ts
  // 데스크톱 Tour 가 모바일에 없으니 첫 방문에는 이 시트가 저절로 열린다(마운트 effect라
  // 서버 렌더에는 안 나온다). 저절로 열린 시트는 어디서 왔는지를 안 알려주므로,
  // 닫은 뒤 규칙에 다시 닿는 길을 그때만 말해준다
  it('브리핑 시트가 규칙까지 품고, 안내 줄은 첫 방문에만 나온다', () => {
    const brief = html.slice(html.indexOf(`aria-label="${shellPuzzle.title}"`));
    expect(brief.indexOf('class="panel rules"')).toBeGreaterThan(-1);
    expect(brief.indexOf('class="cards"')).toBeGreaterThan(-1);
    // 서버 렌더 = 첫 방문 effect 가 안 돈 상태 = 안내 줄 없음
    expect(html).not.toContain('brief-again');
  });
```

- [ ] **Step 6: 실패를 확인한다**

```bash
npx vitest run -t "브리핑 시트가 규칙까지 품고"
```

Expected: PASS 여야 정상이다 — 시트 내용은 이미 다 있고 `brief-again` 은 아직 없다. 회귀 방지용 검사다. Step 7 을 마친 뒤에도 계속 PASS 여야 한다.

- [ ] **Step 7: `MobileShell.tsx` 에서 첫 방문에 연다**

import 에 둘을 더한다.

```tsx
import { useEffect, useState } from 'react';
```

```tsx
import { markBriefSeen, seenBrief } from '../game/history';
```

`const [sheet, setSheet] = useState<SheetId | null>(null);` 아래에 상태와 effect 를 더하고, `close` 를 고친다.

```tsx
  const [sheet, setSheet] = useState<SheetId | null>(null);
  /** 첫 방문으로 저절로 열렸나. 그때만 다시 여는 길을 알려준다 */
  const [firstBrief, setFirstBrief] = useState(false);
  const close = () => {
    setSheet(null);
    setFirstBrief(false);
  };

  // 데스크톱 Tour 는 모바일에 없다 — 겨누는 자리(.dclues·.legend)가 메인 화면에 없어서다.
  // 대신 첫 방문에 사건 브리핑을 연다. 인물·범례·규칙이 이미 그 안에 다 있다.
  // useState 초기값으로 읽으면 서버 렌더에서도 열린 채 나가므로 마운트 뒤에 켠다
  // (App.tsx 의 온보딩과 같은 이유)
  useEffect(() => {
    if (seenBrief()) return;
    setSheet('case');
    setFirstBrief(true);
    markBriefSeen();
  }, []);
```

사건 시트 안, `<p className="brief">` **위**에 안내 줄을 넣는다.

```tsx
      <Sheet open={sheet === 'case'} onClose={close} title={puzzle.title}>
        {/* 저절로 열린 시트는 어디서 왔는지를 안 알려준다. 닫고 나면 규칙에 다시
            닿는 길을 모르므로 첫 방문에만 말해준다. 맨 아래에 두면 끝까지 내리지
            않는 사람은 못 본다 */}
        {firstBrief && (
          <p className="brief-again">
            위쪽 <b>사건 제목</b>을 누르면 이 브리핑을 언제든 다시 볼 수 있어.
          </p>
        )}
        <p className="brief">{puzzle.brief}</p>
```

- [ ] **Step 8: `case.css` 에 `.brief-again` 을 넣는다**

`src/styles/case.css` 의 `.brief { … }` 블록 **아래**에 넣는다.

```css
/* 첫 방문에 저절로 열린 브리핑에만 붙는 안내. 다시 여는 길을 알려준다 */
.brief-again {
  margin: 4px 0 0;
  border: 2px solid var(--wall);
  border-radius: 10px;
  background: #fffdf7;
  padding: 8px 10px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted);
  word-break: keep-all;
}
.brief-again b {
  color: var(--ink);
}
```

- [ ] **Step 9: 전체를 돌린다**

```bash
npm test 2>&1 | tail -20
```

Expected: 전부 PASS.

- [ ] **Step 10: 커밋**

```bash
git add src/game/history.ts src/game/history.test.ts src/components/MobileShell.tsx src/styles/case.css src/components/mobile.test.ts
git commit -m "$(cat <<'EOF'
모바일도 첫 방문에 사건 브리핑을 받는다

스포트라이트 온보딩은 데스크톱 셸 전용이다 — 겨누는 자리가 모바일
메인 화면에 없다. 다시 여는 ? 버튼도 데스크톱만 받는다. 그래서 모바일
사용자는 온보딩을 건너뛴 게 아니라 본 적이 없었다.

첫 방문에 사건 시트를 연다. 인물 카드·범례·규칙 전문이 이미 그 안에
있어서 새 문구를 만들지 않는다. 저절로 열린 시트는 어디서 왔는지를
안 알려주므로, 그때만 다시 여는 길을 한 줄로 말해준다.

표시는 murdoku.brief 로 murdoku.tour 와 나눈다. 합치면 모바일로 먼저
본 사람이 데스크톱에서 온보딩을 영영 못 보는데, 화면으로는 안 보이는
고장이다. 테스트가 두 키가 갈리는지 검사한다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 6: 브라우저 실측 — X 굵기 확정과 두 셸 확인

`--dead-x` 의 `4%` 는 출발값이다. **24px 뱃지에서 `V` 가 읽히면서 X 의 네 끝이 글자 밖으로 삐져나오는가**가 판정 기준이다. Chromium 에서 멀쩡한 레이아웃 버그는 대부분 Safari 전용이므로 WebKit 으로도 본다.

**Files:**
- Modify: `src/styles/base.css` (`--dead-x` 퍼센트 값만, 필요하면)

**Interfaces:**
- Consumes: Task 2~5 의 모든 변경
- Produces: 없음 (값 확정)

- [ ] **Step 1: Playwright 를 저장소 밖에 설치한다**

저장소에 의존성을 넣지 않는다.

```bash
mkdir -p /tmp/pw && cd /tmp/pw && npm init -y >/dev/null && npm i playwright >/dev/null && npx playwright install webkit chromium
```

- [ ] **Step 2: 개발 서버를 띄운다**

```bash
npm run dev
```

async·detach 로 띄우고 포트를 확인한다 (보통 `http://localhost:5173`).

- [ ] **Step 3: 두 셸을 찍어 본다**

`/tmp/pw/shot.mjs` 를 만들어 돌린다. `hasTouch: true` 를 줘야 `pointer: coarse` 미디어 쿼리가 맞는다.

```js
import { webkit, chromium } from 'playwright';

const URL = 'http://localhost:5173';
for (const [name, engine] of [['webkit', webkit], ['chromium', chromium]]) {
  const browser = await engine.launch();
  for (const [label, opts] of [
    ['desktop', { viewport: { width: 1280, height: 800 } }],
    ['mobile', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }],
  ]) {
    const page = await browser.newPage(opts);
    await page.goto(URL);
    await page.waitForSelector('.clue-badge.dead');
    await page.screenshot({ path: `/tmp/pw/${name}-${label}.png`, fullPage: false });
    // 잘림은 눈이 아니라 숫자로 본다 (overflow: hidden 이 감춘다)
    const over = await page.evaluate(() => ({
      page: document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight,
      board: (() => {
        const b = document.querySelector('.board');
        return b ? b.scrollWidth - b.clientWidth : 0;
      })(),
    }));
    console.log(name, label, over);
    await page.close();
  }
  await browser.close();
}
```

```bash
cd /tmp/pw && node shot.mjs
```

Expected: 네 조합 모두 `{ page: 0, board: 0 }` 근처. 모바일에서 `page > 0` 이면 안내 줄이 화면을 밀어낸 것이다 — 시트 안이라 그럴 리 없지만 확인한다.

- [ ] **Step 4: 스크린샷을 눈으로 본다**

`/tmp/pw/webkit-mobile.png` · `/tmp/pw/webkit-desktop.png` 를 `view` 로 연다. 볼 것:

1. 증언 목록 피해자 줄 — `V` 가 읽히나. X 의 네 끝이 글자 밖으로 나오나. `피해자` 알약이 줄을 밀어내지 않나.
2. 지목 패널 한 줄 — 인라인 뱃지가 글줄에 앉았나(`vertical-align: -7px`), 문장이 두 줄로 접혀도 어색하지 않나.
3. 모바일 첫 브리핑 — 시트가 열려 있고 안내 줄이 맨 위에 있나.

- [ ] **Step 5: 필요하면 `--dead-x` 굵기를 조정한다**

너무 굵어 `V` 를 먹으면 `4%` → `3%`, 너무 가늘어 24px 에서 사라지면 `4%` → `5%`. 네 자리 전부 같이 바뀌어야 한다 (두 `linear-gradient` × 각 두 곳).

조정했으면 Step 3~4 를 다시 돌려 확인한다.

- [ ] **Step 6: 정답 공개 화면도 본다**

`정답 보기` 를 눌러 피해자 토큰에 X 가 뜨는지, 범인 방 테두리와 겹쳐 시끄럽지 않은지 본다.

```js
await page.click('text=정답 보기');
await page.waitForTimeout(1200);
await page.screenshot({ path: '/tmp/pw/webkit-revealed.png' });
```

- [ ] **Step 7: 서버를 내리고 커밋**

값을 바꿨을 때만 커밋한다. 안 바꿨으면 이 스텝을 건너뛴다.

```bash
git add src/styles/base.css
git commit -m "$(cat <<'EOF'
피해자 X 굵기를 실물에서 확정한다

24px 뱃지와 보드 토큰을 나란히 놓고 봤다. V 가 읽히면서 X 의 네 끝이
글자 밖으로 나오는 값이다. WebKit·Chromium 둘 다 확인했다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 7: 문서 · 릴리스

**Files:**
- Modify: `.github/copilot-instructions.md` (렌더링 절 · 구조 표)
- Modify: `CHANGELOG.md` (맨 위)
- Modify: `package.json` (`npm version patch` 가 고친다)

**Interfaces:**
- Consumes: Task 2~6
- Produces: 없음

- [ ] **Step 1: main 을 다시 확인하고 필요하면 리베이스한다**

형제 세션(`copilot/cautious-tribble`)이 먼저 머지됐을 수 있다. 그러면 `base.css` `:root`(`--nostand` vs `--dead-x`)·`CHANGELOG.md`·`package.json` 이 충돌한다 — 둘 다 남기는 방향으로 푼다.

```bash
git fetch origin && git --no-pager log origin/main --oneline -3
git rebase origin/main
```

리베이스했으면 `npm test` 를 다시 돌린다.

- [ ] **Step 2: `.github/copilot-instructions.md` 의 렌더링 절에 규약을 적는다**

`### 렌더링` 절의 마지막 항목 아래에 넣는다.

```markdown
- **빨간 X 는 `피해자` 하나만 뜻한다.** 그림은 `base.css` 의 `--dead-x` 가 유일한 출처고 증언 뱃지(`.clue-badge.dead`)·지목 문장·보드의 정답 토큰(`.token.dead`)이 참조한다(`repo.test.ts` 가 값 복제를 막는다). 굵기가 px 이 아니라 퍼센트인 건 24px 뱃지와 보드 토큰에서 같은 비율로 보이게 하려는 것이다. X 는 **음수 z-index** 로 깐다 — 글자(`V`) 위에 그리면 글자를 먹는다. `.clue-badge` 는 스태킹 컨텍스트가 없으므로 `isolation: isolate` 가 같이 필요하다.
  - **보드에서는 정답 공개 화면에만 얹는다.** 메모 화면에는 `.mark-x`(`✕ 빈칸` = "아무도 없다")가 있어서 같은 글리프가 정반대 뜻을 같이 갖게 된다. `Board.tsx` 가 `revealed` 로 메모와 정답 토큰을 배타적으로 나누므로 둘이 만날 일이 없다 — `board.test.ts` 가 그 배타성을 검사한다.
```

`### 셸이 둘이다` 절의 모바일 문단 끝에 한 줄을 더한다.

```markdown
모바일에는 스포트라이트 온보딩이 없다(겨누는 `.dclues`·`.legend` 가 메인 화면에 없다). 대신 **첫 방문에 사건 시트가 저절로 열린다** — 인물·범례·규칙이 이미 그 안에 있다. 표시는 `murdoku.brief` 로 데스크톱 온보딩의 `murdoku.tour` 와 **나눠 둔다**. 합치면 모바일로 먼저 본 사람이 데스크톱 온보딩을 영영 못 보는데 화면으로는 안 보인다 — `history.test.ts` 가 검사한다.
```

- [ ] **Step 3: `CHANGELOG.md` 에 항목을 쓴다**

맨 위 `# 버전 기록` 아래에 넣는다. 버전은 현재 `package.json` 버전의 patch + 1 이다(리베이스 후 다시 확인할 것). 렌더러는 `##`/`###`/`-`/`**굵게**`/`` `코드` ``/`[링크](url)` 만 안다 — 표·중첩 목록은 조용히 문단으로 떨어진다.

```markdown
## v0.13.1 — 2026-08-05

### 나아짐

- **`V` 가 죽은 사람이라고 말한다.** 증언 목록의 피해자 줄에 빨간 X 와 `피해자` 꼬리표가 붙는다. 예전에는 용의자 줄과 똑같이 생겨서 살아 있는 용의자인 줄 알기 쉬웠다.
- **무엇을 맞히는 게임인지 지목하는 자리에서 말한다.** 지목 패널 맨 위에 `피해자는 ○○○. 그와 같은 방에 있던 용의자가 범인이야` 가 늘 있다. 규칙 전문은 브리핑 모달 안에만 있어서 모달을 안 연 사람에게는 없는 것과 같았다.
- **정답을 공개하면 보드가 시신이 어디 있었는지 보여준다.** 피해자 토큰에 같은 빨간 X 가 뜬다.
- **모바일도 첫 방문에 사건 브리핑을 받는다.** 스포트라이트 안내가 데스크톱 전용이라 모바일 사용자는 그걸 본 적이 없었다. 이제 첫 판에 사건 시트가 저절로 열리고, 다시 보는 길(위쪽 사건 제목)도 그때 알려준다.
```

- [ ] **Step 4: 문서를 커밋한다**

```bash
git add .github/copilot-instructions.md CHANGELOG.md
git commit -m "$(cat <<'EOF'
문서: 빨간 X 규약과 모바일 첫 브리핑

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

- [ ] **Step 5: 버전을 올린다**

`npm version` 이 커밋과 태그를 스스로 만든다. `CHANGELOG.md` 에 쓴 버전과 같아야 한다.

```bash
npm version patch
```

- [ ] **Step 6: 전부 돌린다**

```bash
npm test 2>&1 | tail -20 && npm run lint && npm run build 2>&1 | tail -10
```

Expected: 세 개 다 통과. `render.test.ts` 의 `CHANGELOG 에 현재 버전 항목이 있다` 가 Step 3·5 의 짝을 검사한다.

---

### Task 8: 푸시 · PR

**Files:** 없음

**Interfaces:**
- Consumes: Task 1~7
- Produces: PR

- [ ] **Step 1: 커밋 신원을 확인한다**

주입된 자격증명이 저장소 주인이 아닐 수 있다. 먼저 본다.

```bash
git --no-pager log origin/main..HEAD --format='%h %an <%ae>'
```

Expected: 전부 저장소 주인 계정. 아니면 되돌린다.

```bash
git rebase --exec 'git commit --amend --no-edit --reset-author' origin/main
# 태그가 걸려 있으면 git tag -d 후 git tag -a 로 다시 건다
```

- [ ] **Step 2: 활성 계정을 확인한다**

```bash
env -u GH_TOKEN -u GITHUB_TOKEN gh auth status
```

Expected: 저장소 주인이 활성. 주인 계정을 아예 모른다고 하면 사람이 `gh auth login` 을 해야 하는 시점이다 — **포크를 떠서 우회하지 말 것.**

- [ ] **Step 3: 푸시한다**

주입된 credential 헬퍼를 그 명령에서만 비운다.

```bash
env -u GH_TOKEN -u GITHUB_TOKEN \
git -c credential.https://github.com.helper= \
    -c credential.https://github.com.helper='!gh auth git-credential' \
    -c credential.interactive=auto \
    push -u origin copilot/in-play-victim-hints --follow-tags
```

- [ ] **Step 4: PR 을 연다**

**`create_pull_request` 툴은 이 저장소에서 쓸 수 없다** — 주입된 토큰이 고정이라 우회가 없다.

```bash
env -u GH_TOKEN -u GITHUB_TOKEN gh pr create \
  --title "플레이 도중에 피해자가 누구인지 말한다" \
  --body "$(cat <<'EOF'
튜토리얼을 대충 읽은 사람이 `V` 가 죽은 사람인지, 무엇을 맞히는 게임인지를 규칙을 다시 열어보고서야 알았다는 피드백에서 나왔다.

둘 다 앱에 이미 적혀 있었다. **정보가 없는 게 아니라 필요한 순간에 그 자리에 없었다** — 사건 브리핑 모달과 온보딩 안에만 있고, 정작 오래 보는 증언 목록·보드·지목 패널에는 없었다.

## 바뀐 것

- **증언 목록의 피해자 줄**에 빨간 X 와 `피해자` 꼬리표. 예전에는 용의자 줄과 픽셀 단위로 같았다. 여전히 눌리는 브러시다 — 피해자 자리도 추리해야 한다.
- **지목 패널 맨 위에 승리 조건 한 줄.** `AccusePanel` 이 두 셸 공용이라 데스크톱 사이드 열과 모바일 지목 시트가 같이 고쳐진다. V 가 왜 용의자 목록에 없는지도 이 줄이 답한다.
- **정답 공개 토큰**에 같은 빨간 X. 메모 화면에는 안 얹는다 — 거기엔 `.mark-x`(`✕ 빈칸` = "아무도 없다")가 있어서 같은 글리프가 정반대 뜻을 갖게 된다. `Board` 가 `revealed` 로 둘을 시간으로 가르므로 두 뜻이 한 화면에 놓일 일이 없고, 테스트가 그 배타성을 검사한다.
- **모바일 첫 방문에 사건 브리핑 자동 열기.** 스포트라이트 온보딩이 데스크톱 전용이라 모바일 사용자는 본 적이 없었다. 표시(`murdoku.brief`)는 온보딩(`murdoku.tour`)과 나눠 뒀다.

## 하지 않은 것

게임 로직은 손대지 않았다. 같은 시드는 같은 답이다. 화면에 자리를 더 내지도 않았다 — 전부 이미 있는 것 위에 얹었다.

설계문: `docs/superpowers/specs/2026-08-04-in-play-victim-hints-design.md`
EOF
)"
```

- [ ] **Step 5: CI 를 확인한다**

```bash
env -u GH_TOKEN -u GITHUB_TOKEN gh pr checks --watch
```

Expected: 전부 초록.

---

## Self-Review

**Spec coverage**

| 설계문 절 | 태스크 |
|---|---|
| 1. 빨간 X = 피해자 (단일 출처·음수 z-index) | Task 2 Step 3~4, Task 3 Step 4~5 |
| 1. 심는 곳 셋 | Task 2(증언) · Task 4(지목) · Task 3(보드 공개 토큰) |
| 1. `✕` 충돌 — 공개 후에만 | Task 3 Step 1·3 |
| 2. 증언 목록의 V 행 | Task 2 Step 5 |
| 3. 지목 패널의 한 줄 | Task 4 |
| 4. 모바일 첫 실행 (키 분리·안내 줄) | Task 5 |
| 테스트 6종 | Task 2 S1 · Task 3 S1·S5 · Task 4 S1 · Task 5 S1·S5 |
| 문서 · 릴리스 | Task 7 |
| 형제 세션 조율 | Task 7 Step 1 |
| 브라우저 실측 (`4%` 확정) | Task 6 |

빠진 것 없음.

**Placeholder scan**

`TBD`·`TODO`·"적절히"·"비슷하게" 없음. 모든 코드 스텝에 실제 코드가 있다. Task 6 Step 5 는 조건부 조정이지만 판정 기준과 조정 방향(`3%`/`5%`)이 명시돼 있다.

**Type consistency**

- `--dead-x` — Task 2 정의, Task 3 참조. 이름 일치.
- `.clue-badge.dead` — Task 2 정의, Task 4 참조. 일치.
- `.token.dead` — Task 3 에서만.
- `.dead-tag` — Task 2 에서만.
- `AccuseProps.victim: Person` — Task 4 에서 정의하고 같은 태스크의 `App.tsx`·`MobileShell.tsx`·`render.test.ts` 세 소비자를 전부 고친다. 필수 필드라 하나라도 빠지면 Step 6 의 `tsc -b` 가 잡는다.
- `seenBrief()` / `markBriefSeen()` — Task 5 정의, 같은 태스크에서 소비.
- `firstBrief` — Task 5 안에서만.
