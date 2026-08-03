/**
 * 기록 동기화 + 계정 워커.
 *
 *   POST /h/:code    body: Play[]      → 병합된 Play[]
 *   POST /lb/:code   body: 없음        → {top: Rank[], rank: number|null}
 *   POST /a/signup   body: {id, dk}    → 201 {code}  (409 아이디 중복)
 *   POST /a/login    body: {id, dk}    → 200 {code}  (401 불일치)
 *
 * 새 기록 올리기 = 내 목록을 POST. 다른 기기에서 불러오기 = 빈 배열을 POST.
 * 계정은 기록 저장 구조에 끼어들지 않는다 — (아이디, 비번) 으로 기록 코드를 꺼내올 뿐이고,
 * 그 뒤는 /h/:code 가 지금까지와 똑같이 처리한다.
 *
 * 순위표도 마찬가지로 기존 구조 위에 얹었다 — 점수는 저장된 Play[] 에서 계산하므로
 * 클라이언트가 점수를 올려보내지 않는다. 이름은 `c:<코드>` 로 계정 아이디를 찾아 쓴다.
 *
 * 검증은 클라이언트와 같은 함수를 쓴다 — 판정을 두 군데 두지 않는다.
 *
 * 배포: worker/ 에서 `npx wrangler deploy` (설치 불필요)
 */
import { constantTimeEqual, isDk, isUserId, randomHex, sha256hex } from '../src/game/auth';
import {
  isCode,
  MAX_BOARD,
  mergePlays,
  newCode,
  sanitizeBoard,
  sanitizePlays,
  summarize,
  TOP_N,
  type Play,
  type Rank,
} from '../src/game/history';

/** ponytail: @cloudflare/workers-types 를 받는 대신 쓰는 것만 3줄로 적는다 */
type KV = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

type Env = { HISTORY: KV; ORIGIN?: string };

/** 200건 × 80바이트면 한참 남는다 */
const MAX_BODY = 64 * 1024;
/** 계정 요청은 아이디와 64자 hex 가 전부다 */
const MAX_AUTH_BODY = 1024;

/** KV 값. 여기 든 코드가 곧 기록 키다 */
type Account = { s: string; h: string; code: string };

/** 순위표 전체가 이 한 키에 든다. 코드 → 표시 이름은 `c:<코드>` */
const LB_KEY = 'lb';
const nameKey = (code: string) => `c:${code}`;

const parse = (raw: string | null): Play[] => {
  if (raw === null) return [];
  try {
    return sanitizePlays(JSON.parse(raw));
  } catch {
    return [];
  }
};

const parseBoard = (raw: string | null): Rank[] => {
  if (raw === null) return [];
  try {
    return sanitizeBoard(JSON.parse(raw));
  } catch {
    return [];
  }
};

/**
 * 순위표 갱신. 기록이 실제로 바뀐 요청에서만 부른다.
 *
 * ponytail: 순위 전체를 한 키에 담고 통째로 다시 쓴다. KV 에 CAS 가 없어 두 사람이 같은 순간에
 * 올리면 한쪽이 덮이는데, 다음 해결 때 제 점수로 다시 오른다. 실시간 정확도가 필요해지면
 * Durable Objects 로 올린다 (가입 경합과 같은 선택)
 */
async function updateBoard(env: Env, code: string, plays: Play[]) {
  // 게스트는 이름이 없어 줄을 세울 수 없다. 순위는 계정만 오른다
  const name = await env.HISTORY.get(nameKey(code));
  if (name === null) return;

  // 점수는 저장된 기록에서 서버가 센다 — 클라이언트가 올린 숫자를 그대로 믿지 않는다
  const { score, cases } = summarize(plays);
  if (score === 0) return;

  const raw = await env.HISTORY.get(LB_KEY);
  const board = parseBoard(raw).filter((e) => e.name !== name);
  board.push({ name, score, cases, at: Date.now() });
  board.sort((a, b) => b.score - a.score || a.at - b.at);
  const next = JSON.stringify(board.slice(0, MAX_BOARD));
  if (next !== raw) await env.HISTORY.put(LB_KEY, next);
}

