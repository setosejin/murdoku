import type { Puzzle } from '../game/types';
import { VICTIM_LINE } from './CaseCards';

/**
 * 증언 목록 겸 메모 브러시 선택기.
 *
 * 모바일에서 증언과 브러시를 따로 두면 둘이 한 화면에 못 들어온다. 한 덩어리로 합치면
 * "이 사람이 여기 있었다고 표시한다" 는 조작이 증언을 읽는 자리에서 그대로 이어진다.
 */
export default function ClueList({
  puzzle,
  brush,
  setBrush,
}: {
  puzzle: Puzzle;
  brush: string;
  setBrush: (id: string) => void;
}) {
  const clueOf = (id: string) => puzzle.clues.find((c) => c.personId === id)?.text ?? '';

  return (
    <ul className="clue-list">
      {puzzle.people.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            className={`clue-row${brush === p.id ? ' on' : ''}`}
            aria-pressed={brush === p.id}
            aria-label={`${p.name} 로 표시하기`}
            onClick={() => setBrush(p.id)}
          >
            <span className="clue-badge" style={{ background: p.color }}>
              {p.id}
            </span>
            <b>{p.name}</b>
            <span className="clue-text">{p.isVictim ? VICTIM_LINE : clueOf(p.id)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
