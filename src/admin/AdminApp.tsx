import { useCallback, useEffect, useState } from 'react';
import { sanitizePlays, type Play } from '../game/history';

/**
 * 관리자 화면 — 플레이어 목록과 기록을 보고 지운다. 게임과 다른 URL(`admin.html`)이고
 * 게임 번들에는 안 들어간다.
 *
 * 정적 호스팅에는 접근 제어가 없어서 이 페이지 자체는 누구나 열 수 있다.
 * 막는 건 워커다 — `/adm/*` 는 전부 관리자 토큰을 요구하고, 토큰 없이는 목록조차 안 온다.
 * 그래서 여기 있는 어떤 상태도 "권한"이 아니라 "지금 들고 있는 토큰"일 뿐이다.
 */

/** auth.ts 의 syncEnabled 와 같은 이유로 함수다 — 모듈 최상단에서 읽으면 테스트가 갈아끼울 수 없다 */
const syncBase = () => import.meta.env?.VITE_SYNC_URL as string | undefined;

/** localStorage 가 아니라 sessionStorage — 탭을 닫으면 토큰도 같이 사라진다 */
const TOKEN_KEY = 'murdoku.admin';

const readToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
};

const writeToken = (v: string) => {
  try {
    if (v) sessionStorage.setItem(TOKEN_KEY, v);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 프라이빗 모드. 이번 세션만 기억 못 할 뿐이다 */
  }
};

type Listing = { accounts: string[]; plays: { code: string; owned: boolean }[] };
type Detail = { id: string | null; code: string; plays: Play[]; score: number; cases: number };

