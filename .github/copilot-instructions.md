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

테스트 하나만 돌릴 때는 이름으로 거른다:

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
- `render.test.ts` 의 "CHANGELOG 에 현재 버전 항목이 있다" — 훅을 넘겨도 CI 의 `npm test` 가 막는다.

`CHANGELOG.md` 는 문서이자 화면이다. `ChangelogDialog.tsx` 가 `?raw` 로 읽어 푸터 버전 버튼을 누르면 모달로 그린다. 렌더러는 `##`/`###`/`-`/`**굵게**`/`` `코드` ``/`[링크](url)` 만 안다 — 표나 중첩 목록을 쓰면 조용히 문단으로 떨어진다.

## 커밋·푸시·PR 은 저장소 주인 계정으로

**이 저장소에 남기는 커밋·푸시·PR 은 전부 저장소 주인 계정이어야 한다.**

에이전트 환경이 주입하는 GitHub 자격증명은 **주인 계정이 아닐 수 있다.** 그러면 이렇게 터진다.

| 하려던 것 | 증상 |
|---|---|
| `git push` | 403 `Permission to ... denied` |
| `create_pull_request` 툴 | 403 `you cannot access this content` |
| `git commit` | author 가 엉뚱한 이름·주소로 조용히 들어간다 |

**커밋 신원**은 `.git/config`(워크트리 공유)에 이미 박혀 있다. 지우지 말 것. 그래도 잘못 들어갔으면 되돌린다:

```bash
git --no-pager log origin/main..HEAD --format='%h %an <%ae>'   # 먼저 확인
git rebase --exec 'git commit --amend --no-edit --reset-author' origin/main
# 태그가 걸려 있으면 git tag -d 후 git tag -a 로 다시 건다
```

**푸시·PR 은 주입된 토큰을 벗겨야 한다.** 그래야 키체인에 로그인된 주인 계정이 활성으로 잡힌다.

```bash
env -u GH_TOKEN -u GITHUB_TOKEN gh auth status    # 활성 계정이 주인인지 먼저 확인
env -u GH_TOKEN -u GITHUB_TOKEN gh pr create ...
env -u GH_TOKEN -u GITHUB_TOKEN gh pr merge <n> --merge
```

`git push` 는 환경이 명령줄로 주입한 credential 헬퍼를 그 명령에서만 비운다:

```bash
env -u GH_TOKEN -u GITHUB_TOKEN \
git -c credential.https://github.com.helper= \
    -c credential.https://github.com.helper='!gh auth git-credential' \
    -c credential.interactive=auto \
    push -u origin <branch> --follow-tags
```

**`create_pull_request` 툴은 이 저장소에서 못 쓴다.** 주입된 토큰이 고정이라 우회가 없다. `gh pr create` 를 쓸 것. `gh auth status` 가 주인 계정을 아예 모른다고 하면 사람이 `gh auth login` 을 해야 하는 시점이다 — **포크를 떠서 우회하지 말 것.** PR 작성자가 엉뚱한 계정이 된다.

**브랜치 이름에도 계정명이 새어 나간다.** 워크트리가 자동으로 짓는 이름을 그대로 쓰지 말고 `rename_branch` 로 내용에 맞는 이름을 붙일 것 — 브랜치명은 PR 메타데이터에 영구히 남고 저장소는 public 이다.

머지는 **squash 가 아니라 머지 커밋**이다. 릴리스 태그(`v0.2.0` 등)가 브랜치의 버전 커밋을 가리키는데, squash·rebase 는 그 커밋을 다시 써서 태그를 `main` 히스토리 밖으로 떨어뜨린다.

> 어느 계정이 주입되는지, 왜 권한이 없는지 같은 **구체적인 신원 정보는 저장소에 두지 않는다.** 로컬 메모는 `.github/copilot-instructions.local.md` 에 있고 gitignore 된다. 그 내용을 커밋·PR 본문·브랜치명·커밋 메시지 어디에도 옮기지 말 것.

## 구조

