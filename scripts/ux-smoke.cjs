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
    if (sessionStorage.getItem('ux-initialized')) return;
    localStorage.setItem('murdoku.tour', '1');
    localStorage.setItem('murdoku.brief', '1');
    sessionStorage.setItem('ux-initialized', '1');
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
  async accessibility({ page, mobile }) {
    await openCase(page, mobile, 4, 'ux-accessibility');
    const clues = page.locator(mobile ? '.mshell > .clue-list .clue-row' : '.dclues .clue-row');
    const descriptions = await clues.evaluateAll((rows) => rows.map((row) => ({
      described: document.getElementById(row.getAttribute('aria-describedby'))?.textContent,
      shown: row.querySelector('.clue-text').textContent,
    })));
    for (const text of descriptions) assert.equal(text.described, text.shown);
    const first = clues.first();
    await first.focus();
    await page.keyboard.press('Enter');
    assert.equal(await first.getAttribute('aria-pressed'), 'true');
    const cell = page.locator('.board button.cell:not(.blocked)').first();
    await cell.focus();
    await page.keyboard.press('Enter');
    assert.match(await cell.getAttribute('aria-label'), /메모/);
    assert.equal(await page.locator('.cell[aria-label*="(범인)"]').count(), 0);
    assert.equal(await page.locator('.cell[aria-label*="(피해자)"]').count(), 0);
    if (mobile) await page.locator('.mbar').getByRole('button', { name: '지목하기' }).click();
    await page.locator('.accuse').getByRole('button', { name: '정답 보기 (이 사건 포기)' }).click();
    assert.match(await page.locator('.cell:has(.token.culprit)').getAttribute('aria-label'), /\(범인\)/);
    assert.match(await page.locator('.cell:has(.token.dead)').getAttribute('aria-label'), /\(피해자\)/);
    await page.locator('.accuse').getByRole('button', { name: '정답 숨기기' }).click();
    assert.equal(await page.locator('.cell[aria-label*="(범인)"]').count(), 0);
    assert.match(await cell.getAttribute('aria-label'), /메모/);
  },
  async privacy({ page, mobile }) {
    await openCase(page, mobile, 4, 'ux-privacy');
    await markTwo(page, mobile);
    const cover = page.getByRole('dialog', { name: '화면 가림', exact: true });
    const check = async (trigger) => {
      const before = await snapshot(page);
      const opener = await trigger.elementHandle();
      await trigger.click();
      await cover.waitFor({ state: 'visible' });
      assert.equal(await cover.getByRole('button').count(), 1);
      assert.equal(await cover.evaluate((el) => el.contains(document.activeElement)), true);
      assert.match(await cover.evaluate((el) => getComputedStyle(el, '::backdrop').backdropFilter ||
        getComputedStyle(el, '::backdrop').webkitBackdropFilter), /blur/);
      await page.mouse.click(2, 2);
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.closest('.board, .mtop, .controls') !== null), false);
      assert.equal(await cover.isVisible(), true);
      assert.deepEqual(await snapshot(page), before);
      await cover.getByRole('button', { name: '계속하기' }).click();
      await page.waitForFunction(() => !document.querySelector('.privacy-screen[open]'));
      assert.deepEqual(await snapshot(page), before);
      if (await opener.evaluate((el) => el.isConnected))
        assert.equal(await opener.evaluate((el) => el === document.activeElement), true);
    };
    const rootTrigger = page.locator(mobile ? '.mtop' : '.controls')
      .getByRole('button', { name: '화면 가리기', exact: true });
    assert.equal(await rootTrigger.count(), 1);
    await check(rootTrigger);
    const buttons = mobile ? ['.mtitle', '.mhelp', '.mtop > button[aria-label^="메뉴"]', '.mbar .primary']
      : ['.dcase', '.dhelp', '.controls > button[aria-label^="더보기"]'];
    for (const selector of buttons) {
      await page.locator(selector).click();
      const sheet = page.locator('.sheet[open]');
      await check(sheet.getByRole('button', { name: '화면 가리기', exact: true }));
      await sheet.getByRole('button', { name: '닫기', exact: true }).click();
      await closed(page);
    }
    await menu(page, mobile);
    await page.getByRole('button', { name: '피드백', exact: true }).click();
    const feedback = page.locator('.feedback:not(.changelog)[open]');
    await feedback.locator('input').fill('가린 뒤에도 남는 입력');
    await check(feedback.getByRole('button', { name: '화면 가리기', exact: true }));
    assert.equal(await feedback.locator('input').inputValue(), '가린 뒤에도 남는 입력');
    await feedback.getByRole('button', { name: '취소', exact: true }).click();
    await page.locator('.sheet[open] .sheet-x').click();
    await closed(page);
    if (mobile) await menu(page, true);
    await page.locator('button.ver').click();
    const log = page.locator('.changelog[open]');
    await check(log.getByRole('button', { name: '화면 가리기', exact: true }));
    await log.getByRole('button', { name: '닫기', exact: true }).click();
    if (mobile) { await page.locator('.sheet[open] .sheet-x').click(); await closed(page); }
    if (!mobile) {
      await page.locator('.dhelp').click();
      await page.getByRole('button', { name: '화면 안내 다시 보기' }).click();
      await page.locator('.tour[open]').waitFor();
      await check(page.locator('.tour').getByRole('button', { name: '화면 가리기', exact: true }));
      assert.equal(await page.locator('.tour-card b').textContent(), '평면도');
      await page.getByRole('button', { name: '그만 보기' }).click();
    }
    const guestSeed = await page.evaluate(async () => {
      const { generatePuzzle } = await import('/src/game/generate.ts');
      const { indexScene } = await import('/src/game/clues.ts');
      for (let i = 0; i < 40; i++) {
        const seed = `ux-guest-${i}`;
        if (indexScene(generatePuzzle(6, seed)).voidKind.some((row) => row.includes('outer'))) return seed;
      }
      throw new Error('바깥 손님이 있는 검사 사건을 찾지 못했다');
    });
    page.once('dialog', (d) => d.accept());
    await openCase(page, mobile, 6, guestSeed);
    await markTwo(page, mobile);
    await page.locator('.outer-pet').first().click({ button: 'right' });
    await check(page.locator('.petmenu[open]').getByRole('button', { name: '화면 가리기', exact: true }));
    const before = await snapshot(page);
    await page.evaluate(() => localStorage.removeItem('murdoku.brief'));
    await rootTrigger.click();
    await page.setViewportSize(mobile ? { width: 1280, height: 800 } : { width: 375, height: 667 });
    assert.equal(await cover.isVisible(), true);
    assert.equal(await page.locator('.sheet[open], .tour[open]').count(), 0);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.privacy-screen[open]'));
    assert.deepEqual(await snapshot(page), before);
    if (!mobile) {
      const help = page.getByRole('dialog', { name: '게임 방법', exact: true });
      await help.waitFor();
      await help.getByRole('button', { name: '닫기', exact: true }).click();
      await closed(page);
    }
    // @supports 블록을 무시하는 브라우저도 불투명한 배경으로 내용을 가려야 한다.
    const removed = await page.evaluate(() => {
      let count = 0;
      for (const sheet of document.styleSheets) {
        for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
          const rule = sheet.cssRules[i];
          if (rule.conditionText?.includes('backdrop-filter')) { sheet.deleteRule(i); count++; }
        }
      }
      return count;
    });
    assert.ok(removed > 0);
    await page.locator('.mtop .privacy-toggle, .controls .privacy-toggle').click();
    assert.match(await cover.evaluate((el) => getComputedStyle(el, '::backdrop').backgroundColor), /^rgb\(/);
    await cover.getByRole('button', { name: '계속하기' }).click();
  },
  async resume({ page, mobile }) {
    await openCase(page, mobile, 7, 'ux-resume-check');
    await markTwo(page, mobile);
    let before = await snapshot(page);
    await page.reload({ waitUntil: 'networkidle' });
    assert.deepEqual(await snapshot(page), before);
    page.once('dialog', (d) => d.accept());
    await openCase(page, mobile, 4, 'ux-resume-attempt');
    const ids = await people(page);
    if (mobile) await page.locator('.mbar').getByRole('button', { name: '지목하기' }).click();
    await accuse(page, ids.wrong);
    before = await snapshot(page);
    await page.reload({ waitUntil: 'networkidle' });
    assert.deepEqual(await snapshot(page), before);
    if (mobile) await page.locator('.mbar').getByRole('button', { name: '지목하기' }).click();
    await accuse(page, ids.correct);
    assert.equal((await snapshot(page)).earned, '+120점');
    before = await snapshot(page);
    await page.reload({ waitUntil: 'networkidle' });
    assert.deepEqual(await snapshot(page), before);
    await openCase(page, mobile, 4, 'ux-resume-peek');
    if (mobile) await page.locator('.mbar').getByRole('button', { name: '지목하기' }).click();
    await page.locator('.accuse').getByRole('button', { name: '정답 보기 (이 사건 포기)' }).click();
    await page.reload({ waitUntil: 'networkidle' });
    if (mobile) await page.locator('.mbar').getByRole('button', { name: '지목하기' }).click();
    assert.equal(await page.locator('.accuse').getByRole('button', { name: '지목하기', exact: true }).count(), 0);
    if (mobile) { await page.locator('.sheet[open] .sheet-x').click(); await closed(page); }
    await page.evaluate(() => localStorage.setItem('murdoku.current', '{'));
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.save-notice').count(), 1);
    assert.match(await page.locator('.save-notice').textContent(), /읽지 못했어/);
    await page.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'murdoku.current') throw new DOMException('저장 불가', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await page.reload({ waitUntil: 'networkidle' });
    assert.match(await page.locator('.save-notice').textContent(), /저장할 수 없어/);
    await markTwo(page, mobile);
    assert.equal((await snapshot(page)).marks.length, 2);
  },
  async help({ page, mobile }) {
    const trigger = page.getByRole('button', { name: '게임 방법', exact: true });
    assert.equal(await trigger.count(), 1);
    const before = await snapshot(page);
    await trigger.click();
    const help = page.getByRole('dialog', { name: '게임 방법', exact: true });
    await help.waitFor({ state: 'visible' });
    assert.equal(await help.locator('.rules').count(), 1);
    assert.equal(await help.locator('.legend').count(), 1);
    const visible = await help.evaluate((d) => {
      const steps = d.querySelector('.help-steps').getBoundingClientRect();
      const body = d.querySelector('.sheet-body').getBoundingClientRect();
      return steps.top >= body.top && steps.bottom <= body.bottom;
    });
    assert.equal(visible, true, '첫 화면에 조작 안내가 보여야 한다');
    if (mobile) {
      await help.getByRole('button', { name: '닫기', exact: true }).click();
      await closed(page);
      assert.deepEqual(await snapshot(page), before);
      await page.evaluate(() => localStorage.removeItem('murdoku.brief'));
      await page.reload({ waitUntil: 'networkidle' });
      await help.waitFor({ state: 'visible' });
      await help.getByRole('button', { name: '닫기', exact: true }).click();
      await closed(page);
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('.sheet[open]').count(), 0);
    } else {
      await help.getByRole('button', { name: '화면 안내 다시 보기' }).click();
      await page.locator('.tour[open]').waitFor();
      assert.equal(await page.locator('.tour-card b').textContent(), '평면도');
      assert.equal(await page.locator('.sheet[open]').count(), 0);
      await page.getByRole('button', { name: '그만 보기' }).click();
      assert.deepEqual(await snapshot(page), before);
    }
  },
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
