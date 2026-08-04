import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from './generate';
import { fakeEnv } from './kvFake';
import worker from '../../worker/index';
import {
  isCode,
  MAX_PLAYS,
  mergePlays,
  N_RANGE,
  sanitizeBoard,
  sanitizePlays,
  SCORE_BASE,
  scoreOf,
  summarize,
  TOP_N,
  type Play,
} from './history';

describe('플레이 기록', () => {
  const play = (over: Partial<Play> = {}): Play => ({
    seed: 'a1b2c3',
    n: 4,
    at: 1000,
    ok: true,
    tries: 1,
    title: '사라진 회중시계',
    ...over,
  });

  it('N_RANGE 가 실제 난이도와 어긋나지 않는다', () => {
    const ns = DIFFICULTIES.map((d) => d.n);
    expect(Math.min(...ns)).toBe(N_RANGE.min);
    expect(Math.max(...ns)).toBe(N_RANGE.max);
  });

  it('병합은 합집합이고 같은 기록은 한 번만 남는다', () => {
    const a = play({ at: 1 });
    const b = play({ at: 2 });
    expect(mergePlays([a], [a, b])).toHaveLength(2);
    expect(mergePlays([a, b], [a, b])).toHaveLength(2);
  });

  it('같은 시드라도 다시 풀면 별도 기록이다', () => {
    expect(mergePlays([play({ at: 1 })], [play({ at: 2 })])).toHaveLength(2);
  });

  it('최근 기록이 앞에 오고 상한을 넘지 않는다', () => {
    const many = Array.from({ length: MAX_PLAYS + 50 }, (_, i) => play({ at: i + 1 }));
    const merged = mergePlays(many, [play({ at: 7 })]);

    expect(merged).toHaveLength(MAX_PLAYS);
    expect(merged[0].at).toBe(MAX_PLAYS + 50);
    expect(merged.map((p) => p.at)).toEqual([...merged.map((p) => p.at)].sort((x, y) => y - x));
  });

  it('배열이 아니면 빈 목록이다', () => {
    for (const bad of [null, undefined, 0, 'x', {}]) expect(sanitizePlays(bad)).toEqual([]);
  });

  it('망가진 레코드는 버린다', () => {
    const bad = [
      null,
      'x',
      play({ seed: '' }),
      { ...play(), seed: 123 },
      play({ n: 99 }),
      play({ n: 4.5 }),
      play({ at: 0 }),
      play({ at: 5e12 }),
      play({ tries: 0 }),
      { ...play(), ok: 'true' },
      play({ title: 'ㄱ'.repeat(200) }),
      play({ seed: 'z'.repeat(200) }),
    ];
    expect(sanitizePlays(bad)).toEqual([]);
    expect(sanitizePlays([...bad, play()])).toEqual([play()]);
  });

  it('모르는 필드는 저장하지 않는다', () => {
    const [p] = sanitizePlays([{ ...play(), solution: 'A2', evil: '×'.repeat(9999) }]);
    expect(Object.keys(p).sort()).toEqual(['at', 'n', 'ok', 'seed', 'title', 'tries']);
  });

  it('개수 상한을 넘겨 밀어넣을 수 없다', () => {
    // 중복 제거는 mergePlays 몫이다. 여기서 막는 건 개수뿐
    expect(sanitizePlays(Array.from({ length: 5000 }, () => play()))).toHaveLength(MAX_PLAYS);
  });

  it('기록 코드는 22자 소문자·숫자만 통과한다', () => {
    expect(isCode('a'.repeat(22))).toBe(true);
    for (const bad of ['', 'a'.repeat(21), 'a'.repeat(23), 'A'.repeat(22), '../'.repeat(7) + 'a'])
      expect(isCode(bad)).toBe(false);
  });
});