| 파일 | 역할 |
|---|---|
| `src/game/types.ts` | 데이터 모델, 시드 RNG(`rng`), `pick`/`shuffled` |
| `src/game/clues.ts` | `indexScene`(파생 인덱스) + `matchingCells`(규칙 판정) + `clueText`(한국어 문구) |
| `src/game/solve.ts` | 백트래킹 솔버 + 유일해 판정 |
| `src/game/floorplan.ts` | 실루엣 마스크(`MASKS`) + BSP 분할 + 방 지터 → `buildFloorplan` |
| `src/game/generate.ts` | 평면도 → 가구 → 배치 → 증언 → 유일해 검증 재시도 루프 |
| `src/data/content.ts` | 이름·가구·방 이름·사건 제목 풀 |
| `src/hooks/useGame.ts` | 게임 상태 전부. 두 셸이 나눠 쓴다 |
| `src/hooks/useMediaQuery.ts` | `MOBILE_QUERY` + 미디어 쿼리 구독 (셸 선택) |
| `src/App.tsx` | 데스크톱 셸 + 모바일/데스크톱 갈림길 |
| `src/components/MobileShell.tsx` | 모바일 셸 — 한 화면 레이아웃 + 바텀시트 3종(사건·지목·메뉴) |
| `src/components/ClueList.tsx` | 증언 목록 겸 메모 브러시 (두 셸 공용) |
| `src/components/Sheet.tsx` | 바텀시트(모바일)·가운데 모달(`modal` 변형, 데스크톱) `<dialog>` 래퍼 |
| `src/components/Board.tsx` | 격자·방 경계·가구·벽 부착물·메모 렌더 |
| `src/components/Art.tsx` | 스프라이트 `<defs>` + `<Art>` (이모지/이미지/아이콘 하나로) |
| `src/components/YardPet.tsx` | 안뜰(갇힌 빈 칸)을 돌아다니는 짐승 — 그림 + 투명한 판 |
| `src/components/yardWalk.ts` | 안뜰 짐승의 걸음 규칙 (순수 함수) |
| `src/components/CaseCards.tsx` | 용의자·피해자 카드 그리드 (두 셸 공용) |
| `src/components/GamePanels.tsx` | 규칙·범례·브러시바·지목·시드 패널 (두 셸 공용). 규칙·범례는 사건 브리핑 안에만 있다 |
| `src/components/ChangelogDialog.tsx` | `CHANGELOG.md` 를 읽어 모달로 그린다 (마크다운 부분집합 렌더러) |
| `src/components/HistoryPanel.tsx` | 기록 목록 + 계정(로그인/가입) + 복구 키 패널 |
| `src/game/auth.ts` | 계정 — 아이디/`dk`/닉네임 검증(워커와 공용) + 브라우저 PBKDF2 |
| `src/index.css` | `@import` 진입점. 실제 규칙은 `src/styles/*.css` (플레인 CSS, 프레임워크 없음) |

### 셸이 둘이다

`App.tsx` 가 `useMediaQuery(MOBILE_QUERY)` 로 데스크톱 셸과 `MobileShell` 중 하나를 고른다. **상태(`useGame`)와 패널 컴포넌트는 둘이 함께 쓴다** — 마크업을 복제하면 두 화면이 갈라진다. 상태를 셸 안으로 내리면 창 크기를 바꿀 때 메모가 날아간다.

모바일은 **스크롤이 없다.** 붙박이는 상단바·보드·증언 목록(= 메모 브러시)·하단 액션바 넷뿐이고 나머지는 전부 시트로 들어간다. 새 UI 를 모바일 메인 화면에 붙이려면 그만큼 보드가 작아진다는 뜻이다 — 시트를 먼저 고려할 것.

데스크톱도 **한 화면**이다. `.app { height: 100dvh }` 이고 `.play` 가 `증언(=브러시) | 보드 | 지목` 세 열이다. 넘치는 몫은 페이지가 아니라 열(`.dclues` / `.side`) 안에서 스크롤한다. 여기서 쉽게 깨지는 것 셋:

- `.play { grid-template-rows: minmax(0, 1fr) }` 를 빼면 auto 행이 내용만큼 커져서 열이 푸터를 뚫고 나간다.
- `.play { align-items: stretch }` 를 `start` 로 바꾸면 가운데 열 높이가 내용에 맞춰지고 `.pboard { container-type: size }` 가 0 이 되어 보드가 사라진다.
- 양옆 열 폭은 `clamp(200px, 22vw, 310px)` 다. 고정 px 로 두면 좁은 창에서 양옆이 자리를 먼저 챙겨가고 가운데 보드만 쪼그라든다(900px 창에서 보드가 240px 이었다).

