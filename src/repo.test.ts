import { describe, expect, it } from 'vitest';

const MAX_LINES = 500;

// Vite 가 빌드 시점에 소스를 문자열로 심는다. node:fs 를 쓰면 @types/node 가 필요해진다
const sources = import.meta.glob('/{src,worker}/**/*.{ts,tsx,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('저장소 규약', () => {
  it(`소스 파일이 ${MAX_LINES}줄을 넘지 않는다 (넘으면 컴포넌트 단위로 쪼갠다)`, () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10);

    // 문서에만 적어두면 안 지켜진다. 넘긴 파일 이름을 직접 보여준다
    const tooLong = Object.entries(sources)
      .map(([path, text]) => [path, text.split('\n').length] as const)
      .filter(([, lines]) => lines > MAX_LINES)
      .map(([path, lines]) => `${path} (${lines}줄)`);

    expect(tooLong).toEqual([]);
  });
});
