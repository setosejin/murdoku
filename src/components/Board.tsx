import { useEffect, useState, type CSSProperties } from 'react';
import { spanOf } from '../game/types';
import type { Furniture, Puzzle, Span } from '../game/types';
import { indexScene } from '../game/clues';
import sprite from '../assets/sprite.svg?raw';

/** 스프라이트에 실제로 들어 있는 아이콘 이름. 없는 가구는 이모지로 떨어진다 */
const ICONS = new Set([...sprite.matchAll(/id="i-([\w-]+)"/g)].map((m) => m[1]));

/* 가구 그림은 자기 발자국을 채운다. 두 칸을 차지하면 그림도 두 칸치 —
   침대와 스탠드가 같은 크기로 그려지면 몇 칸짜리 가구인지 그림만 봐선 알 수 없다.
   한 칸치 = 칸의 68%. `.board` 가 container 라 cqw 가 곧 보드 폭이고, 한 칸은 100cqw/n 이다.
   `calc(68cqw / var(--n))` 로 넘기면 WebKit 이 값을 캐싱하므로(webkit#202259)
   나눗셈은 여기서 끝내고 완성된 문자열만 넘긴다 */
const unitOf = (n: number) => `${(68 / n).toFixed(3)}cqw`;

/** 그림 한 칸치의 좌표 단위. 스프라이트의 viewBox 는 이 값 × 칸 수다 */
const VB = 24;

/** 눕혀 그릴 때를 감안한 그림의 [긴 변, 짧은 변] 칸 수 */
const units = (span?: Span): [number, number] =>
  !span ? [1, 1] : span.h > span.w ? [span.h, span.w] : [span.w, span.h];

/** 발자국(가로·세로 칸수)에 맞춘 그림 크기. 세로로 긴 자리는 가로 그림을 눕혀 쓴다 */
function artBox(unit: string, span?: Span): CSSProperties | undefined {
  if (!span || !unit) return undefined;
  const [w, h] = units(span);
  return {
    width: `calc(${unit} * ${w})`,
    height: `calc(${unit} * ${h})`,
    rotate: span.h > span.w ? '90deg' : undefined,
  };
}

/** 아이콘 정의. 앱에 한 번만 그려두면 `<use>` 가 어디서든 참조한다 */
export function SpriteDefs() {
  return <span hidden dangerouslySetInnerHTML={{ __html: sprite }} />;
}

