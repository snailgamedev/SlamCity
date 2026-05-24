import { chromium } from 'playwright';

// SC ADMIN + PROFILE test (v3.8) · verifies:
//   case-insensitive brother sign-in · claim LOCKS the brother (no re-sign-in) ·
//   looks are UNIVERSAL (mutate the shared roster art) · admin "Old Man Eli" master key
//   (claim w/ PIN · reset a brother to default · wrong-PIN refused).
// Run: node admin-profile.mjs  (from /SC/tests/)

const SC_PATH = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/SC/index.html';
const OUT = '/tmp/sc-playwright';

const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass });
  console.log(`  ${pass ? '✅' : '❌'} ${name}${detail ? ' · ' + detail : ''}`);
  return pass;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('console', m => { if (m.type() === 'error') pageErrors.push('console.error: ' + m.text()); });
page.on('dialog', d => d.accept());   // auto-accept confirm() in admin resets

try {
  await page.goto(SC_PATH, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  // grab a brother id + name + a non-default skin key to test with
  const setup = await page.evaluate(() => {
    const bro = FIGHTERS.find(isBrother);
    const origSkin = bro.art.skin;
    const altKey = Object.keys(SKIN).find(k => SKIN[k].skin !== origSkin);
    return { id: bro.id, name: bro.name, origSkin, altKey, altSkinHex: SKIN[altKey].skin };
  });
  console.log(`  · testing with brother ${setup.name} (${setup.id})`);

  // 1 · CASE-INSENSITIVE name match
  const ci = await page.evaluate(n => {
    const lo = brotherByName(n.toLowerCase()), up = brotherByName(n.toUpperCase());
    const mi = brotherByName(n[0] + n.slice(1).toLowerCase());
    return { lo: lo && lo.id, up: up && up.id, mi: mi && mi.id };
  }, setup.name);
  check('name matches lowercase', ci.lo === setup.id);
  check('name matches UPPERCASE', ci.up === setup.id);
  check('name matches MixedCase', ci.mi === setup.id);

  // 2 · CLAIM via the real form (lowercase name on purpose)
  await page.evaluate(() => goto('profile'));
  await page.waitForTimeout(150);
  await page.fill('#prof-name', setup.name.toLowerCase());
  await page.fill('#prof-pin', '1234');
  await page.click('button:has-text("SIGN IN / CLAIM")');
  await page.waitForTimeout(150);
  const claimed = await page.evaluate(id => ({ active: save.activeProfile, locked: isClaimed(id) }), setup.id);
  check('claim sets active profile', claimed.active === setup.id);
  check('claimed brother is locked', claimed.locked === true);

  // 3 · UNIVERSAL look — edit changes the shared roster art object
  await page.evaluate(a => { profileEditLook(a.id); setProfileLook('__skin', a.key); }, { id: setup.id, key: setup.altKey });
  await page.waitForTimeout(100);
  const look = await page.evaluate(id => FIGHTERS.find(f => f.id === id).art.skin, setup.id);
  check('look change is universal (roster art mutated)', look === setup.altSkinHex, look);

  // 4 · LOCK — sign out, then re-sign-in is refused
  await page.evaluate(() => profileSignOut());
  await page.waitForTimeout(100);
  await page.evaluate(() => goto('profile'));
  await page.waitForTimeout(100);
  await page.fill('#prof-name', setup.name);
  await page.fill('#prof-pin', '1234');   // even the CORRECT pin must be refused now
  await page.click('button:has-text("SIGN IN / CLAIM")');
  await page.waitForTimeout(120);
  const lockRes = await page.evaluate(() => ({ active: save.activeProfile, msg: document.getElementById('prof-msg').textContent }));
  check('locked brother refuses re-sign-in', lockRes.active === null);
  check('lock message shown', /locked/i.test(lockRes.msg), lockRes.msg);

  // 5 · ADMIN claim (mixed-case name) + panel renders
  await page.fill('#prof-name', 'old man Eli');
  await page.fill('#prof-pin', '9999');
  await page.click('button:has-text("SIGN IN / CLAIM")');
  await page.waitForTimeout(150);
  const adm = await page.evaluate(() => ({ active: save.activeProfile, pin: save.admin && save.admin.pin, crown: document.querySelector('.adm-crown') ? 1 : 0, name: (document.querySelector('.adm-name') || {}).textContent }));
  check('admin signs in (case-insensitive)', adm.active === '__admin');
  check('admin PIN stored', adm.pin === '9999');
  check('admin panel renders (crown + name)', adm.crown === 1 && /OLD MAN ELI/.test(adm.name || ''));
  await page.screenshot({ path: `${OUT}/admin-panel.png` });

  // 6 · ADMIN reset brother → unclaimed + art restored to default
  await page.evaluate(id => adminResetBrother(id), setup.id);
  await page.waitForTimeout(150);
  const reset = await page.evaluate(id => ({ locked: isClaimed(id), skin: FIGHTERS.find(f => f.id === id).art.skin }), setup.id);
  check('admin reset unclaims the brother', reset.locked === false);
  check('admin reset restores default look', reset.skin === setup.origSkin, reset.skin);

  // 7 · ADMIN wrong-PIN refused after sign-out
  await page.evaluate(() => profileSignOut());
  await page.waitForTimeout(80);
  await page.evaluate(() => goto('profile'));
  await page.waitForTimeout(80);
  await page.fill('#prof-name', 'OLD MAN ELI');
  await page.fill('#prof-pin', '0000');
  await page.click('button:has-text("SIGN IN / CLAIM")');
  await page.waitForTimeout(100);
  const wrong = await page.evaluate(() => ({ active: save.activeProfile, msg: document.getElementById('prof-msg').textContent }));
  check('wrong admin PIN refused', wrong.active === null && /wrong admin/i.test(wrong.msg), wrong.msg);

  check('zero page/console errors', pageErrors.length === 0, pageErrors.join(' | '));
} catch (e) {
  check('test ran without throwing', false, e.message);
}

await browser.close();
const passed = checks.filter(c => c.pass).length;
console.log(`\nADMIN+PROFILE: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
