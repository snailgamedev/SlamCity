import { chromium } from 'playwright';

// SC v4.6: roster avatars are 3D-model snapshots (match the ring) · random button · CPU tournament · dynamic title.
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

  // 1 · DYNAMIC TITLE (matches the live GAME_VERSION, whatever it is)
  const gv = await page.evaluate(() => GAME_VERSION);
  check('tab title reflects the live version', (await page.title()).includes('v' + gv), await page.title());

  // 2 · ROSTER AVATARS = 3D model snapshots (img with a data URL), not flat SVG
  await page.evaluate(() => { save.tutorialSeen = true; persistSave(); goto('roster'); });
  await page.waitForTimeout(500);
  const av = await page.evaluate(() => {
    const imgs = document.querySelectorAll('.roster-card .portrait img');
    const first = imgs[0];
    return { count: imgs.length, isData: !!(first && /^data:image\/png/.test(first.src)) };
  });
  check('roster cards use 3D-model image thumbs', av.count >= 10 && av.isData, av.count + ' thumbs, dataURL:' + av.isData);
  // the thumb is generated from the SAME builder as the ring
  const thumbMatch = await page.evaluate(() => { const a = FIGHTERS.find(f => isBrother(f)); const t = fighterThumb(a.art); return typeof t === 'string' && t.startsWith('data:image'); });
  check('3D thumbnail comes from the shared fighter model', thumbMatch === true);

  // 3 · RANDOM button
  const hasRandom = await page.evaluate(() => !!document.getElementById('roster-random'));
  check('random fighter button present on roster', hasRandom === true);
  await page.locator('#roster-random').click(); await page.waitForTimeout(1800);   // through the loading screen
  check('random button starts a matchup (loads a fight)', await page.evaluate(() => typeof match !== 'undefined' && !!match));

  // 4 · CPU TOURNAMENT
  await page.evaluate(() => { match = null; goto('hub'); startTournament(); });
  await page.waitForTimeout(1800);   // through the loading screen
  const tourn = await page.evaluate(() => ({ alive: (modeCtx.tourn || {}).alive ? modeCtx.tourn.alive.length : 0, gm: gameMode, fighting: !!match }));
  check('tournament seeds an 8-fighter bracket', tourn.alive === 8, tourn.alive + ' fighters');
  check('tournament launches a CPU bout', tourn.gm === 'tournament' && tourn.fighting);
  // advance: winners accumulate, bracket halves
  const adv = await page.evaluate(() => {
    const t = modeCtx.tourn; t.lastWinner = t.alive[0];
    advanceTournament(); const w1 = t.winners.length, idx1 = t.idx;
    return { w1, idx1 };
  });
  check('tournament advances bouts', adv.w1 === 1 && adv.idx1 === 2, JSON.stringify(adv));

  // 5 · MODE INTROS exist (cinematic news beats per mode) — endPrefight references them
  const intros = await page.evaluate(() => endPrefight.toString());
  check('cinematic mode intros wired (career/survival/tournament)', /TITLE RUN/.test(intros) && /ROUND/.test(intros) && /tournProgress/.test(intros));

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.6 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