export function Art({
  emoji,
  image,
  label,
  icon,
  span,
  unit = '',
}: {
  emoji: string;
  image?: string;
  label: string;
  icon?: string;
  span?: Span;
  unit?: string;
}) {
  const box = artBox(unit, span);
  const [uw, uh] = units(span);
  if (image) return <img className="art" src={image} alt={label} style={box} />;
  if (icon && ICONS.has(icon))
    return (
      <svg
        className="art"
        // 스프라이트가 발자국 비율대로 그려져 있다 — 세 칸짜리 소파는 72×24 다.
        // 상자도 같은 비율이라 기본 `xMidYMid meet` 이 딱 맞게 채운다. 늘리지 않으므로
        // 선 굵기가 한 칸짜리 가구와 같고, 칸마다 다른 부분이 그려진다
        viewBox={`0 0 ${VB * uw} ${VB * uh}`}
        role="img"
        aria-label={label}
        style={box}
      >
        <use href={`#i-${icon}`} />
      </svg>
    );
  return (
    <span className="art" role="img" aria-label={label} style={box}>
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

/** 가구 한 점. 자리를 여러 칸 차지하면 그림도 그 발자국만큼 커진다 */
function FurnitureArt({ f, span, n }: { f: Furniture; span: Span; n: number }) {
  return (
    <span
      className={`furniture${f.standable ? ' standable' : ''}`}
      title={f.label}
      style={{
        width: `calc(${span.w * 100}% - 6px)`,
        height: `calc(${span.h * 100}% - 6px)`,
      }}
    >
      <Art
        emoji={f.emoji}
        image={f.image}
        icon={f.kind}
        label={f.label}
        span={span}
        unit={unitOf(n)}
      />
      <span className="fur-label">{f.label}</span>
    </span>
  );
}

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

  // 사건이 벌어진 방 = 피해자가 있던 방. 정답 공개의 마지막 한 마디다
  const victim = people.find((p) => p.isVictim)!;
  const victimCell = puzzle.solution[victim.id];
  const crimeRoom = roomAt[victimCell.r][victimCell.c];

  /* 정답 공개 순서. 무고한 사람이 읽는 방향대로 먼저 자리를 잡고, 한 박자 쉰 뒤
     피해자 → 범인 순으로 온다. 이 게임의 규칙이 "범인 = 피해자와 같은 방에 있던
     용의자" 하나뿐이라, 순서만으로 그 규칙을 말할 수 있다 — 정답 문구는 보드
     바깥에 있어서 이름을 읽고 보드에서 다시 찾아야 했다.
     딜레이는 여기서 산수를 끝내고 완성된 값만 넘긴다 (webkit#202259) */
  const revealDelay = new Map<string, number>();
  let innocents = 0;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const p = personAt.get(`${r},${c}`);
      if (p && p.id !== victim.id && p.id !== puzzle.culpritId)
        revealDelay.set(p.id, innocents++ * 40);
    }
  const beat = innocents * 40;
  revealDelay.set(victim.id, beat + 100);
  revealDelay.set(puzzle.culpritId, beat + 240);

  const cells = [];
  /* 안뜰(갇힌 빈 칸)은 방처럼 이름표를 하나만 단다 — 그림은 첫 칸, 이름은 마지막 칸.
     ponytail: 안뜰이 격자당 한 덩어리라는 전제다 (`donut` 마스크만 만들고, 다른
     마스크는 테두리에서 파고들어 전부 `바깥`이 된다). 갇힌 덩어리를 둘 이상 만드는
     마스크를 넣으면 여기서 덩어리별로 나눠야 한다 */
  const yard = puzzle.theme.courtyard;
  const inner: string[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (idx.voidKind[r][c] === 'inner') inner.push(`${r},${c}`);

  /* 위계: 외벽 5px > 방 경계 3px > 칸선 1px.
     **외벽은 방 칸이 네 변을 다 그린다.** 반대편이 빈 칸이거나 격자 밖이라 선을
     나눠 그릴 상대가 없어서다. 그래서 `.board` 에는 테두리가 없고 건물 실루엣이
     곧 맨 바깥 선이 된다 — ㄱ자 건물이면 맨 바깥 선도 ㄱ자다.
     방↔방·같은 방 선은 예전처럼 위·왼쪽만 그리고 나머지 절반은 이웃이 그린다.
     빈 칸은 아무것도 안 그린다 (건물 바깥에는 격자가 없다).
     격자 밖과 빈 칸을 똑같이 `-1` 로 보는 게 이 함수의 요령이다 */
  const at = (r: number, c: number) => (r < 0 || c < 0 || r >= n || c >= n ? -1 : roomAt[r][c]);
  const borders = (r: number, c: number): CSSProperties => {
    const me = at(r, c);
    if (me < 0) return { borderWidth: 0 };
    // half = 위·왼쪽. 오른쪽·아래의 방 경계선은 이웃 칸 몫이다
    const side = (nr: number, nc: number, half: boolean) => {
      const nb = at(nr, nc);
      if (nb < 0) return 5;
      if (!half) return 0;
      return nb === me ? 1 : 3;
    };
    const w = [
      side(r - 1, c, true),
      side(r, c + 1, false),
      side(r + 1, c, false),
      side(r, c - 1, true),
    ];
    return {
      borderWidth: w.map((x) => `${x}px`).join(' '),
      borderColor: w.map((x) => (x === 1 ? 'var(--tile-line)' : 'var(--wall)')).join(' '),
    };
  };

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const k = `${r},${c}`;
      const kind = idx.voidKind[r][c];
      if (kind) {
        cells.push(
          <div
            key={k}
            className={`cell void ${kind}`}
            data-floor={kind === 'inner' ? yard.floor : undefined}
            style={borders(r, c)}
          >
            {kind === 'inner' && k === inner[0] && (
              <Art emoji={yard.emoji} label={yard.label} />
            )}
            {kind === 'inner' && k === inner[inner.length - 1] && (
              <span className="room-label yard">{yard.label}</span>
            )}
          </div>,
        );
        continue;
      }

      const fur = furnAt.get(k);
      const wall = wallAt.get(k);
      const room = labelAt.get(k);
      const mark = revealed ? undefined : marks[k];
      const person = revealed ? personAt.get(k) : undefined;
      const crime = revealed && roomAt[r][c] === crimeRoom;
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
          className={`cell${blocked ? ' blocked' : ''}${crime ? ' crime' : ''}${
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
          style={borders(r, c)}
        >
          {fur && fur.first && (
            <FurnitureArt f={fur.f} span={spanOf(fur.f)} n={n} />
          )}
          {wall && (
            <span className={`wall-item ${wall.side} ${wall.kind}`} title={wall.label}>
              <Art emoji={wall.emoji} image={wall.image} icon={wall.kind} label={wall.label} />
            </span>
          )}
          {room && <span className="room-label">{room.name}</span>}
          {person ? (
            <span
              className={`token solved${person.id === puzzle.culpritId ? ' culprit' : ''}`}
              style={{
                background: person.color,
                // calc(var(--i) * …) 로 넘기면 WebKit 이 값을 캐싱한다 (webkit#202259).
                // 산수는 위에서 끝내고 완성된 값만 넘긴다
                animationDelay: `${revealDelay.get(person.id) ?? 0}ms`,
              }}
            >
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
      <div
        className="board"
        style={
          {
            gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
            // 방 테두리는 범인이 자리를 잡은 뒤에 그어진다. 인원수에 따라 앞의
            // 스태거 길이가 달라지므로 값도 같이 움직인다. 의사요소에는 인라인
            // 스타일을 못 주니 커스텀 속성으로 내려보낸다 (상속된다)
            '--crime-delay': `${beat + 380}ms`,
          } as CSSProperties
        }
      >
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
