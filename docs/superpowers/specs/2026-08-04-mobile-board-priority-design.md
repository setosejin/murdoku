# 모바일 보드 우선 배분

2026-08-04

## 문제

모바일에서 난이도를 올리면 보드가 작아진다. 인원수 `n` 이 곧 증언 줄 수라, 증언 목록이
세로로 자라는 만큼 보드가 깎인다.

WebKit(Playwright) 실측:

| 기기 | n=4 | n=5 | n=6 | n=7 |
|---|---|---|---|---|
| iPhone SE 375×667 — 보드 / 칸 | 355 / 86px | 333 / 65px | 290 / 47px | 247 / **34px** |
| iPhone 13 390×844 — 보드 / 칸 | 370 / 90px | 370 / 72px | 370 / 60px | 370 / 51px |

증상이 기기마다 다르다.

- 큰 폰은 보드가 안 줄고(폭에 걸려 370 고정) 칸만 작아진다. 칸이 작아지는 건 격자가
  촘촘해지는 결과라 피할 수 없다.
- SE 급 낮은 화면은 **보드 자체가 30% 줄고** 칸이 34px 까지 내려간다. 이 UI 가 다른
  컨트롤에서 지키는 44px 터치 최소치 아래다.

## 원인

`src/styles/mobile.css` 의 세로 배분이다. `.mshell` 은 세로 flex 이고 자식이 넷이다.

```
.mtop      flex: none          44px
.mplay     flex: 1 1 auto      min-height: 240px
.clue-list flex: 0 1 auto      overflow-y: auto
.mbar      flex: none          44~48px
```

`.mplay` 는 `container-type: size` 라 내용이 크기에 관여하지 못한다 — flex 기준 크기가
사실상 0 이다. 그래서 증언 목록이 **내용 높이를 먼저 다 챙기고** 보드는 남은 걸 받는다.
`flex-grow: 1` 은 남는 게 있을 때만 쓸모가 있지, 모자랄 때 우선권을 주지는 않는다.

목록 높이는 인원수에 정비례한다. 낮은 화면(`max-height: 700px`)의 줄 높이 40px + 간격
3px 기준으로 n=4 는 169px, n=7 은 298px 다. 그 위 화면은 44px + 4px 라 188 / 332px.

SE n=7 검산: 667 − 패딩16 − 간격18 − 상단44 − 하단44 − 증언298 = **247** (실측과 일치).

## 결정

증언은 한 번에 일부만 보여도 된다. 목록의 모양은 그대로 두고 안에서 스크롤한다.
(다른 후보 — 증언 목록에 고정 `max-height`, 보드 위에 겹치는 peek 시트 — 는 각각
마법의 숫자가 필요하고 넓은 화면에서 손해이거나, 가장 자주 누르는 컨트롤을 시트 뒤로
보내서 물렸다.)

## 설계

### 1. 공간 배분 — `src/styles/mobile.css`

```css
.mplay {
  flex: 1 1 auto;      /* 기준 크기는 아래 정사각. 남는 몫도 여기가 받는다 */
  aspect-ratio: 1;     /* 기준 크기 = 화면 가로에 맞춘 정사각 */
  min-height: 200px;   /* 아주 낮은 화면에서의 바닥 */
}
.mshell > .clue-list {
  flex: 0 100 auto;    /* 자라지 않고, 모자라면 100배로 먼저 내준다 */
  min-height: 132px;   /* 증언 3줄은 지킨다 */
}
```

두 가지가 핵심이다.

- `aspect-ratio: 1` 이 `.mplay` 에 "가로만큼의 높이"라는 실제 flex 기준값을 준다.
  컨테이너 쿼리가 내용을 못 보는 것과 무관하게 값이 생기므로 배분 순서가 뒤집힌다.
- `flex-shrink` 를 `100 : 1` 로 벌려 부족분의 99%를 증언 목록이 진다. 보드 높이를
  `calc()` 로 역산할 필요가 없다 — 순환 참조를 flex 가중치로 푼 것이다.

목록이 `min-height: 132px`(3줄) 바닥에 닿으면 그때부터 보드가 줄기 시작한다.

