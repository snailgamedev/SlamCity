import { chromium } from 'playwright';

// SC v3.9 feature test:
//  - roster trimmed to OG crew + Old Man Eli (no TITAN/RICO/DUKE/VIPER/BISHOP/ACE)
//  - sign in with a NEW name → creates + claims a fighter
//  - admin: sign-out a brother (releases claim, KEEPS look) + leaves an inbox message + log entry
//  - admin: message any fighter → the claimer sees it in their inbox
//  - COMBO: a landed STRIKE opens a window; a follow-up STRIKE throws the 'cross' combo
// Run: node v39-features.mjs  (from /SC/tests/)

const SC = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/SC/index.html';
const OUT = '/tmp/sc-playwright';
const checks = [];
function check(name, pass, detail = '') { checks.push({ name, pass }); console.log(`  ${pass ? '✅' : '❌'} ${name}${detail ? ' · ' + detail : ''}`); return pass; }

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

  // 1 · ROSTER TRIM + OLD MAN ELI
  const roster = await page.evaluate(() => ({
    eli: !!FIGHTERS.find(f => f.id === 'oldmaneli'),
    eliAdmin: !!(FIGHTERS.find(f => f.id === 'oldmaneli') || {}).admin,
    cpusGone: ['titan', 'rico', 'duke', 'viper', 'bishop', 'ace'].every(id => !FIGHTERS.find(f => f.id === id)),
    brothers: FIGHTERS.filter(f => isBrother(f)).length
  }));
  check('Old Man Eli on the roster', roster.eli);
  check('Old Man Eli flagged admin (not claimable as brother)', roster.eliAdmin);
  check('the 6 filler CPUs removed', roster.cpusGone);
  check('11 OG brothers remain', roster.brothers === 11, `${roster.brothers} brothers`);

  // 2 · SIGN IN WITH A NEW NAME → creates + claims a fighter
  await page.evaluate(() => goto('profile'));
  await page.waitForTimeout(150);
  await page.fill('#prof-name', 'zaddy');
  await page.fill('#prof-pin', '4242');
  await page.click('button:has-text("SIGN IN / CLAIM")');
  await page.waitForTimeout(200);
  const created = await page.evaluate(() => {
    const id = save.activeProfile;
    const f = FIGHTERS.find(x => x.id === id);
    return { id, isCustom: !!(f && f.custom), name: f && f.name, claimed: typeof isClaimed === 'function' && isClaimed(id), inSave: (save.customFighters || []).some(s => s.id === id) };
  });
  check('new name creates a fighter', created.isCustom && /^custom_/.test(created.id || ''), created.name);
  check('created fighter is claimed (locked to them)', created.claimed === true);
  check('created fighter persisted to save', created.inSave === true);

  // 3 · ADMIN sign-out (keeps look) + inbox message + log
  await page.evaluate(() => { save.activeProfile = null; persistSave(); });
  // claim a real brother first
  const broId = await page.evaluate(() => FIGHTERS.find(f => isBrother(f)).id);
  await page.evaluate(() => goto('profile')); await page.waitForTimeout(120);
  await page.fill('#prof-name', await page.evaluate(id => FIGHTERS.find(f => f.id === id).name, broId));
  await page.fill('#prof-pin', '1111');
  await page.click('button:has-text("SIGN IN / CLAIM")'); await page.waitForTimeout(150);
  // give him a custom look, then go admin and sign him out
  await page.evaluate(b => { profileEditLook(b); setProfileLook('__skin', 'deep'); }, broId);
  await page.waitForTimeout(80);
  const lookBefore = await page.evaluate(b => FIGHTERS.find(f => f.id === b).art.skin, broId);
  await page.evaluate(() => { save.activeProfile = null; persistSave(); });
  await page.evaluate(() => goto('profile')); await page.waitForTimeout(120);
  await page.fill('#prof-name', 'OLD MAN ELI'); await page.fill('#prof-pin', '9999');
  await page.click('button:has-text("SIGN IN / CLAIM")'); await page.waitForTimeout(150);
  await page.evaluate(b => adminSignOutBrother(b), broId);
  await page.waitForTimeout(150);
  const so = await page.evaluate(b => ({
    claimed: isClaimed(b),
    lookKept: FIGHTERS.find(f => f.id === b).art.skin,
    inbox: (save.adminInbox[b] || []).length,
    log: (save.adminLog || []).length
  }), broId);
  check('admin sign-out releases the claim', so.claimed === false);
  check('admin sign-out KEEPS the look', so.lookKept === lookBefore, so.lookKept);
  check('sign-out left an inbox message', so.inbox >= 1);
  check('sign-out wrote to admin log', so.log >= 1);

  // 4 · ADMIN message → claimer sees it in inbox (messaging is claimed-only now, so re-claim first)
  await page.evaluate(b => { save.profiles[b] = { name: FIGHTERS.find(f => f.id === b).name, pin: '5555', look: (save.profiles[b] || {}).look || null }; persistSave(); }, broId);
  await page.evaluate(() => { window.prompt = () => 'yo welcome to the crew'; });
  await page.evaluate(b => adminMsgTo(b), broId);
  await page.waitForTimeout(120);
  // re-claim the brother and check the inbox renders
  await page.evaluate(() => { save.activeProfile = null; persistSave(); });
  await page.evaluate(() => goto('profile')); await page.waitForTimeout(120);
  await page.fill('#prof-name', await page.evaluate(id => FIGHTERS.find(f => f.id === id).name, broId));
  await page.fill('#prof-pin', '5555');   // owner re-enters with the matching PIN
  await page.click('button:has-text("SIGN IN / CLAIM")'); await page.waitForTimeout(150);
  const inboxShown = await page.locator('.prof-inbox').count();
  const inboxText = inboxShown ? await page.locator('.prof-inbox').first().innerText() : '';
  check('claimer sees admin message in inbox', inboxShown >= 1 && /welcome to the crew/i.test(inboxText));
  await page.locator('button:has-text("GOT IT")').first().click();
  await page.waitForTimeout(100);
  check('inbox dismiss clears it', (await page.locator('.prof-inbox').count()) === 0);
  await page.screenshot({ path: `${OUT}/v39-profile.png` });

  // 5 · COMBO chain
  await page.evaluate(() => { save.activeProfile = null; save.tutorialSeen = true; persistSave(); goto('roster'); });
  await page.waitForTimeout(200);
  await page.locator('.roster-card').first().click(); await page.waitForTimeout(200);
  await page.locator('#detail button.btn', { hasText: /FIGHT WITH THIS ONE/i }).first().click();
  await page.waitForTimeout(1600);
  await page.evaluate(() => { if (match) { match.started = true; match.paused = false; match.lastT = performance.now(); } });
  await page.waitForTimeout(150);
  // land a STRIKE then resolve it SYNCHRONOUSLY (no loop-tick race), fully reset guards + opponent frozen.
  const winOpen = await page.evaluate(() => {
    if (!match) return null;
    match.pAtk = null; match.oAtk = null; match.pBlock = false; match.oBlock = false; match.pDowned = 0; match.pinning = false; match.subbing = false;
    match.pStun = 0; match.pCool = 0; match.pLockMove = 0; match.pInvuln = 0; match.oInvuln = 0; match.oStun = 9000; match.oCool = 9000; match.pST = 100; match.oHP = 100;
    match.pZ = 0.5; match.oZ = 0.5; match.oX = 200; match.pX = 170;
    playerAttack('strike');
    if (match.pAtk) { match.pAtk.hitAt = performance.now() - 1; resolveAttack(match.pAtk); }
    return { open: match.comboUntil > performance.now(), hadAtk: !!match.pAtk };
  });
  check('landed STRIKE opens a combo window', !!(winOpen && winOpen.open), winOpen ? ('atk:' + winOpen.hadAtk) : 'no match');
  // follow-up STRIKE within the window → throws the cross combo
  const comboKind = await page.evaluate(() => {
    if (!match) return null;
    match.pAtk = null; match.oAtk = null; match.oStun = 9000; match.pCool = 0; match.pStun = 0; match.pLockMove = 0; match.pBlock = false; match.pDowned = 0;
    match.pZ = 0.5; match.oZ = 0.5; match.oX = 200; match.pX = 170;
    playerAttack('strike');
    return match.pAtk ? { kind: match.pAtk.kind, type: match.pAtk.move.type } : null;
  });
  check('follow-up STRIKE throws the COMBO (cross)', !!(comboKind && comboKind.kind === 'combo' && comboKind.type === 'cross'), comboKind ? comboKind.kind + '/' + comboKind.type : 'no atk');

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) {
  check('test ran without throwing', false, e.message);
}

await browser.close();
const passed = checks.filter(c => c.pass).length;
console.log(`\nV3.9 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
