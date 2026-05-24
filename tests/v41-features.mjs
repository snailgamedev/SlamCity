import { chromium } from 'playwright';

// SC v4.1: admin tiers + perms · profanity filter · random 60–80 · bans/timeout · feedback
// · edit-OME + change-PIN · rounder 3D mesh · install modal + manifest · result avatar.
const SC = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/SC/index.html';
const OUT = '/tmp/sc-playwright';
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

  // 1 · ADMIN TIERS + PERMISSIONS
  const tiers = await page.evaluate(() => ({ eli: adminTierOf(ADMIN_KEY), aaron: adminTierOf('aaron'), og: adminTierOf('luke'), made: adminTierOf('custom_x') }));
  check('tiers: Eli=1, Aaron=2, OG=3, made=0', tiers.eli === 1 && tiers.aaron === 2 && tiers.og === 3 && tiers.made === 0, JSON.stringify(tiers));
  const perms = await page.evaluate(() => {
    save.activeProfile = ADMIN_KEY; const t1ban = can('ban');
    save.activeProfile = 'aaron'; const t2ban = can('ban'), t2msg = can('message'), t2reset = can('reset');
    save.activeProfile = 'luke'; const t3msg = can('message'), t3reset = can('reset');
    save.activeProfile = null;
    return { t1ban, t2ban, t2msg, t2reset, t3msg, t3reset };
  });
  check('tier-1 can ban', perms.t1ban === true);
  check('tier-2 (Aaron) can msg/reset but NOT ban', perms.t2ban === false && perms.t2msg && perms.t2reset);
  check('tier-3 (OG) can msg, not reset', perms.t3msg === true && perms.t3reset === false);

  // 2 · PROFANITY FILTER
  const prof = await page.evaluate(() => ({ bad: cleanName('fuckface').ok, leet: cleanName('sh1t').ok, good: cleanName('Marcus').ok }));
  check('profanity filter blocks bad names', prof.bad === false && prof.leet === false && prof.good === true);

  // 3 · NEW FIGHTER RANDOM 60–80
  await page.evaluate(() => goto('profile')); await page.waitForTimeout(150);
  await page.fill('#prof-name', 'marcus'); await page.fill('#prof-pin', '1212');
  await page.click('button:has-text("SIGN IN / CLAIM")'); await page.waitForTimeout(200);
  const ovr = await page.evaluate(() => getCurrentOVR(save.activeProfile));
  check('new fighter OVR is random 60–80', ovr >= 60 && ovr <= 80, 'OVR ' + ovr);

  // 4 · BAN refuses sign-in, UNBAN lifts (as Eli)
  await page.evaluate(() => { save.activeProfile = ADMIN_KEY; if (!save.admin) save.admin = { pin: '9999' }; persistSave(); });
  await page.evaluate(() => { window.prompt = () => ''; });   // ban reason prompt
  const banId = await page.evaluate(() => FIGHTERS.find(f => f.custom).id);
  await page.evaluate(id => adminBan(id), banId);
  await page.waitForTimeout(120);
  const banned = await page.evaluate(() => Object.keys(save.bans).length >= 1);
  check('ban adds to ban list', banned);
  await page.evaluate(() => { save.activeProfile = null; persistSave(); goto('profile'); }); await page.waitForTimeout(120);
  await page.fill('#prof-name', 'marcus'); await page.fill('#prof-pin', '3333');
  await page.click('button:has-text("SIGN IN / CLAIM")'); await page.waitForTimeout(120);
  const refused = await page.evaluate(() => /banned/i.test(document.getElementById('prof-msg').textContent) && save.activeProfile === null);
  check('banned name refused at sign-in', refused);
  await page.evaluate(() => { save.activeProfile = ADMIN_KEY; const n = Object.keys(save.bans)[0]; adminUnban(n); });
  check('unban lifts it', await page.evaluate(() => Object.keys(save.bans).length === 0));

  // 5 · TIMEOUT
  await page.evaluate(() => { window.prompt = () => '5'; });
  const og2 = await page.evaluate(() => { save.profiles['kale'] = { name: 'KALE', pin: '1111', look: null }; persistSave(); return 'kale'; });
  await page.evaluate(id => adminTimeout(id), og2);
  await page.waitForTimeout(100);
  const to = await page.evaluate(() => { const k = Object.keys(save.bans)[0]; return save.bans[k] && save.bans[k].type === 'timeout'; });
  check('timeout creates a timeout ban', to === true);

  // 6 · FEEDBACK
  await page.evaluate(() => { window.prompt = () => 'love the 3D, add more moves'; openFeedback(); });
  check('feedback is recorded', await page.evaluate(() => (save.feedback || []).some(f => /love the 3D/.test(f.text))));

  // 7 · EDIT OME + CHANGE PIN (tier-1)
  await page.evaluate(() => { save.activeProfile = ADMIN_KEY; save.admin = { pin: '9999' }; persistSave(); });
  await page.evaluate(() => adminEditMe());
  check('admin can edit Old Man Eli (creates a look entry)', await page.evaluate(() => !!save.profiles['oldmaneli']));
  await page.evaluate(() => { let calls = 0; window.prompt = () => (++calls === 1 ? '9999' : '7777'); adminChangePin(); });
  check('admin can change the PIN', await page.evaluate(() => save.admin.pin === '7777'));

  // 8 · ROUNDER MESH (cylinders, not all boxes)
  const mesh = await page.evaluate(() => { const f = build3DFighter({ skin: '#c89', hoodie: '#222', shorts: '#333', hair: '#321', accent: '#e04' }); let cyl = 0, box = 0; f.group.traverse(o => { if (o.geometry) { if (o.geometry.type === 'CylinderGeometry') cyl++; if (o.geometry.type === 'BoxGeometry') box++; } }); return { cyl, box }; });
  check('fighters use rounded cylinders (not boxy)', mesh.cyl >= 6, `${mesh.cyl} cylinders, ${mesh.box} boxes`);

  // 9 · SNAPPIER COMBAT
  check('attack windups reduced (snappy)', await page.evaluate(() => ATK.strike.windup <= 60 && ATK.grapple.windup <= 220));

  // 10 · INSTALL + MANIFEST
  check('manifest linked', await page.evaluate(() => !!document.querySelector('link[rel="manifest"]')));
  await page.evaluate(() => { save.activeProfile = null; openInstall(); });
  await page.waitForTimeout(100);
  check('install modal opens with instructions', await page.evaluate(() => { const m = document.getElementById('install-modal'); return !!m && m.classList.contains('on') && /Add to Home Screen/i.test(m.textContent); }));
  await page.evaluate(() => closeInstall());

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.1 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
