import { chromium } from 'playwright';

// SC v4.15: admin tools — Message of the Day banner · admin activity leaderboard · audit-log search (+ who did each action).
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
  await page.evaluate(() => { save.tutorialSeen = true; save.activeProfile = ADMIN_KEY; persistSave(); });   // act as Old Man Eli (tier 1)

  // 1 · escapeHTML neutralizes markup (MOTD + log render through it)
  const esc = await page.evaluate(() => escapeHTML('<b>"x"&</b>'));
  check('escapeHTML neutralizes markup', !/[<>]/.test(esc) && esc.includes('&lt;'), esc);

  // 2 · every logged action now records WHO did it
  const by = await page.evaluate(() => { save.adminLog = []; adminLogPush('did a thing'); return save.adminLog[0].by; });
  check('audit log records the acting admin', by === 'Old Man Eli', by);

  // 3 · MESSAGE OF THE DAY — an admin can set it
  const motd = await page.evaluate(() => { window.prompt = () => 'Crew meeting Sunday'; save.motd = null; adminSetMOTD(); return save.motd; });
  check('admin can post a Message of the Day', !!motd && motd.text === 'Crew meeting Sunday' && motd.by === 'Old Man Eli');

  // 4 · the MOTD shows on the hub for EVERYONE, and clearing hides it
  const banner = await page.evaluate(() => { save.motd = { text: 'Be ready', by: 'Old Man Eli', t: Date.now() }; goto('hub'); const el = document.getElementById('motd-banner'); return { shown: el.style.display !== 'none', txt: el.textContent }; });
  check('the MOTD banner shows on the hub', banner.shown && /Be ready/.test(banner.txt));
  const cleared = await page.evaluate(() => { save.motd = null; goto('hub'); return document.getElementById('motd-banner').style.display; });
  check('clearing the MOTD hides the banner', cleared === 'none');

  // 5 · ADMIN ACTIVITY leaderboard ranks the busiest moderator
  const act = await page.evaluate(() => {
    save.adminLog = [{ t: Date.now(), text: 'a', by: 'Aaron' }, { t: Date.now(), text: 'b', by: 'Aaron' }, { t: Date.now(), text: 'c', by: 'Old Man Eli' }];
    const html = adminActivityHTML();
    return { title: /ADMIN ACTIVITY/.test(html), aaronFirst: html.indexOf('Aaron') < html.indexOf('Old Man Eli'), counts: /2 actions/.test(html) };
  });
  check('activity ranks the busiest admin first', act.title && act.aaronFirst && act.counts);

  // 6 · the admin panel surfaces the search box + MOTD button + activity section
  const panel = await page.evaluate(() => {
    save.activeProfile = ADMIN_KEY; adminLogQuery = ''; goto('profile');
    const html = document.getElementById('profile-body').innerHTML;
    return { search: /adm-log-search/.test(html), motdBtn: /MESSAGE OF THE DAY/i.test(html), activity: /ADMIN ACTIVITY/.test(html) };
  });
  check('admin panel shows log search + MOTD tool + activity', panel.search && panel.motdBtn && panel.activity);

  // 7 · the log search actually filters by action or by admin
  const filt = await page.evaluate(() => {
    save.adminLog = [{ t: Date.now(), text: 'banned someone', by: 'Aaron' }, { t: Date.now(), text: 'crowned a champ', by: 'Old Man Eli' }];
    adminLogQuery = 'aaron'; goto('profile');
    const html = document.getElementById('profile-body').innerHTML;
    const showsBan = html.includes('banned someone'), showsCrown = html.includes('crowned a champ');
    adminLogQuery = '';
    return { showsBan, showsCrown };
  });
  check('log search filters by admin name', filt.showsBan === true && filt.showsCrown === false);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.15 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
