import { useEffect, useMemo, useState } from 'react';
import Board, { Art, SpriteDefs } from './components/Board';
import ChangelogDialog from './components/ChangelogDialog';
import FeedbackDialog from './components/FeedbackDialog';
import HistoryPanel from './components/HistoryPanel';
import { DIFFICULTIES, generatePuzzle } from './game/generate';
import { addPlay, getCode, loadPlays, sync, type Play } from './game/history';

const newSeed = () => Math.random().toString(36).slice(2, 8);

export default function App() {
  const [n, setN] = useState(4);
  const [seed, setSeed] = useState(newSeed);
  const [seedInput, setSeedInput] = useState('');
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [brush, setBrush] = useState('X');
  const [accused, setAccused] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  // 같은 결과를 다시 지목해도 등장 모션이 재생되도록 key 를 갈아끼우는 카운터
  const [attempt, setAttempt] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [plays, setPlays] = useState<Play[]>(loadPlays);
  const [code, setCode] = useState(getCode);

  // 기록 코드가 정해지거나 바뀌면 서버와 합친다. 실패는 sync 안에서 삼켜진다
  useEffect(() => {
    sync(code, loadPlays()).then(setPlays);
  }, [code]);

  const puzzle = useMemo(() => generatePuzzle(n, seed), [n, seed]);
  const suspects = puzzle.people.filter((p) => !p.isVictim);
  const victim = puzzle.people.find((p) => p.isVictim)!;
  const clueOf = (id: string) => puzzle.clues.find((c) => c.personId === id)?.text ?? '';

  const reset = (nextN = n, nextSeed = newSeed()) => {
    setN(nextN);
    setSeed(nextSeed);
    setMarks({});
    setAccused('');
    setResult(null);
    setRevealed(false);
    // 지목 횟수는 사건마다 새로 센다. 안 그러면 기록의 tries 에 이전 사건 지목까지 딸려온다
    setAttempt(0);
  };

  const onCell = (key: string) => {
    setMarks((m) => {
      const next = { ...m };
      if (next[key] === brush) delete next[key];
      else next[key] = brush;
      return next;
    });
  };

  const accuse = () => {
    if (!accused) return;
    const ok = accused === puzzle.culpritId;
    const tries = attempt + 1;
    setResult(ok ? 'correct' : 'wrong');
    setAttempt(tries);
    if (!ok) return;
    setRevealed(true);
    // 이미 푼 사건을 다시 지목해도 기록은 한 번만
    if (result === 'correct') return;
    const next = addPlay({ seed, n, at: Date.now(), ok: true, tries, title: puzzle.title });
    setPlays(next);
    sync(code, next).then(setPlays);
  };

  return (
    <div className="app">
      <SpriteDefs />
      <header className="topbar">
        <h1>
          murdoku <span className="sub">머도쿠</span>
        </h1>
        <div className="controls">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.n}
              type="button"
              className={`chip${d.n === n ? ' on' : ''}`}
              aria-pressed={d.n === n}
              onClick={() => reset(d.n)}
            >
              {d.label}
            </button>
          ))}
          <button type="button" className="chip primary" onClick={() => reset()}>
            새 사건
          </button>
          <FeedbackDialog seed={seed} n={n} />
        </div>
      </header>

      <section className="case">
        <div className="case-head">
          <span className="case-no">{puzzle.theme.label}</span>
          <h2>{puzzle.title}</h2>
        </div>
        <p className="brief">{puzzle.brief}</p>

        <div className="cards">
          {suspects.map((p) => (
            <article key={p.id} className="card">
              <span className="badge">{p.id}</span>
              <div className="portrait" style={{ background: p.color }}>
                <Art emoji="🙂" image={p.image} icon="person" label={p.name} />
              </div>
              <b>{p.name}</b>
              <small>{p.role}</small>
              <p className="bubble">{clueOf(p.id)}</p>
            </article>
          ))}
          <article className="card victim">
            <span className="badge">V</span>
            <div className="portrait" style={{ background: victim.color }}>
              <Art emoji="🙂" image={victim.image} icon="person" label={victim.name} />
            </div>
            <b>{victim.name}</b>
            <small>{victim.role} · 피해자</small>
            <p className="bubble">마지막 남은 자리에 있어…</p>
          </article>
        </div>
      </section>

      <section className="play">
        <Board puzzle={puzzle} marks={marks} onCell={onCell} revealed={revealed} />

        <div className="side">
          <div className="panel rules">
            <b>기본 정보</b>
            <ol>
              <li>모든 인물은 서로 다른 행과 열에 있다</li>
              <li>한 칸에는 한 사람만 있을 수 있다</li>
              <li>한 방에 용의자는 한 명까지</li>
              <li>'옆'은 같은 방에서 인접해 있다는 뜻</li>
              <li>가구 위에는 설 수 없다 (예외는 범례에)</li>
              <li>피해자와 같은 방에 있던 사람이 범인</li>
            </ol>
          </div>

          <div className="panel legend">
            <b>범례</b>
            <ul>
              {puzzle.furniture.map((f) => (
                <li key={f.id} className={f.standable ? 'ok' : 'no'}>
                  <Art emoji={f.emoji} image={f.image} icon={f.kind} label={f.label} />
                  <span>{f.label}</span>
                  <em>{f.standable ? '설 수 있음' : '설 수 없음'}</em>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel palette">
            <b>메모</b>
            <div className="brushes">
              {suspects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`brush${brush === p.id ? ' on' : ''}`}
                  style={{ borderColor: p.color }}
                  aria-pressed={brush === p.id}
                  aria-label={`${p.id} · ${p.name} 표시`}
                  onClick={() => setBrush(p.id)}
                >
                  {p.id}
                </button>
              ))}
              <button
                type="button"
                className={`brush${brush === 'V' ? ' on' : ''}`}
                aria-pressed={brush === 'V'}
                aria-label="피해자 표시"
                onClick={() => setBrush('V')}
              >
                V
              </button>
              <button
                type="button"
                className={`brush${brush === 'X' ? ' on' : ''}`}
                aria-pressed={brush === 'X'}
                aria-label="빈 칸 표시"
                onClick={() => setBrush('X')}
              >
                ✕
              </button>
            </div>
            <button type="button" className="chip" onClick={() => setMarks({})}>
              메모 지우기
            </button>
          </div>

          <div className="panel accuse">
            <b>범인은?</b>
            <select
              value={accused}
              aria-label="범인으로 지목할 용의자"
              onChange={(e) => setAccused(e.target.value)}
            >
              <option value="">용의자 선택</option>
              {suspects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
            </select>
            <button type="button" className="chip primary" onClick={accuse} disabled={!accused}>
              지목하기
            </button>
            {result === 'correct' && (
              <p key={attempt} className="verdict ok" role="status">
                정답! 범인은 {puzzle.people.find((p) => p.id === puzzle.culpritId)!.name}!
              </p>
            )}
            {result === 'wrong' && (
              <p key={attempt} className="verdict no" role="status">
                아니야… 다시 생각해봐.
              </p>
            )}
            <button type="button" className="link" onClick={() => setRevealed((v) => !v)}>
              {revealed ? '정답 숨기기' : '정답 보기'}
            </button>
          </div>

          <div className="panel seedbox">
            <b>시드</b>
            <code>{seed}</code>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (seedInput.trim()) reset(n, seedInput.trim());
                setSeedInput('');
              }}
            >
              <input
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                placeholder="같은 사건 불러오기"
                aria-label="시드 입력"
              />
              <button type="submit" className="chip">
                열기
              </button>
            </form>
          </div>

          <HistoryPanel
            plays={plays}
            code={code}
            setPlays={setPlays}
            setCode={setCode}
            onOpen={(pn, ps) => reset(pn, ps)}
          />
        </div>
      </section>

      <footer className="footer">
        <p>
          © {new Date().getFullYear()} setosejin ·{' '}
          <a
            className="link"
            href="https://github.com/setosejin/murdoku"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub 저장소 열기 (새 탭)"
          >
            GitHub
          </a>
        </p>
        <ChangelogDialog />
      </footer>
    </div>
  );
}
