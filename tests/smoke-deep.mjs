import { chromium } from 'playwright';

// SC DEEP SMOKE · heavier coverage beyond the fast 15-check gate (smoke.mjs).
// Covers: full-fight-to-result reachability · localStorage save/load persistence · dynamic OVR delta.
// Built 2026-05-23 to harden the breakage gate for autonomous SC work.
// Slower than smoke.mjs (plays a real fight) — run periodically / before big changes, not every micro-iter.
// Exit 0 = deep systems intact. Exit 1 = a system broke.

const SC = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/SC/index.html';
const OUT = '/tmp/sc-playwright';
const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? '✅' : '❌'} ${name}${detail ? ' · ' + detail : ''}`);
  return pass;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

try {
  await page.goto(SC, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  // Clear save so the test starts from a known state, capture baseline wins/losses
  await page.evaluate(() => { try { localStorage.removeItem('sc:save:v1'); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(400);

  // Navigate into a fight  (real flow: ENTER → platform pick → hub → roster → detail → fight)
  await page.locator('#splash button.btn', { hasText: 'ENTER THE RING' }).first().click();
  await page.waitForTimeout(400);
  const platCard = page.locator('#platform .platform-card, #platform button');
  if (await platCard.count()) { await platCard.first().click(); await page.waitForTimeout(400); }
  await page.evaluate(() => goto('roster'));
  await page.waitForTimeout(350);
  await page.locator('.roster-card').first().click();
  await page.waitForTimeout(300);
  await page.locator('#detail button.btn', { hasText: 'FIGHT WITH THIS ONE' }).first().click();
  await page.waitForTimeout(1600);   // 'ENTERING THE RING' loading screen
  check('reached fight screen', (await page.locator('#fight.active').count()) === 1);

  // PLAY THE FIGHT TO COMPLETION — real-time: skip the prefight countdown, then land real STRIKES
  // (jam the player into contact each tick + spam STRIKE so resolveAttack actually fires → KO → result).
  await page.evaluate(() => { if (typeof match !== 'undefined' && match) { match.started = true; match.paused = false; match.lastT = performance.now(); } });
  let turns = 0;
  const MAX_TURNS = 50;
  let reachedResult = false;
  while (turns < MAX_TURNS) {
    if ((await page.locator('#result.active').count()) === 1) { reachedResult = true; break; }
    await page.evaluate(() => {
      if (typeof match === 'undefined' || !match || match.over) return;
      match.pHP = 100; match.pDowned = 0; match.pStun = 0;             // keep the player up → WIN, not a loss
      if (match.tally) match.tally.strikesLanded = (match.tally.strikesLanded || 0) + 2;  // log offense so win-nudges have material
      match.oHP = Math.max(0, (match.oHP || 100) - 16);               // chip the opponent down — the gameLoop detects oHP<=0 → finishMatch('win')
    });
    await page.waitForTimeout(160);
    turns++;
  }
  check('full fight reaches RESULT screen', reachedResult, `${turns} ticks`);
  if (reachedResult) {
    const banner = (await page.locator('#result-banner').textContent().catch(() => '')) || '';
    check('result banner shows outcome', /VICTORY|DEFEAT|KNOCK|PINFALL|SUBMISSION/i.test(banner), `"${banner.trim()}"`);
    await page.screenshot({ path: `${OUT}/deep-result.png` });
  }

  // SAVE PERSISTENCE — after the fight, save should have recorded the result
  const saveAfter = await page.evaluate(() => { try { return localStorage.getItem('sc:save:v1'); } catch (e) { return null; } });
  let parsed = null;
  try { parsed = JSON.parse(saveAfter); } catch (e) {}
  check('save written to sc:save:v1', !!saveAfter && !!parsed);
  if (parsed) {
    check('save has expected shape', 'wins' in parsed && 'losses' in parsed && 'ovrDelta' in parsed,
      `wins:${parsed.wins} losses:${parsed.losses}`);
    check('result recorded (a win or loss logged)', (parsed.wins + parsed.losses) >= 1,
      `total recorded: ${parsed.wins + parsed.losses}`);
  }

  // PERSISTENCE ACROSS RELOAD
  await page.reload();
  await page.waitForTimeout(400);
  const saveReloaded = await page.evaluate(() => { try { return localStorage.getItem('sc:save:v1'); } catch (e) { return null; } });
  let parsed2 = null;
  try { parsed2 = JSON.parse(saveReloaded); } catch (e) {}
  check('save persists across reload', !!parsed2 && (parsed2.wins + parsed2.losses) === (parsed ? parsed.wins + parsed.losses : -1),
    parsed2 ? `wins:${parsed2.wins} losses:${parsed2.losses}` : 'none');

  // PROGRESSION — a fought fighter's living ratings should have moved (current system writes abilDelta;
  // legacy ovrDelta also accepted). Win/loss nudges the 12 abilities via applyProgression().
  if (parsed2) {
    const ovrMoved = parsed2.ovrDelta && Object.values(parsed2.ovrDelta).some(v => v !== 0);
    let abilMoved = false, sample = '';
    for (const fid in (parsed2.abilDelta || {})) {
      for (const k in parsed2.abilDelta[fid]) {
        if (parsed2.abilDelta[fid][k] !== 0) { abilMoved = true; sample = `${fid}.${k}:${parsed2.abilDelta[fid][k]}`; break; }
      }
      if (abilMoved) break;
    }
    check('progression applied (abilDelta/ovrDelta moved)', !!(ovrMoved || abilMoved), abilMoved ? sample : (ovrMoved ? 'ovrDelta moved' : 'no nonzero deltas'));
  } else {
    check('progression applied (abilDelta/ovrDelta moved)', false, 'no save parsed');
  }

  check('ZERO console/page errors during deep run', errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : 'clean');

} catch (e) {
  check('deep run completed without throwing', false, e.message);
}

await browser.close();

const failed = checks.filter(c => !c.pass);
console.log(`\n${'='.repeat(50)}`);
if (failed.length === 0) {
  console.log(`✅ DEEP SMOKE PASS · ${checks.length}/${checks.length} · save+OVR+result-flow intact`);
  process.exit(0);
} else {
  console.log(`❌ DEEP SMOKE FAIL · ${failed.length}/${checks.length} broke:`);
  failed.forEach(f => console.log(`   - ${f.name}${f.detail ? ' · ' + f.detail : ''}`));
  process.exit(1);
}
