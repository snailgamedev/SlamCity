import { chromium } from 'playwright';

// SC v4.20: SIGNATURE move — full-HYPE payoff. Button appears when hyped; fires a guaranteed knockdown blow, consumes the meter.
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

  // 1 · SIGNATURE button hidden when not hyped, shows when HYPED
  const hidden = await page.evaluate(() => { match.pHype = 0; match.pDowned = 0; match.pinning = false; updateButtons(); return getComputedStyle(document.getElementById('btn-sig')).display; });
  check('signature button hidden when not hyped', hidden === 'none');
  const shown = await page.evaluate(() => { match.pHype = 5000; match.pDowned = 0; match.pinning = false; match.pAI = false; updateButtons(); return getComputedStyle(document.getElementById('btn-sig')).display; });
  check('signature button appears when HYPED', shown !== 'none', 'display:' + shown);

  // 2 · firing the signature CONSUMES the meter
  const consume = await page.evaluate(() => {
    match.pHype = 5000; match.pMo = 100; match.pStun = 0; match.pAtk = null; match.pDowned = 0; match.pinning = false; match.subbing = false;
    match.pX = 160; match.oX = 200; match.oHP = 90; match.oBlock = false; match.oStun = 0; match.over = false;
    playerSignature();
    return { hype: match.pHype, mo: match.pMo };
  });
  check('signature cashes the whole HYPE meter', consume.hype === 0 && consume.mo === 0);

  // 3 · an unblocked signature deals damage + KNOCKS THEM DOWN
  const land = await page.evaluate(() => {
    match.pHype = 5000; match.pStun = 0; match.pAtk = null; match.pDowned = 0; match.pinning = false; match.subbing = false;
    match.pX = 160; match.oX = 200; match.oHP = 90; match.oBlock = false; match.oStun = 0; match.oDowned = 0; match.over = false;
    playerSignature();
    return { hp: match.oHP, downed: match.oDowned > 0 };
  });
  check('an unblocked signature damages + knocks the foe down', land.hp < 90 && land.downed === true, 'oHP→' + land.hp);

  // 4 · a BLOCKED signature still hurts but they stay on their feet
  const blocked = await page.evaluate(() => {
    match.pHype = 5000; match.pStun = 0; match.pAtk = null; match.pDowned = 0; match.pinning = false; match.subbing = false;
    match.pX = 160; match.oX = 200; match.oHP = 90; match.oBlock = true; match.oStun = 0; match.oDowned = 0; match.over = false;
    playerSignature();
    return { hp: match.oHP, downed: match.oDowned > 0 };
  });
  check('a blocked signature still chips but no knockdown', blocked.hp < 90 && blocked.downed === false, 'oHP→' + blocked.hp);

  // 5 · it does NOT fire when you're not hyped
  const noHype = await page.evaluate(() => {
    match.pHype = 0; match.oHP = 90; match.oDowned = 0; match.over = false;
    playerSignature();
    return { hp: match.oHP, downed: match.oDowned > 0 };
  });
  check('signature refuses to fire without a full HYPE meter', noHype.hp === 90 && noHype.downed === false);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.20 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