**남는 몫은 계속 `.mplay` 가 받는다** (`flex-grow` 를 보드 쪽에 남겨둔 이유). 보드는
정사각이 상한이라 더 커지지 않고 `place-items: center` 로 가운데 선다 — 세로 여유가
있는 큰 폰에서는 **오늘과 픽셀 단위로 같은 화면**이다. 반대로 목록이 남는 몫을 받게
하면(`.mplay { flex: 0 1 auto }`) 보드가 제목에 달라붙고 증언 아래에 157px(iPhone 13,
n=4) 짜리 죽은 공간이 생긴다. 실측·스크린샷으로 확인하고 물렸다.

기존 `.mplay { min-height: 240px }` 는 200px 로 내린다. 실질 하한은 이제
`aspect-ratio` 가 정하고, 240 은 낮은 화면에서 오히려 목록의 3줄을 먹는다.

**되돌려야 하는 블록 둘.** 새 규칙이 새면 안 되는 곳이다.

- 가로 모드(`orientation: landscape`) 블록 — 거기는 grid 라 `aspect-ratio` 가 트랙
  계산을 망친다. `aspect-ratio: auto`, `min-height: 0` 으로 되돌린다. 목록의
  `min-height` 도 0 으로 되돌린다.
- `@supports not (container-type: size)`(Safari 15 이하) 블록 — 폭에만 맞추고 넘치면
  스크롤하는 경로라 새 규칙이 끼면 안 된다. 같은 속성을 되돌린다.

### 2. 고른 줄이 잘려 있지 않게 — `src/components/ClueList.tsx`

목록이 넘치면 마지막으로 보이는 줄이 반쯤 걸친다. 그 줄을 눌러 브러시로 삼으면 선택은
됐는데 반만 보이는 상태가 남는다. `brush` 를 보는 `useEffect` 에서 고른 줄에
`scrollIntoView({ block: 'nearest' })` 를 건다 — 이미 다 보이면 아무 일도 안 하고,
걸쳐 있을 때만 한 줄만큼 민다.

모션은 CSS 가 맡는다. `clues.css` 의 `.clue-list` 에 `scroll-behavior: smooth`,
`motion.css` 에 `prefers-reduced-motion` 일 때 `scroll-behavior: auto !important`.
JS 는 "어디로"만 말하고 "어떻게"는 CSS 가 정한다.

`.clue-list` 는 두 셸 모두에서 스크롤 주체다(`mobile.css` 와 `desktop.css` 가 각자
`overflow-y: auto` 를 건다). 데스크톱 증언 열도 같이 얻는다.

### 3. 스크롤 페이드 — `ClueList.tsx` + `clues.css`

잘린 가장자리를 흐리게 해서 "더 있다"를 말한다.

CSS 만으로 하려면 스크롤 연동 애니메이션(`animation-timeline: scroll()`)이 필요한데
Safari 26+ 라 주 대상인 아이폰 대부분이 못 받는다. JS 로 상태만 읽고 그림은 CSS 가
그린다.

`ClueList` 가 `scroll` 리스너와 `ResizeObserver` 로 `data-fade` 를 쓴다.

| 상태 | `data-fade` |
|---|---|
| 넘치지 않음 | 속성 없음 |
| 위로 스크롤 여지 있음 | `top` |
| 아래로 스크롤 여지 있음 | `bottom` |
| 양쪽 다 | `both` |

```css
.clue-list[data-fade='bottom'] {
  mask-image: linear-gradient(to top, transparent, #000 24px);
}
.clue-list[data-fade='both'] {
  mask-image: linear-gradient(
    to bottom, transparent, #000 24px, #000 calc(100% - 24px), transparent
  );
}
```

- **끝에 닿은 쪽은 페이드를 걷는다.** 항상 켜두면 마지막 줄이 영영 흐려 보인다.
- `ResizeObserver` 가 창 크기·회전을 잡는다. 난이도 교체는 `<ul>` 의 `key`
  (`${seed}:${n}`)를 effect 의존성에 넣어 잡는다 — `key` 가 `<ul>` 에 붙어 있어서
  의존성 없이 두면 리스너가 떨어져 나간 옛 DOM 노드에 남는다.
