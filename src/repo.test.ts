import { describe, expect, it } from 'vitest';
import sprite from './assets/sprite.svg?raw';
import { THEMES } from './data/content';

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

describe('스프라이트', () => {
  // 가구 그림은 발자국 비율대로 그려져 있다. size 만 올리고 그림을 그대로 두면
  // 늘어나거나(예전) 남는 자리에 letterbox 되어 조용히 어색해진다 — 여기서 잡는다
  it('가구 아이콘의 viewBox 가 발자국 비율과 같다', () => {
    const boxes = new Map(
      [...sprite.matchAll(/id="i-([\w-]+)"\s+viewBox="0 0 ([\d.]+) ([\d.]+)"/g)].map((m) => [
        m[1],
        `${m[2]}x${m[3]}`,
      ]),
    );
    // size 4 는 2×2 다 (generate.ts 의 SHAPES)
    const want = (size: number) =>
      size === 4 ? '48x48' : `${24 * size}x24`;

    expect(boxes.size).toBeGreaterThan(15);
    for (const theme of THEMES)
      for (const spec of theme.furniture) {
        if (!boxes.has(spec.kind)) continue; // 이모지로 떨어지는 가구는 그림이 없다
        expect(`${spec.label} ${boxes.get(spec.kind)}`).toBe(`${spec.label} ${want(spec.size)}`);
      }
  });
});