describe('점수', () => {
  const play = (over: Partial<Play> = {}): Play => ({
    seed: 'a1b2c3',
    n: 4,
    at: 1000,
    ok: true,
    tries: 1,
    title: '사라진 회중시계',
    ...over,
  });

  it('SCORE_BASE 가 실제 난이도와 어긋나지 않는다', () => {
    expect(Object.keys(SCORE_BASE).map(Number).sort()).toEqual(DIFFICULTIES.map((d) => d.n).sort());
    // 감점 단위가 만점의 1/5 라 5로 나누어떨어져야 정수로 떨어진다
    for (const base of Object.values(SCORE_BASE)) expect(base % 5).toBe(0);
  });

  it('난이도가 높을수록 만점이 크다', () => {
    const ns = DIFFICULTIES.map((d) => d.n);
    for (let i = 1; i < ns.length; i++)
      expect(SCORE_BASE[ns[i]]).toBeGreaterThan(SCORE_BASE[ns[i - 1]]);
  });

  it('지목이 늘수록 20%씩 깎이고 20%는 남는다', () => {
    const full = SCORE_BASE[6];
    const unit = full / 5;
    expect(scoreOf(play({ n: 6, tries: 1 }))).toBe(full);
    expect(scoreOf(play({ n: 6, tries: 2 }))).toBe(full - unit);
    expect(scoreOf(play({ n: 6, tries: 5 }))).toBe(unit);
    // 아무리 헤매도 0 밑으로는 안 간다
    expect(scoreOf(play({ n: 6, tries: 999 }))).toBe(unit);
    expect(Number.isInteger(scoreOf(play({ n: 5, tries: 3 })))).toBe(true);
  });

  it('ok:false 인 기록은 0점이다 (앱은 안 쓰지만 남의 기록이 들어올 수 있다)', () => {
    expect(scoreOf(play({ ok: false, tries: 1 }))).toBe(0);
  });

  it('같은 사건은 첫 해결만 친다 (다시 풀어 점수를 불릴 수 없다)', () => {
    const sloppy = play({ n: 6, at: 100, tries: 4 });
    // 답을 알고 다시 푼 판. 나중 기록이라 점수에 반영되면 안 된다
    const replay = play({ n: 6, at: 200, tries: 1 });

    expect(summarize([sloppy]).score).toBe(scoreOf(sloppy));
    expect(summarize([sloppy, replay]).score).toBe(scoreOf(sloppy));
    expect(summarize([replay, sloppy]).score).toBe(scoreOf(sloppy));
    expect(summarize([sloppy, replay]).cases).toBe(1);
  });

  it('다른 사건은 따로 더해진다', () => {
    const a = play({ seed: 'aaa', n: 4, tries: 1 });
    const b = play({ seed: 'bbb', n: 7, tries: 2 });
    expect(summarize([a, b])).toEqual({ score: scoreOf(a) + scoreOf(b), cases: 2 });
  });

  it('ok:false 인 기록은 사건 수에도 안 들어간다', () => {
    expect(summarize([play({ ok: false })])).toEqual({ score: 0, cases: 0 });
  });

  it('순위표도 검증하고 점수순으로 세운다', () => {
    const row = (over: Record<string, unknown> = {}) => ({
      name: 'sejin',
      score: 100,
      cases: 1,
      at: 1,
      ...over,
    });

    expect(sanitizeBoard('x')).toEqual([]);
    expect(sanitizeBoard([row({ name: '' }), row({ score: -1 }), row({ at: 0 }), null, 'x'])).toEqual(
      [],
    );

    const sorted = sanitizeBoard([
      row({ name: 'b', score: 100, at: 2 }),
      row({ name: 'c', score: 300 }),
      row({ name: 'a', score: 100, at: 1 }),
    ]);
    // 동점이면 먼저 올린 쪽이 앞이다
    expect(sorted.map((e) => e.name)).toEqual(['c', 'a', 'b']);

    const [clean] = sanitizeBoard([{ ...row(), evil: '×'.repeat(9999) }]);
    expect(Object.keys(clean).sort()).toEqual(['at', 'cases', 'name', 'score']);
  });
});

