import { chromium } from 'playwright';

// SC v4.9: reversals (timed REVERSE counters an incoming attack + stuns) · taunts (locked FINISH builds HYPE).
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
  await page.waitForTimeout(200);

  // 1 · REVERSAL — a timed REVERSE vs an incoming attack negates it + stuns the opponent
  const rev = await page.evaluate(() => {
    match.pStun = 0; match.pDowned = 0; match.pinning = false; match.oStun = 0; match.pX = 180; match.oX = 210; match.pZ = 0.5; match.oZ = 0.5;
    match.oAtk = { kind: 'grapple', move: { type: 'power', name: 'Slam' }, side: 'opp', cfg: ATK.grapple, hitAt: performance.now() + 100, resolved: false };
    const consumed = tryReverse();
    return { consumed, oAtkCleared: match.oAtk === null, oStunned: match.oStun > 0 };
  });
  check('timed REVERSE counters the attack', rev.consumed === true && rev.oAtkCleared === true);
  check('reversal stuns the opponent', rev.oStunned === true);
  // a MISTIMED reverse (no incoming / too early) does NOT reverse — just a normal block
  const mistime = await page.evaluate(() => { match.oAtk = null; match.oStun = 0; return tryReverse(); });
  check('reverse only triggers on a real incoming attack', mistime === false);

  // 2 · TAUNT — the FINISH button becomes a TAUNT while the finisher is locked; it builds HYPE
  const taunt = await page.evaluate(() => {
    match.oHP = 90; updateButtons();                            // finisher locked (oHP > FIN_UNLOCK)
    const label = document.getElementById('btn-fin').textContent;
    match.pMo = 0; match.pStun = 0; match.pAtk = null; match.pTaunt = 0; match.pDowned = 0; match.pinning = false; match.subbing = false;
    playerTaunt();
    return { label, moGain: match.pMo };
  });
  check('locked FINISH button shows TAUNT', /TAUNT/i.test(taunt.label), taunt.label);
  check('taunting builds the HYPE meter', taunt.moGain >= 20, '+' + taunt.moGain + ' momentum');
  // taunt + reverse have their own animations registered
  const anims = await page.evaluate(() => { const f = SC3D.fighters.left; set3DAnim('left', 'taunt', 500); const t = f.anim.name; poseFighter(f, 0.05, performance.now() - 100, false); return t; });
  check('taunt animation plays', anims === 'taunt');

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.9 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
