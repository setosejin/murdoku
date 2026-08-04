import type { Cell, Clue, ClueType, Furniture, Room, WallItem } from './types';
import { key } from './types';

export type Scene = {
  n: number;
  rooms: Room[];
  furniture: Furniture[];
  wallItems: WallItem[];
};

export type SceneIndex = {
  /** roomAt[r][c] = room id. 실루엣 밖(빈 칸)은 -1 */
  roomAt: number[][];
  /** 사람이 설 수 있는 칸인가 (빈 칸 또는 standable 가구 위) */
  free: boolean[][];
  /** 어느 방에도 안 속한 칸의 종류. 격자 밖과 이어졌으면 바깥, 갇혔으면 안뜰 */
  voidKind: VoidKind[][];
  furnitureById: Map<string, Furniture>;
  wallById: Map<string, WallItem>;
  roomById: Map<string, Room>;
};

/** null = 방에 속한 칸 */
export type VoidKind = 'outer' | 'inner' | null;

export function indexScene(s: Scene): SceneIndex {
  const roomAt = Array.from({ length: s.n }, () => Array<number>(s.n).fill(-1));
  for (const room of s.rooms) for (const c of room.cells) roomAt[c.r][c.c] = room.id;

  const free = Array.from({ length: s.n }, () => Array<boolean>(s.n).fill(true));
  // 실루엣 밖은 설 수 없다 — 이 한 줄로 솔버·증언 판정·배치가 전부 빈 칸을 피한다
  for (let r = 0; r < s.n; r++)
    for (let c = 0; c < s.n; c++) if (roomAt[r][c] < 0) free[r][c] = false;
  for (const f of s.furniture) for (const c of f.cells) free[c.r][c.c] = f.standable;

  return {
    roomAt,
    free,
    voidKind: classifyVoids(roomAt, s.n),
    furnitureById: new Map(s.furniture.map((f) => [f.id, f])),
    wallById: new Map(s.wallItems.map((w) => [w.id, w])),
    roomById: new Map(s.rooms.map((r) => [String(r.id), r])),
  };
}

/**
 * 격자 밖에서 흘러들어오는 빈 칸이 `바깥`(건물 밖), 갇힌 빈 칸이 `안뜰`.
 * 마스크가 따로 말해줄 필요가 없다 — 모양만 보면 저절로 갈린다.
 */
function classifyVoids(roomAt: number[][], n: number): VoidKind[][] {
  const out: VoidKind[][] = Array.from({ length: n }, () => Array<VoidKind>(n).fill(null));
  const stack: Cell[] = [];
  const mark = (r: number, c: number) => {
    if (r < 0 || c < 0 || r >= n || c >= n) return;
    if (roomAt[r][c] >= 0 || out[r][c]) return;
    out[r][c] = 'outer';
    stack.push({ r, c });
  };
  for (let i = 0; i < n; i++) {
    mark(0, i);
    mark(n - 1, i);
    mark(i, 0);
    mark(i, n - 1);
  }
  while (stack.length) {
    const cur = stack.pop()!;
    for (const [dr, dc] of DIRS) mark(cur.r + dr, cur.c + dc);
  }
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (roomAt[r][c] < 0 && !out[r][c]) out[r][c] = 'inner';
  return out;
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

  /* FROM_ROOM: "그 방에서 막 나왔다" = 그 방과 벽을 맞댄, 그 방이 아닌 칸.
     증언은 여전히 단항이라 솔버는 이 타입을 몰라도 된다 — 시간은 서사로만 들어온다.
     "인접한 방 전부"로 넓히지 않는 이유: 후보가 8~12칸이 되면 생성기의 좁은-증언
     선호에 밀려 거의 안 뽑힌다. "바로 밖"은 3~6칸이라 IN_ROOM 과 같은 급이다.
     실루엣 밖 칸은 free 가 false 라 push 가 알아서 거른다 — 안뜰 건너편은 후보가 아니다 */
  if (type === 'FROM_ROOM') {
    const room = idx.roomById.get(targetId);
    if (!room) return out;
    for (const c of room.cells)
      for (const [dr, dc] of DIRS) {
        const r = c.r + dr;
        const cc = c.c + dc;
        if (r < 0 || cc < 0 || r >= n || cc >= n) continue;
        if (idx.roomAt[r][cc] === room.id) continue;
        push(r, cc);
      }
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
  if (type === 'FROM_ROOM') return `난 ${idx.roomById.get(targetId)?.name}에서 막 나온 참이었어!`;
  const w = idx.wallById.get(targetId);
  if (w) return type === 'ON' ? `난 ${w.label} 앞에 있었어!` : `난 ${w.label} 옆에 있었어!`;
  const f = idx.furnitureById.get(targetId);
  const label = f?.label ?? '?';
  return type === 'ON' ? `난 ${label}에 있었어!` : `난 ${label} 옆에 있었어!`;
}
