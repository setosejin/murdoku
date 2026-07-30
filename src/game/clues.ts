import type { Cell, Clue, ClueType, Furniture, Room, WallItem } from './types';
import { key } from './types';

export type Scene = {
  n: number;
  rooms: Room[];
  furniture: Furniture[];
  wallItems: WallItem[];
};

export type SceneIndex = {
  /** roomAt[r][c] = room id */
  roomAt: number[][];
  /** 사람이 설 수 있는 칸인가 (빈 칸 또는 standable 가구 위) */
  free: boolean[][];
  furnitureById: Map<string, Furniture>;
  wallById: Map<string, WallItem>;
  roomById: Map<string, Room>;
};

export function indexScene(s: Scene): SceneIndex {
  const roomAt = Array.from({ length: s.n }, () => Array<number>(s.n).fill(-1));
  for (const room of s.rooms) for (const c of room.cells) roomAt[c.r][c.c] = room.id;

  const free = Array.from({ length: s.n }, () => Array<boolean>(s.n).fill(true));
  for (const f of s.furniture) for (const c of f.cells) free[c.r][c.c] = f.standable;

  return {
    roomAt,
    free,
    furnitureById: new Map(s.furniture.map((f) => [f.id, f])),
    wallById: new Map(s.wallItems.map((w) => [w.id, w])),
    roomById: new Map(s.rooms.map((r) => [String(r.id), r])),
  };
}

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** 대상이 차지하는 칸들 */
function targetCells(targetId: string, idx: SceneIndex): Cell[] {
  const f = idx.furnitureById.get(targetId);
  if (f) return f.cells;
  const w = idx.wallById.get(targetId);
  if (w) return [w.cell];
  const room = idx.roomById.get(targetId);
  if (room) return room.cells;
  return [];
}

/**
 * 증언을 만족하는 "사람이 설 수 있는" 칸 전체.
 * 판정의 유일한 기준 — 솔버·생성기·검증이 모두 이 함수를 쓴다.
 */
export function matchingCells(type: ClueType, targetId: string, idx: SceneIndex): Cell[] {
  const n = idx.free.length;
  const out: Cell[] = [];
  const seen = new Set<string>();
  const push = (r: number, c: number) => {
    if (r < 0 || c < 0 || r >= n || c >= n) return;
    if (!idx.free[r][c]) return;
    const k = `${r},${c}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ r, c });
  };

  if (type === 'IN_ROOM') {
    const room = idx.roomById.get(targetId);
    if (room) for (const c of room.cells) push(c.r, c.c);
    return out;
  }

  const cells = targetCells(targetId, idx);
  if (type === 'ON') {
    for (const c of cells) push(c.r, c.c);
    return out;
  }

  // NEXT_TO: 같은 방 안에서 상하좌우 인접. 대상 칸 자체는 "옆"이 아니다.
  const own = new Set(cells.map(key));
  for (const c of cells) {
    for (const [dr, dc] of DIRS) {
      const r = c.r + dr;
      const cc = c.c + dc;
      if (r < 0 || cc < 0 || r >= n || cc >= n) continue;
      if (own.has(`${r},${cc}`)) continue;
      if (idx.roomAt[r][cc] !== idx.roomAt[c.r][c.c]) continue;
      push(r, cc);
    }
  }
  return out;
}

export function satisfies(clue: Clue, cell: Cell, idx: SceneIndex): boolean {
  return matchingCells(clue.type, clue.targetId, idx).some(
    (c) => c.r === cell.r && c.c === cell.c,
  );
}

export function clueText(type: ClueType, targetId: string, idx: SceneIndex): string {
  if (type === 'IN_ROOM') return `난 ${idx.roomById.get(targetId)?.name}에 있었어!`;
  const w = idx.wallById.get(targetId);
  if (w) return type === 'ON' ? `난 ${w.label} 앞에 있었어!` : `난 ${w.label} 옆에 있었어!`;
  const f = idx.furnitureById.get(targetId);
  const label = f?.label ?? '?';
  return type === 'ON' ? `난 ${label}에 있었어!` : `난 ${label} 옆에 있었어!`;
}
