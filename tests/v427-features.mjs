import { chromium } from 'playwright';

// SC v4.27: deep Faith Corner — tabs, daily blessing+streak, memory verse, collection, devotionals, gospel, Faith Stars.
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

  // 1 · five tabs render
  const tabs = await page.evaluate(() => {
    goto('faith'); const html = document.getElementById('faith-body').innerHTML;
    return { tabs: document.querySelectorAll('.faith-tabs button').length, top: /faith-stars/.test(html) && /day streak/.test(html) };
  });
  check('Faith Corner has the 5-tab deck + stat header', tabs.tabs === 5 && tabs.top, tabs.tabs + ' tabs');

  // 2 · DAILY BLESSING builds a streak + a Faith Star, once per day
  const bless = await page.evaluate(() => {
    save.faithStars = 0; save.blessStreak = 0; save.lastBlessDay = null;
    setFaithTab('votd'); faithClaim();
    const after1 = { stars: save.faithStars, streak: save.blessStreak, day: save.lastBlessDay };
    faithClaim();   // second claim same day = no-op
    return { after1, starsAfter2: save.faithStars };
  });
  check('claiming the daily blessing grants a streak + a ⭐', bless.after1.stars === 1 && bless.after1.streak === 1);
  check('the blessing is once-per-day (no double dip)', bless.starsAfter2 === 1);

  // 3 · MEMORIZE — a correct fill-the-blank grants a star + collects the verse
  const mem = await page.evaluate(() => {
    setFaithTab('mem');
    const html = document.getElementById('faith-body').innerHTML;
    const hasChoices = document.querySelectorAll('.fm-choice').length === 4;
    // pull the right answer out of the onclick the test can read
    const btn = [...document.querySelectorAll('.fm-choice')].find(b => { const m = b.getAttribute('onclick').match(/faithGuess\('([^']*)','([^']*)','([^']*)'\)/); return m && m[1] === m[2]; });
    const m = btn.getAttribute('onclick').match(/faithGuess\('([^']*)','([^']*)','([^']*)'\)/);
    save.faithStars = 5; save.versesRead = {};
    faithGuess(m[1], m[2], m[3]);
    return { hasChoices, gainedStar: save.faithStars === 6, collected: !!save.versesRead[m[3]] };
  });
  check('memorize shows a 4-choice fill-the-blank', mem.hasChoices === true);
  check('a correct answer grants ⭐ + collects the verse', mem.gainedStar && mem.collected);

  // 4 · COLLECTION reflects gathered verses
  const coll = await page.evaluate(() => {
    setFaithTab('coll');
    const total = faithPool().length, got = faithPool().filter(v => (save.versesRead || {})[v.ref]).length;
    const html = document.getElementById('faith-body').innerHTML;
    return { total, got, shows: new RegExp(got + '/' + total).test(html) };
  });
  check('collection tracks verses gathered out of the pool', coll.total >= 12 && coll.got >= 1 && coll.shows, coll.got + '/' + coll.total);

  // 5 · DEVOTIONALS + GOSPEL render
  const devo = await page.evaluate(() => {
    setFaithTab('devo'); const d = document.getElementById('faith-body').innerHTML;
    setFaithTab('gospel'); const g = document.getElementById('faith-body').innerHTML;
    return { devos: (d.match(/faith-devo/g) || []).length, gospel: /John 3:16/.test(g) && /THE REAL WIN/.test(g) };
  });
  check('five themed devotionals render', devo.devos === 5, devo.devos + ' devos');
  check('the gospel page (The Real Win · John 3:16) renders', devo.gospel === true);

  // 6 · Faith Stars surface on the hub when earned
  const hub = await page.evaluate(() => { save.faithStars = 3; goto('hub'); return /goto\('faith'\)/.test(document.getElementById('hub-profile').innerHTML); });
  check('Faith Stars show on the hub profile', hub === true);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.27 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
