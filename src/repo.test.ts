import { describe, expect, it } from 'vitest';

const MAX_LINES = 500;

// Vite 가 빌드 시점에 소스를 문자열로 심는다. node:fs 를 쓰면 @types/node 가 필요해진다
const sources = import.meta.glob('/{src,worker}/**/*.{ts,tsx,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('저장소 규약', () => {
  // Vitest 의 css:false 가 CSS 를 빈 스텁으로 바꿔서, 예전에는 이 규약이
  // .css 를 통째로 건너뛰고도 통과했다. 빈 파일이 섞이면 바로 알아채게 한다
  it('스타일 원문이 실제로 읽힌다 (vite.config 의 test.css)', () => {
    const css = Object.entries(sources).filter(([path]) => path.endsWith('.css'));
    expect(css.length).toBeGreaterThan(5);
    expect(css.filter(([, text]) => !text.trim()).map(([path]) => path)).toEqual([]);
  });

  it(`소스 파일이 ${MAX_LINES}줄을 넘지 않는다 (넘으면 컴포넌트 단위로 쪼갠다)`, () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10);

    // 문서에만 적어두면 안 지켜진다. 넘긴 파일 이름을 직접 보여준다
    const tooLong = Object.entries(sources)
      .map(([path, text]) => [path, text.split('\n').length] as const)
      .filter(([, lines]) => lines > MAX_LINES)
      .map(([path, lines]) => `${path} (${lines}줄)`);

    expect(tooLong).toEqual([]);
  });

  // WebKit 은 repeat() 안의 var() 를 computed-value 시점에 한 번 펼쳐 캐싱한다
  // (webkit#202259). 값이 바뀌는 곳에 쓰면 난이도를 오갔다 돌아왔을 때 옛 폭이 남는다
  it('스타일 어디에도 repeat() 안의 var() 가 없다 (Safari)', () => {
    const bad = Object.entries(sources)
      .filter(([path]) => path.endsWith('.css'))
      .filter(([, text]) => /repeat\(\s*var\(/.test(text))
      .map(([path]) => path);

    expect(bad).toEqual([]);
  });
});
