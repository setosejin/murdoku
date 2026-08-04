# 사무실 테마 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현대 IT 회사의 한 층을 배경으로 하는 세 번째 사건 테마 `사무실` 을 추가한다.

**Architecture:** 테마는 데이터다. `src/data/content.ts` 의 `THEMES` 배열에 `OFFICE` 상수를 하나 더 넣으면 생성기·솔버·렌더러가 그대로 받아 쓴다. 게임 로직은 손대지 않는다. 데이터 밖으로 번지는 변경은 두 가지뿐 — `FloorKind` 에 `coated`·`acrylic` 두 재질을 넣고 `board.css` 에 질감을 그리는 것, `sprite.svg` 에 사무실 고유 가구 6종을 그리는 것.

**Tech Stack:** React 19 · Vite · TypeScript · Vitest · 플레인 CSS · 손으로 그린 SVG 스프라이트. 의존성 추가 없음.

## Global Constraints

- **UI 문자열·주석·커밋 메시지는 한국어로 쓴다.**
- **소스 파일은 500줄을 넘지 않는다** (`repo.test.ts` 가 검사). `content.ts` 는 현재 181줄이고 이 작업 후 약 240줄이 된다.
- **게임 로직에서 `Math.random()` 을 부르지 않는다.** 이 작업은 로직을 건드리지 않으므로 자동으로 지켜진다.
- **의존성을 추가하지 않는다.**
- **재사용하는 스프라이트 `kind` 의 `size` 를 바꾸지 않는다** — `repo.test.ts` 가 `kind` → viewBox 를 검사한다. `desk`=2 · `sofa`=3 · `bench`=2 · `cart`=2 · `tv`=1 · `plant`=1 · `rug`=4 · `bucket`=1.
- **스프라이트는 선 색·굵기를 지정하지 않는다.** `svg.art` 가 `fill: none; stroke: currentColor; stroke-width: 1.6` 을 상속시킨다. 채움(`fill="#..."`)과 부분적인 `stroke-width` 조절, `stroke="none"` 만 쓴다.
- **스프라이트 viewBox 는 한 칸당 24.** `size: 1` → `0 0 24 24`, `size: 2` → `0 0 48 24`, `size: 3` → `0 0 72 24`, `size: 4` → `0 0 48 48`. `id` 는 `i-<kind>`.
- **커밋·푸시·PR 은 저장소 주인 계정으로.** 푸시·PR 은 `env -u GH_TOKEN -u GITHUB_TOKEN` 으로 주입된 토큰을 벗긴다. `create_pull_request` 툴은 이 저장소에서 쓸 수 없다.
- **머지는 squash 가 아니라 머지 커밋.**
- **`main` 푸시는 버전을 올려야만 통과한다** — `CHANGELOG.md` 항목 + `npm version patch`.

## 파일 구조

| 파일 | 이 작업에서 맡는 것 |
|---|---|
| `src/game/types.ts` | `FLOOR_KINDS` 값 목록 신설 + `FloorKind` 를 거기서 파생 |
| `src/styles/board.css` | `coated`·`acrylic` 바닥 질감 2종 |
| `src/assets/sprite.svg` | 사무실 고유 가구 아이콘 6종 |
| `src/data/content.ts` | `OFFICE` 테마 상수 + `THEMES` 에 추가 |
| `src/repo.test.ts` | 새 불변식 — 바닥 재질마다 CSS 가 있다 |
| `README.md` | 테마 표에 사무실 행 |
| `CHANGELOG.md` | 새 버전 항목 |

기존 테스트가 `THEMES` 를 순회하므로 테마용 새 테스트는 만들지 않는다. `floorplan.test.ts`(마스크별 행·열 완전 매칭)·`generate.test.ts`(난이도 4·5·6·7 × 60시드 스윕 + 테마 전수 등장)·`repo.test.ts`(스프라이트 viewBox)가 새 테마를 자동으로 검사한다.

---

### Task 1: 설계문·계획문 커밋 + 의존성 설치

**Files:**
- Create: `docs/superpowers/specs/2026-08-04-office-theme-design.md`
- Create: `docs/superpowers/plans/2026-08-04-office-theme.md`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (문서만)

- [ ] **Step 1: 의존성 설치**

이 워크트리에는 `node_modules` 가 없다. `prepare` 스크립트가 `core.hooksPath` 를 `.githooks` 로 맞추는 부수 효과도 있으므로 먼저 돌린다.

```bash
npm install
```

- [ ] **Step 2: 설계문 작성**

`docs/superpowers/specs/2026-08-04-office-theme-design.md` 를 만든다. 담을 것은 전부 이 계획문 안에 있다 — 아래 절을 이 순서로 옮겨 적는다.

