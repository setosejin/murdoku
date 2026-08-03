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
    earned: 0,
    plays: [],
    code: 'a'.repeat(22),
    difficulties: DIFFICULTIES,
    setBrush: () => {},
    setAccused: () => {},
    setRevealed: () => {},
    setPlays: () => {},
    setCode: () => {},
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
});
