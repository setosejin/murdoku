import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../App';
import Sheet from './Sheet';

describe('화면 가리기', () => {
  it('가림 dialog에는 계속하기 버튼 하나만 있다', () => {
    const html = renderToStaticMarkup(createElement(App));
    const cover = html.match(/<dialog[^>]*class="privacy-screen"[^>]*>(.*?)<\/dialog>/s)?.[1] ?? '';
    expect((cover.match(/<button/g) ?? []).length).toBe(1);
    expect(cover).toMatch(/>계속하기<\/button>/);
    expect(cover).not.toContain('murdoku');
  });

  it('열린 시트에서도 헤더 버튼으로 가릴 수 있다', () => {
    const html = renderToStaticMarkup(createElement(Sheet, {
      open: true, title: '게임 방법', onClose: () => {}, ...{ onHide: () => {} },
    }));
    const head = html.match(/<div class="sheet-head">(.*?)<\/div>/s)?.[1] ?? '';
    expect(head).toContain('aria-label="화면 가리기"');
  });
});
