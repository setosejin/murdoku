import { useEffect, useRef, type ReactNode } from 'react';

/**
 * 바텀시트. 네이티브 `<dialog>` 라 포커스 가둠·ESC·backdrop 을 브라우저가 준다.
 *
 * ponytail: 아래로 끌어 내려 닫는 제스처는 없다. 보드 탭과 충돌할 위험이 있고,
 * 닫기 버튼 + backdrop 탭 + ESC 로 이미 셋이다. 필요해지면 pointer 이벤트로 붙인다.
 */
export default function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // 그냥 두면 닫기 버튼이 첫 포커스라 열자마자 빨간 링이 뜬다.
      // (React 의 autoFocus 는 마운트 시점에 focus() 를 부르는 거라 여기선 안 먹는다)
      body.current?.focus();
    } else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      // backdrop 을 누르면 target 이 dialog 자신이 된다 (내용은 자식이 다 덮고 있다)
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="sheet-head">
        <h2>{title}</h2>
        <button type="button" className="sheet-x" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>
      {/* 포커스를 여기로 떨어뜨린다 — 키보드로 바로 스크롤도 된다 */}
      <div className="sheet-body" tabIndex={-1} ref={body}>
        {children}
      </div>
    </dialog>
  );
}