| 절 | 출처 |
|---|---|
| 문제 | 테마가 저택·농장 둘뿐이라 시드를 바꿔도 배경이 둘로 돌아온다 |
| 접근 | 이 문서의 **Architecture** |
| 방·바닥 | Task 3 Step 2 의 `rooms` + Task 2 Step 5 의 질감 두 종 |
| 가구 | Task 3 Step 2 의 `furniture` 열넷, 재사용 여덟 · 신규 여섯으로 갈라서 |
| 제약 | 방마다 전용 가구 1개 이상 · 재사용 `kind` 는 `size` 고정 · 1칸 가구가 충분할 것 |
| 문구 | Task 3 Step 2 의 `titles`·`briefs`·`roles` |
| 검증 | 이 문서의 **파일 구조** 아래 문단(기존 테스트가 `THEMES` 를 순회한다) |
| 하지 않는 것 | 로직 변경 없음 · 방 이름 10개 이상 금지(`MAX_ROOMS`=9) · 테마별 UI 분기 없음 |

- [ ] **Step 3: 계획문 복사**

이 문서를 `docs/superpowers/plans/2026-08-04-office-theme.md` 로 그대로 저장한다.

- [ ] **Step 4: 커밋**

```bash
git add docs/superpowers
git commit -m "$(cat <<'EOF'
문서: 사무실 테마 설계문과 구현 계획

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 2: 바닥 재질 `coated`·`acrylic` 추가

지금 `FloorKind` 는 타입 별칭이라 실행 시점에 순회할 수 없다. 그래서 "타입에는 넣었는데 CSS 를 안 그린" 재질이 있어도 아무도 모르고, 그 방은 조용히 기본 타일색으로 깔린다. 값 목록(`FLOOR_KINDS`)으로 바꿔 그 구멍을 테스트로 막고, 그 위에 새 재질 두 종을 얹는다.

**Files:**
- Modify: `src/game/types.ts:5-6`
- Modify: `src/styles/board.css:99-133` (바닥 재질 블록 끝, `water` 다음)
- Test: `src/repo.test.ts` (`describe('저장소 규약')` 안)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `export const FLOOR_KINDS: readonly ['wood','tile','carpet','grass','soil','straw','water','coated','acrylic']` — `src/game/types.ts`
  - `export type FloorKind = (typeof FLOOR_KINDS)[number]` (기존 이름·의미 그대로, 파생 방식만 바뀐다)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/repo.test.ts` 의 맨 위 import 에 `FLOOR_KINDS` 를 더한다.

```ts
import { THEMES } from './data/content';
import { FLOOR_KINDS } from './game/types';
```

`describe('저장소 규약')` 안, `repeat() 안의 var()` 테스트 **아래**에 다음을 넣는다.

```ts
  // FloorKind 에만 넣고 CSS 를 안 그리면 그 방은 조용히 기본 타일색으로 깔린다.
  // 눈으로 보기 전까지 아무도 모르므로 값 목록과 스타일을 직접 맞춰 본다
  it('바닥 재질마다 질감이 있다', () => {
    // 키가 '/src/styles/board.css' 라 정확히 집을 수도 있지만, glob 패턴이 바뀌어도
    // 조용히 undefined 가 되지 않게 끝자락으로 찾는다
    const board = Object.entries(sources).find(([p]) => p.endsWith('/styles/board.css'))?.[1];
    expect(board, 'board.css 를 못 읽었다').toBeTruthy();
    for (const kind of FLOOR_KINDS)
      expect(board, `${kind} 바닥에 스타일이 없다`).toContain(`[data-floor='${kind}']`);
  });
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
npx vitest run src/repo.test.ts -t "바닥 재질마다"
```

기대: FAIL. `FLOOR_KINDS` 가 `./game/types` 에 없어서 import 단계에서 터진다.

- [ ] **Step 3: `FLOOR_KINDS` 를 만들고 재질 두 종을 넣는다**

`src/game/types.ts` 의 5~6번 줄

```ts
/** 방 바닥 재질. 판정에는 안 쓰이고 그림에만 쓴다 */
export type FloorKind = 'wood' | 'tile' | 'carpet' | 'grass' | 'soil' | 'straw' | 'water';
```

을 다음으로 바꾼다.

```ts
/**
 * 방 바닥 재질. 판정에는 안 쓰이고 그림에만 쓴다.
 * 타입이 아니라 값 목록인 이유 — board.css 에 질감이 빠진 재질이 없는지 테스트가 훑는다
 */
export const FLOOR_KINDS = [
  'wood',
  'tile',
  'carpet',
  'grass',
  'soil',
  'straw',
  'water',
  'coated',
  'acrylic',
] as const;

export type FloorKind = (typeof FLOOR_KINDS)[number];
```

