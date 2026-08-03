import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DIFFICULTIES, generatePuzzle } from '../game/generate';
import App from '../App';
import Board from './Board';
import FeedbackDialog, { issueUrl } from './FeedbackDialog';
import ChangelogDialog, { renderMarkdown } from './ChangelogDialog';
import Leaderboard from './Leaderboard';
import { AccusePanel, type AccuseProps } from './GamePanels';
import { SCORE_BASE, scoreOf, type Play } from '../game/history';
import changelog from '../../CHANGELOG.md?raw';
import desktopCss from '../styles/desktop.css?raw';

describe('Board 렌더링', () => {
  const render = (revealed: boolean, marks: Record<string, string> = {}) => {
    const p = generatePuzzle(5, 'render-check');
    const html = renderToStaticMarkup(
      createElement(Board, { puzzle: p, marks, onCell: () => {}, revealed }),
    );
    return { p, html };
  };

  it('칸 수와 방 이름을 모두 그린다', () => {
    const { p, html } = render(false);
    expect((html.match(/class="cell/g) ?? []).length).toBe(25);
    for (const room of p.rooms) expect(html).toContain(room.name);
  });

  it('가구는 자기 발자국만큼 자리와 그림을 차지한다', () => {
    const { p, html } = render(false);
    for (const f of p.furniture) {
      const rs = f.cells.map((c) => c.r);
      const cs = f.cells.map((c) => c.c);
      const w = Math.max(...cs) - Math.min(...cs) + 1;
      const h = Math.max(...rs) - Math.min(...rs) + 1;
      // 자리: 칸 수만큼 늘어난 상자
      expect(html).toContain(`width:calc(${w * 100}% - 6px);height:calc(${h * 100}% - 6px)`);
      // 그림: 세로로 긴 자리는 가로 그림을 눕혀 쓰므로 긴 변이 앞에 온다
      const [uw, uh] = h > w ? [h, w] : [w, h];
      expect(html).toContain(`width:calc(13.600cqw * ${uw});height:calc(13.600cqw * ${uh})`);
      // viewBox 도 같은 비율이라야 늘어나지도 letterbox 되지도 않는다
      expect(html).toContain(`viewBox="0 0 ${24 * uw} ${24 * uh}"`);
      if (h > w) expect(html).toContain('rotate:90deg');
    }
  });

  it('가구마다 이름이 적혀 있다 (증언의 가구명과 칸을 맞출 수 있게)', () => {
    const { p, html } = render(false);
    for (const f of p.furniture) expect(html).toContain(`fur-label">${f.label}`);
  });

  it('정답 공개 시 인물 토큰이 n개 나온다', () => {
    const { html } = render(true);
    expect((html.match(/token solved/g) ?? []).length).toBe(5);
  });

  /* 정답 공개는 이 게임의 규칙("범인 = 피해자와 같은 방에 있던 용의자")을
     순서로 말한다. 범인 표시나 사건 현장 표시가 빠지면 정답이 보드 밖 문구로만
     남아서, 이름을 읽고 보드에서 글자를 다시 찾아야 한다 */
  it('정답 공개 시 범인 토큰과 사건 현장이 따로 표시된다', () => {
    const { p, html } = render(true);
    expect((html.match(/token solved culprit/g) ?? []).length).toBe(1);

    const vc = p.solution[p.people.find((x) => x.isVictim)!.id];
    const crimeRoom = p.rooms.find((rm) => rm.cells.some((c) => c.r === vc.r && c.c === vc.c))!;
    expect((html.match(/class="cell[^"]* crime/g) ?? []).length).toBe(crimeRoom.cells.length);
    // 마지막 한 마디의 딜레이. 의사요소가 읽어가므로 인라인이 아니라 변수로 내려간다
    expect(html).toContain('--crime-delay');
  });

  it('공개 전에는 범인도 사건 현장도 드러나지 않는다', () => {
    const { html } = render(false);
    expect(html).not.toContain('culprit');
    expect(html).not.toContain(' crime');
  });

  it('설 수 없는 가구 칸은 blocked로 표시되고 이유가 라벨에 들어간다', () => {
    const { p, html } = render(false);
    const cnt = p.furniture.filter((f) => !f.standable).reduce((s, f) => s + f.cells.length, 0);
    expect((html.match(/class="cell blocked"/g) ?? []).length).toBe(cnt);
    expect((html.match(/가구라 설 수 없음/g) ?? []).length).toBe(cnt);
  });

  it('칸마다 방 바닥 재질이 붙는다', () => {
    const { p, html } = render(false);
    const floors = new Set(p.rooms.map((r) => r.floor));
    for (const f of floors) expect(html).toContain(`data-floor="${f}"`);
    expect((html.match(/data-floor="/g) ?? []).length).toBe(25);
  });

  it('메모는 공개 전에만 보인다', () => {
    expect(render(false, { '0,0': 'X' }).html).toContain('✕');
    expect(render(true, { '0,0': 'X' }).html).not.toContain('✕');
  });

  // Safari 는 repeat() 안의 var() 를 캐싱해서, 난이도를 오갔다 돌아오면 옛 열 폭을 쓴다.
  // 그래서 열 개수는 CSS 변수가 아니라 인라인 값으로 박아야 한다 (webkit#202259)
  it('열 개수를 grid-template-columns 에 직접 박는다', () => {
    for (const n of DIFFICULTIES.map((d) => d.n)) {
      const html = renderToStaticMarkup(
        createElement(Board, {
          puzzle: generatePuzzle(n, `cols-${n}`),
          marks: {},
          onCell: () => {},
          revealed: false,
        }),
      );
      expect(html).toContain(`grid-template-columns:repeat(${n}, minmax(0, 1fr))`);
      expect(html).not.toContain('--n');
    }
  });
});

describe('App 렌더링', () => {
  const html = renderToStaticMarkup(createElement(App));

  // matchMedia 가 없는 환경(SSR·테스트)에서는 데스크톱 셸이 기본이다.
  // 모바일 셸이 기본이 되면 아래 데스크톱 불변식들이 조용히 무의미해진다
  it('기본은 데스크톱 셸이다', () => {
    expect(html).toContain('class="topbar"');
    expect(html).toContain('class="side"');
    expect(html).not.toContain('class="mshell"');
  });

  it('범례가 이번 사건의 가구를 빠짐없이 설명한다', () => {
    const furniture = (html.match(/fur-label">/g) ?? []).length;
    expect(furniture).toBeGreaterThan(0);
    expect((html.match(/<em>설 수 (있|없)음<\/em>/g) ?? []).length).toBe(furniture);
  });

  it('아이콘 스프라이트를 한 번만 심는다', () => {
    expect((html.match(/id="i-bed"/g) ?? []).length).toBe(1);
  });

  it('증언 목록과 보드와 지목이 한 화면에 같이 있다', () => {
    // 클릭 동선의 전부다. 하나라도 모달로 내려가면 왕복이 다시 생긴다
    expect(html).toContain('class="pboard"');
    expect(html).toContain('class="panel accuse"');
    // 증언 줄이 곧 브러시 — 목록이 시트가 아니라 증언 패널 안에 있어야 성립한다
    expect(html).toMatch(/class="panel dclues".*class="clue-list".*class="dclues-bar"/s);
  });
});

// 데스크톱 셸도 모바일처럼 한 화면이다. 아래 셋은 전부 실제로 깨뜨려 본 것들이라
// 주석 대신 테스트로 못박는다 (CSS 원문 검사는 vite.config 의 test.css: true 에 기댄다)
describe('desktop.css 불변식', () => {
  it('페이지가 아니라 열이 스크롤한다', () => {
    // min-height 로 두면 열이 길어질 때 페이지가 그만큼 늘어난다
    expect(desktopCss).toMatch(/\.app\s*\{[^}]*height:\s*100dvh/);
    expect(desktopCss).toMatch(/\.side\s*\{[^}]*overflow-y:\s*auto/);
  });

  it('.play 의 행 높이를 남는 공간에 묶는다', () => {
    // auto 행은 내용만큼 커져서 열이 푸터를 뚫고 나간다
    expect(desktopCss).toMatch(/\.play\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\)/);
    // start 면 가운데 열 높이가 내용에 맞춰져 보드 컨테이너 쿼리가 0 이 된다
    expect(desktopCss).toMatch(/\.play\s*\{[^}]*align-items:\s*stretch/);
  });

  it('양옆 열 폭이 화면을 따라 줄어든다', () => {
    // 고정 px 면 좁은 창에서 양옆이 자리를 먼저 챙기고 보드만 쪼그라든다
    expect(desktopCss).toMatch(/\.play\s*\{[^}]*grid-template-columns:\s*clamp\(/);
  });

  it('보드는 남는 공간의 짧은 변에 맞춘다', () => {
    expect(desktopCss).toMatch(/\.pboard\s*\{[^}]*container-type:\s*size/);
    expect(desktopCss).toContain('min(100cqw, 100cqh');
  });
});

describe('점수판', () => {
  const play = (over: Partial<Play> = {}): Play => ({
    seed: 'a1b2c3',
    n: 4,
    at: 1000,
    ok: true,
    tries: 1,
    title: '사라진 회중시계',
    ...over,
  });

  const render = (plays: Play[]) =>
    renderToStaticMarkup(createElement(Leaderboard, { plays, code: 'a'.repeat(22) }));

  it('내 점수를 로컬 기록에서 바로 센다 (서버가 없어도 보인다)', () => {
    const plays = [play({ seed: 'a', n: 7, tries: 2 }), play({ seed: 'b', n: 4, tries: 1 })];
    const total = plays.reduce((s, p) => s + scoreOf(p), 0);

    const html = render(plays);
    expect(html).toContain(`${total.toLocaleString('ko-KR')}점`);
    expect(html).toContain('2사건 해결');
  });

  it('점수 규칙을 SCORE_BASE 에서 그대로 읽어 보여준다', () => {
    // 문구에 숫자를 복제하면 만점을 조정할 때 조용히 거짓말이 된다
    const html = render([]);
    for (const [n, base] of Object.entries(SCORE_BASE)) expect(html).toContain(`${n}×${n} ${base}`);
  });

  it('서버가 없으면 순위 대신 그 사실을 말한다', () => {
    expect(import.meta.env.VITE_SYNC_URL).toBeFalsy();
    const html = render([]);
    expect(html).not.toContain('<ol');
    expect(html).toContain('순위 서버가 없어');
  });
});

describe('정답을 본 사건', () => {
  const suspects = generatePuzzle(4, 'peek-check').people.filter((p) => !p.isVictim);
  const props = {
    suspects,
    accused: suspects[0].id,
    setAccused: () => {},
    accuse: () => {},
    result: null,
    attempt: 0,
    culpritName: '아무개',
    earned: 0,
    revealed: false,
    setRevealed: () => {},
  } as const;

  const render = (over: Partial<AccuseProps>) =>
    renderToStaticMarkup(createElement(AccusePanel, { ...props, peeked: false, ...over }));

  it('보기 전에는 지목할 수 있고, 버튼이 대가를 미리 말한다', () => {
    const html = render({});
    expect(html).not.toContain('disabled');
    expect(html).toContain('정답 보기 (이 사건 포기)');
  });

  it('한 번 보면 지목이 막히고 이유를 말한다', () => {
    // 감췄다고 안 본 게 되지 않는다 — revealed 가 아니라 peeked 로 잠근다
    const html = render({ peeked: true, revealed: false });
    expect(html).toMatch(/<button[^>]*disabled[^>]*>지목하기<\/button>/);
    expect(html).toContain('이 사건은 여기까지야');
  });

  it('맞힌 뒤에는 정답을 봐도 지목 버튼 문구가 겁주지 않는다', () => {
    const html = render({ peeked: true, result: 'correct', earned: 150, revealed: true });
    expect(html).toContain('+150점');
    expect(html).not.toContain('이 사건은 여기까지야');
    expect(html).toContain('정답 숨기기');
  });
});

describe('FeedbackDialog', () => {
  it('이슈 URL에 유형·제목·본문·시드가 인코딩된다', () => {
    const url = new URL(issueUrl('버그', ' 방이 겹쳐 ', '4x4에서 재현됨', 'abc123', 4));

    expect(url.origin + url.pathname).toBe('https://github.com/setosejin/murdoku/issues/new');
    expect(url.searchParams.get('title')).toBe('[버그] 방이 겹쳐');
    const body = url.searchParams.get('body')!;
    expect(body).toContain('4x4에서 재현됨');
    expect(body).toContain('시드: `abc123`');
    expect(body).toContain('난이도: 4x4');
  });

  it('제목 입력과 취소/제출 버튼을 그린다', () => {
    const html = renderToStaticMarkup(createElement(FeedbackDialog, { seed: 'abc123', n: 4 }));
    expect(html).toContain('<dialog');
    expect(html).toContain('피드백');
    expect(html).toContain('required');
    expect(html).toContain('이슈로 열기');
  });
});

describe('버전 기록', () => {
  const md = [
    '# 버전 기록',
    '',
    '## v9.9.9 — 2026-01-02',
    '',
    '### 고침',
    '',
    '- **굵게** 와 `코드` 와 [링크](https://example.dev/x)',
    '- 그냥 한 줄',
    '',
    '남는 문단',
  ].join('\n');

  it('제목·목록·인라인 마크업을 그린다', () => {
    const html = renderToStaticMarkup(createElement('div', null, ...renderMarkdown(md)));

    expect(html).not.toContain('# '); // 파일 제목은 모달 제목이 대신한다
    expect(html).toContain('<h3>v9.9.9 <span class="cl-date">2026-01-02</span></h3>');
    expect(html).toContain('<h4>고침</h4>');
    expect(html).toContain('<b>굵게</b>');
    expect(html).toContain('<code>코드</code>');
    expect(html).toContain('href="https://example.dev/x"');
    expect(html).toContain('<li>그냥 한 줄</li>');
    expect(html).toContain('<p>남는 문단</p>');
    expect(html.match(/<ul>/g)).toHaveLength(1); // 연속한 항목은 한 목록으로 묶인다
  });

  it('버튼과 dialog 를 그린다', () => {
    const html = renderToStaticMarkup(createElement(ChangelogDialog));
    expect(html).toContain('<dialog');
    expect(html).toContain(`v${import.meta.env.VITE_APP_VERSION}`);
    expect(html).toContain('버전 기록');
  });

  // pre-push 훅과 같은 불변식. 훅은 --no-verify 로 넘길 수 있지만 CI 의 npm test 는 못 넘긴다.
  it('CHANGELOG 에 현재 버전 항목이 있다', () => {
    expect(changelog).toContain(`## v${import.meta.env.VITE_APP_VERSION} — `);
  });
});