늘 필요하지 않은 것(사건 브리핑·규칙·가구 범례·시드·기록·계정·피드백)은 모달로 내린다 — 모바일 시트와 같은 `Sheet` 에 `modal` 만 붙인다. 데스크톱 메인 화면에 패널을 하나 더 붙이려면 그만큼 보드가 작아진다.

`src/hooks/useMediaQuery.ts` 의 `MOBILE_QUERY` 와 `src/styles/mobile.css` 의 미디어 쿼리는 **글자까지 같아야 한다**. 어긋나면 마크업은 모바일인데 스타일은 데스크톱이 된다. `mobile.test.ts` 가 일치를 검사한다.

### 생성 파이프라인

`generatePuzzle(n, seed)` 는 성공할 때까지 되던지는 3중 루프다 — 평면도 300회 × 배치 20회 × 증언 60회.

```
buildFloorplan(마스크 → BSP → void 빼기 → 조각 흡수 → 지터)
  → placeFurniture → placeWallItems → indexScene
  → randomPlacement → 피해자 칸 선택 → trueStatements → 증언 뽑기
  → solve(limit=2) 로 유일해 확인 → 실패하면 다음 시도
```

실패 시 그냥 다음 후보로 넘어가므로, 제약을 잘못 넣으면 **조용히 재시도만 하다가 끝에서 throw** 한다. 새 제약을 넣었으면 네 난이도(4·5·6·7) 전부 실제로 생성되는지 확인할 것.

**마스크는 재시도 루프 *안*에서 뽑는다.** 테마는 밖에서 시드로 한 번만 정하지만, 마스크는 그 평면도가 실패하면 다른 걸 뽑아야 한다 — 감당 안 되는 마스크는 조용히 걸러진다. `buildFloorplan` 이 `null` 을 돌려주면 다음 sceneTry 다.

### 규칙을 바꿀 때 손대야 하는 곳

퍼즐 규칙은 네 군데가 서로 맞아야 한다. 하나만 고치면 플레이어가 푼 답과 엔진의 답이 갈린다.

1. `clues.ts` `matchingCells` — 증언 판정의 **유일한 출처**. 솔버·생성기·테스트가 전부 이 함수를 부른다. 판정 로직을 다른 데 복제하지 말 것.
2. `solve.ts` — 배치 제약(행/열 비트마스크, 방마다 용의자 1명, 피해자 방에 용의자 정확히 1명). 여기 없는 규칙은 유일해 판정에 반영되지 않는다.
3. `generate.ts` `randomPlacement` — 같은 제약을 만족하는 정답 배치를 만든다. 솔버에만 넣으면 해가 0개가 되어 생성이 실패한다.
4. `GamePanels.tsx` 의 `RulesPanel` + `README.md` — 플레이어에게 보여주는 규칙.

### 기하학적 함정

방마다 용의자 1명 제약 때문에 **방 개수가 인원수를 감당해야 한다**. 4×4를 늘 2×2 사분면으로 자르면 인원이 `2,2` 로만 갈려서 범인 방을 만들 수 없다. 그래서 `splitRect` 는 8칸짜리 사각형을 확률적으로 안 쪼갠다(→ 4×2 + 2×2 + 2×2 평면도). 이 랜덤 정지를 "정리"하면 쉬움 난이도가 영구히 생성 실패한다.

**실루엣 마스크는 행·열 완전 매칭을 깰 수 있다.** 인물은 행마다 하나·열마다 하나씩 서므로, 남은 칸으로 그 매칭이 안 되면 배치가 **원천 불가**다. 7×7에서 네 모서리 2×2를 다 파면(`十`) 0·1·5·6행이 남은 3개 열을 놓고 싸워 매칭이 없다 — 생성기는 에러 없이 재시도만 하다 끝에서 throw 한다. `floorplan.test.ts` 가 모든 `(마스크, n)` 조합에 대해 이분 매칭을 직접 돌려 이걸 막는다. **마스크를 추가하면 그 테스트가 자동으로 검사한다** (`MASKS` 를 순회하므로 테스트에 손댈 필요 없다).

`donut`(안뜰)은 격자 테두리에 닿으면 안 된다. 닿는 순간 `classifyVoids` 의 flood fill 이 `outer` 로 판정해 안뜰이 아니라 그냥 ㄱ자가 된다.

### 렌더링

