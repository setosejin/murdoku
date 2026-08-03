import { useEffect, useState } from 'react';
import { getUser, syncEnabled } from '../game/auth';
import { fetchBoard, SCORE_BASE, summarize, TOP_N, type Board, type Play } from '../game/history';

/**
 * 점수판 — 모든 유저 TOP 10 과 내 점수.
 *
 * 내 점수는 로컬 기록에서 바로 센다. 서버 왕복 없이 항상 최신이고, 서버가 없는 빌드에서도 보인다.
 * 서버가 주는 건 남들의 줄과 내 순위뿐이다.
 *
 * 순위에는 계정만 오른다 — 줄을 세우려면 이름이 있어야 하고, 그 이름은 가입 때 서버가 못박은 것이다.
 */
export default function Leaderboard({ plays, code }: { plays: Play[]; code: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const me = summarize(plays);
  const user = getUser();

  // 기록이 바뀔 때마다 다시 받는다. 시트는 닫혀도 마운트된 채라 한 번만 받으면
  // 사건을 풀고 열었을 때 방금 올린 점수가 순위에 안 보인다.
  // sync 가 끝나면서 plays 가 한 번 더 갈리므로 마지막 응답은 워커가 순위를 쓴 뒤의 것이다
  useEffect(() => {
    let live = true;
    fetchBoard(code).then((b) => {
      if (live) setBoard(b);
    });
    return () => {
      live = false;
    };
  }, [code, plays]);

  return (
    <div className="panel scores">
      <b>점수판</b>

      <p className="myscore">
        <span>내 점수</span>
        <strong>{me.score.toLocaleString('ko-KR')}점</strong>
        <small>
          {me.cases}사건 해결
          {typeof board?.rank === 'number' && ` · ${board.rank}위`}
        </small>
      </p>

      {board !== null && board.top.length > 0 && (
        <ol className="ranks" aria-label={`상위 ${TOP_N}명`}>
          {board.top.map((e, i) => (
            <li key={e.name} className={e.name === user ? 'mine' : undefined}>
              <span className="rk">{i + 1}</span>
              <b>{e.name}</b>
              <small>{e.cases}사건</small>
              <em>{e.score.toLocaleString('ko-KR')}</em>
            </li>
          ))}
        </ol>
      )}

      {!syncEnabled() ? (
        <p className="hint">이 빌드에는 순위 서버가 없어. 점수는 이 기기에서만 센다.</p>
      ) : board === null || board.top.length === 0 ? (
        <p className="hint">아직 순위가 없어. 첫 줄을 채워봐.</p>
      ) : null}

      {syncEnabled() && !user && <p className="hint">순위에 오르려면 아래에서 로그인해.</p>}

      <p className="hint">
        한 번에 맞히면 만점(
        {Object.entries(SCORE_BASE)
          .map(([n, base]) => `${n}×${n} ${base}`)
          .join(' · ')}
        ). 지목이 한 번 늘 때마다 20%씩 깎이고 20%는 남아. 정답을 보고 지목하면 0점, 같은 사건은
        첫 해결만 친다.
      </p>
    </div>
  );
}
