import type { Cell, Clue, Person } from './types';
import { matchingCells, type SceneIndex } from './clues';

export type Solution = Record<string, Cell>;

/**
 * 행/열/방 비트마스크 백트래킹. limit 개를 찾으면 즉시 중단하므로
 * limit=2 로 부르면 "유일해인가" 판정이 된다.
 * 제약: 행·열이 서로 다르고, 방마다 용의자는 한 명까지,
 *       피해자 방에는 용의자가 정확히 1명(= 범인).
 * ponytail: 완전 백트래킹이라 N<=9 정도까지가 실용 한계.
 *           더 큰 격자를 지원할 땐 후보 전파(제약 전파)를 추가한다.
 */
export function solve(
  people: Person[],
  clues: Clue[],
  idx: SceneIndex,
  limit = 2,
): Solution[] {
  const n = idx.free.length;
  const allFree: Cell[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (idx.free[r][c]) allFree.push({ r, c });

  const byPerson = new Map(clues.map((c) => [c.personId, c]));
  const candidates = people.map((p) => {
    const clue = byPerson.get(p.id);
    return {
      id: p.id,
      isVictim: p.isVictim,
      cells: clue ? matchingCells(clue.type, clue.targetId, idx) : allFree,
    };
  });
  candidates.sort((a, b) => a.cells.length - b.cells.length);

  const found: Solution[] = [];
  const assign: Cell[] = new Array(candidates.length);
  const suspectsIn = new Array<number>(idx.roomById.size).fill(0);
  let usedRows = 0;
  let usedCols = 0;
  let victimRoom = -1;

  const go = (i: number): void => {
    if (found.length >= limit) return;
    if (i === candidates.length) {
      // 피해자와 같은 방에 있던 용의자가 범인 — 정확히 1명이어야 사건이 성립한다
      if (victimRoom >= 0 && suspectsIn[victimRoom] !== 1) return;
      const sol: Solution = {};
      candidates.forEach((p, k) => (sol[p.id] = assign[k]));
      found.push(sol);
      return;
    }
    const me = candidates[i];
    for (const cell of me.cells) {
      const rb = 1 << cell.r;
      const cb = 1 << cell.c;
      if (usedRows & rb || usedCols & cb) continue;
      const room = idx.roomAt[cell.r][cell.c];
      if (!me.isVictim && suspectsIn[room] > 0) continue;
      usedRows |= rb;
      usedCols |= cb;
      if (me.isVictim) victimRoom = room;
      else suspectsIn[room]++;
      assign[i] = cell;
      go(i + 1);
      if (me.isVictim) victimRoom = -1;
      else suspectsIn[room]--;
      usedRows &= ~rb;
      usedCols &= ~cb;
      if (found.length >= limit) return;
    }
  };

  go(0);
  return found;
}
