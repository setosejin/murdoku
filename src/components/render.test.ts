import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generatePuzzle } from '../game/generate';
import App from '../App';
import Board from './Board';
import FeedbackDialog, { issueUrl } from './FeedbackDialog';
import ChangelogDialog, { renderMarkdown } from './ChangelogDialog';
import changelog from '../../CHANGELOG.md?raw';

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

  it('2칸 가구는 두 칸에 걸쳐 그려진다', () => {
    const { p, html } = render(false);
    if (p.furniture.some((f) => f.cells.length === 2)) expect(html).toContain('200%');
  });

  it('가구마다 이름이 적혀 있다 (증언의 가구명과 칸을 맞출 수 있게)', () => {
    const { p, html } = render(false);
    for (const f of p.furniture) expect(html).toContain(`fur-label">${f.label}`);
  });

  it('정답 공개 시 인물 토큰이 n개 나온다', () => {
    const { html } = render(true);
    expect((html.match(/token solved/g) ?? []).length).toBe(5);
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
    for (const n of [4, 5, 6]) {
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

  it('범례가 이번 사건의 가구를 빠짐없이 설명한다', () => {
    const furniture = (html.match(/fur-label">/g) ?? []).length;
    expect(furniture).toBeGreaterThan(0);
    expect((html.match(/<em>설 수 (있|없)음<\/em>/g) ?? []).length).toBe(furniture);
  });

  it('아이콘 스프라이트를 한 번만 심는다', () => {
    expect((html.match(/id="i-bed"/g) ?? []).length).toBe(1);
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
