import { chromium } from 'playwright';

// SC v4.5: responsive fill (desktop) · modes play differently (career ladder, survival scale+wear, training dummy) · grouped menu.
const SC = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/SC/index.html';
const checks = [];
function check(n, p, d = '') { checks.push({ n, p }); console.log(`  ${p ? '✅' : '❌'} ${n}${d ? ' · ' + d : ''}`); return p; }

const browser = await chromium.launch();

async function withPage(viewport, fn) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  await fn(page);
  await ctx.close();
}

const errs = [];
try {
  // ===== DESKTOP responsive: big ring fills the screen + grouped menu =====
  await withPage({ width: 1400, height: 880 }, async (page) => {
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(SC, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(400);
    await page.evaluate(() => { save.tutorialSeen = true; persistSave(); goto('hub'); });
    await page.waitForTimeout(150);
    const groups = await page.evaluate(() => document.querySelectorAll('.hub-grp-label').length);
    check('main menu is grouped into sections', groups >= 3, groups + ' groups');
    await page.evaluate(() => goto('roster')); await page.waitForTimeout(200);
    const cols = await page.evaluate(() => { const g = document.querySelector('.roster-grid'); return getComputedStyle(g).gridTemplateColumns.split(' ').length; });
    check('roster fills width with more columns on desktop', cols >= 4, cols + ' columns');
    await page.locator('.roster-card').first().click(); await page.waitForTimeout(200);
    await page.locator('#detail button.btn', { hasText: /FIGHT WITH THIS ONE/i }).first().click();
    await page.waitForTimeout(1700);
    const ringW = await page.evaluate(() => document.getElementById('ring').clientWidth);
    check('ring is big/immersive on desktop', ringW >= 760, ringW + 'px wide');
  });

  // ===== MODES play differently =====
  await withPage({ width: 412, height: 915 }, async (page) => {
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(SC, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(400);
    const modes = await page.evaluate(() => {
      const f = FIGHTERS.find(x => x.id === 'aaron'), o = FIGHTERS.find(x => x.id === 'luke');
      function mk(mode, ctx) { Object.assign(modeCtx, { streak: 0, rung: 0, idx: 0 }, ctx); const m = { player: f, opponent: o, mode, oAb: getAbilities(o), pHP: 100 }; applyModeRules(m); return m; }
      const baseG = getAbilities(o).grappling;
      const surv = mk('survival', { streak: 3 });
      const car = mk('career', { rung: 4 });
      const tr = mk('training', {});
      const q = mk('quick', {});
      return {
        survBoost: surv.oAb.grappling - baseG, survWorn: surv.pHP,
        carBoost: car.oAb.grappling - baseG,
        trainDummy: tr.oPassive === true, quickNormal: q.oPassive === false && (q.oAb.grappling - baseG) === 0
      };
    });
    check('SURVIVAL scales the opponent up', modes.survBoost >= 14, '+' + modes.survBoost + ' grappling');
    check('SURVIVAL wears the player down', modes.survWorn < 100, 'start HP ' + modes.survWorn);
    check('CAREER ladder scales by rung', modes.carBoost >= 12, '+' + modes.carBoost);
    check('TRAINING is a passive dummy', modes.trainDummy === true);
    check('QUICK stays standard (no scaling, active foe)', modes.quickNormal === true);
    // career builds a ladder queue when you pick a fighter
    const ladder = await page.evaluate(() => { gameMode = 'career'; modeCtx.pickingOpponent = false; const before = JSON.stringify(modeCtx.queue); beginMode('aaron'); return { len: modeCtx.queue.length, rung: modeCtx.rung }; });
    check('CAREER builds a ranked ladder queue', ladder.len >= 8 && ladder.rung === 0, ladder.len + ' rungs');
  });

  check('zero page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.5 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
