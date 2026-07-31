import { useEffect, useState } from 'react';
import type { Puzzle } from '../game/types';
import { indexScene } from '../game/clues';
import sprite from '../assets/sprite.svg?raw';

/** 스프라이트에 실제로 들어 있는 아이콘 이름. 없는 가구는 이모지로 떨어진다 */
const ICONS = new Set([...sprite.matchAll(/id="i-([\w-]+)"/g)].map((m) => m[1]));

/** 아이콘 정의. 앱에 한 번만 그려두면 `<use>` 가 어디서든 참조한다 */
export function SpriteDefs() {
  return <span hidden dangerouslySetInnerHTML={{ __html: sprite }} />;
}

export function Art({
  emoji,
  image,
  label,
  icon,
}: {
  emoji: string;
  image?: string;
  label: string;
  icon?: string;
}) {
  if (image) return <img className="art" src={image} alt={label} />;
  if (icon && ICONS.has(icon))
    return (
      <svg className="art" viewBox="0 0 24 24" role="img" aria-label={label}>
        <use href={`#i-${icon}`} />
      </svg>
    );
  return (
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
  const [denied, setDenied] = useState<{ key: string; text: string; n: number } | null>(null);
  useEffect(() => {
    if (!denied) return;
    const t = setTimeout(() => setDenied(null), 1600);
    return () => clearTimeout(t);
  }, [denied]);

  const furnAt = new Map<string, { f: (typeof furniture)[number]; first: boolean }>();
  for (const f of furniture)
    f.cells.forEach((c, i) => furnAt.set(`${c.r},${c.c}`, { f, first: i === 0 }));

  const wallAt = new Map(wallItems.map((w) => [`${w.cell.r},${w.cell.c}`, w]));
  const roomById = new Map(rooms.map((r) => [r.id, r]));
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
      const here = roomById.get(roomAt[r][c])!;

      const desc = [
        `${r + 1}행 ${c + 1}열`,
        here.name,
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
          data-floor={here.floor}
          className={`cell${blocked ? ' blocked' : ''}${
            denied?.key === k ? (denied.n % 2 ? ' denied alt' : ' denied') : ''
          }`}
          aria-label={blocked ? `${desc} (가구라 설 수 없음)` : desc}
          onClick={() =>
            blocked
              ? setDenied((prev) => ({
                  key: k,
                  text: `${fur?.f.label ?? '가구'} 위에는 설 수 없어`,
                  n: (prev?.n ?? 0) + 1,
                }))
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
              <Art emoji={fur.f.emoji} image={fur.f.image} icon={fur.f.kind} label={fur.f.label} />
              <span className="fur-label">{fur.f.label}</span>
            </span>
          )}
          {wall && (
            <span className={`wall-item ${wall.side} ${wall.kind}`} title={wall.label}>
              <Art emoji={wall.emoji} image={wall.image} icon={wall.kind} label={wall.label} />
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
      {/* repeat() 안에 var() 를 쓰면 Safari 가 난이도를 바꿔도 트랙 크기를 옛 값으로 붙잡는다
          (webkit#202259) — 열 개수는 여기서 직접 박는다.
          행 높이는 CSS 가 정한다: 데스크톱은 칸의 aspect-ratio, 모바일은 `grid-auto-rows: 1fr`
          (보드 높이가 확정이라 fr 이 균등하게 갈린다) */}
      <div className="board" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {cells}
      </div>
      {denied && (
        <p key={denied.n} className="notice" role="status">
          🚫 {denied.text}
        </p>
      )}
    </div>
  );
}
