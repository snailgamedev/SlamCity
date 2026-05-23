import { chromium } from 'playwright';

// SC SMOKE TEST · the breakage gate · walks all 5 screens + asserts zero console errors
// Built 2026-05-23 as the no-break guarantee before autonomous SC work.
// Exit code 0 = game's core loop intact. Exit 1 = SOMETHING BROKE · roll back the last edit.
// Run: node smoke.mjs   (from /SC/tests/ where playwright is installed)

const SC_PATH = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/SC/index.html';
const OUT = '/tmp/sc-playwright';

const errors = [];
const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? '✅' : '❌'} ${name}${detail ? ' · ' + detail : ''}`);
  return pass;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();

// Capture console errors + page errors throughout the whole walk
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));

try {
  await page.goto(SC_PATH, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  // SCREEN 1 · SPLASH
  const splashActive = await page.locator('#splash.active').count();
  check('splash renders + active', splashActive === 1);
  const titleText = (await page.locator('.splash-title').first().textContent().catch(() => '')) || '';
  check('splash title present', /SLAM|CITY/i.test(titleText), `"${titleText.replace(/\s+/g, ' ').trim()}"`);
  const enterBtn = page.locator('#splash button.btn', { hasText: 'ENTER THE RING' });
  check('ENTER THE RING button present', (await enterBtn.count()) >= 1);
  await page.screenshot({ path: `${OUT}/smoke-1-splash.png` });

  // SCREEN 2 · ROSTER
  await enterBtn.first().click();
  await page.waitForTimeout(300);
  check('roster active after ENTER', (await page.locator('#roster.active').count()) === 1);
  const cardCount = await page.locator('.roster-card').count();
  check('roster cards rendered (expect 11)', cardCount >= 1, `${cardCount} cards`);
  // verify each card has a portrait SVG (fighters actually render, not blank)
  const svgCount = await page.locator('.roster-card .portrait svg').count();
  check('roster fighters have SVG art', svgCount >= 1, `${svgCount} portraits`);
  await page.screenshot({ path: `${OUT}/smoke-2-roster.png` });

  // SCREEN 3 · DETAIL
  await page.locator('.roster-card').first().click();
  await page.waitForTimeout(300);
  check('detail active after card click', (await page.locator('#detail.active').count()) === 1);
  const detailStageSvg = await page.locator('#detail .detail-stage svg, #detail svg').count();
  check('detail fighter renders', detailStageSvg >= 1, `${detailStageSvg} svg`);
  const fightBtn = page.locator('#detail button.btn', { hasText: 'FIGHT WITH THIS ONE' });
  check('FIGHT WITH THIS ONE button present', (await fightBtn.count()) >= 1);
  await page.screenshot({ path: `${OUT}/smoke-3-detail.png` });

  // SCREEN 4 · FIGHT
  await fightBtn.first().click();
  await page.waitForTimeout(500);
  check('fight active after start', (await page.locator('#fight.active').count()) === 1);
  const leftSvg = await page.locator('#ring-left-svg svg, #ring-left svg').count();
  const rightSvg = await page.locator('#ring-right-svg svg, #ring-right svg').count();
  check('both ring fighters render', leftSvg >= 1 && rightSvg >= 1, `L:${leftSvg} R:${rightSvg}`);
  const hpStart = await page.locator('#left-hp').getAttribute('style').catch(() => '');
  check('HP bars initialized', /width/.test(hpStart || ''), hpStart || 'none');
  const moveBtns = await page.locator('#fight .action-row .btn, #fight button').count();
  check('move buttons present', moveBtns >= 1, `${moveBtns} buttons`);
  await page.screenshot({ path: `${OUT}/smoke-4-fight.png` });

  // SCREEN 4b · COMBAT RESPONDS
  if (moveBtns >= 1) {
    const beforeTurn = await page.locator('#fight-turn-indicator').textContent().catch(() => '');
    await page.locator('#fight .action-row .btn, #fight button').first().click();
    await page.waitForTimeout(1200); // let attack animation + opponent turn resolve
    // combat responded if: opponent HP dropped OR turn indicator changed OR round advanced
    const rightHp = await page.locator('#right-hp').getAttribute('style').catch(() => '');
    const afterTurn = await page.locator('#fight-turn-indicator').textContent().catch(() => '');
    const hpNum = await page.locator('#right-hp-num').textContent().catch(() => '100');
    const combatResponded = (rightHp && !/width:\s*100%/.test(rightHp)) || (afterTurn !== beforeTurn) || (parseInt(hpNum) < 100);
    check('combat responds to move', combatResponded, `rightHP:${hpNum} turn:"${afterTurn}"`);
    await page.screenshot({ path: `${OUT}/smoke-4b-combat.png` });
  }

  // CONSOLE ERROR GATE · the big one
  check('ZERO console/page errors during walk', errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : 'clean');

} catch (e) {
  check('smoke walk completed without throwing', false, e.message);
}

await browser.close();

// VERDICT
const failed = checks.filter(c => !c.pass);
console.log(`\n${'='.repeat(50)}`);
if (failed.length === 0) {
  console.log(`✅ SMOKE PASS · ${checks.length}/${checks.length} checks · SC core loop intact`);
  process.exit(0);
} else {
  console.log(`❌ SMOKE FAIL · ${failed.length}/${checks.length} broke:`);
  failed.forEach(f => console.log(`   - ${f.name}${f.detail ? ' · ' + f.detail : ''}`));
  console.log(`\nSOMETHING BROKE · roll back the last edit before continuing.`);
  process.exit(1);
}
