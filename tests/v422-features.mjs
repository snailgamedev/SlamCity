import { chromium } from 'playwright';

// SC v4.22: fight readability — camera stays CLOSE even when fighters are far apart + live per-fighter action readout chips.
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

  // 1 · the lens is wide (so both stay framed while close)
  const fov = await page.evaluate(() => SC3D.camera.fov);
  check('camera uses a wide lens (≥56°)', fov >= 56, fov + '°');

  // 2 · CAMERA STAYS CLOSE even when the fighters are FAR APART (the v4.16 bug was it zoomed back out)
  const cam = await page.evaluate(() => {
    const ring = document.getElementById('ring');
    const settle = () => { for (let i = 0; i < 60; i++) update3D(performance.now() + i * 16); };
    match.oAtk = null; match.pAtk = null; match.finishCam = null; SC3D.finishCam = null;
    match.pX = 150; match.oX = 200; settle(); const close = +SC3D.camera.position.z.toFixed(2);
    match.pX = ring.clientWidth * 0.05; match.oX = ring.clientWidth * 0.95 - fighterW(); settle(); const far = +SC3D.camera.position.z.toFixed(2);
    return { close, far };
  });
  check('camera is close when fighters are together', cam.close < 3.6, 'z=' + cam.close);
  check('camera STAYS close when they drift apart (no zoom-out)', cam.far < 3.9, 'far z=' + cam.far);
  check('the in/out swing is small (steady framing)', Math.abs(cam.far - cam.close) < 1.0, 'Δ' + (cam.far - cam.close).toFixed(2));

  // 3 · LIVE ACTION READOUT — the chip says exactly what each fighter is doing
  const states = await page.evaluate(() => {
    const r = {};
    const read = () => document.getElementById('left-state').textContent.trim();
    match.pDowned = 0; match.pStun = 0; match.pAtk = null; match.pBlock = false; match.pHype = 0; match.pinning = false;
    match.pBlock = true; syncBars(); r.block = read();
    match.pBlock = false; match.pAtk = { kind: 'grapple', move: { name: 'Slam' }, hitAt: performance.now() + 500 }; syncBars(); r.atk = read();
    match.pAtk = null; match.pStun = 600; syncBars(); r.stun = read();
    match.pStun = 0; match.pDowned = 1200; syncBars(); r.down = read();
    match.pDowned = 0; match.pHype = 3000; syncBars(); r.hype = read();
    match.pHype = 0; syncBars(); r.idle = read();
    return r;
  });
  check('readout shows BLOCKING', /BLOCK/i.test(states.block), states.block);
  check('readout shows the move name when attacking', /SLAM/i.test(states.atk), states.atk);
  check('readout shows STUNNED + DOWN', /STUN/i.test(states.stun) && /DOWN/i.test(states.down), `${states.stun} / ${states.down}`);
  check('readout shows HYPED, and clears when idle', /HYPED/i.test(states.hype) && states.idle === '', `hype:"${states.hype}" idle:"${states.idle}"`);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.22 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
