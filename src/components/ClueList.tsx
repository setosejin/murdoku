import { useEffect, useRef } from 'react';
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
  const listRef = useRef<HTMLUListElement>(null);

  // 자리가 좁으면 목록이 안에서 스크롤하고 마지막 줄이 반쯤 걸친다. 걸친 줄을
  // 골랐을 때 그대로 두지 않는다. block: 'nearest' 라 이미 다 보이면 아무 일도
  // 하지 않는다 — 부드럽게 갈지는 clues.css 의 scroll-behavior 가 정한다
  useEffect(() => {
    listRef.current?.querySelector('.clue-row.on')?.scrollIntoView({ block: 'nearest' });
  }, [brush]);

  return (
    // 사건이 바뀌면 목록을 통째로 갈아끼운다. <li> 의 key 가 A/B/C/V 로 고정이라
    // 그냥 두면 React 가 DOM 을 재사용해서, 보드는 페이드하는데 이름만 제자리에서
    // 바뀐다. 여기에 key 를 두면 두 셸이 다 고쳐진다 (등장 페이드는 clues.css)
    <ul className="clue-list" key={`${puzzle.seed}:${puzzle.n}`} ref={listRef}>
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
