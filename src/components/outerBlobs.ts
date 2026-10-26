import type { Cell } from '../game/types';

/**
 * 빈 칸 목록을 **상하좌우로 붙은 덩어리**로 가른다. 대각선으로만 닿은 칸은 남남이다 —
 * 걸음이 상하좌우로만 옮기므로(`yardWalk` 의 `nextStep`), 대각선을 한 덩어리로 묶으면
 * 손님이 못 건너가는 자리에 갇힌다.
 *
 * 큰 덩어리가 앞에 온다. 손님을 둘까지만 두므로 넓은 쪽이 먼저 가져간다.
 * 덩어리 안의 칸은 행→열 순서다 (첫 자리를 고를 때 안정적이어야 한다).
 */
export function outerBlobs(cells: Cell[]): Cell[][] {
  const left = new Map(cells.map((c): [string, Cell] => [`${c.r},${c.c}`, c]));
  const out: Cell[][] = [];

  for (const start of cells) {
    const k0 = `${start.r},${start.c}`;
    if (!left.has(k0)) continue;
    left.delete(k0);

    const blob = [start];
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const k = `${cur.r + dr},${cur.c + dc}`;
        const nb = left.get(k);
        if (!nb) continue;
        left.delete(k);
        blob.push(nb);
        stack.push(nb);
      }
    }
    blob.sort((a, b) => a.r - b.r || a.c - b.c);
    out.push(blob);
  }

  // 같은 크기끼리는 위·왼쪽이 먼저다. 정렬이 흔들리면 같은 시드가 다른 배치를 낸다
  out.sort((a, b) => b.length - a.length || a[0].r - b[0].r || a[0].c - b[0].c);
  return out;
}