describe('기록 동기화 워커', () => {
  const CODE = 'a'.repeat(22);
  const play = (at: number) => ({
    seed: 'a1b2c3',
    n: 4,
    at,
    ok: true,
    tries: 1,
    title: '사라진 회중시계',
  });

  const env = () => fakeEnv({ ORIGIN: 'https://setosejin.github.io' });

  const post = (e: ReturnType<typeof env>, path: string, body: unknown) =>
    worker.fetch(
      new Request(`https://w.dev${path}`, { method: 'POST', body: JSON.stringify(body) }),
      e,
    );

  it('올린 기록을 돌려주고, 다른 기기는 빈 배열로 받아간다', async () => {
    const e = env();
    const up = await post(e, `/h/${CODE}`, [play(1)]);
    expect(up.status).toBe(200);
    expect(await up.json()).toEqual([play(1)]);

    const down = await post(e, `/h/${CODE}`, []);
    expect(await down.json()).toEqual([play(1)]);
  });

  it('두 기기의 기록이 합쳐진다', async () => {
    const e = env();
    await post(e, `/h/${CODE}`, [play(1)]);
    const merged = await (await post(e, `/h/${CODE}`, [play(2)])).json();
    expect(merged).toEqual([play(2), play(1)]);
  });

  it('불러오기만 하면 KV에 쓰지 않는다', async () => {
    const e = env();
    await post(e, `/h/${CODE}`, [play(1)]);
    const before = e.writes();
    await post(e, `/h/${CODE}`, []);
    await post(e, `/h/${CODE}`, [play(1)]);
    expect(e.writes()).toBe(before);
  });

  it('빈 기록은 저장하지 않는다', async () => {
    // 신규 방문자마다 빈 항목이 생기면 쓰기 한도가 방문자 수에 물린다.
    // 아무 코드나 찍어 한도를 태우는 것도 막힌다
    const e = env();
    for (let i = 0; i < 5; i++) await post(e, `/h/${'b'.repeat(22)}`, []);
    expect(e.writes()).toBe(0);
    expect(await (await post(e, `/h/${'b'.repeat(22)}`, [])).json()).toEqual([]);
  });

  it('기록 코드가 아니면 400이고 KV를 건드리지 않는다', async () => {
    const e = env();
    for (const path of ['/h/../secret', '/h/', '/h/short', `/other/${CODE}`, `/h/${CODE}x`]) {
      expect((await post(e, path, [])).status).toBe(400);
    }
    expect(e.writes()).toBe(0);
  });

  it('POST 말고는 안 받고, OPTIONS 는 CORS 로 답한다', async () => {
    const e = env();
    const get = await worker.fetch(new Request(`https://w.dev/h/${CODE}`), e);
    expect(get.status).toBe(405);

    const pre = await worker.fetch(
      new Request(`https://w.dev/h/${CODE}`, { method: 'OPTIONS' }),
      e,
    );
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('https://setosejin.github.io');
  });

  it('너무 큰 본문은 413', async () => {
    const e = env();
    const res = await worker.fetch(
      new Request(`https://w.dev/h/${CODE}`, { method: 'POST', body: 'x'.repeat(70_000) }),
      e,
    );
    expect(res.status).toBe(413);
    expect(e.writes()).toBe(0);
  });

  it('망가진 본문이 저장된 기록을 지우지 못한다', async () => {
    const e = env();
    await post(e, `/h/${CODE}`, [play(1)]);
    for (const bad of ['찢어진 json', '{}', '[{"seed":1}]', 'null']) {
      const res = await worker.fetch(
        new Request(`https://w.dev/h/${CODE}`, { method: 'POST', body: bad }),
        e,
      );
      expect(await res.json()).toEqual([play(1)]);
    }
  });
});

