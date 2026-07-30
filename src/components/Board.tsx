import { useEffect, useState } from 'react';
import type { Puzzle } from '../game/types';
import { indexScene } from '../game/clues';

export function Art({ emoji, image, label }: { emoji: string; image?: string; label: string }) {
  return image ? (
    <img className="art" src={image} alt={label} />
  ) : (
    <span className="art" role="img" aria-label={label}>
      {emoji}
    </span>
  );
}

type Props = {
  puzzle: Puzzle;
  marks: Record<string, string>;
  onCell: (key: string) => void;
  revealed: boolean;
};

export default function Board({ puzzle, marks, onCell, revealed }: Props) {
  const { n, rooms, furniture, wallItems, people } = puzzle;
  const idx = indexScene(puzzle);
  const roomAt = idx.roomAt;

  // 가구 칸을 눌렀을 때 잠깐 띄우는 거절 표시
  const [denied, setDenied] = useState<{ key: string; text: string } | null>(null);
  useEffect(() => {
    if (!denied) return;
    const t = setTimeout(() => setDenied(null), 1600);
    return () => clearTimeout(t);
  }, [denied]);

  const furnAt = new Map<string, { f: (typeof furniture)[number]; first: boolean }>();
  for (const f of furniture)
    f.cells.forEach((c, i) => furnAt.set(`${c.r},${c.c}`, { f, first: i === 0 }));

  const wallAt = new Map(wallItems.map((w) => [`${w.cell.r},${w.cell.c}`, w]));
  const labelAt = new Map(rooms.map((r) => [`${r.cells[r.cells.length - 1].r},${r.cells[r.cells.length - 1].c}`, r]));
  const personAt = new Map(
    people.map((p) => [`${puzzle.solution[p.id].r},${puzzle.solution[p.id].c}`, p]),
  );

  const cells = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const k = `${r},${c}`;
      const fur = furnAt.get(k);
      const wall = wallAt.get(k);
      const room = labelAt.get(k);
      const mark = revealed ? undefined : marks[k];
      const person = revealed ? personAt.get(k) : undefined;
      const blocked = !idx.free[r][c];

      const desc = [
        `${r + 1}행 ${c + 1}열`,
        rooms.find((x) => x.id === roomAt[r][c])?.name,
        fur?.f.label,
        wall?.label,
        mark ? `표시 ${mark}` : '빈 칸',
      ]
        .filter(Boolean)
        .join(', ');

      cells.push(
        <button
          key={k}
          type="button"
          className={`cell${blocked ? ' blocked' : ''}${denied?.key === k ? ' denied' : ''}`}
          aria-label={blocked ? `${desc} (가구라 설 수 없음)` : desc}
          onClick={() =>
            blocked
              ? setDenied({ key: k, text: `${fur?.f.label ?? '가구'} 위에는 설 수 없어` })
              : onCell(k)
          }
          style={{
            borderTopWidth: r === 0 ? 0 : roomAt[r - 1][c] !== roomAt[r][c] ? 3 : 1,
            borderLeftWidth: c === 0 ? 0 : roomAt[r][c - 1] !== roomAt[r][c] ? 3 : 1,
            borderTopColor: r > 0 && roomAt[r - 1][c] !== roomAt[r][c] ? 'var(--wall)' : 'var(--tile-line)',
            borderLeftColor: c > 0 && roomAt[r][c - 1] !== roomAt[r][c] ? 'var(--wall)' : 'var(--tile-line)',
          }}
        >
          {fur && fur.first && (
            <span
              className={`furniture${fur.f.standable ? ' standable' : ''}`}
              title={fur.f.label}
              style={{
                width: `calc(${fur.f.cells.some((x) => x.c !== fur.f.cells[0].c) ? 200 : 100}% - 6px)`,
                height: `calc(${fur.f.cells.some((x) => x.r !== fur.f.cells[0].r) ? 200 : 100}% - 6px)`,
              }}
            >
              <Art emoji={fur.f.emoji} image={fur.f.image} label={fur.f.label} />
              <span className="fur-label">{fur.f.label}</span>
            </span>
          )}
          {wall && (
            <span className={`wall-item ${wall.side} ${wall.kind}`} title={wall.label}>
              {wall.image ? (
                <Art emoji={wall.emoji} image={wall.image} label={wall.label} />
              ) : (
                wall.label[0]
              )}
            </span>
          )}
          {room && <span className="room-label">{room.name}</span>}
          {person ? (
            <span className="token solved" style={{ background: person.color }}>
              {person.id}
            </span>
          ) : mark === 'X' ? (
            <span className="mark-x">✕</span>
          ) : mark ? (
            <span
              className="token"
              style={{ borderColor: people.find((p) => p.id === mark)?.color }}
            >
              {mark}
            </span>
          ) : null}
        </button>,
      );
    }
  }

  return (
    <div className="board-wrap">
      <div className="board" style={{ ['--n' as string]: n }}>
        {cells}
      </div>
      {denied && (
        <p className="notice" role="status">
          🚫 {denied.text}
        </p>
      )}
    </div>
  );
}