const parseAccount = (raw: string): Account | null => {
  try {
    const v = JSON.parse(raw) as Partial<Account>;
    return typeof v?.s === 'string' && typeof v?.h === 'string' && isCode(v?.code)
      ? { s: v.s, h: v.h, code: v.code }
      : null;
  } catch {
    return null;
  }
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors: Record<string, string> = {
      'access-control-allow-origin': env.ORIGIN ?? '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
      vary: 'origin',
    };
    const fail = (status: number, msg: string) => new Response(msg, { status, headers: cors });
    const json = (body: unknown, status: number) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, 'content-type': 'application/json' },
      });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return fail(405, 'POST 만 받는다');

    const path = new URL(req.url).pathname;

    if (path === '/a/signup' || path === '/a/login') {
      const raw = await req.text();
      if (raw.length > MAX_AUTH_BODY) return fail(413, '너무 크다');

      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return fail(400, 'JSON 이 아니다');
      }
      const { id, dk } = (body ?? {}) as { id?: unknown; dk?: unknown };
      // 아이디는 KV 키가 되고 dk 는 비밀번호를 늘린 결과다. 둘 다 형식을 못박는다
      if (!isUserId(id) || !isDk(dk)) return fail(400, '아이디나 비밀번호 형식이 아니다');

      const key = `u:${id}`;
      const stored = await env.HISTORY.get(key);

      if (path === '/a/signup') {
        if (stored !== null) return fail(409, '이미 있는 아이디다');
        const s = randomHex(16);
        // 코드는 반드시 서버가 만든다. 클라이언트가 고르게 두면
        // 남의 코드를 자기 계정으로 등록해 그 기록을 통째로 가져갈 수 있다
        const account: Account = { s, h: await sha256hex(s + dk), code: newCode() };
        // ponytail: KV 에 CAS 가 없어 get→put 사이에 같은 아이디가 끼어들 수 있다.
        // 퍼즐 게임에서 감수할 만한 경합이고, 실제로 문제가 되면 Durable Objects 로 올린다
        await env.HISTORY.put(key, JSON.stringify(account));
        // 순위표에 이름을 달아주는 역방향 매핑. /h/:code 는 코드만 알기 때문에 필요하다
        await env.HISTORY.put(nameKey(account.code), id);
        return json({ code: account.code }, 201);
      }

      // 아이디가 없는 경우와 비번이 틀린 경우를 구분해주지 않는다
      // (가입이 409 를 주므로 아이디 존재 여부 자체는 어차피 알 수 있다)
      const account = stored === null ? null : parseAccount(stored);
      if (account === null) return fail(401, '아이디나 비밀번호가 틀렸다');
      if (!constantTimeEqual(await sha256hex(account.s + dk), account.h))
        return fail(401, '아이디나 비밀번호가 틀렸다');
      // 순위표가 생기기 전에 가입한 계정을 여기서 메운다. 없을 때 한 번만 쓴다
      if ((await env.HISTORY.get(nameKey(account.code))) === null)
        await env.HISTORY.put(nameKey(account.code), id);
      return json({ code: account.code }, 200);
    }

    if (path.startsWith('/lb/')) {
      const c = path.slice(4);
      if (!isCode(c)) return fail(400, '기록 코드가 아니다');
      const board = parseBoard(await env.HISTORY.get(LB_KEY));
      const name = await env.HISTORY.get(nameKey(c));
      const i = name === null ? -1 : board.findIndex((e) => e.name === name);
      // 내 점수는 브라우저가 자기 기록에서 세므로 여기서는 순위만 준다
      return json({ top: board.slice(0, TOP_N), rank: i < 0 ? null : i + 1 }, 200);
    }

    const code = path.startsWith('/h/') ? path.slice(3) : '';
    // 경로 조작을 막고 KV 키 공간을 22자 코드로 못박는다
    if (!isCode(code)) return fail(400, '기록 코드가 아니다');

    if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return fail(413, '너무 크다');
    const raw = await req.text();
    if (raw.length > MAX_BODY) return fail(413, '너무 크다');

    const stored = await env.HISTORY.get(code);
    const merged = mergePlays(parse(stored), parse(raw));
    const body = JSON.stringify(merged);

    // 남길 게 있고 바뀌었을 때만 쓴다.
    // - 불러오기만 하는 요청은 KV 쓰기 한도(1천/일)를 안 먹는다
    // - 처음 방문한 사람이 빈 기록을 올려도 빈 항목이 생기지 않는다.
    //   이게 없으면 신규 방문자 수만큼 쓰기가 나가고, 아무나 랜덤 코드로 한도를 태울 수 있다
    if (merged.length > 0 && body !== stored) {
      await env.HISTORY.put(code, body);
      await updateBoard(env, code, merged);
    }

    return new Response(body, {
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  },
};
