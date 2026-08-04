/**
 * 점수판·순위·순위 알림.
 *
 * 순수 판정(`rankDrop`)·워커 라우트(`/lb/`, `/a/nick`)·화면(`Leaderboard`, `RankToast`, 메뉴 점)이
 * 한 덩어리로 맞아야 하는 주제라 파일도 하나다 — 서버가 이름을 어떻게 내보내느냐가
 * 화면이 내 줄을 어떻게 찾느냐를 곧바로 정한다.
 */
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import worker from '../../worker/index';
import { fakeEnv } from './kvFake';
import App from '../App';
import Leaderboard from '../components/Leaderboard';
import RankToast from '../components/RankToast';
import {
  MAX_NICK_LEN,
  rankDrop,
  SCORE_BASE,
  scoreOf,
  TOP_N,
  type Board as BoardData,
  type Play,
} from './history';

describe('점수판', () => {
  const play = (over: Partial<Play> = {}): Play => ({
    seed: 'a1b2c3',
    n: 4,
    at: 1000,
    ok: true,
    tries: 1,
    title: '사라진 회중시계',
    ...over,
  });

  const render = (
    plays: Play[],
    board: BoardData | null | undefined = undefined,
    nick = '',
  ) => renderToStaticMarkup(createElement(Leaderboard, { plays, board, nick }));

  it('내 점수를 로컬 기록에서 바로 센다 (서버가 없어도 보인다)', () => {
    const plays = [play({ seed: 'a', n: 7, tries: 2 }), play({ seed: 'b', n: 4, tries: 1 })];
    const total = plays.reduce((s, p) => s + scoreOf(p), 0);

    const html = render(plays);
    expect(html).toContain(`${total.toLocaleString('ko-KR')}점`);
    expect(html).toContain('2사건 해결');
  });

  it('점수 규칙을 SCORE_BASE 에서 그대로 읽어 보여준다', () => {
    // 문구에 숫자를 복제하면 만점을 조정할 때 조용히 거짓말이 된다
    const html = render([]);
    for (const [n, base] of Object.entries(SCORE_BASE)) expect(html).toContain(`${n}×${n} ${base}`);
  });

  it('서버가 없으면 순위 대신 그 사실을 말한다', () => {
    expect(import.meta.env.VITE_SYNC_URL).toBeFalsy();
    const html = render([]);
    expect(html).not.toContain('<ol');
    expect(html).toContain('순위 서버가 없어');
  });

  it('아직 못 받아온 순위를 없다고 말하지 않는다', () => {
    // 서버가 죽었을 때 "아직 아무도 없다"고 하면 1등인 사람이 자기가 순위 밖인 줄 안다
    vi.stubEnv('VITE_SYNC_URL', 'https://w.dev');
    try {
      const html = render([play()]);
      expect(html).not.toContain('아직 순위가 없어');
      expect(html).not.toContain('순위 서버가 없어');
      expect(render([play()], null)).toContain('순위를 못 받아왔어');
      expect(render([play()], { top: [], rank: null })).toContain('아직 순위가 없어');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('서버가 준 이름을 그대로 그리고, 내 줄은 이름이 아니라 순위로 짚는다', () => {
    // 닉네임을 단 사람은 아이디가 아예 안 내려온다. 이름으로 내 줄을 찾으면 영영 못 찾는다
    vi.stubEnv('VITE_SYNC_URL', 'https://w.dev');
    try {
      const top = [
        { name: '탐정', score: 300, cases: 3, at: 1 },
        { name: '탐정', score: 200, cases: 2, at: 2 },
        { name: 'other', score: 100, cases: 1, at: 3 },
      ];
      const html = render([play()], { top, rank: 2 });
      // 겹치는 이름이 와도 줄이 하나로 합쳐지지 않는다
      expect(html.match(/탐정/g)).toHaveLength(2);
      // 켜진 줄은 딱 하나, 그것도 두 번째다
      expect(html.match(/class="mine"/g)).toHaveLength(1);
      expect(html.indexOf('class="mine"')).toBeGreaterThan(html.indexOf('300'));
      expect(html.indexOf('class="mine"')).toBeLessThan(html.indexOf('100'));
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('TOP 밖이면 내 줄을 목록 끝에 따로 붙인다', () => {
    // 등수는 남들과 견주라고 있는 것이라, 숫자만 따로 떨어져 있으면 어느 줄 밑인지가 안 보인다
    vi.stubEnv('VITE_SYNC_URL', 'https://w.dev');
    try {
      const top = [
        { name: 'alpha', score: 300, cases: 3, at: 1 },
        { name: 'beta', score: 200, cases: 2, at: 2 },
      ];
      const html = render([play({ seed: 'a', n: 4, tries: 1 })], { top, rank: 42 }, '세진');

      const rows = html.match(/class="mine"/g);
      expect(rows).toHaveLength(1);
      // 내 줄은 맨 끝이고, 순위·이름·점수가 남들과 같은 모양으로 선다
      expect(html.indexOf('class="mine"')).toBeGreaterThan(html.indexOf('beta'));
      expect(html).toContain('>42</span>');
      expect(html).toContain('>세진</b>');
      expect(html).toContain(`>${SCORE_BASE[4].toLocaleString('ko-KR')}</em>`);
      // 10위 다음이 42위인 게 이어진 목록처럼 읽히면 안 된다
      expect(html).toContain('class="gap"');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('이미 TOP 안에 있으면 내 줄을 두 번 그리지 않는다', () => {
    vi.stubEnv('VITE_SYNC_URL', 'https://w.dev');
    try {
      const top = [
        { name: 'alpha', score: 300, cases: 3, at: 1 },
        { name: 'beta', score: 200, cases: 2, at: 2 },
      ];
      const html = render([play()], { top, rank: 2 }, '세진');
      expect(html.match(/class="mine"/g)).toHaveLength(1);
      expect(html).not.toContain('class="gap"');
      // 켜진 줄은 서버가 보낸 이름 그대로다 — 내 줄을 덧붙여 두 번 그리지 않는다
      expect(html).toContain('class="mine"><span class="rk">2</span><b>beta</b>');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('순위가 없으면 왜 없는지 말한다 (사람이 없어서로 읽히면 안 된다)', () => {
    vi.stubEnv('VITE_SYNC_URL', 'https://w.dev');
    vi.stubGlobal('localStorage', { getItem: () => 'tester', setItem: () => {} });
    try {
      const top = [{ name: 'alpha', score: 300, cases: 3, at: 1 }];
      const html = render([play()], { top, rank: null });
      expect(html).not.toContain('class="mine"');
      expect(html).toContain('아직 순위에 안 올랐어');
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it("이름을 정한 사람만 '탐정' 으로 부른다", () => {
    // 아이디는 로그인 수단이지 불릴 이름이 아니다
    expect(render([play()], undefined, '세진')).toContain('세진 탐정');
    expect(render([play()], undefined, '')).toContain('내 점수');
    expect(render([play()], undefined, '')).not.toContain('탐정');
    // 말투는 사건 수까지 함께 바뀐다 — 한 건 풀었으면 지금은 두 번째 사건이다
    expect(render([play()], undefined, '세진')).toContain('2번째 사건 해결 중');
    expect(render([play()], undefined, '')).toContain('1사건 해결');
  });
});

describe('순위 알림', () => {
  const toast = (alert: { from: number; to: number } | null, detective = '') =>
    renderToStaticMarkup(createElement(RankToast, { alert, detective, onClose: () => {} }));

  it('알릴 게 없어도 살아 있는 영역은 붙어 있다', () => {
    // role=status 는 붙은 뒤에 내용이 바뀌어야 읽힌다. 알림과 함께 마운트되면 조용히 지나친다
    const html = toast(null);
    expect(html).toContain('role="status"');
    expect(html).not.toContain('class="toast"');
  });

  it('밀린 자리를 어디서 어디로인지 말한다', () => {
    const html = toast({ from: 3, to: 5 });
    expect(html).toContain('class="toast"');
    expect(html).toContain('3위');
    expect(html).toContain('5위');
    // 타이머에만 기대면 천천히 읽는 사람이 놓친다
    expect(html).toContain('aria-label="알림 닫기"');
  });

  it("이름을 정한 사람만 '탐정' 으로 부른다", () => {
    // 받는 값은 이미 `detectiveName` 을 거친 것이다 — 부를 이름을 만드는 규칙은 한 군데뿐이다
    expect(toast({ from: 3, to: 5 }, '세진 탐정')).toContain('세진 탐정, 누가 자리를 가져갔어');
    expect(toast({ from: 3, to: 5 })).toContain('누가 자리를 가져갔어');
    expect(toast({ from: 3, to: 5 })).not.toContain('탐정');
  });
});

describe('메뉴 버튼의 알림 점', () => {
  it('알릴 게 없으면 점도 없고 이름표도 그대로다', () => {
    // 켜진 쪽은 모바일 셸 테스트가 검사한다 (거기는 game 을 통째로 지어낼 수 있다)
    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('aria-label="더보기"');
    expect(html).not.toContain('alert-dot');
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

  it('기록 코드가 아니면 400, 모르는 주소는 404', async () => {
    const e = env();
    for (const path of ['/lb/', '/lb/short']) {
      expect((await post(e, path)).status).toBe(400);
    }
    // `..` 은 URL 이 먼저 펴서 /lb/ 로 시작하지도 않는다 — 모르는 주소로 떨어진다
    expect((await post(e, '/lb/../secret')).status).toBe(404);
    expect(e.writes()).toBe(0);
  });

  it('닉네임을 달면 순위표에 그 이름이 뜨고, 지우면 아이디로 돌아온다', async () => {
    const e = env();
    const code = await solve(e, 'sejin', [{ seed: 'a', n: 4, tries: 1 }]);
    expect((await board(e, code)).top[0].name).toBe('sejin');

    // 이미 올라 있는 줄도 바로 고친다 — 새 사건을 풀어야 바뀌면 아무도 못 알아챈다
    expect((await post(e, '/a/nick', { code, nick: '세진 🕵' })).status).toBe(200);
    const named = await board(e, code);
    expect(named.top[0].name).toBe('세진 🕵');
    // 순위는 여전히 아이디로 매긴다 — 닉네임은 보여주기용이라 신원이 아니다
    expect(named.rank).toBe(1);

    expect((await post(e, '/a/nick', { code, nick: '' })).status).toBe(200);
    expect((await board(e, code)).top[0].name).toBe('sejin');
  });

  it('닉네임을 단 사람의 아이디는 남들에게 안 나간다', async () => {
    const e = env();
    const mine = await solve(e, 'sejin', [{ seed: 'a', n: 7, tries: 1 }]);
    await post(e, '/a/nick', { code: mine, nick: '탐정' });
    const other = await solve(e, 'other', [{ seed: 'b', n: 4, tries: 1 }]);

    const seen = await board(e, other);
    expect(JSON.stringify(seen)).not.toContain('sejin');
    // 내 줄은 이름이 아니라 순위로 짚는다
    expect(seen.rank).toBe(2);
    expect(seen.top[1].name).toBe('other');
  });

  it('닉네임은 계정만 달 수 있고 형식도 본다', async () => {
    const e = env();
    const code = await solve(e, 'sejin', [{ seed: 'a', n: 4, tries: 1 }]);

    // 게스트 코드에는 달 수 없다 — 순위에 오르지도 않는다
    expect((await post(e, '/a/nick', { code: 'g'.repeat(22), nick: '세진' })).status).toBe(404);
    for (const nick of [
      ' 세진', // 앞뒤 공백은 자른 뒤라야 통과다
      '   ',
      'a'.repeat(MAX_NICK_LEN + 1),
      '세\u200b진', // 폭 0 문자 — 눈에 안 보이면서 줄을 흐트러뜨린다
      '세\u202e진', // 방향 뒤집기
      '세\n진',
      42,
      null,
    ]) {
      expect((await post(e, '/a/nick', { code, nick })).status).toBe(400);
    }
    expect((await post(e, '/a/nick', { code: 'short', nick: '세진' })).status).toBe(400);
    // 하나도 안 붙었어야 한다
    expect((await board(e, code)).top[0].name).toBe('sejin');
  });

  it('로그인하면 서버가 들고 있던 닉네임을 같이 내려준다', async () => {
    const e = env();
    const code = await solve(e, 'sejin', [{ seed: 'a', n: 4, tries: 1 }]);
    await post(e, '/a/nick', { code, nick: '세진' });
    // 기기를 옮겨도 입력칸이 채워져야 한다. 이게 없으면 이름을 지운 줄 안다
    const res = await post(e, '/a/login', { id: 'sejin', dk: DK });
    expect(await res.json()).toEqual({ code, nick: '세진' });
  });

  it('닉네임은 겹쳐도 순위 줄을 서로 지우지 않는다', async () => {
    const e = env();
    const a = await solve(e, 'aaa', [{ seed: 'a', n: 7, tries: 1 }]);
    const b = await solve(e, 'bbb', [{ seed: 'b', n: 4, tries: 1 }]);
    await post(e, '/a/nick', { code: a, nick: '탐정' });
    await post(e, '/a/nick', { code: b, nick: '탐정' });

    // 줄을 합치는 열쇠는 아이디라 이름이 같아도 둘 다 남는다
    const seen = await board(e, b);
    expect(seen.top.map((r) => r.name)).toEqual(['탐정', '탐정']);
    expect(seen.rank).toBe(2);
  });

  it('망가진 순위표가 응답을 깨뜨리지 않는다', async () => {
    const e = env();
    const code = await solve(e, 'sejin', [{ seed: 'a', n: 4, tries: 1 }]);
    await e.HISTORY.put('lb', '찢어진 json');
    expect(await board(e, code)).toEqual({ top: [], rank: null });
  });
});

describe('순위 탈환 알림', () => {
  const seen = { name: 'sejin', rank: 3 };

  it('밀렸을 때만 알린다', () => {
    expect(rankDrop(seen, 'sejin', 5)).toEqual({ from: 3, to: 5 });
  });

  it('올라간 것과 그대로인 것은 안 알린다', () => {
    // 오른 건 자기가 사건을 풀어서 오른 것이라 이미 아는 사실이다
    expect(rankDrop(seen, 'sejin', 1)).toBeNull();
    expect(rankDrop(seen, 'sejin', 3)).toBeNull();
  });

  it('게스트에게는 알리지 않는다', () => {
    // 순위에는 계정만 오른다 — 게스트는 잃을 자리가 없다
    expect(rankDrop(seen, '', 5)).toBeNull();
  });

  it('처음 본 순위는 견줄 기준이 없다', () => {
    expect(rankDrop(null, 'sejin', 5)).toBeNull();
  });

  it('계정이 갈리면 남의 순위와 견주지 않는다', () => {
    expect(rankDrop(seen, 'minji', 5)).toBeNull();
  });

  it('순위 밖으로 밀린 것은 안 알린다', () => {
    // 순위표가 비었을 때도 rank 가 null 이라 오탐이 난다
    expect(rankDrop(seen, 'sejin', null)).toBeNull();
  });
});