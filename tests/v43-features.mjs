import { chromium } from 'playwright';

// SC v4.3: cinematic shadows + spotlight · OVERALL matters (OVR gap swings damage) ·
// progress saved across sign-out/in · bans (and all commands) undoable.
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

  // enter a fight
  await page.evaluate(() => { save.tutorialSeen = true; persistSave(); goto('roster'); }); await page.waitForTimeout(300);
  await page.locator('.roster-card').first().click(); await page.waitForTimeout(250);
  await page.locator('#detail button.btn', { hasText: /FIGHT WITH THIS ONE/i }).first().click();
  await page.waitForTimeout(1700);
  await page.evaluate(() => { if (match) { match.started = true; match.paused = false; match.lastT = performance.now(); } });
  await page.waitForTimeout(300);

  // 1 · CINEMATIC 3D — shadows + spotlight
  const cine = await page.evaluate(() => ({ shadows: SC3D.renderer.shadowMap.enabled, spot: !!SC3D.spot, casts: (() => { let n = 0; SC3D.scene.traverse(o => { if (o.isMesh && o.castShadow) n++; }); return n; })() }));
  check('cast shadows enabled', cine.shadows === true);
  check('ring spotlight present', cine.spot === true);
  check('fighters cast shadows', cine.casts >= 6, cine.casts + ' shadow casters');

  // 2 · OVERALL MATTERS — same move, bigger OVR advantage = more damage
  const dmgWith = await page.evaluate(() => {
    function oneHit() {
      // fully reset so the strike always lands at point-blank, same plane
      match.oHP = 100; match.oStun = 9000; match.oCool = 9000; match.oAtk = null; match.oBlock = false; match.oInvuln = 0;
      match.pAtk = null; match.pBlock = false; match.pDowned = 0; match.oDowned = 0; match.pinning = false; match.subbing = false;
      match.pStun = 0; match.pCool = 0; match.pLockMove = 0; match.pInvuln = 0; match.pST = 100; match.pHype = 0; match.oHype = 0;
      match.pZ = 0.5; match.oZ = 0.5; match.oX = 200; match.pX = 175;   // 25px apart, same depth = well in reach
      const before = match.oHP;
      playerAttack('strike');
      if (match.pAtk) { match.pAtk.hitAt = performance.now() - 1; resolveAttack(match.pAtk); }
      return Math.round(before - match.oHP);
    }
    const KEYS = ABILITY_KEYS;
    const setAll = (ab, v) => KEYS.forEach(k => ab[k] = v);
    setAll(match.pAb, 92); setAll(match.oAb, 40); match.pHype = 0; match.oHype = 0;
    const hi = oneHit();
    setAll(match.pAb, 50); setAll(match.oAb, 92);
    const lo = oneHit();
    return { hi, lo };
  });
  check('higher OVR fighter hits harder', dmgWith.hi > dmgWith.lo, `hiOVR −${dmgWith.hi} vs lowOVR −${dmgWith.lo}`);

  // 3 · PROGRESS PERSISTS across sign-out → sign-in
  await page.evaluate(() => goto('hub'));
  await page.evaluate(() => goto('profile')); await page.waitForTimeout(150);
  await page.fill('#prof-name', 'progtest'); await page.fill('#prof-pin', '2468');
  await page.click('button:has-text("SIGN IN / CLAIM")'); await page.waitForTimeout(180);
  const pid = await page.evaluate(() => save.activeProfile);
  await page.evaluate(id => { save.abilDelta[id] = save.abilDelta[id] || {}; save.abilDelta[id].striking = 7; persistSave(); }, pid);
  const ovr1 = await page.evaluate(id => getCurrentOVR(id), pid);
  await page.evaluate(() => profileSignOut());                          // sign OUT
  await page.evaluate(() => goto('profile')); await page.waitForTimeout(120);
  await page.fill('#prof-name', 'progtest'); await page.fill('#prof-pin', '2468');
  await page.click('button:has-text("SIGN IN / CLAIM")'); await page.waitForTimeout(180);   // sign back IN
  const back = await page.evaluate(() => ({ active: save.activeProfile, ovr: getCurrentOVR(save.activeProfile), delta: (save.abilDelta[save.activeProfile] || {}).striking }));
  check('re-sign-in restores the same fighter', back.active === pid);
  check('progress (ratings) saved across sign-out/in', back.delta === 7 && back.ovr === ovr1, `delta ${back.delta}, OVR ${back.ovr} vs ${ovr1}`);

  // 4 · BAN is UNDOABLE
  await page.evaluate(() => { save.activeProfile = ADMIN_KEY; save.admin = { pin: '9999' }; persistSave(); });
  await page.evaluate(() => { window.prompt = () => ''; });   // ban reason
  await page.evaluate(id => adminBan(id), pid);
  const bannedNow = await page.evaluate(() => Object.keys(save.bans).length >= 1);
  const undoHas = await page.evaluate(() => save.undo.length >= 1);
  check('ban is applied + snapshots undo', bannedNow && undoHas);
  await page.evaluate(() => undoLast());
  const afterUndo = await page.evaluate(id => ({ bans: Object.keys(save.bans).length, fighter: !!FIGHTERS.find(f => f.id === id) }), pid);
  check('undo lifts the ban + restores the fighter', afterUndo.bans === 0 && afterUndo.fighter === true, JSON.stringify(afterUndo));

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.3 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
