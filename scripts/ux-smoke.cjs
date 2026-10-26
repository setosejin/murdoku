const assert = require('node:assert/strict');
const fs = require('node:fs');
const { webkit, chromium } = require('playwright');

const url = process.env.UX_URL || 'http://127.0.0.1:5173';
const baselinePath = process.env.UX_BASELINE || '/tmp/murdoku-ux-baseline.json';
const selected = process.argv[2] || 'all';
const screens = [[360, 560], [375, 667], [393, 852], [844, 390], [900, 700], [1280, 800]];

async function newPage(browser, width = 1280, height = 800, fresh = false) {
  const mobile = width <= 760 || height <= 540;
  const context = await browser.newContext({
    viewport: { width, height }, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce',
  });
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort());
  if (!fresh) await context.addInitScript(() => {
    localStorage.setItem('murdoku.tour', '1');
    localStorage.setItem('murdoku.brief', '1');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  return { page, context, mobile, errors };
}

const closed = (page) => page.waitForFunction(() => !document.querySelector('.sheet[open]'));
const menu = (page, mobile) => page.locator(mobile
  ? '.mtop > button[aria-label^="메뉴"]'
  : '.controls > button[aria-label^="더보기"]').click();

async function openCase(page, mobile, n, seed) {
  if (mobile) await menu(page, true);
  const pick = page.getByRole('button', { name: new RegExp(`\\(${n}×${n}\\)`) });
  if (await pick.getAttribute('aria-pressed') !== 'true') {
    await pick.click();
    if (mobile) { await closed(page); await menu(page, true); }
  }
  if (!mobile) await menu(page, false);
  await page.getByRole('textbox', { name: '시드 입력' }).fill(seed);
  await page.locator('.sheet[open] .seedbox button').click();
  await closed(page);
}

async function snapshot(page) {
  return page.evaluate(() => ({
    seed: document.querySelector('.seedbox code').textContent,
    n: document.querySelector('.seg-btn.on').textContent,
    marks: [...document.querySelectorAll('.cell:has(.token:not(.solved), .mark-x)')]
      .map((el) => el.getAttribute('aria-label')),
    verdict: document.querySelector('.verdict')?.textContent ?? null,
    earned: document.querySelector('.earned')?.textContent ?? null,
    total: document.querySelector('.myscore strong').textContent,
    history: localStorage.getItem('murdoku.history'),
    current: localStorage.getItem('murdoku.current'),
  }));
}

async function people(page) {
  return page.evaluate(async () => {
    const { generatePuzzle } = await import('/src/game/generate.ts');
    const n = Number(document.querySelector('.seg-btn.on').textContent[0]);
    const seed = document.querySelector('.seedbox code').textContent;
    const puzzle = generatePuzzle(n, seed);
    const suspects = puzzle.people.filter((p) => !p.isVictim);
    return {
      correct: suspects.findIndex((p) => p.id === puzzle.culpritId),
      wrong: suspects.findIndex((p) => p.id !== puzzle.culpritId),
    };
  });
}

async function accuse(page, at) {
  await page.locator('.accuse .clue-row').nth(at).click();
  await page.locator('.accuse').getByRole('button', { name: '지목하기', exact: true }).click();
}

async function markTwo(page, mobile) {
  await page.locator(mobile ? '.mshell > .clue-list .clue-row' : '.dclues .clue-row').first().click();
  const cells = page.locator('.board button.cell:not(.blocked)');
  await cells.nth(0).click();
  await cells.nth(1).click();
}

async function measure(page) {
  return page.evaluate(() => {
    const board = document.querySelector('.board');
    const host = document.querySelector('.mplay, .pboard');
    const doc = document.scrollingElement;
    return {
      board: board.getBoundingClientRect().toJSON(), host: host.getBoundingClientRect().toJSON(),
      overflow: [board.scrollWidth - board.clientWidth, doc.scrollWidth - doc.clientWidth,
        doc.scrollHeight - doc.clientHeight],
    };
  });
}

const scenarios = {
  async transitions({ page, mobile }) {
    await page.evaluate(() => localStorage.setItem('murdoku.history', JSON.stringify([
      { seed: 'ux-past', n: 4, at: 1, ok: true, tries: 1, title: '다시 열 사건' },
    ])));
    await page.reload({ waitUntil: 'networkidle' });
    await openCase(page, mobile, 4, 'ux-transitions');
    await markTwo(page, mobile);
    const before = await snapshot(page);
    if (mobile) await menu(page, true);
    await page.getByRole('button', { name: '쉬움 (4×4)', exact: true }).click();
    assert.deepEqual(await snapshot(page), before);
    const reject = async (action) => {
      let asked = false;
      page.once('dialog', async (d) => { asked = true; await d.dismiss(); });
      await action();
      assert.equal(asked, true, '진행을 버리기 전에 확인해야 한다');
      assert.deepEqual(await snapshot(page), before);
    };
    await reject(() => page.getByRole('button', { name: '새 사건', exact: true }).click());
    await reject(() => page.getByRole('button', { name: '보통 (5×5)', exact: true }).click());
    await reject(() => page.getByRole('button', { name: '메모 지우기', exact: true }).click());
    if (!mobile) await menu(page, false);
    await page.getByRole('textbox', { name: '시드 입력' }).fill('ux-cancelled');
    await reject(() => page.locator('.sheet[open] .seedbox button').click());
    assert.equal(await page.getByRole('textbox', { name: '시드 입력' }).inputValue(), 'ux-cancelled');
    await reject(() => page.locator('.sheet[open] .history li button').first().click());
    assert.equal(await page.locator('.sheet[open]').count(), 1);
    page.once('dialog', (d) => d.accept());
    await page.locator('.sheet[open] .seedbox button').click();
    await closed(page);
    assert.equal((await snapshot(page)).seed, 'ux-cancelled');
    assert.equal((await snapshot(page)).marks.length, 0);
    // 빈 새 판에서는 별도 확인 없이 다른 사건으로 넘어간다.
    let asked = false;
    page.once('dialog', async (d) => { asked = true; await d.dismiss(); });
    if (mobile) await menu(page, true);
    await page.getByRole('button', { name: '새 사건', exact: true }).click();
    if (mobile) await closed(page);
    assert.equal(asked, false);
    assert.notEqual((await snapshot(page)).seed, 'ux-cancelled');
  },
  async lifecycle({ page, mobile }) {
    await openCase(page, mobile, 4, 'ux-finish-check');
    const { correct, wrong } = await people(page);
    if (mobile) await page.locator('.mbar').getByRole('button', { name: '지목하기' }).click();
    await accuse(page, correct);
    const solved = await snapshot(page);
    assert.equal(solved.earned, '+150점');
    assert.equal(await page.locator('.accuse').getByRole('button', { name: '지목하기', exact: true }).count(), 0);
    assert.equal(await page.locator('.accuse').getByRole('button', { name: '다음 사건' }).count(), 1);
    assert.equal(await page.locator('.accuse .clue-row').nth(wrong).isDisabled(), true);
    // 지목의 두 번째 클릭이 바뀐 다음 사건 버튼을 누르면 안 된다.
    await page.locator('.accuse').getByRole('button', { name: '다음 사건' })
      .dispatchEvent('click', { detail: 2 });
    assert.deepEqual(await snapshot(page), solved);
    if (mobile) { await page.locator('.sheet[open] .sheet-x').click(); await closed(page); }
    await page.locator('.board button.cell:not(.blocked)').first().click();
    assert.deepEqual(await snapshot(page), solved);
    await menu(page, mobile);
    await page.locator('.sheet[open] .history li button').first().click();
    await closed(page);
    if (mobile) await page.locator('.mbar').getByRole('button', { name: '지목하기' }).click();
    await accuse(page, correct);
    assert.equal((await snapshot(page)).total, '150점');
    assert.equal((await snapshot(page)).earned, '추가 점수 없음');
    await page.locator('.accuse').getByRole('button', { name: '다음 사건' }).click();
    if (mobile) await closed(page);
    if (mobile) await page.locator('.mbar').getByRole('button', { name: '지목하기' }).click();
    await page.locator('.accuse').getByRole('button', { name: '정답 보기 (이 사건 포기)' }).click();
    await page.locator('.accuse').getByRole('button', { name: '정답 숨기기' }).click();
    assert.equal(await page.locator('.accuse').getByRole('button', { name: '지목하기', exact: true }).count(), 0);
  },
};

async function layout(browser, engine, baseline) {
  const rows = [];
  for (const [width, height] of screens) {
    const { page, context, mobile, errors } = await newPage(browser, width, height);
    try {
      for (const n of [4, 6, 7, 4]) {
        await openCase(page, mobile, n, 'ux-audit-20261021');
        const value = await measure(page);
        const key = `${engine}:${width}:${height}:${n}`;
        rows.push({ key, ...value });
        assert.ok(value.overflow.every((v) => v <= 1), `${key}: 화면 넘침`);
        assert.ok(value.board.left >= value.host.left - 1 && value.board.right <= value.host.right + 1, key);
        if (baseline) {
          const before = baseline.find((row) => row.key === key);
          assert.ok(before, `${key}: 기준 측정 없음`);
          assert.ok(value.board.width >= before.board.width - 1, `${key}: 보드 폭 감소`);
          assert.ok(value.board.height >= before.board.height - 1, `${key}: 보드 높이 감소`);
        }
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  return rows;
}

(async () => {
  assert.ok(['baseline', 'layout', 'all', ...Object.keys(scenarios)].includes(selected), '알 수 없는 검사');
  const captured = [];
  for (const [engine, type] of [['webkit', webkit], ['chromium', chromium]]) {
    const browser = await type.launch();
    try {
      if (['baseline', 'layout', 'all'].includes(selected)) {
        const baseline = selected === 'baseline' ? null : JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
        captured.push(...await layout(browser, engine, baseline));
        console.log(`${engine}: layout 통과`);
      }
      for (const [name, run] of Object.entries(scenarios)) {
        if (selected !== 'all' && selected !== name) continue;
        for (const [width, height] of [[1280, 800], [375, 667]]) {
          const entry = await newPage(browser, width, height);
          try {
            await run(entry);
            assert.deepEqual(entry.errors, []);
            console.log(`${engine}: ${name} ${width}×${height} 통과`);
          } finally { await entry.context.close(); }
        }
      }
    } finally { await browser.close(); }
  }
  if (selected === 'baseline') fs.writeFileSync(baselinePath, JSON.stringify(captured, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
