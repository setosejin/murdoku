import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import worker from '../../worker/index';
import { fakeEnv } from '../game/kvFake';
import { SCORE_BASE } from '../game/history';
import AdminApp from './AdminApp';

const TOKEN = 'x'.repeat(64);
const DK = '0123456789abcdef'.repeat(4);

type E = ReturnType<typeof fakeEnv>;

const post = (e: E, path: string, body?: unknown, token?: string) =>
  worker.fetch(
    new Request(`https://w.dev${path}`, {
      method: 'POST',
      ...(token === undefined ? {} : { headers: { 'x-admin-token': token } }),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    e,
  );

const adm = <T,>(e: E, sub: string, body?: unknown) =>  post(e, `/adm/${sub}`, body ?? {}, TOKEN).then(async (r) => ({
    status: r.status,
    body: (r.status === 200 ? await r.json() : null) as T,
  }));

/** 가입해서 이름 붙은 코드를 받고 사건 하나를 푼다 */
const solve = async (e: E, id: string, seed = 'a') => {
  const res = await post(e, '/a/signup', { id, dk: DK });
  const { code } = (await res.json()) as { code: string };
  await post(e, `/h/${code}`, [{ seed, n: 4, at: 1000, ok: true, tries: 1, title: '사건' }]);
  return code;
};

describe('관리자 문지기', () => {
  it('토큰이 없거나 틀리면 401 이고, 아무것도 안 흘린다', async () => {
    const e = fakeEnv({ ADMIN_TOKEN: TOKEN });
    await solve(e, 'sejin');

    for (const t of [undefined, '', 'wrong', TOKEN.slice(0, -1)]) {
      const res = await post(e, '/adm/list', {}, t);
      expect(res.status).toBe(401);
      expect(await res.text()).not.toContain('sejin');
    }
  });

  it('ADMIN_TOKEN 을 안 넣은 배포는 아무도 못 들어온다', async () => {
    const e = fakeEnv();
    await solve(e, 'sejin');
    // 시크릿이 비면 "검사 통과"가 아니라 "전원 차단"이어야 한다
    for (const t of ['', 'x', TOKEN]) expect((await post(e, '/adm/list', {}, t)).status).toBe(401);
  });

  it('없는 하위 경로는 404 이고 KV 를 건드리지 않는다', async () => {
    const e = fakeEnv({ ADMIN_TOKEN: TOKEN });
    await solve(e, 'sejin');
    const before = e.writes();
    expect((await adm(e, 'nuke', { id: 'sejin' })).status).toBe(404);
    expect(e.writes()).toBe(before);
    expect(e.keys()).toContain('u:sejin');
  });
});

describe('관리자 목록', () => {
  it('계정과 게스트 기록을 나눠서 준다 (커서를 끝까지 돈다)', async () => {
    const e = fakeEnv({ ADMIN_TOKEN: TOKEN });
    const mine = await solve(e, 'sejin');
    const hers = await solve(e, 'nara', 'b');
    const guest = 'g'.repeat(22);
    await post(e, `/h/${guest}`, [{ seed: 'c', n: 5, at: 1, ok: true, tries: 2, title: '사건' }]);

    const { body } = await adm<{
      accounts: string[];
      plays: { code: string; owned: boolean }[];
    }>(e, 'list');

    expect(body.accounts).toEqual(['nara', 'sejin']);
    // 가짜 KV 는 2개씩 끊어준다 — 커서를 안 돌면 여기서 걸린다
    expect(body.plays.map((p) => p.code).sort()).toEqual([mine, hers, guest].sort());
    expect(body.plays.find((p) => p.code === guest)?.owned).toBe(false);
    expect(body.plays.find((p) => p.code === mine)?.owned).toBe(true);
  });
});

describe('관리자 조회', () => {
  it('아이디로도 코드로도 같은 기록이 나온다', async () => {
    const e = fakeEnv({ ADMIN_TOKEN: TOKEN });
    const code = await solve(e, 'sejin');

    const byId = await adm<{ id: string; code: string; score: number; cases: number }>(e, 'get', {
      id: 'sejin',
    });
    expect(byId.body).toMatchObject({ id: 'sejin', code, cases: 1, score: SCORE_BASE[4] });

    const byCode = await adm(e, 'get', { code });
    expect(byCode.body).toEqual(byId.body);
  });

  it('없는 계정·코드·형식은 404', async () => {
    const e = fakeEnv({ ADMIN_TOKEN: TOKEN });
    for (const body of [{ id: 'nobody' }, { code: 'z'.repeat(22) }, { code: '../lb' }, {}])
      expect((await adm(e, 'get', body)).status).toBe(404);
  });

  it('없는 코드를 물어도 KV 에 쓰지 않는다', async () => {
    const e = fakeEnv({ ADMIN_TOKEN: TOKEN });
    await adm(e, 'get', { code: 'z'.repeat(22) });
    expect(e.writes()).toBe(0);
  });
});

describe('관리자 삭제', () => {
  it('기록만 지우면 계정은 남고 순위에서는 내려간다', async () => {
    const e = fakeEnv({ ADMIN_TOKEN: TOKEN });
    const code = await solve(e, 'sejin');
    expect((await adm(e, 'del', { code })).status).toBe(200);

    expect(e.keys()).toEqual([`c:${code}`, 'lb', 'u:sejin']);
    const board = (await (await post(e, `/lb/${code}`)).json()) as { top: unknown[] };
    expect(board.top).toEqual([]);
    // 계정은 그대로라 다시 로그인된다
    expect((await post(e, '/a/login', { id: 'sejin', dk: DK })).status).toBe(200);
  });

  it('계정을 지우면 계정·이름·기록이 다 사라진다', async () => {
    const e = fakeEnv({ ADMIN_TOKEN: TOKEN });
    await solve(e, 'sejin');
    await solve(e, 'nara', 'b');

    expect((await adm(e, 'del', { id: 'sejin' })).status).toBe(200);

    const left = e.keys();
    expect(left.some((k) => k.includes('sejin'))).toBe(false);
    expect(left).toHaveLength(4); // nara 의 u:/c:/기록 + lb
    expect((await post(e, '/a/login', { id: 'sejin', dk: DK })).status).toBe(401);

    // 남의 순위는 안 건드린다
    const board = (await (await post(e, '/lb/' + 'g'.repeat(22))).json()) as {
      top: { name: string }[];
    };
    expect(board.top.map((r) => r.name)).toEqual(['nara']);
  });

  it('게스트 기록도 지울 수 있다', async () => {
    const e = fakeEnv({ ADMIN_TOKEN: TOKEN });
    const guest = 'g'.repeat(22);
    await post(e, `/h/${guest}`, [{ seed: 'c', n: 5, at: 1, ok: true, tries: 1, title: '사건' }]);
    expect((await adm(e, 'del', { code: guest })).status).toBe(200);
    expect(e.keys()).toEqual([]);
  });
});

describe('관리 화면', () => {
  const render = () => renderToStaticMarkup(createElement(AdminApp));

  it('토큰이 없으면 토큰 입력만 그린다', () => {
    vi.stubEnv('VITE_SYNC_URL', 'https://w.dev');
    const html = render();
    expect(html).toContain('관리자 토큰');
    expect(html).toContain('type="password"');
    // 목록·삭제는 토큰을 넣기 전에는 존재하지도 않는다
    expect(html).not.toContain('계정 삭제');
    expect(html).not.toContain('admin-list');
    vi.unstubAllEnvs();
  });

  it('동기화 서버가 없는 빌드에서는 토큰을 받지도 않는다', () => {
    const html = render();
    expect(html).not.toContain('type="password"');
    expect(html).toContain('VITE_SYNC_URL');
  });
});
