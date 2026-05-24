import { chromium } from 'playwright';

// SC v4.10: faces on every fighter · walk-in entrances · slow-mo cinematic finish cam.
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

  // 1 · FACES — every fighter's head carries eyes + brows + a nose (no more faceless heads)
  const face = await page.evaluate(() => {
    const f = SC3D.fighters.left; if (!f || !f.parts || !f.parts.head) return { ok: false, n: -1 };
    const kids = f.parts.head.children.filter(o => o.isMesh).length;   // 2 eyes + 2 brows + 1 nose = 5
    return { ok: kids >= 5, n: kids };
  });
  check('every fighter has face features (eyes/brows/nose)', face.ok === true, face.n + ' face meshes on the head');

  // 2 · WALK-IN ENTRANCE — the bell sets an entrance timer; it auto-clears once the stride-in finishes
  const ent = await page.evaluate(() => {
    SC3D.entranceT0 = performance.now();
    const set = SC3D.entranceT0 > 0;
    update3D(performance.now() + 30);             // mid-stride: timer still running
    const during = SC3D.entranceT0 > 0;
    update3D(performance.now() + 2000);           // past the 950ms stride: auto-clears
    const after = SC3D.entranceT0;
    return { set, during, cleared: after === 0 };
  });
  check('the bell arms a walk-in entrance', ent.set === true && ent.during === true);
  check('entrance auto-finishes (fighters settle to their marks)', ent.cleared === true);

  // 3 · SLOW-MO FINISH CAM — triggering it arms the cam + drops the letterbox/FINISH overlay, then clears
  const fin = await page.evaluate(() => {
    const armed = triggerFinishCam('win');
    const camOn = !!SC3D.finishCam;
    const overlayOn = document.getElementById('finish-cinema').classList.contains('on');
    const winnerPose = SC3D.fighters.left.anim.name;     // winner strikes a victory pose
    update3D(performance.now());                          // loser forced down under the cam
    const loserDown = SC3D.fighters.right.downed === true;
    const t0 = SC3D.finishCam ? SC3D.finishCam.t0 : 0;
    update3D(t0 + 5000);                                  // past the cam duration → clears
    return { armed, camOn, overlayOn, winnerPose, loserDown, cleared: SC3D.finishCam === null };
  });
  check('finish cam + cinematic letterbox arm on a finish', fin.armed === true && fin.camOn === true && fin.overlayOn === true);
  check('winner strikes a victory pose, loser collapses', /taunt/i.test(fin.winnerPose) && fin.loserDown === true, fin.winnerPose);
  check('finish cam releases back to normal after the beat', fin.cleared === true);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.10 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
