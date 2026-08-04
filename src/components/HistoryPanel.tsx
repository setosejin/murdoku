import { useEffect, useState } from 'react';
import {
  detectiveName,
  getUser,
  login,
  MIN_PW,
  setNick as saveNick,
  setNickname,
  setUser as saveUser,
  signup,
  syncEnabled,
} from '../game/auth';
import {
  clearPlays,
  getCode,
  isCode,
  MAX_NICK_LEN,
  setCode as saveCode,
  type Play,
} from '../game/history';

/**
 * 기록 패널 — 푼 사건 목록 + 계정 + 복구 키.
 *
 * 기록 코드가 곧 신원이라(서버 KV 키가 코드다) 로그인은 코드를 받아오는 게 전부다.
 * 받은 코드를 setCode 로 올려보내면 App 의 동기화 effect 가 알아서 합친다.
 */
export default function HistoryPanel({
  plays,
  code,
  nick: saved,
  setPlays,
  setCode,
  setNick,
  onOpen,
}: {
  plays: Play[];
  code: string;
  /** 저장된 이름. 입력칸이 아니라 `useGame` 이 들고 있다 — 점수판·지목도 같은 값을 본다 */
  nick: string;
  setPlays: (plays: Play[]) => void;
  setCode: (code: string) => void;
  setNick: (nick: string) => void;
  /** 목록의 사건을 누르면 그 사건을 다시 연다 */
  onOpen: (n: number, seed: string) => void;
}) {
  const [codeInput, setCodeInput] = useState('');
  const [user, setUser] = useState(getUser);
  // 입력칸 값은 여기 두고 저장된 값은 위에서 받는다 — 타이핑 중에 "순위표에 이렇게 뜬다"가
  // 아직 저장도 안 된 이름으로 바뀌면 거짓말이 된다
  const [nick, setNickInput] = useState(saved);
  const [nickErr, setNickErr] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // 새로 들어온 기록만 등장 모션을 받게 하는 빗장. 이게 없으면 이미 쌓여 있던 기록이
  // 페이지를 열 때마다 우르르 나타난다 — `@starting-style` 은 첫 마운트면 무조건 걸린다.
  // 첫 페인트 뒤에 켜므로 그때 이미 있던 행은 그냥 놓이고, 이후 추가되는 행만 움직인다
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const linkCode = (e: React.FormEvent) => {
    e.preventDefault();
    const next = codeInput.trim();
    if (isCode(next)) {
      saveCode(next);
      setCode(next);
    }
    setCodeInput('');
  };

  // ponytail: 서버 사본은 남지만 코드를 새로 뽑아 도달할 수 없게 만든다.
  // 진짜 삭제가 필요해지면 워커에 DELETE 라우트를 붙인다
  //
  // 로그아웃도 결국 같은 동작이다 — 이 기기를 게스트로 되돌린다.
  // 다만 로그인 중이었다면 계정에 사본이 남아 다시 로그인하면 그대로 돌아온다
  const resetDevice = () => {
    clearPlays();
    saveCode('');
    saveUser('');
    saveNick('');
    setUser('');
    setNickInput('');
    setNick('');
    setNickErr('');
    setPlays([]);
    setCode(getCode());
    setError('');
  };

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const res = await (mode === 'signup' ? signup : login)(id, pw);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    saveCode(res.code);
    saveUser(id);
    // 서버가 들고 있던 이름으로 맞춘다 — 다른 기기에서 붙였어도 입력칸에 채워진다
    saveNick(res.nick);
    setUser(id);
    setNickInput(res.nick);
    setNick(res.nick);
    setCode(res.code);
    setId('');
    setPw('');
  };

  const submitNick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setNickErr('');
    const next = nick.trim();
    const bad = await setNickname(code, next);
    setBusy(false);
    if (bad !== null) {
      setNickErr(bad);
      return;
    }
    setNickInput(next);
    setNick(next);
  };

  return (
    <div className="panel history">
      <b>기록</b>
      {plays.length === 0 ? (
        <p className="hint">사건을 해결하면 여기 쌓인다.</p>
      ) : (
        <ul className={ready ? 'ready' : undefined}>
          {plays.slice(0, 20).map((p) => (
            <li key={`${p.seed}:${p.n}:${p.at}`}>
              <button type="button" onClick={() => onOpen(p.n, p.seed)}>
                <b>{p.title}</b>
                <small>
                  {p.seed} · {fmtDate(p.at)} · {p.n}x{p.n} ·{' '}
                  {p.ok ? `${p.tries}번 만에 해결` : '정답 확인'}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}

      {syncEnabled() &&
        (user ? (
          <div className="account">
            <p>
              {/* 이름을 정했으면 그 이름으로 부른다. 아이디는 로그인 수단이라 여기 안 쓴다 */}
              {detectiveName(saved) ? (
                <>
                  <b>{detectiveName(saved)}</b>, 기록이 기기를 따라다닌다.
                </>
              ) : (
                <>
                  <b>{user}</b> 로 로그인했어. 기록이 기기를 따라다닌다.
                </>
              )}
            </p>
            <form className="nickform" onSubmit={submitNick}>
              <input
                value={nick}
                onChange={(e) => setNickInput(e.target.value)}
                placeholder="순위표에 띄울 이름"
                aria-label="순위표에 띄울 이름"
                maxLength={MAX_NICK_LEN}
              />
              <button type="submit" className="chip" disabled={busy}>
                {busy ? '…' : '저장'}
              </button>
            </form>
            <p className="hint">
              순위표에는 <b>{saved || user}</b> 로 뜬다. 비워두면 아이디를 그대로 쓴다. 겹치는
              이름을 막지 않으니 남을 사칭하는 이름은 지워질 수 있어.
            </p>
            {nickErr && (
              <p className="hint error" role="alert">
                {nickErr}
              </p>
            )}
            <button type="button" className="link" onClick={resetDevice}>
              로그아웃
            </button>
            <p className="hint">
              로그아웃하면 이 기기에서는 기록이 사라지지만, 다시 로그인하면 돌아와.
            </p>
          </div>
        ) : (
          <details className="sync account">
            <summary>로그인하고 기록 잇기</summary>
            <p className="hint">
              아이디와 비밀번호만 있으면 어느 기기에서든 기록이 따라와. 이메일을 안 받아서
              비밀번호를 잊으면 되살릴 방법이 없으니, 아래 복구 키를 적어둬.
            </p>
            <form onSubmit={submitAuth}>
              <input
                value={id}
                onChange={(e) => setId(e.target.value.trim().toLowerCase())}
                placeholder="아이디"
                aria-label="아이디"
                autoComplete="username"
                pattern="[a-z0-9_]{3,20}"
                required
              />
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="비밀번호"
                aria-label="비밀번호"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={MIN_PW}
                required
              />
              <button type="submit" className="chip primary" disabled={busy}>
                {busy ? '확인 중…' : mode === 'signup' ? '가입' : '로그인'}
              </button>
            </form>
            {error && (
              <p className="hint error" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className="link"
              onClick={() => {
                setMode(mode === 'signup' ? 'login' : 'signup');
                setError('');
              }}
            >
              {mode === 'signup' ? '이미 계정이 있어' : '계정 만들기'}
            </button>
          </details>
        ))}

      <details className="sync">
        <summary>복구 키</summary>
        <p className="hint">
          기록은 이 코드에 묶여 있어. 비밀번호를 잊었거나 로그인 없이 다른 기기로 옮길 때 쓴다.
          코드를 아는 사람은 기록을 보고 바꿀 수 있으니 아무한테나 주지 마.
        </p>
        <code>{code}</code>
        <form onSubmit={linkCode}>
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.trim().toLowerCase())}
            placeholder="기록 코드 붙여넣기"
            aria-label="기록 코드 입력"
            pattern="[a-z0-9]{22}"
            required
          />
          <button type="submit" className="chip">
            잇기
          </button>
        </form>
        {/* 로그인 중이면 이 버튼은 로그아웃과 똑같이 동작하는데, 계정 사본이 남아
            "지우기"가 거짓말이 된다. 그래서 게스트일 때만 보여준다 */}
        {!user && (
          <button type="button" className="link" onClick={resetDevice}>
            이 기기에서 기록 지우기
          </button>
        )}
      </details>
    </div>
  );
}

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
