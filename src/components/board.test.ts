import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DIFFICULTIES, generatePuzzle } from '../game/generate';
import { indexScene } from '../game/clues';
import Board from './Board';
import boardCss from '../styles/board.css?raw';

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

  /* 이름표는 z-index 4 라 같은 칸의 무엇이든 덮는다. 증언이 가구·부착물을 이름으로
     부르니 그 이름이 덮이면 사건이 안 풀린다. 가구 이름은 늘 제 발치(발자국의 아래쪽
     줄)에 깔리므로, 아래가 찬 칸에 붙은 이름표는 위로 올라가 있어야 한다.

     발자국은 마크업으로 볼 수 없다 — 여러 칸짜리 가구는 첫 칸에서 한 번만 그려지고
     이름은 마지막 칸에 떨어진다. 그래서 자리는 퍼즐 데이터에서 직접 센다 */
  it('방 이름표가 가구·부착물 이름을 덮지 않는다', () => {
    for (const { n } of DIFFICULTIES)
      for (let i = 0; i < 8; i++) {
        const p = generatePuzzle(n, `label-${n}-${i}`);
        const html = renderToStaticMarkup(
          createElement(Board, { puzzle: p, marks: {}, onCell: () => {}, revealed: false }),
        );

        const takenBelow = new Set<string>();
        for (const f of p.furniture) {
          const foot = Math.max(...f.cells.map((c) => c.r));
          for (const c of f.cells) if (c.r === foot) takenBelow.add(`${c.r},${c.c}`);
        }
        for (const w of p.wallItems)
          if (w.side === 'bottom') takenBelow.add(`${w.cell.r},${w.cell.c}`);

        // 칸은 행 우선으로 그려진다 — 순서가 곧 좌표다
        const cells = html.split(/(?=<(?:button|div) [^>]*class="cell)/).slice(1);
        expect(cells.length).toBe(n * n);

        cells.forEach((cell, at) => {
          const chip = /class="room-label( high)?"/.exec(cell);
          if (!chip) return;
          const low = !chip[1];
          const key = `${Math.floor(at / n)},${at % n}`;
          expect(
            low && takenBelow.has(key),
            `${n}x${n} ${i}번 시드 ${key}: 아래가 찬 칸에 이름표가 낮게 붙었다`,
          ).toBe(false);
        });

        // 방마다 이름표는 정확히 하나 — 자리를 고르다 잃거나 겹쳐 붙이면 안 된다
        const chips = html.match(/class="room-label(?: high)?">([^<]+)/g) ?? [];
        expect(chips.length, `${n}x${n} ${i}번 시드`).toBe(p.rooms.length);
      }
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
