# 규칙이 스스로 설명하게 하기 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사선 빗금을 `설 수 없음` 한 가지 뜻으로 예약하고, `옆 = 상하좌우` 를 그림으로 보여줘서, 플레이어가 신고한 두 가지 혼동을 없앤다.

**Architecture:** CSS 와 문구·마크업만 바꾼다. 게임 로직(`clues.ts`·`solve.ts`·`generate.ts`)은 건드리지 않는다 — 규칙은 원래 상하좌우였고 말과 그림이 그걸 못 따라가고 있었다. 빗금 값은 `base.css` 의 `--nostand` 한 곳에서만 정하고 보드와 범례가 함께 참조한다. 규약은 `repo.test.ts` 가 CSS 원문을 읽어 강제한다.

**Tech Stack:** React 19 · Vite · TypeScript · 플레인 CSS · Vitest(`renderToStaticMarkup`, jsdom 없음)

**설계 스펙:** `docs/superpowers/specs/2026-08-04-rules-clarity-design.md`

## Global Constraints

- **UI 문자열과 주석은 한국어로 쓴다.**
- **의존성을 추가하지 않는다.** 스타일은 플레인 CSS, 테스트는 이미 있는 Vitest.
- **파일은 500줄을 넘지 않는다** (`repo.test.ts` 가 검사). 시작 시점 `GamePanels.tsx` 255줄 · `panels.css` 는 여유 있음.
- **`repeat()`·`calc()` 안에 `var()` 를 넣지 않는다** (webkit#202259, `repo.test.ts` 가 검사). 값이 바뀌는 것은 TS 에서 계산해 인라인으로 넘긴다.
- **스타일 import 순서 = 캐스케이드 순서.** `src/index.css` 가 진입점이고 규칙은 `src/styles/*.css` 에 있다. 이 계획은 **새 CSS 파일을 만들지 않으므로** `index.css` 를 건드릴 일이 없다.
- **게임 로직에서 `Math.random()` 을 부르지 않는다** — 이 계획은 게임 로직을 건드리지 않는다.
- **커밋 author 는 저장소 주인 계정**이어야 한다. `.git/config` 에 이미 박혀 있으니 지우지 말 것.
- 검증 명령: `npm test` · `npm run lint` · `npm run build`. 테스트 하나만 돌릴 때는 `npx vitest run -t "<이름 일부>"`.
- 작업 브랜치는 `copilot/cautious-tribble` 이고 `origin/main`(`c7198bd`) 위로 이미 리베이스돼 있다.

---

### Task 1: `--nostand` 단일 출처 + 빗금 강화

**왜:** 지금 빗금은 `#23201c12`(7%)인데 잔디 바닥이 `#2d6a3f1f`(12%)였다. **뜻을 가진 기호가 배경 질감보다 옅다.** 그리고 곧 범례도 같은 무늬를 써야 하므로 값을 한 곳으로 뺀다.

**Files:**
- Modify: `src/styles/base.css` (`:root` 블록, 현재 1-14행)
- Modify: `src/styles/board.css:178-185` (`.cell.blocked::before`)
- Test: `src/repo.test.ts` (`describe('저장소 규약')` 안)

**Interfaces:**
- Produces: CSS 변수 `--nostand` — 사선 빗금 `background` 값. Task 4 의 범례가 `var(--nostand)` 로 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/repo.test.ts` 의 `it('바닥 재질마다 질감이 있다', …)` **바로 앞**에 넣는다.

```ts
  /* 빗금은 "여기 못 선다" 는 뜻을 가진 기호다. 보드와 범례가 같은 무늬를 보여야
     플레이어가 둘을 잇는다. 값을 양쪽에 복사해 두면 한쪽만 고쳐지는 날이 온다 */
  it('설 수 없음 빗금은 --nostand 한 곳에서만 정한다', () => {
    const css = (name: string) =>
      Object.entries(sources).find(([p]) => p.endsWith(`/styles/${name}`))?.[1] ?? '';

    expect(css('base.css'), 'base.css 에 --nostand 정의가 없다').toMatch(/--nostand:/);
    // panels.css 는 Task 4(범례 스와치)에서 이 목록에 들어온다
    for (const name of ['board.css'])
      expect(css(name), `${name} 이 --nostand 를 참조하지 않는다`).toContain('var(--nostand)');
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run -t "설 수 없음 빗금은"`
Expected: FAIL — `base.css 에 --nostand 정의가 없다`

- [ ] **Step 3: `base.css` 에 변수를 넣는다**

`src/styles/base.css` 의 `--accent: #c0392b;` 바로 아래에 넣는다.

```css
  --accent: #c0392b;
  /* 설 수 없는 칸의 사선 빗금. 뜻을 가진 기호라 여기 한 곳에서만 정하고
     보드(`.cell.blocked`)와 범례(`.legend .no`)가 같이 쓴다 — 값이 두 벌이면
     언젠가 갈라진다. 바닥 재질은 이 무늬를 흉내 내면 안 된다.
     예전 값(#23201c12)은 잔디 바닥(12%)보다 옅어서, 뜻을 가진 기호가
     배경 무늬에 묻혔다 */
  --nostand: repeating-linear-gradient(45deg, #0000 0 5px, #23201c26 5px 7px);
  --muted: #7d7466;
```

- [ ] **Step 4: `board.css` 가 그걸 참조하게 한다**

`src/styles/board.css:178-185` 를 통째로 바꾼다.

```css
/* 설 수 없는 칸은 바닥 재질과 무관하게 빗금으로 읽히게 한다.
   무늬는 base.css 의 --nostand 가 유일한 출처다 */
.cell.blocked::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--nostand);
  pointer-events: none;
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run -t "설 수 없음 빗금은"`
Expected: PASS

- [ ] **Step 6: 커밋한다**

```bash
git add src/styles/base.css src/styles/board.css src/repo.test.ts
git commit -m "$(cat <<'EOF'
설 수 없음 빗금을 base.css 한 곳으로 빼고 진하게 올린다

빗금은 #23201c12(7%)였는데 잔디 바닥이 #2d6a3f1f(12%)였다.
뜻을 가진 기호가 배경 질감보다 옅었다. 15% 로 올린다.

곧 범례도 같은 무늬를 써야 해서 값을 --nostand 로 뺀다.
값이 두 벌이면 한쪽만 고쳐지는 날이 온다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 2: 바닥 재질에서 사선을 걷어낸다

**왜:** 유저 신고의 직접 원인. 잔디가 `45deg` 로 `설 수 없음` 과 **각도까지 같다.**

**Files:**
- Modify: `src/styles/board.css:120-143` (`grass`·`straw`·`water`·`coated`)
- Test: `src/repo.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `--nostand` (`base.css` 에 있어야 테스트의 예외 처리가 성립한다)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/repo.test.ts`, Task 1 에서 넣은 테스트 **바로 아래**에 넣는다.

```ts
  /* 사선 빗금은 `설 수 없음` 한 가지 뜻으로 예약돼 있다. 잔디 바닥이 같은 45도
     빗금이던 시절 플레이어가 못 서는 칸과 잔디를 구별하지 못했다 — 심지어
     잔디가 더 진했다. board.css 만 보면 새 스타일시트가 생길 때 규약이
     새어나가므로(outer.css 가 그렇게 생겼다) 스타일 전체를 본다 */
  it('사선 반복 그라디언트는 --nostand 하나뿐이다', () => {
    const bad: string[] = [];
    for (const [path, text] of Object.entries(sources)) {
      if (!path.endsWith('.css')) continue;
      for (const line of text.split('\n')) {
        const m = /repeating-linear-gradient\(\s*(-?\d+)deg/.exec(line);
        if (m && Number(m[1]) % 90 !== 0 && !line.includes('--nostand:'))
          bad.push(`${path}: ${line.trim()}`);
      }
    }
    expect(bad).toEqual([]);
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run -t "사선 반복 그라디언트는"`
Expected: FAIL — `grass`(45deg)·`straw`(-30deg)·`water`(20deg)·`coated`(115deg) 네 줄이 나열된다

- [ ] **Step 3: 네 재질을 바꾼다**

`src/styles/board.css:120-123` (`grass`):

```css
/* 잔디 — 짧은 세로 풀잎. 사선으로 그으면 `설 수 없음` 빗금(--nostand)과 헷갈린다.
   풀잎은 원래 세로로 선다 */
.cell[data-floor='grass'] {
  --floor-tint: #e5efd4;
  --floor-img: radial-gradient(ellipse 1px 3px at 50% 60%, #2d6a3f2b 60%, #0000 62%);
  --floor-size: 7px 9px;
}
```

`src/styles/board.css:129-132` (`straw`):

```css
/* 짚 — 썰린 토막이 가로세로로 눕는다. 사선은 `설 수 없음` 전용이다.
   soil 의 동그란 점과 갈리도록 토막을 길쭉하게 눕힌다 */
.cell[data-floor='straw'] {
  --floor-tint: #f7edc9;
  --floor-img:
    radial-gradient(ellipse 3px 1px at 30% 25%, #a9822d3d 60%, #0000 62%),
    radial-gradient(ellipse 1px 3px at 75% 70%, #a9822d33 60%, #0000 62%);
  --floor-size: 11px 11px;
}
```

`src/styles/board.css:134-137` (`water`):

```css
/* 안뜰 연못 — 잔물결은 동심원이다. 예전엔 사선이었는데 `설 수 없음` 빗금과 겹쳤다 */
.cell[data-floor='water'] {
  --floor-tint: #dfeef4;
  --floor-img: repeating-radial-gradient(circle at 50% 50%, #0000 0 5px, #2f7d9c26 5px 7px);
  --floor-size: 26px 26px;
}
```

`src/styles/board.css:139-143` (`coated`):

```css
/* 사무실 코팅바닥 — 에폭시 광택. 천장 조명이 세로로 비친다.
   반사는 한 방향으로 넓게 흘러야 무늬가 아니라 빛으로 읽힌다.
   예전엔 115도였는데 사선은 `설 수 없음` 전용으로 예약했다 */
.cell[data-floor='coated'] {
  --floor-tint: #eceef0;
  --floor-img: repeating-linear-gradient(90deg, #0000 0 22px, #ffffffcc 22px 30px, #0000 30px 44px);
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run -t "사선 반복 그라디언트는"`
Expected: PASS

- [ ] **Step 5: 바닥 재질 테스트가 안 깨졌는지 본다**

Run: `npx vitest run src/repo.test.ts`
Expected: PASS (전부). `바닥 재질마다 질감이 있다` 는 `[data-floor='<kind>']` 선택자 존재만 보므로 무늬를 바꿔도 통과해야 한다.

- [ ] **Step 6: 눈으로 확인한다**

Run: `npm run dev`

브라우저에서 확인할 것 — **네 가지를 실제로 봐야 한다.**
1. **농장 테마**에서 `목초지`·`정원`(잔디)과 `돼지우리`·`외양간`(짚) 바닥이 빗금으로 안 보이는지.
2. 같은 판에서 **설 수 없는 가구**(여물통·나무·허수아비)의 빗금이 바닥보다 확실히 진한지.
3. **농장 5×5 이상**에서 안뜰 연못의 동심 물결. **물방울무늬처럼 보이면** `--floor-img` 를 `repeating-linear-gradient(0deg, #0000 0 5px, #2f7d9c26 5px 7px)` 로 내리고 `--floor-size` 줄을 지운다(설계 스펙의 예비안).
4. **사무실 테마**의 `복도`·`창고` 세로 광택.

- [ ] **Step 7: 커밋한다**

```bash
git add src/styles/board.css src/repo.test.ts
git commit -m "$(cat <<'EOF'
바닥 재질에서 사선을 걷어내 빗금의 뜻을 하나로 만든다

잔디가 45도 빗금이라 `설 수 없음` 표시와 각도까지 같았다.
플레이한 사람이 둘을 구별하지 못한다고 알려왔다.

잔디는 세로 풀잎, 짚은 썰린 토막, 연못은 동심 물결,
코팅바닥은 세로 광택으로 바꾼다. 이제 사선으로 반복되는 선은
`설 수 없음` 하나뿐이다.

board.css 만 보면 새 스타일시트가 생길 때 규약이 새어나가므로
repo.test.ts 가 src/styles 전체를 본다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 3: `옆 = 상하좌우` 다이어그램 + 문구 세 곳

**왜:** 엔진은 상하좌우 4방향인데(`clues.ts` 의 `DIRS`) `상하좌우` 라는 말이 `README.md` 에만 있다. `인접`·`붙어 있다` 는 대각선을 배제하지 않는 말이다.

**Files:**
- Modify: `src/components/GamePanels.tsx` (`RulesPanel`, 현재 59-75행)
- Modify: `src/styles/panels.css` (`.rules ol` 규칙 뒤, 현재 16-22행 다음)
- Modify: `src/data/tour.ts` (2단계 `body`, 현재 23-27행)
- Test: `src/components/render.test.ts` (`describe('App 렌더링')` 안)

**Interfaces:**
- Produces: 클래스 `.adj` 와 자식 `i.yes`/`i.no`/`i.mid` — Task 4 나 이후 작업이 참조하지 않지만 `render.test.ts` 가 개수를 센다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/components/render.test.ts` 의 `it('범례는 기본 화면이 아니라 사건 브리핑 안에 있다', …)` **바로 뒤**에 넣는다.

```ts
  /* `인접`·`붙어 있다` 는 대각선을 배제하지 않는 말이라, 실제로 대각선을 세다가
     막힌 사람이 있었다. 그림이 상하좌우 넷만 `옆` 이라고 말하는지 칸 수로 본다.
     엔진(`clues.ts` 의 DIRS)과 어긋나면 플레이어가 푼 답이 갈린다 */
  it('규칙이 옆 = 상하좌우 넷임을 그림으로 말한다', () => {
    expect((html.match(/class="adj"/g) ?? []).length).toBe(1);
    const from = html.slice(html.indexOf('class="adj"'));
    const grid = from.slice(0, from.indexOf('</span>'));
    expect((grid.match(/class="yes"/g) ?? []).length).toBe(4);
    expect((grid.match(/class="no"/g) ?? []).length).toBe(4);
    expect((grid.match(/class="mid"/g) ?? []).length).toBe(1);
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run -t "규칙이 옆 = 상하좌우"`
Expected: FAIL — `expected 0 to be 1` (`.adj` 가 없다)

- [ ] **Step 3: 다이어그램 컴포넌트를 만든다**

`src/components/GamePanels.tsx` 의 `export function RulesPanel()` **바로 앞**에 넣는다.

```tsx
const ADJ = [-1, 0, 1];

/**
 * '옆' 이 상하좌우 넷이라는 걸 문장 대신 그림으로 말한다. `인접`·`붙어 있다` 는
 * 대각선을 배제하지 않는 말이라 실제로 대각선을 세다 막힌 사람이 있었다.
 *
 * 칸의 뜻은 맨해튼 거리로 정한다 — `clues.ts` 의 `DIRS` 와 같은 규칙에서 나온
 * 그림이라 손으로 찍은 표가 아니다. 여기 ✕ 는 보드 메모 브러시(`.mark-x`)와 같은
 * `아니다` 라서 뜻이 겹치는 게 아니라 이어진다.
 * 장식이라 aria-hidden 이고, 옆의 규칙 문장이 혼자서도 뜻이 통한다.
 */
function AdjacencyDiagram() {
  return (
    <span className="adj" aria-hidden="true">
      {ADJ.flatMap((dr) =>
        ADJ.map((dc) => {
          const d = Math.abs(dr) + Math.abs(dc);
          return (
            <i key={`${dr},${dc}`} className={d === 0 ? 'mid' : d === 1 ? 'yes' : 'no'}>
              {d === 1 ? '✓' : d === 2 ? '✕' : ''}
            </i>
          );
        }),
      )}
    </span>
  );
}
```

- [ ] **Step 4: 규칙 4·5번 문구를 고치고 그림을 단다**

`src/components/GamePanels.tsx` 의 `RulesPanel` 안, 아래 두 줄을 바꾼다.

바꾸기 전:
```tsx
        <li>'옆'은 같은 방에서 인접해 있다는 뜻</li>
        <li>'~에서 나왔다'는 그 방과 벽을 맞댄, 그 방이 아닌 칸</li>
```

바꾼 뒤:
```tsx
        <li>
          '옆'은 같은 방 안에서 상하좌우로 붙은 칸 — 대각선은 아니다
          <AdjacencyDiagram />
        </li>
        <li>'~에서 나왔다'는 그 방과 상하좌우로 벽을 맞댄, 그 방이 아닌 칸</li>
```

- [ ] **Step 5: 스타일을 넣는다**

`src/styles/panels.css` 의 `.rules ol { … }` 블록 **바로 뒤**에 넣는다.

```css
/* '옆' 이 상하좌우 넷이라는 걸 말 대신 보여준다. 대각선 칸에 빗금을 쓰지 않는다 —
   사선은 `설 수 없음` 전용이라 뜻이 섞인다. 3열은 고정값이라
   repeat() 안에 var() 를 넣을 일이 없다(webkit#202259) */
.adj {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  width: 66px;
  margin: 6px 0 2px;
}
.adj i {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border: 1px solid var(--tile-line);
  background: var(--tile);
  font-size: 11px;
  font-style: normal;
  line-height: 1;
}
/* 초록은 범례의 `설 수 있음` 알약과 같은 색이다 — 같은 뜻이면 같게 보여야 한다 */
.adj i.yes {
  background: #dcefdd;
  color: #2d6a3f;
  font-weight: 700;
}
.adj i.no {
  color: var(--muted);
}
.adj i.mid {
  background: var(--wall);
  border-color: var(--wall);
}
```

- [ ] **Step 6: 온보딩 문구를 고친다**

`src/data/tour.ts` 의 2단계(`sel: '.dclues'`) `body` 를 바꾼다.

바꾸기 전:
```ts
    body: "각자 자기가 어디 있었는지 말한다. 줄을 누르면 그 사람의 메모 브러시가 켜지고, 그대로 보드 칸을 누르면 표시된다. 다시 누르면 지워진다. '옆'은 같은 방 안에서 붙어 있다는 뜻이라 방 경계를 넘지 않는다.",
```

바꾼 뒤:
```ts
    body: "각자 자기가 어디 있었는지 말한다. 줄을 누르면 그 사람의 메모 브러시가 켜지고, 그대로 보드 칸을 누르면 표시된다. 다시 누르면 지워진다. '옆'은 같은 방 안에서 상하좌우로 붙어 있다는 뜻이다 — 대각선은 아니고, 방 경계도 넘지 않는다.",
```

- [ ] **Step 7: 통과를 확인한다**

Run: `npx vitest run src/components/render.test.ts`
Expected: PASS (전부)

- [ ] **Step 8: 눈으로 확인한다**

Run: `npm run dev`

- 데스크톱에서 제목의 **사건 브리핑**을 열어 규칙 4번 아래 3×3 그림이 나오는지. ✓ 넷이 십자로 앉고 대각선이 ✕ 인지.
- 창을 좁혀(`max-width: 720px`) **모바일 셸**에서도 같은 시트 안에 그림이 나오는지. 두 셸이 `RulesPanel` 을 공유하므로 자동으로 따라와야 한다.

- [ ] **Step 9: 커밋한다**

```bash
git add src/components/GamePanels.tsx src/styles/panels.css src/data/tour.ts src/components/render.test.ts
git commit -m "$(cat <<'EOF'
옆이 상하좌우라는 걸 그림으로 말한다

엔진은 상하좌우 넷인데(clues.ts 의 DIRS) 앱은 `인접`·`붙어 있다`
라고만 했다. 대각선을 배제하지 않는 말이라 대각선을 세다 막힌
사람이 있었다. 상하좌우라는 말은 README 에만 있었다.

규칙 4번 아래에 3x3 그림을 단다. 칸의 뜻은 맨해튼 거리로 정해서
엔진과 같은 규칙에서 나오게 한다. 규칙 5번(~에서 나왔다)도 같은
4방향인데 안 적혀 있어서 같이 넣고, 온보딩 문구도 맞춘다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 4: 범례를 보드 칸의 축소판으로

**왜:** 범례는 `설 수 없음` 을 **글자로만** 말하고 보드는 **빗금으로** 말한다. 둘을 잇는 고리가 없다.

**Files:**
- Modify: `src/components/GamePanels.tsx` (`LegendPanel`, 현재 77-92행)
- Modify: `src/styles/panels.css` (`.legend li` 규칙 뒤, 현재 32-38행 다음 / `.legend svg.art` 41-44행)
- Test: `src/components/render.test.ts` · `src/repo.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `--nostand`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/components/render.test.ts`, Task 3 에서 넣은 테스트 **바로 뒤**에 넣는다.

```ts
  /* 보드는 빗금으로, 범례는 글자로 말하면 둘이 안 이어진다. 범례 줄이 보드 칸의
     축소판이 되도록 가구 그림마다 칸 껍데기를 씌운다 (빗금은 panels.css 가 깐다) */
  it('범례의 가구가 저마다 칸 껍데기 위에 앉는다', () => {
    const from = html.slice(html.indexOf('class="panel legend"'));
    const block = from.slice(0, from.indexOf('</ul>'));
    const rows = (block.match(/<li class="(ok|no)">/g) ?? []).length;
    expect(rows).toBeGreaterThan(0);
    expect((block.match(/class="legend-tile"/g) ?? []).length).toBe(rows);
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run -t "범례의 가구가 저마다"`
Expected: FAIL — `expected 0 to be <가구 수>`

- [ ] **Step 3: 마크업에 칸 껍데기를 씌운다**

`src/components/GamePanels.tsx` 의 `LegendPanel` 안 `<li>` 를 바꾼다.

바꾸기 전:
```tsx
          <li key={f.id} className={f.standable ? 'ok' : 'no'}>
            <Art emoji={f.emoji} image={f.image} icon={f.kind} label={f.label} span={spanOf(f)} />
            <span>{f.label}</span>
            <em>{f.standable ? '설 수 있음' : '설 수 없음'}</em>
          </li>
```

바꾼 뒤:
```tsx
          <li key={f.id} className={f.standable ? 'ok' : 'no'}>
            {/* 보드 칸의 축소판이다 — 못 서는 가구는 보드에서와 똑같은 빗금 위에
                앉는다. 글자로만 말하면 보드의 무늬와 이어지지 않는다 */}
            <span className="legend-tile">
              <Art emoji={f.emoji} image={f.image} icon={f.kind} label={f.label} span={spanOf(f)} />
            </span>
            <span>{f.label}</span>
            <em>{f.standable ? '설 수 있음' : '설 수 없음'}</em>
          </li>
```

- [ ] **Step 4: 스타일을 넣는다**

`src/styles/panels.css` 의 `.legend li { … }` 블록 **바로 뒤**에 넣는다.

```css
/* 보드 칸의 축소판. 못 서는 가구는 보드와 같은 빗금 위에 앉는다 (base.css 의 --nostand) */
.legend-tile {
  display: grid;
  place-items: center;
  height: 26px;
  border-radius: 4px;
  background: var(--tile);
}
.legend .no .legend-tile {
  background: var(--nostand), var(--tile);
}
```

같은 파일의 `.legend svg.art` 폭을 줄인다 — 껍데기가 38px 열을 다 쓰므로 그림이 가장자리에 닿는다.

바꾸기 전:
```css
.legend svg.art {
  width: 38px;
  height: 22px;
}
```

바꾼 뒤:
```css
.legend svg.art {
  width: 34px;
  height: 20px;
}
```

- [ ] **Step 5: `repo.test.ts` 의 단일 출처 검사에 `panels.css` 를 넣는다**

Task 1 에서 넣은 테스트의 목록 줄을 바꾼다.

바꾸기 전:
```ts
    // panels.css 는 Task 4(범례 스와치)에서 이 목록에 들어온다
    for (const name of ['board.css'])
```

바꾼 뒤:
```ts
    for (const name of ['board.css', 'panels.css'])
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npx vitest run src/components/render.test.ts src/repo.test.ts`
Expected: PASS (전부)

- [ ] **Step 7: 눈으로 확인한다**

Run: `npm run dev`

**사건 브리핑**을 열어 범례를 본다. `설 수 없음` 줄의 가구가 빗금 바닥 위에 앉고, `설 수 있음` 줄은 맨 바닥인지. 소파(3칸)·침대(2칸)처럼 가로로 긴 SVG 가 껍데기를 넘치지 않는지 — 넘치면 `.legend svg.art` 의 `width` 를 더 줄인다.

- [ ] **Step 8: 커밋한다**

```bash
git add src/components/GamePanels.tsx src/styles/panels.css src/components/render.test.ts src/repo.test.ts
git commit -m "$(cat <<'EOF'
범례를 보드 칸의 축소판으로 만든다

범례는 `설 수 없음` 을 글자로만 말하고 보드는 빗금으로 말해서
둘을 잇는 고리가 없었다. 가구 그림에 칸 껍데기를 씌우고 못 서는
줄에만 보드와 같은 빗금을 깐다.

빗금 값은 여전히 base.css 의 --nostand 하나이고, 이제 board.css 와
panels.css 가 함께 참조한다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 5: 문서 + 릴리스

**왜:** `main` 푸시는 버전을 올려야만 통과한다(`.githooks/pre-push` + `render.test.ts`). 그리고 규약이 코드에만 있으면 다음 사람이 모른다.

**Files:**
- Modify: `README.md:18` (규칙 3)
- Modify: `.github/copilot-instructions.md` (`### 렌더링` 절, 현재 172-184행)
- Modify: `CHANGELOG.md` (맨 위)
- Modify: `package.json` (`npm version patch` 가 바꾼다 — 손으로 고치지 말 것)

- [ ] **Step 1: README 규칙 3에 빗금을 적는다**

`README.md:18` 을 바꾼다.

바꾸기 전:
```markdown
3. 가구 위에는 설 수 없다. 침대·러그·건초더미처럼 `standable` 인 것만 예외 — 어느 가구가 예외인지는 사건마다 다르므로 `범례` 가 알려준다. 건물 밖과 안뜰에도 아무도 서 있지 않다.
```

바꾼 뒤:
```markdown
3. 가구 위에는 설 수 없다. 침대·러그·건초더미처럼 `standable` 인 것만 예외 — 어느 가구가 예외인지는 사건마다 다르므로 `범례` 가 알려준다. 못 서는 칸에는 **사선 빗금**이 깔리고 범례의 그림도 같은 빗금 위에 앉는다. 건물 밖과 안뜰에도 아무도 서 있지 않다.
```

- [ ] **Step 2: 규약을 `copilot-instructions.md` 에 적는다**

`### 렌더링` 절에서 `- 2칸 가구는 cells[0] 에서 한 번만 그리고…` 로 시작하는 줄 **바로 앞**에 넣는다.

```markdown
- **사선 빗금은 `설 수 없음` 전용이다.** 무늬는 `base.css` 의 `--nostand` 하나가 유일한 출처고 보드(`.cell.blocked`)와 범례(`.legend .no`)가 같이 쓴다. **바닥 재질(`--floor-img`)에는 사선을 쓰지 않는다** — 잔디가 45도 빗금이던 시절 플레이어가 못 서는 칸과 잔디를 구별하지 못했다(게다가 잔디가 더 진했다). `repo.test.ts` 가 `src/styles/` 전체에서 90도의 배수가 아닌 `repeating-linear-gradient` 를 `--nostand` 선언 한 줄로 묶는다. 새 테마의 바닥은 점묘·동심원·직교선으로 그릴 것.
- **`옆`이 상하좌우라는 건 그림이 말한다** (`GamePanels.tsx` 의 `AdjacencyDiagram`, 규칙 4번 아래). 칸의 뜻은 맨해튼 거리로 정해서 `clues.ts` 의 `DIRS` 와 같은 규칙에서 나오게 한다. 거기 쓰는 `✕` 는 보드 메모 브러시(`.mark-x`)와 같은 `아니다` 다 — 이 글리프에 **다른** 뜻을 붙이는 변경은 그 둘과 부딪히는지 먼저 볼 것.
```

- [ ] **Step 3: CHANGELOG 맨 위에 항목을 쓴다**

`CHANGELOG.md` 의 `# 버전 기록` 바로 아래, `## v0.13.0` 앞에 넣는다.

```markdown
## v0.13.1 — 2026-08-05

### 고침

- **잔디 바닥과 `설 수 없음` 표시가 똑같은 빗금이던 것.** 각도(45°)까지 같았고 잔디가 더 진했다 — 뜻을 가진 기호가 배경 무늬보다 옅었다. 이제 사선 빗금은 `설 수 없음` 한 가지 뜻으로만 쓴다. 잔디는 세로 풀잎, 짚은 썰린 토막, 연못은 동심 물결, 코팅바닥은 세로 광택으로 바꿨다.

### 더함

- **`옆`이 상하좌우라는 걸 그림으로 보여준다.** 규칙에 3×3 그림을 넣어 대각선은 `옆`이 아니라고 말한다. `인접`이라는 말만으로는 안 갈렸다. `~에서 나왔다`도 같은 4방향이라고 적었다.
- **범례가 보드의 축소판이 됐다.** 설 수 없는 가구는 보드에서와 같은 빗금 위에 앉는다.
```

- [ ] **Step 4: 문서를 커밋한다** (버전 범프 전에 — 훅이 CHANGELOG 항목을 찾는다)

```bash
git add README.md .github/copilot-instructions.md CHANGELOG.md
git commit -m "$(cat <<'EOF'
빗금 예약 규약을 문서에 적는다

코드에만 있으면 다음 사람이 새 테마에 사선 바닥을 깐다.
repo.test.ts 가 막긴 하지만 왜 막는지는 여기 적어둔다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

- [ ] **Step 5: 전체 검증을 돌린다**

Run: `npm test && npm run lint && npm run build`
Expected: 전부 PASS. `render.test.ts` 의 `CHANGELOG 에 현재 버전 항목이 있다` 는 **아직 `0.13.0` 기준**이라 통과한다 (v0.13.0 항목이 남아 있다).

- [ ] **Step 6: 버전을 올린다**

```bash
npm version patch
```

`0.13.0` → `0.13.1`. 커밋과 태그는 npm 이 만든다. **손으로 `package.json` 을 고치지 말 것.**

- [ ] **Step 7: 버전 범프 후 다시 검증한다**

Run: `npm test`
Expected: PASS. 이제 `CHANGELOG 에 현재 버전 항목이 있다` 가 `v0.13.1` 을 찾고, Step 3 에서 쓴 항목이 그걸 만족한다.

- [ ] **Step 8: 푸시하고 PR 을 연다**

```bash
env -u GH_TOKEN -u GITHUB_TOKEN gh auth status
```

활성 계정이 저장소 주인인지 **먼저 확인한다.** 아니면 사람이 `gh auth login` 을 해야 한다 — **포크를 떠서 우회하지 말 것.**

```bash
env -u GH_TOKEN -u GITHUB_TOKEN \
git -c credential.https://github.com.helper= \
    -c credential.https://github.com.helper='!gh auth git-credential' \
    -c credential.interactive=auto \
    push -u origin copilot/cautious-tribble --follow-tags

env -u GH_TOKEN -u GITHUB_TOKEN gh pr create \
  --title "빗금의 뜻과 '옆'의 범위를 규칙이 스스로 설명하게 한다" \
  --body "플레이 피드백 둘을 반영한다.

- 잔디 바닥과 \`설 수 없음\` 표시가 45도 각도까지 같았다. 사선 빗금을 \`설 수 없음\` 전용으로 예약하고 바닥 재질에서 사선을 걷어냈다.
- \`옆\` 이 대각선을 포함하는지 앱 어디에도 없었다. 규칙에 3×3 그림을 넣고 문구 세 곳을 맞췄다.

게임 로직은 건드리지 않았다 — 같은 시드는 같은 답이다.

설계: \`docs/superpowers/specs/2026-08-04-rules-clarity-design.md\`"
```

**`create_pull_request` 툴은 이 저장소에서 못 쓴다.** 머지는 squash 가 아니라 **머지 커밋**이다 (릴리스 태그가 히스토리 밖으로 떨어진다).

---

## 자체 검토

**스펙 커버리지** — 스펙의 각 절이 어느 Task 에 들어갔는지.

| 스펙 절 | Task |
|---|---|
| 1. 사선 빗금 예약 — 규약 | Task 2 테스트 |
| 1. 바닥 재질 교체 4종 | Task 2 Step 3 |
| 1. 빗금 강화 + `--nostand` 단일 출처 | Task 1 |
| 2. 3×3 다이어그램 | Task 3 Step 3·5 |
| 2. 문구 교정 세 곳 | Task 3 Step 4·6 |
| 3. 범례 스와치 | Task 4 |
| 테스트 3종 | Task 1 Step 1 · Task 2 Step 1 · Task 3 Step 1 · Task 4 Step 1 (넷으로 늘었다 — 범례 마크업 검사가 붙었다) |
| 문서·릴리스 | Task 5 |
| 범위 밖(게임 로직·모바일 온보딩·보드 하이라이트) | 어느 Task 도 건드리지 않는다 ✓ |

**타입·이름 일관성** — `--nostand` 는 Task 1 에서 정의되고 Task 2(테스트 예외)·Task 4(범례)에서 같은 이름으로 쓰인다. `.legend-tile` 은 Task 4 안에서만 쓰인다. `.adj`/`i.yes`/`i.no`/`i.mid` 는 Task 3 안에서 정의되고 같은 Task 의 테스트가 센다. `AdjacencyDiagram` 은 Task 3 에서 정의되고 같은 Task 에서 쓰인다.

**남은 위험 둘**

1. **`water` 동심 물결이 물방울무늬로 보일 수 있다.** Task 2 Step 6 에 예비안(가로 물결선)과 판단 기준을 적어뒀다. 눈으로 봐야 한다.
2. **형제 세션과 겹친다.** `copilot/in-play-victim-hints` 가 `base.css`(`--dead-x`)·`CHANGELOG.md`·`package.json`·`GamePanels.tsx`(`AccusePanel`)·`panels.css`(`.accuse-why`) 를 건드린다. **먼저 끝나는 쪽이 바닥, 나중이 리베이스**로 합의했다. `data/tour.ts` 는 이쪽만 건드린다.
