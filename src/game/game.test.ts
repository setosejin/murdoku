import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DIFFICULTIES, generatePuzzle } from './generate';
import worker from '../../worker/index';
import { isCode, MAX_PLAYS, mergePlays, N_RANGE, sanitizePlays, type Play } from './history';
import { constantTimeEqual, derive, isDk, isUserId, MIN_PW, sha256hex } from './auth';
import App from '../App';
import Board from '../components/Board';
import FeedbackDialog, { issueUrl } from '../components/FeedbackDialog';
import ChangelogDialog, { renderMarkdown } from '../components/ChangelogDialog';
import changelog from '../../CHANGELOG.md?raw';
import { indexScene, matchingCells, satisfies } from './clues';
import { solve } from './solve';
import type { Room, Furniture, WallItem } from './types';
import { THEMES } from '../data/content';

describe('generatePuzzle', () => {
  for (const n of [4, 5, 6]) {
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
        const wallLabels = new Set(p.theme.wallItems.map((w) => w.label));
        for (const w of p.wallItems) expect(wallLabels).toContain(w.label);
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
  // (기준선: 난이도당 60시드에 27·32·102ms)
  it('모든 난이도 × 60시드에서 빠짐없이 생성된다', () => {
    const seen = new Set<string>();
    for (const n of [4, 5, 6])
      for (let i = 0; i < 60; i++) {
        expect(() => generatePuzzle(n, `sweep-${n}-${i}`), `n=${n} seed=${i}`).not.toThrow();
        seen.add(generatePuzzle(n, `sweep-${n}-${i}`).theme.id);
      }
    // 테마 하나가 조용히 생성 불가가 되면 여기서 잡힌다
    expect([...seen].sort()).toEqual(THEMES.map((t) => t.id).sort());
  });
});

describe('matchingCells', () => {
  // 4x4, 위 2행 = 거실(0), 아래 2행 = 침실(1)
  const cellsOf = (r0: number, r1: number) => {
    const out = [];
    for (let r = r0; r <= r1; r++) for (let c = 0; c < 4; c++) out.push({ r, c });
    return out;
  };
  const rooms: Room[] = [
    { id: 0, name: '거실', floor: 'wood', cells: cellsOf(0, 1) },
    { id: 1, name: '침실', floor: 'carpet', cells: cellsOf(2, 3) },
  ];
  const furniture: Furniture[] = [
    { id: 'table', kind: 'table', label: '탁자', emoji: '🪑', cells: [{ r: 1, c: 1 }], standable: false },
    { id: 'bed', kind: 'bed', label: '침대', emoji: '🛏️', cells: [{ r: 2, c: 1 }, { r: 3, c: 1 }], standable: true },
  ];
  const wallItems: WallItem[] = [
    { id: 'win', kind: 'window', label: '창문', emoji: '🪟', cell: { r: 2, c: 3 }, side: 'right' },
  ];
  const idx = indexScene({ n: 4, rooms, furniture, wallItems });
  const has = (cells: { r: number; c: number }[], r: number, c: number) =>
    cells.some((x) => x.r === r && x.c === c);

  it('ON: standable 위엔 설 수 있고 blocking 위엔 못 선다', () => {
    expect(matchingCells('ON', 'bed', idx)).toHaveLength(2);
    expect(matchingCells('ON', 'table', idx)).toHaveLength(0);
  });

  it('ON: 벽 부착물 "앞"은 그 칸', () => {
    expect(matchingCells('ON', 'win', idx)).toEqual([{ r: 2, c: 3 }]);
  });

  it('NEXT_TO: 방 경계를 넘지 않는다', () => {
    const next = matchingCells('NEXT_TO', 'table', idx);
    expect(has(next, 0, 1)).toBe(true); // 같은 방 위쪽
    expect(has(next, 2, 1)).toBe(false); // 아래는 침실 → 제외
    expect(has(next, 1, 1)).toBe(false); // 대상 칸 자체는 "옆"이 아님
  });

  it('NEXT_TO: 여러 칸 가구는 모든 칸 기준으로 인접', () => {
    const next = matchingCells('NEXT_TO', 'bed', idx);
    expect(has(next, 2, 0)).toBe(true);
    expect(has(next, 3, 2)).toBe(true);
    expect(has(next, 1, 1)).toBe(false); // 방이 다름
  });

  it('IN_ROOM: 설 수 있는 칸만 돌려준다', () => {
    expect(matchingCells('IN_ROOM', '0', idx)).toHaveLength(7); // 8칸 - 탁자 1칸
  });

  describe('solve 방 제약', () => {
    const suspect = (id: string) => ({ id, name: id, role: '집사', color: '#000', isVictim: false });
    const victim = { id: 'V', name: 'V', role: '집사', color: '#000', isVictim: true };

    it('용의자 수가 방 수보다 많으면 해가 없다 (방마다 한 명까지)', () => {
      const people = [suspect('A'), suspect('B'), suspect('C'), victim];
      expect(solve(people, [], idx, 2)).toHaveLength(0); // 방은 2개뿐
    });

    it('방마다 한 명씩이고 피해자 방에 용의자가 정확히 1명인 해만 나온다', () => {
      const people = [suspect('A'), suspect('B'), victim];
      const sols = solve(people, [], idx, 500);
      expect(sols.length).toBeGreaterThan(0);
      for (const s of sols) {
        const roomOf = (id: string) => idx.roomAt[s[id].r][s[id].c];
        expect(roomOf('A')).not.toBe(roomOf('B'));
        expect([roomOf('A'), roomOf('B')]).toContain(roomOf('V'));
      }
    });
  });
});

describe('Board 렌더링', () => {
  const render = (revealed: boolean, marks: Record<string, string> = {}) => {
    const p = generatePuzzle(5, 'render-check');
    const html = renderToStaticMarkup(
      createElement(Board, { puzzle: p, marks, onCell: () => {}, revealed }),
    );
    return { p, html };
  };

  it('칸 수와 방 이름을 모두 그린다', () => {
    const { p, html } = render(false);
    expect((html.match(/class="cell/g) ?? []).length).toBe(25);
    for (const room of p.rooms) expect(html).toContain(room.name);
  });

  it('2칸 가구는 두 칸에 걸쳐 그려진다', () => {
    const { p, html } = render(false);
    if (p.furniture.some((f) => f.cells.length === 2)) expect(html).toContain('200%');
  });

  it('가구마다 이름이 적혀 있다 (증언의 가구명과 칸을 맞출 수 있게)', () => {
    const { p, html } = render(false);
    for (const f of p.furniture) expect(html).toContain(`fur-label">${f.label}`);
  });

  it('정답 공개 시 인물 토큰이 n개 나온다', () => {
    const { html } = render(true);
    expect((html.match(/token solved/g) ?? []).length).toBe(5);
  });

  it('설 수 없는 가구 칸은 blocked로 표시되고 이유가 라벨에 들어간다', () => {
    const { p, html } = render(false);
    const cnt = p.furniture.filter((f) => !f.standable).reduce((s, f) => s + f.cells.length, 0);
    expect((html.match(/class="cell blocked"/g) ?? []).length).toBe(cnt);
    expect((html.match(/가구라 설 수 없음/g) ?? []).length).toBe(cnt);
  });

  it('칸마다 방 바닥 재질이 붙는다', () => {
    const { p, html } = render(false);
    const floors = new Set(p.rooms.map((r) => r.floor));
    for (const f of floors) expect(html).toContain(`data-floor="${f}"`);
    expect((html.match(/data-floor="/g) ?? []).length).toBe(25);
  });

  it('메모는 공개 전에만 보인다', () => {
    expect(render(false, { '0,0': 'X' }).html).toContain('✕');
    expect(render(true, { '0,0': 'X' }).html).not.toContain('✕');
  });

  // Safari 는 repeat() 안의 var() 를 캐싱해서, 난이도를 오갔다 돌아오면 옛 열 폭을 쓴다.
  // 그래서 열 개수는 CSS 변수가 아니라 인라인 값으로 박아야 한다 (webkit#202259)
  it('열 개수를 grid-template-columns 에 직접 박는다', () => {
    for (const n of [4, 5, 6]) {
      const html = renderToStaticMarkup(
        createElement(Board, {
          puzzle: generatePuzzle(n, `cols-${n}`),
          marks: {},
          onCell: () => {},
          revealed: false,
        }),
      );
      expect(html).toContain(`grid-template-columns:repeat(${n}, minmax(0, 1fr))`);
      expect(html).not.toContain('--n');
    }
  });
});

describe('App 렌더링', () => {
  const html = renderToStaticMarkup(createElement(App));

  it('범례가 이번 사건의 가구를 빠짐없이 설명한다', () => {
    const furniture = (html.match(/fur-label">/g) ?? []).length;
    expect(furniture).toBeGreaterThan(0);
    expect((html.match(/<em>설 수 (있|없)음<\/em>/g) ?? []).length).toBe(furniture);
  });

  it('아이콘 스프라이트를 한 번만 심는다', () => {
    expect((html.match(/id="i-bed"/g) ?? []).length).toBe(1);
  });
});

describe('FeedbackDialog', () => {
  it('이슈 URL에 유형·제목·본문·시드가 인코딩된다', () => {
    const url = new URL(issueUrl('버그', ' 방이 겹쳐 ', '4x4에서 재현됨', 'abc123', 4));

    expect(url.origin + url.pathname).toBe('https://github.com/setosejin/murdoku/issues/new');
    expect(url.searchParams.get('title')).toBe('[버그] 방이 겹쳐');
    const body = url.searchParams.get('body')!;
    expect(body).toContain('4x4에서 재현됨');
    expect(body).toContain('시드: `abc123`');
    expect(body).toContain('난이도: 4x4');
  });

  it('제목 입력과 취소/제출 버튼을 그린다', () => {
    const html = renderToStaticMarkup(createElement(FeedbackDialog, { seed: 'abc123', n: 4 }));
    expect(html).toContain('<dialog');
    expect(html).toContain('피드백');
    expect(html).toContain('required');
    expect(html).toContain('이슈로 열기');
  });
});

describe('버전 기록', () => {
  const md = [
    '# 버전 기록',
    '',
    '## v9.9.9 — 2026-01-02',
    '',
    '### 고침',
    '',
    '- **굵게** 와 `코드` 와 [링크](https://example.dev/x)',
    '- 그냥 한 줄',
    '',
    '남는 문단',
  ].join('\n');

  it('제목·목록·인라인 마크업을 그린다', () => {
    const html = renderToStaticMarkup(createElement('div', null, ...renderMarkdown(md)));

    expect(html).not.toContain('# '); // 파일 제목은 모달 제목이 대신한다
    expect(html).toContain('<h3>v9.9.9 <span class="cl-date">2026-01-02</span></h3>');
    expect(html).toContain('<h4>고침</h4>');
    expect(html).toContain('<b>굵게</b>');
    expect(html).toContain('<code>코드</code>');
    expect(html).toContain('href="https://example.dev/x"');
    expect(html).toContain('<li>그냥 한 줄</li>');
    expect(html).toContain('<p>남는 문단</p>');
    expect(html.match(/<ul>/g)).toHaveLength(1); // 연속한 항목은 한 목록으로 묶인다
  });

  it('버튼과 dialog 를 그린다', () => {
    const html = renderToStaticMarkup(createElement(ChangelogDialog));
    expect(html).toContain('<dialog');
    expect(html).toContain(`v${import.meta.env.VITE_APP_VERSION}`);
    expect(html).toContain('버전 기록');
  });

  // pre-push 훅과 같은 불변식. 훅은 --no-verify 로 넘길 수 있지만 CI 의 npm test 는 못 넘긴다.
  it('CHANGELOG 에 현재 버전 항목이 있다', () => {
    expect(changelog).toContain(`## v${import.meta.env.VITE_APP_VERSION} — `);
  });
});

describe('플레이 기록', () => {
  const play = (over: Partial<Play> = {}): Play => ({
    seed: 'a1b2c3',
    n: 4,
    at: 1000,
    ok: true,
    tries: 1,
    title: '사라진 회중시계',
    ...over,
  });

  it('N_RANGE 가 실제 난이도와 어긋나지 않는다', () => {
    const ns = DIFFICULTIES.map((d) => d.n);
    expect(Math.min(...ns)).toBe(N_RANGE.min);
    expect(Math.max(...ns)).toBe(N_RANGE.max);
  });

  it('병합은 합집합이고 같은 기록은 한 번만 남는다', () => {
    const a = play({ at: 1 });
    const b = play({ at: 2 });
    expect(mergePlays([a], [a, b])).toHaveLength(2);
    expect(mergePlays([a, b], [a, b])).toHaveLength(2);
  });

  it('같은 시드라도 다시 풀면 별도 기록이다', () => {
    expect(mergePlays([play({ at: 1 })], [play({ at: 2 })])).toHaveLength(2);
  });

  it('최근 기록이 앞에 오고 상한을 넘지 않는다', () => {
    const many = Array.from({ length: MAX_PLAYS + 50 }, (_, i) => play({ at: i + 1 }));
    const merged = mergePlays(many, [play({ at: 7 })]);

    expect(merged).toHaveLength(MAX_PLAYS);
    expect(merged[0].at).toBe(MAX_PLAYS + 50);
    expect(merged.map((p) => p.at)).toEqual([...merged.map((p) => p.at)].sort((x, y) => y - x));
  });

  it('배열이 아니면 빈 목록이다', () => {
    for (const bad of [null, undefined, 0, 'x', {}]) expect(sanitizePlays(bad)).toEqual([]);
  });

  it('망가진 레코드는 버린다', () => {
    const bad = [
      null,
      'x',
      play({ seed: '' }),
      { ...play(), seed: 123 },
      play({ n: 99 }),
      play({ n: 4.5 }),
      play({ at: 0 }),
      play({ at: 5e12 }),
      play({ tries: 0 }),
      { ...play(), ok: 'true' },
      play({ title: 'ㄱ'.repeat(200) }),
      play({ seed: 'z'.repeat(200) }),
    ];
    expect(sanitizePlays(bad)).toEqual([]);
    expect(sanitizePlays([...bad, play()])).toEqual([play()]);
  });

  it('모르는 필드는 저장하지 않는다', () => {
    const [p] = sanitizePlays([{ ...play(), solution: 'A2', evil: '×'.repeat(9999) }]);
    expect(Object.keys(p).sort()).toEqual(['at', 'n', 'ok', 'seed', 'title', 'tries']);
  });

  it('개수 상한을 넘겨 밀어넣을 수 없다', () => {
    // 중복 제거는 mergePlays 몫이다. 여기서 막는 건 개수뿐
    expect(sanitizePlays(Array.from({ length: 5000 }, () => play()))).toHaveLength(MAX_PLAYS);
  });

  it('기록 코드는 22자 소문자·숫자만 통과한다', () => {
    expect(isCode('a'.repeat(22))).toBe(true);
    for (const bad of ['', 'a'.repeat(21), 'a'.repeat(23), 'A'.repeat(22), '../'.repeat(7) + 'a'])
      expect(isCode(bad)).toBe(false);
  });
});

describe('기록 동기화 워커', () => {
  const CODE = 'a'.repeat(22);
  const play = (at: number) => ({
    seed: 'a1b2c3',
    n: 4,
    at,
    ok: true,
    tries: 1,
    title: '사라진 회중시계',
  });

  const env = () => {
    const store = new Map<string, string>();
    let writes = 0;
    return {
      HISTORY: {
        get: async (k: string) => store.get(k) ?? null,
        put: async (k: string, v: string) => {
          writes++;
          store.set(k, v);
        },
      },
      ORIGIN: 'https://setosejin.github.io',
      writes: () => writes,
    };
  };

  const post = (e: ReturnType<typeof env>, path: string, body: unknown) =>
    worker.fetch(
      new Request(`https://w.dev${path}`, { method: 'POST', body: JSON.stringify(body) }),
      e,
    );

  it('올린 기록을 돌려주고, 다른 기기는 빈 배열로 받아간다', async () => {
    const e = env();
    const up = await post(e, `/h/${CODE}`, [play(1)]);
    expect(up.status).toBe(200);
    expect(await up.json()).toEqual([play(1)]);

    const down = await post(e, `/h/${CODE}`, []);
    expect(await down.json()).toEqual([play(1)]);
  });

  it('두 기기의 기록이 합쳐진다', async () => {
    const e = env();
    await post(e, `/h/${CODE}`, [play(1)]);
    const merged = await (await post(e, `/h/${CODE}`, [play(2)])).json();
    expect(merged).toEqual([play(2), play(1)]);
  });

  it('불러오기만 하면 KV에 쓰지 않는다', async () => {
    const e = env();
    await post(e, `/h/${CODE}`, [play(1)]);
    const before = e.writes();
    await post(e, `/h/${CODE}`, []);
    await post(e, `/h/${CODE}`, [play(1)]);
    expect(e.writes()).toBe(before);
  });

  it('빈 기록은 저장하지 않는다', async () => {
    // 신규 방문자마다 빈 항목이 생기면 쓰기 한도가 방문자 수에 물린다.
    // 아무 코드나 찍어 한도를 태우는 것도 막힌다
    const e = env();
    for (let i = 0; i < 5; i++) await post(e, `/h/${'b'.repeat(22)}`, []);
    expect(e.writes()).toBe(0);
    expect(await (await post(e, `/h/${'b'.repeat(22)}`, [])).json()).toEqual([]);
  });

  it('기록 코드가 아니면 400이고 KV를 건드리지 않는다', async () => {
    const e = env();
    for (const path of ['/h/../secret', '/h/', '/h/short', `/other/${CODE}`, `/h/${CODE}x`]) {
      expect((await post(e, path, [])).status).toBe(400);
    }
    expect(e.writes()).toBe(0);
  });

  it('POST 말고는 안 받고, OPTIONS 는 CORS 로 답한다', async () => {
    const e = env();
    const get = await worker.fetch(new Request(`https://w.dev/h/${CODE}`), e);
    expect(get.status).toBe(405);

    const pre = await worker.fetch(
      new Request(`https://w.dev/h/${CODE}`, { method: 'OPTIONS' }),
      e,
    );
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('https://setosejin.github.io');
  });

  it('너무 큰 본문은 413', async () => {
    const e = env();
    const res = await worker.fetch(
      new Request(`https://w.dev/h/${CODE}`, { method: 'POST', body: 'x'.repeat(70_000) }),
      e,
    );
    expect(res.status).toBe(413);
    expect(e.writes()).toBe(0);
  });

  it('망가진 본문이 저장된 기록을 지우지 못한다', async () => {
    const e = env();
    await post(e, `/h/${CODE}`, [play(1)]);
    for (const bad of ['찢어진 json', '{}', '[{"seed":1}]', 'null']) {
      const res = await worker.fetch(
        new Request(`https://w.dev/h/${CODE}`, { method: 'POST', body: bad }),
        e,
      );
      expect(await res.json()).toEqual([play(1)]);
    }
  });
});

describe('계정 검증', () => {
  it('아이디는 소문자·숫자·밑줄 3~20자만 받는다', () => {
    for (const ok of ['abc', 'se_jin', 'a'.repeat(20), 'user123']) {
      expect(isUserId(ok)).toBe(true);
    }
    for (const bad of [
      'ab', // 짧다
      'a'.repeat(21), // 길다
      'Sejin', // 대문자 — 대소문자만 다른 계정이 생기면 안 된다
      'se jin',
      'se-jin',
      'u:admin', // KV 키 공간을 넘보는 입력
      '../etc',
      '한글',
      '',
      null,
      42,
      { toString: () => 'abc' },
    ]) {
      expect(isUserId(bad)).toBe(false);
    }
  });

  it('dk 는 64자 소문자 hex 만 받는다', () => {
    expect(isDk('a'.repeat(64))).toBe(true);
    expect(isDk('0123456789abcdef'.repeat(4))).toBe(true);
    for (const bad of ['a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), 'g'.repeat(64), '', null]) {
      expect(isDk(bad)).toBe(false);
    }
  });

  it('아이디는 기록 코드로 오인될 수 없다', () => {
    // 계정 키는 `u:` 를 붙여 저장한다. 코드 판정과 절대 겹치면 안 된다
    for (const id of ['abc', 'a'.repeat(20), 'user_1']) {
      expect(isCode(`u:${id}`)).toBe(false);
    }
  });

  it('상수시간 비교가 길이·내용을 모두 본다', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'ab')).toBe(false);
    expect(constantTimeEqual('', '')).toBe(true);
  });

  it('derive 는 결정적이고, 아이디나 비번이 다르면 결과가 달라진다', async () => {
    const a = await derive('sejin', 'correct horse');
    expect(await derive('sejin', 'correct horse')).toBe(a);
    expect(isDk(a)).toBe(true);
    // 같은 비번이라도 아이디가 다르면 달라야 한다 (아이디가 솔트다)
    expect(await derive('other', 'correct horse')).not.toBe(a);
    expect(await derive('sejin', 'wrong horse')).not.toBe(a);
  });

  it('sha256hex 는 dk 형식과 같은 폭을 낸다', async () => {
    expect(isDk(await sha256hex('아무거나'))).toBe(true);
  });

  it('비밀번호 최소 길이가 정해져 있다', () => {
    expect(MIN_PW).toBeGreaterThanOrEqual(8);
  });
});

describe('계정 워커', () => {
  const DK = '0123456789abcdef'.repeat(4);
  const DK2 = 'fedcba9876543210'.repeat(4);

  const env = () => {
    const store = new Map<string, string>();
    let writes = 0;
    return {
      HISTORY: {
        get: async (k: string) => store.get(k) ?? null,
        put: async (k: string, v: string) => {
          writes++;
          store.set(k, v);
        },
      },
      ORIGIN: 'https://setosejin.github.io',
      writes: () => writes,
      keys: () => [...store.keys()],
    };
  };

  const auth = (e: ReturnType<typeof env>, route: 'signup' | 'login', body: unknown) =>
    worker.fetch(
      new Request(`https://w.dev/a/${route}`, { method: 'POST', body: JSON.stringify(body) }),
      e,
    );

  const codeOf = async (res: Response) => ((await res.json()) as { code: string }).code;

  it('가입하면 서버가 만든 기록 코드를 준다', async () => {
    const e = env();
    const res = await auth(e, 'signup', { id: 'sejin', dk: DK });
    expect(res.status).toBe(201);
    expect(isCode(await codeOf(res))).toBe(true);
    expect(e.keys()).toEqual(['u:sejin']);
  });

  it('비밀번호 원문도 dk 도 그대로 저장하지 않는다', async () => {
    const e = env();
    await auth(e, 'signup', { id: 'sejin', dk: DK });
    const stored = await e.HISTORY.get('u:sejin');
    expect(stored).not.toContain(DK);
  });

  it('같은 아이디로 두 번 가입할 수 없다', async () => {
    const e = env();
    await auth(e, 'signup', { id: 'sejin', dk: DK });
    const dup = await auth(e, 'signup', { id: 'sejin', dk: DK2 });
    expect(dup.status).toBe(409);
    // 남의 계정을 덮어쓰지 못한다
    expect(await codeOf(await auth(e, 'login', { id: 'sejin', dk: DK }))).toBeTruthy();
  });

  it('로그인하면 가입 때와 같은 코드가 나온다', async () => {
    const e = env();
    const signed = await codeOf(await auth(e, 'signup', { id: 'sejin', dk: DK }));
    const res = await auth(e, 'login', { id: 'sejin', dk: DK });
    expect(res.status).toBe(200);
    expect(await codeOf(res)).toBe(signed);
  });

  it('로그인은 KV 에 쓰지 않는다', async () => {
    const e = env();
    await auth(e, 'signup', { id: 'sejin', dk: DK });
    const before = e.writes();
    await auth(e, 'login', { id: 'sejin', dk: DK });
    await auth(e, 'login', { id: 'sejin', dk: DK2 });
    expect(e.writes()).toBe(before);
  });

  it('비밀번호가 틀리거나 없는 아이디면 401', async () => {
    const e = env();
    await auth(e, 'signup', { id: 'sejin', dk: DK });
    expect((await auth(e, 'login', { id: 'sejin', dk: DK2 })).status).toBe(401);
    expect((await auth(e, 'login', { id: 'nobody', dk: DK })).status).toBe(401);
  });

  it('형식이 틀리면 400 이고 KV 를 건드리지 않는다', async () => {
    const e = env();
    for (const body of [
      { id: 'Sejin', dk: DK },
      { id: 'ab', dk: DK },
      { id: 'u:admin', dk: DK },
      { id: 'sejin', dk: 'short' },
      { id: 'sejin' },
      { dk: DK },
      null,
      [],
      'string',
    ]) {
      expect((await auth(e, 'signup', body)).status).toBe(400);
      expect((await auth(e, 'login', body)).status).toBe(400);
    }
    expect(e.writes()).toBe(0);
  });

  it('JSON 이 아니면 400, 본문이 크면 413', async () => {
    const e = env();
    const raw = (body: string) =>
      worker.fetch(new Request('https://w.dev/a/signup', { method: 'POST', body }), e);
    expect((await raw('찢어진 json')).status).toBe(400);
    expect((await raw('x'.repeat(2000))).status).toBe(413);
    expect(e.writes()).toBe(0);
  });

  it('클라이언트가 기록 코드를 고를 수 없다', async () => {
    // 코드를 지정할 수 있으면 남의 코드를 자기 계정으로 등록해 기록을 가져갈 수 있다
    const e = env();
    const mine = 'z'.repeat(22);
    const got = await codeOf(await auth(e, 'signup', { id: 'thief', dk: DK, code: mine }));
    expect(got).not.toBe(mine);
    expect(isCode(got)).toBe(true);
  });

  it('가입 → 기록 저장 → 다른 기기 로그인 → 같은 기록', async () => {
    const e = env();
    const play = {
      seed: 'a1b2c3',
      n: 4,
      at: 1000,
      ok: true,
      tries: 2,
      title: '사라진 회중시계',
    };

    // 기기 A: 가입하고 받은 코드로 기록을 올린다
    const code = await codeOf(await auth(e, 'signup', { id: 'sejin', dk: DK }));
    await worker.fetch(
      new Request(`https://w.dev/h/${code}`, { method: 'POST', body: JSON.stringify([play]) }),
      e,
    );

    // 기기 B: 아이디·비번만으로 같은 코드를 받아 기록을 그대로 받아간다
    const code2 = await codeOf(await auth(e, 'login', { id: 'sejin', dk: DK }));
    expect(code2).toBe(code);
    const down = await worker.fetch(
      new Request(`https://w.dev/h/${code2}`, { method: 'POST', body: '[]' }),
      e,
    );
    expect(await down.json()).toEqual([play]);
  });

  it('계정 키와 기록 키가 섞이지 않는다', async () => {
    const e = env();
    const code = await codeOf(await auth(e, 'signup', { id: 'sejin', dk: DK }));
    await worker.fetch(
      new Request(`https://w.dev/h/${code}`, {
        method: 'POST',
        body: JSON.stringify([
          { seed: 's', n: 4, at: 1, ok: true, tries: 1, title: 't' },
        ]),
      }),
      e,
    );
    expect(e.keys().sort()).toEqual(['u:sejin', code].sort());
    // 계정 레코드를 기록으로 읽으려는 시도는 코드 형식에서 막힌다
    expect(
      (
        await worker.fetch(
          new Request('https://w.dev/h/u:sejin', { method: 'POST', body: '[]' }),
          e,
        )
      ).status,
    ).toBe(400);
  });
});

describe('계정 UI', () => {
  const render = () => renderToStaticMarkup(createElement(App));

  it('동기화 서버가 없는 빌드에서는 로그인 UI 를 아예 안 그린다', () => {
    // 포크가 원본 워커를 못 쓰는데 로그인 창만 떠 있으면 안 된다
    expect(import.meta.env.VITE_SYNC_URL).toBeFalsy();
    const html = render();
    expect(html).not.toContain('로그인하고 기록 잇기');
    expect(html).not.toContain('type="password"');
  });

  it('로그인 서버가 없어도 복구 키와 기록은 그대로 보인다', () => {
    const html = render();
    expect(html).toContain('복구 키');
    expect(html).toContain('기록 코드 붙여넣기');
  });

  it('동기화 서버가 있으면 로그인 폼을 그린다', () => {
    vi.stubEnv('VITE_SYNC_URL', 'https://sync.example.com');
    try {
      const html = render();
      expect(html).toContain('로그인하고 기록 잇기');
      expect(html).toContain('type="password"');
      // 비밀번호 관리자가 알아보게 표준 힌트를 준다.
      // React 는 속성명을 카멜케이스로 뱉는데 HTML 속성명은 대소문자를 안 가려서 동작에 지장이 없다
      expect(html).toMatch(/autocomplete="current-password"/i);
      expect(html).toMatch(new RegExp(`minlength="${MIN_PW}"`, 'i'));
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('로그인 중이면 로그아웃만 보이고 "기록 지우기" 는 감춘다', () => {
    // 둘은 같은 동작인데, 계정 사본이 남아 다시 로그인하면 돌아오므로
    // "지우기" 라는 말이 로그인 상태에서는 거짓말이 된다
    const store = new Map([
      ['murdoku.user', 'tester'],
      ['murdoku.code', 'a'.repeat(22)],
    ]);
    vi.stubEnv('VITE_SYNC_URL', 'https://sync.example.com');
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    try {
      const html = render();
      expect(html).toContain('로그아웃');
      // 문자열이 아니라 버튼으로 본다 — 버전 기록 모달이 이 문구를 그대로 인용한다
      expect(html).not.toMatch(/<button[^>]*>이 기기에서 기록 지우기<\/button>/);
      expect(html).not.toContain('type="password"');
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
