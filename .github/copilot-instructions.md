# murdoku

Murder + Sudoku. 증언을 조합해 평면도 위 인물 자리를 확정하고 **피해자와 같은 방에 있던 용의자 = 범인**을 지목하는 추리 퍼즐. React 19 + Vite + TypeScript, 전부 클라이언트에서 돈다.

UI 문자열·주석은 한국어로 쓴다.

## 명령

```bash
npm install
npm run dev                 # 개발 서버
npm test                    # vitest run (전체)
npm run lint                # oxlint
npm run build               # tsc -b && vite build
```

테스트 하나만 돌릴 때는 이름으로 거른다 (파일이 `src/game/game.test.ts` 하나뿐):

```bash
npx vitest run -t "해가 정확히"       # describe/it 이름 부분 일치
npx vitest run -t "Board"
```

`package-lock.json` 과 `pnpm-lock.yaml` 이 둘 다 있다. README 기준은 npm.

## 버전

버전은 `package.json` 한 곳에만 있다. `vite.config.ts` 의 `define` 이 그걸 `import.meta.env.VITE_APP_VERSION` 으로 심고, 푸터의 버전 버튼이 그 값을 찍는다(배포된 빌드가 자기 버전을 말하게 하려고). 버전 문자열을 다른 파일에 복제하지 말 것.

릴리스 절차 — **`main` 푸시는 버전을 올려야만 통과한다.**

```bash
# 1. CHANGELOG.md 맨 위에 "## v<새 버전> — <YYYY-MM-DD>" 를 쓰고 변경 내용과 함께 커밋
# 2. 버전 범프 (커밋과 태그는 npm 이 만든다)
npm version patch      # 또는 minor / major
git push --follow-tags
```

강제는 두 겹이다.

- `.githooks/pre-push` — `main` 으로 가는 푸시에서 `origin/main` 대비 버전이 올랐는지, `CHANGELOG.md` 에 그 버전 항목이 있는지 본다. `npm install` 의 `prepare` 가 `core.hooksPath` 를 여기로 맞춘다. `--no-verify` 로 넘길 수 있다.
- `game.test.ts` 의 "CHANGELOG 에 현재 버전 항목이 있다" — 훅을 넘겨도 CI 의 `npm test` 가 막는다.

`CHANGELOG.md` 는 문서이자 화면이다. `ChangelogDialog.tsx` 가 `?raw` 로 읽어 푸터 버전 버튼을 누르면 모달로 그린다. 렌더러는 `##`/`###`/`-`/`**굵게**`/`` `코드` ``/`[링크](url)` 만 안다 — 표나 중첩 목록을 쓰면 조용히 문단으로 떨어진다.

## 구조

| 파일 | 역할 |
|---|---|
| `src/game/types.ts` | 데이터 모델, 시드 RNG(`rng`), `pick`/`shuffled` |
| `src/game/clues.ts` | `indexScene`(파생 인덱스) + `matchingCells`(규칙 판정) + `clueText`(한국어 문구) |
| `src/game/solve.ts` | 백트래킹 솔버 + 유일해 판정 |
| `src/game/generate.ts` | BSP 평면도 → 가구 → 배치 → 증언 → 유일해 검증 재시도 루프 |
| `src/data/content.ts` | 이름·가구·방 이름·사건 제목 풀 |
| `src/components/Board.tsx` | 격자·방 경계·가구·메모 렌더 |
| `src/components/ChangelogDialog.tsx` | `CHANGELOG.md` 를 읽어 모달로 그린다 (마크다운 부분집합 렌더러) |
| `src/index.css` | 전체 스타일 (플레인 CSS + 커스텀 프로퍼티, 프레임워크 없음) |

### 생성 파이프라인

`generatePuzzle(n, seed)` 는 성공할 때까지 되던지는 3중 루프다 — 평면도 300회 × 배치 20회 × 증언 60회.

