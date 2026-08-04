import { useEffect, useRef, useState } from 'react';
import type { Cell } from '../game/types';
import { rng } from '../game/types';
import type { PetSpec } from '../data/content';
import useMediaQuery from '../hooks/useMediaQuery';
import { Art } from './Art';
import { nextStep, type Pose } from './yardWalk';

/** 걸음 사이 기본 대기. 앉으면 이만큼 더 눌러앉는다 */
const REST_MS = 1200;
const REST_JITTER_MS = 1800;
const SIT_FACTOR = 1.6;

type Props = {
  /** 안뜰 칸. 행→열 정렬. 비어 있으면 Board 가 아예 그리지 않는다 */
  cells: Cell[];
  n: number;
  pet: PetSpec;
  /** 산책 경로를 정하는 시드. 같은 사건이면 같은 산책이다 */
  seed: string;
  /** 눌렸을 때. Board 가 안내문을 띄운다 */
  onPoke: () => void;
};

/**
 * 안뜰에 사는 짐승. 갇힌 빈 칸 안에서만 돌아다니며 "여기는 건물 밖" 을 몸으로 말한다.
 *
 * 두 겹이다 — 그림(`.yard-pet`, 한 칸 크기)과 안뜰 전체를 덮는 투명한 판(`.yard-plate`).
 * 판이 포인터를 받아 짐승을 그 칸으로 부른다. **상태를 여기 두는 이유**: Board 로
 * 올리면 걸음마다(1~3초) 보드 전체가 다시 그려진다.
 *
 * 좌표는 여기서 문자열을 완성해 넘긴다 — `calc(var())` 는 Safari 가 캐싱한다(webkit#202259).
 */
export default function YardPet({ cells, n, pet, seed, onPoke }: Props) {
  // 첫 자리는 안뜰 한가운데. reduced-motion 이면 여기 그대로 앉아 있는다
  const [at, setAt] = useState(() => Math.floor(cells.length / 2));
  const [facing, setFacing] = useState<1 | -1>(1);
  const [pose, setPose] = useState<Pose>('sit');
  // 놀란 횟수. 값이 아니라 홀짝만 쓴다 — 쌍둥이 클래스로 애니메이션을 다시 돌리려고
  const [startled, setStartled] = useState(0);

  const still = useMediaQuery('(prefers-reduced-motion: reduce)');
  const rand = useRef<(() => number) | null>(null);
  if (!rand.current) rand.current = rng(`${seed}-pet`);

  // 안뜰 모양이 실제로 바뀔 때만 타이머를 다시 건다. Board 는 메모를 찍을 때마다
  // 다시 그리는데, 그때마다 새 배열이 와서 산책이 멈추면 안 된다
  const yardKey = cells.map((c) => `${c.r},${c.c}`).join(' ');
  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  useEffect(() => {
    // 가만히 있기를 원하는 사람에게는 타이머조차 걸지 않는다
    if (still || !yardKey) return;
    const wait = (p: Pose) =>
      (REST_MS + rand.current!() * REST_JITTER_MS) * (p === 'sit' ? SIT_FACTOR : 1);
    let timer = 0;
    const tick = () => {
      const step = nextStep(cellsRef.current, at, pose, rand.current!);
      setAt(step.at);
      setPose(step.pose);
      if (step.facing) setFacing(step.facing);
      timer = window.setTimeout(tick, wait(step.pose));
    };
    timer = window.setTimeout(tick, wait(pose));
    return () => clearTimeout(timer);
    // at·pose 가 바뀔 때마다 다시 건다 — 포인터로 불려간 뒤에도 대기가 새로 시작된다
  }, [yardKey, at, pose, still]);

  /** 포인터가 닿은 칸으로 옮겨 앉는다. 누르려던 자리를 몸으로 차지하는 그림 */
  const comeTo = (i: number) => {
    if (i === at) return;
    const dc = cells[i].c - cells[at].c;
    if (dc) setFacing(dc > 0 ? 1 : -1);
    setAt(i);
    setPose('sit');
  };

  const here = cells[at] ?? cells[0];
  const r0 = Math.min(...cells.map((c) => c.r));
  const c0 = Math.min(...cells.map((c) => c.c));
  const r1 = Math.max(...cells.map((c) => c.r));
  const c1 = Math.max(...cells.map((c) => c.c));
  const pct = (x: number) => `${((x * 100) / n).toFixed(4)}%`;
  const plateW = c1 - c0 + 1;
  const inYard = new Set(cells.map((c) => `${c.r},${c.c}`));

  const box: string[] = [];
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) box.push(`${r},${c}`);

  return (
    <>
      <span
        className={`yard-pet${facing < 0 ? ' left' : ''}${pose === 'sit' ? ' sit' : ''}${
          startled ? (startled % 2 ? ' startled' : ' startled alt') : ''
        }`}
        aria-hidden="true"
        style={{
          width: pct(1),
          height: pct(1),
          translate: `${here.c * 100}% ${here.r * 100}%`,
        }}
      >
        <Art emoji={pet.emoji} image={pet.image} icon={`${pet.kind}${pose === 'sit' ? '-sit' : ''}`} label={pet.label} />
      </span>
      <span
        className="yard-plate"
        aria-hidden="true"
        style={{
          left: pct(c0),
          top: pct(r0),
          width: pct(plateW),
          height: pct(r1 - r0 + 1),
          gridTemplateColumns: `repeat(${plateW}, minmax(0, 1fr))`,
        }}
      >
        {box.map((k) => {
          const i = cells.findIndex((c) => `${c.r},${c.c}` === k);
          // 안뜰이 아닌 칸까지 판이 덮으면 진짜 칸의 클릭을 먹는다
          if (!inYard.has(k)) return <span key={k} className="yard-gap" />;
          return (
            <span
              key={k}
              onPointerEnter={() => comeTo(i)}
              onClick={() => {
                comeTo(i);
                setStartled((x) => x + 1);
                onPoke();
              }}
            />
          );
        })}
      </span>
    </>
  );
}
