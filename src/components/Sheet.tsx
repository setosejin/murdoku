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
  modal,
  jumpTo,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** 데스크톱: 바닥에 붙는 대신 가운데에 뜬다 (`desktop.css` 의 `.sheet.modal`) */
  modal?: boolean;
  /**
   * 열면서 이 id 로 스크롤한다. 시트 하나에 여러 패널이 들어 있어 "순위 보기" 와
   * "닉네임 변경" 이 같은 시트의 다른 자리를 가리킬 때 쓴다.
   */
  jumpTo?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;

    if (open) {
      if (!d.open) {
        d.showModal();
        // 그냥 두면 닫기 버튼이 첫 포커스라 열자마자 빨간 링이 뜬다.
        // (React 의 autoFocus 는 마운트 시점에 focus() 를 부르는 거라 여기선 안 먹는다)
        body.current?.focus();
      }
      return;
    }
    if (!d.open) return;

    // 퇴장은 CSS 한 줄로 안 된다. `dialog` 가 닫히면 `[open]` 이 사라지면서
    // `display:none` 이 바로 먹는데, 그걸 미뤄주는 `transition-behavior: allow-discrete`
    // 를 WebKit 이 안 지킨다 — Chromium 은 220ms 를 다 재생하는 반면 iOS 는 시트가
    // 한 프레임에 사라진다. `[open]` 을 유지한 채 data-closing 으로 퇴장을 재생하고
    // 끝난 뒤에 close() 하면 두 엔진이 같은 길을 탄다.
    d.dataset.closing = '';
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      delete d.dataset.closing;
      d.close();
    };
    const onEnd = (e: TransitionEvent) => {
      if (
        e.target === d &&
        (e.propertyName === 'translate' || e.propertyName === 'scale' || e.propertyName === 'opacity')
      )
        finish();
    };
    d.addEventListener('transitionend', onEnd);
    // 전환이 아예 안 오는 경우(모션 최소화 등)에도 시트가 갇히지 않게 하는 보험
    const t = setTimeout(finish, 400);
    return () => {
      clearTimeout(t);
      d.removeEventListener('transitionend', onEnd);
      finish();
    };
  }, [open]);

  /* 지정한 자리로 스크롤. 여는 효과가 끝나기 전에 재면 높이가 아직 0 이라
     한 프레임 기다린다. `open` 이 deps 에 있어야 같은 자리를 두 번 불러도 다시 간다 */
  useEffect(() => {
    if (!open || !jumpTo) return;
    const id = requestAnimationFrame(() => {
      const el = ref.current?.querySelector(`[id="${jumpTo}"]`);
      el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [open, jumpTo]);

  return (
    <dialog
      ref={ref}
      className={modal ? 'sheet modal' : 'sheet'}
      aria-label={title}
      onClose={onClose}
      // ESC 는 기본 동작이 즉시 닫기라 퇴장이 잘린다. 막고 우리 경로로 돌린다
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
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
