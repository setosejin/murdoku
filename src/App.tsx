import Board, { SpriteDefs } from './components/Board';
import CaseCards from './components/CaseCards';
import ChangelogDialog from './components/ChangelogDialog';
import FeedbackDialog from './components/FeedbackDialog';
import HistoryPanel from './components/HistoryPanel';
import MobileShell from './components/MobileShell';
import {
  AccusePanel,
  BrushPalette,
  LegendPanel,
  RulesPanel,
  SeedPanel,
} from './components/GamePanels';
import useGame from './hooks/useGame';
import useMediaQuery, { MOBILE_QUERY } from './hooks/useMediaQuery';

export default function App() {
  const game = useGame();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const { puzzle } = game;

  if (mobile)
    return (
      <>
        <SpriteDefs />
        <MobileShell game={game} />
      </>
    );

  return (
    <div className="app">
      <SpriteDefs />
      <header className="topbar">
        <h1>
          murdoku <span className="sub">머도쿠</span>
        </h1>
        <div className="controls">
          {game.difficulties.map((d) => (
            <button
              key={d.n}
              type="button"
              className={`chip${d.n === game.n ? ' on' : ''}`}
              aria-pressed={d.n === game.n}
              onClick={() => game.reset(d.n)}
            >
              {d.label}
            </button>
          ))}
          <button type="button" className="chip primary" onClick={() => game.reset()}>
            새 사건
          </button>
          <FeedbackDialog seed={game.seed} n={game.n} />
        </div>
      </header>

      <section className="case">
        <div className="case-head">
          <span className="case-no">{puzzle.theme.label}</span>
          <h2>{puzzle.title}</h2>
        </div>
        <p className="brief">{puzzle.brief}</p>
        <CaseCards puzzle={puzzle} />
      </section>

      <section className="play">
        <Board puzzle={puzzle} marks={game.marks} onCell={game.onCell} revealed={game.revealed} />

        <div className="side">
          <RulesPanel />
          <LegendPanel furniture={puzzle.furniture} />
          <BrushPalette
            suspects={game.suspects}
            brush={game.brush}
            setBrush={game.setBrush}
            clearMarks={game.clearMarks}
          />
          <AccusePanel
            suspects={game.suspects}
            accused={game.accused}
            setAccused={game.setAccused}
            accuse={game.accuse}
            result={game.result}
            attempt={game.attempt}
            culpritName={game.culpritName}
            revealed={game.revealed}
            setRevealed={game.setRevealed}
          />
          <SeedPanel seed={game.seed} onOpen={(s) => game.reset(game.n, s)} />
          <HistoryPanel
            plays={game.plays}
            code={game.code}
            setPlays={game.setPlays}
            setCode={game.setCode}
            onOpen={(pn, ps) => game.reset(pn, ps)}
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
