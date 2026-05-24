import { chromium } from 'playwright';

// SC v4.16: fight clarity — close eye-level broadcast camera · YOU(blue)/FOE(red) foot rings · attack telegraph.
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
  await page.waitForTimeout(250);

  // 1 · foot markers exist, one per fighter, colored (you vs foe)
  const mk = await page.evaluate(() => {
    const L = SC3D.fighters.left, R = SC3D.fighters.right;
    return { left: !!(L && L.marker), right: !!(R && R.marker), distinct: L && R && L.marker._baseColor.getHex() !== R.marker._baseColor.getHex() };
  });
  check('each fighter has a foot-ring marker', mk.left && mk.right);
  check('YOU vs FOE rings are different colors', mk.distinct === true);

  // 2 · CAMERA is pulled in close + near eye-level (not the old far/high angle)
  const cam = await page.evaluate(() => {
    // close range → camera should sit close (small z) and near eye level (low y), centered (small |x|)
    match.pX = 150; match.oX = 200; match.oAtk = null; match.pAtk = null;
    for (let i = 0; i < 40; i++) update3D(performance.now() + i * 16);   // let the damp settle
    const c = SC3D.camera.position;
    return { z: +c.z.toFixed(2), y: +c.y.toFixed(2), x: +c.x.toFixed(2) };
  });
  check('camera pulls in close (fighters fill the frame)', cam.z < 4.2, 'z=' + cam.z);
  check('camera sits near eye-level (not looking down)', cam.y < 1.45, 'y=' + cam.y);
  check('camera is centered on the action (no constant bias)', Math.abs(cam.x) < 1.0, 'x=' + cam.x);

  // 3 · ATTACK TELEGRAPH — a committed attack flashes that fighter's ring (brighter + scaled up)
  const tel = await page.evaluate(() => {
    const R = SC3D.fighters.right;
    match.oAtk = null; pulseMarker(R.marker, false, 1000); const calmScale = R.marker.scale.x, calmOp = R.marker.material.opacity;
    pulseMarker(R.marker, true, 1000); const hotScale = R.marker.scale.x, hotOp = R.marker.material.opacity;
    return { calmScale, hotScale, calmOp, hotOp };
  });
  check('a committed attack flashes the ring (telegraph)', tel.hotScale > tel.calmScale && tel.hotOp >= tel.calmOp, `scale ${tel.calmScale.toFixed(2)}→${tel.hotScale.toFixed(2)}`);

  // 4 · fighters keep a readable gap at contact (not fully overlapping)
  const gap = await page.evaluate(() => {
    match.pX = 200; match.oX = 200;            // jam them together
    for (let i = 0; i < 30; i++) { match.lastT = performance.now() - 16; gameLoop(performance.now()); }
    return Math.abs(match.oX - match.pX);
  });
  check('bodies stay readable at contact (a minimum gap holds)', gap > 10, 'gap ' + Math.round(gap) + 'px');

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.16 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