- [ ] **Step 4: 테스트가 여전히 실패하는지 확인한다 (이번엔 다른 이유로)**

```bash
npx vitest run src/repo.test.ts -t "바닥 재질마다"
```

기대: FAIL, `coated 바닥에 스타일이 없다`.

- [ ] **Step 5: 질감을 그린다**

`src/styles/board.css` 의 `.cell[data-floor='water']` 블록 **바로 뒤**(`/* ---- 실루엣 밖 ---- */` 주석 앞)에 넣는다.

```css
/* 사무실 코팅바닥 — 에폭시 광택. 반사는 한 방향으로 넓게 흘러야 무늬가 아니라 빛으로 읽힌다 */
.cell[data-floor='coated'] {
  --floor-tint: #eceef0;
  --floor-img: repeating-linear-gradient(115deg, #0000 0 22px, #ffffffcc 22px 30px, #0000 30px 44px);
}
/* 사무실 아크릴바닥 — 반투명 패널. 이음매만 보이고 면은 비어 있어야 유리처럼 보인다 */
.cell[data-floor='acrylic'] {
  --floor-tint: #e8f0f1;
  --floor-img:
    repeating-linear-gradient(0deg, #7fa6ad2e 0 1px, #0000 1px 26px),
    repeating-linear-gradient(90deg, #7fa6ad2e 0 1px, #0000 1px 26px);
}
```

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

```bash
npx vitest run src/repo.test.ts
```

기대: PASS (저장소 규약 전부).

- [ ] **Step 7: 타입 검사**

```bash
npm run build
```

기대: 성공. `FloorKind` 를 쓰는 곳(`content.ts` 의 `RoomSpec`·`OUTDOOR_FLOORS`, `Room.floor`)이 그대로 컴파일된다.

- [ ] **Step 8: 커밋**

