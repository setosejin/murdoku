/**
 * 플레이 기록. 앞쪽 순수 함수(sanitizePlays·mergePlays)는 워커도 그대로 import 한다 —
 * 검증을 클라이언트와 서버 두 군데에 복제하지 않으려고 한 파일에 둔다.
 * 뒤쪽 localStorage·fetch 함수는 브라우저에서만 부른다.
 */

/**
 * 기록 한 건. `generatePuzzle(n, seed)` 가 결정적이라 사건은 seed+n 으로 통째로 복원된다.
 * title 만 비정규화해두는데, 목록을 그릴 때마다 생성기를 돌리면 어려움 난이도가 건당 100ms 라서다.
 */
export type Play = {
  seed: string;
  n: number;
  /** Date.now() */
  at: number;
  /** 맞췄나 */
  ok: boolean;
  /** 지목 횟수 */
  tries: number;
  title: string;
};

export const MAX_PLAYS = 200;

/**
 * ponytail: generate.ts 의 DIFFICULTIES 를 import 하면 워커 번들에 생성기와 콘텐츠가 통째로 딸려온다.
 * 범위만 여기 두고, 어긋나지 않는지는 테스트가 검사한다.
 */
export const N_RANGE = { min: 4, max: 6 } as const;

const MAX_SEED_LEN = 64;
const MAX_TITLE_LEN = 80;
/** 2096년쯤. 말도 안 되는 시각이 목록 맨 위에 박히는 것만 막으면 된다 */
const MAX_AT = 4e12;

const CODE_RE = /^[a-z0-9]{22}$/;

export const isCode = (v: unknown): v is string => typeof v === 'string' && CODE_RE.test(v);

const playKey = (p: Play) => `${p.seed}:${p.n}:${p.at}`;

const str = (v: unknown, max: number) =>
  typeof v === 'string' && v.length > 0 && v.length <= max ? v : null;

const int = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;

/**
 * 신뢰 경계 검증. localStorage 와 네트워크에서 들어온 값은 전부 여기를 통과해야 한다.
 * 모르는 필드는 버리고, 이상한 레코드는 조용히 빼고, 개수도 자른다.
 */
export function sanitizePlays(raw: unknown): Play[] {
  if (!Array.isArray(raw)) return [];
  const out: Play[] = [];
  for (const v of raw.slice(0, MAX_PLAYS)) {
    if (typeof v !== 'object' || v === null) continue;
    const p = v as Record<string, unknown>;
    const seed = str(p.seed, MAX_SEED_LEN);
    const title = str(p.title, MAX_TITLE_LEN);
    const n = int(p.n, N_RANGE.min, N_RANGE.max);
    const at = int(p.at, 1, MAX_AT);
    const tries = int(p.tries, 1, 999);
    if (seed === null || title === null || n === null || at === null || tries === null) continue;
    if (typeof p.ok !== 'boolean') continue;
    out.push({ seed, n, at, ok: p.ok, tries, title });
  }
  return out;
}

/**
 * 두 기록을 합친다. 기록은 append-only 라 충돌 해소가 필요 없다 — 그냥 합집합이다.
 * 같은 사건을 다시 풀면 at 이 달라서 별도 기록으로 남는다.
 */
export function mergePlays(a: readonly Play[], b: readonly Play[]): Play[] {
  const byKey = new Map<string, Play>();
  for (const p of a) byKey.set(playKey(p), p);
  for (const p of b) byKey.set(playKey(p), p);
  return [...byKey.values()].sort((x, y) => y.at - x.at).slice(0, MAX_PLAYS);
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** 새 기록 코드. 계정 가입 때 워커도 이걸 부른다 — 코드 생성기가 두 벌이면 안 된다 */
export const newCode = () =>
  [...crypto.getRandomValues(new Uint8Array(22))].map((b) => ALPHABET[b % 36]).join('');

// ── 여기서부터는 브라우저 전용 ──

const PLAYS_KEY = 'murdoku.history';
const CODE_KEY = 'murdoku.code';

// ponytail: 사파리 프라이빗 모드에선 localStorage 접근 자체가 throw 한다. 기록을 못 남겨도 게임은 굴러가야 한다.
export function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLS(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 프라이빗 모드거나 용량 초과. 삼킨다 */
  }
}

export function loadPlays(): Play[] {
  const raw = readLS(PLAYS_KEY);
  if (raw === null) return [];
  try {
    return sanitizePlays(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function savePlays(plays: readonly Play[]) {
  writeLS(PLAYS_KEY, JSON.stringify(plays));
}

export function addPlay(play: Play): Play[] {
  const next = mergePlays(loadPlays(), [play]);
  savePlays(next);
  return next;
}

export function clearPlays() {
  savePlays([]);
}

/** 이 기기의 기록 코드. 없으면 만들어 저장한다 */
export function getCode(): string {
  const saved = readLS(CODE_KEY);
  if (saved !== null && isCode(saved)) return saved;
  const code = newCode();
  writeLS(CODE_KEY, code);
  return code;
}

export function setCode(code: string) {
  writeLS(CODE_KEY, code);
}

/**
 * 서버와 기록을 합친다. VITE_SYNC_URL 이 없으면 아무것도 안 하고 로컬 전용으로 동작한다.
 * 실패는 전부 삼킨다 — 네트워크가 죽어도 게임과 로컬 기록은 그대로여야 한다.
 */
export async function sync(code: string, plays: readonly Play[]): Promise<Play[]> {
  // 모듈 로드 시점에 읽지 않는다. 워커가 이 파일을 import 해도 import.meta.env 를 건드리지 않도록
  const base = import.meta.env?.VITE_SYNC_URL;
  if (!base || !isCode(code)) return plays as Play[];
  try {
    const res = await fetch(`${base}/h/${code}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(plays),
    });
    if (!res.ok) return plays as Play[];
    const merged = mergePlays(plays, sanitizePlays(await res.json()));
    savePlays(merged);
    return merged;
  } catch {
    return plays as Play[];
  }
}
