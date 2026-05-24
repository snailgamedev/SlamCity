import { chromium } from 'playwright';

// SC v4.23: UI polish (screen fades, ambient glow, button sheen, reduced-motion) + deeper admin (dashboard, staff notes, log export).
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

  // 1 · POLISH — screens fade in, ambient backdrop + button sheen exist
  const polish = await page.evaluate(() => {
    goto('hub');
    const scr = getComputedStyle(document.getElementById('hub')).animationName;
    const amb = getComputedStyle(document.body, '::after').animationName;
    const btn = document.querySelector('.btn');
    const sheen = btn ? getComputedStyle(btn, '::after').animationName : 'none';
    return { scr, amb, sheen };
  });
  check('screens fade in (screen-in animation)', polish.scr === 'screen-in', polish.scr);
  check('ambient animated backdrop runs', polish.amb === 'ambient-drift', polish.amb);
  check('buttons have a sheen sweep', /sheen/.test(polish.sheen), polish.sheen);

  // 2 · the fight screen does NOT fade each frame (live canvas) and splash keeps its own reveal
  const noFade = await page.evaluate(() => {
    goto('fight'); const f = getComputedStyle(document.getElementById('fight')).animationName;
    goto('splash'); const s = getComputedStyle(document.getElementById('splash')).animationName;
    return { f, s };
  });
  check('fight + splash opt out of the generic fade', noFade.f === 'none' && noFade.s === 'none');

  // 3 · ADMIN dashboard renders the at-a-glance stats
  const dash = await page.evaluate(() => {
    save.activeProfile = '__admin'; const html = adminDashHTML();
    const d = document.createElement('div'); d.innerHTML = html;
    return { cells: d.querySelectorAll('.dash-cell').length, hasClaimed: /CLAIMED/.test(html), hasNotes: /NOTES/.test(html) };
  });
  check('admin dashboard shows 5 at-a-glance stats', dash.cells === 5 && dash.hasClaimed && dash.hasNotes, dash.cells + ' cells');

  // 4 · STAFF NOTES — set, persist, render on the row, clear
  const notes = await page.evaluate(() => {
    save.activeProfile = '__admin'; save.adminNotes = {};
    window.prompt = () => 'watch this one';
    adminNote('luke');
    const saved = save.adminNotes['luke'];
    const row = adminCrewRow(FIGHTERS.find(f => f.id === 'luke'));
    const onRow = /watch this one/.test(row) && /has-note/.test(row);
    window.prompt = () => '';                 // clearing
    adminNote('luke');
    return { saved, onRow, cleared: !save.adminNotes['luke'] };
  });
  check('a staff note saves to the fighter', notes.saved === 'watch this one');
  check('the note shows on the crew row (+ marked button)', notes.onRow === true);
  check('blanking the note clears it', notes.cleared === true);

  // 5 · EXPORT LOG — builds the full text paper-trail (timestamp + who + action)
  const exp = await page.evaluate(() => {
    save.activeProfile = '__admin'; save.adminLog = [{ t: Date.now(), text: 'banned someone', by: 'Old Man Eli' }];
    const txt = auditLogText();
    return { hasHeader: /ADMIN LOG/.test(txt), hasEntry: /banned someone/.test(txt), hasWho: /Old Man Eli/.test(txt) };
  });
  check('export builds a real audit-log paper-trail', exp.hasHeader && exp.hasEntry && exp.hasWho);

  // 6 · the admin panel renders with the dashboard + notes + export wired in, no errors
  const render = await page.evaluate(() => {
    save.activeProfile = '__admin'; adminView = 'panel'; goto('profile');
    const html = document.getElementById('profile-body').innerHTML;
    return { dash: /adm-dash/.test(html), export: /export log/.test(html), noteBtn: /add a staff note|note:/.test(html) };
  });
  check('admin panel surfaces dashboard + export + note buttons', render.dash && render.export && render.noteBtn);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.23 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
