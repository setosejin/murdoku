import { useEffect, useMemo, useState } from 'react';
import { DIFFICULTIES, generatePuzzle } from '../game/generate';
import { addPlay, getCode, loadPlays, sync, type Play } from '../game/history';

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
  const [plays, setPlays] = useState<Play[]>(loadPlays);
  const [code, setCode] = useState(getCode);

  // 기록 코드가 정해지거나 바뀌면 서버와 합친다. 실패는 sync 안에서 삼켜진다
  useEffect(() => {
    sync(code, loadPlays()).then(setPlays);
  }, [code]);

  const puzzle = useMemo(() => generatePuzzle(n, seed), [n, seed]);
  const suspects = puzzle.people.filter((p) => !p.isVictim);
  const victim = puzzle.people.find((p) => p.isVictim)!;
  const culpritName = puzzle.people.find((p) => p.id === puzzle.culpritId)!.name;

  const reset = (nextN = n, nextSeed = newSeed()) => {
    setN(nextN);
    setSeed(nextSeed);
    setMarks({});
    setAccused('');
    setResult(null);
    setRevealed(false);
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
    if (!accused) return;
    const ok = accused === puzzle.culpritId;
    const tries = attempt + 1;
    setResult(ok ? 'correct' : 'wrong');
    setAttempt(tries);
    if (!ok) return;
    setRevealed(true);
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
    plays,
    code,
    difficulties: DIFFICULTIES,
    setBrush,
    setAccused,
    setRevealed,
    setPlays,
    setCode,
    clearMarks: () => setMarks({}),
    onCell,
    accuse,
    reset,
  };
}

export type Game = ReturnType<typeof useGame>;
