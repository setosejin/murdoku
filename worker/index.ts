/**
 * 기록 동기화 워커. 엔드포인트는 하나다.
 *
 *   POST /h/:code   body: Play[]   → 병합된 Play[]
 *
 * 새 기록 올리기 = 내 목록을 POST. 다른 기기에서 불러오기 = 빈 배열을 POST.
 * 검증은 클라이언트와 같은 sanitizePlays 를 쓴다 — 판정을 두 군데 두지 않는다.
 *
 * 배포: worker/ 에서 `npx wrangler deploy` (설치 불필요)
 */
import { isCode, mergePlays, sanitizePlays, type Play } from '../src/game/history';

/** ponytail: @cloudflare/workers-types 를 받는 대신 쓰는 것만 3줄로 적는다 */
type KV = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

type Env = { HISTORY: KV; ORIGIN?: string };

/** 200건 × 80바이트면 한참 남는다 */
const MAX_BODY = 64 * 1024;

const parse = (raw: string | null): Play[] => {
  if (raw === null) return [];
  try {
    return sanitizePlays(JSON.parse(raw));
  } catch {
    return [];
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

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return fail(405, 'POST /h/:code 만 받는다');

    const path = new URL(req.url).pathname;
    const code = path.startsWith('/h/') ? path.slice(3) : '';
    // 경로 조작을 막고 KV 키 공간을 22자 코드로 못박는다
    if (!isCode(code)) return fail(400, '기록 코드가 아니다');

    if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return fail(413, '너무 크다');
    const raw = await req.text();
    if (raw.length > MAX_BODY) return fail(413, '너무 크다');

    const stored = await env.HISTORY.get(code);
    const merged = mergePlays(parse(stored), parse(raw));
    const body = JSON.stringify(merged);

    // 바뀐 게 없으면 쓰지 않는다. 불러오기만 하는 요청은 KV 쓰기 한도(1천/일)를 안 먹는다
    if (body !== stored) await env.HISTORY.put(code, body);

    return new Response(body, {
      status: 200,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  },
};
