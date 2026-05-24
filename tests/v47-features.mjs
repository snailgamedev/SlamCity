import { chromium } from 'playwright';

// SC v4.7: deeper per-limb animations (distinct poses per move) · mash-to-kick-out of pins · verse insight (apply + meaning).
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

  // 1 · VERSE INSIGHT — every splash verse has apply + meaning, rendered humbly
  const verse = await page.evaluate(() => ({
    allHave: SPLASH_VERSES.every(v => v.apply && v.means),
    html: verseInsightHTML(SPLASH_VERSES[0]),
    onSplash: !!document.getElementById('splash-verse-insight') && /ONE WAY TO LIVE IT/.test(document.getElementById('splash-verse-insight').innerHTML)
  }));
  check('every verse has an application + meaning', verse.allHave === true);
  check('verse insight renders apply + meaning + humble note', /ONE WAY TO LIVE IT/.test(verse.html) && /WHAT IT MEANS/.test(verse.html) && /others may/i.test(verse.html));
  check('splash shows the verse insight', verse.onSplash === true);

  // enter a fight to test 3D poses
  await page.evaluate(() => { save.tutorialSeen = true; persistSave(); goto('roster'); }); await page.waitForTimeout(300);
  await page.locator('.roster-card').first().click(); await page.waitForTimeout(250);
  await page.locator('#detail button.btn', { hasText: /FIGHT WITH THIS ONE/i }).first().click();
  await page.waitForTimeout(1700);
  await page.evaluate(() => { if (match) { match.started = true; match.paused = false; match.lastT = performance.now(); } });
  await page.waitForTimeout(300);

  // 2 · DEEPER ANIMATIONS — different moves produce different limb rotations (not just a body lean)
  const poses = await page.evaluate(() => {
    const f = SC3D.fighters.left; const cap = () => ({ shR: +f.parts.armR.shoulder.rotation.x.toFixed(2), elR: +f.parts.armR.elbow.rotation.x.toFixed(2), ty: +f.parts.torso.rotation.y.toFixed(2) });
    // FIXED time base → deterministic (the strike alternates the striking hand by `now`; sampling at real time made this flaky)
    const T = 60000;
    function poseFor(name, ms) { f.anim = { name, t0: T - ms, dur: 400 }; for (let i = 0; i < 8; i++) poseFighter(f, 0.05, T, false); return cap(); }
    const idle = (() => { f.anim = { name: 'idle', t0: 0, dur: 0 }; for (let i = 0; i < 8; i++) poseFighter(f, 0.05, T, false); return cap(); })();
    const strike = poseFor('strike', 130);   // mid-extend
    const grapple = poseFor('grapple', 350);  // lift phase
    return { idle, strike, grapple };
  });
  check('STRIKE extends the arm + twists the torso (vs idle)', Math.abs(poses.strike.elR - poses.idle.elR) > 0.3 && Math.abs(poses.strike.ty - poses.idle.ty) > 0.2, JSON.stringify(poses.strike));
  check('GRAPPLE pose differs from STRIKE (distinct moves)', Math.abs(poses.grapple.shR - poses.strike.shR) > 0.3, `g.shR ${poses.grapple.shR} vs s.shR ${poses.strike.shR}`);

  // 3 · MASH-TO-KICK-OUT — when the player is pinned, taps build the kick meter
  const mash = await page.evaluate(() => {
    match.pAI = false; match.pinning = true; match.pinVictim = 'player'; match.kickMash = 0;
    playerAttack('strike'); playerAttack('grapple'); playerDodge(); setBlock(true);   // taps during a pin
    return match.kickMash;
  });
  check('mashing builds the kick-out meter while pinned', mash >= 3, mash + ' mash');
  // and pins start with the kick-out prompt + a real count gap (not instant)
  const pinFns = await page.evaluate(() => ({ prompt: doPin.toString().includes('KICK OUT'), gap: doPin.toString().includes('760') }));
  check('pins prompt the kick-out + space the count (not instant)', pinFns.prompt && pinFns.gap);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.7 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
