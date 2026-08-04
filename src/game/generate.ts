import type { Cell, Clue, ClueType, Furniture, Person, Puzzle, Room, WallItem } from './types';
import { pick, rng, shuffled } from './types';
import { clueText, indexScene, matchingCells, type Scene, type SceneIndex } from './clues';
import { buildFloorplan } from './floorplan';
import { solve } from './solve';
import {
  OUTDOOR_FLOORS,
  PERSON_COLORS,
  SUSPECT_NAMES,
  THEMES,
  type FurnitureSpec,
  type Theme,
  VICTIM_COLOR,
  VICTIM_NAMES,
} from '../data/content';

/**
 * 가구가 차지하는 모양. 2·3 칸은 가로/세로 일자, 4 칸은 2×2.
 * ponytail: ㄱ자 같은 꺾인 모양은 없다. 넣으려면 회전 4방향마다 그림이 따로 필요하고
 * (지금 그림은 가로로 하나 그려서 세로일 때 90도 돌려 쓴다), 방을 가로막지 않는지도
 * 따로 봐야 한다. 꺾인 소파가 정말 필요해지면 그때 모양별 심볼과 함께 올릴 것.
 */
const SHAPES: Record<number, ReadonlyArray<ReadonlyArray<readonly [number, number]>>> = {
  1: [[[0, 0]]],
  2: [
    [[0, 0], [0, 1]],
    [[0, 0], [1, 0]],
  ],
  3: [
    [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [2, 0]],
  ],
  4: [[[0, 0], [0, 1], [1, 0], [1, 1]]],
};

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
      // 모양이 통째로 들어가는 자리를 찾는다. 없으면 다음 가구로 — 큰 가구는
      // 넉넉한 방에만 놓이고 좁은 방은 작은 가구가 받는다
      const freeAt = new Set(free.map((c) => `${c.r},${c.c}`));
      const fit = (): Cell[] | null => {
        for (const a of free)
          for (const shape of shuffled(rand, SHAPES[spec.size]))
            if (shape.every(([dr, dc]) => freeAt.has(`${a.r + dr},${a.c + dc}`)))
              return shape.map(([dr, dc]) => ({ r: a.r + dr, c: a.c + dc }));
        return null;
      };
      const cells = fit();
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
  rooms: Room[],
  furniture: Furniture[],
  rand: () => number,
  theme: Theme,
): WallItem[] {
  const blocked = new Set<string>();
  for (const f of furniture) for (const c of f.cells) blocked.add(`${c.r},${c.c}`);

  // 하늘이 뚫린 칸. 목초지 한복판에 창문이 떠 있으면 안 된다
  const outdoor = new Set<string>();
  for (const room of rooms)
    if (OUTDOOR_FLOORS.has(room.floor))
      for (const c of room.cells) outdoor.add(`${c.r},${c.c}`);

  // 벽은 실루엣을 따라간다 — 격자 테두리가 아니라 "건물 밖과 맞닿은 칸"이 외벽이다.
  // 안뜰에 면한 칸도 여기 들어와서 안뜰을 향한 창문이 생긴다
  const inside = new Set<string>();
  for (const room of rooms) for (const c of room.cells) inside.add(`${c.r},${c.c}`);
  const out = (r: number, c: number) =>
    r < 0 || c < 0 || r >= n || c >= n || !inside.has(`${r},${c}`);

  const border: Cell[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!inside.has(`${r},${c}`) || blocked.has(`${r},${c}`)) continue;
      if (out(r - 1, c) || out(r + 1, c) || out(r, c - 1) || out(r, c + 1)) border.push({ r, c });
    }

  const chosen = shuffled(rand, border).slice(0, theme.wallItems.length);
  return chosen.map((cell, i) => {
    const sides: WallItem['side'][] = [];
    if (out(cell.r - 1, cell.c)) sides.push('top');
    if (out(cell.r + 1, cell.c)) sides.push('bottom');
    if (out(cell.r, cell.c - 1)) sides.push('left');
    if (out(cell.r, cell.c + 1)) sides.push('right');
    // 자리 순서가 같아서 두 목록 중 무엇을 골라도 라벨은 서로 다르다
    const list =
      (outdoor.has(`${cell.r},${cell.c}`) && theme.outdoorItems) || theme.wallItems;
    const spec = list[i];
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
  for (const room of scene.rooms) {
    add('IN_ROOM', String(room.id));
    add('FROM_ROOM', String(room.id));
  }
  return out;
}

export type Difficulty = { n: number; label: string };

export const DIFFICULTIES: Difficulty[] = [
  { n: 4, label: '쉬움' },
  { n: 5, label: '보통' },
  { n: 6, label: '어려움' },
  { n: 7, label: '매우 어려움' },
];

export function generatePuzzle(n: number, seed = String(Date.now())): Puzzle {
  const rand = rng(seed);
  // 테마는 재시도와 무관하게 시드로 한 번만 정한다
  const theme = pick(rand, THEMES);

  for (let sceneTry = 0; sceneTry < 300; sceneTry++) {
    const plan = buildFloorplan(n, rand, theme);
    if (!plan) continue; // 실루엣이 방을 감당 못 했다 — 다시
    const rooms = plan.rooms;
    const furniture = placeFurniture(rooms, rand, theme);
    if (!furniture) continue; // 가구를 못 받은 방이 있다 — 평면도부터 다시
    const wallItems = placeWallItems(n, rooms, furniture, rand, theme);
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
