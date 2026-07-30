/**
 * 계정. 기록 저장 구조는 건드리지 않는다 — 로그인은 (아이디, 비번) → 기록 코드 조회일 뿐이고,
 * 받은 코드를 murdoku.code 에 넣으면 그 뒤는 기존 sync 경로가 그대로 처리한다.
 * 덕분에 익명으로 쌓은 기록이 가입하는 순간 계정으로 합쳐진다 (이관 코드가 따로 없다).
 *
 * history.ts 와 같은 규약: 앞쪽은 워커도 import 하므로 localStorage·import.meta.env 를 건드리지 않는다.
 */
import { isCode, readLS, writeLS } from './history';

const ID_RE = /^[a-z0-9_]{3,20}$/;
const DK_RE = /^[0-9a-f]{64}$/;

/** 소문자로 못박아 대소문자만 다른 계정이 생기는 걸 막고, KV 키 공간도 여기서 결정된다 */
export const isUserId = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v);

/** 서버가 받는 건 비밀번호가 아니라 늘린 결과(32바이트 hex)다 */
export const isDk = (v: unknown): v is string => typeof v === 'string' && DK_RE.test(v);

/** 서버는 원문을 못 보니 길이 규칙은 클라이언트에서만 강제된다. 우회해봐야 자기 계정만 약해진다 */
export const MIN_PW = 8;

/** OWASP 권고치. 이 기기 실측 64ms — 로그인 한 번에 감당할 만하다 */
export const PBKDF2_ITER = 310_000;

const hex = (buf: ArrayBuffer | Uint8Array) =>
  [...(buf instanceof Uint8Array ? buf : new Uint8Array(buf))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/** 랜덤 솔트. 워커가 가입할 때 부른다 */
export const randomHex = (bytes: number) => hex(crypto.getRandomValues(new Uint8Array(bytes)));

/** 서버가 저장할 값을 만든다. dk 가 이미 고엔트로피라 한 번만 돌려도 되돌릴 수 없다 */
export async function sha256hex(s: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

/**
 * 비밀번호를 브라우저에서 늘린다. 서버로는 이 결과만 나간다.
 *
 * 서버에서 안 돌리는 이유: Workers 무료 티어가 요청당 CPU 10ms 라 31만 회를 못 돌린다.
 * 그 제약이 오히려 이득이다 — 서버가 비밀번호 원문을 아예 못 보고,
 * 무차별 대입은 시도마다 공격자 CPU 를 31만 회씩 먹는다.
 *
 * 솔트로 쓰는 아이디는 비밀이 아니어도 된다. 계정마다 달라 표를 미리 만들어둘 수 없으면 충분하다.
 */
export async function derive(id: string, pw: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: enc.encode(`murdoku:${id}`),
      iterations: PBKDF2_ITER,
    },
    key,
    256,
  );
  return hex(bits);
}

/**
 * 상수시간 비교. crypto.subtle.timingSafeEqual 은 Node 에 없어 테스트가 안 되는데,
 * 런타임마다 있는지 따지느니 한 줄짜리를 그냥 쓴다. 워커도 이걸 부른다.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── 여기서부터는 브라우저 전용 ──

const USER_KEY = 'murdoku.user';

/** 로그인한 아이디. 없으면 빈 문자열 = 게스트 */
export function getUser(): string {
  const saved = readLS(USER_KEY);
  return isUserId(saved) ? saved : '';
}

export function setUser(id: string) {
  writeLS(USER_KEY, id);
}

/** 동기화 서버가 없는 빌드(포크 등)에서는 로그인 UI 를 아예 감춘다 */
export const syncEnabled = () => Boolean(import.meta.env?.VITE_SYNC_URL);

export type AuthResult = { ok: true; code: string } | { ok: false; error: string };

const MESSAGES: Record<number, string> = {
  400: '아이디나 비밀번호 형식이 안 맞아.',
  401: '아이디나 비밀번호가 틀렸어.',
  409: '이미 있는 아이디야.',
  413: '보낸 내용이 너무 커.',
};

async function call(path: 'signup' | 'login', id: string, dk: string): Promise<AuthResult> {
  const base = import.meta.env?.VITE_SYNC_URL;
  if (!base) return { ok: false, error: '이 빌드에는 동기화 서버가 없어.' };
  try {
    const res = await fetch(`${base}/a/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, dk }),
    });
    if (!res.ok) return { ok: false, error: MESSAGES[res.status] ?? '서버가 응답을 안 해.' };
    const body: unknown = await res.json();
    const code = (body as { code?: unknown })?.code;
    // 서버가 준 코드도 검증한다. 이 값이 곧 KV 키가 된다
    return isCode(code) ? { ok: true, code } : { ok: false, error: '서버 응답이 이상해.' };
  } catch {
    return { ok: false, error: '연결이 안 돼.' };
  }
}

function check(id: string, pw: string): string | null {
  if (!isUserId(id)) return '아이디는 소문자·숫자·밑줄로 3~20자야.';
  if (pw.length < MIN_PW) return `비밀번호는 ${MIN_PW}자 이상이어야 해.`;
  return null;
}

export async function signup(id: string, pw: string): Promise<AuthResult> {
  const bad = check(id, pw);
  if (bad !== null) return { ok: false, error: bad };
  return call('signup', id, await derive(id, pw));
}

export async function login(id: string, pw: string): Promise<AuthResult> {
  const bad = check(id, pw);
  if (bad !== null) return { ok: false, error: bad };
  return call('login', id, await derive(id, pw));
}
