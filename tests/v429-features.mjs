import { chromium } from 'playwright';

// SC v4.29: combat FEEL pass — snappier movement, crisper strikes, beefier hit-stop. (Gameplay overhaul pt.1)
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

  // 1 · feel constants are tuned snappier than the old values
  const feel = await page.evaluate(() => ({ move: RT.moveSpeed, back: RT.backStep, jabWind: ATK.strike.windup, jabCool: ATK.strike.cool }));
  check('movement is snappier (moveSpeed up from 240)', feel.move >= 260, 'moveSpeed ' + feel.move);
  check('evade hops further (backStep up from 48)', feel.back >= 52, 'backStep ' + feel.back);
  check('jab is crisper (windup down from 55, cool down from 200)', feel.jabWind <= 45 && feel.jabCool <= 180, `windup ${feel.jabWind} / cool ${feel.jabCool}`);

  // 2 · a fight still plays cleanly with the new tuning (no regressions)
  await page.evaluate(() => { save.tutorialSeen = true; persistSave(); goto('roster'); }); await page.waitForTimeout(300);
  await page.locator('.roster-card').first().click(); await page.waitForTimeout(250);
  await page.locator('#detail button.btn', { hasText: /FIGHT WITH THIS ONE/i }).first().click();
  await page.waitForTimeout(1700);
  await page.evaluate(() => { if (match) { match.started = true; match.paused = false; match.lastT = performance.now(); match.pAI = false; } });
  await page.waitForTimeout(150);

  // 3 · a heavy hit lands a beefier freeze-frame (more impact)
  const hit = await page.evaluate(() => {
    match.pX = 175; match.oX = 200; match.oBlock = false; match.oInvuln = 0; match.oStun = 0; match.hitStop = 0; match.over = false;
    resolveAttack({ kind: 'grapple', move: { type: 'power', name: 'Slam', dmg: [30, 30] }, side: 'player', cfg: ATK.grapple });
    return { hitStop: match.hitStop };
  });
  check('a heavy hit triggers a beefier freeze-frame', hit.hitStop >= 110, 'hitStop ' + hit.hitStop);

  // 4 · a jab still lands clean (combat works with the snappier numbers)
  const jab = await page.evaluate(() => {
    match.pX = 178; match.oX = 200; match.oBlock = false; match.oInvuln = 0; match.oStun = 0; match.oHP = 90; match.over = false;
    resolveAttack({ kind: 'strike', move: { type: 'jab', name: 'Jab', dmg: [10, 14] }, side: 'player', cfg: ATK.strike });
    return { dmgDone: match.oHP < 90 };
  });
  check('a jab still connects + deals damage', jab.dmgDone === true);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.29 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