```bash
git add src/game/types.ts src/styles/board.css src/repo.test.ts
git commit -m "$(cat <<'EOF'
바닥 재질에 코팅바닥·아크릴바닥을 더한다

FloorKind 를 타입 별칭에서 값 목록(FLOOR_KINDS)으로 바꿨다. 타입일 때는
재질을 넣고 CSS 를 빠뜨려도 그 방이 조용히 기본 타일색으로 깔릴 뿐이라
눈으로 보기 전까지 알 수 없었다. 이제 재질마다 질감이 있는지 테스트가 훑는다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 3: `사무실` 테마 데이터 추가

이 작업의 본체이자 진짜 관문이다. `generatePuzzle` 은 실패해도 조용히 300×20×60 회 되던지므로, 방 하나가 가구를 못 받는 구성이면 에러 없이 재시도만 하다가 맨 끝에서 throw 한다. 이 시점에는 새 스프라이트가 아직 없어서 신규 가구 6종은 이모지로 떨어지지만 — 기능은 완전하다.

**Files:**
- Modify: `src/data/content.ts` (`FARM` 상수 뒤, `THEMES` 앞)
- Modify: `src/data/content.ts:181` (`THEMES` 배열)

**Interfaces:**
- Consumes: `FloorKind` (`'coated'`·`'acrylic'` 포함) — Task 2
- Produces: `THEMES` 가 원소 3개가 된다. `Theme` 타입은 안 바뀐다.

- [ ] **Step 1: 실패를 먼저 본다 — 지금 테마가 둘뿐임을 확인**

```bash
npx vitest run src/game/generate.test.ts -t "모든 난이도"
```

기대: PASS (테마가 둘이라 `seen` 도 둘이다). 이 명령은 Step 4 에서 새 테마의 관문이 된다.

- [ ] **Step 2: `OFFICE` 상수를 넣는다**

`src/data/content.ts` 의 `const FARM: Theme = { ... };` 블록 **뒤**, `export const THEMES` **앞**에 넣는다.

```ts
const OFFICE: Theme = {
  id: 'office',
  label: '사무실',
  rooms: [
    { name: 'A존', floor: 'wood' },
    { name: 'B존', floor: 'wood' },
    { name: '라운지', floor: 'wood' },
    { name: '복도', floor: 'coated' },
    { name: '창고', floor: 'coated' },
    { name: '화장실', floor: 'tile' },
    { name: '기계실', floor: 'tile' },
    { name: '엘리베이터', floor: 'acrylic' },
    { name: '회의실', floor: 'acrylic' },
  ],
  courtyard: { label: '아트리움', emoji: '🪴', floor: 'grass' },
  furniture: [
    { kind: 'desk', label: '책상', emoji: '🗄️', size: 2, standable: false, rooms: ['A존', 'B존', '회의실'] },
    { kind: 'sofa', label: '소파', emoji: '🛋️', size: 3, standable: true, rooms: ['라운지'] },
    { kind: 'bench', label: '작업대', emoji: '🔨', size: 2, standable: false, rooms: ['기계실', '창고'] },
    { kind: 'cart', label: '청소카트', emoji: '🛒', size: 2, standable: false, rooms: ['화장실', '창고', '복도'] },
    { kind: 'tv', label: '모니터', emoji: '🖥️', size: 1, standable: false, rooms: ['회의실', 'A존', 'B존', '라운지'] },
    { kind: 'copier', label: '복사기', emoji: '🖨️', size: 1, standable: false, rooms: ['A존', 'B존', '복도', '창고'] },
    { kind: 'cooler', label: '정수기', emoji: '🚰', size: 1, standable: false, rooms: ['복도', '라운지', 'A존', 'B존'] },
    { kind: 'server', label: '서버랙', emoji: '💽', size: 2, standable: false, rooms: ['기계실', '창고'] },
    { kind: 'sink', label: '세면대', emoji: '🧼', size: 2, standable: false, rooms: ['화장실'] },
    { kind: 'elevator', label: '엘리베이터', emoji: '🛗', size: 2, standable: false, rooms: ['엘리베이터'] },
    { kind: 'whiteboard', label: '화이트보드', emoji: '📋', size: 2, standable: false, rooms: ['회의실', 'A존', 'B존'] },
    { kind: 'plant', label: '화분', emoji: '🪴', size: 1, standable: false },
    { kind: 'rug', label: '러그', emoji: '🟫', size: 4, standable: true },
    { kind: 'bucket', label: '양동이', emoji: '🪣', size: 1, standable: false },
  ],
  wallItems: [
    { kind: 'window', label: '창문', emoji: '🪟' },
    { kind: 'door', label: '문', emoji: '🚪' },
  ],
  titles: [
    '야근하던 밤', '출입카드는 한 장뿐', '꺼지지 않은 모니터', '서버실의 경고음',
    '삭제된 커밋', '엘리베이터는 12층에서 멈췄다', '식어버린 아메리카노',
    '금요일 여섯 시의 회의', '화이트보드에 남은 글씨', '정전된 3분',
  ],
  briefs: [
    '어젯밤 이 층에 남아 있던 사람은 이 안에 있다.',
    '출입 기록에는 나간 사람이 없다. 범인은 아직 이 층에 있다.',
    '기계실 문은 카드로만 열린다. 그 카드를 쓴 사람은 하나뿐이었다.',
    '모두가 제자리에 있었다고 했지만, 모니터 하나만 꺼져 있었다.',
    '피해자와 마지막까지 같은 방에 있던 사람을 찾아라.',
  ],
  roles: [
    '팀장', '개발자', '디자이너', '기획자', '인턴',
    '경비원', '미화원', '인사담당자', '영업사원', '외주 개발자',
  ],
};
```

사무실은 전부 실내라 `outdoorItems` 를 두지 않는다 — 바닥에 `grass`·`soil` 이 없어서 `placeWallItems` 가 야외 분기를 타지 않는다.

- [ ] **Step 3: `THEMES` 에 넣는다**

```ts
export const THEMES: readonly Theme[] = [MANSION, FARM, OFFICE];
```

- [ ] **Step 4: 생성 스윕을 돌린다 (진짜 관문)**

```bash
npx vitest run src/game/generate.test.ts src/game/floorplan.test.ts
```

기대: PASS. 특히 `모든 난이도 × 60시드에서 빠짐없이 생성된다` 가 통과해야 하고, 그 안의 `expect([...seen].sort()).toEqual(THEMES.map((t) => t.id).sort())` 가 `office` 를 봤어야 한다.

**실패할 경우의 원인과 손볼 곳:**

- `generatePuzzle` 이 throw → 어떤 방이 가구를 하나도 못 받았을 가능성이 가장 크다. 어느 방인지는 아래 임시 스크립트로 확인한다.
- `seen` 에 `office` 가 없다 → 사무실만 늘 생성에 실패하고 있다는 뜻이다. 같은 원인이다.

원인을 좁히려면 `src/game/office-probe.test.ts` 를 임시로 만들어 돌린다.

```ts
import { expect, it } from 'vitest';
import { buildFloorplan } from './floorplan';
import { rng } from './types';
import { THEMES } from '../data/content';