```
buildRooms(BSP) → placeFurniture → placeWallItems → indexScene
  → randomPlacement → 피해자 칸 선택 → trueStatements → 증언 뽑기
  → solve(limit=2) 로 유일해 확인 → 실패하면 다음 시도
```

실패 시 그냥 다음 후보로 넘어가므로, 제약을 잘못 넣으면 **조용히 재시도만 하다가 끝에서 throw** 한다. 새 제약을 넣었으면 세 난이도(4·5·6) 전부 실제로 생성되는지 확인할 것.

### 규칙을 바꿀 때 손대야 하는 곳

퍼즐 규칙은 네 군데가 서로 맞아야 한다. 하나만 고치면 플레이어가 푼 답과 엔진의 답이 갈린다.

1. `clues.ts` `matchingCells` — 증언 판정의 **유일한 출처**. 솔버·생성기·테스트가 전부 이 함수를 부른다. 판정 로직을 다른 데 복제하지 말 것.
2. `solve.ts` — 배치 제약(행/열 비트마스크, 방마다 용의자 1명, 피해자 방에 용의자 정확히 1명). 여기 없는 규칙은 유일해 판정에 반영되지 않는다.
3. `generate.ts` `randomPlacement` — 같은 제약을 만족하는 정답 배치를 만든다. 솔버에만 넣으면 해가 0개가 되어 생성이 실패한다.
4. `App.tsx` 의 `기본 정보` 패널 + `README.md` — 플레이어에게 보여주는 규칙.

### 기하학적 함정

방마다 용의자 1명 제약 때문에 **방 개수가 인원수를 감당해야 한다**. 4×4를 늘 2×2 사분면으로 자르면 인원이 `2,2` 로만 갈려서 범인 방을 만들 수 없다. 그래서 `splitRect` 는 8칸짜리 사각형을 확률적으로 안 쪼갠다(→ 4×2 + 2×2 + 2×2 평면도). 이 랜덤 정지를 "정리"하면 쉬움 난이도가 영구히 생성 실패한다.

### 렌더링

- 방 경계는 `Board.tsx` 가 이웃 칸의 `roomAt` 을 비교해 테두리 굵기로 그린다 (3px = 방 경계, 1px = 칸 선).
- 2칸 가구는 `cells[0]` 에서 한 번만 그리고 `width/height: 200%` 로 옆 칸을 덮는다.
- 창문·문은 절대 위치 부착물이라 칸을 막지 않는다. `~앞` 은 그 칸을 뜻한다.
- 가구 타일에는 이모지와 한국어 라벨을 **함께** 그린다. 증언이 가구 이름을 부르기 때문에 이름 없이는 매칭이 안 된다.
- **격자 열 수는 CSS 변수로 넘기지 않는다.** `Board.tsx` 가 인라인 `grid-template-columns: repeat(n, minmax(0, 1fr))` 로 직접 박는다. `repeat(var(--n), 1fr)` 로 되돌리면 Safari 에서 보드가 잘린다(아래 참조).

### Safari 함정

**Chromium 에서 멀쩡한 레이아웃 버그는 대부분 Safari 전용이다. Chromium 으로 "재현 안 됨"을 확인했다고 없는 문제로 넘기지 말 것.**

