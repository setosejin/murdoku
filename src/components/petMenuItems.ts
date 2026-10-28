/**
 * 바깥 손님을 우클릭했을 때 나오는 항목. **두 셸이 같은 목록을 쓴다** —
 * 각자 배열을 조립하면 데스크톱과 모바일의 메뉴가 갈린다.
 *
 * 여기는 이름과 순서만 안다. 무엇을 여는지는 셸이 콜백으로 넘긴다.
 */
export type PetMenuItem = {
  id: string;
  label: string;
  emoji: string;
  run: () => void;
};

export type PetMenuActions = {
  /** 두 셸 공용 게임 방법 */
  onHelp: () => void;
  /** 점수판을 펼친다 */
  onRank: () => void;
  /** 계정 칸을 펼친다 — 닉네임을 거기서 바꾼다 */
  onName: () => void;
  onNew: () => void;
  onClear: () => void;
  onHide: () => void;
};

export function petMenuItems(a: PetMenuActions): PetMenuItem[] {
  return [
    { id: 'help', label: '도움말', emoji: '❓', run: a.onHelp },
    { id: 'privacy', label: '화면 가리기', emoji: '🙈', run: a.onHide },
    { id: 'rank', label: '순위 보기', emoji: '🏆', run: a.onRank },
    { id: 'name', label: '닉네임 변경', emoji: '🪪', run: a.onName },
    { id: 'new', label: '새 사건', emoji: '🗞️', run: a.onNew },
    { id: 'clear', label: '메모 지우기', emoji: '🧽', run: a.onClear },
  ];
}