it('사무실 방마다 가구 후보가 몇 개인지 센다', () => {
  const office = THEMES.find((t) => t.id === 'office')!;
  for (const room of office.rooms) {
    const n = office.furniture.filter((f) => !f.rooms || f.rooms.includes(room.name));
    console.log(room.name, n.length, n.map((f) => `${f.label}(${f.size})`).join(' '));
  }
  // 2칸짜리 방에는 1칸 가구만 들어간다 (budget = floor(cells/2))
  for (const room of office.rooms) {
    const one = office.furniture.filter(
      (f) => (!f.rooms || f.rooms.includes(room.name)) && f.size === 1,
    );
    expect(one.length, `${room.name} 에 1칸 가구가 없다`).toBeGreaterThan(0);
  }
  expect(buildFloorplan(5, rng('probe'), office)).toBeTruthy();
});
```

```bash
npx vitest run src/game/office-probe.test.ts
```

확인이 끝나면 **반드시 지운다** — `rm src/game/office-probe.test.ts`.

- [ ] **Step 5: 전체 테스트**

```bash
npm test
```

기대: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/data/content.ts
git commit -m "$(cat <<'EOF'
사건 테마에 사무실을 더한다

현대 IT 회사의 한 층. 방 아홉(A존·B존·라운지·복도·창고·화장실·기계실·
엘리베이터·회의실)에 바닥 넉 장(마루·코팅바닥·타일·아크릴바닥)을 깔았다.
가구 열넷 중 여섯(복사기·정수기·서버랙·세면대·엘리베이터·화이트보드)은
사무실 고유라 아직 이모지로 떨어진다 — 그림은 다음 커밋에서 그린다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 4: 사무실 고유 가구 아이콘 6종

**Files:**
- Modify: `src/assets/sprite.svg` (`i-stump` 다음, `i-window` 앞)

**Interfaces:**
- Consumes: `OFFICE.furniture` 의 `kind`·`size` — Task 3
- Produces: `i-copier`(24×24) · `i-cooler`(24×24) · `i-server`(48×24) · `i-sink`(48×24) · `i-elevator`(48×24) · `i-whiteboard`(48×24)

- [ ] **Step 1: 지금 이모지로 떨어지는지 확인한다**

```bash
npx vitest run src/repo.test.ts -t "viewBox"
```

기대: PASS — 그런데 통과하는 이유가 "그림이 없어서 건너뛰었기 때문"이다(`if (!boxes.has(spec.kind)) continue`). 아이콘을 넣는 순간 이 테스트가 크기 검사를 시작한다.

- [ ] **Step 2: 아이콘 6종을 그린다**

`src/assets/sprite.svg` 에서 `i-stump` 심볼이 끝난 **뒤**, `i-window` 심볼 **앞**에 넣는다. 색은 기존 팔레트를 그대로 쓴다 — `#dfe6e6`(가전 흰색) · `#3a4750`(짙은 슬레이트) · `#59707d`(그 슬레이트의 밝은 톤, 랙 유닛용) · `#8fb8cf`(화면 파랑) · `#fffdf7`(종이 흰색) · `#bfe0ef`(물) · `#c0392b`(빨강) · `#5a9c62`(초록) · `#e0b13a`(노랑).

