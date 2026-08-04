import { useEffect, useState } from 'react';
import type { RankDrop } from '../game/history';

/** 저절로 사라지기까지. 한 문장을 읽고 무슨 뜻인지 새기기에 넉넉해야 한다 */
const AUTO_MS = 8000;

/**
 * 순위를 뺏겼다고 알리는 토스트.
 *
 * `position: fixed` 라 레이아웃을 안 먹는다 — 데스크톱도 모바일도 한 화면이라
 * 자리를 차지하는 알림은 그만큼 보드를 깎는다.
 *
 * 저절로 사라지되 닫기 버튼도 준다. 타이머에만 기대면 천천히 읽는 사람이 놓친다.
 * **저절로 사라진 것과 닫은 것은 다르다** — 닫으면 `onClose` 가 불려 메뉴 버튼의 점까지
 * 지워지고, 그냥 사라진 쪽은 점을 남겨 나중에라도 눈에 띄게 한다.
 *
 * ponytail: 앱이 열려 있을 때만 안다(켤 때·사건을 풀 때·탭으로 돌아왔을 때).
 * 닫아둔 사이에 벌어진 일까지 알리려면 서비스워커 + VAPID 웹 푸시가 필요하고,
 * iOS 는 홈 화면에 추가한 경우에만 그마저 온다.
 */
export default function RankToast({
  alert,
  onClose,
}: {
  alert: RankDrop | null;
  onClose: () => void;
}) {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (alert === null) return;
    // 새 알림이면 다시 보여준다 — 앞의 것이 시간이 다 돼 숨은 채로 남아 있을 수 있다
    setGone(false);
    const t = setTimeout(() => setGone(true), AUTO_MS);
    return () => clearTimeout(t);
  }, [alert]);

  return (
    // 껍데기는 늘 붙어 있어야 한다. 살아 있는 영역(role=status)은 붙은 *뒤에* 내용이
    // 바뀌어야 읽히는데, 알림과 함께 통째로 마운트되면 스크린리더가 그냥 지나친다
    <div className="toast-live" role="status">
      {alert !== null && !gone && (
        <div className="toast">
          <p>
            누가 자리를 가져갔어. {alert.from}위 → {alert.to}위
          </p>
          <button type="button" className="toast-x" aria-label="알림 닫기" onClick={onClose}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
