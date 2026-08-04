import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { TOUR_STEPS } from '../data/tour';

/**
 * 스포트라이트 온보딩. 규칙을 줄글로 읽히는 대신 화면의 실물을 하나씩 비춘다 —
 * "모든 인물은 서로 다른 행과 열에 있다" 를 문장으로 읽는 것과, 보드가 밝아진
 * 채로 읽는 것은 다르다. `규칙` 패널은 이미 있었지만 아무도 안 읽었다.
 *
 * 데스크톱 셸 전용이다. 겨누는 자리(`.dclues`·`.legend`)가 모바일 메인 화면에는
 * 아예 없고, 그 내용이 시트 안에 들어가 있어 열어둔 채로 비출 수가 없다.
 * ponytail: 모바일 온보딩이 필요해지면 단계마다 시트를 여닫는 지시가 붙어야 한다.
 */

/** 겨눈 자리 둘레에 남기는 숨통 */
const PAD = 8;
const CARD_W = 320;
/** ponytail: 카드 높이를 실측하지 않고 어림값으로 위/아래를 고른다.
    모자라면 화면 아래에 띄우므로 빗나가도 글이 잘리지는 않는다 */
const CARD_ROOM = 190;

type Spot = { x: number; y: number; w: number; h: number };
type Place = { spot: Spot | null; card: CSSProperties };

export default function Tour({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [place, setPlace] = useState<Place>({ spot: null, card: {} });
  const step = TOUR_STEPS[i];
  const last = i === TOUR_STEPS.length - 1;

  useEffect(() => {
    const d = ref.current;
    // showModal 이 포커스 가둠·ESC·top-layer 를 다 준다 (Sheet 와 같은 이유)
    if (d && !d.open) d.showModal();
  }, []);

  useLayoutEffect(() => {
    const read = () => {
      const el = document.querySelector(step.sel);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mid: CSSProperties = { top: 'auto', bottom: 20, left: (vw - CARD_W) / 2 };
      if (!el) return setPlace({ spot: null, card: mid });

      const r = el.getBoundingClientRect();
      const spot = { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
      const left = Math.min(Math.max(12, spot.x + spot.w / 2 - CARD_W / 2), vw - CARD_W - 12);
      const below = vh - (spot.y + spot.h) >= CARD_ROOM;
      const above = spot.y >= CARD_ROOM;
      setPlace({
        spot,
        card: below
          ? { top: spot.y + spot.h + 12, bottom: 'auto', left }
          : above
            ? { top: 'auto', bottom: vh - spot.y + 12, left }
            : // 보드처럼 화면을 거의 다 쓰는 자리. 위아래 어디에도 못 넣으면 화면
              // 아래에 띄우되, 겨눈 것의 한복판을 가리지 않게 여백이 넓은 쪽 구석으로 민다.
              // ponytail: 1024px 처럼 좁은 창에서는 그래도 보드 왼쪽 끝을 80px 쯤 문다.
              // 카드 폭을 남은 여백에 맞춰 줄이면 없앨 수 있지만 글이 그만큼 길어진다
              { ...mid, left: spot.x > vw - (spot.x + spot.w) ? 12 : vw - CARD_W - 12 },
      });
    };
    // 사이드 열은 낮은 창에서 스크롤한다 — 겨눌 자리를 먼저 보이는 데까지 끌어온다
    document.querySelector(step.sel)?.scrollIntoView({ block: 'nearest' });
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, [step.sel]);

  // 단계가 바뀌면 포커스를 카드로 옮긴다 — 스크린리더가 새 글을 읽고,
  // 화살표 키가 바로 먹는다
  useEffect(() => card.current?.focus(), [i]);

  const next = () => (last ? onClose() : setI(i + 1));

  return (
    <dialog
      ref={ref}
      className="tour"
      aria-label="게임 방법"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // 카드 바깥 아무 데나 눌러도 넘어간다 (카드는 자기 클릭을 삼킨다)
      onClick={next}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') next();
        if (e.key === 'ArrowLeft') setI(Math.max(0, i - 1));
      }}
    >
      {/* 어둡게 덮는 것은 이 구멍의 box-shadow 다 — dialog 의 ::backdrop 이 아니다.
          그래야 구멍만 원래 밝기로 남는다 */}
      {place.spot && (
        <div
          className="tour-hole"
          aria-hidden="true"
          style={{
            translate: `${place.spot.x}px ${place.spot.y}px`,
            width: place.spot.w,
            height: place.spot.h,
          }}
        />
      )}

      <div
        className="tour-card"
        key={i}
        style={place.card}
        tabIndex={-1}
        ref={card}
        onClick={(e) => e.stopPropagation()}
      >
        <b>{step.title}</b>
        <p>{step.body}</p>
        <div className="tour-foot">
          {/* 카드 바깥 클릭으로도 넘어가므로 잘못 눌러 지나칠 수 있다.
              여기 없으면 되돌아갈 길이 "닫고 다시 열기" 뿐이다 */}
          <button
            type="button"
            className="chip icon"
            aria-label="이전 단계"
            disabled={i === 0}
            onClick={() => setI(i - 1)}
          >
            ←
          </button>
          <span className="tour-dots" aria-hidden="true">
            {TOUR_STEPS.map((s, k) => (
              <i key={s.sel} className={k === i ? 'on' : undefined} />
            ))}
          </span>
          <span className="tour-num">
            {i + 1} / {TOUR_STEPS.length}
          </span>
          <button type="button" className="link" onClick={onClose}>
            그만 보기
          </button>
          <button type="button" className="chip primary" onClick={next}>
            {last ? '시작하기' : '다음'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
