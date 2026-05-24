import { chromium } from 'playwright';

// SC v4.0 feature test:
//  - real-3D ring is active in a fight (THREE loaded, scene + both fighters built)
//  - customization menu shows a 3D portrait (creator)
//  - universal-changes feed records recolors/creates + renders on the hub
//  - more admin: announce (broadcast to inboxes), create-a-fighter, crown-champion
// Run: node v40-features.mjs  (from /SC/tests/)

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
  check('THREE.js loaded', await page.evaluate(() => typeof THREE === 'object'));
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  // 1 · REAL 3D RING in a fight
  await page.evaluate(() => { save.tutorialSeen = true; persistSave(); goto('roster'); });
  await page.waitForTimeout(300);
  await page.locator('.roster-card').first().click(); await page.waitForTimeout(250);
  await page.locator('#detail button.btn', { hasText: /FIGHT WITH THIS ONE/i }).first().click();
  await page.waitForTimeout(1700);
  await page.evaluate(() => { if (match) { match.started = true; match.paused = false; match.lastT = performance.now(); } });
  await page.waitForTimeout(400);
  const ring = await page.evaluate(() => ({ r3d: document.getElementById('ring').classList.contains('r3d'), ok: SC3D.ok, started: SC3D.started, both: !!(SC3D.fighters.left && SC3D.fighters.right), kids: SC3D.scene ? SC3D.scene.children.length : 0 }));
  check('ring switched to real 3D (.r3d)', ring.r3d);
  check('3D scene built with both fighters', ring.ok && ring.both && ring.kids > 10, `${ring.kids} objects`);
  await page.screenshot({ path: `${OUT}/v40-ring-final.png` });

  // 2 · CUSTOMIZATION 3D portrait (creator)
  await page.evaluate(() => goto('hub')); await page.waitForTimeout(150);
  await page.evaluate(() => goto('create')); await page.waitForTimeout(300);
  const port = await page.evaluate(() => ({ ok: SC3DP.ok, started: SC3DP.started, canvasIn: document.querySelector('#create-svg canvas') ? 1 : 0 }));
  check('creator shows a 3D portrait', port.ok && port.canvasIn === 1);
  await page.screenshot({ path: `${OUT}/v40-creator.png` });

  // 3 · UNIVERSAL-CHANGES FEED — claim a brother, recolor, expect a feed entry + hub render
  await page.evaluate(() => goto('profile')); await page.waitForTimeout(150);
  const broId = await page.evaluate(() => FIGHTERS.find(f => isBrother(f)).id);
  await page.fill('#prof-name', await page.evaluate(id => FIGHTERS.find(f => f.id === id).name, broId));
  await page.fill('#prof-pin', '1234');
  await page.click('button:has-text("SIGN IN / CLAIM")'); await page.waitForTimeout(150);
  const feedBefore = await page.evaluate(() => (save.changeFeed || []).length);
  await page.evaluate(b => { profileEditLook(b); setProfileLook('__skin', 'deep'); }, broId);
  await page.waitForTimeout(120);
  const feedAfter = await page.evaluate(() => (save.changeFeed || []).length);
  check('recolor adds a change-feed entry', feedAfter > feedBefore, `${feedBefore}→${feedAfter}`);
  await page.evaluate(() => { save.activeProfile = null; persistSave(); goto('hub'); });
  await page.waitForTimeout(200);
  const feedShown = await page.locator('.chg-feed').count();
  check('hub shows the RECENT CHANGES feed', feedShown >= 1);

  // 4 · MORE ADMIN — announce / create / crown
  await page.evaluate(() => goto('profile')); await page.waitForTimeout(120);
  await page.fill('#prof-name', 'OLD MAN ELI'); await page.fill('#prof-pin', '9999');
  await page.click('button:has-text("SIGN IN / CLAIM")'); await page.waitForTimeout(180);
  await page.evaluate(() => { window.prompt = () => 'crew meeting friday 🙏'; adminAnnounce(); });
  await page.waitForTimeout(120);
  const ann = await page.evaluate(() => { let n = 0; for (const k in save.adminInbox) n += save.adminInbox[k].filter(m => /crew meeting/.test(m.text)).length; return n; });
  check('announce broadcasts to claimed inboxes', ann >= 1, `${ann} inboxes`);
  const before = await page.evaluate(() => FIGHTERS.length);
  await page.evaluate(() => { window.prompt = () => 'NEW GUY'; adminCreateFighter(); });
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => FIGHTERS.length);
  check('admin create adds a fighter', after === before + 1, `${before}→${after}`);
  await page.evaluate(b => adminCrown(b), broId);
  await page.waitForTimeout(100);
  const champ = await page.evaluate(b => save.champion === b, broId);
  check('admin crown sets the champion', champ === true);
  await page.screenshot({ path: `${OUT}/v40-admin.png` });

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) {
  check('test ran without throwing', false, e.message);
}

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.0 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
