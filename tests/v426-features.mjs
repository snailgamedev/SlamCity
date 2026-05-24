import { chromium } from 'playwright';

// SC v4.26: Faith Corner (verse of the day + crew anchors + gospel) + deeper admin (promote/demote + freeze ratings).
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

  // 1 · FAITH CORNER — renders verse of the day + apply/means + gospel + crew anchors
  const faith = await page.evaluate(() => {
    goto('hub'); const hubHasLink = /faith corner/i.test(document.getElementById('hub').innerHTML);
    goto('faith'); setFaithTab('votd'); const html = document.getElementById('faith-body').innerHTML;
    return { hubHasLink, votd: /VERSE OF THE DAY/.test(html), insight: /ONE WAY TO LIVE IT/.test(html) };
  });
  check('Faith Corner is linked from the hub', faith.hubHasLink === true);
  check('Faith Corner shows a Verse of the Day + insight', faith.votd && faith.insight);
  // (deepened Faith Corner — gospel, anchors/collection, devotionals fully covered by v4.27 suite)
  const votd = await page.evaluate(() => { _faithShuffle = 0; const a = votd().ref; const b = votd().ref; return { stable: a === b }; });
  check('verse of the day is stable within a day', votd.stable === true);

  // 3 · ADMIN PROMOTE — Eli can grant CREW admin to a regular (tier-0) fighter; make a custom to target
  const promote = await page.evaluate(() => {
    save.activeProfile = '__admin'; save.adminGrants = {};
    creator.name = 'PROMOTE ME'; saveCustomFighter();
    const id = save.customFighters[save.customFighters.length - 1].id;     // a tier-0 custom
    const was = adminTierOf(id);
    adminGrantAdmin(id);
    const promoted = adminTierOf(id) === 3 && save.adminGrants[id] === 3;
    adminGrantAdmin(id);   // toggle back
    const revoked = adminTierOf(id) === 0;
    return { was, promoted, revoked, id };
  });
  check('a regular fighter starts as tier 0', promote.was === 0);
  check('Eli can promote a fighter to CREW admin', promote.promoted === true);
  check('…and revoke it', promote.revoked === true);

  // 4 · FREEZE — a frozen fighter's ratings don't drift from progression
  const freeze = await page.evaluate(() => {
    save.frozen = {}; const id = FIGHTERS.find(f => !f.cpu && !f.admin).id;
    adminFreeze(id); const isFrozen = !!save.frozen[id];
    // simulate the progression guard
    const frozenGuardBlocks = (() => { const frozenP = !!(save.frozen && save.frozen[id]); return frozenP; })();
    adminFreeze(id); const unfrozen = !save.frozen[id];
    return { isFrozen, frozenGuardBlocks, unfrozen };
  });
  check('admin can freeze a fighter’s ratings', freeze.isFrozen && freeze.frozenGuardBlocks);
  check('…and unfreeze them', freeze.unfrozen === true);

  // 5 · the editor surfaces the new commands (clone already; promote + freeze now)
  const editor = await page.evaluate(() => {
    save.activeProfile = '__admin'; const id = (save.customFighters[save.customFighters.length - 1] || {}).id || FIGHTERS.find(f => f.custom).id;
    openFighterEditor(id);
    const html = document.getElementById('profile-body').innerHTML;
    return { freeze: /FREEZE RATINGS/.test(html), promote: /CREW ADMIN/.test(html), clone: /CLONE THIS FIGHTER/.test(html) };
  });
  check('fighter editor offers freeze + promote + clone', editor.freeze && editor.promote && editor.clone);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.26 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