```svg
  <!-- ── 사무실 ── -->

  <symbol id="i-copier" viewBox="0 0 24 24">
    <rect x="4" y="7.5" width="16" height="12.5" rx="1.5" fill="#dfe6e6" />
    <rect x="5.5" y="3.5" width="13" height="4" rx="1" fill="#3a4750" />
    <rect x="6.5" y="10" width="5.5" height="4" rx="0.8" fill="#8fb8cf" stroke="none" />
    <path d="M13.5 11.5h4.5" stroke-width="1.2" />
    <rect x="6" y="15.5" width="12" height="2.6" fill="#fffdf7" />
    <path d="M6 20v1.5M18 20v1.5" />
  </symbol>

  <symbol id="i-cooler" viewBox="0 0 24 24">
    <path d="M9.5 2.5h5l2 5h-9z" fill="#bfe0ef" />
    <rect x="6.5" y="7.5" width="11" height="12.5" rx="1.5" fill="#dfe6e6" />
    <circle cx="10" cy="11.5" r="1.3" fill="#8fb8cf" stroke="none" />
    <circle cx="14" cy="11.5" r="1.3" fill="#c0392b" stroke="none" />
    <path d="M8.5 16h7" stroke-width="1.2" />
    <path d="M8 20v1.5M16 20v1.5" />
  </symbol>

  <!-- ▸ 2칸: 칸마다 제 몫의 랙 한 짝 -->
  <symbol id="i-server" viewBox="0 0 48 24">
    <rect x="3" y="3" width="42" height="18" rx="1.5" fill="#3a4750" />
    <path d="M24 3v18" />
    <rect x="6" y="5.5" width="15" height="3.4" rx="0.8" fill="#59707d" stroke="none" />
    <rect x="6" y="10.2" width="15" height="3.4" rx="0.8" fill="#59707d" stroke="none" />
    <rect x="6" y="14.9" width="15" height="3.4" rx="0.8" fill="#59707d" stroke="none" />
    <rect x="27" y="5.5" width="15" height="3.4" rx="0.8" fill="#59707d" stroke="none" />
    <rect x="27" y="10.2" width="15" height="3.4" rx="0.8" fill="#59707d" stroke="none" />
    <rect x="27" y="14.9" width="15" height="3.4" rx="0.8" fill="#59707d" stroke="none" />
    <circle cx="18.5" cy="7.2" r="1" fill="#5a9c62" stroke="none" />
    <circle cx="39.5" cy="7.2" r="1" fill="#e0b13a" stroke="none" />
  </symbol>

  <!-- ▸ 2칸: 칸마다 세면대 하나씩 -->
  <symbol id="i-sink" viewBox="0 0 48 24">
    <path d="M3 10h18v4a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" fill="#dfe6e6" />
    <path d="M27 10h18v4a4 4 0 0 1-4 4H31a4 4 0 0 1-4-4z" fill="#dfe6e6" />
    <path d="M12 10V7a2 2 0 0 1 4 0" />
    <path d="M36 10V7a2 2 0 0 1 4 0" />
    <circle cx="11" cy="13.5" r="1.6" fill="none" stroke-width="1.2" />
    <circle cx="35" cy="13.5" r="1.6" fill="none" stroke-width="1.2" />
    <path d="M12 18v3M36 18v3" />
  </symbol>

  <!-- ▸ 2칸: 칸마다 승강기 한 대. 위 삼각형은 올라감·내려감 표시등 -->
  <symbol id="i-elevator" viewBox="0 0 48 24">
    <rect x="3" y="6" width="18" height="15" rx="1" fill="#dfe6e6" />
    <rect x="27" y="6" width="18" height="15" rx="1" fill="#dfe6e6" />
    <path d="M12 6v15M36 6v15" stroke-width="1.2" />
    <path d="M9 4.5 12 1.8l3 2.7z" fill="#5a9c62" stroke="none" />
    <path d="M33 1.8 36 4.5l3-2.7z" fill="#c0392b" stroke="none" />
    <path d="M6.5 13.5h2.5M15 13.5h2.5" stroke-width="1.2" />
    <path d="M30.5 13.5h2.5M39 13.5h2.5" stroke-width="1.2" />
  </symbol>

  <!-- ▸ 2칸: 칸마다 글씨 한 덩이 + 트레이의 마커 한 자루 -->
  <symbol id="i-whiteboard" viewBox="0 0 48 24">
    <rect x="3" y="3.5" width="42" height="13.5" rx="1.5" fill="#fffdf7" />
    <path d="M24 3.5V17" stroke-width="1.2" />
    <path d="M7 8h12M7 12.5h8" stroke-width="1.2" />
    <path d="M28 8h12M28 12.5h13" stroke-width="1.2" />
    <rect x="4" y="17" width="40" height="2.4" rx="1" fill="#dfe6e6" />
    <rect x="8" y="17.6" width="6" height="1.2" rx="0.6" fill="#c0392b" stroke="none" />
    <rect x="31" y="17.6" width="6" height="1.2" rx="0.6" fill="#8fb8cf" stroke="none" />
  </symbol>
```

- [ ] **Step 3: viewBox 가 발자국과 맞는지 확인한다**

```bash
npx vitest run src/repo.test.ts
```

기대: PASS. 실패하면 메시지가 `<라벨> <실제 viewBox>` 대 `<라벨> <기대 viewBox>` 로 나온다 — `size: 2` 인데 `24x24` 로 그렸다는 뜻이다.

- [ ] **Step 4: 전체 테스트**

```bash
npm test
```

기대: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/assets/sprite.svg
git commit -m "$(cat <<'EOF'
사무실 가구 여섯 개를 그린다

복사기·정수기·서버랙·세면대·엘리베이터·화이트보드. 나머지 여덟 개는
정말 같은 물건이라 저택·농장 아이콘을 그대로 쓴다.

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 5: 눈으로 확인

테스트는 마크업과 규칙만 본다. 바닥 넉 장이 서로 구분되는지, 새 아이콘이 칸 안에서 라벨과 겹치지 않는지는 실제로 띄워 봐야 안다.

**Files:**
- Create → Delete: `src/game/office-seed.test.ts` (임시)

**Interfaces:**
- Consumes: `generatePuzzle` — 기존 API
- Produces: 없음 (검증만)

- [ ] **Step 1: 사무실이 나오는 시드를 찾는다**

