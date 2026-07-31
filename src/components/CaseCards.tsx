import { Art } from './Board';
import type { Puzzle } from '../game/types';

/**
 * 용의자·피해자 카드 그리드. 데스크톱의 `사건` 섹션과 모바일의 `사건` 시트가 함께 쓴다.
 * 증언 문구는 `puzzle.clues` 의 값을 그대로 쓴다 — 문자열을 여기서 조립하지 않는다.
 */
export default function CaseCards({ puzzle }: { puzzle: Puzzle }) {
  const suspects = puzzle.people.filter((p) => !p.isVictim);
  const victim = puzzle.people.find((p) => p.isVictim)!;
  const clueOf = (id: string) => puzzle.clues.find((c) => c.personId === id)?.text ?? '';

  return (
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
        <p className="bubble">{VICTIM_LINE}</p>
      </article>
    </div>
  );
}

/** 피해자는 증언을 남기지 못한다 — 규칙(마지막 남은 자리)을 대신 읽어준다 */
// eslint-disable-next-line react/only-export-components -- 모바일 증언 목록이 같은 문구를 쓴다
export const VICTIM_LINE = '마지막 남은 자리에 있어…';
