import { describe, expect, it } from 'vitest';
import { indexScene, matchingCells } from './clues';
import { solve } from './solve';
import type { Room, Furniture, WallItem } from './types';

describe('matchingCells', () => {
  // 4x4, 위 2행 = 거실(0), 아래 2행 = 침실(1)
  const cellsOf = (r0: number, r1: number) => {
    const out = [];
    for (let r = r0; r <= r1; r++) for (let c = 0; c < 4; c++) out.push({ r, c });
    return out;
  };
  const rooms: Room[] = [
    { id: 0, name: '거실', floor: 'wood', cells: cellsOf(0, 1) },
    { id: 1, name: '침실', floor: 'carpet', cells: cellsOf(2, 3) },
  ];
  const furniture: Furniture[] = [
    { id: 'table', kind: 'table', label: '탁자', emoji: '🪑', cells: [{ r: 1, c: 1 }], standable: false },
    { id: 'bed', kind: 'bed', label: '침대', emoji: '🛏️', cells: [{ r: 2, c: 1 }, { r: 3, c: 1 }], standable: true },
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
    const suspect = (id: string) => ({ id, name: id, role: '집사', color: '#000', isVictim: false });
    const victim = { id: 'V', name: 'V', role: '집사', color: '#000', isVictim: true };

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
