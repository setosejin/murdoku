import { describe, expect, it } from 'vitest';
import sprite from './assets/sprite.svg?raw';
import html from '../index.html?raw';
import { THEMES } from './data/content';
import { FLOOR_KINDS } from './game/types';

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

  // FloorKind 에만 넣고 CSS 를 안 그리면 그 방은 조용히 기본 타일색으로 깔린다.
  // 눈으로 보기 전까지 아무도 모르므로 값 목록과 스타일을 직접 맞춰 본다
  it('바닥 재질마다 질감이 있다', () => {
    // 키가 '/src/styles/board.css' 지만 glob 패턴이 바뀌어도 조용히 undefined 가
    // 되지 않게 끝자락으로 찾는다
    const board = Object.entries(sources).find(([p]) => p.endsWith('/styles/board.css'))?.[1];
    expect(board, 'board.css 를 못 읽었다').toBeTruthy();
    for (const kind of FLOOR_KINDS)
      expect(board, `${kind} 바닥에 스타일이 없다`).toContain(`[data-floor='${kind}']`);
  });
});

// 링크 미리보기(카카오톡·트위터)는 배포 후 실물로 확인하기 전까지 깨진 걸 알 수 없다.
// 여기서 막는 건 조용히 깨지는 세 가지다 — 상대 경로화, SVG 교체, 주소 불일치
describe('링크 미리보기 (Open Graph)', () => {
  const meta = (prop: string) =>
    html.match(new RegExp(`<meta\\s+property="${prop}"\\s+content="([^"]*)"`))?.[1];

  const SITE = 'https://setosejin.github.io/murdoku/';

  it('og:url 이 실제 배포 주소와 같다', () => {
    // 카카오는 og:url 이 공유한 주소와 다르면 그쪽 메타데이터를 다시 긁는다
    expect(meta('og:url')).toBe(SITE);
  });

  // vite 의 base 가 './' 라 favicon 처럼 상대 경로로 "정리"되기 쉬운데,
  // 스크래퍼는 상대 경로를 해석하지 않아서 이미지가 통째로 빠진다
  it('og:image 가 절대 URL 이고 카카오가 읽는 포맷이다', () => {
    const src = meta('og:image') ?? '';
    expect(src.startsWith(`${SITE}og.png`)).toBe(true);
    // 카카오는 JPG/PNG 만 긁는다. favicon 처럼 SVG 로 바꾸면 미리보기가 빈다
    expect(src).not.toMatch(/\.svg/);
  });

  it('선언한 크기가 카카오가 크롭하는 2:1 이다', () => {
    const w = Number(meta('og:image:width'));
    const h = Number(meta('og:image:height'));
    expect(w / h).toBe(2);
  });

  it('og.png 가 선언한 크기 그대로 존재한다', async () => {
    // node:fs 를 안 쓰는 이유는 위 sources 와 같다 (tsconfig 에 node 타입이 없다).
    // ?inline 은 파일을 data URI 로 넣어주므로 바이트를 그대로 볼 수 있다
    const dataUri = (await import('../public/og.png?inline')).default;
    const bytes = Uint8Array.from(atob(dataUri.split(',')[1]), (c) => c.charCodeAt(0));
    // PNG 는 IHDR 이 늘 첫 청크다 — 폭·높이가 바이트 16..24 에 빅엔디언으로 박혀 있다
    const read = (i: number) => new DataView(bytes.buffer).getUint32(i);
    expect([read(16), read(20)]).toEqual([
      Number(meta('og:image:width')),
      Number(meta('og:image:height')),
    ]);
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
