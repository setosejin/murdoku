import { useEffect, useRef, useState } from 'react';
import type { Cell } from '../game/types';
import { rng } from '../game/types';
import { nextStep, type Pose } from './yardWalk';

/** 걸음 사이 기본 대기. 앉으면 이만큼 더 눌러앉는다 */
const REST_MS = 1200;
const REST_JITTER_MS = 1800;
const SIT_FACTOR = 1.6;

export type Wander = {
  /** 지금 서 있는 칸의 `cells` 안 인덱스 */
  at: number;
  facing: 1 | -1;
  pose: Pose;
  /** 그 칸으로 옮겨 앉힌다. 포인터가 부를 때 쓴다 */
  goTo: (i: number) => void;
};

/**
 * 칸 목록 위를 어슬렁대는 상태와 타이머. 안뜰 짐승(`YardPet`)과 바깥 손님(`OuterPet`)이
 * 같이 쓴다.
 *
 * **이 훅을 부르는 컴포넌트 안에 상태가 머무는 게 요점**이다. Board 로 올리면
 * 걸음마다(1~3초) 보드 전체가 다시 그려진다.
 *
 * `cells` 는 렌더마다 새 배열이라 deps 에 그대로 넣으면 메모를 찍을 때마다 산책이
 * 멈춘다 — 좌표를 이어붙인 키로 "모양이 진짜 바뀌었을 때"만 타이머를 다시 건다.
 *
 * `paused` 면 타이머를 아예 안 건다. 모션 최소화와 "지금 나를 누르려 한다"가 둘 다
 * 이 길로 들어온다.
 */
export default function useWander(cells: Cell[], seed: string, paused: boolean): Wander {
  // 첫 자리는 한가운데. 멈춰 있어야 하는 사람에게는 여기 그대로 앉아 있는 그림이다
  const [at, setAt] = useState(() => Math.floor(cells.length / 2));
  const [facing, setFacing] = useState<1 | -1>(1);
  const [pose, setPose] = useState<Pose>('sit');

  const rand = useRef<(() => number) | null>(null);
  if (!rand.current) rand.current = rng(seed);

  const shape = cells.map((c) => `${c.r},${c.c}`).join(' ');
  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  useEffect(() => {
    if (paused || !shape) return;
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
    // at·pose 가 바뀔 때마다 다시 건다 — 불려간 뒤에도 대기가 새로 시작된다
  }, [shape, at, pose, paused]);

  const goTo = (i: number) => {
    if (i === at) return;
    const dc = cellsRef.current[i].c - cellsRef.current[at].c;
    if (dc) setFacing(dc > 0 ? 1 : -1);
    setAt(i);
    setPose('sit');
  };

  return { at, facing, pose, goTo };
}
