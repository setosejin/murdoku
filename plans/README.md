# 애니메이션 개선 계획

`improve-animations` 감사(2025, 커밋 `a1516a1` 기준)에서 나온 계획들. 각 문서는 **자립적**이다 — 이 README 를 안 읽어도 실행할 수 있게 파일 경로·현재 코드·정확한 값이 전부 안에 들어 있다.

## 계획

| # | 제목 | 심각도 | 분류 | 범위 | 상태 |
|---|---|---|---|---|---|
| [001](001-motion-tokens-and-press-feedback.md) | 모션 토큰을 만들고 누름 피드백을 하나로 합친다 | LOW | 7 응집 / 2 이징 | `index.css` | **DONE** `1a2b43b` |
| [002](002-verdict-retrigger.md) | 같은 오답을 다시 지목해도 판정이 다시 뜨게 한다 | **HIGH** | 4 상호중단성 | `App.tsx` | **DONE** `3088fde` |
| [003](003-denied-cell-retrigger.md) | 같은 가구 칸을 다시 눌러도 거절 피드백이 다시 재생되게 한다 | **HIGH** | 4 상호중단성 | `Board.tsx`, `index.css` | **DONE** `771cf73` |
| [004](004-hover-gating-and-reduced-motion.md) | 터치에서 hover 가 눌러붙는 문제와 과잉 reduced-motion 을 고친다 | MEDIUM | 6 접근성 | `index.css` | **DONE** `4d5708c` |
| [005](005-modal-and-toast-transitions.md) | 피드백 모달과 거절 토스트에 등장·퇴장 모션을 넣는다 | MEDIUM | 8 누락 / 3 물리성 | `index.css` | **DONE** `8b32988` |

**계획 5건 모두 완료.** 감사에서 나온 발견 8건이 전부 반영됐다.

## 004·005 실행 결과 (완료)

두 계획은 같은 `@media (prefers-reduced-motion: reduce)` 블록을 만지므로 **순차로** 실행했다(병렬 금지 사유가 그것). worktree 격리는 쓰지 않았다 — 동시 편집이 없으면 필요 없다.

검증은 lint·build·test(19개) 통과에 더해 Playwright 로 실측했다:

| 확인 | 수정 전 | 수정 후 |
|---|---|---|
| 모달 열기 → 전환 이벤트 | **0건** | `opacity` + `transform` + `::backdrop background-color` |
| 열기 40ms 시점 중간값 | — | `opacity 0.588`, `scale 0.9835` (실제로 보간 중) |
| 모달 닫기 → 전환 이벤트 | 즉시 사라짐 | `display` · `overlay` 포함 5종 → `allow-discrete` 작동 |
| 닫기 40ms 시점 | — | `open=false` 인데 `opacity 0.30` 으로 아직 화면에 (퇴장 재생 중) |
| 데스크톱 hover 시 칩 | `translateY(-1px)` | **그대로** `matrix(1,0,0,1,0,-1)` |
| `.chip:hover` 규칙 위치 | 전역 | `@media (hover: hover) and (pointer: fine)` **안에만** |
| reduced-motion `*` 규칙의 선언 | `animation-duration` + **`transition-duration`** | `animation-duration` + `animation-iteration-count` — **transition 을 더 이상 죽이지 않음** |
| reduced-motion `.notice/.verdict` | (없음) | `fade-in var(--dur-fast) var(--ease-out)` |
| 파싱된 `@starting-style` 블록 | 0개 | **3개** (모달·backdrop·토스트) |
| 001–003 회귀 (칸 3연타/토스트/재지목 2연타) | — | **3 / 3 / 2 회 전부 재생** |

CSSOM 으로 규칙을 직접 읽어 검증했다 — CSS 문법 오류는 빌드를 통과해도 조용히 규칙을 통째로 날리기 때문에, 파싱된 미디어 쿼리·선택자·선언을 눈으로 확인하는 게 유일하게 확실한 방법이다.

**reduced-motion 의 실제 렌더링은 실측하지 못했다.** 쓸 수 있는 브라우저 도구에 `prefers-reduced-motion` 에뮬레이션이 없었다. 대신 규칙이 올바르게 파싱됐고 의도한 선언만 남았음을 CSSOM 으로 확인했다. 눈으로 한 번 볼 거면 DevTools → Rendering → `Emulate CSS media feature prefers-reduced-motion` 으로 확인하면 된다.

## 001·002·003 실행 결과 (완료)

세 계획을 각각 격리된 git worktree 에서 **병렬로** 실행한 뒤 squash 머지했다. 001 과 003 이 같은 `index.css` 를 만지므로 같은 트리에서 동시에 편집하면 서로 덮어쓸 수 있어 worktree 로 격리했다. 두 변경은 파일 내에서 45줄 이상 떨어진 구역이라 머지는 충돌 없이 끝났다.

검증은 lint·build·test(19개) 통과에 더해, **감사 때 깨진 것을 증명했던 것과 같은 방식으로 고쳐진 것도 실측했다** (`animationstart` 이벤트 카운트):