`src/game/office-seed.test.ts` 를 임시로 만든다.

```ts
import { it } from 'vitest';
import { generatePuzzle } from './generate';

it('사무실이 나오는 시드를 찍는다', () => {
  const found: string[] = [];
  for (let i = 0; found.length < 5 && i < 400; i++) {
    const seed = `office-${i}`;
    if (generatePuzzle(6, seed).theme.id === 'office') found.push(seed);
  }
  console.log(found.join(' '));
});
```

```bash
npx vitest run src/game/office-seed.test.ts
```

찍힌 시드 다섯 개를 적어 둔다.

- [ ] **Step 2: 임시 파일을 지운다**

```bash
rm src/game/office-seed.test.ts
```

- [ ] **Step 3: 개발 서버를 띄운다**

```bash
npm run dev
```

- [ ] **Step 4: 시드를 넣고 본다**

브라우저에서 열고, 난이도를 6×6 으로 맞춘 뒤 `시드` 패널(데스크톱은 오른쪽 열, 모바일은 메뉴 시트)에 Step 1 의 시드를 넣는다. 다섯 개를 차례로 확인한다.

확인할 것:

1. 상단바에 `[사무실]` 이 뜬다.
2. **바닥 넉 장이 서로 구분된다** — 마루(따뜻한 결) · 코팅바닥(회색 광택 사선) · 타일(청록 체크) · 아크릴바닥(서늘한 격자 이음매). 무늬가 칸선보다 세면 안 된다.
3. **새 아이콘 여섯이 이모지가 아니라 선 그림으로 나온다.** 이모지가 보이면 `kind` 와 `id="i-<kind>"` 가 어긋난 것이다.
4. 두 칸짜리(서버랙·세면대·엘리베이터·화이트보드)가 **두 칸을 다 덮고**, 칸마다 제 몫의 물건이 보인다.
5. 가구 라벨(한국어)이 그림과 함께 보인다.
6. 증언이 사무실 말로 나온다 — `난 서버랙 옆에 있었어!` · `난 회의실에서 막 나온 참이었어!`.

- [ ] **Step 5: 도넛 실루엣의 아트리움을 확인한다**

시드를 바꿔 가며 건물 안쪽에 갇힌 빈 칸이 있는 사건을 찾는다(6×6·7×7 에서 잘 나온다). 그 칸에 🪴 와 `아트리움` 이 잔디 바닥 위에 그려져야 한다.

- [ ] **Step 6: 서버를 끄고, 고칠 게 있으면 고쳐서 커밋한다**

이 태스크에서 코드를 안 고쳤다면 커밋할 것이 없다. 고쳤다면 무엇을 왜 고쳤는지 한국어로 적어 커밋한다.

---

### Task 6: 문서 · 릴리스

**Files:**
- Modify: `README.md:34-39` (테마 표)
- Modify: `CHANGELOG.md` (맨 위)
- Modify: `package.json` (`npm version` 이 고친다)

**Interfaces:**
- Consumes: Task 3 의 방·바닥 이름
- Produces: 없음

- [ ] **Step 1: README 테마 표에 사무실 행을 넣는다**

`README.md` 의 표

```markdown
| 테마 | 방 | 바닥 |
```

아래 `농장` 행 **다음**에 넣는다.

```markdown
| 사무실 | A존·B존·라운지·복도·창고·화장실·기계실·엘리베이터·회의실 | 마루·코팅바닥·타일·아크릴바닥 |
```

- [ ] **Step 2: 현재 버전을 확인한다**

```bash
node -p "require('./package.json').version"
```

`0.10.2` 가 나온다. 다음 버전은 `0.10.3` 이다.

- [ ] **Step 3: CHANGELOG 항목을 쓴다**

`CHANGELOG.md` 의 `# 버전 기록` 바로 아래, `## v0.10.2` **앞**에 넣는다. 렌더러는 `##`/`###`/`-`/`**굵게**`/`` `코드` ``/`[링크](url)` 만 안다 — 표나 중첩 목록을 쓰면 조용히 문단으로 떨어진다.

```markdown
## v0.10.3 — 2026-08-04

### 더함

- **사건 배경에 사무실이 생겼다.** 저택·농장에 이어 세 번째다. 현대 IT 회사의 한 층이라 A존·B존·라운지·복도·창고·화장실·기계실·엘리베이터·회의실 아홉 개 방에 서버랙·복사기·정수기·화이트보드 같은 것들이 놓이고, 용의자는 팀장·개발자·디자이너·인턴·경비원·미화원이 된다.
- 바닥도 두 장 늘었다 — **코팅바닥**(에폭시 광택)과 **아크릴바닥**(반투명 패널). 마루·타일은 저택 것을 그대로 쓴다.
- 건물 안쪽이 뚫린 사건에서는 그 자리가 **아트리움**이 된다 (저택은 안뜰, 농장은 연못).

### 알아둘 것

- 테마는 시드로 정해지므로 사건을 새로 뽑다 보면 셋 중 하나로 나온다. 규칙은 그대로다.
```

