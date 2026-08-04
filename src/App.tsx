import { useEffect, useState } from 'react';
import Board, { SpriteDefs } from './components/Board';
import CaseCards from './components/CaseCards';
import ChangelogDialog from './components/ChangelogDialog';
import ClueList from './components/ClueList';
import FeedbackDialog from './components/FeedbackDialog';
import HistoryPanel from './components/HistoryPanel';
import Leaderboard from './components/Leaderboard';
import MobileShell from './components/MobileShell';
import Sheet from './components/Sheet';
import Tour from './components/Tour';
import {
  AccusePanel,
  BrushBar,
  DifficultySeg,
  LegendPanel,
  RulesPanel,
  SeedPanel,
} from './components/GamePanels';
import { markTourSeen, seenTour } from './game/history';
import useGame from './hooks/useGame';
import useMediaQuery, { MOBILE_QUERY } from './hooks/useMediaQuery';

type DialogId = 'case' | 'menu';

/**
 * 데스크톱 셸 — 한 화면 안에 세 열로 편다: 증언(= 메모 브러시) · 보드 · 지목/참고.
 *
 * 예전에는 사건 카드 → 보드 → 사이드 패널이 세로로 쌓여 있어서, 증언을 읽고
 * 브러시를 고르고 칸을 찍는 세 동작이 800px 넘게 떨어져 있었다. 증언 목록이
 * 브러시를 겸하면(모바일이 먼저 쓴 방식) 그 왕복이 통째로 사라진다.
 *
 * 늘 필요하지는 않은 것(사건 브리핑·시드·기록·피드백)은 모달로 내린다 — 모바일
 * 시트와 같은 `Sheet` 를 쓰고 모양만 가운데 모달로 바꾼다.
 */
export default function App() {
  const game = useGame();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [dialog, setDialog] = useState<DialogId | null>(null);
  const [tour, setTour] = useState(false);
  const close = () => setDialog(null);
  const { puzzle } = game;

  // 첫 방문에만 저절로 연다. 상태를 useState 초기값으로 읽으면 서버 렌더에서도
  // 켜진 채로 나가므로 마운트 뒤에 켠다
  useEffect(() => {
    if (!seenTour()) setTour(true);
  }, []);

  const closeTour = () => {
    setTour(false);
    markTourSeen();
  };

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

        <button
          type="button"
          className="dcase"
          aria-haspopup="dialog"
          onClick={() => setDialog('case')}
        >
          <span className="case-no">{puzzle.theme.label}</span>
          <b>{puzzle.title}</b>
          <span className="dcase-more" aria-hidden="true">
            브리핑
            <i>⌄</i>
          </span>
        </button>

        <div className="controls">
          <DifficultySeg difficulties={game.difficulties} n={game.n} onPick={game.reset} />
          <button type="button" className="chip primary" onClick={() => game.reset()}>
            새 사건
          </button>
          <button
            type="button"
            className="chip"
            aria-label="더보기"
            aria-haspopup="dialog"
            onClick={() => setDialog('menu')}
          >
            ⋯
          </button>
        </div>
      </header>

      <section className="play">
        <div className="panel dclues">
          <b>증언</b>
          {/* 증언을 읽는 자리가 곧 브러시를 고르는 자리다 */}
          <ClueList puzzle={puzzle} brush={game.brush} setBrush={game.setBrush} />
          <BrushBar
            brush={game.brush}
            setBrush={game.setBrush}
            clearMarks={game.clearMarks}
            onHelp={() => setTour(true)}
          />
        </div>

        <div className="pboard">
          {/* key 로 사건마다 새 보드를 만들어 크로스페이드를 건다.
              seed:n 이어야 한다 — puzzle 이나 marks 를 넣으면 메모를 찍을 때마다
              보드가 통째로 재마운트되면서 키보드 포커스가 날아간다 */}
          <Board
            key={`${game.seed}:${game.n}`}
            puzzle={puzzle}
            marks={game.marks}
            onCell={game.onCell}
            revealed={game.revealed}
          />
        </div>

        <div className="side">
          <AccusePanel
            suspects={game.suspects}
            accused={game.accused}
            setAccused={game.setAccused}
            accuse={game.accuse}
            result={game.result}
            attempt={game.attempt}
            culpritName={game.culpritName}
            earned={game.earned}
            peeked={game.peeked}
            revealed={game.revealed}
            setRevealed={game.setRevealed}
          />
          <LegendPanel furniture={puzzle.furniture} />
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

      <Sheet modal open={dialog === 'case'} onClose={close} title={puzzle.title}>
        <p className="brief">{puzzle.brief}</p>
        <CaseCards puzzle={puzzle} />
        {/* 규칙은 처음 한 번 읽고 마는 것이라 사이드 열을 계속 차지할 이유가 없다.
            6x6 에서는 범례만으로도 열이 꽉 찬다 (모바일 `사건` 시트도 같은 자리에 둔다) */}
        <RulesPanel />
      </Sheet>

      <Sheet modal open={dialog === 'menu'} onClose={close} title="더보기">
        <SeedPanel seed={game.seed} onOpen={(s) => game.reset(game.n, s)} />
        <Leaderboard plays={game.plays} code={game.code} />
        <HistoryPanel
          plays={game.plays}
          code={game.code}
          setPlays={game.setPlays}
          setCode={game.setCode}
          onOpen={(pn, ps) => {
            game.reset(pn, ps);
            close();
          }}
        />
        <FeedbackDialog seed={game.seed} n={game.n} />
      </Sheet>

      {/* 모달을 연 채로 스포트라이트를 겨누면 두 top-layer 가 겹친다 —
          브리핑·더보기가 열려 있으면 온보딩은 기다린다 */}
      {tour && dialog === null && <Tour onClose={closeTour} />}
    </div>
  );
}