| 확인 | 수정 전 | 수정 후 |
|---|---|---|
| 같은 가구 칸 4회 클릭 → `cell-nope*` 재생 | 1회에서 멈춤 | `alt / 기본 / alt / 기본` **4회** |
| 같은 가구 칸 4회 클릭 → `notice-in` 재생 | 1회에서 멈춤 | **4회** |
| 같은 오답 3회 재지목 → `verdict-in` 재생 | **0회** | **3회** |
| 거절 후 칸의 키보드 포커스 | — | **유지됨** (재마운트 회피 설계가 실제로 작동) |
| `.chip` 과 `.brush` 의 계산된 transition | 서로 다른 중복 선언 | **완전 동일** (`transform 0.16s`, `background 0.18s`, 둘 다 `cubic-bezier(0.23, 1, 0.32, 1)`) |
| 빈 칸 메모 찍기 (회귀 확인) | 정상 | **정상**, `denied` 클래스 누출 없음 |


## 남은 작업

없다. 계획 5건 모두 실행·검증·커밋됐고, 아래 "누락된 기회" 2건도 v0.3.0 에서 구현됐다.

이 문서의 감사는 모바일 셸이 생기기 **전** 상태(`index.css` 한 파일 613줄)를 기준으로 한다. 모바일 셸·시트·증언 목록은 나중에 `find-animation-opportunities` 로 따로 스윕했다.

> 004·005 의 계획 본문에 적힌 행 번호는 커밋 `a1516a1` 기준이라 실행 시점에는 이미 밀려 있었다. 실행할 때 인용된 **코드 내용**으로 위치를 찾게 해서 문제없이 적용됐다. 앞으로 이 문서들을 다시 읽을 때도 행 번호는 신뢰하지 말 것.

## 계획으로 만들지 않은 것

감사에서 나왔지만 계획을 쓰지 않은 항목들. 나중에 필요하면 `improve-animations plan <설명>` 으로 개별 작성할 수 있다.

**누락된 기회 (추가적 개선, 교정이 아님)**

둘 다 **완료** — `find-animation-opportunities` 스윕(v0.3.0)에서 다시 확인하고 구현했다.

- ~~**정답 공개 스태거**~~ — **DONE.** `.token.solved` 에 `token-in` 키프레임 + 40ms 행우선 스태거. 딜레이는 `Board.tsx` 가 인라인으로 넣는다(`calc(var())` 는 webkit#202259 때문에 금지). `backwards` 가 없으면 자기 차례를 기다리는 토큰이 이미 보여서 스태거가 무의미해진다. 6×6 총 379ms.
- ~~**사건 교체 크로스페이드**~~ — **DONE.** `<Board key={seed:n}>` + `.board` 에 `opacity 150ms` 와 `@starting-style`. key 가 정확히 `seed:n` 이어야 한다 — `puzzle` 이나 `marks` 를 넣으면 메모를 찍을 때마다 보드가 재마운트되면서 키보드 포커스가 날아간다(실측으로 확인).

같은 스윕에서 하나 더 나왔다.

- **기록 새 항목 등장** — **DONE.** `.history ul.ready li` 에 `@starting-style` 페이드+`translateY(-6px)`. `.ready` 빗장이 핵심이다 — 없으면 이미 쌓인 기록 8건이 페이지를 열 때마다 우르르 나타난다(수정 전 로드당 전환 16건 실측, 수정 후 0건).

**검토 후 기각 (다시 제안하지 말 것)**

| 위치 | 후보 | 기각 이유 |
|---|---|---|
| `index.css:418-437` | 메모 토큰 등장 애니메이션 | 퍼즐당 수십 회 발생. 고빈도 동작은 애니메이션을 제거하거나 대폭 줄이는 게 맞다. 즉시 표시가 정답 |
| `index.css:289` | `.cell:hover` 배경에 transition | 격자 위 마우스 이동은 이 앱의 최고빈도 동작. 즉시 반응이 옳다 |
| `index.css:540` | `.feedback` 의 `transform-origin` 변경 | 화면 중앙 모달은 기본값(center)이 옳다 |
| 전역 | `transition: all` 제거 | 계산값에 보이는 `all` 은 `<dialog>` 의 CSS 초기값(duration 0s)이지 저작된 선언이 아니다 |
| 전역 | `will-change` 추가 | 실제 첫 프레임 끊김이 관측될 때만 붙인다. 관측되지 않았다 |

## 감사 당시 상태 (참고)

- 모션 라이브러리 **없음**. 플레인 CSS `src/index.css` 한 파일(613줄)이 전부.
- 모션 선언 총량: `transition` 2개(글자 그대로 중복) + `@keyframes` 3개.
- 레이아웃 속성 애니메이션 없음, `transition: all` 없음, rAF 루프 없음 → **성능 범주는 클린**이었다.
- 디자인 언어: 두꺼운 잉크 테두리 + `4px 4px 0` 하드 섀도. 아날로그 보드게임 톤 — 쫀득하되 요란하지 않아야 한다.
