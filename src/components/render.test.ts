import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DIFFICULTIES, generatePuzzle } from '../game/generate';
import App from '../App';
import { DifficultySeg } from './GamePanels';
import FeedbackDialog, { issueUrl } from './FeedbackDialog';
import ChangelogDialog, { renderMarkdown } from './ChangelogDialog';
import { TOUR_STEPS } from '../data/tour';
import Tour from './Tour';
import { AccusePanel, type AccuseProps } from './GamePanels';
import changelog from '../../CHANGELOG.md?raw';
import desktopCss from '../styles/desktop.css?raw';

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

  // 규칙도 범례도 처음 한 번 읽고 마는 것이라 사이드 열을 계속 차지할 이유가 없다.
  // 기본 화면에서 빠진 만큼 보드가 넓어진다
  it('범례는 기본 화면이 아니라 사건 브리핑 안에 있다', () => {
    expect((html.match(/class="panel legend"/g) ?? []).length).toBe(1);
    const side = html.slice(html.indexOf('class="side"'), html.indexOf('class="footer"'));
    expect(side).not.toContain('legend');
    const brief = html.slice(html.indexOf('<dialog'));
    expect(brief.indexOf('class="panel legend"')).toBeGreaterThan(-1);
  });

  it('아이콘 스프라이트를 한 번만 심는다', () => {
    expect((html.match(/id="i-bed"/g) ?? []).length).toBe(1);
  });

  // 알약의 폭과 이동량은 TS 가 계산해 인라인으로 넣는다. 어긋나면 켜진 칸이
  // 아닌 데로 미끄러져 앉는데, 색 대비만 보면 멀쩡해 보여서 눈으로는 늦게 잡힌다
  it('난이도 알약이 켜진 칸에 정확히 앉는다', () => {
    const seg = renderToStaticMarkup(
      createElement(DifficultySeg, { difficulties: DIFFICULTIES, n: 6, onPick: () => {} }),
    );
    const at = DIFFICULTIES.findIndex((d) => d.n === 6);
    expect(seg).toContain(`width:calc((100% - 6px) / ${DIFFICULTIES.length})`);
    expect(seg).toContain(`translate:${at * 100}%`);
    // 라벨은 판 크기이고 쉬움·보통 같은 말은 aria-label 이 갖는다
    expect(seg).toContain('aria-label="어려움 (6×6)"');
    expect((seg.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
  });

  it('증언 목록과 보드와 지목이 한 화면에 같이 있다', () => {
    // 클릭 동선의 전부다. 하나라도 모달로 내려가면 왕복이 다시 생긴다
    expect(html).toContain('class="pboard"');
    expect(html).toContain('class="panel accuse"');
    // 증언 줄이 곧 브러시 — 목록이 시트가 아니라 증언 패널 안에 있어야 성립한다
    expect(html).toMatch(/class="panel dclues".*class="clue-list".*class="dclues-bar"/s);
  });

  // 스포트라이트는 셀렉터로 자리를 찾는다. 겨눌 자리를 못 찾아도 에러 없이
  // 구멍만 사라지므로, 클래스 이름을 바꾸면 온보딩이 조용히 반쯤 죽는다
  it('온보딩이 겨누는 자리가 전부 실제로 그려진다', () => {
    for (const s of TOUR_STEPS) {
      const cls = s.sel.slice(1);
      expect(html).toMatch(new RegExp(`class="[^"]*\\b${cls}\\b`));
    }
  });

  it('온보딩은 증언 아래 ? 로 다시 연다', () => {
    // 첫 방문 자동 열기는 마운트 뒤 effect 라 서버 렌더에는 안 나온다
    expect(html).toContain('aria-label="게임 방법 보기"');
    expect(html).not.toContain('class="tour"');
  });

  // 자리 재기(document.querySelector·getBoundingClientRect)가 effect 밖으로
  // 새어 나오면 여기서 먼저 터진다 — 브라우저에서는 한참 뒤에나 보인다
  it('온보딩은 DOM 없이도 첫 단계를 그린다', () => {
    const tour = renderToStaticMarkup(createElement(Tour, { onClose: () => {} }));
    expect(tour).toContain(TOUR_STEPS[0].title);
    expect(tour).toContain(`1 / ${TOUR_STEPS.length}`);
    // 첫 단계에서는 되돌아갈 데가 없다
    expect(tour).toMatch(/aria-label="이전 단계"[^>]*disabled/);
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
    detective: '',
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