describe('순위표 워커', () => {
  const DK = '0123456789abcdef'.repeat(4);

  const env = () => fakeEnv();

  const post = (e: ReturnType<typeof env>, path: string, body?: unknown) =>
    worker.fetch(
      new Request(`https://w.dev${path}`, {
        method: 'POST',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      e,
    );

  /** 가입해서 이름 붙은 코드를 받고, 그 코드로 사건 하나를 푼 기록을 올린다 */
  const solve = async (
    e: ReturnType<typeof env>,
    id: string,
    plays: { seed: string; n: number; tries: number; at?: number }[],
  ) => {
    const res = await post(e, '/a/signup', { id, dk: DK });
    const { code } = (await res.json()) as { code: string };
    await post(
      e,
      `/h/${code}`,
      plays.map((p) => ({ ...p, at: p.at ?? 1000, ok: true, title: '사건' })),
    );
    return code;
  };

  const board = async (e: ReturnType<typeof env>, code: string) =>
    (await (await post(e, `/lb/${code}`)).json()) as {
      top: { name: string; score: number; cases: number }[];
      rank: number | null;
    };

  it('점수순으로 세우고 내 순위를 알려준다', async () => {
    const e = env();
    const low = await solve(e, 'low', [{ seed: 'a', n: 4, tries: 1 }]);
    const high = await solve(e, 'high', [{ seed: 'b', n: 7, tries: 1 }]);

    const seen = await board(e, high);
    expect(seen.top.map((r) => r.name)).toEqual(['high', 'low']);
    expect(seen.top[0].score).toBe(SCORE_BASE[7]);
    expect(seen.rank).toBe(1);
    expect((await board(e, low)).rank).toBe(2);
  });

  it('점수는 저장된 기록에서 서버가 센다 (클라이언트가 올린 숫자를 안 믿는다)', async () => {
    const e = env();
    // 점수·순위 같은 걸 끼워 보내도 sanitizePlays 가 버린다
    const res = await post(e, '/a/signup', { id: 'cheat', dk: DK });
    const { code } = (await res.json()) as { code: string };
    await post(e, `/h/${code}`, [
      { seed: 'a', n: 4, at: 1, ok: true, tries: 9, title: '사건', score: 999_999 },
    ]);
    expect((await board(e, code)).top[0].score).toBe(SCORE_BASE[4] / 5);
  });

  it('게스트는 순위에 오르지 않는다', async () => {
    const e = env();
    await post(e, `/h/${'g'.repeat(22)}`, [
      { seed: 'a', n: 4, at: 1, ok: true, tries: 1, title: '사건' },
    ]);
    const seen = await board(e, 'g'.repeat(22));
    expect(seen.top).toEqual([]);
    expect(seen.rank).toBe(null);
  });

  it('같은 사람이 두 줄을 차지하지 않는다', async () => {
    const e = env();
    const code = await solve(e, 'sejin', [{ seed: 'a', n: 4, tries: 1 }]);
    await post(e, `/h/${code}`, [
      { seed: 'a', n: 4, at: 1000, ok: true, tries: 1, title: '사건' },
      { seed: 'b', n: 5, at: 2000, ok: true, tries: 1, title: '사건' },
    ]);

    const seen = await board(e, code);
    expect(seen.top).toHaveLength(1);
    expect(seen.top[0]).toMatchObject({ cases: 2, score: SCORE_BASE[4] + SCORE_BASE[5] });
  });

  it('TOP 10 만 내려주고, 밖에 있어도 순위는 알려준다', async () => {
    const e = env();
    let last = '';
    // 점수가 낮은 순으로 12명 — 마지막에 가입한 사람이 꼴찌다
    for (let i = 0; i < 12; i++)
      last = await solve(e, `pp${i}`, [{ seed: `s${i}`, n: 4, tries: Math.min(i + 1, 5) }]);

    const seen = await board(e, last);
    expect(seen.top).toHaveLength(TOP_N);
    expect(seen.rank).toBeGreaterThan(TOP_N);
  });

  it('기록이 안 바뀌면 순위표도 안 쓴다', async () => {
    const e = env();
    const code = await solve(e, 'sejin', [{ seed: 'a', n: 4, tries: 1 }]);
    const before = e.writes();
    await post(e, `/h/${code}`, []);
    await post(e, `/lb/${code}`);
    expect(e.writes()).toBe(before);
  });

  it('순위표보다 먼저 쌓인 기록도 올라간다', async () => {
    const e = env();
    const code = await solve(e, 'sejin', [{ seed: 'a', n: 4, tries: 1 }]);
    // 순위표만 지운다 — 기록은 그대로다. 순위표 없이 굴러가던 서버를 나중에 올린 상황이고,
    // 새 사건을 풀어야만 순위가 생긴다면 이미 다 푼 사람은 영영 순위 밖이 된다
    await e.HISTORY.delete('lb');
    await post(e, `/h/${code}`, []);
    expect((await board(e, code)).top).toMatchObject([{ name: 'sejin', cases: 1 }]);
  });

  it('기록 코드가 아니면 400', async () => {
    const e = env();
    for (const path of ['/lb/', '/lb/short', '/lb/../secret']) {
      expect((await post(e, path)).status).toBe(400);
    }
    expect(e.writes()).toBe(0);
  });

  it('망가진 순위표가 응답을 깨뜨리지 않는다', async () => {
    const e = env();
    const code = await solve(e, 'sejin', [{ seed: 'a', n: 4, tries: 1 }]);
    await e.HISTORY.put('lb', '찢어진 json');
    expect(await board(e, code)).toEqual({ top: [], rank: null });
  });
});
