/**
 * 계정. 기록 저장 구조는 건드리지 않는다 — 로그인은 (아이디, 비번) → 기록 코드 조회일 뿐이고,
 * 받은 코드를 murdoku.code 에 넣으면 그 뒤는 기존 sync 경로가 그대로 처리한다.
 * 덕분에 익명으로 쌓은 기록이 가입하는 순간 계정으로 합쳐진다 (이관 코드가 따로 없다).
 *
 * history.ts 와 같은 규약: 앞쪽은 워커도 import 하므로 localStorage·import.meta.env 를 건드리지 않는다.
 */
import { isCode, MAX_NICK_LEN, readLS, writeLS } from './history';

const ID_RE = /^[a-z0-9_]{3,20}$/;
const DK_RE = /^[0-9a-f]{64}$/;

/** 소문자로 못박아 대소문자만 다른 계정이 생기는 걸 막고, KV 키 공간도 여기서 결정된다 */
export const isUserId = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v);

/**
 * 순위표에 띄울 닉네임. 아이디와 달리 남들 화면에 그려지는 값이라 규칙이 다르다.
 *
 * 글자 종류는 안 따진다 — 한글도 이모지도 받는다. 대신 `\p{C}` (제어·서식·짝 잃은 서로게이트)
 * 는 막는다. 폭 0 문자나 방향 뒤집기 문자는 눈에 안 보이면서 남의 줄까지 흐트러뜨린다.
 * 앞뒤 공백은 자른 뒤라야 통과다. 안 그러면 `  ` 같은 이름이 빈 칸으로 앉는다.
 */
export const isNick = (v: unknown): v is string =>
  typeof v === 'string' &&
  v === v.trim() &&
  v.length > 0 &&
  v.length <= MAX_NICK_LEN &&
  !/\p{C}/u.test(v);

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
const NICK_KEY = 'murdoku.nick';

/** 로그인한 아이디. 없으면 빈 문자열 = 게스트 */
export function getUser(): string {
  const saved = readLS(USER_KEY);
  return isUserId(saved) ? saved : '';
}

export function setUser(id: string) {
  writeLS(USER_KEY, id);
}

/**
 * 순위표에 띄우는 이름. 없으면 빈 문자열 = 아이디를 그대로 쓴다.
 *
 * 진짜 값은 서버에 있고 여기 있는 건 사본이다 — 입력칸에 지금 이름을 채워 넣으려고 둔다.
 * 로그인할 때 서버가 같이 내려주므로 기기를 옮겨도 맞춰진다.
 */
export function getNick(): string {
  const saved = readLS(NICK_KEY);
  return isNick(saved) ? saved : '';
}

export function setNick(nick: string) {
  writeLS(NICK_KEY, nick);
}

/**
 * 사람을 부르는 이름. 이름을 정한 사람만 `<닉> 탐정` 이라 부른다.
 *
 * 아이디는 로그인 수단이지 불릴 이름이 아니라, 없으면 빈 문자열을 준다 — 부르는 쪽이
 * 원래 문구로 그대로 떨어진다. 말투를 켜고 끄는 판정을 화면마다 복제하지 않으려고
 * 여기 하나만 둔다.
 *
 * `isNick` 을 다시 거는 건 이 값이 localStorage 에서 오기 때문이다. 검증을 통과한 적 없는
 * 문자열이 그대로 화면에 앉으면 안 된다.
 */
export const detectiveName = (nick: string) => (isNick(nick) ? `${nick} 탐정` : '');

/** 동기화 서버가 없는 빌드(포크 등)에서는 로그인 UI 를 아예 감춘다 */
export const syncEnabled = () => Boolean(import.meta.env?.VITE_SYNC_URL);

export type AuthResult = { ok: true; code: string; nick: string } | { ok: false; error: string };

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
    const { code, nick } = (body ?? {}) as { code?: unknown; nick?: unknown };
    // 서버가 준 코드도 검증한다. 이 값이 곧 KV 키가 된다
    return isCode(code)
      ? { ok: true, code, nick: isNick(nick) ? nick : '' }
      : { ok: false, error: '서버 응답이 이상해.' };
  } catch {
    return { ok: false, error: '연결이 안 돼.' };
  }
}

/**
 * 순위표에 띄울 이름을 바꾼다. 빈 문자열이면 지우고 아이디로 돌아간다.
 *
 * 비밀번호를 다시 안 묻는다 — 이 앱에서 기록 코드가 곧 신원이라(`/h/:code` 도 코드만 본다)
 * 코드를 쥔 사람은 이미 기록을 통째로 고칠 수 있다. 여기만 더 잠가봐야 얻는 게 없다.
 *
 * 오류는 **서버가 쓴 말을 그대로** 띄운다. 상태 코드마다 문구를 여기 적어두면 두 가지가 어긋난다 —
 * 이 화면에는 아이디·비밀번호 칸이 없는데 로그인용 문구가 뜨고, 워커가 아직 이 주소를 모르는
 * 배포 틈에는 아예 딴소리를 한다(실제로 그랬다: 배포 전 워커가 400 을 줘서 "아이디나 비밀번호
 * 형식이 안 맞아" 가 떴다). 워커의 오류 본문은 사람이 읽을 한국어라 그게 늘 더 정확하다.
 */
export async function setNickname(code: string, nick: string): Promise<string | null> {
  const base = import.meta.env?.VITE_SYNC_URL;
  if (!base) return '이 빌드에는 동기화 서버가 없어.';
  if (nick !== '' && !isNick(nick)) return `이름은 보이는 글자로 1~${MAX_NICK_LEN}자야.`;
  try {
    const res = await fetch(`${base}/a/nick`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, nick }),
    });
    if (!res.ok) return serverText(await res.text().catch(() => ''));
    setNick(nick);
    return null;
  } catch {
    return '연결이 안 돼.';
  }
}

/**
 * 서버가 준 오류 문구. 사이에 낀 프록시나 터널이 HTML 오류 페이지를 뱉을 수 있어
 * **짧은 평문일 때만** 믿는다 — 아니면 우리 문구로 떨어진다.
 */
const serverText = (raw: string) => {
  const t = raw.trim();
  return t.length > 0 && t.length <= 60 && !t.includes('<') ? t : '이름을 못 바꿨어.';
};

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
