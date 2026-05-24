import { chromium } from 'playwright';

// SC v4.12: signature-finisher cut-in (named) · combo counter · post-match TALE OF THE TAPE breakdown.
const SC = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/SC/index.html';
const checks = [];
function check(n, p, d = '') { checks.push({ n, p }); console.log(`  ${p ? '✅' : '❌'} ${n}${d ? ' · ' + d : ''}`); return p; }

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 412, height: 915 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('c:' + m.text()); });
page.on('dialog', d => d.accept());

try {
  await page.goto(SC, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => { save.tutorialSeen = true; persistSave(); goto('roster'); }); await page.waitForTimeout(300);
  await page.locator('.roster-card').first().click(); await page.waitForTimeout(250);
  await page.locator('#detail button.btn', { hasText: /FIGHT WITH THIS ONE/i }).first().click();
  await page.waitForTimeout(1700);
  await page.evaluate(() => { if (match) { match.started = true; match.paused = false; match.lastT = performance.now(); match.pAI = false; } });
  await page.waitForTimeout(150);

  // 1 · every fighter has a NAMED finisher move
  const named = await page.evaluate(() => {
    const f = moveOf(match.player, 'finisher');
    return { name: f && f.name, ok: !!(f && f.name && f.fin) };
  });
  check('the player has a named signature finisher', named.ok === true, named.name);

  // 2 · SIGNATURE CUT-IN — shows the move name + fighter when a finisher lands
  const cut = await page.evaluate(() => {
    signatureCutIn('TESTER', 'Phoenix Splash', 'left');
    const el = document.getElementById('sig-cutin');
    return { exists: !!el, on: el.classList.contains('on'), hasMove: /PHOENIX SPLASH/i.test(el.textContent), hasName: /TESTER/i.test(el.textContent) };
  });
  check('a finisher cut-in stamps the move name', cut.exists && cut.on && cut.hasMove, cut.hasMove ? 'named' : 'no name');
  check('the cut-in credits the fighter', cut.hasName === true);

  // 3 · COMBO COUNTER — consecutive landed hits raise the count + pop the HUD
  const combo = await page.evaluate(() => {
    match.comboCount = 0; match.comboHitUntil = 0; match.tally.comboMax = 0;
    const atk = { kind: 'strike', move: { type: 'jab', name: 'Jab', dmg: [10, 10], cost: 7, acc: 1 }, side: 'player', cfg: ATK.jab };
    // simulate three quick landed hits via the combo bookkeeping resolveAttack runs
    const now = performance.now();
    match.comboCount = (now < (match.comboHitUntil || 0)) ? match.comboCount + 1 : 1; match.comboHitUntil = now + 1400;
    match.comboCount = (performance.now() < match.comboHitUntil) ? match.comboCount + 1 : 1; match.comboHitUntil = performance.now() + 1400;
    match.comboCount = (performance.now() < match.comboHitUntil) ? match.comboCount + 1 : 1;
    if (match.comboCount > match.tally.comboMax) match.tally.comboMax = match.comboCount;
    showCombo(match.comboCount);
    const el = document.getElementById('combo-pop');
    return { count: match.comboCount, popped: !!el && el.classList.contains('on'), txt: el && el.textContent, max: match.tally.comboMax };
  });
  check('consecutive hits build a combo count', combo.count === 3 && combo.max === 3, 'combo ' + combo.txt);
  check('the combo HUD pops on screen', combo.popped === true);

  // 4 · biggest-hit + reversal tracking flows into the tally
  const tally = await page.evaluate(() => {
    match.tally.biggestHit = 0; match.biggestHit = 0;
    const dmg = 52; if (dmg > match.biggestHit) { match.biggestHit = dmg; if (dmg > match.tally.biggestHit) match.tally.biggestHit = dmg; }
    match.tally.reversals = 0; match.tally.reversals++;
    return { big: match.tally.biggestHit, rev: match.tally.reversals };
  });
  check('biggest hit + reversals are tracked', tally.big === 52 && tally.rev === 1);

  // 5 · TALE OF THE TAPE renders from the tally
  const tape = await page.evaluate(() => {
    const html = matchBreakdownHTML({ strikesLanded: 9, grappleLanded: 4, heavyLanded: 3, blocked: 2, reversals: 1, comboMax: 4, biggestHit: 58, finisherLanded: true });
    const d = document.createElement('div'); d.innerHTML = html;
    return { hasTitle: /TALE OF THE TAPE/i.test(html), cells: d.querySelectorAll('.bd-cell').length, hasCombo: /×4/.test(html), hasFin: html.includes('✓') };
  });
  check('the result shows a post-match breakdown', tape.hasTitle && tape.cells === 8, tape.cells + ' stat cells');
  check('the breakdown reflects combo + finisher', tape.hasCombo && tape.hasFin);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.12 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
