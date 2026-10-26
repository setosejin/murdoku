import { DIFFICULTIES } from './generate';
import { MAX_SEED_LEN, SCORE_BASE } from './history';

export type CurrentGame = {
  format: 1;
  n: number;
  seed: string;
  marks: Record<string, string>;
  brush: string;
  accused: string;
  result: 'correct' | 'wrong' | null;
  attempt: number;
  revealed: boolean;
  peeked: boolean;
  earned: number;
};

export type CurrentGameRead = {
  game: CurrentGame | null;
  error: 'invalid' | 'storage' | null;
};

const CURRENT_KEY = 'murdoku.current';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseCurrentGame(raw: unknown): CurrentGame | null {
  if (!isRecord(raw)) return null;
  const {
    format, n, seed, marks: rawMarks, brush, accused, result, attempt, revealed, peeked, earned,
  } = raw;
  if (
    format !== 1 || typeof n !== 'number' || !Number.isInteger(n) ||
    !DIFFICULTIES.some((difficulty) => difficulty.n === n)
  ) return null;
  if (
    typeof seed !== 'string' || seed.length === 0 || seed.length > MAX_SEED_LEN ||
    !isRecord(rawMarks) || typeof brush !== 'string' || typeof accused !== 'string'
  ) return null;
  if (
    (result !== null && result !== 'correct' && result !== 'wrong') ||
    typeof revealed !== 'boolean' || typeof peeked !== 'boolean'
  ) return null;
  if (
    typeof attempt !== 'number' || !Number.isSafeInteger(attempt) || attempt < 0 ||
    typeof earned !== 'number' || !Number.isInteger(earned) || earned < 0 || earned > SCORE_BASE[n]
  ) return null;
  if (
    (result !== null && attempt === 0) ||
    (result !== 'correct' && earned !== 0) ||
    (revealed && !peeked && result !== 'correct')
  ) return null;

  const suspects = new Set(Array.from({ length: n - 1 }, (_, i) => String.fromCharCode(65 + i)));
  const notes = new Set([...suspects, 'V', 'X']);
  if (!notes.has(brush) || (accused !== '' && !suspects.has(accused))) return null;

  const entries = Object.entries(rawMarks);
  if (entries.length > n * n) return null;
  const marks: Record<string, string> = {};
  for (const [key, id] of entries) {
    const [r, c] = key.split(',').map(Number);
    if (
      !Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= n || c >= n ||
      key !== `${r},${c}` || typeof id !== 'string' || !notes.has(id)
    ) return null;
    marks[key] = id;
  }

  return { format, n, seed, marks, brush, accused, result, attempt, revealed, peeked, earned };
}

export function readCurrentGame(): CurrentGameRead {
  if (typeof window === 'undefined') return { game: null, error: null };
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CURRENT_KEY);
  } catch {
    return { game: null, error: 'storage' };
  }
  if (raw === null) return { game: null, error: null };
  try {
    const game = parseCurrentGame(JSON.parse(raw));
    return { game, error: game === null ? 'invalid' : null };
  } catch {
    return { game: null, error: 'invalid' };
  }
}

export function saveCurrentGame(game: CurrentGame): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const valid = parseCurrentGame(game);
    if (valid === null) return false;
    window.localStorage.setItem(CURRENT_KEY, JSON.stringify(valid));
    return true;
  } catch {
    return false;
  }
}
