import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import worker from '../../worker/index';
import { isCode } from './history';
import { constantTimeEqual, derive, isDk, isUserId, MIN_PW, sha256hex } from './auth';
import App from '../App';

describe('계정 검증', () => {
  it('아이디는 소문자·숫자·밑줄 3~20자만 받는다', () => {
    for (const ok of ['abc', 'se_jin', 'a'.repeat(20), 'user123']) {
      expect(isUserId(ok)).toBe(true);
    }
    for (const bad of [
      'ab', // 짧다
      'a'.repeat(21), // 길다
      'Sejin', // 대문자 — 대소문자만 다른 계정이 생기면 안 된다
      'se jin',
      'se-jin',
      'u:admin', // KV 키 공간을 넘보는 입력
      '../etc',
      '한글',
      '',
      null,
      42,
      { toString: () => 'abc' },
    ]) {
      expect(isUserId(bad)).toBe(false);
    }
  });

  it('dk 는 64자 소문자 hex 만 받는다', () => {
    expect(isDk('a'.repeat(64))).toBe(true);
    expect(isDk('0123456789abcdef'.repeat(4))).toBe(true);
    for (const bad of ['a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), 'g'.repeat(64), '', null]) {
      expect(isDk(bad)).toBe(false);
    }
  });

  it('아이디는 기록 코드로 오인될 수 없다', () => {
    // 계정 키는 `u:` 를 붙여 저장한다. 코드 판정과 절대 겹치면 안 된다
    for (const id of ['abc', 'a'.repeat(20), 'user_1']) {
      expect(isCode(`u:${id}`)).toBe(false);
    }
  });

  it('상수시간 비교가 길이·내용을 모두 본다', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'ab')).toBe(false);
    expect(constantTimeEqual('', '')).toBe(true);
  });

  it('derive 는 결정적이고, 아이디나 비번이 다르면 결과가 달라진다', async () => {
    const a = await derive('sejin', 'correct horse');
    expect(await derive('sejin', 'correct horse')).toBe(a);
    expect(isDk(a)).toBe(true);
    // 같은 비번이라도 아이디가 다르면 달라야 한다 (아이디가 솔트다)
    expect(await derive('other', 'correct horse')).not.toBe(a);
    expect(await derive('sejin', 'wrong horse')).not.toBe(a);
  });

  it('sha256hex 는 dk 형식과 같은 폭을 낸다', async () => {
    expect(isDk(await sha256hex('아무거나'))).toBe(true);
  });

  it('비밀번호 최소 길이가 정해져 있다', () => {
    expect(MIN_PW).toBeGreaterThanOrEqual(8);
  });
});