- [ ] **Step 4: 문서를 먼저 커밋한다**

`npm version` 이 커밋과 태그를 만들므로, 변경 내용은 그 **앞** 커밋에 들어가야 한다.

```bash
git add README.md CHANGELOG.md
git commit -m "$(cat <<'EOF'
문서: 사무실 테마를 README 표와 버전 기록에 적는다

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

- [ ] **Step 5: 버전을 올린다**

```bash
npm version patch
```

`0.10.3` 커밋과 `v0.10.3` 태그가 생긴다.

- [ ] **Step 6: 전부 돌린다**

```bash
npm run lint && npm run build && npm test
```

기대: 전부 PASS. `CHANGELOG 에 현재 버전 항목이 있다` 가 이제 `v0.10.3` 을 찾는다.

- [ ] **Step 7: 커밋 신원을 확인한다**

```bash
git --no-pager log origin/main..HEAD --format='%h %an <%ae>'
```

전부 저장소 주인 계정이어야 한다. 아니면 되돌린다.

```bash
git tag -d v0.10.3
git rebase --exec 'git commit --amend --no-edit --reset-author' origin/main
git tag -a v0.10.3 -m v0.10.3
```

---

### Task 7: 푸시 · PR

**Files:** 없음

- [ ] **Step 1: 활성 계정이 주인인지 본다**

```bash
env -u GH_TOKEN -u GITHUB_TOKEN gh auth status
```

주인 계정이 활성이어야 한다. 주인 계정을 아예 모른다고 하면 사람이 `gh auth login` 을 해야 하는 시점이다 — **포크를 떠서 우회하지 않는다.**

- [ ] **Step 2: 푸시한다**

```bash
env -u GH_TOKEN -u GITHUB_TOKEN \
git -c credential.https://github.com.helper= \
    -c credential.https://github.com.helper='!gh auth git-credential' \
    -c credential.interactive=auto \
    push -u origin copilot/office-theme --follow-tags
```

- [ ] **Step 3: PR 을 연다**

`create_pull_request` 툴은 이 저장소에서 쓸 수 없다. `gh pr create` 를 쓴다.

```bash
env -u GH_TOKEN -u GITHUB_TOKEN gh pr create \
  --title "사건 테마에 사무실을 더한다" \
  --body "$(cat <<'EOF'
저택·농장에 이어 세 번째 사건 테마. 현대 IT 회사의 한 층이다.

- **방 아홉** — A존·B존·라운지·복도·창고·화장실·기계실·엘리베이터·회의실
- **바닥 넉 장** — 마루·타일은 기존 것, 코팅바닥·아크릴바닥은 새로 그렸다
- **가구 열넷** — 여섯(복사기·정수기·서버랙·세면대·엘리베이터·화이트보드)은 사무실 고유라 새로 그렸고, 나머지 여덟은 정말 같은 물건이라 기존 아이콘을 그대로 쓴다
- 건물 안쪽이 뚫린 사건에서는 그 자리가 **아트리움**이 된다

게임 규칙·솔버·생성기는 손대지 않았다. 테마는 데이터다.

`FloorKind` 를 타입 별칭에서 값 목록으로 바꿨다. 재질을 넣고 CSS 를 빠뜨리면 그 방이 조용히 기본 타일색으로 깔릴 뿐이라, 이제 재질마다 질감이 있는지 테스트가 훑는다.
EOF
)"
```

- [ ] **Step 4: CI 를 확인한다**

```bash
env -u GH_TOKEN -u GITHUB_TOKEN gh pr checks --watch
```

---

## 메모

- **머지는 squash 가 아니라 머지 커밋이다.** `v0.10.3` 태그가 브랜치의 버전 커밋을 가리키는데 squash·rebase 는 그 커밋을 다시 써서 태그를 `main` 히스토리 밖으로 떨어뜨린다.
- 생성 스윕(Task 3 Step 4)이 이 작업에서 유일하게 오래 걸리는 검사다. 기준선은 난이도당 60시드에 30·42·25·60ms 였다. 사무실이 자주 실패하면 재시도가 늘어 이 숫자가 눈에 띄게 커진다 — 그때는 방별 가구 후보를 다시 세어 본다.
- 방 이름을 10개 이상으로 늘리지 않는다. `floorplan.ts` 의 `MAX_ROOMS` 가 9라 더 넣어도 쓰이지 않는다.
