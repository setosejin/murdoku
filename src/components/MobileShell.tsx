import { useState } from 'react';
import Board from './Board';
import CaseCards from './CaseCards';
import ChangelogDialog from './ChangelogDialog';
import ClueList from './ClueList';
import FeedbackDialog from './FeedbackDialog';
import HistoryPanel from './HistoryPanel';
import Sheet from './Sheet';
import { AccusePanel, LegendPanel, RulesPanel, SeedPanel } from './GamePanels';
import type { Game } from '../hooks/useGame';

type SheetId = 'case' | 'legend' | 'accuse' | 'menu';

/**
 * 모바일 셸 — 한 화면 안에 다 들어오고 스크롤이 없다.
 *
 * 붙박이는 셋뿐이다: 보드, 증언 목록(= 메모 브러시), 하단 액션바.
 * 나머지(사건 설명·규칙·범례·지목·난이도·시드·기록)는 전부 바텀시트로 들어간다.
 * 시트 안에서만 스크롤이 생긴다.
 */
export default function MobileShell({ game }: { game: Game }) {
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const close = () => setSheet(null);
  const { puzzle } = game;

  return (
    <div className="mshell">
      <header className="mtop">
        <button
          type="button"
          className="mtitle"
          aria-haspopup="dialog"
          onClick={() => setSheet('case')}
        >
          <span className="case-no">{puzzle.theme.label}</span>
          <b>{puzzle.title}</b>
          <span className="mtitle-more" aria-hidden="true">
            ⌄
          </span>
        </button>
        <button
          type="button"
          className="micon"
          aria-label="메뉴"
          aria-haspopup="dialog"
          onClick={() => setSheet('menu')}
        >
          ☰
        </button>
      </header>

      <main className="mplay">
        {/* key 규칙은 App.tsx 의 데스크톱 셸과 같다 — seed:n 이어야 메모를 찍을 때
            보드가 재마운트되지 않는다 */}
        <Board
          key={`${game.seed}:${game.n}`}
          puzzle={puzzle}
          marks={game.marks}
          onCell={game.onCell}
          revealed={game.revealed}
        />
      </main>

      <ClueList puzzle={puzzle} brush={game.brush} setBrush={game.setBrush} />

      <nav className="mbar">
        <button
          type="button"
          className={`mbar-btn${game.brush === 'X' ? ' on' : ''}`}
          aria-pressed={game.brush === 'X'}
          onClick={() => game.setBrush('X')}
        >
          <span aria-hidden="true">✕</span> 빈칸
        </button>
        <button
          type="button"
          className="mbar-btn"
          aria-haspopup="dialog"
          onClick={() => setSheet('legend')}
        >
          범례
        </button>
        <button
          type="button"
          className="mbar-btn primary"
          aria-haspopup="dialog"
          onClick={() => setSheet('accuse')}
        >
          지목하기
        </button>
      </nav>

      <Sheet open={sheet === 'case'} onClose={close} title={puzzle.title}>
        <p className="brief">{puzzle.brief}</p>
        <CaseCards puzzle={puzzle} />
        <RulesPanel />
      </Sheet>

      <Sheet open={sheet === 'legend'} onClose={close} title="범례">
        <LegendPanel furniture={puzzle.furniture} bare />
      </Sheet>

      <Sheet open={sheet === 'accuse'} onClose={close} title="범인 지목">
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
          bare
        />
        {/* 맞혔으면 보상은 보드에 있다 — 시트를 걷어내는 버튼을 눈에 띄게 준다 */}
        {game.result === 'correct' && (
          <button type="button" className="chip primary mwide" onClick={close}>
            보드에서 확인하기
          </button>
        )}
      </Sheet>

      <Sheet open={sheet === 'menu'} onClose={close} title="메뉴">
        <div className="panel">
          <b>난이도</b>
          <div className="controls">
            {game.difficulties.map((d) => (
              <button
                key={d.n}
                type="button"
                className={`chip${d.n === game.n ? ' on' : ''}`}
                aria-pressed={d.n === game.n}
                onClick={() => {
                  game.reset(d.n);
                  close();
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="chip primary"
            onClick={() => {
              game.reset();
              close();
            }}
          >
            새 사건
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => {
              game.clearMarks();
              close();
            }}
          >
            메모 지우기
          </button>
        </div>

        <SeedPanel seed={game.seed} onOpen={(s) => game.reset(game.n, s)} />

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

        <div className="mmenu-foot">
          <FeedbackDialog seed={game.seed} n={game.n} />
          <ChangelogDialog />
        </div>
        {/* 데스크톱 푸터에만 있던 저작권·저장소 링크가 모바일에서 사라지지 않게 */}
        <p className="mmenu-copy">
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
      </Sheet>
    </div>
  );
}
