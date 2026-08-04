import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generatePuzzle, DIFFICULTIES } from '../game/generate';
import { MOBILE_QUERY } from '../hooks/useMediaQuery';
import type { Game } from '../hooks/useGame';
import ClueList from './ClueList';
import MobileShell from './MobileShell';
import Sheet from './Sheet';
import mobileCss from '../styles/mobile.css?raw';
import cluesCss from '../styles/clues.css?raw';
import motionCss from '../styles/motion.css?raw';

const puzzle = generatePuzzle(5, 'mobile-check');

describe('증언 목록 = 메모 브러시', () => {
  const html = (brush: string) =>
    renderToStaticMarkup(createElement(ClueList, { puzzle, brush, setBrush: () => {} }));

  it('용의자와 피해자를 한 줄씩 그린다', () => {
    // 5x5 = 용의자 4 + 피해자 1. 인물이 늘어도 목록이 따라와야 한다
    expect((html('X').match(/class="clue-row/g) ?? []).length).toBe(puzzle.people.length);
    for (const p of puzzle.people) expect(html('X')).toContain(`>${p.name}</b>`);
  });

  it('증언 문구는 puzzle.clues 를 그대로 쓴다 (문자열을 여기서 조립하지 않는다)', () => {
    const out = html('X');
    for (const c of puzzle.clues) expect(out).toContain(c.text);
  });

  it('각 줄이 브러시 토글이고, 눌린 줄은 하나뿐이다', () => {
    const out = html(puzzle.people[0].id);
    expect((out.match(/aria-pressed/g) ?? []).length).toBe(puzzle.people.length);
    expect((out.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect((out.match(/class="clue-row on"/g) ?? []).length).toBe(1);
  });

  it('빈 칸 브러시(X)일 때는 눌린 줄이 없다', () => {
    expect(html('X')).not.toContain('aria-pressed="true"');
  });

  // 목록이 넘치면 마지막 줄이 반쯤 걸친다. 그 줄을 골랐을 때 걸친 채로 두지 않는다 —
  // 어디로 갈지는 JS(scrollIntoView), 어떻게 갈지는 CSS 가 정한다
  it('고른 줄로 미끄러진다 (모션은 CSS 가 정한다)', () => {
    expect(cluesCss).toContain('scroll-behavior: smooth');
    expect(motionCss).toContain('scroll-behavior: auto !important');
  });

  // 넘치는 쪽 가장자리만 흐리게 한다. 늘 켜두면 끝까지 내려도 마지막 줄이
  // 영영 흐려 보인다 — 끝에 닿은 쪽은 ClueList 가 data-fade 에서 뺀다
  it('잘린 가장자리만 흐리게 하고 끝에 닿은 쪽은 걷는다', () => {
    for (const state of ['top', 'bottom', 'both']) {
      const at = cluesCss.indexOf(`.clue-list[data-fade='${state}']`);
      expect(at).toBeGreaterThan(-1);
      // 접두사 없는 mask-image 는 Safari 15.4+ 다. 그 아래는 -webkit- 만 알아들으므로
      // 규칙마다 두 표기를 같이 든다 — "중복 속성" 이라고 지우면 옛 사파리에서 페이드가 통째로 사라진다
      const rule = cluesCss.slice(at, cluesCss.indexOf('}', at));
      expect(rule).toMatch(/-webkit-mask-image:/);
      expect(rule).toMatch(/(?:^|[^-])mask-image:/);
    }
    // 안 넘치면 속성 자체가 없다 (서버 렌더에는 effect 가 안 돈다)
    expect(html('X')).not.toContain('data-fade');
  });
});

describe('바텀시트', () => {
  it('dialog 로 그리고 제목·닫기 버튼을 준다', () => {
    const html = renderToStaticMarkup(
      createElement(Sheet, { open: true, onClose: () => {}, title: '범례' }, '내용'),
    );
    expect(html).toContain('<dialog');
    expect(html).toContain('class="sheet"');
    expect(html).toContain('aria-label="범례"');
    expect(html).toContain('class="sheet-body"');
  });
});

describe('모바일 셸 렌더링', () => {
  const shellPuzzle = generatePuzzle(6, 'mobile-shell');
  const game: Game = {
    n: 6,
    seed: 'mobile-shell',
    puzzle: shellPuzzle,
    suspects: shellPuzzle.people.filter((p) => !p.isVictim),
    victim: shellPuzzle.people.find((p) => p.isVictim)!,
    culpritName: '아무개',
    marks: {},
    brush: 'X',
    accused: '',
    result: null,
    attempt: 0,
    revealed: false,
    peeked: false,
    earned: 0,
    plays: [],
    code: 'a'.repeat(22),
    board: undefined,
    rankAlert: null,
    difficulties: DIFFICULTIES,
    setBrush: () => {},
    setAccused: () => {},
    setRevealed: () => {},
    setPlays: () => {},
    setCode: () => {},
    dismissRank: () => {},
    clearMarks: () => {},
    onCell: () => {},
    accuse: () => {},
    reset: () => {},
  };
  const html = renderToStaticMarkup(createElement(MobileShell, { game }));

  it('붙박이는 상단바·보드·증언 목록·액션바 넷뿐이다', () => {
    for (const cls of ['mtop', 'mplay', 'clue-list', 'mbar']) expect(html).toContain(`"${cls}"`);
    // 데스크톱 사이드 열은 모바일에 없다
    expect(html).not.toContain('class="side"');
  });

  // 데스크톱 .topbar 에만 게임 이름이 있어서 모바일에는 h1 자체가 없었다.
  // 상단바 높이는 옆의 44px 버튼이 정하므로 여기 넣는 건 세로 비용이 0 이다
  it('게임 이름을 h1 으로 세운다', () => {
    expect(html).toContain('<h1 class="mbrand">murdoku</h1>');
  });

  it('나머지는 전부 시트로 들어간다', () => {
    expect((html.match(/class="sheet"/g) ?? []).length).toBe(4);
    for (const title of ['범례', '범인 지목', '메뉴'])
      expect(html).toContain(`aria-label="${title}"`);
  });

  it('범례 시트가 이번 사건의 가구를 빠짐없이 설명한다', () => {
    const furniture = shellPuzzle.furniture.length;
    expect(furniture).toBeGreaterThan(0);
    expect((html.match(/<em>설 수 (있|없)음<\/em>/g) ?? []).length).toBe(furniture);
  });

  it('열 개수를 grid-template-columns 에 직접 박는다 (Safari webkit#202259)', () => {
    expect(html).toContain('grid-template-columns:repeat(6, minmax(0, 1fr))');
    expect(html).not.toContain('--n');
  });

  it('순위를 뺏기면 메뉴 버튼에 점이 켜지고 이름표도 같이 바뀐다', () => {
    // 점은 눈에만 보인다 — aria-label 이 그대로면 스크린리더는 알 길이 없다
    expect(html).toContain('aria-label="메뉴"');
    expect(html).not.toContain('alert-dot');

    const lit = renderToStaticMarkup(
      createElement(MobileShell, { game: { ...game, rankAlert: { from: 3, to: 5 } } }),
    );
    expect(lit).toContain('aria-label="메뉴 (순위 알림)"');
    expect(lit).toContain('class="micon alerted"');
    expect(lit).toContain('alert-dot');
  });
});

describe('모바일 스타일 불변식', () => {
  // 셸을 고르는 JS 조건과 스타일을 켜는 CSS 조건이 어긋나면
  // 마크업은 모바일인데 스타일은 데스크톱이 된다 — 화면이 통째로 깨진다
  it('MOBILE_QUERY 와 mobile.css 의 미디어 쿼리가 같다', () => {
    expect(mobileCss).toContain(`@media ${MOBILE_QUERY} {`);
  });

  // Safari 는 repeat() 안의 var() 를 computed-value 시점에 한 번 펼쳐 캐싱한다 (webkit#202259)
  it('보드 높이는 var() 없이 정한다', () => {
    expect(mobileCss).not.toContain('repeat(var(');
    expect(mobileCss).toContain('grid-auto-rows: minmax(0, 1fr)');
  });

  it('보드가 폭과 높이 중 작은 쪽에 맞춰진다', () => {
    expect(mobileCss).toContain('min(100cqw, 100cqh)');
    expect(mobileCss).toContain('container-type: size');
  });

  it('노치 안전영역을 쓴다', () => {
    expect(mobileCss).toContain('env(safe-area-inset-bottom');
  });

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
});
