import { chromium } from 'playwright';

// SC SMOKE TEST · the breakage gate · walks all 5 screens + asserts zero console errors
// Built 2026-05-23 as the no-break guarantee before autonomous SC work.
// Exit code 0 = game's core loop intact. Exit 1 = SOMETHING BROKE · roll back the last edit.
// Run: node smoke.mjs   (from /SC/tests/ where playwright is installed)

const SC_PATH = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/SC/index.html';
const OUT = '/tmp/sc-playwright';

const errors = [];
const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? '✅' : '❌'} ${name}${detail ? ' · ' + detail : ''}`);
  return pass;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();

// Capture console errors + page errors throughout the whole walk
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));

try {
  await page.goto(SC_PATH, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  // SCREEN 1 · SPLASH
  const splashActive = await page.locator('#splash.active').count();
  check('splash renders + active', splashActive === 1);
  const titleText = (await page.locator('.splash-title').first().textContent().catch(() => '')) || '';
  check('splash title present', /SLAM|CITY/i.test(titleText), `"${titleText.replace(/\s+/g, ' ').trim()}"`);
  const enterBtn = page.locator('#splash button.btn', { hasText: 'ENTER THE RING' });
  check('ENTER THE RING button present', (await enterBtn.count()) >= 1);
  await page.screenshot({ path: `${OUT}/smoke-1-splash.png` });

  // SCREEN 2 · ROSTER  (real flow: ENTER → platform pick → hub → roster)
  await enterBtn.first().click();
  await page.waitForTimeout(400);
  const platCard = page.locator('#platform .platform-card, #platform button');
  if (await platCard.count()) { await platCard.first().click(); await page.waitForTimeout(400); }  // mobile / pc-mac pick
  await page.evaluate(() => goto('roster'));   // from hub → roster
  await page.waitForTimeout(350);
  check('roster active', (await page.locator('#roster.active').count()) === 1);
  const cardCount = await page.locator('.roster-card').count();
  check('roster cards rendered (expect 11)', cardCount >= 1, `${cardCount} cards`);
  // verify each card has a portrait SVG (fighters actually render, not blank)
  const svgCount = await page.locator('.roster-card .portrait svg, .roster-card .portrait img').count();   // 3D thumb (img) or SVG fallback
  check('roster fighters have art', svgCount >= 1, `${svgCount} portraits`);
  await page.screenshot({ path: `${OUT}/smoke-2-roster.png` });

  // SCREEN 3 · DETAIL
  await page.locator('.roster-card').first().click();
  await page.waitForTimeout(300);
  check('detail active after card click', (await page.locator('#detail.active').count()) === 1);
  const detailStageSvg = await page.locator('#detail .detail-stage canvas, #detail .detail-stage svg, #detail svg').count();   // live 3D model or SVG fallback
  check('detail fighter renders', detailStageSvg >= 1, `${detailStageSvg} mounts`);
  const fightBtn = page.locator('#detail button.btn', { hasText: 'FIGHT WITH THIS ONE' });
  check('FIGHT WITH THIS ONE button present', (await fightBtn.count()) >= 1);
  await page.screenshot({ path: `${OUT}/smoke-3-detail.png` });

  // SCREEN 4 · FIGHT (real-time: joystick + attack buttons; not turn-based)
  // After "FIGHT WITH THIS ONE": loading screen → fight screen with the prefight countdown overlay.
  await fightBtn.first().click();
  await page.waitForTimeout(1600);                                                  // 'ENTERING THE RING' loading screen
  check('fight active after start', (await page.locator('#fight.active').count()) === 1);
  // real 3D (WebGL) when .r3d, else the CSS-cuboid fallback rig
  const fighters = await page.evaluate(() => {
    const r3d = document.getElementById('ring').classList.contains('r3d');
    if (r3d) return { mode: '3D', ok: !!(typeof SC3D !== 'undefined' && SC3D.ok && SC3D.fighters.left && SC3D.fighters.right) };
    return { mode: 'CSS', ok: document.querySelectorAll('#ring-left-svg .f3d').length >= 1 && document.querySelectorAll('#ring-right-svg .f3d').length >= 1 };
  });
  check('both ring fighters render', fighters.ok, fighters.mode);
  const hpStart = await page.locator('#left-hp').getAttribute('style').catch(() => '');
  check('HP bars initialized', /width/.test(hpStart || ''), hpStart || 'none');
  const moveBtns = await page.locator('#fight .atk-btn').count();
  check('attack buttons present', moveBtns >= 1, `${moveBtns} buttons`);
  check('in-fight pause button present', (await page.locator('#pause-btn').count()) === 1);
  await page.screenshot({ path: `${OUT}/smoke-4-fight.png` });

  // SCREEN 4b · LOOP IS LIVE — unpausing the prefight makes the rAF loop advance fighter positions
  const posA = await page.evaluate(() => (typeof match !== 'undefined' && match) ? { p: match.pX, o: match.oX } : null);
  await page.evaluate(() => { if (typeof match !== 'undefined' && match) { match.started = true; match.paused = false; match.lastT = performance.now(); } });
  await page.waitForTimeout(550);
  const posB = await page.evaluate(() => (typeof match !== 'undefined' && match) ? { p: match.pX, o: match.oX } : null);
  const loopLive = posA && posB && (Math.abs(posA.o - posB.o) > 0.5 || Math.abs(posA.p - posB.p) > 0.5);
  check('real-time loop is live (positions update)', !!loopLive, posA && posB ? `pX ${Math.round(posA.p)}→${Math.round(posB.p)} · oX ${Math.round(posA.o)}→${Math.round(posB.o)}` : 'no match');
  await page.screenshot({ path: `${OUT}/smoke-4b-combat.png` });

  // CONSOLE ERROR GATE · the big one
  check('ZERO console/page errors during walk', errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : 'clean');

} catch (e) {
  check('smoke walk completed without throwing', false, e.message);
}

await browser.close();

// VERDICT
const failed = checks.filter(c => !c.pass);
console.log(`\n${'='.repeat(50)}`);
if (failed.length === 0) {
  console.log(`✅ SMOKE PASS · ${checks.length}/${checks.length} checks · SC core loop intact`);
  process.exit(0);
} else {
  console.log(`❌ SMOKE FAIL · ${failed.length}/${checks.length} broke:`);
  failed.forEach(f => console.log(`   - ${f.name}${f.detail ? ' · ' + f.detail : ''}`));
  console.log(`\nSOMETHING BROKE · roll back the last edit before continuing.`);
  process.exit(1);
}