- **선은 전부 칸이 그린다. `.board` 에는 테두리도 바탕도 없다.** 굵기 위계는 **외벽 5px > 방 경계 3px > 칸 선 1px > 실루엣 밖 0**. `Board.tsx` 가 이웃 칸의 `roomAt` 을 비교해 정한다 — 격자 밖과 빈 칸을 똑같이 `-1` 로 보는 게 요령이다.
  - **외벽만 방 칸이 네 변을 다 그린다.** 반대편이 빈 칸이라 선을 나눠 그릴 상대가 없어서다. 방↔방·같은 방 선은 위·왼쪽만 그리고 나머지 절반은 이웃이 그린다.
  - `.board` 에 사각 테두리를 되돌리면 **ㄱ자 건물에도 정사각형 액자가 남는다** — 실루엣이 도형이 아니라 여백처럼 읽힌다. 같은 이유로 `.cell.void.outer` 는 `--floor-tint: transparent` 라 그 자리에 종이가 비친다. `board.test.ts` 의 `가장 굵은 선이 건물 실루엣을 따라간다` 가 칸마다 "5px ⟺ 이웃이 건물이 아니다"를 검사한다.
- **실루엣 밖 칸은 `<button>` 이 아니라 `<div class="cell void ...">` 다.** 누를 수도 포커스할 수도 없어야 한다. `roomById.get(roomAt[r][c])!` 앞에서 갈라야 한다 — void 는 `-1` 이라 그대로 두면 `undefined` 에서 터진다. 갇힌 칸(`inner`)만 테마 `courtyard` 의 바닥·그림·이름을 받고, 바깥(`outer`)은 그냥 빈 땅이다.
- 2칸 가구는 `cells[0]` 에서 한 번만 그리고 `width/height: 200%` 로 옆 칸을 덮는다.
- **창문·문은 외벽을 타고 앉는다.** 절대 위치 부착물이라 칸을 막지 않고(`pointer-events: none`), `~앞` 은 그 칸을 뜻한다. 자리는 `.wall-item.<side>` 의 `-5px` — 절대배치 자식의 `top/left` 는 padding box 기준이라 그 값이 정확히 5px 외벽의 바깥 모서리다. **`Board.tsx` 의 외벽 두께를 바꾸면 `wall.css` 도 같이 바꿔야 한다** (`board.test.ts` 가 둘을 맞춘다). 예전처럼 칸 안쪽에 띄워 붙이면 6×6 부터 안 보인다.
- **벽 부착물에는 이름표를 단다** (`.wall-label`). 증언이 `창문 앞` 처럼 이름을 부르는데 그림만으로는 문과 창문이 안 갈린다. 모양은 방 이름 알약이 아니라 **가구 이름표와 같다** — 증언이 부르는 지형지물끼리 같게 보이는 게 맞다. 대신 `Board.tsx` 가 방 이름표를 벽 부착물이 없는 칸으로 비켜준다 (안 그러면 넷 중 하나꼴로 같은 모서리에서 겹친다).
- 가구 타일에는 이모지와 한국어 라벨을 **함께** 그린다. 증언이 가구 이름을 부르기 때문에 이름 없이는 매칭이 안 된다.
- **격자 열 수는 CSS 변수로 넘기지 않는다.** `Board.tsx` 가 인라인 `grid-template-columns: repeat(n, minmax(0, 1fr))` 로 직접 박는다. `repeat(var(--n), 1fr)` 로 되돌리면 Safari 에서 보드가 잘린다(아래 참조). `repo.test.ts` 가 CSS 전체에서 `repeat(var(` 를 금지한다.
- **보드 안의 글자·아이콘 크기는 `vw` 가 아니라 `cqw` 로 잰다.** `.board { container-type: inline-size }` 가 기준이다. 모바일에서 보드는 **높이**에 맞춰 줄어드는데, `vw` 기준이면 글리프만 안 줄어 칸을 넘친다.
- 모바일에서 보드는 `min(100cqw, 100cqh)` 로 남는 공간의 짧은 변에 맞춘다. 행은 `grid-auto-rows: minmax(0, 1fr)` — 데스크톱은 그대로 `.cell { aspect-ratio: 1 }` 이 정한다.

### 안뜰의 주인

안뜰(`voidKind === 'inner'`)에는 짐승이 산다 — 저택은 고양이, 농장은 오리. 못 누르는 칸이라는 걸 글자보다 먼저 몸으로 말하게 하려는 것이다. `YardPet.tsx` 가 `.board` 안에 **두 겹**을 절대배치로 얹는다.