- `mask-image` 는 Safari 15.4+ 다. 그 아래는 페이드만 없고 스크롤은 그대로 된다.
- `both` 의 `calc(100% - 24px)` 에 `var()` 를 쓰지 않는다 (webkit#202259).

### 4. 곁다리 — 난이도를 바꿔도 브러시가 안 바뀐다

`useGame.reset()` 이 `marks`·`accused`·`result` 는 비우는데 `brush` 는 그대로 둔다.
7×7 에서 `F` 를 고른 채 4×4 로 가면 `F` 인 사람이 없어 목록에 켜진 줄이 하나도 없고,
칸을 누르면 색 없는 `F` 토큰이 찍힌다 (`people.find(...)?.color` 가 `undefined`).

지금은 목록이 통째로 보여서 눈에 덜 띄지만, 스크롤하는 목록에서는 "내가 뭘 고른 거지"가
된다. 이 변경이 직접 악화시키는 버그라 같이 고친다 — `reset` 에 `setBrush('X')` 한 줄.

## 기대 결과

시안을 스타일 주입으로 WebKit 에서 미리 측정했다.

| iPhone SE 375×667 | 지금 | 시안 |
|---|---|---|
| n=4 보드 / 칸 | 355 / 86px | 355 / 86px |
| n=6 보드 / 칸 | 290 / 47px | **354 / 57px** |
| n=7 보드 / 칸 | 247 / 34px | **354 / 49px** |

| 다른 화면 | 결과 |
|---|---|
| iPhone 13 390×844 | 보드 370 그대로, 세로 위치도 그대로. n=7 에서도 증언 7줄 전부 보인다 |
| 360×560 (아주 낮음) | 보드 306 고정, 목록은 3줄 바닥, 넘침 0 |
| 가로 844×390 | 보드 374 그대로, 잘림 0 |

넓은 화면에서는 오늘과 똑같이 동작하고 좁을 때만 목록이 줄어든다 — 난이도별 분기나
화면 크기 상수 없이 자기적응한다.

대가: SE n=7 에서 증언 7줄 중 4.4줄이 보이고 나머지는 스크롤한다.

## 테스트

`src/components/mobile.test.ts` 에 CSS 원문 불변식으로 넣는다. 이 파일은 이미 같은
방식으로 `MOBILE_QUERY` 일치를 검사한다. (원문 검사는 `vite.config.ts` 의
`test: { css: true }` 에 기댄다 — `repo.test.ts` 가 그 구멍을 막고 있다.)

- `.mplay` 에 `aspect-ratio: 1` 이 있다
- `.mshell > .clue-list` 의 `flex-shrink` 가 `.mplay` 보다 크다
- 가로 모드 블록과 `@supports not (container-type: size)` 블록이 `aspect-ratio` 를
  되돌린다
- `clues.css` 에 `[data-fade]` 세 상태의 `mask-image` 규칙이 있다
- `motion.css` 가 `prefers-reduced-motion` 에서 `scroll-behavior` 를 되돌린다

`useGame` 의 브러시 초기화는 로직으로 확인한다 — 난이도를 바꾼 뒤 `brush` 가 `'X'` 다.

## 검증

코드에 넣은 뒤 WebKit(Playwright)으로 다시 잰다. 대상은 SE 375×667, iPhone 13
390×844, 360×560, 가로 844×390. 난이도 4↔7 을 **왕복**한 뒤 다시 잰다
(webkit#202259 는 첫 진입에 안 터진다).

판정 기준:

- 보드 잘림 없음 — `board.scrollWidth > board.clientWidth` 가 아니다
- 페이지 넘침 없음 — `scrollingElement.scrollHeight <= clientHeight`
- 위 표의 보드·칸 수치

그다음 `npm test`, `npm run lint`, `npm run build`.

## 안 하는 것

- 증언 줄 높이를 40px 아래로 내리지 않는다. 이 화면에서 가장 자주 누르는 컨트롤이다.
- 증언을 가로 카드·배지 줄 같은 압축 형태로 바꾸지 않는다. 목록 모양은 유지한다.
- 난이도별로 레이아웃을 분기하지 않는다. 배분이 스스로 적응해야 한다.
- 세로 여유가 있는 큰 폰의 남는 공간을 재배치하지 않는다. 오늘 그대로 둔다 — 이번
  변경은 난이도에 따라 보드가 깎이는 문제만 본다.
- 생성 규칙(`generate.ts`·`solve.ts`·`clues.ts`)은 건드리지 않는다. 순수 레이아웃 변경이다.
