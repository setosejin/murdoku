import { useRef, useState } from 'react';
import type { Cell } from '../game/types';
import { rng, shuffled } from '../game/types';
import type { VisitorSpec } from '../data/content';
import useMediaQuery from '../hooks/useMediaQuery';
import { Art } from './Art';
import useWander from './useWander';
import PetMenu, { type MenuAt } from './PetMenu';
import type { PetMenuItem } from './petMenuItems';

/** 이만큼 누르고 있으면 메뉴가 열린다 (폰에는 우클릭이 없다) */
const HOLD_MS = 500;
/** 손가락이 이만큼 미끄러지면 길게 누르기가 아니라 스크롤이다 */
const SLIP_PX = 10;

type Props = {
  /** 이 손님이 도는 덩어리. 서로 상하좌우로 붙어 있다 */
  cells: Cell[];
  n: number;
  visitor: VisitorSpec;
  /** 걸음과 대사 순서를 정하는 시드. 같은 사건이면 같은 산책·같은 순서다 */
  seed: string;
  menu: PetMenuItem[];
  /** 한 마디 뱉을 때. Board 가 안내문 자리에 띄운다 */
  onSay: (emoji: string, text: string) => void;
};

/**
 * 건물 바깥으로 트인 빈 땅을 어슬렁대는 손님.
 *
 * 안뜰 짐승(`YardPet`)과 결정적으로 다른 점: **투명한 판이 없다.** 안뜰 짐승은 칸을
 * 막는 게 목적이라 안뜰 전체를 판으로 덮어야 했고, 그래서 "판이 진짜 칸으로 새면
 * 클릭을 먹는다"는 위험을 늘 안고 있다. 이쪽은 막을 게 없다 — 손님 자신이 한 칸짜리
 * `<button>` 이고 걸음을 따라 움직인다. 진짜 칸 위로 올라갈 경로가 아예 없고,
 * 덩어리가 직사각형이 아니어도 상관없으며, 포커스도 그냥 따라온다.
 *
 * 포인터가 올라오거나 포커스가 잡히면 걸음을 멈춘다. 안 그러면 누르려는 순간 도망간다.
 */
export default function OuterPet({ cells, n, visitor, seed, menu, onSay }: Props) {
  const [held, setHeld] = useState(false);
  const [menuAt, setMenuAt] = useState<MenuAt | null>(null);
  const still = useMediaQuery('(prefers-reduced-motion: reduce)');
  const coarse = useMediaQuery('(pointer: coarse)');
  const { at, facing, pose } = useWander(cells, `${seed}-out`, still || held || menuAt !== null);

  // 대사는 시드로 한 번 섞어 순서대로 돈다. 같은 사건이면 같은 순서다
  const lines = useRef<string[] | null>(null);
  if (!lines.current) lines.current = shuffled(rng(`${seed}-say-${visitor.kind}`), visitor.says);
  const said = useRef(0);

  const hold = useRef({ timer: 0, x: 0, y: 0, fired: false });
  const clearHold = () => {
    clearTimeout(hold.current.timer);
    hold.current.timer = 0;
  };

  const openMenu = (x: number, y: number) => {
    hold.current.fired = true;
    setMenuAt({ x, y });
  };

  const speak = () => {
    const i = said.current++;
    // 첫 마디는 늘 안내다 — 우클릭 메뉴는 눌러보기 전에는 있는 줄도 모른다
    const text =
      i === 0
        ? coarse
          ? '여기는 건물 밖이야. 나를 꾹 누르면 이것저것 열어줄게.'
          : '여기는 건물 밖이야. 나를 오른쪽 버튼으로 누르면 이것저것 열어줄게.'
        : lines.current![(i - 1) % lines.current!.length];
    onSay(visitor.emoji, text);
  };

  const here = cells[at] ?? cells[0];
  const pct = `${(100 / n).toFixed(4)}%`;
  // 자리는 **보드** 기준 퍼센트다. `translate` 퍼센트는 제 상자 기준인데 WebKit 이 그 상자를
  // 정수 px 로 스냅해서 계산한다 — 61.66px 짜리 칸이 62px 로 잡혀 열마다 0.34px 씩 밀리고,
  // 마지막 행·열에서는 손님이 보드를 1.7px 삐져나가 `overflow: hidden` 에 잘렸다
  const spot = { left: `${((here.c * 100) / n).toFixed(4)}%`, top: `${((here.r * 100) / n).toFixed(4)}%` };

  return (
    <>
      <button
        type="button"
        className={`outer-pet${facing < 0 ? ' left' : ''}${pose === 'sit' ? ' sit' : ''}${
          held ? ' perked' : ''
        }`}
        aria-label={`${visitor.label} — 눌러서 말 걸기`}
        aria-haspopup="menu"
        style={{ width: pct, height: pct, ...spot }}
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => {
          setHeld(false);
          clearHold();
        }}
        onFocus={() => setHeld(true)}
        onBlur={() => setHeld(false)}
        onContextMenu={(e) => {
          e.preventDefault();
          // 키보드 메뉴 키(Shift+F10)는 좌표를 안 준다 — 그때는 제 몸 위에 띄운다
          if (e.clientX > 0 || e.clientY > 0) return openMenu(e.clientX, e.clientY);
          const b = e.currentTarget.getBoundingClientRect();
          openMenu(b.left, b.bottom);
        }}
        onPointerDown={(e) => {
          hold.current.fired = false;
          if (e.pointerType === 'mouse') return;
          hold.current.x = e.clientX;
          hold.current.y = e.clientY;
          hold.current.timer = window.setTimeout(() => openMenu(hold.current.x, hold.current.y), HOLD_MS);
        }}
        onPointerMove={(e) => {
          if (!hold.current.timer) return;
          if (Math.abs(e.clientX - hold.current.x) + Math.abs(e.clientY - hold.current.y) > SLIP_PX)
            clearHold();
        }}
        onPointerUp={clearHold}
        onPointerCancel={clearHold}
        onClick={() => {
          clearHold();
          // 길게 눌러 메뉴가 떴으면 대사까지 겹쳐 나오지 않게 이번 클릭은 삼킨다
          if (hold.current.fired) {
            hold.current.fired = false;
            return;
          }
          speak();
        }}
      >
        <Art emoji={visitor.emoji} image={visitor.image} icon={visitor.kind} label={visitor.label} />
      </button>
      <PetMenu
        at={menuAt}
        title={visitor.label}
        emoji={visitor.emoji}
        items={menu}
        onClose={() => setMenuAt(null)}
      />
    </>
  );
}
