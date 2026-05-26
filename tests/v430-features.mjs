import { chromium } from 'playwright';

// SC v4.30: combat DEPTH pass (gameplay overhaul pt.2) — slam variety + jab→cross→HAYMAKER combo,
// plus deeper admin (warn / award Faith Star / spotlight Fighter of the Day).
const SC = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/SC/index.html';
const checks = [];
function check(n, p, d = '') { checks.push({ n, p }); console.log(`  ${p ? '✅' : '❌'} ${n}${d ? ' · ' + d : ''}`); return p; }

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 412, height: 915 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('c:' + m.text()); });
page.on('dialog', d => d.accept(d.defaultValue() || 'test'));   // prompts accept with their default (or a fallback)

try {
  await page.goto(SC, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  // 1 · version stamped
  const ver = await page.evaluate(() => GAME_VERSION);
  check('GAME_VERSION is 4.30', ver === '4.30', ver);

  // 2 · SLAM VARIETY — the named-throw table exists with varied damage/knock
  const slams = await page.evaluate(() => ({ n: SLAMS.length, names: SLAMS.map(s => s.name), pb: SLAMS.find(s => /powerbomb/i.test(s.name)) }));
  check('7 named slams exist', slams.n === 7, slams.names.join(', '));
  check('Powerbomb hits harder than baseline (dmg > 1)', slams.pb && slams.pb.dmg > 1, slams.pb ? 'dmg ' + slams.pb.dmg : 'missing');

  // 3 · HAYMAKER — new combo-ender move config + synthetic move
  const hay = await page.evaluate(() => ({ cfg: !!ATK.haymaker, heavy: ATK.haymaker && ATK.haymaker.heavy, mv: moveOf(FIGHTERS[0], 'haymaker').name }));
  check('ATK.haymaker exists + is a heavy hit', hay.cfg && hay.heavy === true);
  check('moveOf(...,"haymaker") returns the Haymaker', hay.mv === 'Haymaker', hay.mv);

  // start a fight so a live match object exists
  await page.evaluate(() => { save.tutorialSeen = true; persistSave(); goto('roster'); }); await page.waitForTimeout(300);
  await page.locator('.roster-card').first().click(); await page.waitForTimeout(250);
  await page.locator('#detail button.btn', { hasText: /FIGHT WITH THIS ONE/i }).first().click();
  await page.waitForTimeout(1700);
  await page.evaluate(() => { if (match) { match.started = true; match.paused = false; match.lastT = performance.now(); match.pAI = false; } });
  await page.waitForTimeout(150);

  // 4 · the match tracks the combo chain step (init field present)
  const initStep = await page.evaluate(() => ('comboStep' in match));
  check('match initializes comboStep (combo chain wired)', initStep === true);

  // 5 · a landed STRIKE opens the combo window + advances the step
  const chain = await page.evaluate(() => {
    match.pX = 178; match.oX = 200; match.oBlock = false; match.oInvuln = 0; match.oStun = 0; match.oHP = 90; match.over = false;
    match.comboUntil = 0; match.comboStep = 0;
    resolveAttack({ kind: 'strike', move: { type: 'jab', name: 'Jab', dmg: [10, 14] }, side: 'player', cfg: ATK.strike });
    return { until: match.comboUntil, step: match.comboStep };
  });
  check('landing a strike opens the COMBO window', chain.until > 0 && chain.step === 1, 'step ' + chain.step);

  // 6 · a non-finisher slam locks one named throw + applies its damage multiplier
  const slamHit = await page.evaluate(() => {
    match.pX = 175; match.oX = 200; match.oBlock = false; match.oInvuln = 0; match.oStun = 0; match.oHP = 100; match.over = false;
    const atk = { kind: 'grapple', move: { type: 'power', name: 'Slam', dmg: [30, 30] }, side: 'player', cfg: ATK.grapple };
    resolveAttack(atk);
    return { slam: atk._slam ? atk._slam.name : null };
  });
  check('a slam locks a named throw (slam variety fires)', !!slamHit.slam, slamHit.slam);

  // ---- ADMIN DEPTH ----
  // sign in as Supreme Admin (Old Man Eli) so can() opens up, and make a target fighter
  const adminSetup = await page.evaluate(() => {
    save.activeProfile = ADMIN_KEY;
    const target = FIGHTERS.find(f => !f.cpu && !f.admin);
    save.profiles = save.profiles || {};
    save.profiles[target.id] = { name: target.name, pin: '1234' };   // a claimed fighter to act on
    persistSave();
    return { perm2: PERM[2], id: target.id };
  });
  check('PERM tier-2 includes warn/award/spotlight', ['warn', 'award', 'spotlight'].every(a => adminSetup.perm2.includes(a)));

  // 7 · WARN stacks
  const warn = await page.evaluate((id) => {
    adminWarn(id); adminWarn(id);
    return { n: (save.warnings || {})[id] || 0 };
  }, adminSetup.id);
  check('warnings stack (2 warns → count 2)', warn.n === 2, 'count ' + warn.n);

  // 8 · AWARD a Faith Star
  const award = await page.evaluate((id) => {
    const before = (save.profiles[id].stars || 0);
    adminAwardStar(id);
    return { gained: (save.profiles[id].stars || 0) - before };
  }, adminSetup.id);
  check('award grants a Faith Star (+1)', award.gained === 1, '+' + award.gained);

  // 9 · SPOTLIGHT sets Fighter of the Day + shows on the hub
  await page.evaluate((id) => { adminSpotlight(id); }, adminSetup.id);
  const spot = await page.evaluate((id) => ({ set: !!(save.spotlight && save.spotlight.id === id) }), adminSetup.id);
  check('spotlight sets Fighter of the Day', spot.set === true);
  await page.evaluate(() => { goto('hub'); renderHub(); }); await page.waitForTimeout(250);
  const banner = await page.evaluate(() => { const el = document.getElementById('spot-banner'); return el && el.style.display !== 'none' && /FIGHTER OF THE DAY/i.test(el.textContent); });
  check('Fighter of the Day banner shows on the hub', banner === true);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.30 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
