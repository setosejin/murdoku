const assert = require('node:assert/strict');
const { webkit, chromium } = require('playwright');
const { newPage, openCase, people, accuse, markTwo, closed, menu } = require('./ux-smoke.cjs');

const url = process.env.UX_URL || 'http://127.0.0.1:5219';

async function race(browser, mobile, fails) {
  const entry = await newPage(browser, mobile ? 375 : 1280, mobile ? 667 : 800);
  const { page, context } = entry;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const pending = [];
  try {
    const enabled = await page.evaluate(async () => (await import('/src/game/auth.ts')).syncEnabled());
    assert.ok(enabled, 'VITE_SYNC_URL=/__ux-sync 로 개발 서버를 실행해야 한다');
    await page.route('**/__ux-sync/**', async (route) => {
      if (new URL(route.request().url()).pathname.includes('/lb/')) {
        await route.fulfill({ json: { top: [], rank: null } });
        return;
      }
      const data = route.request().postDataJSON();
      if (data.length === 0) {
        const response = gate.then(() => route.fulfill(
          fails ? { status: 503, body: '일시 중단' } : { json: [] },
        ));
        pending.push(response);
        await response;
      } else {
        await route.fulfill({ json: data });
      }
    });
    await page.evaluate(() => {
      localStorage.setItem('murdoku.history', '[]');
      localStorage.removeItem('murdoku.current');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openCase(page, mobile, 4, 'ux-sync-replay');
    assert.ok(pending.length > 0, '시작 동기화를 실제로 대기시켜야 한다');
    const { correct } = await people(page);
    if (mobile) await page.locator('.mbar').getByRole('button', { name: '지목하기' }).click();
    const solvedSync = page.waitForResponse((r) =>
      r.url().includes('/__ux-sync/h/') && r.request().postDataJSON()?.length === 1);
    await accuse(page, correct);
    await solvedSync;
    assert.equal(await page.locator('.myscore strong').textContent(), '150점');
    release();
    await Promise.all(pending);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.equal(await page.locator('.myscore strong').textContent(), '150점', '늦은 시작 응답이 해결 기록을 지우면 안 된다');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('murdoku.history')).length), 1);
    if (mobile) { await page.locator('.sheet[open] .sheet-x').click(); await closed(page); }
    await openCase(page, mobile, 4, 'ux-sync-replay');
    if (mobile) await page.locator('.mbar').getByRole('button', { name: '지목하기' }).click();
    await accuse(page, correct);
    assert.equal(await page.locator('.earned').textContent(), '추가 점수 없음');
    assert.equal(await page.locator('.myscore strong').textContent(), '150점');
    assert.deepEqual(entry.errors, []);
  } finally {
    release();
    await Promise.allSettled(pending);
    await context.close();
  }
}

