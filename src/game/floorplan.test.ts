import { describe, expect, it } from 'vitest';
import { MASKS, buildFloorplan, connected } from './floorplan';
import { indexScene } from './clues';
import { DIFFICULTIES } from './generate';
import { THEMES } from '../data/content';
import { key, rng } from './types';
import type { Cell } from './types';

const SIZES = DIFFICULTIES.map((d) => d.n);
const SEEDS = 200;

/** 실루엣 하나를 방 하나로 감싸 voidKind 를 얻는다 */
function scan(n: number, holes: Set<string>) {
  const cells: Cell[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (!holes.has(`${r},${c}`)) cells.push({ r, c });
  const idx = indexScene({
    n,
    rooms: [{ id: 0, name: '전체', floor: 'wood', cells }],
    furniture: [],
    wallItems: [],
  });
  return { cells, idx };
}

/**
 * 행 하나에 사람 하나, 열도 겹치지 않게 놓을 수 있는가 (이분 완전 매칭).
 * 마스크가 어떤 행·열을 통째로 비우거나 남은 칸이 몰리면 배치가 원천 불가능해지는데,
 * 그러면 generatePuzzle 이 에러 없이 300×20×60 회 되던지다 끝에서야 throw 한다.
 */
function hasPerfectMatching(n: number, ok: (r: number, c: number) => boolean): boolean {
  const owner = new Array<number>(n).fill(-1);
  const take = (r: number, seen: boolean[]): boolean => {
    for (let c = 0; c < n; c++) {
      if (!ok(r, c) || seen[c]) continue;
      seen[c] = true;
      if (owner[c] === -1 || take(owner[c], seen)) {
        owner[c] = r;
        return true;
      }
    }
    return false;
  };
  for (let r = 0; r < n; r++) if (!take(r, new Array<boolean>(n).fill(false))) return false;
  return true;
}

describe('실루엣 마스크', () => {
  it('id 가 유일하고, 모든 난이도에 쓸 수 있는 마스크가 있다', () => {
    expect(new Set(MASKS.map((m) => m.id)).size).toBe(MASKS.length);
    for (const n of SIZES) expect(MASKS.filter((m) => m.minN <= n).length).toBeGreaterThan(0);
  });

  for (const mask of MASKS)
    for (const n of SIZES.filter((n) => n >= mask.minN)) {
      it(`${mask.id} ${n}×${n}: 배치가 가능하고 건물이 이어져 있다`, () => {
        for (let i = 0; i < SEEDS; i++) {
          const holes = new Set(mask.voids(n, rng(`${mask.id}-${n}-${i}`)).map(key));
          const where = `${mask.id} n=${n} seed=${i}`;

          for (const k of holes) {
            const [r, c] = k.split(',').map(Number);
            expect(r >= 0 && r < n && c >= 0 && c < n, `${where}: ${k} 가 격자 밖`).toBe(true);
          }

          // 격자의 1/4 넘게 파내면 방·가구가 감당을 못 한다
          expect(holes.size / (n * n), `${where}: 너무 많이 팠다`).toBeLessThanOrEqual(0.25);

          const { cells } = scan(n, holes);
          expect(
            hasPerfectMatching(n, (r, c) => !holes.has(`${r},${c}`)),
            `${where}: 행·열에 한 명씩 놓을 수 없다`,
          ).toBe(true);
          // 건물이 두 동강 나면 "옆방에서 나왔다"가 성립하지 않는 구역이 생긴다
          expect(connected(cells), `${where}: 건물이 갈라졌다`).toBe(true);
        }
      });
    }

  it('donut 은 갇힌 안뜰을, 나머지는 바깥을 만든다', () => {
    for (const mask of MASKS) {
      if (mask.id === 'square') continue;
      for (const n of SIZES.filter((n) => n >= mask.minN))
        for (let i = 0; i < SEEDS; i++) {
          const holes = new Set(mask.voids(n, rng(`${mask.id}-${n}-${i}`)).map(key));
          const kinds = new Set([...scan(n, holes).idx.voidKind.flat()].filter(Boolean));
          expect([...kinds], `${mask.id} n=${n} seed=${i}`).toEqual([
            mask.id === 'donut' ? 'inner' : 'outer',
          ]);
        }
    }
  });

  it('같은 시드는 같은 실루엣을 만든다', () => {
    for (const mask of MASKS)
      for (const n of SIZES.filter((n) => n >= mask.minN))
        expect(mask.voids(n, rng('fixed'))).toEqual(mask.voids(n, rng('fixed')));
  });
});

describe('buildFloorplan', () => {
  it('방은 이어져 있고, 겹치지 않고, 이름이 유일하다', () => {
    let made = 0;
    const shapes = new Set<string>();
    for (const theme of THEMES)
      for (const n of SIZES)
        for (let i = 0; i < 80; i++) {
          const plan = buildFloorplan(n, rng(`plan-${theme.id}-${n}-${i}`), theme);
          if (!plan) continue; // 실루엣이 방을 감당 못 했다 — 호출부가 다시 뽑는다
          made++;
          const where = `${theme.id} n=${n} seed=${i} (${plan.maskId})`;

          expect(plan.rooms.map((r) => r.id), where).toEqual(plan.rooms.map((_, k) => k));
          expect(new Set(plan.rooms.map((r) => r.name)).size, where).toBe(plan.rooms.length);
          expect(plan.rooms.length, where).toBeGreaterThanOrEqual(n - 1);

          const seen = new Set<string>();
          for (const room of plan.rooms) {
            expect(connected(room.cells), `${where}: ${room.name} 이 끊겼다`).toBe(true);
            expect(room.cells.length, `${where}: ${room.name} 이 너무 작다`).toBeGreaterThanOrEqual(2);
            for (const c of room.cells) {
              expect(seen.has(key(c)), `${where}: ${key(c)} 이 두 방에 있다`).toBe(false);
              seen.add(key(c));
            }
          }
          shapes.add(`${n}:${plan.maskId}`);
        }
    expect(made).toBeGreaterThan(0);
    // 마스크 하나가 조용히 전부 거부당하면 여기서 잡힌다
    for (const mask of MASKS)
      for (const n of SIZES.filter((n) => n >= mask.minN))
        expect(shapes, `${mask.id} ${n}×${n} 평면도가 하나도 안 나온다`).toContain(
          `${n}:${mask.id}`,
        );
  });
});
