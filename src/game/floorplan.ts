import type { Cell, Room } from './types';
import { key, pick, shuffled } from './types';
import type { Theme } from '../data/content';

const MAX_ROOM_AREA = 6;
/** 지터로 방이 이보다 작아지지는 않는다 (가구 1개 + 설 자리 1칸은 남아야 한다) */
const MIN_ROOM_AREA = 3;
/** 지터로 방이 이보다 커지지도 않는다 */
const MAX_JITTER_AREA = 9;
/** 실루엣이 깎고 남은 조각이 이보다 작으면 이웃 방이 흡수한다 */
const MIN_ROOM_CELLS = 2;
/** 방 이름 풀(테마당 9개)과 가구 덱이 감당하는 상한. 넘으면 평면도를 다시 뽑는다 */
const MAX_ROOMS = 9;

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

type Rect = { r0: number; c0: number; r1: number; c1: number };

/* ── 실루엣 마스크 ──────────────────────────────────────────────
   격자를 꽉 채우지 않는 건물 모양. 파낸 칸은 어느 방에도 속하지 않고
   (`roomAt === -1`), 격자 테두리와 이어져 있으면 `바깥`, 갇혀 있으면
   `안뜰`이 된다 — 그 판별은 clues.ts 의 flood fill 이 한다.

   마스크가 어떤 행이나 열을 통째로 비우면 "행마다 한 명, 열마다 한 명"
   배치가 원천 불가능해진다. 그래서 네 모서리를 모두 파는 `十` 는 넣지
   않았다 (7×7 에서 0·1·5·6행이 남은 3개 열을 놓고 싸운다).
   floorplan.test.ts 가 마스크마다 행·열 완전 매칭 존재를 직접 확인한다. */

export type Mask = {
  id: string;
  /** 이 마스크를 쓸 수 있는 최소 격자 */
  minN: number;
  /** 파낼 칸. 방향·위치는 난수로 고른다 */
  voids: (n: number, rand: () => number) => Cell[];
};

function block(r0: number, c0: number, h: number, w: number): Cell[] {
  const out: Cell[] = [];
  for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) out.push({ r, c });
  return out;
}

/** 모서리에 h×w 블록. i = 0 좌상 · 1 우상 · 2 우하 · 3 좌하 */
const corner = (n: number, i: number, h: number, w: number): Cell[] =>
  block(i === 0 || i === 1 ? 0 : n - h, i === 0 || i === 3 ? 0 : n - w, h, w);

export const MASKS: readonly Mask[] = [
  { id: 'square', minN: 4, voids: () => [] },
  {
    // ㄱ자 — 한 모서리를 직사각으로 도려낸다
    id: 'ell',
    minN: 5,
    voids: (n, rand) => {
      const a = Math.floor(n / 2);
      const b = Math.floor((n - 1) / 2);
      const flip = rand() < 0.5;
      return corner(n, Math.floor(rand() * 4), flip ? b : a, flip ? a : b);
    },
  },
  {
    // ㄷ자 — 한 변 가운데에서 안쪽으로 파고든다
    id: 'you',
    minN: 6,
    voids: (n, rand) => {
      const w = n >= 7 ? 3 : 2;
      const d = Math.floor(n / 2);
      const off = Math.floor((n - w) / 2);
      const side = Math.floor(rand() * 4);
      if (side === 0) return block(0, off, d, w);
      if (side === 1) return block(n - d, off, d, w);
      if (side === 2) return block(off, 0, w, d);
      return block(off, n - d, w, d);
    },
  },
  {
    // 마주보는 두 모서리를 2×2 씩
    id: 'diagonal',
    minN: 6,
    voids: (n, rand) => {
      const i = rand() < 0.5 ? 0 : 1;
      return [...corner(n, i, 2, 2), ...corner(n, i + 2, 2, 2)];
    },
  },
  {
    // 안쪽에 갇힌 덩어리 — 안뜰·연못. 테두리에 닿으면 `바깥`이 되어버린다
    id: 'donut',
    minN: 5,
    voids: (n, rand) => {
      const max = Math.min(n - 3, n >= 7 ? 3 : 2);
      const h = 1 + Math.floor(rand() * max);
      const w = 1 + Math.floor(rand() * max);
      const r0 = 1 + Math.floor(rand() * (n - 1 - h));
      const c0 = 1 + Math.floor(rand() * (n - 1 - w));
      return block(r0, c0, h, w);
    },
  },
];

/** BSP 재귀 이분할. 항상 연결된 직사각형 방이 나온다. */
function splitRect(rect: Rect, rand: () => number, out: Rect[]): void {
  const h = rect.r1 - rect.r0 + 1;
  const w = rect.c1 - rect.c0 + 1;
  const canV = w >= 4;
  const canH = h >= 4;
  // 8칸짜리는 가끔 안 쪼갠다 — 방 개수가 다양해야 "한 방에 한 명" 배치가 되는 평면도가 나온다
  // (4×4를 늘 사분면으로 자르면 인원이 2,2로만 갈려서 범인 방을 만들 수 없다)
  if (h * w <= MAX_ROOM_AREA || (!canV && !canH) || (h * w <= 8 && rand() < 0.5)) {
    out.push(rect);
    return;
  }
  const vertical = canV && (!canH || (w > h ? true : w < h ? false : rand() < 0.5));
  if (vertical) {
    const cut = rect.c0 + 2 + Math.floor(rand() * (w - 3));
    splitRect({ ...rect, c1: cut - 1 }, rand, out);
    splitRect({ ...rect, c0: cut }, rand, out);
  } else {
    const cut = rect.r0 + 2 + Math.floor(rand() * (h - 3));
    splitRect({ ...rect, r1: cut - 1 }, rand, out);
    splitRect({ ...rect, r0: cut }, rand, out);
  }
}

