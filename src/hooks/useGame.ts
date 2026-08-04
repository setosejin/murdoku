import { useEffect, useMemo, useState } from 'react';
import { DIFFICULTIES, generatePuzzle } from '../game/generate';
import { detectiveName, getNick, getUser } from '../game/auth';
import {
  addPlay,
  checkRank,
  fetchBoard,
  getCode,
  loadPlays,
  scoreOf,
  sync,
  type Board,
  type Play,
  type RankDrop,
} from '../game/history';

const newSeed = () => Math.random().toString(36).slice(2, 8);

/**
 * 게임 상태 전부. 데스크톱 셸과 모바일 셸이 같은 것을 나눠 쓴다 —
 * 상태를 셸마다 따로 두면 창 크기를 바꿀 때 메모가 날아간다.
 */
export default function useGame() {
  const [n, setN] = useState(4);
  const [seed, setSeed] = useState(newSeed);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [brush, setBrush] = useState('X');
  const [accused, setAccused] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  // 같은 결과를 다시 지목해도 등장 모션이 재생되도록 key 를 갈아끼우는 카운터
  const [attempt, setAttempt] = useState(0);
  const [revealed, setRevealed] = useState(false);
  // 정답을 한 번이라도 봤나. 그 순간 이 사건은 끝이다 — 더는 지목할 수 없다.
  // revealed 는 토글이라 다시 감추면 흔적이 사라져서 따로 기억한다
  const [peeked, setPeeked] = useState(false);
  /** 방금 맞힌 판의 점수. 지목 패널이 바로 보여준다 */
  const [earned, setEarned] = useState(0);
  const [plays, setPlays] = useState<Play[]>(loadPlays);
  const [code, setCode] = useState(getCode);
  // 순위표에 띄우는 이름. localStorage 가 진짜 저장소인데도 여기 한 번 더 두는 건,
  // 이름을 바꾸는 곳(기록 패널)과 그 이름으로 부르는 곳(점수판·지목·토스트)이 형제라
  // 상태를 공유하지 않으면 저장한 뒤에도 옛 이름이 그대로 남기 때문이다
  const [nick, setNickState] = useState(getNick);
  // undefined = 아직 받는 중, null = 못 받았다, Board = 받았다.
  // 셋을 뭉개면 서버가 죽은 걸 "아직 아무도 없다"고 말하게 된다
  const [board, setBoard] = useState<Board | null | undefined>(undefined);
  /** 순위를 뺏겼다. 토스트와 메뉴 버튼의 점이 이걸 본다 */
  const [rankAlert, setRankAlert] = useState<RankDrop | null>(null);

  // 기록 코드가 정해지거나 바뀌면 서버와 합친다. 실패는 sync 안에서 삼켜진다
  useEffect(() => {
    sync(code, loadPlays()).then(setPlays);
  }, [code]);

  // 순위표는 점수판이 아니라 여기가 갖는다 — 알림 점이 시트 밖(메뉴 버튼)에 붙어서,
  // 시트를 안 열어도 순위를 알고 있어야 한다.
  // 받는 때는 앱을 켤 때·기록이 바뀔 때·탭으로 돌아왔을 때. 주기적으로 캐묻지는 않는다
  useEffect(() => {
    let live = true;
    const pull = () => {
      fetchBoard(code).then((b) => {
        if (!live) return;
        setBoard(b);
        // 못 받아온 응답으로 순위를 갱신하면 다음에 진짜 순위가 왔을 때 헛알림이 난다
        const drop = b === null ? null : checkRank(getUser(), b.rank);
        if (drop !== null) setRankAlert(drop);
      });
    };
    pull();
    const onShow = () => {
      if (document.visibilityState === 'visible') pull();
    };
    document.addEventListener('visibilitychange', onShow);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [code, plays]);

  const puzzle = useMemo(() => generatePuzzle(n, seed), [n, seed]);
  const suspects = puzzle.people.filter((p) => !p.isVictim);
  const victim = puzzle.people.find((p) => p.isVictim)!;
  const culpritName = puzzle.people.find((p) => p.id === puzzle.culpritId)!.name;

  const reset = (nextN = n, nextSeed = newSeed()) => {
    setN(nextN);
    setSeed(nextSeed);
    setMarks({});
    // 브러시도 같이 돌려놓는다. 7×7 에서 F 를 고른 채 4×4 로 가면 F 인 사람이
    // 없어 목록에 켜진 줄이 하나도 없고, 칸에는 색 없는 F 토큰이 찍힌다
    setBrush('X');
    setAccused('');
    setResult(null);
    setRevealed(false);
    setPeeked(false);
    setEarned(0);
    // 지목 횟수는 사건마다 새로 센다. 안 그러면 기록의 tries 에 이전 사건 지목까지 딸려온다
    setAttempt(0);
  };

  const onCell = (key: string) => {
    setMarks((m) => {
      const next = { ...m };
      if (next[key] === brush) delete next[key];
      else next[key] = brush;
      return next;
    });
  };

  const accuse = () => {
    if (!accused || peeked) return;
    const ok = accused === puzzle.culpritId;
    const tries = attempt + 1;
    setResult(ok ? 'correct' : 'wrong');
    setAttempt(tries);
    if (!ok) return;
    setRevealed(true);
    setEarned(scoreOf({ n, tries, ok: true }));
    // 이미 푼 사건을 다시 지목해도 기록은 한 번만
    if (result === 'correct') return;
    const next = addPlay({ seed, n, at: Date.now(), ok: true, tries, title: puzzle.title });
    setPlays(next);
    sync(code, next).then(setPlays);
  };

  return {
    n,
    seed,
    puzzle,
    suspects,
    victim,
    culpritName,
    marks,
    brush,
    accused,
    result,
    attempt,
    revealed,
    peeked,
    earned,
    plays,
    code,
    nick,
    /** 부를 이름. 이름을 정했을 때만 채워진다 — 빈 문자열이면 화면이 원래 문구로 떨어진다 */
    detective: detectiveName(nick),
    board,
    rankAlert,
    difficulties: DIFFICULTIES,
    setBrush,
    setAccused,
    // 감췄다고 안 본 게 되지는 않는다 — 켜는 순간을 여기서 붙잡는다
    setRevealed: (next: boolean) => {
      setRevealed(next);
      if (next) setPeeked(true);
    },
    setPlays,
    setCode,
    setNick: setNickState,
    // 메뉴를 열면 알림은 제 할 일을 다 한 것이다
    dismissRank: () => setRankAlert(null),
    clearMarks: () => setMarks({}),
    onCell,
    accuse,
    reset,
  };
}

export type Game = ReturnType<typeof useGame>;
