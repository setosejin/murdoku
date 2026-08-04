import { useState } from 'react';
import type { Cell } from '../game/types';
import type { PetSpec } from '../data/content';
import useMediaQuery from '../hooks/useMediaQuery';
import { Art } from './Art';
import useWander from './useWander';

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
 * 판이 포인터를 받아 짐승을 그 칸으로 부른다. **판이 있는 까닭은 막는 게 목적**이라서다
 * (바깥 손님 `OuterPet` 은 막을 게 없어서 판 없이 버튼 하나로 끝낸다).
 *
 * 걸음 상태는 `useWander` 가 갖는다 — Board 로 올리면 걸음마다 보드가 통째로 다시 그려진다.
 * 좌표는 여기서 문자열을 완성해 넘긴다 — `calc(var())` 는 Safari 가 캐싱한다(webkit#202259).
 */
export default function YardPet({ cells, n, pet, seed, onPoke }: Props) {
  // 놀란 횟수. 값이 아니라 홀짝만 쓴다 — 쌍둥이 클래스로 애니메이션을 다시 돌리려고
  const [startled, setStartled] = useState(0);
  const still = useMediaQuery('(prefers-reduced-motion: reduce)');
  const { at, facing, pose, goTo } = useWander(cells, `${seed}-pet`, still);

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
              onPointerEnter={() => goTo(i)}
              onClick={() => {
                goTo(i);
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
