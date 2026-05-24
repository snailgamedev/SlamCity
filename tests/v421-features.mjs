import { chromium } from 'playwright';

// SC v4.21: admin RANKS mean something — chain-of-command (only moderate who you outrank) + a YOUR RANK powers panel.
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

  // 1 · the chain of command: who can act on whom
  const chain = await page.evaluate(() => {
    const set = id => { save.activeProfile = id; };
    // a CREW admin (tier 3) — can only touch regular fighters, not Aaron (2) or Eli (1) or another crew (3)
    set('vlad');
    const crew = { onCustom: canActOn('custom_x'), onAaron: canActOn('aaron'), onEli: canActOn('__admin'), onCrew: canActOn('luke') };
    // SENIOR admin (Aaron, tier 2) — can touch crew + regulars, NOT Eli
    set('aaron');
    const senior = { onCrew: canActOn('luke'), onCustom: canActOn('custom_x'), onEli: canActOn('__admin'), onSelf: canActOn('aaron') };
    // SUPREME (Eli, tier 1) — can touch everyone below
    set('__admin');
    const supreme = { onAaron: canActOn('aaron'), onCrew: canActOn('luke'), onCustom: canActOn('custom_x') };
    return { crew, senior, supreme };
  });
  check('CREW admin can moderate regular fighters', chain.crew.onCustom === true);
  check('CREW admin CANNOT touch Aaron, Eli, or fellow crew', !chain.crew.onAaron && !chain.crew.onEli && !chain.crew.onCrew);
  check('SENIOR (Aaron) can moderate crew + regulars', chain.senior.onCrew === true && chain.senior.onCustom === true);
  check('SENIOR (Aaron) CANNOT touch Old Man Eli or himself', !chain.senior.onEli && !chain.senior.onSelf);
  check('SUPREME (Eli) outranks everyone', chain.supreme.onAaron && chain.supreme.onCrew && chain.supreme.onCustom);

  // 2 · the moderation FUNCTIONS reject up-chain actions (not just hidden buttons)
  const enforce = await page.evaluate(() => {
    save.activeProfile = 'vlad';                 // a crew admin tries to ban Aaron
    const aaronName = (FIGHTERS.find(f => f.id === 'aaron') || {}).name;
    const before = JSON.stringify(save.bans || {});
    adminBan('aaron'); adminTimeout('aaron');
    const after = JSON.stringify(save.bans || {});
    return { unchanged: before === after };
  });
  check('a lower admin’s ban/timeout on a higher admin is refused', enforce.unchanged === true);

  // 3 · the YOUR RANK powers panel renders per tier with granted/locked rows
  const panel = await page.evaluate(() => {
    const grab = (id) => { save.activeProfile = id; const h = adminPowersHTML(); return { has: /YOUR RANK/.test(h), tier: (h.match(/TIER (\d)/) || [])[1], on: (h.match(/pow-row on/g) || []).length, off: (h.match(/pow-row off/g) || []).length }; };
    return { eli: grab('__admin'), aaron: grab('aaron'), crew: grab('vlad') };
  });
  check('YOUR RANK panel shows for every tier', panel.eli.has && panel.aaron.has && panel.crew.has);
  check('Supreme has the most powers; Crew the fewest', panel.eli.on > panel.aaron.on && panel.aaron.on > panel.crew.on, `eli ${panel.eli.on} > aaron ${panel.aaron.on} > crew ${panel.crew.on}`);
  check('only Supreme holds the master key (managepins)', panel.eli.off === 0 && panel.crew.off > 0);

  // 4 · the admin panel renders the rank panel + protected markers (a CREW admin sees fellow crew as off-limits)
  const render = await page.evaluate(() => {
    save.activeProfile = 'vlad'; adminPanelOpen = true; adminView = 'panel'; goto('profile');
    const html = document.getElementById('profile-body').innerHTML;
    return { rankPanel: /YOUR RANK/.test(html), protectedMark: /adm-protect/.test(html) };
  });
  check('admin screen shows the rank panel', render.rankPanel === true);
  check('fellow/higher admins show a 🛡 protected marker to a Crew admin', render.protectedMark === true);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.21 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
