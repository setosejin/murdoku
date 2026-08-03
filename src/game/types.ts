import type { Theme } from '../data/content';

export type Cell = { r: number; c: number };

/** 방 바닥 재질. 판정에는 안 쓰이고 그림에만 쓴다 */
export type FloorKind = 'wood' | 'tile' | 'carpet' | 'grass' | 'soil' | 'straw';

export type Room = {
  id: number;
  name: string;
  floor: FloorKind;
  cells: Cell[];
};

export type Furniture = {
  id: string;
  /** FurnitureSpec.kind — 스프라이트 아이콘 이름이기도 하다 */
  kind: string;
  label: string;
  emoji: string;
  image?: string;
  cells: Cell[];
  /** 사람이 그 위에 설 수 있는가 (침대·러그 O, 탁자·화분 X) */
  standable: boolean;
};

export type WallItem = {
  id: string;
  kind: 'window' | 'door' | 'fence' | 'gate';
  label: string;
  emoji: string;
  image?: string;
  /** 부착된 칸. "~앞에 있었다" = 이 칸에 있었다 */
  cell: Cell;
  side: 'top' | 'right' | 'bottom' | 'left';
};

export type Person = {
  id: string;
  name: string;
  /** 직업. 사건 테마마다 다르다 */
  role: string;
  color: string;
  image?: string;
  isVictim: boolean;
};

export type ClueType = 'ON' | 'NEXT_TO' | 'IN_ROOM';

export type Clue = {
  personId: string;
  type: ClueType;
  /** Furniture.id | WallItem.id | Room.id(문자열) */
  targetId: string;
  text: string;
};

export type Puzzle = {
  n: number;
  seed: string;
  /** 사건 테마(저택·농장). 방·가구·제목 풀이 여기 묶여 있다 */
  theme: Theme;
  title: string;
  brief: string;
  rooms: Room[];
  furniture: Furniture[];
  wallItems: WallItem[];
  people: Person[];
  clues: Clue[];
  /** personId -> Cell */
  solution: Record<string, Cell>;
  culpritId: string;
};

export const key = (c: Cell) => `${c.r},${c.c}`;

/** 시드 문자열 -> 재현 가능한 0~1 난수 생성기 */
export function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T,>(rand: () => number, xs: readonly T[]): T =>
  xs[Math.floor(rand() * xs.length)];

export function shuffled<T>(rand: () => number, xs: readonly T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
