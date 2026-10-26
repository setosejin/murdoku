import type { Furniture } from '../game/types';
import { LegendPanel, RulesPanel } from './GamePanels';
import Sheet from './Sheet';

export default function HelpSheet({
  open, onClose, furniture, modal, onTour, onAfterClose,
}: {
  open: boolean;
  onClose: () => void;
  furniture: Furniture[];
  modal?: boolean;
  onTour?: () => void;
  onAfterClose?: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="게임 방법" modal={modal} onAfterClose={onAfterClose}>
      <div className="help-steps">
        <p>증언을 눌러 인물을 고른 뒤 보드 칸을 누르면 메모가 남아. 같은 표시를 다시 누르면 지워져.</p>
        <p>✕ 빈칸은 아무도 없다는 메모야. 피해자와 같은 방의 용의자를 지목하면 돼.</p>
        {!modal && <p className="hint">위쪽 ? 버튼으로 이 설명을 언제든 다시 볼 수 있어.</p>}
      </div>
      <RulesPanel />
      <LegendPanel furniture={furniture} />
      {onTour && <button type="button" className="chip" onClick={onTour}>화면 안내 다시 보기</button>}
    </Sheet>
  );
}
