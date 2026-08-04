import type { CSSProperties } from 'react';
import type { Span } from '../game/types';
import sprite from '../assets/sprite.svg?raw';

/** 스프라이트에 실제로 들어 있는 아이콘 이름. 없는 가구는 이모지로 떨어진다 */
const ICONS = new Set([...sprite.matchAll(/id="i-([\w-]+)"/g)].map((m) => m[1]));

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
