import { useEffect, useRef } from 'react';
import type { PetMenuItem } from './petMenuItems';

/** CSS 의 `.petmenu { width }` 와 같아야 한다. 재는 대신 알고 있는 값으로 끝낸다 */
const MENU_W = 208;
const ROW_H = 40;
const CHROME_H = 62;
const EDGE = 8;

export type MenuAt = { x: number; y: number };

/**
 * 바깥 손님을 우클릭하면 열리는 컨텍스트 메뉴.
 *
 * 네이티브 `<dialog>` 다 — top layer 로 올라가므로 `.board { overflow: hidden }` 에
 * 잘리지 않고, ESC·backdrop·포커스 가둠을 브라우저가 준다 (`Sheet` 와 같은 이유).
 * 대신 자리는 우리가 정한다: 포인터가 있던 곳에 왼쪽 위 모서리를 두되 뷰포트 밖으로
 * 나가지 않게 접어 넣는다.
 */
export default function PetMenu({
  at,
  title,
  emoji,
  items,
  onClose,
}: {
  /** null 이면 닫힌 상태 */
  at: MenuAt | null;
  title: string;
  emoji: string;
  items: PetMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (at) {
      if (!d.open) d.showModal();
      // 열자마자 첫 항목에 빨간 focus-visible 링이 뜨는 걸 막는다 (`Sheet` 와 같은 이유).
      // 메뉴 자신이 포커스를 받으면 Tab 은 그대로 첫 항목으로 간다
      d.focus();
      return;
    }
    if (d.open) d.close();
  }, [at]);

  if (!at) return null;

  // 뷰포트를 벗어나면 반대쪽으로 접는다. 높이는 줄 수로 계산한다 — 재려면 한 번
  // 그리고 나서 옮겨야 해서 첫 프레임에 메뉴가 튄다
  const h = CHROME_H + items.length * ROW_H;
  const vw = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 768 : window.innerHeight;
  const left = Math.max(EDGE, Math.min(at.x, vw - MENU_W - EDGE));
  const top = Math.max(EDGE, Math.min(at.y, vh - h - EDGE));

  return (
    <dialog
      ref={ref}
      className="petmenu"
      tabIndex={-1}
      aria-label={`${title} 메뉴`}
      style={{ left: `${left}px`, top: `${top}px` }}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // backdrop 을 누르면 target 이 dialog 자신이 된다 (내용은 자식이 다 덮고 있다)
      onClick={(e) => e.target === ref.current && onClose()}
      // 메뉴 위에서 또 우클릭해도 브라우저 기본 메뉴가 뜨지 않게
      onContextMenu={(e) => e.preventDefault()}
    >
      <p className="petmenu-who">
        <span aria-hidden="true">{emoji}</span> {title}
      </p>
      <ul className="petmenu-list">
        {items.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => {
                onClose();
                it.run();
              }}
            >
              <span aria-hidden="true">{it.emoji}</span> {it.label}
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
