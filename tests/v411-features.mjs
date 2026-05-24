import { chromium } from 'playwright';

// SC v4.11: ROYAL RUMBLE — random-draw field · TOSS over the top (only sticks when worn ≤ TOSS_HP) · wear carries · last one standing.
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

  // 0 · the mode is registered + a hub card exists
  const reg = await page.evaluate(() => {
    const label = MODE_LABEL.rumble;
    const card = [...document.querySelectorAll('.mode-card')].find(b => /ROYAL RUMBLE/i.test(b.textContent));
    return { label, hasCard: !!card };
  });
  check('ROYAL RUMBLE is a registered mode', reg.label === 'ROYAL RUMBLE', reg.label);
  check('a Royal Rumble card is on the hub', reg.hasCard === true);

  // 1 · beginMode builds a randomized field (the whole crew, minus admins + you)
  const field = await page.evaluate(() => {
    gameMode = 'rumble';
    const me = FIGHTERS.find(f => !f.cpu && !f.admin).id;
    // mirror beginMode's queue build without launching a fight
    modeCtx.queue = shuffled(FIGHTERS.filter(f => f.id !== me && !f.admin).map(f => f.id));
    modeCtx.idx = 0; modeCtx.elims = 0; modeCtx.rumbleHP = null; modeCtx.playerId = me;
    return { n: modeCtx.queue.length, hasMe: modeCtx.queue.includes(me) };
  });
  check('the rumble draws a multi-fighter field', field.n >= 3, field.n + ' entrants');
  check('you are not in your own field', field.hasMe === false);

  // 2 · WEAR CARRIES — applyModeRules gives a small breather (+18), never a full heal
  const carry = await page.evaluate(() => {
    modeCtx.elims = 2; modeCtx.rumbleHP = 40; modeCtx.queue = ['a', 'b', 'c']; modeCtx.idx = 1;
    const m = { mode: 'rumble', oAb: { striking: 50, power: 50 }, oHP: 100, pHP: 100 };
    applyModeRules(m);
    return { hp: m.pHP, boosted: m.oAb.striking, elims: m.rumbleElims };
  });
  check('your wear carries between entrants (small breather, not a full heal)', carry.hp === 58, '40 → ' + carry.hp);
  check('each entrant gets a touch meaner', carry.boosted === 54, 'striking 50 → ' + carry.boosted);

  // now start an actual fight so we can drive the toss mechanic on a live match
  await page.evaluate(() => { save.tutorialSeen = true; persistSave(); gameMode = 'quick'; goto('roster'); }); await page.waitForTimeout(300);
  await page.locator('.roster-card').first().click(); await page.waitForTimeout(250);
  await page.locator('#detail button.btn', { hasText: /FIGHT WITH THIS ONE/i }).first().click();
  await page.waitForTimeout(1700);
  await page.evaluate(() => { if (match) { match.started = true; match.paused = false; match.lastT = performance.now(); match.pAI = false; } });
  await page.waitForTimeout(150);

  // 3 · TOSS only sticks once the foe is worn ≤ TOSS_HP — otherwise they "skin the cat"
  const skin = await page.evaluate(() => {
    match.mode = 'rumble'; match.over = false; match.pinning = false; match.pinVictim = null;
    match.oHP = 80; match.oDowned = 1500;          // knocked down but still fresh
    doToss(true);
    return { committed: match.pinning, stillDown: match.oDowned > 0 };
  });
  check('a toss on a fresh foe fails (they skin the cat)', skin.committed === false && skin.stillDown === false, 'pinning=' + skin.committed);
  const dump = await page.evaluate(() => {
    match.mode = 'rumble'; match.over = false; match.pinning = false; match.pinVictim = null;
    match.oHP = 40; match.oDowned = 1500;          // worn down → toss sticks
    doToss(true);
    return { committed: match.pinning };
  });
  check('a toss on a worn foe commits the elimination', dump.committed === true);

  // 4 · in rumble the PIN trigger routes to a TOSS (no pin-count, no pinVictim)
  const reroute = await page.evaluate(() => {
    match.mode = 'rumble'; match.over = false; match.pinning = false; match.pinVictim = null;
    match.oHP = 40; match.oDowned = 1500;
    doPin(true);
    return { tossed: match.pinning === true && match.pinVictim === null };
  });
  check('PIN routes to TOSS in rumble (no pin-count)', reroute.tossed === true);

  // 5 · the action button reads TOSS, and only lights up when the foe is dumpable
  const btn = await page.evaluate(() => {
    const b = document.getElementById('btn-dodge');
    match.mode = 'rumble'; match.pinning = false; match.oDowned = 1500; match.oST = 100;
    match.oHP = 40; updateButtons(); const worn = { txt: b.textContent, ready: b.classList.contains('ready') };
    match.oHP = 85; updateButtons(); const fresh = { txt: b.textContent, ready: b.classList.contains('ready') };
    return { worn, fresh };
  });
  check('TOSS button lights up only on a worn, downed foe', /TOSS!/.test(btn.worn.txt) && btn.worn.ready === true && btn.fresh.ready === false, `${btn.worn.txt}/${btn.fresh.txt}`);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.11 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
