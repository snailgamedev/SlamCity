import { chromium } from 'playwright';

// SC v4.2: distinct 3D hair · facing fix · admin fighters editor (change anything) · 90-day undo
// · uncrown · message claimed-only · creator (weight class + moves + full stats).
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

  // 1 · DISTINCT 3D HAIR
  const hair = await page.evaluate(() => {
    const counts = {};
    HAIR_STYLES.forEach(s => { const o = buildHair3D(s, '#321'); counts[s] = o ? (() => { let n = 0; o.traverse(() => n++); return n; })() : 0; });
    const distinct = new Set(Object.values(counts)).size;
    return { bald: counts.bald, mohawk: counts.mohawk, dreads: counts.dreads, distinctVariety: distinct };
  });
  check('bald = no hair mesh', hair.bald === 0);
  check('hairstyles render distinct 3D geometry', hair.distinctVariety >= 4, JSON.stringify(hair));

  // 2 · FACING FIX (fighters turn toward each other, not backwards)
  await page.evaluate(() => { save.tutorialSeen = true; persistSave(); goto('roster'); }); await page.waitForTimeout(300);
  await page.locator('.roster-card').first().click(); await page.waitForTimeout(250);
  await page.locator('#detail button.btn', { hasText: /FIGHT WITH THIS ONE/i }).first().click();
  await page.waitForTimeout(1700);
  await page.evaluate(() => { if (match) { match.started = true; match.paused = false; match.lastT = performance.now(); match.pX = 20; match.oX = 340; } });
  await page.waitForTimeout(600);
  const face = await page.evaluate(() => ({ L: SC3D.fighters.left.group.rotation.y, R: SC3D.fighters.right.group.rotation.y }));
  check('left fighter faces +X (toward opponent), not backwards', face.L > 0.2, 'Lyaw ' + face.L.toFixed(2));
  check('right fighter faces -X (toward opponent)', face.R < -0.2, 'Ryaw ' + face.R.toFixed(2));

  // 3 · ADMIN as Eli
  await page.evaluate(() => { save.activeProfile = ADMIN_KEY; save.admin = { pin: '9999' }; goto('profile'); renderProfile(); });
  // make a fighter to edit
  await page.evaluate(() => { window.prompt = () => 'EDITME'; adminCreateFighter(); });
  await page.waitForTimeout(120);
  const efId = await page.evaluate(() => (FIGHTERS.find(f => f.name === 'EDITME') || {}).id);
  check('admin created a fighter to edit', !!efId);
  // open editor + change a rating
  await page.evaluate(id => openFighterEditor(id), efId);
  await page.waitForTimeout(120);
  const ovrBefore = await page.evaluate(id => getCurrentOVR(id), efId);
  await page.evaluate(() => { efSetAbil('grappling', 99); efSetAbil('striking', 99); efSetAbil('power', 99); efSetAbil('heart', 99); });
  const ovrAfter = await page.evaluate(id => getCurrentOVR(id), efId);
  check('editor changes ratings (OVR moves)', ovrAfter > ovrBefore, `${ovrBefore}→${ovrAfter}`);
  // rename + weight class + archetype
  await page.evaluate(id => { editingFighter = id; efRename('RENAMED'); efSetWC('__wc', 'HEAVY'); efSetArch('__arch', 'POWERHOUSE'); }, efId);
  const edited = await page.evaluate(id => { const f = FIGHTERS.find(x => x.id === id); return { name: f.name, wc: weightClassOf(f), arch: f.arch }; }, efId);
  check('editor renames a created fighter', edited.name === 'RENAMED', edited.name);
  check('editor sets weight class', edited.wc === 'HEAVY', edited.wc);
  check('editor sets archetype', edited.arch === 'POWERHOUSE');
  check('OVR stays clamped 1–99', ovrAfter <= 99);

  // 4 · 90-DAY UNDO
  await page.evaluate(id => { save.activeProfile = ADMIN_KEY; adminCrown(id); }, efId);
  const champed = await page.evaluate(id => save.champion === id, efId);
  const undoLen = await page.evaluate(() => save.undo.length);
  check('admin action pushes an undo snapshot', undoLen >= 1, undoLen + ' snapshots');
  await page.evaluate(() => undoLast());
  check('undo reverts the action', await page.evaluate(id => save.champion !== id, efId) && champed);

  // 5 · UNCROWN
  await page.evaluate(id => { adminCrown(id); }, efId);
  await page.evaluate(() => adminUncrown());
  check('uncrown clears the champion', await page.evaluate(() => !save.champion));

  // 6 · MESSAGE CLAIMED-ONLY
  await page.evaluate(() => { window.prompt = () => 'hello'; });
  const beforeMsg = await page.evaluate(id => ((save.adminInbox || {})[id] || []).length, efId);
  await page.evaluate(id => adminMsgTo(id), efId);   // efId is unclaimed → adminMsgTo should add NOTHING
  const afterMsg = await page.evaluate(id => ((save.adminInbox || {})[id] || []).length, efId);
  check('cannot message an unclaimed (made) fighter', afterMsg === beforeMsg, `${beforeMsg}→${afterMsg}`);
  const broId = await page.evaluate(() => { const b = FIGHTERS.find(f => isBrother(f)).id; save.profiles[b] = { name: 'X', pin: '1', look: null }; persistSave(); return b; });
  await page.evaluate(id => adminMsgTo(id), broId);
  check('can message a claimed fighter', await page.evaluate(id => ((save.adminInbox || {})[id] || []).length >= 1, broId));

  // 7 · CREATOR upgrade (weight class + moves + full stats)
  await page.evaluate(() => {
    creator.name = 'BUILT'; creator.weightClass = 'LIGHT'; creator.striking = 99; creator.grappling = 99; creator.stamina = 99; creator.heart = 99; creator.charisma = 99; creator.mSig = 'THE HAMMER';
    window.prompt = () => null; saveCustomFighter();
  });
  await page.waitForTimeout(120);
  const built = await page.evaluate(() => { const f = FIGHTERS.find(x => x.name === 'BUILT'); return f ? { ovr: getCurrentOVR(f.id), wc: weightClassOf(f), sig: (f.moves.find(m => m.sig) || {}).name } : null; });
  check('creator sets full stats (high OVR)', built && built.ovr >= 90, built ? 'OVR ' + built.ovr : 'none');
  check('creator sets weight class', built && built.wc === 'LIGHT');
  check('creator sets a custom move name', built && built.sig === 'THE HAMMER', built && built.sig);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.2 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