실제로 겪은 것 — `repeat(var(--n), 1fr)`: WebKit 은 `repeat()` 안의 `var()` 를 computed-value 시점에 한 번 펼쳐 캐싱한다([webkit#202259](https://bugs.webkit.org/show_bug.cgi?id=202259)). 난이도를 바꿨다 되돌아오면 트랙 *개수*만 갱신되고 *폭*은 옛 값이라 6×6 이 4열 폭으로 깔리고 `.board { overflow: hidden }` 이 넘친 열을 잘라 4×6 처럼 보였다. 첫 진입에는 멀쩡하고 왕복해야 터져서 "종종" 나는 것처럼 보인다. 값이 바뀌는 곳에 `var()` 를 `repeat()`·`calc()` 안쪽으로 넣지 말고 인라인 스타일로 계산해서 넘길 것.

Safari 를 실측하는 법 (이 저장소에서 실제로 통한 유일한 경로):

- Playwright MCP·`safaridriver` 는 이 환경에서 막힌다. `osascript -l JavaScript` 로 `WKWebView` 를 직접 띄우면 된다 (시스템 WebKit = 진짜 Safari 엔진).
- **WKWebView 를 `NSWindow` 에 넣어야 한다.** 화면 밖 webview 는 `setTimeout` 이 아예 안 돌아서 어떤 측정 스크립트도 조용히 멈춘다.
- 결과는 `document.title` 에 JSON 을 넣고 JXA 쪽에서 런루프를 돌리며 `wv.title` 을 폴링해 꺼낸다. `evaluateJavaScript` 는 JXA 블록 브리지에서 터진다.
- 잘림 판정은 `scrollWidth > clientWidth` 로 본다. `overflow: hidden` 때문에 눈으로는 그냥 열이 적어 보인다.

## 규약

- **결정성**: 게임 로직에서 `Math.random()` 을 부르지 않는다. `rng(seed)` 가 만든 `rand` 를 인자로 넘긴다. 같은 시드 = 같은 사건이 유일한 저장 수단이다. (새 시드 문자열을 만드는 `App.tsx` 만 예외)
- **가구 종류는 퍼즐당 한 번**: "탁자 옆"이 모호해지지 않게 `placeFurniture` 가 덱에서 빼서 쓴다. 가구·벽부착물·방 이름이 유일한지 테스트가 검사한다.
- **가구는 방 이름과 맞아야 한다**: `FurnitureSpec.rooms` 가 허용 방 이름 목록이다(없으면 아무 방이나 — 러그·화분·스탠드). `placeFurniture` 는 선택지가 적은 방부터, 각 방에서는 전용 가구부터 집고, **모든 방에 최소 1개**를 못 채우면 `null` 을 돌려 평면도를 다시 뽑게 한다. 방 이름을 늘리면 그 이름을 쓸 가구도 같이 넣을 것 — 안 그러면 그 방은 범용 가구 3종만 놓고 생성 실패율이 오른다.
- **증언 문구는 `clueText` 에서만** 만든다. 문자열을 다른 데서 조립하지 않는다.
- **`ponytail:` 주석**은 의도적으로 단순하게 둔 지점과 그 한계·업그레이드 경로를 적어둔 것이다. 지우지 말고, 한계에 부딪히면 그때 올린다.
- **그림 에셋**: `Person`/`Furniture`/`WallItem` 의 `image?` 에 경로를 넣으면 `<Art>` 가 이모지 대신 이미지를 그린다. 콘텐츠 추가는 `content.ts` 만 고치면 된다.
- **의존성 추가는 기본적으로 하지 않는다.** 솔버는 라이브러리 없는 백트래킹이고 스타일도 플레인 CSS다.

### 테스트

`src/game/game.test.ts` 한 파일에 다 있다. 엔진 불변식(여러 시드로 유일해·행/열·방 제약·증언 정합)과 보드 렌더링을 검사하고, 렌더링은 jsdom 없이 `react-dom/server` 의 `renderToStaticMarkup` 으로 HTML 문자열을 확인한다. 새 규칙을 넣으면 여기 불변식으로 추가한다.

### 스타일

`src/index.css` 하나. 지켜온 것들: 동심 반경(바깥 = 안쪽 + 패딩), 컨트롤 최소 40px 히트영역, `focus-visible` 링, `prefers-reduced-motion` 대응, 한국어 `word-break: keep-all`, `transition` 은 속성을 명시(`all` 금지). 두꺼운 잉크 테두리 + `4px 4px 0` 하드 섀도가 이 UI의 디자인 언어다.
