import { chromium } from 'playwright';

// SC v4.28: real fighter faces (eyes/iris/pupil/glint/brow/nose/mouth) + desktop layout (2-column admin crew list).
const SC = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/SC/index.html';
const checks = [];
function check(n, p, d = '') { checks.push({ n, p }); console.log(`  ${p ? '✅' : '❌'} ${n}${d ? ' · ' + d : ''}`); return p; }

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('c:' + m.text()); });
page.on('dialog', d => d.accept());

try {
  await page.goto(SC, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => { save.tutorialSeen = true; persistSave(); goto('roster'); }); await page.waitForTimeout(300);
  await page.locator('.roster-card').first().click(); await page.waitForTimeout(250);
  await page.locator('#detail button.btn', { hasText: /FIGHT WITH THIS ONE/i }).first().click();
  await page.waitForTimeout(1700);

  // 1 · FACES — the head now carries a full set of features (was 5; now eyes-white+iris+pupil+glint ×2 + 2 brows + nose + mouth)
  const face = await page.evaluate(() => {
    const f = SC3D.fighters.left; let n = 0; f.parts.head.traverse(o => { if (o.isMesh) n++; });
    return n;
  });
  check('fighters have a full face (many features, not a blank head)', face >= 11, face + ' face meshes');

  // 2 · DESKTOP — the admin crew list is wrapped for a multi-column grid; cells wrap each row
  const layout = await page.evaluate(() => {
    save.activeProfile = '__admin'; adminView = 'panel'; goto('profile');
    const body = document.getElementById('profile-body');
    const listWrap = body.querySelector('.adm-crewlist');
    const cells = body.querySelectorAll('.adm-crewcell').length;
    const cols = listWrap ? getComputedStyle(listWrap).gridTemplateColumns.split(' ').length : 0;
    return { hasWrap: !!listWrap, cells, cols };
  });
  check('admin crew list is a wrapped grid', layout.hasWrap === true);
  check('each fighter is its own cell (row + note stay together)', layout.cells >= 11, layout.cells + ' cells');
  check('crew list flows into 2 columns on desktop', layout.cols === 2, layout.cols + ' cols');

  // 3 · desktop content is wider (fills the screen, not a thin strip)
  const width = await page.evaluate(() => {
    goto('hub'); const mw = getComputedStyle(document.getElementById('hub')).maxWidth;
    return parseInt(mw);
  });
  check('desktop screens use real width (>1000px column)', width >= 1100, width + 'px');

  // 4 · faces still render on the roster thumbnails (snapshot) + customizer — no regressions
  const thumb = await page.evaluate(() => { goto('roster'); const card = document.querySelector('.roster-card img, .roster-card canvas, .roster-card svg'); return !!card; });
  check('roster avatars still render with the new faces', thumb === true);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.28 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
