import type { Cell } from '../game/types';

/** 앉은 자세는 `i-<kind>-sit` 아이콘을 쓴다 */
export type Pose = 'stand' | 'sit';

/** 0 = 방향을 바꾸지 않았다 (세로로 움직였거나 제자리) */
export type Step = { at: number; facing: 1 | -1 | 0; pose: Pose };

/** 앉을 확률 */
const SIT_CHANCE = 0.35;

const adjacent = (a: Cell, b: Cell) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

/**
 * 안뜰 짐승의 다음 걸음. **상하좌우로 붙은 안뜰 칸으로만** 옮긴다 —
 * 대각선으로 건너뛰면 걷는 게 아니라 순간이동으로 보인다.
 * 갈 데가 없으면(1×1 안뜰) 제자리에서 자세만 바꾼다.
 *
 * `rand` 는 시드에서 나온다. 같은 사건이면 같은 산책이다.
 */
export function nextStep(cells: Cell[], at: number, pose: Pose, rand: () => number): Step {
  const here = cells[at];
  const options: number[] = [];
  cells.forEach((c, i) => {
    if (adjacent(here, c)) options.push(i);
  });
  if (!options.length) return { at, facing: 0, pose: pose === 'sit' ? 'stand' : 'sit' };

  const to = options[Math.floor(rand() * options.length)];
  const dc = cells[to].c - here.c;
  return {
    at: to,
    facing: dc > 0 ? 1 : dc < 0 ? -1 : 0,
    pose: rand() < SIT_CHANCE ? 'sit' : 'stand',
  };
}
