import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generatePuzzle } from './generate';
import Board from '../components/Board';
import FeedbackDialog, { issueUrl } from '../components/FeedbackDialog';
import { indexScene, matchingCells, satisfies } from './clues';
import { solve } from './solve';
import type { Room, Furniture, WallItem } from './types';
import { FURNITURE } from '../data/content';

describe('generatePuzzle', () => {
  for (const n of [4, 5, 6]) {
    it(`${n}x${n}: 해가 정확히 1개이고 정답이 모든 증언을 만족한다`, () => {
      for (let i = 0; i < 8; i++) {
        const p = generatePuzzle(n, `seed-${n}-${i}`);
        const idx = indexScene(p);

        expect(Object.keys(p.solution)).toHaveLength(n);
        expect(p.people).toHaveLength(n);
        expect(p.clues).toHaveLength(n - 1);

        // 증언이 모호해지지 않으려면 가구/방 이름이 유일해야 한다
        const labels = [...p.furniture.map((f) => f.label), ...p.wallItems.map((w) => w.label)];
        expect(new Set(labels).size).toBe(labels.length);
        expect(new Set(p.rooms.map((r) => r.name)).size).toBe(p.rooms.length);

        // 서로 다른 행/열
        const cells = Object.values(p.solution);
        expect(new Set(cells.map((c) => c.r)).size).toBe(n);
        expect(new Set(cells.map((c) => c.c)).size).toBe(n);

        // 사람이 설 수 있는 칸에만 있다
        for (const c of cells) expect(idx.free[c.r][c.c]).toBe(true);

        // 증언 정합
        for (const clue of p.clues) expect(satisfies(clue, p.solution[clue.personId], idx)).toBe(true);

        // 유일해, 그리고 그 해가 정답
        const sols = solve(p.people, p.clues, idx, 2);
        expect(sols).toHaveLength(1);
        expect(sols[0]).toEqual(p.solution);

        // 피해자 방의 용의자는 정확히 1명 = 범인
        const vc = p.solution.V;
        const vRoom = idx.roomAt[vc.r][vc.c];
        const inRoom = p.people.filter(
          (pe) => !pe.isVictim && idx.roomAt[p.solution[pe.id].r][p.solution[pe.id].c] === vRoom,
        );
        expect(inRoom.map((pe) => pe.id)).toEqual([p.culpritId]);

        // 방마다 용의자는 한 명까지
        const perRoom = new Map<number, number>();
        for (const pe of p.people) {
          if (pe.isVictim) continue;
          const c = p.solution[pe.id];
          const rm = idx.roomAt[c.r][c.c];
          perRoom.set(rm, (perRoom.get(rm) ?? 0) + 1);
        }
        expect([...perRoom.values()]).toEqual(Array(perRoom.size).fill(1));

        // 방마다 가구가 최소 1개, 그리고 그 방에 어울리는 가구만
        const specOf = new Map(FURNITURE.map((f) => [f.label, f]));
        for (const room of p.rooms) {
          const here = p.furniture.filter((f) =>
            f.cells.some((c) => idx.roomAt[c.r][c.c] === room.id),
          );
          expect(here.length).toBeGreaterThan(0);
          for (const f of here) {
            const allowed = specOf.get(f.label)!.rooms;
            if (allowed) expect(allowed).toContain(room.name);
          }
        }
      }
    });
  }

  it('같은 시드는 같은 퍼즐을 만든다', () => {
    expect(generatePuzzle(5, 'fixed')).toEqual(generatePuzzle(5, 'fixed'));
  });
});

describe('matchingCells', () => {
  // 4x4, 위 2행 = 거실(0), 아래 2행 = 침실(1)
  const cellsOf = (r0: number, r1: number) => {
    const out = [];
    for (let r = r0; r <= r1; r++) for (let c = 0; c < 4; c++) out.push({ r, c });
    return out;
  };
  const rooms: Room[] = [
    { id: 0, name: '거실', cells: cellsOf(0, 1) },
    { id: 1, name: '침실', cells: cellsOf(2, 3) },
  ];
  const furniture: Furniture[] = [
    { id: 'table', label: '탁자', emoji: '🪑', cells: [{ r: 1, c: 1 }], standable: false },
    { id: 'bed', label: '침대', emoji: '🛏️', cells: [{ r: 2, c: 1 }, { r: 3, c: 1 }], standable: true },
  ];
  const wallItems: WallItem[] = [
    { id: 'win', kind: 'window', label: '창문', emoji: '🪟', cell: { r: 2, c: 3 }, side: 'right' },
  ];
  const idx = indexScene({ n: 4, rooms, furniture, wallItems });
  const has = (cells: { r: number; c: number }[], r: number, c: number) =>
    cells.some((x) => x.r === r && x.c === c);

  it('ON: standable 위엔 설 수 있고 blocking 위엔 못 선다', () => {
    expect(matchingCells('ON', 'bed', idx)).toHaveLength(2);
    expect(matchingCells('ON', 'table', idx)).toHaveLength(0);
  });

  it('ON: 벽 부착물 "앞"은 그 칸', () => {
    expect(matchingCells('ON', 'win', idx)).toEqual([{ r: 2, c: 3 }]);
  });

  it('NEXT_TO: 방 경계를 넘지 않는다', () => {
    const next = matchingCells('NEXT_TO', 'table', idx);
    expect(has(next, 0, 1)).toBe(true); // 같은 방 위쪽
    expect(has(next, 2, 1)).toBe(false); // 아래는 침실 → 제외
    expect(has(next, 1, 1)).toBe(false); // 대상 칸 자체는 "옆"이 아님
  });

  it('NEXT_TO: 여러 칸 가구는 모든 칸 기준으로 인접', () => {
    const next = matchingCells('NEXT_TO', 'bed', idx);
    expect(has(next, 2, 0)).toBe(true);
    expect(has(next, 3, 2)).toBe(true);
    expect(has(next, 1, 1)).toBe(false); // 방이 다름
  });

  it('IN_ROOM: 설 수 있는 칸만 돌려준다', () => {
    expect(matchingCells('IN_ROOM', '0', idx)).toHaveLength(7); // 8칸 - 탁자 1칸
  });

  describe('solve 방 제약', () => {
    const suspect = (id: string) => ({ id, name: id, color: '#000', isVictim: false });
    const victim = { id: 'V', name: 'V', color: '#000', isVictim: true };

    it('용의자 수가 방 수보다 많으면 해가 없다 (방마다 한 명까지)', () => {
      const people = [suspect('A'), suspect('B'), suspect('C'), victim];
      expect(solve(people, [], idx, 2)).toHaveLength(0); // 방은 2개뿐
    });

    it('방마다 한 명씩이고 피해자 방에 용의자가 정확히 1명인 해만 나온다', () => {
      const people = [suspect('A'), suspect('B'), victim];
      const sols = solve(people, [], idx, 500);
      expect(sols.length).toBeGreaterThan(0);
      for (const s of sols) {
        const roomOf = (id: string) => idx.roomAt[s[id].r][s[id].c];
        expect(roomOf('A')).not.toBe(roomOf('B'));
        expect([roomOf('A'), roomOf('B')]).toContain(roomOf('V'));
      }
    });
  });
});

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

  it('메모는 공개 전에만 보인다', () => {
    expect(render(false, { '0,0': 'X' }).html).toContain('✕');
    expect(render(true, { '0,0': 'X' }).html).not.toContain('✕');
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
