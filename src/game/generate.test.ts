import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, generatePuzzle } from './generate';
import { indexScene, satisfies } from './clues';
import { solve } from './solve';
import { OUTDOOR_FLOORS, THEMES } from '../data/content';

describe('generatePuzzle', () => {
  for (const n of DIFFICULTIES.map((d) => d.n)) {
    it(`${n}x${n}: 해가 정확히 1개이고 정답이 모든 증언을 만족한다`, () => {
      for (let i = 0; i < 8; i++) {
        const p = generatePuzzle(n, `seed-${n}-${i}`);
        const idx = indexScene(p);

        expect(Object.keys(p.solution)).toHaveLength(n);
        expect(p.people).toHaveLength(n);
        expect(p.clues).toHaveLength(n - 1);

        // 증언이 모호해지지 않으려면 가구/방 이름이 유일해야 한다
        const labels = [...p.furniture.map((f) => f.label), ...p.wallItems.map((w) => w.label)];
        expect(new Set(labels).size).toBe(labels.length);
        expect(new Set(p.rooms.map((r) => r.name)).size).toBe(p.rooms.length);

        // 서로 다른 행/열
        const cells = Object.values(p.solution);
        expect(new Set(cells.map((c) => c.r)).size).toBe(n);
        expect(new Set(cells.map((c) => c.c)).size).toBe(n);

        // 사람이 설 수 있는 칸에만 있다
        for (const c of cells) expect(idx.free[c.r][c.c]).toBe(true);

        // 실루엣 밖에는 아무것도 없다 — 사람도, 가구도, 벽 부착물도
        for (let r = 0; r < n; r++)
          for (let c = 0; c < n; c++)
            if (idx.roomAt[r][c] < 0) {
              expect(idx.free[r][c], `${r},${c} 가 빈 칸인데 설 수 있다`).toBe(false);
              expect(idx.voidKind[r][c]).not.toBeNull();
            } else {
              expect(idx.voidKind[r][c]).toBeNull();
            }
        for (const f of p.furniture)
          for (const c of f.cells) expect(idx.roomAt[c.r][c.c]).toBeGreaterThanOrEqual(0);
        for (const w of p.wallItems)
          expect(idx.roomAt[w.cell.r][w.cell.c]).toBeGreaterThanOrEqual(0);

        // 증언 정합
        for (const clue of p.clues) expect(satisfies(clue, p.solution[clue.personId], idx)).toBe(true);

        // 유일해, 그리고 그 해가 정답
        const sols = solve(p.people, p.clues, idx, 2);
        expect(sols).toHaveLength(1);
        expect(sols[0]).toEqual(p.solution);

        // 피해자 방의 용의자는 정확히 1명 = 범인
        const vc = p.solution.V;
        const vRoom = idx.roomAt[vc.r][vc.c];
        const inRoom = p.people.filter(
          (pe) => !pe.isVictim && idx.roomAt[p.solution[pe.id].r][p.solution[pe.id].c] === vRoom,
        );
        expect(inRoom.map((pe) => pe.id)).toEqual([p.culpritId]);

        // 방마다 용의자는 한 명까지
        const perRoom = new Map<number, number>();
        for (const pe of p.people) {
          if (pe.isVictim) continue;
          const c = p.solution[pe.id];
          const rm = idx.roomAt[c.r][c.c];
          perRoom.set(rm, (perRoom.get(rm) ?? 0) + 1);
        }
        expect([...perRoom.values()]).toEqual(Array(perRoom.size).fill(1));

        // 방마다 가구가 최소 1개, 그리고 그 방에 어울리는 가구만
        const specOf = new Map(p.theme.furniture.map((f) => [f.label, f]));
        for (const room of p.rooms) {
          const here = p.furniture.filter((f) =>
            f.cells.some((c) => idx.roomAt[c.r][c.c] === room.id),
          );
          expect(here.length).toBeGreaterThan(0);
          for (const f of here) {
            const allowed = specOf.get(f.label)!.rooms;
            if (allowed) expect(allowed).toContain(room.name);
          }
        }

        // 방·가구·직업이 전부 한 테마 풀에서만 나온다
        const roomNames = new Set(p.theme.rooms.map((r) => r.name));
        for (const room of p.rooms) expect(roomNames).toContain(room.name);
        const wallLabels = new Set(
          [...p.theme.wallItems, ...(p.theme.outdoorItems ?? [])].map((w) => w.label),
        );
        for (const w of p.wallItems) expect(wallLabels).toContain(w.label);

        // 하늘이 뚫린 칸에는 창문·문이 아니라 울타리·대문이 선다 (그 반대도)
        const floorAt = new Map(
          p.rooms.flatMap((room) => room.cells.map((c) => [`${c.r},${c.c}`, room.floor] as const)),
        );
        for (const w of p.wallItems) {
          const outdoor = OUTDOOR_FLOORS.has(floorAt.get(`${w.cell.r},${w.cell.c}`)!);
          expect(['fence', 'gate'].includes(w.kind)).toBe(outdoor);
        }
        for (const pe of p.people) expect(p.theme.roles).toContain(pe.role);
        expect(p.theme.titles).toContain(p.title);

        // 방은 끊기지 않고 이어져 있다 (지터로 L자가 되어도)
        for (const room of p.rooms) {
          const want = new Set(room.cells.map((c) => `${c.r},${c.c}`));
          const seen = new Set([`${room.cells[0].r},${room.cells[0].c}`]);
          const queue = [room.cells[0]];
          while (queue.length) {
            const cur = queue.shift()!;
            for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
              const k = `${cur.r + dr},${cur.c + dc}`;
              if (want.has(k) && !seen.has(k)) {
                seen.add(k);
                queue.push({ r: cur.r + dr, c: cur.c + dc });
              }
            }
          }
          expect(seen.size, `${room.name} 이 끊겼다`).toBe(room.cells.length);
        }
      }
    });
  }

  it('같은 시드는 같은 퍼즐을 만든다', () => {
    expect(generatePuzzle(5, 'fixed')).toEqual(generatePuzzle(5, 'fixed'));
  });

  // generatePuzzle 은 실패해도 조용히 300×20×60 회 되던지다 맨 끝에서야 throw 한다.
  // 제약을 하나 잘못 넣으면 특정 난이도가 에러 없이 영구 실패하므로 넓게 훑어 잡는다.
  // ponytail: 재시도 횟수를 따로 세지 않는다 — 폭증하면 이 테스트가 타임아웃으로 먼저 터진다.
  // (기준선: 난이도당 60시드에 30·42·25·60ms)
  it('모든 난이도 × 60시드에서 빠짐없이 생성된다', () => {
    const seen = new Set<string>();
    // 실루엣이 한 종류로 굳으면(마스크가 조용히 다 걸러지면) 여기서 잡힌다
    const shapes = new Set<string>();
    for (const n of DIFFICULTIES.map((d) => d.n))
      for (let i = 0; i < 60; i++) {
        expect(() => generatePuzzle(n, `sweep-${n}-${i}`), `n=${n} seed=${i}`).not.toThrow();
        const p = generatePuzzle(n, `sweep-${n}-${i}`);
        seen.add(p.theme.id);
        const kinds = indexScene(p).voidKind.flat();
        shapes.add(
          kinds.includes('inner') ? 'inner' : kinds.includes('outer') ? 'outer' : 'square',
        );
      }
    // 테마 하나가 조용히 생성 불가가 되면 여기서 잡힌다
    expect([...seen].sort()).toEqual(THEMES.map((t) => t.id).sort());
    expect([...shapes].sort()).toEqual(['inner', 'outer', 'square']);
  });

  // 증언 종류가 하나라도 조용히 사라지면(후보가 늘 너무 넓어 안 뽑히면) 잡는다
  it('네 가지 증언이 모두 실제로 쓰인다', () => {
    const types = new Set<string>();
    for (const n of DIFFICULTIES.map((d) => d.n))
      for (let i = 0; i < 30; i++)
        for (const c of generatePuzzle(n, `types-${n}-${i}`).clues) types.add(c.type);
    expect([...types].sort()).toEqual(['FROM_ROOM', 'IN_ROOM', 'NEXT_TO', 'ON']);
  });
});
