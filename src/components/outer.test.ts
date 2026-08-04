import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generatePuzzle } from '../game/generate';
import { indexScene } from '../game/clues';
import type { Cell } from '../game/types';
import { THEMES } from '../data/content';
import Board from './Board';
import OuterPet from './OuterPet';
import { outerBlobs } from './outerBlobs';
import { petMenuItems } from './petMenuItems';
import sprite from '../assets/sprite.svg?raw';
import indexCss from '../index.css?raw';
import outerCss from '../styles/outer.css?raw';

const noop = () => {};
const MENU = petMenuItems({
  onHelp: noop,
  onRank: noop,
  onName: noop,
  onNew: noop,
  onClear: noop,
});

const outerOf = (p: ReturnType<typeof generatePuzzle>): Cell[] => {
  const idx = indexScene(p);
  const cells: Cell[] = [];
  for (let r = 0; r < p.n; r++)
    for (let c = 0; c < p.n; c++) if (idx.voidKind[r][c] === 'outer') cells.push({ r, c });
  return cells;
};

/** 바깥이 파인 사건을 찾는다. `square` 도 `donut` 도 아닌 실루엣만 해당된다 */
function carvedCase(n = 6, blobs = 1) {
  for (let i = 0; i < 400; i++) {
    const p = generatePuzzle(n, `carve-${i}`);
    const cells = outerOf(p);
    if (cells.length && outerBlobs(cells).length === blobs) return { p, cells };
  }
  throw new Error(`덩어리 ${blobs}개짜리 바깥을 못 찾았다 — 실루엣 마스크가 죽었는지 확인할 것`);
}

const draw = (p: ReturnType<typeof generatePuzzle>, revealed = false) =>
  renderToStaticMarkup(
    createElement(Board, { puzzle: p, marks: {}, onCell: noop, revealed, petMenu: MENU }),
  );

describe('바깥 덩어리 가르기', () => {
  it('상하좌우로 붙은 칸만 한 덩어리다 (대각선은 남남)', () => {
    const diag: Cell[] = [
      { r: 0, c: 0 },
      { r: 1, c: 1 },
    ];
    expect(outerBlobs(diag)).toHaveLength(2);
  });

  it('ㄱ자로 이어진 칸은 한 덩어리다', () => {
    const bent: Cell[] = [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 1, c: 1 },
    ];
    const got = outerBlobs(bent);
    expect(got).toHaveLength(1);
    expect(got[0]).toHaveLength(3);
  });

  it('큰 덩어리가 앞에 온다 — 손님을 둘까지만 두므로 넓은 쪽이 먼저다', () => {
    const two: Cell[] = [
      { r: 5, c: 5 },
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 1, c: 0 },
    ];
    const got = outerBlobs(two);
    expect(got.map((b) => b.length)).toEqual([3, 1]);
  });

  it('덩어리 안의 칸은 행→열 순서다 (첫 자리가 흔들리면 안 된다)', () => {
    const messy: Cell[] = [
      { r: 1, c: 1 },
      { r: 0, c: 1 },
      { r: 0, c: 0 },
    ];
    expect(outerBlobs(messy)[0]).toEqual([
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 1, c: 1 },
    ]);
  });

  it('입력 배열을 건드리지 않는다', () => {
    const cells: Cell[] = [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
    ];
    const copy = cells.slice();
    outerBlobs(cells);
    expect(cells).toEqual(copy);
  });
});

