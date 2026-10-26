import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseCurrentGame,
  readCurrentGame,
  saveCurrentGame,
  type CurrentGame,
} from './currentGame';
import { DIFFICULTIES } from './generate';
import { MAX_SEED_LEN, SCORE_BASE } from './history';

const saved = (over: Partial<CurrentGame> = {}): CurrentGame => ({
  format: 1,
  n: 7,
  seed: 'ux-resume-check',
  marks: { '0,0': 'A' },
  brush: 'A',
  accused: '',
  result: null,
  attempt: 0,
  revealed: false,
  peeked: false,
  earned: 0,
  ...over,
});

describe('현재 사건 검증', () => {
  it('진행 중인 사건의 모든 값을 보존한다', () => {
    expect(parseCurrentGame(saved())).toEqual(saved());
  });

  it.each(DIFFICULTIES)('실제 난이도 $n 의 사건을 받아들인다', ({ n }) => {
    const game = saved({ n, marks: {} });
    expect(parseCurrentGame(game)).toEqual(game);
  });

  it('기록과 같은 시드 길이 상한을 쓰고 원문을 보존한다', () => {
    for (const seed of ['a', ' 시드 원문 ', '가'.repeat(MAX_SEED_LEN)]) {
      expect(parseCurrentGame(saved({ seed }))?.seed).toBe(seed);
    }
    expect(parseCurrentGame(saved({ seed: '가'.repeat(MAX_SEED_LEN + 1) }))).toBeNull();
  });

  it.each([
    [4, 'C', 'D'],
    [5, 'D', 'E'],
    [6, 'E', 'F'],
    [7, 'F', 'G'],
  ] as const)('%i 칸에서는 용의자가 한 명 적다', (n, last, beyond) => {
    const game = saved({ n, marks: { '0,0': last }, brush: last, accused: last });
    expect(parseCurrentGame(game)).toEqual(game);
    for (const over of [
      { marks: { '0,0': beyond } },
      { brush: beyond },
      { accused: beyond },
    ]) {
      expect(parseCurrentGame(saved({ n, ...over }))).toBeNull();
    }
  });

  it.each(['V', 'X'])('%s 는 메모와 브러시에만 쓸 수 있다', (id) => {
    const game = saved({ marks: { '0,0': id }, brush: id });
    expect(parseCurrentGame(game)).toEqual(game);
    expect(parseCurrentGame(saved({ accused: id }))).toBeNull();
  });

  it('모든 칸의 메모까지 허용하지만 격자보다 많은 메모는 거부한다', () => {
    const marks = Object.fromEntries(
      Array.from({ length: 49 }, (_, i) => [`${Math.floor(i / 7)},${i % 7}`, 'X']),
    );
    expect(parseCurrentGame(saved({ marks }))?.marks).toEqual(marks);
    expect(parseCurrentGame(saved({ marks: { ...marks, '7,0': 'A' } }))).toBeNull();
  });

  it.each([
    '7,0', '0,7', '-1,0', '0,-1', '00,0', '0,00', '+0,0', '0,+1', '-0,0', '0,-0',
    ' 0,0', '0,0 ', '0, 0', '1.0,0', '0,1e0', '0x1,0', '1.5,0', 'NaN,0', 'Infinity,0',
    '0', '0,0,0', ',', '0,0\n', '0,0\r\n', '__proto__', 'constructor', 'toString',
  ])('정규 형식의 격자 안 좌표가 아니면 거부한다: %j', (key) => {
    expect(parseCurrentGame(saved({ marks: { [key]: 'A' } }))).toBeNull();
  });

  it.each(['', 'G', 'AA', 'a', 'v', 1, true, null, undefined, {}])(
    '메모 하나라도 잘못된 인물이면 사건 전체를 거부한다: %j',
    (value) => {
      expect(parseCurrentGame({ ...saved(), marks: { '0,0': 'A', '0,1': value } })).toBeNull();
    },
  );

  it('배열과 원시 값은 사건 객체로 받아들이지 않는다', () => {
    for (const raw of [undefined, null, 1, true, '사건', [], [saved()], {}]) {
      expect(parseCurrentGame(raw)).toBeNull();
    }
  });

  it('필수 필드를 하나라도 빼면 거부한다', () => {
    for (const field of Object.keys(saved())) {
      const raw: Record<string, unknown> = { ...saved() };
      delete raw[field];
      expect(parseCurrentGame(raw), field).toBeNull();
    }
  });

  it.each([
    { field: 'format', values: [0, 2, 999, '1', null] },
    { field: 'n', values: [0, 3, 8, 4.5, '4', NaN, Infinity, null] },
    { field: 'seed', values: ['', 1, null] },
    { field: 'marks', values: [null, [], [['0,0', 'A']], 'A', 1] },
    { field: 'brush', values: ['', 'G', 'AA', 'a', 1, null] },
    { field: 'accused', values: ['G', 'AA', 'a', 1, null] },
    { field: 'result', values: ['', 'success', true, 0] },
    { field: 'attempt', values: [-1, 0.5, '1', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1] },
    { field: 'revealed', values: ['false', 1, 0, null] },
    { field: 'peeked', values: ['false', 1, 0, null] },
  ])('$field 의 타입이나 범위가 틀리면 거부한다', ({ field, values }) => {
    for (const value of values) {
      expect(parseCurrentGame({ ...saved(), [field]: value }), String(value)).toBeNull();
    }
  });

  it('지목 횟수는 안전한 정수 상한까지 보존한다', () => {
    const game = saved({ attempt: Number.MAX_SAFE_INTEGER });
    expect(parseCurrentGame(game)).toEqual(game);
  });

  it.each(['correct', 'wrong'] as const)('%s 판정에는 한 번 이상의 지목이 필요하다', (result) => {
    expect(parseCurrentGame(saved({ result }))).toBeNull();
    const game = saved({ result, attempt: 1 });
    expect(parseCurrentGame(game)).toEqual(game);
  });

  it.each([null, 'wrong'] as const)('미해결 판정 %j 의 점수는 0이어야 한다', (result) => {
    expect(parseCurrentGame(saved({ result, attempt: 1, earned: 1 }))).toBeNull();
  });

  it.each(DIFFICULTIES)('$n 칸의 획득 점수는 기본 점수를 넘을 수 없다', ({ n }) => {
    for (const earned of [0, 1, SCORE_BASE[n]]) {
      const game = saved({ n, result: 'correct', attempt: 1, earned });
      expect(parseCurrentGame(game)).toEqual(game);
    }
    expect(
      parseCurrentGame(saved({ n, result: 'correct', attempt: 1, earned: SCORE_BASE[n] + 1 })),
    ).toBeNull();
  });

  it.each([-1, 0.5, NaN, Infinity, '0', null])('점수는 음수가 아닌 정수여야 한다: %j', (earned) => {
    expect(parseCurrentGame({ ...saved({ result: 'correct', attempt: 1 }), earned })).toBeNull();
  });

  it.each([null, 'wrong'] as const)('미해결 판정 %j 에서 정답을 보려면 포기 기록이 필요하다', (result) => {
    const game = saved({ result, attempt: 1, revealed: true });
    expect(parseCurrentGame(game)).toBeNull();
    expect(parseCurrentGame({ ...game, peeked: true })).toEqual({ ...game, peeked: true });
  });

  it('정답을 맞힌 뒤에는 포기하지 않아도 답을 볼 수 있다', () => {
    const game = saved({ result: 'correct', attempt: 2, earned: 360, revealed: true });
    expect(parseCurrentGame(game)).toEqual(game);
  });

  it('포기 후 답을 다시 숨겨도 포기 기록을 보존한다', () => {
    const game = saved({ peeked: true });
    expect(parseCurrentGame(game)).toEqual(game);
  });

  it('퍼즐과 정답 등 저장 계약 밖의 필드는 반환하지 않는다', () => {
    const raw = { ...saved(), puzzle: { title: '사건' }, solution: { A: { r: 0, c: 0 } } };
    expect(parseCurrentGame(raw)).toEqual(saved());
    expect(raw.solution).toEqual({ A: { r: 0, c: 0 } });
  });
});

