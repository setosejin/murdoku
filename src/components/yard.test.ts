import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generatePuzzle } from '../game/generate';
import { indexScene } from '../game/clues';
import { rng, type Cell } from '../game/types';
import { THEMES } from '../data/content';
import Board from './Board';
import YardPet from './YardPet';
import { nextStep, type Pose } from './yardWalk';
import sprite from '../assets/sprite.svg?raw';
import indexCss from '../index.css?raw';
import yardCss from '../styles/yard.css?raw';

/** 안뜰(갇힌 빈 칸)이 있는 사건을 찾는다. `donut` 마스크가 걸린 시드만 해당된다 */
function yardCase(n = 6) {
  for (let i = 0; i < 400; i++) {
    const p = generatePuzzle(n, `yard-${i}`);
    const idx = indexScene(p);
    const cells: Cell[] = [];
    for (let r = 0; r < p.n; r++)
      for (let c = 0; c < p.n; c++) if (idx.voidKind[r][c] === 'inner') cells.push({ r, c });
    if (cells.length) return { p, cells };
  }
  throw new Error('안뜰이 있는 사건을 못 찾았다 — donut 마스크가 죽었는지 확인할 것');
}

const draw = (n: number, revealed = false) => {
  const { p, cells } = yardCase(n);
  const html = renderToStaticMarkup(
    createElement(Board, { puzzle: p, marks: {}, onCell: () => {}, revealed }),
  );
  return { p, cells, html };
};

describe('안뜰 짐승의 걸음', () => {
  const row = (len: number): Cell[] =>
    Array.from({ length: len }, (_, c) => ({ r: 2, c: c + 1 }));
  const square = (): Cell[] => [
    { r: 1, c: 1 },
    { r: 1, c: 2 },
    { r: 2, c: 1 },
    { r: 2, c: 2 },
  ];

  it('상하좌우로 붙은 칸으로만 옮긴다', () => {
    const cells = square();
    const rand = rng('walk');
    let at = 0;
    let pose: Pose = 'stand';
    for (let i = 0; i < 200; i++) {
      const step = nextStep(cells, at, pose, rand);
      const d =
        Math.abs(cells[step.at].r - cells[at].r) + Math.abs(cells[step.at].c - cells[at].c);
      expect(d).toBe(1);
      at = step.at;
      pose = step.pose;
    }
  });

  it('가로로 움직인 방향만 바라본다 (세로 이동은 보던 쪽 그대로)', () => {
    const cells = square();
    const rand = rng('facing');
    let at = 0;
    let pose: Pose = 'stand';
    for (let i = 0; i < 200; i++) {
      const step = nextStep(cells, at, pose, rand);
      const dc = cells[step.at].c - cells[at].c;
      expect(step.facing).toBe(dc > 0 ? 1 : dc < 0 ? -1 : 0);
      at = step.at;
      pose = step.pose;
    }
  });

  it('1칸짜리 안뜰에서는 제자리에서 자세만 바꾼다', () => {
    const one = [{ r: 3, c: 3 }];
    const rand = rng('one');
    let pose: Pose = 'stand';
    for (let i = 0; i < 10; i++) {
      const step = nextStep(one, 0, pose, rand);
      expect(step.at).toBe(0);
      expect(step.facing).toBe(0);
      expect(step.pose).not.toBe(pose);
      pose = step.pose;
    }
  });

  it('일자 안뜰의 끝에서는 되돌아온다 (갈 곳이 하나뿐)', () => {
    const cells = row(3);
    expect(nextStep(cells, 0, 'stand', rng('a')).at).toBe(1);
    expect(nextStep(cells, 2, 'stand', rng('b')).at).toBe(1);
  });

  it('같은 시드는 같은 산책을 낸다', () => {
    const cells = square();
    const walk = (seed: string) => {
      const rand = rng(seed);
      let at = 0;
      let pose: Pose = 'stand';
      return Array.from({ length: 30 }, () => {
        const step = nextStep(cells, at, pose, rand);
        at = step.at;
        pose = step.pose;
        return `${step.at}${step.pose}${step.facing}`;
      }).join('|');
    };
    expect(walk('same')).toBe(walk('same'));
    expect(walk('same')).not.toBe(walk('other'));
  });
});