describe('계정 워커', () => {
  const DK = '0123456789abcdef'.repeat(4);
  const DK2 = 'fedcba9876543210'.repeat(4);

  const env = () => {
    const store = new Map<string, string>();
    let writes = 0;
    return {
      HISTORY: {
        get: async (k: string) => store.get(k) ?? null,
        put: async (k: string, v: string) => {
          writes++;
          store.set(k, v);
        },
      },
      ORIGIN: 'https://setosejin.github.io',
      writes: () => writes,
      keys: () => [...store.keys()],
    };
  };

  const auth = (e: ReturnType<typeof env>, route: 'signup' | 'login', body: unknown) =>
    worker.fetch(
      new Request(`https://w.dev/a/${route}`, { method: 'POST', body: JSON.stringify(body) }),
      e,
    );

  const codeOf = async (res: Response) => ((await res.json()) as { code: string }).code;

  it('가입하면 서버가 만든 기록 코드를 준다', async () => {
    const e = env();
    const res = await auth(e, 'signup', { id: 'sejin', dk: DK });
    expect(res.status).toBe(201);
    expect(isCode(await codeOf(res))).toBe(true);
    expect(e.keys()).toEqual(['u:sejin']);
  });

  it('비밀번호 원문도 dk 도 그대로 저장하지 않는다', async () => {
    const e = env();
    await auth(e, 'signup', { id: 'sejin', dk: DK });
    const stored = await e.HISTORY.get('u:sejin');
    expect(stored).not.toContain(DK);
  });

  it('같은 아이디로 두 번 가입할 수 없다', async () => {
    const e = env();
    await auth(e, 'signup', { id: 'sejin', dk: DK });
    const dup = await auth(e, 'signup', { id: 'sejin', dk: DK2 });
    expect(dup.status).toBe(409);
    // 남의 계정을 덮어쓰지 못한다
    expect(await codeOf(await auth(e, 'login', { id: 'sejin', dk: DK }))).toBeTruthy();
  });

  it('로그인하면 가입 때와 같은 코드가 나온다', async () => {
    const e = env();
    const signed = await codeOf(await auth(e, 'signup', { id: 'sejin', dk: DK }));
    const res = await auth(e, 'login', { id: 'sejin', dk: DK });
    expect(res.status).toBe(200);
    expect(await codeOf(res)).toBe(signed);
  });

  it('로그인은 KV 에 쓰지 않는다', async () => {
    const e = env();
    await auth(e, 'signup', { id: 'sejin', dk: DK });
    const before = e.writes();
    await auth(e, 'login', { id: 'sejin', dk: DK });
    await auth(e, 'login', { id: 'sejin', dk: DK2 });
    expect(e.writes()).toBe(before);
  });

  it('비밀번호가 틀리거나 없는 아이디면 401', async () => {
    const e = env();
    await auth(e, 'signup', { id: 'sejin', dk: DK });
    expect((await auth(e, 'login', { id: 'sejin', dk: DK2 })).status).toBe(401);
    expect((await auth(e, 'login', { id: 'nobody', dk: DK })).status).toBe(401);
  });

  it('형식이 틀리면 400 이고 KV 를 건드리지 않는다', async () => {
    const e = env();
    for (const body of [
      { id: 'Sejin', dk: DK },
      { id: 'ab', dk: DK },
      { id: 'u:admin', dk: DK },
      { id: 'sejin', dk: 'short' },
      { id: 'sejin' },
      { dk: DK },
      null,
      [],
      'string',
    ]) {
      expect((await auth(e, 'signup', body)).status).toBe(400);
      expect((await auth(e, 'login', body)).status).toBe(400);
    }
    expect(e.writes()).toBe(0);
  });

  it('JSON 이 아니면 400, 본문이 크면 413', async () => {
    const e = env();
    const raw = (body: string) =>
      worker.fetch(new Request('https://w.dev/a/signup', { method: 'POST', body }), e);
    expect((await raw('찢어진 json')).status).toBe(400);
    expect((await raw('x'.repeat(2000))).status).toBe(413);
    expect(e.writes()).toBe(0);
  });

  it('클라이언트가 기록 코드를 고를 수 없다', async () => {
    // 코드를 지정할 수 있으면 남의 코드를 자기 계정으로 등록해 기록을 가져갈 수 있다
    const e = env();
    const mine = 'z'.repeat(22);
    const got = await codeOf(await auth(e, 'signup', { id: 'thief', dk: DK, code: mine }));
    expect(got).not.toBe(mine);
    expect(isCode(got)).toBe(true);
  });

  it('가입 → 기록 저장 → 다른 기기 로그인 → 같은 기록', async () => {
    const e = env();
    const play = {
      seed: 'a1b2c3',
      n: 4,
      at: 1000,
      ok: true,
      tries: 2,
      title: '사라진 회중시계',
    };

    // 기기 A: 가입하고 받은 코드로 기록을 올린다
    const code = await codeOf(await auth(e, 'signup', { id: 'sejin', dk: DK }));
    await worker.fetch(
      new Request(`https://w.dev/h/${code}`, { method: 'POST', body: JSON.stringify([play]) }),
      e,
    );

    // 기기 B: 아이디·비번만으로 같은 코드를 받아 기록을 그대로 받아간다
    const code2 = await codeOf(await auth(e, 'login', { id: 'sejin', dk: DK }));
    expect(code2).toBe(code);
    const down = await worker.fetch(
      new Request(`https://w.dev/h/${code2}`, { method: 'POST', body: '[]' }),
      e,
    );
    expect(await down.json()).toEqual([play]);
  });

  it('계정 키와 기록 키가 섞이지 않는다', async () => {
    const e = env();
    const code = await codeOf(await auth(e, 'signup', { id: 'sejin', dk: DK }));
    await worker.fetch(
      new Request(`https://w.dev/h/${code}`, {
        method: 'POST',
        body: JSON.stringify([
          { seed: 's', n: 4, at: 1, ok: true, tries: 1, title: 't' },
        ]),
      }),
      e,
    );
    expect(e.keys().sort()).toEqual(['u:sejin', code].sort());
    // 계정 레코드를 기록으로 읽으려는 시도는 코드 형식에서 막힌다
    expect(
      (
        await worker.fetch(
          new Request('https://w.dev/h/u:sejin', { method: 'POST', body: '[]' }),
          e,
        )
      ).status,
    ).toBe(400);
  });
});

describe('계정 UI', () => {
  const render = () => renderToStaticMarkup(createElement(App));

  it('동기화 서버가 없는 빌드에서는 로그인 UI 를 아예 안 그린다', () => {
    // 포크가 원본 워커를 못 쓰는데 로그인 창만 떠 있으면 안 된다
    expect(import.meta.env.VITE_SYNC_URL).toBeFalsy();
    const html = render();
    expect(html).not.toContain('로그인하고 기록 잇기');
    expect(html).not.toContain('type="password"');
  });

  it('로그인 서버가 없어도 복구 키와 기록은 그대로 보인다', () => {
    const html = render();
    expect(html).toContain('복구 키');
    expect(html).toContain('기록 코드 붙여넣기');
  });

  it('동기화 서버가 있으면 로그인 폼을 그린다', () => {
    vi.stubEnv('VITE_SYNC_URL', 'https://sync.example.com');
    try {
      const html = render();
      expect(html).toContain('로그인하고 기록 잇기');
      expect(html).toContain('type="password"');
      // 비밀번호 관리자가 알아보게 표준 힌트를 준다.
      // React 는 속성명을 카멜케이스로 뱉는데 HTML 속성명은 대소문자를 안 가려서 동작에 지장이 없다
      expect(html).toMatch(/autocomplete="current-password"/i);
      expect(html).toMatch(new RegExp(`minlength="${MIN_PW}"`, 'i'));
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('로그인 중이면 로그아웃만 보이고 "기록 지우기" 는 감춘다', () => {
    // 둘은 같은 동작인데, 계정 사본이 남아 다시 로그인하면 돌아오므로
    // "지우기" 라는 말이 로그인 상태에서는 거짓말이 된다
    const store = new Map([
      ['murdoku.user', 'tester'],
      ['murdoku.code', 'a'.repeat(22)],
    ]);
    vi.stubEnv('VITE_SYNC_URL', 'https://sync.example.com');
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    try {
      const html = render();
      expect(html).toContain('로그아웃');
      // 문자열이 아니라 버튼으로 본다 — 버전 기록 모달이 이 문구를 그대로 인용한다
      expect(html).not.toMatch(/<button[^>]*>이 기기에서 기록 지우기<\/button>/);
      expect(html).not.toContain('type="password"');
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