function browserStorage(entries: [string, string][] = []) {
  const store = new Map(entries);
  const storage: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => { store.delete(key); },
    setItem: (key, value) => { store.set(key, value); },
  };
  vi.stubGlobal('window', { localStorage: storage });
  vi.stubGlobal('localStorage', storage);
  return store;
}

describe('현재 사건 저장과 읽기', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('저장한 사건이 없으면 오류 없이 빈 상태다', () => {
    browserStorage();
    expect(readCurrentGame()).toEqual({ game: null, error: null });
  });

  it.each([
    { name: '진행 중', game: saved() },
    {
      name: '오답 지목',
      game: saved({ accused: 'F', result: 'wrong', attempt: 2, brush: 'V', marks: { '6,6': 'X' } }),
    },
    {
      name: '오답 후 해결',
      game: saved({ n: 4, accused: 'C', result: 'correct', attempt: 2, earned: 120, revealed: true }),
    },
    { name: '포기', game: saved({ revealed: true, peeked: true }) },
    { name: '이미 푼 사건 재해결', game: saved({ result: 'correct', attempt: 1, earned: 0 }) },
  ])('$name 상태를 모든 값 그대로 저장하고 복원한다', ({ game }) => {
    const store = browserStorage();
    expect(saveCurrentGame(game)).toBe(true);
    expect(JSON.parse(store.get('murdoku.current')!)).toEqual(game);
    expect(readCurrentGame()).toEqual({ game, error: null });
  });

  it('현재 사건 하나만 덮어쓰고 플레이 기록은 건드리지 않는다', () => {
    const store = browserStorage([
      ['murdoku.current', JSON.stringify(saved())],
      ['murdoku.history', '[{"seed":"과거 사건"}]'],
    ]);
    const next = saved({ n: 4, seed: '다음 사건', marks: {}, brush: 'X' });
    expect(saveCurrentGame(next)).toBe(true);
    expect(readCurrentGame()).toEqual({ game: next, error: null });
    expect(store.get('murdoku.history')).toBe('[{"seed":"과거 사건"}]');
    expect(store.size).toBe(2);
  });

  it('저장할 때도 퍼즐과 정답은 직렬화하지 않는다', () => {
    const store = browserStorage();
    expect(saveCurrentGame({ ...saved(), ...{ puzzle: {}, solution: { A: '0,0' } } })).toBe(true);
    expect(JSON.parse(store.get('murdoku.current')!)).toEqual(saved());
  });

  it.each([
    '', '{', 'null', '[]', '"사건"', '{}',
    JSON.stringify({ ...saved(), format: 999 }),
    JSON.stringify({ ...saved(), marks: { '7,0': 'A' } }),
    JSON.stringify({ ...saved(), peeked: 'false' }),
    JSON.stringify({ ...saved(), revealed: true }),
  ])('JSON이나 저장 형식이 잘못되면 복원 성공이 아니라 invalid 다: %j', (raw) => {
    const store = browserStorage([['murdoku.current', raw]]);
    expect(readCurrentGame()).toEqual({ game: null, error: 'invalid' });
    expect(store.get('murdoku.current')).toBe(raw);
  });

  it('읽기 연산이 실패하면 invalid 가 아니라 storage 다', () => {
    browserStorage();
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('읽기 실패');
    });
    expect(readCurrentGame()).toEqual({ game: null, error: 'storage' });
  });

  it('저장 공간 속성에 접근할 수 없어도 예외를 밖으로 던지지 않는다', () => {
    vi.stubGlobal('window', {
      get localStorage() { throw new Error('접근 차단'); },
    });
    expect(readCurrentGame()).toEqual({ game: null, error: 'storage' });
    expect(saveCurrentGame(saved())).toBe(false);
  });

  it('브라우저에 저장 API 가 없으면 저장 불가를 알린다', () => {
    vi.stubGlobal('window', {});
    expect(readCurrentGame()).toEqual({ game: null, error: 'storage' });
    expect(saveCurrentGame(saved())).toBe(false);
  });

  it('쓰기 실패를 성공으로 숨기지 않고 이전 저장본도 보존한다', () => {
    const raw = JSON.stringify(saved());
    const store = browserStorage([['murdoku.current', raw]]);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('저장 용량 초과');
    });
    expect(saveCurrentGame(saved({ attempt: 1 }))).toBe(false);
    expect(store.get('murdoku.current')).toBe(raw);
    expect(readCurrentGame()).toEqual({ game: saved(), error: null });
  });

  it('잘못된 상태를 저장하지 않고 이전 저장본을 보존한다', () => {
    const raw = JSON.stringify(saved());
    const store = browserStorage([['murdoku.current', raw]]);
    expect(saveCurrentGame(saved({ n: 8 }))).toBe(false);
    expect(store.get('murdoku.current')).toBe(raw);
  });

  it('DOM 없는 서버에서는 저장본 없이 시작하고 쓰지도 않는다', () => {
    const raw = JSON.stringify(saved());
    const store = browserStorage([['murdoku.current', raw]]);
    vi.stubGlobal('window', undefined);
    expect(readCurrentGame()).toEqual({ game: null, error: null });
    expect(saveCurrentGame(saved({ attempt: 1 }))).toBe(false);
    expect(store.get('murdoku.current')).toBe(raw);
  });
});