describe('안뜰 짐승 렌더링', () => {
  it('안뜰이 있으면 짐승과 판을 한 벌씩 그린다', () => {
    const { html } = draw(6);
    expect((html.match(/class="yard-pet/g) ?? []).length).toBe(1);
    expect((html.match(/class="yard-plate"/g) ?? []).length).toBe(1);
  });

  it('테마가 정한 짐승을 그린다 (앉은 자세로 시작)', () => {
    const { p, html } = draw(6);
    expect(html).toContain(`#i-${p.theme.courtyard.pet.kind}-sit`);
    expect(html).toContain(`aria-label="${p.theme.courtyard.pet.label}"`);
  });

  it('짐승은 안뜰 한가운데 칸에 선다', () => {
    const { cells, html } = draw(6);
    const mid = cells[Math.floor(cells.length / 2)];
    expect(html).toContain(`translate:${mid.c * 100}% ${mid.r * 100}%`);
  });

  it('짐승 상자는 정확히 한 칸이다 (translate 의 100% 가 한 칸이 되도록)', () => {
    const { p, html } = draw(6);
    const one = ((100 / p.n) as number).toFixed(4);
    expect(html).toContain(`width:${one}%;height:${one}%`);
  });

  it('판은 안뜰 밖으로 새지 않는다 — 진짜 칸의 클릭을 먹으면 안 된다', () => {
    const { p, cells, html } = draw(6);
    const r0 = Math.min(...cells.map((c) => c.r));
    const c0 = Math.min(...cells.map((c) => c.c));
    const r1 = Math.max(...cells.map((c) => c.r));
    const c1 = Math.max(...cells.map((c) => c.c));
    const pct = (x: number) => (((x * 100) / p.n) as number).toFixed(4);
    expect(html).toContain(
      `left:${pct(c0)}%;top:${pct(r0)}%;width:${pct(c1 - c0 + 1)}%;height:${pct(r1 - r0 + 1)}%`,
    );
    // 트랙 수는 인라인으로 박는다 — repeat() 안의 var() 는 Safari 가 캐싱한다
    expect(html).toContain(`grid-template-columns:repeat(${c1 - c0 + 1}, minmax(0, 1fr))`);
  });

  it('판은 bounding box 를 빠짐없이 채운다', () => {
    const { cells, html } = draw(6);
    const rest = html.slice(html.indexOf('class="yard-plate"'));
    const r1 = Math.max(...cells.map((c) => c.r)) - Math.min(...cells.map((c) => c.r)) + 1;
    const c1 = Math.max(...cells.map((c) => c.c)) - Math.min(...cells.map((c) => c.c)) + 1;
    expect((rest.match(/<span/g) ?? []).length).toBe(r1 * c1);
  });

  it('ㄱ자 안뜰이면 파인 자리를 죽은 칸으로 덮는다 — 진짜 칸의 클릭을 먹으면 안 된다', () => {
    // donut 마스크는 직사각형만 만들지만, 판 자체는 모양을 안 가린다
    const bent: Cell[] = [
      { r: 1, c: 1 },
      { r: 1, c: 2 },
      { r: 2, c: 1 },
    ];
    const html = renderToStaticMarkup(
      createElement(YardPet, {
        cells: bent,
        n: 6,
        pet: THEMES[0].courtyard.pet,
        seed: 'bent',
        onPoke: () => {},
      }),
    );
    expect((html.match(/<span/g) ?? []).length).toBe(2 + 4); // 짐승 + 판 + 2×2
    expect((html.match(/yard-gap/g) ?? []).length).toBe(1);
  });

  it('짐승도 판도 보조기술에는 안 보인다 (안뜰 이름표가 이미 말한다)', () => {
    const { html } = draw(6);
    const pet = html.slice(html.indexOf('class="yard-pet'));
    expect(pet.slice(0, pet.indexOf('>'))).toContain('aria-hidden="true"');
    const plate = html.slice(html.indexOf('class="yard-plate"'));
    expect(plate.slice(0, plate.indexOf('>'))).toContain('aria-hidden="true"');
  });

  it('정답을 공개하면 물러난다', () => {
    const { html } = draw(6, true);
    expect(html).not.toContain('yard-pet');
    expect(html).not.toContain('yard-plate');
  });

  it('안뜰이 없는 사건에는 아무것도 없다', () => {
    // 4×4 는 donut 마스크가 안 걸린다 (minN = 5)
    const p = generatePuzzle(4, 'no-yard');
    const html = renderToStaticMarkup(
      createElement(Board, { puzzle: p, marks: {}, onCell: () => {}, revealed: false }),
    );
    expect(html).not.toContain('yard-pet');
    expect(html).not.toContain('yard-plate');
  });
});

describe('안뜰 콘텐츠', () => {
  it('테마마다 안뜰 주인이 있고 그림이 두 자세 다 있다', () => {
    for (const theme of THEMES) {
      const pet = theme.courtyard.pet;
      expect(pet.label.length).toBeGreaterThan(0);
      expect(sprite).toContain(`id="i-${pet.kind}"`);
      expect(sprite).toContain(`id="i-${pet.kind}-sit"`);
    }
  });

  it('안내문이 안뜰 이름을 부른다 (조사 때문에 문장을 통째로 둔다)', () => {
    for (const theme of THEMES) {
      expect(theme.courtyard.pet.deny).toContain(theme.courtyard.label);
      expect(theme.courtyard.pet.deny).toContain(theme.courtyard.pet.label);
    }
  });
});

describe('yard.css 불변식', () => {
  it('board.css 다음에 인라인된다 (import 순서 = 캐스케이드 순서)', () => {
    expect(indexCss.indexOf('yard.css')).toBeGreaterThan(indexCss.indexOf('board.css'));
    expect(indexCss.indexOf('yard.css')).toBeLessThan(indexCss.indexOf('mobile.css'));
  });

  it('그림은 포인터를 가로채지 않는다 — 판이 받아야 안뜰 전체가 반응한다', () => {
    const block = yardCss.slice(yardCss.indexOf('.yard-pet {'));
    expect(block.slice(0, block.indexOf('}'))).toContain('pointer-events: none');
  });

  it('.board 가 위치 기준이다 (없으면 짐승이 페이지 좌상단으로 날아간다)', () => {
    expect(yardCss).toContain('position: absolute');
  });
});