describe('바깥 손님 렌더링', () => {
  it('바깥이 파여 있으면 손님이 선다', () => {
    const { p } = carvedCase(6);
    expect(draw(p)).toContain('class="outer-pet');
  });

  it('테마가 정한 손님을 그린다', () => {
    const { p } = carvedCase(6);
    const html = draw(p);
    const kinds = p.theme.visitors.map((v) => v.kind);
    expect(kinds.some((k) => html.includes(`#i-${k}`))).toBe(true);
  });

  it('손님은 늘 바깥 칸 위에만 선다 — 진짜 칸을 먹으면 안 된다', () => {
    for (const n of [5, 6, 7]) {
      const { p } = carvedCase(n);
      const outside = new Set(outerOf(p).map((c) => `${c.r},${c.c}`));
      const html = draw(p);
      const spots = [...html.matchAll(/left:([\d.]+)%;top:([\d.]+)%/g)];
      expect(spots.length).toBeGreaterThan(0);
      for (const m of spots) {
        const c = Math.round((Number(m[1]) * n) / 100);
        const r = Math.round((Number(m[2]) * n) / 100);
        expect(outside.has(`${r},${c}`)).toBe(true);
      }
    }
  });

  it('걸음이 어디로 가든 덩어리 밖으로는 못 나간다', () => {
    const { p } = carvedCase(6);
    const blob = outerBlobs(outerOf(p))[0];
    const inside = new Set(blob.map((c) => `${c.r},${c.c}`));
    // 실제 걸음은 nextStep 이 정한다. 덩어리 안의 어느 칸에서 시작해도 이웃은 늘 덩어리 안이다
    for (const cell of blob) {
      const nb = blob.filter(
        (o) => Math.abs(o.r - cell.r) + Math.abs(o.c - cell.c) === 1,
      );
      for (const o of nb) expect(inside.has(`${o.r},${o.c}`)).toBe(true);
    }
  });

  it('손님 상자는 정확히 한 칸이다', () => {
    const { p } = carvedCase(6);
    const one = (100 / p.n).toFixed(4);
    const html = draw(p);
    const pet = html.slice(html.indexOf('class="outer-pet'));
    expect(pet).toContain(`width:${one}%;height:${one}%`);
  });

  it('자리는 보드 기준 퍼센트다 — translate 퍼센트는 WebKit 이 제 상자를 정수 px 로 스냅한다', () => {
    const { p } = carvedCase(6);
    const html = draw(p);
    const pet = html.slice(html.indexOf('class="outer-pet'));
    const box = pet.slice(0, pet.indexOf('>'));
    expect(box).toMatch(/left:[\d.]+%;top:[\d.]+%/);
    expect(box).not.toContain('translate:');
  });

  it('마주보는 두 모서리가 파이면 서로 다른 손님이 하나씩 온다', () => {
    const { p } = carvedCase(7, 2);
    const html = draw(p);
    expect((html.match(/class="outer-pet/g) ?? []).length).toBe(2);
    const kinds = p.theme.visitors.filter((v) => html.includes(`#i-${v.kind}`));
    expect(kinds).toHaveLength(2);
  });

  it('손님은 버튼이다 — 우클릭 메뉴를 열려면 포커스도 받아야 한다', () => {
    const { p } = carvedCase(6);
    const html = draw(p);
    const pet = html.slice(html.indexOf('<button type="button" class="outer-pet'));
    const tag = pet.slice(0, pet.indexOf('>'));
    expect(tag).toContain('aria-haspopup="menu"');
    expect(tag).toMatch(/aria-label="[^"]+ — 눌러서 말 걸기"/);
  });

  it('메뉴는 닫힌 채로 시작한다 (열려 있으면 보드를 가린다)', () => {
    expect(draw(carvedCase(6).p)).not.toContain('class="petmenu"');
  });

  it('정답을 공개하면 물러난다', () => {
    const { p } = carvedCase(6);
    expect(draw(p, true)).not.toContain('outer-pet');
  });

  it('바깥이 안 파인 사건에는 손님이 없다', () => {
    // square 마스크만 걸리는 시드를 찾는다
    for (let i = 0; i < 400; i++) {
      const p = generatePuzzle(5, `flat-${i}`);
      if (outerOf(p).length) continue;
      expect(draw(p)).not.toContain('outer-pet');
      return;
    }
    throw new Error('바깥이 안 파인 사건을 못 찾았다');
  });

  it('메뉴를 안 주면 손님도 없다 — 우클릭할 게 없는 손님은 반쪽이다', () => {
    const { p } = carvedCase(6);
    const html = renderToStaticMarkup(
      createElement(Board, { puzzle: p, marks: {}, onCell: noop, revealed: false }),
    );
    expect(html).not.toContain('outer-pet');
  });

  it('같은 시드는 같은 손님을 같은 자리에 세운다', () => {
    const { p } = carvedCase(6);
    expect(draw(p)).toBe(draw(generatePuzzle(p.n, p.seed)));
  });
});

describe('손님 콘텐츠', () => {
  it('테마마다 손님이 둘이고 그림이 있다', () => {
    for (const theme of THEMES) {
      expect(theme.visitors).toBeDefined();
      expect(theme.visitors).toHaveLength(2);
      for (const v of theme.visitors) {
        expect(v.label.length).toBeGreaterThan(0);
        expect(sprite).toContain(`id="i-${v.kind}"`);
      }
    }
  });

  it('손님마다 할 말이 여럿이다 (하나면 두 번째 클릭이 심심하다)', () => {
    for (const theme of THEMES)
      for (const v of theme.visitors) expect(v.says.length).toBeGreaterThanOrEqual(3);
  });

  it('같은 테마 안에서 손님 종류가 겹치지 않는다', () => {
    for (const theme of THEMES) {
      const kinds = theme.visitors.map((v) => v.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
    }
  });

  it('안뜰 짐승과 이름이 겹치지 않는다 (같은 그림이 두 뜻을 가지면 안 된다)', () => {
    for (const theme of THEMES)
      for (const v of theme.visitors) expect(v.kind).not.toBe(theme.courtyard.pet.kind);
  });
});

describe('손님 메뉴', () => {
  it('다섯 갈래다 — 도움말·순위·닉네임·새 사건·메모 지우기', () => {
    expect(MENU.map((m) => m.id)).toEqual(['help', 'rank', 'name', 'new', 'clear']);
  });

  it('고르면 그 콜백을 부른다', () => {
    const spies = {
      onHelp: vi.fn(),
      onRank: vi.fn(),
      onName: vi.fn(),
      onNew: vi.fn(),
      onClear: vi.fn(),
    };
    const items = petMenuItems(spies);
    for (const it of items) it.run();
    for (const fn of Object.values(spies)) expect(fn).toHaveBeenCalledTimes(1);
  });

  it('항목마다 이름과 그림이 있다', () => {
    for (const it of MENU) {
      expect(it.label.length).toBeGreaterThan(0);
      expect(it.emoji.length).toBeGreaterThan(0);
    }
  });
});

describe('outer.css 불변식', () => {
  it('yard.css 다음에 인라인된다 (import 순서 = 캐스케이드 순서)', () => {
    expect(indexCss.indexOf('outer.css')).toBeGreaterThan(indexCss.indexOf('yard.css'));
    expect(indexCss.indexOf('outer.css')).toBeLessThan(indexCss.indexOf('mobile.css'));
  });

  it('손님이 직접 포인터를 받는다 — 판이 없으니 그림이 가로채면 안 눌린다', () => {
    const block = outerCss.slice(outerCss.indexOf('.outer-pet {'));
    expect(block.slice(0, block.indexOf('}'))).not.toContain('pointer-events: none');
  });

  it('길게 누르기를 iOS 기본 동작이 가로채지 않게 막는다', () => {
    const block = outerCss.slice(outerCss.indexOf('.outer-pet {'), outerCss.indexOf('}'));
    expect(block).toContain('-webkit-touch-callout: none');
    expect(block).toContain('user-select: none');
  });

  it('메뉴 폭이 PetMenu.tsx 가 접어 넣을 때 쓰는 값과 같다', async () => {
    const src = await import('./PetMenu?raw').then((m) => m.default as string);
    const w = /const MENU_W = (\d+)/.exec(src)?.[1];
    expect(w).toBeDefined();
    expect(outerCss).toContain(`width: ${w}px`);
  });

  it('메뉴는 딤을 깔지 않는다 — 보드를 보면서 고르는 메뉴다', () => {
    const block = outerCss.slice(outerCss.indexOf('.petmenu::backdrop'));
    expect(block.slice(0, block.indexOf('}'))).toContain('transparent');
  });
});

describe('OuterPet 단독 렌더', () => {
  const blob: Cell[] = [
    { r: 0, c: 0 },
    { r: 0, c: 1 },
    { r: 1, c: 0 },
  ];

  it('그림 하나만 그린다 — 안뜰과 달리 덮는 판이 없다', () => {
    const html = renderToStaticMarkup(
      createElement(OuterPet, {
        cells: blob,
        n: 6,
        visitor: THEMES[0].visitors[0],
        seed: 'solo',
        menu: MENU,
        onSay: noop,
      }),
    );
    expect((html.match(/<button/g) ?? []).length).toBe(1);
    expect(html).not.toContain('plate');
    expect(html).not.toContain('gap');
  });

  it('한가운데 칸에서 시작한다', () => {
    const html = renderToStaticMarkup(
      createElement(OuterPet, {
        cells: blob,
        n: 6,
        visitor: THEMES[0].visitors[0],
        seed: 'solo',
        menu: MENU,
        onSay: noop,
      }),
    );
    const mid = blob[Math.floor(blob.length / 2)];
    expect(html).toContain(`left:${((mid.c * 100) / 6).toFixed(4)}%;top:${((mid.r * 100) / 6).toFixed(4)}%`);
  });
});
