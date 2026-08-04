import { useState } from 'react';
import Board from './Board';
import CaseCards from './CaseCards';
import ChangelogDialog from './ChangelogDialog';
import ClueList from './ClueList';
import FeedbackDialog from './FeedbackDialog';
import HistoryPanel from './HistoryPanel';
import Leaderboard from './Leaderboard';
import RankToast from './RankToast';
import Sheet from './Sheet';
import { AccusePanel, DifficultySeg, LegendPanel, RulesPanel, SeedPanel } from './GamePanels';
import { petMenuItems } from './petMenuItems';
import type { Game } from '../hooks/useGame';

type SheetId = 'case' | 'accuse' | 'menu';

/**
 * 모바일 셸 — 한 화면 안에 다 들어오고 스크롤이 없다.
 *
 * 붙박이는 셋뿐이다: 보드, 증언 목록(= 메모 브러시), 하단 액션바.
 * 나머지(사건 설명·규칙·범례·지목·난이도·시드·기록)는 전부 바텀시트로 들어간다.
 * 시트 안에서만 스크롤이 생긴다.
 */
export default function MobileShell({ game }: { game: Game }) {
  const [sheet, setSheet] = useState<SheetId | null>(null);
  /** 메뉴 시트를 열면서 어느 패널로 내려갈지. 손님 메뉴가 쓴다 */
  const [jump, setJump] = useState<string | undefined>(undefined);
  const close = () => setSheet(null);
  const { puzzle } = game;
  const alerted = game.rankAlert !== null;

  // 메뉴를 열면 알림은 제 할 일을 다 했다 — 점수판이 바로 이 안에 있다
  const openMenu = (to?: string) => {
    setJump(to);
    setSheet('menu');
    game.dismissRank();
  };

  /* 바깥 손님을 우클릭(폰은 꾹 누르기)하면 나오는 항목. 목록은 데스크톱과 공유한다.
     도움말만 갈린다 — 온보딩 투어는 데스크톱 선택자를 겨누므로 여기서는 못 쓴다.
     대신 규칙과 범례가 들어 있는 사건 브리핑을 연다 */
  const petMenu = petMenuItems({
    onHelp: () => setSheet('case'),
    onRank: () => openMenu('jump-scores'),
    onName: () => openMenu('jump-account'),
    onNew: () => game.reset(),
    onClear: game.clearMarks,
  });

  return (
    <div className="mshell">
      <header className="mtop">
        {/* 데스크톱 .topbar 의 h1 에 대응한다. 이 자리는 세로 비용이 0 이다 —
            상단바 높이는 옆의 44px 버튼들이 정하고 워드마크는 그 안에 든다.
            대가는 사건 제목의 가로 폭이고, .mtitle b 의 말줄임이 받는다 */}
        <h1 className="mbrand">murdoku</h1>
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
          className={alerted ? 'micon alerted' : 'micon'}
          /* 점은 눈에만 보인다 — 이름표도 같이 바뀌어야 한다 */
          aria-label={alerted ? '메뉴 (순위 알림)' : '메뉴'}
          aria-haspopup="dialog"
          onClick={() => openMenu()}
        >
          ☰
          {alerted && <span className="alert-dot" aria-hidden="true" />}
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
          petMenu={petMenu}
        />
      </main>

      <ClueList puzzle={puzzle} brush={game.brush} setBrush={game.setBrush} />

      {/* position: fixed 라 붙박이 넷의 자리를 뺏지 않는다 (모바일은 스크롤이 없다) */}
      <RankToast alert={game.rankAlert} detective={game.detective} onClose={game.dismissRank} />

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
        {/* 범례는 사건마다 다른 기준(어느 가구를 밟을 수 있나)이라 사건 브리핑에
            같이 둔다. 시트 하나와 하단 액션바 버튼 하나가 줄었다 — 바 높이는
            그대로지만 남은 두 버튼이 그만큼 넓어져 누르기 쉬워졌다 */}
        <LegendPanel furniture={puzzle.furniture} />
        <RulesPanel />
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
          earned={game.earned}
          peeked={game.peeked}
          revealed={game.revealed}
          setRevealed={game.setRevealed}
          detective={game.detective}
          bare
        />
        {/* 맞혔으면 보상은 보드에 있다 — 시트를 걷어내는 버튼을 눈에 띄게 준다 */}
        {game.result === 'correct' && (
          <button type="button" className="chip primary mwide" onClick={close}>
            보드에서 확인하기
          </button>
        )}
      </Sheet>

      <Sheet open={sheet === 'menu'} onClose={close} title="메뉴" jumpTo={jump}>
        <div className="panel">
          <b>난이도</b>
          <DifficultySeg
            difficulties={game.difficulties}
            n={game.n}
            onPick={(n) => {
              game.reset(n);
              close();
            }}
          />
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

        <Leaderboard plays={game.plays} board={game.board} nick={game.nick} />

        <HistoryPanel
          plays={game.plays}
          code={game.code}
          nick={game.nick}
          setPlays={game.setPlays}
          setCode={game.setCode}
          setNick={game.setNick}
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