- `.yard-pet` — 칸 하나 크기의 그림. `pointer-events: none`, `z-index: 3`(안뜰 이름표 4 아래).
- `.yard-plate` — 안뜰 bounding box 를 덮는 투명한 판. `z-index: 5`. 포인터는 전부 여기가 받는다.

쉽게 깨지는 것들.

- **판이 안뜰 밖으로 새면 진짜 칸의 클릭을 먹는다.** bounding box 에 섞인 비-안뜰 칸은 `.yard-gap`(`pointer-events: none`)으로 덮는다. `yard.test.ts` 가 ㄱ자 안뜰로 검사한다.
- **좌표·트랙 수는 전부 JS 에서 문자열을 완성해 인라인으로 넘긴다.** `calc(var())` 는 Safari 가 캐싱한다(webkit#202259). `.yard-pet` 이 정확히 한 칸 크기라 `translate: ${c*100}% ${r*100}%` 가 칸에 정확히 떨어진다.
- **상태는 `YardPet` 안에 둔다.** `Board` 로 올리면 걸음마다(1~3초) 보드 전체가 다시 그려진다. `cells` 는 렌더마다 새 배열이라 `useEffect` deps 에 그대로 넣으면 메모를 찍을 때마다 산책이 멈춘다 — 좌표를 이어붙인 `yardKey` 를 쓴다.
- 산책은 `rng(\`${seed}-pet\`)` 을 탄다. **같은 사건 = 같은 산책.** `prefers-reduced-motion` 이면 타이머를 아예 안 건다.
- 테마를 늘리면 `courtyard.pet` 과 `sprite.svg` 의 `i-<kind>` · `i-<kind>-sit` 을 같이 넣어야 한다. `yard.test.ts` 가 강제한다.
- 안뜰은 **4×4 에서 안 나온다**(`donut.minN = 5`). 안뜰이 격자당 한 덩어리·직사각형이라는 전제는 `donut` 마스크가 유일한 출처다 — 갇힌 덩어리를 둘 이상 만드는 마스크를 넣으면 `Board.tsx` 의 이름표와 이 판이 같이 깨진다.

### 바텀시트

`Sheet.tsx` 는 네이티브 `<dialog>` 다. 두 가지가 쉽게 깨진다.

- **`.sheet` 에 `display` 를 무조건 주면 안 된다.** 브라우저 기본 `dialog:not([open]) { display: none }` 을 덮어써서 닫힌 시트가 화면에 그대로 쌓인다(실제로 겪었다 — 페이지가 1494px 로 늘어났다). `display` 는 `:not([open])` 에서 `none` 으로 되돌리고, `transition` 에 `display ... allow-discrete` 를 넣어 퇴장 모션을 살린다.
- 열 때 포커스를 `.sheet-body` 로 직접 옮긴다. 그냥 두면 닫기 버튼이 첫 포커스라 열자마자 빨간 `focus-visible` 링이 뜬다. React 의 `autoFocus` 는 마운트 시점에 `focus()` 를 부르는 거라 여기선 안 먹는다.

### Safari 함정

**Chromium 에서 멀쩡한 레이아웃 버그는 대부분 Safari 전용이다. Chromium 으로 "재현 안 됨"을 확인했다고 없는 문제로 넘기지 말 것.**

실제로 겪은 것 — `repeat(var(--n), 1fr)`: WebKit 은 `repeat()` 안의 `var()` 를 computed-value 시점에 한 번 펼쳐 캐싱한다([webkit#202259](https://bugs.webkit.org/show_bug.cgi?id=202259)). 난이도를 바꿨다 되돌아오면 트랙 *개수*만 갱신되고 *폭*은 옛 값이라 6×6 이 4열 폭으로 깔리고 `.board { overflow: hidden }` 이 넘친 열을 잘라 4×6 처럼 보였다. 첫 진입에는 멀쩡하고 왕복해야 터져서 "종종" 나는 것처럼 보인다. 값이 바뀌는 곳에 `var()` 를 `repeat()`·`calc()` 안쪽으로 넣지 말고 인라인 스타일로 계산해서 넘길 것.

Safari 를 실측하는 법 — **환경마다 되는 경로가 다르다. 아래를 위에서부터 시도할 것.**

1. **Playwright 의 `webkit`** (2026-07 기준 이 저장소에서 실제로 통한 경로). Playwright MCP 는 막히지만 라이브러리는 쓸 수 있다. 저장소에 의존성을 넣지 말고 `/tmp` 에 따로 설치한다:
   `mkdir -p /tmp/pw && cd /tmp/pw && npm init -y && npm i playwright && npx playwright install webkit chromium`
   `hasTouch: true` 를 줘야 `pointer: coarse` 미디어 쿼리가 맞는다. 진짜 Safari 는 아니지만 같은 WebKit 엔진이다.
2. `osascript -l JavaScript` 로 `WKWebView` 를 직접 띄우기 (시스템 WebKit = 진짜 Safari 엔진). **2026-07 시도에서는 콘텐츠 프로세스가 안 떠서 `estimatedProgress` 가 0.1 에서 멈췄다** — 되면 가장 정확하지만 안 될 수 있다.
   - **WKWebView 를 `NSWindow` 에 넣어야 한다.** 화면 밖 webview 는 `setTimeout` 이 아예 안 돌아서 어떤 측정 스크립트도 조용히 멈춘다.
   - 결과는 `document.title` 에 JSON 을 넣고 JXA 쪽에서 런루프를 돌리며 `wv.title` 을 폴링해 꺼낸다. `evaluateJavaScript` 는 JXA 블록 브리지에서 터진다.

무엇으로 재든 판정 기준은 같다:

- 잘림은 `scrollWidth > clientWidth` 로 본다. `overflow: hidden` 때문에 눈으로는 그냥 열이 적어 보인다.
- 모바일 무스크롤은 `document.scrollingElement.scrollHeight <= clientHeight` 로 본다. `html { overflow: hidden }` 이면 스크롤은 안 되지만 넘치는 건 그대로 넘친다.
- 난이도 4↔6 을 **왕복**한 뒤 다시 잰다. webkit#202259 는 첫 진입에는 안 터진다.

## 규약

- **파일은 500줄을 넘기지 않는다.** 넘을 것 같으면 **컴포넌트 관점으로** 쪼갠다 — 화면의 한 덩어리(패널·모달·보드)가 자기 상태와 마크업을 같이 들고 `src/components/` 로 나간다. 줄 수를 맞추려고 아무 데나 자르는 건 더 나쁘다. 경계가 안 보이면 쪼개지 말고 그대로 두되, 그 이유를 남긴다.
  - 스타일은 `src/index.css` 가 `@import` 목록이고 실제 규칙은 `src/styles/<컴포넌트>.css` 에 있다. **import 순서가 곧 캐스케이드 순서**라 아무 데나 넣으면 안 된다.
  - 테스트도 대상별로 나눠 둔다(아래 참고).
- **결정성**: 게임 로직에서 `Math.random()` 을 부르지 않는다. `rng(seed)` 가 만든 `rand` 를 인자로 넘긴다. 같은 시드 = 같은 사건이 유일한 저장 수단이다. (새 시드 문자열을 만드는 `useGame.ts` 만 예외)
- **가구 종류는 퍼즐당 한 번**: "탁자 옆"이 모호해지지 않게 `placeFurniture` 가 덱에서 빼서 쓴다. 가구·벽부착물·방 이름이 유일한지 테스트가 검사한다.
- **가구는 방 이름과 맞아야 한다**: `FurnitureSpec.rooms` 가 허용 방 이름 목록이다(없으면 아무 방이나 — 러그·화분·스탠드). `placeFurniture` 는 선택지가 적은 방부터, 각 방에서는 전용 가구부터 집고, **모든 방에 최소 1개**를 못 채우면 `null` 을 돌려 평면도를 다시 뽑게 한다. 방 이름을 늘리면 그 이름을 쓸 가구도 같이 넣을 것 — 안 그러면 그 방은 범용 가구 3종만 놓고 생성 실패율이 오른다.
- **증언 문구는 `clueText` 에서만** 만든다. 문자열을 다른 데서 조립하지 않는다.
- **`ponytail:` 주석**은 의도적으로 단순하게 둔 지점과 그 한계·업그레이드 경로를 적어둔 것이다. 지우지 말고, 한계에 부딪히면 그때 올린다.
- **그림 에셋**: `Person`/`Furniture`/`WallItem` 의 `image?` 에 경로를 넣으면 `<Art>` 가 이모지 대신 이미지를 그린다. 콘텐츠 추가는 `content.ts` 만 고치면 된다.
- **의존성 추가는 기본적으로 하지 않는다.** 솔버는 라이브러리 없는 백트래킹이고 스타일도 플레인 CSS다.

### 테스트

검사 대상별로 나눠 둔다. **새 규칙은 대응하는 파일의 불변식으로 추가한다.**

| 파일 | 검사 |
|---|---|
| `src/game/generate.test.ts` | 여러 시드에서 유일해·행/열·방 제약·증언 정합 |
| `src/game/floorplan.test.ts` | 마스크별 행·열 완전 매칭 존재 · void 비율 · 건물 연결성 · 결정성 |
| `src/game/clues.test.ts` | `matchingCells` 판정 (ON·NEXT_TO·IN_ROOM·FROM_ROOM) |
| `src/game/history.test.ts` | 기록 검증·병합·점수 + 동기화 워커 라우트 |
| `src/game/rank.test.ts` | 순위표 — 워커 라우트·닉네임·`rankDrop` + 점수판/토스트/점 렌더 |
| `src/game/auth.test.ts` | 계정 검증·워커 라우트·로그인 UI |
| `src/components/board.test.ts` | 보드 렌더링 — 칸·가구·실루엣·벽 부착물 + `board.css`/`wall.css` 불변식 |
| `src/components/render.test.ts` | 앱(데스크톱 셸)·모달·온보딩·점수판 렌더링 |
| `src/components/yard.test.ts` | 안뜰 짐승 — 걸음 규칙·판 범위·테마별 그림 + `yard.css` 불변식 |
| `src/components/mobile.test.ts` | 모바일 셸·증언 목록·시트 + `mobile.css` 불변식 |
| `src/repo.test.ts` | 500줄 규약 + CSS 전역 금지 패턴(`repeat(var(`) |

렌더링은 jsdom 없이 `react-dom/server` 의 `renderToStaticMarkup` 으로 HTML 문자열을 확인한다. **문자열이 아니라 마크업으로 단언할 것** — 버전 기록 모달이 `CHANGELOG.md` 를 그대로 그려서 UI 문구를 인용하면 거짓 양성이 난다.

`App` 은 `matchMedia` 가 없는 환경(테스트)에서 **데스크톱 셸**을 그린다(`useMediaQuery` 의 fallback). 모바일 셸은 `MobileShell` 을 직접 그려서 검사한다.

스타일 원문을 읽는 테스트는 `vite.config.ts` 의 `test: { css: true }` 에 기대고 있다. Vitest 기본값(`css: false`)은 CSS 를 빈 스텁으로 바꿔서 `?raw` 까지 빈 문자열이 되고, **검사가 조용히 아무것도 안 하게 된다**. `repo.test.ts` 가 그 구멍을 직접 막는다.

### 스타일

`src/index.css` 는 `@import` 목록이고 규칙은 `src/styles/<컴포넌트>.css` 에 있다. Vite 가 빌드 때 그 순서대로 인라인하므로 **import 순서 = 캐스케이드 순서**다. 컴포넌트를 추가하면 파일을 만들고 진입점에 한 줄 넣는다. `mobile.css` 는 데스크톱 규칙을 덮어야 하므로 늦게, `motion.css`(`prefers-reduced-motion`)는 전부를 덮어야 하므로 **맨 마지막**이다. 보드는 셋으로 갈려 있다 — `board.css`(칸·방·가구) → `wall.css`(창문·문) → `yard.css`(안뜰의 주인). 뒤의 둘은 `.cell`·`.board` 안에 얹히므로 이 순서를 지켜야 한다.

지켜온 것들: 동심 반경(바깥 = 안쪽 + 패딩), 컨트롤 최소 40px 히트영역, `focus-visible` 링, `prefers-reduced-motion` 대응, 한국어 `word-break: keep-all`, `transition` 은 속성을 명시(`all` 금지). 두꺼운 잉크 테두리 + `4px 4px 0` 하드 섀도가 이 UI의 디자인 언어다.

전역 클래스(`.chip`·`.link`·`.ver`)를 **부모 선택자로 묶지 말 것**. `.footer .ver` 로 묶여 있던 탓에 같은 버튼이 모바일 메뉴 시트에서는 스타일이 통째로 빠져 브라우저 기본 버튼으로 나왔다.
