import { useEffect, useRef, useState } from 'react';
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
  const [fade, setFade] = useState('');

  // 자리가 좁으면 목록이 안에서 스크롤하고 마지막 줄이 반쯤 걸친다. 걸친 줄을
  // 골랐을 때 그대로 두지 않는다. block: 'nearest' 라 이미 다 보이면 아무 일도
  // 하지 않는다 — 부드럽게 갈지는 clues.css 의 scroll-behavior 가 정한다
  useEffect(() => {
    listRef.current?.querySelector('.clue-row.on')?.scrollIntoView({ block: 'nearest' });
  }, [brush]);

  // 잘린 가장자리를 흐리게 해서 "더 있다" 를 말한다. 끝에 닿은 쪽은 걷는다 —
  // 늘 켜두면 마지막 줄이 영영 흐려 보인다.
  // 의존성이 필요하다: key 가 <ul> 에 붙어 있어서 사건이 바뀌면 DOM 노드가
  // 갈리는데, 빈 배열로 두면 리스너가 떨어져 나간 옛 노드에 남는다.
  // ResizeObserver 는 창 크기·회전을, 이 의존성은 난이도 교체를 잡는다
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const read = () => {
      const over = el.scrollHeight - el.clientHeight;
      if (over <= 1) return setFade('');
      const up = el.scrollTop > 1;
      const down = el.scrollTop < over - 1;
      setFade(up && down ? 'both' : up ? 'top' : down ? 'bottom' : '');
    };
    read();
    el.addEventListener('scroll', read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', read);
      ro.disconnect();
    };
  }, [puzzle.seed, puzzle.n]);

  return (
    // 사건이 바뀌면 목록을 통째로 갈아끼운다. <li> 의 key 가 A/B/C/V 로 고정이라
    // 그냥 두면 React 가 DOM 을 재사용해서, 보드는 페이드하는데 이름만 제자리에서
    // 바뀐다. 여기에 key 를 두면 두 셸이 다 고쳐진다 (등장 페이드는 clues.css)
    <ul className="clue-list" key={`${puzzle.seed}:${puzzle.n}`} ref={listRef} data-fade={fade || undefined}>
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
