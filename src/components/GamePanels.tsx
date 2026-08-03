import { useState } from 'react';
import { Art } from './Board';
import { spanOf } from '../game/types';
import type { Furniture, Person } from '../game/types';

/**
 * 사이드 패널의 내용물들. 데스크톱은 `.side` 열에 세로로 쌓고,
 * 모바일은 같은 컴포넌트를 바텀시트 안에 넣는다 — 마크업을 복제하지 않는다.
 */

export function RulesPanel() {
  return (
    <div className="panel rules">
      <b>기본 정보</b>
      <ol>
        <li>모든 인물은 서로 다른 행과 열에 있다</li>
        <li>한 칸에는 한 사람만 있을 수 있다</li>
        <li>한 방에 용의자는 한 명까지</li>
        <li>'옆'은 같은 방에서 인접해 있다는 뜻</li>
        <li>가구 위에는 설 수 없다 (예외는 범례에)</li>
        <li>피해자와 같은 방에 있던 사람이 범인</li>
      </ol>
    </div>
  );
}

export function LegendPanel({ furniture, bare }: { furniture: Furniture[]; bare?: boolean }) {
  const list = (
    <ul>
      {furniture.map((f) => (
        <li key={f.id} className={f.standable ? 'ok' : 'no'}>
          <Art emoji={f.emoji} image={f.image} icon={f.kind} label={f.label} span={spanOf(f)} />
          <span>{f.label}</span>
          <em>{f.standable ? '설 수 있음' : '설 수 없음'}</em>
        </li>
      ))}
    </ul>
  );

  // 시트 안에서는 시트 제목이 이미 `범례` 다 — 제목과 테두리를 두 번 그리지 않는다
  if (bare) return <div className="legend bare">{list}</div>;
  return (
    <div className="panel legend">
      <b>범례</b>
      {list}
    </div>
  );
}

export function BrushBar({
  brush,
  setBrush,
  clearMarks,
}: {
  brush: string;
  setBrush: (id: string) => void;
  clearMarks: () => void;
}) {
  return (
    <div className="dclues-bar">
      <button
        type="button"
        className={`chip${brush === 'X' ? ' on' : ''}`}
        aria-pressed={brush === 'X'}
        onClick={() => setBrush('X')}
      >
        ✕ 빈칸
      </button>
      <button type="button" className="chip" onClick={clearMarks}>
        메모 지우기
      </button>
    </div>
  );
}

export type AccuseProps = {
  suspects: Person[];
  accused: string;
  setAccused: (id: string) => void;
  accuse: () => void;
  /** 판정 결과. 같은 결과를 다시 지목해도 모션이 재생되도록 attempt 를 key 로 쓴다 */
  result: 'correct' | 'wrong' | null;
  attempt: number;
  culpritName: string;
  /** 방금 맞힌 판의 점수 */
  earned: number;
  /** 정답을 한 번이라도 봤나. 그 순간 이 사건은 끝이다 */
  peeked: boolean;
  revealed: boolean;
  setRevealed: (next: boolean) => void;
  /** 시트 안에서는 제목과 테두리를 생략한다 (시트 제목이 이미 `범인 지목`) */
  bare?: boolean;
};

export function AccusePanel({
  suspects,
  accused,
  setAccused,
  accuse,
  result,
  attempt,
  culpritName,
  earned,
  peeked,
  revealed,
  setRevealed,
  bare,
}: AccuseProps) {
  const solved = result === 'correct';
  return (
    <div className={bare ? 'accuse bare' : 'panel accuse'}>
      {!bare && <b>범인은?</b>}
      {/* 증언 목록과 같은 줄 모양이다 — 보드 위 토큰·증언·여기의 뱃지가 같은 색이라
          "이 사람" 을 세 곳에서 다시 찾을 필요가 없다.
          select 였을 때는 열고·고르고·누르는 세 번이었다.
          key 는 증언 목록과 같은 이유다 — 용의자가 바뀌면 목록을 갈아끼운다 */}
      <ul
        className="clue-list"
        key={suspects.map((p) => p.name).join()}
        role="group"
        aria-label="범인으로 지목할 용의자"
      >
        {suspects.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={`clue-row${accused === p.id ? ' on' : ''}`}
              aria-pressed={accused === p.id}
              onClick={() => setAccused(p.id)}
            >
              <span className="clue-badge" style={{ background: p.color }}>
                {p.id}
              </span>
              <b>{p.name}</b>
              <span className="clue-text">{p.role}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="chip primary" onClick={accuse} disabled={!accused || peeked}>
        지목하기
      </button>
      {/* 정답을 본 순간 이 사건은 끝난다. 왜 눌리지 않는지 여기서 말해준다 */}
      {peeked && !solved && (
        <p className="hint" role="status">
          정답을 봤으니 이 사건은 여기까지야. 새 사건으로 넘어가자.
        </p>
      )}
      {solved && (
        <p key={attempt} className="verdict ok" role="status">
          정답! 범인은 {culpritName}! <em className="earned">+{earned}점</em>
        </p>
      )}
      {result === 'wrong' && !peeked && (
        <p key={attempt} className="verdict no" role="status">
          아니야… 다시 생각해봐.
        </p>
      )}
      <button type="button" className="link" onClick={() => setRevealed(!revealed)}>
        {revealed ? '정답 숨기기' : peeked || solved ? '정답 보기' : '정답 보기 (이 사건 포기)'}
      </button>
    </div>
  );
}

export function SeedPanel({ seed, onOpen }: { seed: string; onOpen: (seed: string) => void }) {
  const [input, setInput] = useState('');

  return (
    <div className="panel seedbox">
      <b>시드</b>
      <code>{seed}</code>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) onOpen(input.trim());
          setInput('');
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="같은 사건 불러오기"
          aria-label="시드 입력"
        />
        <button type="submit" className="chip">
          열기
        </button>
      </form>
    </div>
  );
}
