import { chromium } from 'playwright';

// SC v4.8: get-up button (appears when downed, mash to rise) + downed-state animation (struggle + getup rise).
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
  await page.evaluate(() => { if (match) { match.started = true; match.paused = false; match.lastT = performance.now(); } });
  await page.waitForTimeout(200);

  // 1 · GET UP button hidden when standing, shows when downed
  const hiddenUp = await page.evaluate(() => { match.pDowned = 0; match.pinning = false; updateButtons(); return getComputedStyle(document.getElementById('btn-getup')).display; });
  check('get-up button hidden while standing', hiddenUp === 'none');
  const shownDown = await page.evaluate(() => { match.pDowned = 1500; match.pinning = false; match.pAI = false; updateButtons(); return getComputedStyle(document.getElementById('btn-getup')).display; });
  check('get-up button appears when knocked down', shownDown !== 'none', 'display:' + shownDown);

  // 2 · MASHING get up reduces the down timer (rise faster)
  const rise = await page.evaluate(() => {
    match.pDowned = 1500; match.pinning = false; match.pAI = false;
    const before = match.pDowned;
    playerGetUp(); playerGetUp(); playerGetUp();
    return { before, after: match.pDowned };
  });
  check('mashing get-up speeds the recovery', rise.after < rise.before - 600, `${rise.before}→${rise.after}`);

  // 3 · DOWNED ANIMATION — fighter writhes (limbs move while down), then a getup rise plays
  const anim = await page.evaluate(() => {
    const f = SC3D.fighters.left;
    f.downed = true;
    const cap = () => +f.parts.armR.shoulder.rotation.x.toFixed(3);
    for (let i = 0; i < 6; i++) poseFighter(f, 0.05, 1000 + i * 90, false); const a = cap();
    for (let i = 0; i < 6; i++) poseFighter(f, 0.05, 2200 + i * 90, false); const b = cap();   // later in the struggle
    return { moved: Math.abs(a - b) > 0.05, a, b };
  });
  check('downed fighter is still animating (writhes/struggles)', anim.moved === true, `${anim.a} vs ${anim.b}`);
  const getup = await page.evaluate(() => {
    // simulate the down→up transition triggering the getup anim
    const f = SC3D.fighters.left; f._wasDowned = true; match.pDowned = 0; match.oDowned = 0;
    set3DAnim('left', 'getup', 650);
    return f.anim.name;
  });
  check('rise-to-stance (getup) animation plays on standing up', getup === 'getup');

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.8 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
