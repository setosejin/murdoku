/**
 * 보드 자체의 렌더링 — 칸·가구·메모·실루엣·벽 부착물.
 * 앱 셸과 모달은 `render.test.ts`, 안뜰의 주인은 `yard.test.ts` 가 본다.
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DIFFICULTIES, generatePuzzle } from '../game/generate';
import { indexScene } from '../game/clues';
import Board from './Board';
import boardCss from '../styles/board.css?raw';
import wallCss from '../styles/wall.css?raw';
import indexCss from '../index.css?raw';

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

  it('가구는 자기 발자국만큼 자리와 그림을 차지한다', () => {
    const { p, html } = render(false);
    for (const f of p.furniture) {
      const rs = f.cells.map((c) => c.r);
      const cs = f.cells.map((c) => c.c);
      const w = Math.max(...cs) - Math.min(...cs) + 1;
      const h = Math.max(...rs) - Math.min(...rs) + 1;
      // 자리: 칸 수만큼 늘어난 상자
      expect(html).toContain(`width:calc(${w * 100}% - 6px);height:calc(${h * 100}% - 6px)`);
      // 그림: 세로로 긴 자리는 가로 그림을 눕혀 쓰므로 긴 변이 앞에 온다
      const [uw, uh] = h > w ? [h, w] : [w, h];
      expect(html).toContain(`width:calc(13.600cqw * ${uw});height:calc(13.600cqw * ${uh})`);
      // viewBox 도 같은 비율이라야 늘어나지도 letterbox 되지도 않는다
      expect(html).toContain(`viewBox="0 0 ${24 * uw} ${24 * uh}"`);
      if (h > w) expect(html).toContain('rotate:90deg');
    }
  });

  it('가구마다 이름이 적혀 있다 (증언의 가구명과 칸을 맞출 수 있게)', () => {
    const { p, html } = render(false);
    for (const f of p.furniture) expect(html).toContain(`fur-label">${f.label}`);
  });

  it('정답 공개 시 인물 토큰이 n개 나온다', () => {
    const { html } = render(true);
    expect((html.match(/token solved/g) ?? []).length).toBe(5);
  });

  /* 정답 공개는 이 게임의 규칙("범인 = 피해자와 같은 방에 있던 용의자")을
     순서로 말한다. 범인 표시나 사건 현장 표시가 빠지면 정답이 보드 밖 문구로만
     남아서, 이름을 읽고 보드에서 글자를 다시 찾아야 한다 */
  it('정답 공개 시 범인 토큰과 사건 현장이 따로 표시된다', () => {
    const { p, html } = render(true);
    expect((html.match(/token solved culprit/g) ?? []).length).toBe(1);

    const vc = p.solution[p.people.find((x) => x.isVictim)!.id];
    const crimeRoom = p.rooms.find((rm) => rm.cells.some((c) => c.r === vc.r && c.c === vc.c))!;
    expect((html.match(/class="cell[^"]* crime/g) ?? []).length).toBe(crimeRoom.cells.length);
    // 마지막 한 마디의 딜레이. 의사요소가 읽어가므로 인라인이 아니라 변수로 내려간다
    expect(html).toContain('--crime-delay');
  });

  it('공개 전에는 범인도 사건 현장도 드러나지 않는다', () => {
    const { html } = render(false);
    expect(html).not.toContain('culprit');
    expect(html).not.toContain(' crime');
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
    // 건물 바깥 칸만 바닥이 없다 (안뜰은 테마 바닥을 쓴다)
    const outer = indexScene(p).voidKind.flat().filter((k) => k === 'outer').length;
    expect((html.match(/data-floor="/g) ?? []).length).toBe(25 - outer);
  });

  it('메모는 공개 전에만 보인다', () => {
    expect(render(false, { '0,0': 'X' }).html).toContain('✕');
    expect(render(true, { '0,0': 'X' }).html).not.toContain('✕');
  });

  // Safari 는 repeat() 안의 var() 를 캐싱해서, 난이도를 오갔다 돌아오면 옛 열 폭을 쓴다.
  // 그래서 열 개수는 CSS 변수가 아니라 인라인 값으로 박아야 한다 (webkit#202259)
  it('열 개수를 grid-template-columns 에 직접 박는다', () => {
    for (const n of DIFFICULTIES.map((d) => d.n)) {
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

/* 건물 외곽선이 격자를 다 채우지 않는다. 방이 아닌 칸은 누를 수도 포커스할 수도
   없어야 하고, 갇힌 칸(안뜰)만 테마 그림을 받는다 */
describe('실루엣 렌더링', () => {
  // 실루엣이 나오는 시드를 직접 찾는다 — 마스크 팔레트가 바뀌어도 테스트가 따라간다
  const withVoid = (want: 'outer' | 'inner') => {
    for (let i = 0; i < 60; i++) {
      const p = generatePuzzle(6, `void-${i}`);
      const kinds = indexScene(p).voidKind.flat();
      if (!kinds.includes(want)) continue;
      if (want === 'inner' && kinds.includes('outer')) continue;
      const html = renderToStaticMarkup(
        createElement(Board, { puzzle: p, marks: {}, onCell: () => {}, revealed: false }),
      );
      return { p, html, voids: kinds.filter(Boolean).length };
    }
    throw new Error(`${want} 실루엣이 나오는 시드를 못 찾았다`);
  };

  it('건물 밖 칸은 버튼이 아니다 (누를 수도 포커스할 수도 없다)', () => {
    const { html, voids } = withVoid('outer');
    expect(voids).toBeGreaterThan(0);
    expect((html.match(/<div class="cell void /g) ?? []).length).toBe(voids);
    expect((html.match(/<button/g) ?? []).length).toBe(36 - voids);
    // 건물 바깥에는 격자가 없다 — 빈 칸은 선을 한 줄도 안 긋는다
    expect(html).toContain('class="cell void outer" style="border-width:0"');
  });

  /* 맨 바깥 선이 정사각형이면 실루엣이 액자 안의 여백처럼 읽힌다. 외벽(5px)은
     `.board` 가 아니라 칸이 그려야 건물 모양을 따라간다 */
  it('가장 굵은 선이 건물 실루엣을 따라간다', () => {
    const { p, html } = withVoid('outer');
    const n = p.n;
    const idx = indexScene(p);
    const isRoom = (r: number, c: number) =>
      r >= 0 && c >= 0 && r < n && c < n && idx.roomAt[r][c] >= 0;
    // 칸마다 정확히 한 번 나온다 (가구·그림 style 에는 border-width 가 없다)
    const widths = [...html.matchAll(/border-width:([^;"]*)/g)].map((m) =>
      m[1].split(' ').map((x) => parseInt(x, 10)),
    );
    expect(widths).toHaveLength(n * n);

    let wall = 0;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const w = widths[r * n + c];
        if (!isRoom(r, c)) {
          expect(w, `${r},${c} 빈 칸이 선을 그렸다`).toEqual([0]);
          continue;
        }
        const [top, right, bottom, left] = w;
        // 외벽은 건물과 건물 아닌 곳(빈 칸·격자 밖) 사이에만, 그리고 거기엔 반드시
        expect(top === 5, `${r},${c} 위`).toBe(!isRoom(r - 1, c));
        expect(right === 5, `${r},${c} 오른쪽`).toBe(!isRoom(r, c + 1));
        expect(bottom === 5, `${r},${c} 아래`).toBe(!isRoom(r + 1, c));
        expect(left === 5, `${r},${c} 왼쪽`).toBe(!isRoom(r, c - 1));
        wall += w.filter((x) => x === 5).length;
      }
    // 정사각 격자라면 외벽이 4n 이다. 실루엣이 파였으니 그보다 길어야 한다
    expect(wall).toBeGreaterThan(4 * n);
  });

  // `.board` 에 테두리가 남아 있으면 칸이 뭘 그리든 맨 바깥은 정사각형이다
  it('보드에는 사각 테두리도 바탕도 없다', () => {
    const rule = boardCss.replace(/\/\*[\s\S]*?\*\//g, '').match(/\.board\s*\{([^}]*)\}/)?.[1];
    expect(rule).toBeTruthy();
    expect(rule).not.toMatch(/\bborder(-[a-z]+)*\s*:/);
    expect(rule).not.toMatch(/\bbackground(-[a-z]+)*\s*:/);
    // 건물 바깥은 종이가 비쳐야 실루엣이 도형으로 읽힌다
    const outer = boardCss.match(/\.cell\.void\.outer\s*\{([^}]*)\}/)?.[1];
    expect(outer).toContain('--floor-tint: transparent');
  });

  it('안뜰은 테마 바닥·그림·이름표로 그려진다', () => {
    const { p, html } = withVoid('inner');
    const yard = p.theme.courtyard;
    expect(html).toContain(`class="cell void inner" data-floor="${yard.floor}"`);
    expect(html).toContain(`aria-label="${yard.label}"`);
    // 이름표는 방처럼 딱 한 번만. 방 이름과 헷갈리지 않게 `yard` 로 갈라 그린다
    expect((html.match(new RegExp(`room-label yard">${yard.label}`, 'g')) ?? []).length).toBe(1);
    expect(html).not.toContain(`room-label">${yard.label}`);
  });

  it('실루엣 밖에는 가구도 벽 부착물도 서지 않는다', () => {
    for (const want of ['outer', 'inner'] as const) {
      const { p } = withVoid(want);
      const idx = indexScene(p);
      for (const f of p.furniture)
        for (const c of f.cells) expect(idx.voidKind[c.r][c.c]).toBeNull();
      for (const w of p.wallItems) expect(idx.voidKind[w.cell.r][w.cell.c]).toBeNull();
    }
  });
});

// 증언이 `창문 앞` 처럼 이름을 불러서, 그림만 있고 이름이 없으면 문과 창문을
// 가려낼 수가 없다. 그리고 예전 10px 탭은 6×6 부터 눈에 안 띄었다
describe('벽 부착물', () => {
  const seeds = ['render-check', 'wall-1', 'wall-2', 'wall-3', 'wall-4'];
  const scenes = seeds.map((seed) => {
    const p = generatePuzzle(6, seed);
    return {
      p,
      html: renderToStaticMarkup(
        createElement(Board, { puzzle: p, marks: {}, onCell: () => {}, revealed: false }),
      ),
    };
  });

  it('전부 방향 클래스와 이름표를 달고 나온다', () => {
    for (const { p, html } of scenes) {
      expect(p.wallItems.length).toBeGreaterThan(0);
      for (const w of p.wallItems) {
        expect(['top', 'right', 'bottom', 'left']).toContain(w.side);
        expect(html).toContain(`class="wall-item ${w.side} ${w.kind}"`);
        expect(html).toContain(`<span class="wall-label">${w.label}</span>`);
      }
      expect((html.match(/class="wall-label"/g) ?? []).length).toBe(p.wallItems.length);
    }
  });

  // 둘 다 칸 모서리에 붙어서 넷 중 하나꼴로 같은 자리를 놓고 싸웠다
  it('방 이름표와 같은 칸에 겹치지 않는다', () => {
    for (const { p, html } of scenes) {
      const chunks = html.split('<button type="button"').slice(1);
      expect(chunks.length).toBeGreaterThan(0);
      for (const cell of chunks)
        expect(cell.includes('wall-item') && cell.includes('room-label')).toBe(false);
      // 방 이름표는 여전히 방마다 하나씩 다 나온다
      for (const room of p.rooms) expect(html).toContain(`class="room-label">${room.name}<`);
    }
  });

  // 바깥 모서리를 외벽 바깥선에 맞춘다. `Board.tsx` 가 외벽을 5px 로 그리는데
  // 절대배치 자식의 top/left 는 padding box 기준이라 -5px 가 정확히 그 바깥선이다
  it('바깥 모서리 오프셋이 Board 의 외벽 두께와 같다', () => {
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      const offsets = [
        ...wallCss.matchAll(new RegExp(`\\.wall-item\\.${side}\\s*\\{([^}]*)\\}`, 'g')),
      ]
        .map((m) => m[1].match(new RegExp(`(?:^|;)\\s*${side}:\\s*(-?\\d+)px`))?.[1])
        .filter((x) => x !== undefined);
      expect(offsets, side).toEqual(['-5']);
    }

    const { html } = scenes[0];
    const outer = [...html.matchAll(/border-width:([^;"]*)/g)]
      .flatMap((m) => m[1].split(' ').map((x) => parseInt(x, 10)))
      .filter((x) => x === 5);
    expect(outer.length).toBeGreaterThan(0);
  });

  it('board.css 다음에 인라인된다 (import 순서 = 캐스케이드 순서)', () => {
    expect(indexCss.indexOf('wall.css')).toBeGreaterThan(indexCss.indexOf('board.css'));
    expect(indexCss.indexOf('wall.css')).toBeLessThan(indexCss.indexOf('mobile.css'));
  });

  // 칸 <button> 위에 앉으므로 포인터를 먹으면 그 칸을 못 누른다
  it('포인터를 가로채지 않는다', () => {
    const block = wallCss.slice(wallCss.indexOf('.wall-item {'));
    expect(block.slice(0, block.indexOf('}'))).toContain('pointer-events: none');
  });
});