async function legacy(browser, mobile) {
  const { page, context, errors } = await newPage(browser, mobile ? 375 : 1280, mobile ? 667 : 800);
  try {
    await page.route('**/__ux-sync/**', (r) => r.fulfill({
      json: r.request().url().includes('/lb/') ? { top: [], rank: null } : r.request().postDataJSON(),
    }));
    await page.evaluate(() => {
      localStorage.removeItem('murdoku.current');
      localStorage.setItem('murdoku.history', JSON.stringify([
        { n: 4, seed: 'ux-legacy', at: 1, tries: 1, ok: false, title: '예전 정답 확인 기록' },
      ]));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await openCase(page, mobile, 4, 'ux-legacy');
    const { correct } = await people(page);
    if (mobile) await page.locator('.mbar').getByRole('button', { name: '지목하기' }).click();
    await accuse(page, correct);
    assert.equal(await page.locator('.myscore strong').textContent(), '0점');
    assert.equal(await page.locator('.earned').textContent(), '추가 점수 없음');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}

async function trimmedHistory(browser, mobile) {
  const { page, context, errors } = await newPage(browser, mobile ? 375 : 1280, mobile ? 667 : 800);
  try {
    await page.route('**/__ux-sync/**', (r) => r.fulfill({
      json: r.request().url().includes('/lb/') ? { top: [], rank: null } : r.request().postDataJSON(),
    }));
    await page.evaluate(() => {
      localStorage.removeItem('murdoku.current');
      localStorage.setItem('murdoku.history', JSON.stringify([
        { n: 7, seed: 'old-replay', at: 1, tries: 5, ok: true, title: '옛 사건' },
        { n: 7, seed: 'old-replay', at: 2, tries: 1, ok: true, title: '옛 사건 재플레이' },
        ...Array.from({ length: 198 }, (_, i) => ({
          n: 4, seed: `past-${i}`, at: i + 3, tries: 1, ok: true, title: `지난 사건 ${i}`,
        })),
      ]));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await openCase(page, mobile, 4, 'ux-history-limit');
    const { correct } = await people(page);
    if (mobile) await page.locator('.mbar').getByRole('button', { name: '지목하기' }).click();
    await accuse(page, correct);
    assert.equal(await page.locator('.earned').textContent(), '+150점', '다른 사건의 기록 잘림을 이번 점수에 넣지 않는다');
    assert.equal(await page.locator('.save-notice').count(), 0);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.earned').textContent(), '+150점');
    assert.equal(await page.locator('.verdict.ok').count(), 1);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}

async function unavailableStorage(browser) {
  const { page, context, errors } = await newPage(browser, 375, 667);
  try {
    await page.route('**/__ux-sync/**', (r) => r.fulfill({
      json: r.request().url().includes('/lb/') ? { top: [], rank: null } : r.request().postDataJSON(),
    }));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() { throw new DOMException('저장 공간 접근 불가', 'SecurityError'); },
      });
    });
    await page.reload({ waitUntil: 'networkidle' });
    const help = page.getByRole('dialog', { name: '게임 방법', exact: true });
    await help.waitFor();
    await help.getByRole('button', { name: '닫기', exact: true }).click();
    await closed(page);
    await markTwo(page, true);
    const seed = await page.locator('.seedbox code').textContent();
    for (const inMenu of [false, true]) {
      if (inMenu) await menu(page, true);
      await page.locator(inMenu ? '.sheet[open] > .sheet-head .privacy-toggle' : '.mtop .privacy-toggle').click();
      await page.getByRole('button', { name: '계속하기' }).click();
      await page.waitForFunction(() => !document.querySelector('.privacy-screen[open]'));
      assert.equal(await help.isVisible(), false, '이미 닫은 첫 안내를 가림 복귀 때 다시 열면 안 된다');
      assert.equal(await page.locator('.sheet[open]').count(), inMenu ? 1 : 0);
      if (inMenu) assert.equal(await page.locator('.sheet[open]').getAttribute('aria-label'), '메뉴');
      assert.equal(await page.locator('.seedbox code').textContent(), seed);
      assert.equal(await page.locator('.board .token:not(.solved)').count(), 2);
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}

(async () => {
  assert.ok(process.env.UX_URL, `UX_URL=${url} 를 지정한다`);
  const selected = process.argv[2] || 'all';
  assert.ok(['all', 'race', 'legacy', 'storage', 'trim'].includes(selected));
  for (const [name, type] of [['webkit', webkit], ['chromium', chromium]]) {
    const browser = await type.launch();
    try {
      for (const mobile of [false, true]) {
        if (selected === 'all' || selected === 'race')
          for (const fails of [true, false]) await race(browser, mobile, fails);
        if (selected === 'all' || selected === 'legacy') await legacy(browser, mobile);
        if (selected === 'all' || selected === 'trim') await trimmedHistory(browser, mobile);
      }
      if (selected === 'all' || selected === 'storage') await unavailableStorage(browser);
      console.log(`${name}: ${selected} 회귀 검사 통과`);
    } finally { await browser.close(); }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
