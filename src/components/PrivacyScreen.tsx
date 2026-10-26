import { useLayoutEffect, useRef } from 'react';

export function PrivacyButton({ onHide }: { onHide: () => void }) {
  return (
    <button type="button" className="chip privacy-toggle" aria-label="화면 가리기"
      title="화면 가리기" aria-haspopup="dialog" onClick={(event) => {
        event.stopPropagation();
        // 터치 Safari도 복귀할 버튼을 기억하게 한다.
        event.currentTarget.focus({ preventScroll: true });
        onHide();
      }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        <path d="m3 3 18 18" />
      </svg>
    </button>
  );
}

export default function PrivacyScreen({ open, onContinue }: {
  open: boolean;
  onContinue: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  // 클릭한 프레임부터 가린다. 앱의 filter가 아니라 top-layer 위의 backdrop을 쓴다.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
      const previous = opener.current;
      if (previous?.isConnected && previous.getClientRects().length) {
        previous.focus({ preventScroll: true });
      } else {
        const buttons = [...document.querySelectorAll<HTMLElement>('.privacy-toggle')]
          .filter((el) => el.getClientRects().length > 0);
        const inDialog = buttons.filter((el) => el.closest('dialog[open]'));
        (inDialog.at(-1) ?? buttons[0])?.focus({ preventScroll: true });
      }
    }
  }, [open]);

  return (
    <dialog ref={ref} className="privacy-screen" aria-label="화면 가림"
      onCancel={(event) => { event.preventDefault(); onContinue(); }}>
      <button type="button" className="chip" onClick={onContinue}>계속하기</button>
    </dialog>
  );
}