/** 칸 목록을 상하좌우로 이어진 덩어리들로 가른다 */
function components(cells: Cell[]): Cell[][] {
  const left = new Map(cells.map((c) => [key(c), c]));
  const out: Cell[][] = [];
  while (left.size) {
    const first = left.keys().next().value!;
    const start = left.get(first)!;
    left.delete(first);
    const group = [start];
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const [dr, dc] of DIRS) {
        const k = `${cur.r + dr},${cur.c + dc}`;
        const nb = left.get(k);
        if (!nb) continue;
        left.delete(k);
        group.push(nb);
        stack.push(nb);
      }
    }
    out.push(group);
  }
  return out;
}

/** 칸 목록이 상하좌우로 하나로 이어져 있는가 */
export const connected = (cells: Cell[]): boolean => components(cells).length === 1;

const touches = (a: Cell[], b: Cell[]): boolean => {
  const set = new Set(a.map(key));
  return b.some((c) => DIRS.some(([dr, dc]) => set.has(`${c.r + dr},${c.c + dc}`)));
};

/**
 * 실루엣이 깎아 남긴 부스러기를 이웃 방에 붙인다.
 * 받아줄 이웃이 없으면 false — 호출부가 평면도를 다시 뽑는다.
 * (그냥 버리면 어느 방에도 안 속한 칸이 생겨 의도하지 않은 구멍이 뚫린다)
 */
function absorbScraps(parts: Cell[][]): boolean {
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].length >= MIN_ROOM_CELLS) continue;
    const host = parts.find((p, j) => j !== i && touches(p, parts[i]));
    if (!host) return false;
    host.push(...parts[i]);
    parts.splice(i, 1);
  }
  return true;
}

export type Floorplan = { rooms: Room[]; maskId: string };

/**
 * 마스크로 실루엣을 정하고 BSP 로 방을 나눈다.
 * 실루엣이 방을 감당 못 하면 null — 호출부가 다음 시도로 넘어간다.
 */
export function buildFloorplan(n: number, rand: () => number, theme: Theme): Floorplan | null {
  const mask = pick(
    rand,
    MASKS.filter((m) => m.minN <= n),
  );
  const holes = new Set(mask.voids(n, rand).map(key));

  const rects: Rect[] = [];
  splitRect({ r0: 0, c0: 0, r1: n - 1, c1: n - 1 }, rand, rects);

  // 실루엣이 방을 두 조각으로 가르면 조각마다 방이 된다 — 버리면 방 개수가 모자라진다
  const parts: Cell[][] = [];
  for (const rect of rects) {
    const cells: Cell[] = [];
    for (let r = rect.r0; r <= rect.r1; r++)
      for (let c = rect.c0; c <= rect.c1; c++) if (!holes.has(`${r},${c}`)) cells.push({ r, c });
    if (cells.length) parts.push(...components(cells));
  }
  if (!absorbScraps(parts)) return null;

  const specs = shuffled(rand, theme.rooms);
  // 방이 n-1 개는 있어야 용의자마다 방을 하나씩 줄 수 있다
  if (parts.length < n - 1 || parts.length > Math.min(MAX_ROOMS, specs.length)) return null;

  const rooms = parts.map((cells, i) => ({
    id: i,
    name: specs[i].name,
    floor: specs[i].floor,
    cells: cells.sort((a, b) => a.r - b.r || a.c - b.c),
  }));
  jitterRooms(rooms, n, rand);
  return { rooms, maskId: mask.id };
}

/**
 * BSP 가 만든 직사각형 방의 경계 칸을 이웃 방에 넘겨 L자 방을 만든다.
 * 연결이 끊기거나 방이 너무 작아지는 이동은 그냥 건너뛴다 — 방 개수는 항상 그대로다.
 * (방 개수가 줄면 "한 방에 용의자 한 명" 배치가 불가능해져 생성이 조용히 실패한다)
 */
function jitterRooms(rooms: Room[], n: number, rand: () => number): void {
  const roomAt = Array.from({ length: n }, () => new Array<number>(n).fill(-1));
  for (const room of rooms) for (const c of room.cells) roomAt[c.r][c.c] = room.id;
  const byId = new Map(rooms.map((r) => [r.id, r]));

  // 무작위 칸을 찍으면 대부분 방 안쪽이라 헛돈다. 경계 칸만 모아서 섞는다
  const edges: { r: number; c: number; nr: number; nc: number }[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (roomAt[r][c] < 0) continue;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
        // 실루엣 밖은 방이 아니다 — 칸을 넘겨줄 수도 받을 수도 없다
        if (roomAt[nr][nc] < 0) continue;
        if (roomAt[nr][nc] !== roomAt[r][c]) edges.push({ r, c, nr, nc });
      }
    }

  for (const { r, c, nr, nc } of shuffled(rand, edges).slice(0, rooms.length)) {
    const from = byId.get(roomAt[r][c])!;
    const to = byId.get(roomAt[nr][nc])!;
    if (from.id === to.id) continue; // 앞선 이동으로 같은 방이 됐다
    if (from.cells.length <= MIN_ROOM_AREA || to.cells.length >= MAX_JITTER_AREA) continue;

    const rest = from.cells.filter((x) => x.r !== r || x.c !== c);
    if (!connected(rest)) continue;

    from.cells = rest;
    // 받는 쪽은 붙어 있는 칸을 더하는 거라 연결은 저절로 유지된다
    to.cells = [...to.cells, { r, c }].sort((a, b) => a.r - b.r || a.c - b.c);
    roomAt[r][c] = to.id;
  }
}
