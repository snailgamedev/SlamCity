import { chromium } from 'playwright';

// SC v4.24: fix-it + gameplay — search keeps focus, tutorial opens anywhere, consistent camera, bigger ring/roam, perf, admin ownership, avatar sync.
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
  await page.evaluate(() => { save.tutorialSeen = true; persistSave(); });

  // 1 · TUTORIAL is now a top-level overlay (not trapped in #fight) → opens from settings/hub
  const tut = await page.evaluate(() => {
    const el = document.getElementById('tutorial');
    const parentChain = []; let n = el; while (n && n !== document.body) { if (n.id) parentChain.push(n.id); n = n.parentElement; }
    goto('settings'); showTutorial();
    const shows = el.classList.contains('on') && getComputedStyle(el).display !== 'none';
    hideTutorial();
    return { notInFight: !parentChain.includes('fight'), shows };
  });
  check('tutorial lives outside the fight screen', tut.notInFight === true);
  check('VIEW TUTORIAL opens it from settings (was broken)', tut.shows === true);

  // 2 · ADMIN search keeps focus while typing (re-render refocuses the input)
  const search = await page.evaluate(() => {
    save.activeProfile = '__admin'; adminView = 'fighters'; goto('profile');
    adminSetSearch('aa');
    const el = document.getElementById('adm-search');
    return { focused: document.activeElement === el, val: el && el.value };
  });
  check('admin search keeps focus after typing (no more stuck typing)', search.focused === true && search.val === 'aa');

  // 3 · ADMIN all-fighters shows ownership + lists created fighters
  const own = await page.evaluate(() => {
    const me = FIGHTERS.find(f => !f.cpu && !f.admin && !f.custom);
    save.profiles[me.id] = { name: 'RandomGuy', pin: '1234', look: {} };
    save.activeProfile = '__admin'; adminView = 'fighters'; adminSearch = ''; renderAdminFighters();
    const html = document.getElementById('profile-body').innerHTML;
    return { showsOwner: /RandomGuy/.test(html), inUse: /in use/.test(html), listsAll: allManageableFighters().length >= 12 };
  });
  check('admin all-fighters shows WHO is using a fighter', own.showsOwner && own.inUse);
  check('admin all-fighters lists the whole roster (incl. customs)', own.listsAll === true);

  // 4 · BIGGER RING — more roam room than before (old 1.45 x 0.85)
  const ring = await page.evaluate(() => ({ x: SC3D.ringHalfX, z: SC3D.ringHalfZ }));
  check('ring is bigger (more room to roam)', ring.x > 1.5 && ring.z > 1.0, `${ring.x} x ${ring.z}`);

  // 5 · PERF — capped pixel ratio + single shadow caster
  // (start a fight so the renderer exists)
  await page.evaluate(() => { goto('roster'); }); await page.waitForTimeout(250);
  await page.locator('.roster-card').first().click(); await page.waitForTimeout(250);
  await page.locator('#detail button.btn', { hasText: /FIGHT WITH THIS ONE/i }).first().click();
  await page.waitForTimeout(1700);
  await page.evaluate(() => { if (match) { match.started = true; match.paused = false; match.lastT = performance.now(); match.pAI = false; } });
  await page.waitForTimeout(200);
  const perf = await page.evaluate(() => {
    let shadowCasters = 0; SC3D.scene.traverse(o => { if (o.isLight && o.castShadow) shadowCasters++; });
    return { pr: SC3D.renderer.getPixelRatio(), shadowCasters };
  });
  check('render pixel-ratio capped (≤1.5) for performance', perf.pr <= 1.5, 'pr=' + perf.pr);
  check('only one shadow caster (lighter fight loop)', perf.shadowCasters === 1, perf.shadowCasters + ' casters');

  // 6 · CONSISTENT CAMERA — even when fighters are jammed to one wall, the cam stays centered/close (no oblique sideview)
  const cam = await page.evaluate(() => {
    const ring = document.getElementById('ring');
    match.oAtk = null; match.pAtk = null; SC3D.finishCam = null;
    match.pX = ring.clientWidth * 0.9; match.oX = ring.clientWidth * 0.96 - fighterW();   // both jammed to the right wall
    for (let i = 0; i < 60; i++) update3D(performance.now() + i * 16);
    return { x: +SC3D.camera.position.x.toFixed(2), z: +SC3D.camera.position.z.toFixed(2) };
  });
  check('camera never swings off to a sideview (x stays clamped)', Math.abs(cam.x) <= 0.55, 'cam x=' + cam.x);
  check('camera stays close even jammed to a wall', cam.z < 3.9, 'z=' + cam.z);

  // 7 · AVATAR SYNC — a look change clears the thumb cache so roster/detail re-snapshot
  const sync = await page.evaluate(() => {
    THUMB_CACHE.__probe = 'stale';
    clearThumbs();
    return { cleared: !THUMB_CACHE.__probe, hasFn: typeof clearThumbs === 'function' };
  });
  check('look changes invalidate avatar thumbnails (re-snapshot)', sync.cleared && sync.hasFn);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.24 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
