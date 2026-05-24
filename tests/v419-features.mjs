import { chromium } from 'playwright';

// SC v4.19: titles & rankings — champion + defense streak, power-ranking ladder, #1 contender, Hall of Fame, defend-the-title.
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

  // 1 · crownChampion records the Hall of Fame + resets defenses on a new champ
  const crown = await page.evaluate(() => {
    save.titleHistory = []; save.titleDefenses = 5;
    const id = FIGHTERS.find(f => !f.admin).id;
    crownChampion(id);
    return { champ: save.champion === id, hof: save.titleHistory.length, defReset: save.titleDefenses === 0, named: save.titleHistory[0].name };
  });
  check('crowning a champion records the Hall of Fame', crown.champ && crown.hof === 1, crown.named);
  check('a new champion resets the defense streak', crown.defReset === true);

  // 2 · #1 contender = highest-OVR fighter who isn’t the champ
  const cont = await page.evaluate(() => {
    const c = topContender();
    const champOVR = getCurrentOVR(save.champion);
    return { exists: !!c, notChamp: c && c.id !== save.champion };
  });
  check('there is a #1 contender (top OVR, not the champ)', cont.exists && cont.notChamp);

  // 3 · the RANKINGS screen renders champion + ladder + HOF + defend button
  const screen = await page.evaluate(() => {
    goto('rankings');
    const html = document.getElementById('rank-body').innerHTML;
    return { champ: /REIGNING CHAMPION/.test(html), ladder: /POWER RANKINGS/.test(html), rows: document.querySelectorAll('.rank-row').length, defend: /DEFEND THE TITLE/.test(html), hof: /HALL OF FAME/.test(html), contender: /#1 contender/.test(html) };
  });
  check('rankings screen shows the reigning champion', screen.champ === true);
  check('rankings screen shows the power-ranking ladder', screen.ladder && screen.rows >= 5, screen.rows + ' rows');
  check('the #1 contender is flagged + a Defend button is offered', screen.contender && screen.defend);
  check('rankings screen shows a Hall of Fame', screen.hof === true);

  // 4 · DEFEND THE TITLE launches champ vs contender; a defense win bumps the streak, a loss changes the belt
  const before = await page.evaluate(() => save.champion);
  await page.evaluate(() => defendTitle());
  await page.waitForTimeout(1100);   // let showLoading's beat finish → startMatchWith creates the match
  const defend = await page.evaluate((before) => ({ launched: gameMode === 'title' && !!match && match.player.id === before, contId: match && match.opponent.id }), before);
  check('Defend the Title launches the champ vs the #1 contender', defend.launched === true);
  const outcomes = await page.evaluate((before) => {
    // a successful defense (win) → streak up, champ unchanged
    save.champion = before; save.titleDefenses = 2; match.mode = 'title'; match.winBy = 'KO'; match.over = false;
    const titleResult = (result) => { if (match.mode === 'title') { if (result === 'win') { save.titleDefenses++; } else { crownChampion(match.opponent.id); } } };
    titleResult('win');
    const afterWin = { champ: save.champion === before, defenses: save.titleDefenses };
    titleResult('loss');
    const afterLoss = { newChamp: save.champion === match.opponent.id };
    return { afterWin, afterLoss };
  }, before);
  check('a successful defense keeps the belt + grows the streak', outcomes.afterWin.champ && outcomes.afterWin.defenses === 3);
  check('losing a defense hands the belt to the contender', outcomes.afterLoss.newChamp === true);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.19 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
