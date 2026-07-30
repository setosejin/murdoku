import type { Cell, Clue, ClueType, Furniture, Person, Puzzle, Room, WallItem } from './types';
import { pick, rng, shuffled } from './types';
import { clueText, indexScene, matchingCells, type Scene, type SceneIndex } from './clues';
import { solve } from './solve';
import {
  PERSON_COLORS,
  SUSPECT_NAMES,
  THEMES,
  type FurnitureSpec,
  type Theme,
  VICTIM_COLOR,
  VICTIM_NAMES,
} from '../data/content';

const MAX_ROOM_AREA = 6;
/** 지터로 방이 이보다 작아지지는 않는다 (가구 1개 + 설 자리 1칸은 남아야 한다) */
const MIN_ROOM_AREA = 3;
/** 지터로 방이 이보다 커지지도 않는다 */
const MAX_JITTER_AREA = 9;

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

type Rect = { r0: number; c0: number; r1: number; c1: number };

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

function buildRooms(n: number, rand: () => number, theme: Theme): Room[] {
  const rects: Rect[] = [];
  splitRect({ r0: 0, c0: 0, r1: n - 1, c1: n - 1 }, rand, rects);
  const specs = shuffled(rand, theme.rooms);
  const rooms = rects.map((rect, i) => {
    const cells: Cell[] = [];
    for (let r = rect.r0; r <= rect.r1; r++)
      for (let c = rect.c0; c <= rect.c1; c++) cells.push({ r, c });
    const spec = specs[i % specs.length];
    const name = i < specs.length ? spec.name : `${spec.name} ${Math.floor(i / specs.length) + 1}`;
    return { id: i, name, floor: spec.floor, cells };
  });
  jitterRooms(rooms, n, rand);
  return rooms;
}

/** 칸 목록이 상하좌우로 하나로 이어져 있는가 */
function connected(cells: Cell[]): boolean {
  const want = new Set(cells.map((c) => `${c.r},${c.c}`));
  const seen = new Set([`${cells[0].r},${cells[0].c}`]);
  const stack = [cells[0]];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const [dr, dc] of DIRS) {
      const next = { r: cur.r + dr, c: cur.c + dc };
      const k = `${next.r},${next.c}`;
      if (want.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push(next);
      }
    }
  }
  return seen.size === cells.length;
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
    for (let c = 0; c < n; c++)
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
        if (roomAt[nr][nc] !== roomAt[r][c]) edges.push({ r, c, nr, nc });
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

/** 방 이름에 맞는 가구를 방마다 1~2개. 빈 방이 남으면 null (호출부가 평면도를 다시 뽑는다) */
function placeFurniture(rooms: Room[], rand: () => number, theme: Theme): Furniture[] | null {
  const out: Furniture[] = [];
  // 증언이 "어느 탁자?"로 모호해지지 않게, 가구 종류는 퍼즐 전체에서 한 번씩만 쓴다
  const deck = shuffled(rand, theme.furniture);
  const fits = (spec: FurnitureSpec, room: Room) => !spec.rooms || spec.rooms.includes(room.name);
  const state = new Map(rooms.map((r) => [r.id, { taken: new Set<string>(), blocking: 0, count: 0 }]));

  const put = (room: Room): void => {
    const st = state.get(room.id)!;
    const budget = Math.floor(room.cells.length / 2);
    // 그 방 전용 가구(욕실→욕조)를 범용 가구(화분·스탠드)보다 먼저 집는다
    const candidates = deck
      .filter((s) => fits(s, room))
      .sort((a, b) => (a.rooms?.length ?? 99) - (b.rooms?.length ?? 99));
    for (const spec of candidates) {
      const free = shuffled(
        rand,
        room.cells.filter((c) => !st.taken.has(`${c.r},${c.c}`)),
      );
      let cells: Cell[] | null = null;
      if (spec.size === 1) {
        if (free.length) cells = [free[0]];
      } else {
        for (const a of free) {
          const b = free.find(
            (x) => Math.abs(x.r - a.r) + Math.abs(x.c - a.c) === 1,
          );
          if (b) {
            cells = [a, b];
            break;
          }
        }
      }
      if (!cells) continue;
      // 렌더링 기준점이 되도록 왼쪽 위 칸이 항상 cells[0]
      cells.sort((a, b) => a.r - b.r || a.c - b.c);
      const cost = spec.standable ? 0 : cells.length;
      if (st.blocking + cost > budget) continue;
      // 방에 설 수 있는 칸이 최소 1개는 남아야 한다
      if (room.cells.length - (st.blocking + cost) < 1) continue;
      st.blocking += cost;
      st.count++;
      deck.splice(deck.indexOf(spec), 1);
      for (const c of cells) st.taken.add(`${c.r},${c.c}`);
      out.push({
        id: `${spec.kind}-${room.id}`,
        kind: spec.kind,
        label: spec.label,
        emoji: spec.emoji,
        image: spec.image,
        cells,
        standable: spec.standable,
      });
      return;
    }
  };

  // 고를 수 있는 가구가 적은 방(욕실 같은)부터 채워야 빈 방이 안 생긴다
  const order = rooms
    .slice()
    .sort((a, b) => deck.filter((s) => fits(s, a)).length - deck.filter((s) => fits(s, b)).length);
  for (const room of order) put(room); // 1차: 모든 방에 하나씩
  for (const room of order) put(room); // 2차: 자리가 남으면 하나 더
  return rooms.every((r) => state.get(r.id)!.count > 0) ? out : null;
}

