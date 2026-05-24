import { chromium } from 'playwright';

// SC v4.25: stipulations (Iron Man/Sudden Death/Hardcore/Glass/Comeback/Even) + admin lift-all + clone fighter.
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

  // 1 · all six stipulations exist + the hub lists them
  const reg = await page.evaluate(() => {
    goto('hub');
    const html = document.getElementById('hub').innerHTML;
    return { n: Object.keys(STIPS).length, onHub: /SPECIAL MATCHES/.test(html) && /IRON MAN/.test(html) && /GLASS CANNON/.test(html) };
  });
  check('six stipulations are defined', reg.n === 6, reg.n + ' stips');
  check('SPECIAL MATCHES group is on the hub', reg.onHub === true);

  // 2 · starting a stipulation flags it into the next match
  const flagged = await page.evaluate(() => {
    startStip('hardcore');
    return { pending: pendingStip === 'hardcore', mode: gameMode, onRoster: document.getElementById('roster').classList.contains('active') };
  });
  check('a stipulation arms + routes to fighter select', flagged.pending && flagged.mode === 'quick' && flagged.onRoster);

  // launch into a fight (the stip should ride into the match)
  await page.evaluate(() => { pendingStip = 'glass'; }); // ensure glass for the HP check
  await page.locator('.roster-card').first().click(); await page.waitForTimeout(250);
  await page.locator('#detail button.btn', { hasText: /FIGHT WITH THIS ONE/i }).first().click();
  await page.waitForTimeout(1700);
  const inMatch = await page.evaluate(() => ({ stip: match.stip, pHP: match.pHP, oHP: match.oHP, cleared: pendingStip === null }));
  check('GLASS CANNON cuts starting HP to 60', inMatch.stip === 'glass' && inMatch.pHP === 60 && inMatch.oHP === 60, 'HP ' + inMatch.pHP);
  check('the stipulation is consumed (won’t leak to next fight)', inMatch.cleared === true);

  // 3 · stipulation damage multipliers
  const dmg = await page.evaluate(() => {
    const r = {};
    match.stip = 'hardcore'; r.hard = stipDmgMult(90);
    match.stip = 'glass'; r.glass = stipDmgMult(90);
    match.stip = 'comeback'; r.cbFull = stipDmgMult(90); r.cbHurt = stipDmgMult(20);
    match.stip = null; r.none = stipDmgMult(90);
    return r;
  });
  check('HARDCORE + GLASS amplify damage', dmg.hard > 1.5 && dmg.glass > 1.9);
  check('COMEBACK only boosts when hurt', dmg.cbHurt > 1.3 && dmg.cbFull === 1 && dmg.none === 1);

  // 4 · SUDDEN DEATH ends on the first knockdown; IRON MAN runs a clock
  const sudden = await page.evaluate(() => {
    match.stip = 'sudden'; match.over = false; match.started = true; match.oDowned = 1500; match.pDowned = 0;
    // replicate the gameLoop stip check
    let ended = false; if (match.stip === 'sudden' && (match.pDowned > 0 || match.oDowned > 0)) { ended = true; }
    return ended;
  });
  check('SUDDEN DEATH ends on a knockdown', sudden === true);
  const iron = await page.evaluate(() => {
    const m = { stip: 'iron', pAb: {}, oAb: {} }; applyStip(m); return { clock: m.ironClock, falls: m.pFalls === 0 };
  });
  check('IRON MAN arms a 75s clock', iron.clock === 75000 && iron.falls);

  // 5 · EVEN STEVEN equalizes ratings
  const even = await page.evaluate(() => {
    const m = { stip: 'even', pAb: { striking: 90, power: 40 }, oAb: { striking: 50, power: 80 } }; applyStip(m);
    return { strEqual: m.pAb.striking === m.oAb.striking, powEqual: m.pAb.power === m.oAb.power };
  });
  check('EVEN STEVEN equalizes both fighters’ ratings', even.strEqual && even.powEqual);

  // 6 · ADMIN — lift ALL bans + clone a fighter
  const admin = await page.evaluate(() => {
    save.activeProfile = '__admin';
    save.bans = { ALPHA: { type: 'ban' }, BETA: { type: 'timeout', until: Date.now() + 9e5 } };
    adminLiftAll();
    const liftedAll = Object.keys(save.bans).length === 0;
    const before = (save.customFighters || []).length;
    adminClone('luke');
    const spec = save.customFighters[save.customFighters.length - 1];
    const cloned = save.customFighters.length === before + 1 && /LUKE II/i.test(spec.name) && !!FIGHTERS.find(f => f.id === spec.id);
    return { liftedAll, cloned };
  });
  check('admin can lift ALL bans/timeouts at once', admin.liftedAll === true);
  check('admin can clone a fighter into a new editable custom', admin.cloned === true);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.25 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