/** auth.ts 의 AuthResult 와 같은 모양 — 던지지 않고 결과로 돌려준다 */
type Res<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function call<T>(token: string, sub: string, body?: unknown): Promise<Res<T>> {
  const base = syncBase();
  if (!base) return { ok: false, status: 0, error: '이 빌드에는 동기화 서버가 없어.' };
  try {
    const res = await fetch(`${base}/adm/${sub}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok)
      return {
        ok: false,
        status: res.status,
        error: res.status === 401 ? '토큰이 틀렸어.' : `서버가 ${res.status} 를 줬어.`,
      };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0, error: '연결이 안 돼.' };
  }
}

const fmt = (ms: number) => new Date(ms).toLocaleString('ko-KR', { dateStyle: 'short' });

export default function AdminApp() {
  const [token, setToken] = useState(readToken);
  const [input, setInput] = useState('');
  const [listing, setListing] = useState<Listing | null>(null);
  const [sel, setSel] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const lock = useCallback(() => {
    writeToken('');
    setToken('');
    setListing(null);
    setSel(null);
  }, []);

  /** 실패가 401 이면 들고 있는 토큰이 이미 소용없다는 뜻이라 잠근다 */
  const fail = useCallback(
    (r: { status: number; error: string }) => {
      setError(r.error);
      if (r.status === 401) lock();
    },
    [lock],
  );

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    const r = await call<Listing>(token, 'list');
    setBusy(false);
    if (!r.ok) return fail(r);
    setListing({ accounts: r.data?.accounts ?? [], plays: r.data?.plays ?? [] });
  }, [token, fail]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const open = async (body: { id: string } | { code: string }) => {
    setBusy(true);
    setError('');
    const r = await call<Detail>(token, 'get', body);
    setBusy(false);
    if (!r.ok) return fail(r);
    // 우리 워커가 주는 값이라도 화면에 그릴 기록은 같은 검증을 통과시킨다
    setSel({ ...r.data, plays: sanitizePlays(r.data?.plays) });
  };

  const remove = async (body: { id: string } | { code: string }, what: string) => {
    if (!confirm(`${what}\n\n되돌릴 수 없어. 지울까?`)) return;
    setBusy(true);
    setError('');
    const r = await call(token, 'del', body);
    setBusy(false);
    if (!r.ok) return fail(r);
    setSel(null);
    await load();
  };

  if (!token)
    return (
      <main className="admin">
        <h1>murdoku 관리</h1>
        {!syncBase() ? (
          <p className="panel hint">
            이 빌드에는 동기화 서버가 없어서 관리할 것도 없다. <code>VITE_SYNC_URL</code> 을 넣고
            다시 빌드해야 한다.
          </p>
        ) : (
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              const next = input.trim();
              if (!next) return;
              writeToken(next);
              setToken(next);
              setInput('');
            }}
          >
            <label htmlFor="tok">
              <b>관리자 토큰</b>
            </label>
            <input
              id="tok"
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              required
            />
            <button type="submit" className="chip primary">
              들어가기
            </button>
            {error && (
              <p className="hint error" role="alert">
                {error}
              </p>
            )}
            <p className="hint">
              이 페이지는 누구나 열 수 있지만 토큰 없이는 아무것도 안 보인다 — 확인은 서버가 한다.
            </p>
          </form>
        )}
        <a className="link" href="./">
          ← 게임으로
        </a>
      </main>
    );

  const guests = listing?.plays.filter((p) => !p.owned) ?? [];

  return (
    <main className="admin">
      <h1>murdoku 관리</h1>
      <div className="admin-bar">
        <button type="button" className="chip" onClick={() => void load()} disabled={busy}>
          {busy ? '읽는 중…' : '새로고침'}
        </button>
        <button type="button" className="chip" onClick={lock}>
          잠그기
        </button>
        <a className="link" href="./">
          ← 게임으로
        </a>
      </div>

      {error && (
        <p className="hint error" role="alert">
          {error}
        </p>
      )}

      <section className="panel">
        <b>계정 {listing?.accounts.length ?? 0}명</b>
        {listing && listing.accounts.length === 0 && <p className="hint">아직 아무도 없다.</p>}
        <ul className="admin-list">
          {listing?.accounts.map((id) => (
            <li key={id}>
              <button type="button" onClick={() => void open({ id })} disabled={busy}>
                {id}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <b>게스트 기록 {guests.length}건</b>
        <p className="hint">계정 없이 이 기기에서만 쌓인 기록이다. 주인을 알 방법이 없다.</p>
        <ul className="admin-list">
          {guests.map((p) => (
            <li key={p.code}>
              <button type="button" onClick={() => void open({ code: p.code })} disabled={busy}>
                <code>{p.code}</code>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {sel && <DetailPanel sel={sel} busy={busy} onClose={() => setSel(null)} onRemove={remove} />}
    </main>
  );
}

function DetailPanel({
  sel,
  busy,
  onClose,
  onRemove,
}: {
  sel: Detail;
  busy: boolean;
  onClose: () => void;
  onRemove: (body: { id: string } | { code: string }, what: string) => void;
}) {
  return (
    <section className="panel admin-detail">
      <b>{sel.id ?? '게스트'}</b>
      <p className="hint">
        <code>{sel.code}</code> · {sel.cases}사건 · {sel.score.toLocaleString('ko-KR')}점 ·{' '}
        {sel.plays.length}건
      </p>

      {sel.plays.length === 0 ? (
        <p className="hint">기록이 없다.</p>
      ) : (
        <ul className="admin-list">
          {sel.plays.map((p) => (
            <li key={`${p.seed}:${p.n}:${p.at}`}>
              <span>
                <b>{p.title}</b>
                <small>
                  {p.seed} · {fmt(p.at)} · {p.n}x{p.n} ·{' '}
                  {p.ok ? `${p.tries}번 만에 해결` : '정답 확인'}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="admin-bar">
        <button
          type="button"
          className="chip"
          disabled={busy}
          onClick={() => onRemove({ code: sel.code }, `${sel.id ?? sel.code} 의 기록 ${sel.plays.length}건을 지운다.`)}
        >
          기록만 지우기
        </button>
        {sel.id !== null && (
          <button
            type="button"
            className="chip danger"
            disabled={busy}
            onClick={() => onRemove({ id: sel.id! }, `계정 ${sel.id} 와 그 기록을 통째로 지운다.`)}
          >
            계정 삭제
          </button>
        )}
        <button type="button" className="link" onClick={onClose}>
          닫기
        </button>
      </div>
    </section>
  );
}