function placeWallItems(
  n: number,
  furniture: Furniture[],
  rand: () => number,
  theme: Theme,
): WallItem[] {
  const blocked = new Set<string>();
  for (const f of furniture) for (const c of f.cells) blocked.add(`${c.r},${c.c}`);

  const border: Cell[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if ((r === 0 || c === 0 || r === n - 1 || c === n - 1) && !blocked.has(`${r},${c}`))
        border.push({ r, c });

  const chosen = shuffled(rand, border).slice(0, theme.wallItems.length);
  return chosen.map((cell, i) => {
    const sides: WallItem['side'][] = [];
    if (cell.r === 0) sides.push('top');
    if (cell.r === n - 1) sides.push('bottom');
    if (cell.c === 0) sides.push('left');
    if (cell.c === n - 1) sides.push('right');
    const spec = theme.wallItems[i];
    return {
      id: `${spec.kind}-${i}`,
      kind: spec.kind,
      label: spec.label,
      emoji: spec.emoji,
      cell,
      side: pick(rand, sides),
    };
  });
}

/**
 * 행마다 열 하나씩, 겹치지 않게. 사람이 설 수 없는 칸은 제외.
 * 방마다 한 명까지 — 딱 한 방만 2명(피해자 + 범인)이 된다.
 */
function randomPlacement(idx: SceneIndex, n: number, rand: () => number): Cell[] | null {
  const cols = Array.from({ length: n }, (_, i) => i);
  const used = new Set<number>();
  const inRoom = new Array<number>(idx.roomById.size).fill(0);
  let doubled = 0;
  const out: Cell[] = [];
  const go = (r: number): boolean => {
    if (r === n) return doubled === 1;
    for (const c of shuffled(rand, cols)) {
      if (used.has(c) || !idx.free[r][c]) continue;
      const room = idx.roomAt[r][c];
      if (inRoom[room] >= 2 || (inRoom[room] === 1 && doubled >= 1)) continue;
      used.add(c);
      if (++inRoom[room] === 2) doubled++;
      out[r] = { r, c };
      if (go(r + 1)) return true;
      if (inRoom[room]-- === 2) doubled--;
      used.delete(c);
    }
    return false;
  };
  return go(0) ? out : null;
}

type Statement = { type: ClueType; targetId: string; size: number };

/** 그 칸에 있는 사람이 할 수 있는 참인 진술 전부 */
function trueStatements(cell: Cell, scene: Scene, idx: SceneIndex): Statement[] {
  const out: Statement[] = [];
  const add = (type: ClueType, targetId: string) => {
    const cells = matchingCells(type, targetId, idx);
    if (cells.some((c) => c.r === cell.r && c.c === cell.c))
      out.push({ type, targetId, size: cells.length });
  };
  for (const f of scene.furniture) {
    add('ON', f.id);
    add('NEXT_TO', f.id);
  }
  // 벽 부착물은 "~앞에 있었다"만 쓴다 (옆/앞 혼동 방지)
  for (const w of scene.wallItems) add('ON', w.id);
  for (const room of scene.rooms) add('IN_ROOM', String(room.id));
  return out;
}

export type Difficulty = { n: number; label: string };

export const DIFFICULTIES: Difficulty[] = [
  { n: 4, label: '쉬움 (4×4)' },
  { n: 5, label: '보통 (5×5)' },
  { n: 6, label: '어려움 (6×6)' },
];

export function generatePuzzle(n: number, seed = String(Date.now())): Puzzle {
  const rand = rng(seed);
  // 테마는 재시도와 무관하게 시드로 한 번만 정한다
  const theme = pick(rand, THEMES);

  for (let sceneTry = 0; sceneTry < 300; sceneTry++) {
    const rooms = buildRooms(n, rand, theme);
    const furniture = placeFurniture(rooms, rand, theme);
    if (!furniture) continue; // 가구를 못 받은 방이 있다 — 평면도부터 다시
    const wallItems = placeWallItems(n, furniture, rand, theme);
    const scene: Scene = { n, rooms, furniture, wallItems };
    const idx = indexScene(scene);

    for (let placeTry = 0; placeTry < 20; placeTry++) {
      const cells = randomPlacement(idx, n, rand);
      if (!cells) break; // 이 평면도로는 배치 자체가 불가능

      // 피해자 방에 다른 사람이 정확히 1명 = 범인이 유일하게 정해짐
      const roomOf = (c: Cell) => idx.roomAt[c.r][c.c];
      const victimSpots = cells.filter(
        (c) => cells.filter((o) => o !== c && roomOf(o) === roomOf(c)).length === 1,
      );
      if (!victimSpots.length) continue;
      const victimCell = pick(rand, victimSpots);

      const suspectCells = shuffled(rand, cells.filter((c) => c !== victimCell));
      const names = shuffled(rand, SUSPECT_NAMES);
      const roles = shuffled(rand, theme.roles);
      const people: Person[] = suspectCells.map((_, i) => ({
        id: String.fromCharCode(65 + i),
        name: names[i],
        role: roles[i % roles.length],
        color: PERSON_COLORS[i % PERSON_COLORS.length],
        isVictim: false,
      }));
      const victim: Person = {
        id: 'V',
        name: pick(rand, VICTIM_NAMES),
        role: roles[roles.length - 1],
        color: VICTIM_COLOR,
        isVictim: true,
      };
      const allPeople = [...people, victim];

      const solution: Record<string, Cell> = { V: victimCell };
      people.forEach((p, i) => (solution[p.id] = suspectCells[i]));

      const options = people.map((p) => trueStatements(solution[p.id], scene, idx));
      if (options.some((o) => o.length === 0)) continue;

      for (let clueTry = 0; clueTry < 60; clueTry++) {
        const clues: Clue[] = people.map((p, i) => {
          const sorted = options[i].slice().sort((a, b) => a.size - b.size);
          // 후보가 좁은 진술 쪽으로 치우치게 뽑는다 (풀리는 퍼즐이 잘 나옴)
          const s = sorted[Math.floor(rand() * rand() * sorted.length)];
          return { personId: p.id, type: s.type, targetId: s.targetId, text: clueText(s.type, s.targetId, idx) };
        });

        if (solve(allPeople, clues, idx, 2).length !== 1) continue;

        const culprit = people.find(
          (p) => idx.roomAt[solution[p.id].r][solution[p.id].c] === roomOf(victimCell),
        )!;
        return {
          n,
          seed,
          theme,
          title: pick(rand, theme.titles),
          brief: pick(rand, theme.briefs),
          rooms,
          furniture,
          wallItems,
          people: allPeople,
          clues,
          solution,
          culpritId: culprit.id,
        };
      }
    }
  }
  throw new Error(`퍼즐 생성 실패 (n=${n}, seed=${seed})`);
}
