import { detectiveName, getUser, syncEnabled } from '../game/auth';
import { SCORE_BASE, summarize, TOP_N, type Board, type Play } from '../game/history';

/**
 * 점수판 — 모든 유저 TOP 10 과 내 점수.
 *
 * 내 점수는 로컬 기록에서 바로 센다. 서버 왕복 없이 항상 최신이고, 서버가 없는 빌드에서도 보인다.
 * 서버가 주는 건 남들의 줄과 내 순위뿐이다.
 *
 * 순위에는 계정만 오른다 — 줄을 세우려면 이름이 있어야 하고, 그 이름은 가입 때 서버가 못박은 것이다.
 * 줄에 뜨는 이름은 닉네임을 단 사람은 닉네임, 아니면 아이디다. 어느 쪽인지는 서버가 정해서 보내고
 * 여기서는 그리기만 한다 — 그래서 내 줄은 이름이 아니라 순위로 짚는다.
 *
 * **TOP 10 밖이면 내 줄을 목록 끝에 따로 붙인다.** 등수는 남들과 견주라고 있는 것이라
 * `12위` 라는 숫자만 떨어져 있으면 어느 줄 밑인지가 안 보인다. 그 줄의 점수·사건 수는
 * 서버가 아니라 내 기록에서 세므로, 방금 푼 사건이 서버에 오르기 전에도 맞는 값이 뜬다.
 *
 * 순위를 받아오는 건 `useGame` 이다. 시트가 닫혀 있어도 알림 점이 떠야 해서, 이 화면이
 * 열렸는지와 무관하게 돌아야 한다.
 */
export default function Leaderboard({
  plays,
  board,
  nick,
}: {
  plays: Play[];
  /** undefined = 아직 받는 중, null = 못 받았다, Board = 받았다 */
  board: Board | null | undefined;
  /** 순위표에 띄우는 이름. 없으면 아이디를 쓴다 */
  nick: string;
}) {
  const me = summarize(plays);
  const user = getUser();
  const who = detectiveName(nick);
  const rank = typeof board?.rank === 'number' ? board.rank : null;
  const top = board?.top ?? [];
  // 목록에 이미 내 줄이 있나. 서버가 보낸 순서를 그대로 그리므로 자리(i+1)가 곧 순위다
  const listed = rank !== null && rank <= top.length;

  return (
    <div className="panel scores">
      <b>점수판</b>

      <p className="myscore">
        <span>{who || '내 점수'}</span>
        <strong>{me.score.toLocaleString('ko-KR')}점</strong>
        <small>
          {who ? `${me.cases + 1}번째 사건 해결 중` : `${me.cases}사건 해결`}
          {rank !== null && ` · ${rank}위`}
        </small>
      </p>

      {board !== null && board !== undefined && top.length > 0 && (
        <ol className="ranks" aria-label={`상위 ${TOP_N}명`}>
          {top.map((e, i) => (
            // 닉네임은 겹칠 수 있어 이름을 열쇠로 못 쓴다. 이 목록은 순위 그 자체라
            // 자리(i)가 곧 정체성이고, 줄마다 붙은 모션도 없다
            <li key={i} className={rank === i + 1 ? 'mine' : undefined}>
              <span className="rk">{i + 1}</span>
              <b>{e.name}</b>
              <small>{e.cases}사건</small>
              <em>{e.score.toLocaleString('ko-KR')}</em>
            </li>
          ))}
          {rank !== null && !listed && (
            <>
              {/* 끊긴 자리를 보여준다. 안 그러면 10위 다음이 47위인 게 목록이 이어진 것처럼 읽힌다 */}
              <li className="gap" aria-hidden="true">
                ⋯
              </li>
              <li className="mine">
                <span className="rk">{rank}</span>
                <b>{nick || user}</b>
                <small>{me.cases}사건</small>
                <em>{me.score.toLocaleString('ko-KR')}</em>
              </li>
            </>
          )}
        </ol>
      )}

      {!syncEnabled() ? (
        <p className="hint">이 빌드에는 순위 서버가 없어. 점수는 이 기기에서만 센다.</p>
      ) : board === null ? (
        <p className="hint">순위를 못 받아왔어. 서버가 답을 안 준다 — 잠시 뒤에 다시 열어봐.</p>
      ) : board !== undefined && board.top.length === 0 ? (
        <p className="hint">아직 순위가 없어. 첫 줄을 채워봐.</p>
      ) : null}

      {syncEnabled() && !user && <p className="hint">순위에 오르려면 아래에서 로그인해.</p>}

      {/* 로그인했는데도 순위가 없다 = 아직 서버에 오른 점수가 없다는 뜻이다.
          이유를 안 적으면 "사람이 없어서 안 뜨나?" 로 읽힌다 */}
      {syncEnabled() && user && board !== null && board !== undefined && rank === null && (
        <p className="hint">아직 순위에 안 올랐어. 사건을 하나 풀면 오른다.</p>
      )}

      <p className="hint">
        한 번에 맞히면 만점(
        {Object.entries(SCORE_BASE)
          .map(([n, base]) => `${n}×${n} ${base}`)
          .join(' · ')}
        ). 지목이 한 번 늘 때마다 20%씩 깎이고 20%는 남아. 정답을 보면 그 사건은 끝이고, 같은
        사건은 첫 해결만 친다.
      </p>
    </div>
  );
}
