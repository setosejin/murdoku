import { useCallback, useSyncExternalStore } from 'react';

/**
 * 모바일 셸을 쓰는 조건. **`src/styles/mobile.css` 의 미디어 쿼리와 글자까지 같아야 한다** —
 * 둘이 어긋나면 마크업은 모바일인데 스타일은 데스크톱이 된다. 테스트가 일치를 검사한다.
 *
 * 폭 조건만으로는 가로로 누운 폰(844×390)이 데스크톱으로 빠진다. 높이 조건을 OR 로 붙이되
 * `pointer: coarse` 로 묶어서, 창을 낮게 줄인 데스크톱까지 끌려들어오지 않게 한다.
 */
export const MOBILE_QUERY = '(max-width: 760px), (max-height: 540px) and (pointer: coarse)';

/**
 * 미디어 쿼리를 구독한다. 창 크기가 바뀌면 다시 그린다.
 *
 * `renderToStaticMarkup` 에는 `window` 가 없으므로 `getServerSnapshot` 이 `fallback` 을
 * 돌려준다 — 테스트는 늘 fallback 쪽 셸을 본다.
 */
export default function useMediaQuery(query: string, fallback = false) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}
