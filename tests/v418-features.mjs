import { chromium } from 'playwright';

// SC v4.18: crowd reactions — pop on heavy hits, roar on finishers/KO, boo on stalls, reactive crowd-band glow.
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
  await page.evaluate(() => { save.tutorialSeen = true; persistSave(); goto('roster'); }); await page.waitForTimeout(300);
  await page.locator('.roster-card').first().click(); await page.waitForTimeout(250);
  await page.locator('#detail button.btn', { hasText: /FIGHT WITH THIS ONE/i }).first().click();
  await page.waitForTimeout(1700);
  await page.evaluate(() => { if (match) { match.started = true; match.paused = false; match.lastT = performance.now(); match.pAI = false; } });
  await page.waitForTimeout(150);

  // 1 · the crowd system exists
  const exists = await page.evaluate(() => typeof crowdReact === 'function' && typeof crowdNoise === 'function' && typeof updateCrowdVisual === 'function');
  check('crowd-reaction functions exist', exists === true);

  // 2 · a reaction adds crowd ENERGY; a boo drains it
  const energy = await page.evaluate(() => {
    crowdEnergy = 0; crowdReact('pop'); const pop = crowdEnergy;
    crowdEnergy = 0; crowdReact('big'); const big = crowdEnergy;
    crowdEnergy = 1; crowdReact('boo'); const boo = crowdEnergy;   // boo cooldown is fresh on first call
    return { pop, big, boo };
  });
  check('a finisher roar spikes more energy than a pop', energy.big > energy.pop && energy.pop > 0, `pop ${energy.pop.toFixed(2)} / big ${energy.big.toFixed(2)}`);
  check('a boo drains crowd energy', energy.boo < 1, 'energy → ' + energy.boo.toFixed(2));

  // 3 · the crowd band visibly reacts (brightness scales with energy) and decays over time
  const visual = await page.evaluate(() => {
    crowdEnergy = 1.2; updateCrowdVisual(0); const hot = document.querySelector('.arena-crowd').style.filter;
    const bright = parseFloat((hot.match(/brightness\(([\d.]+)\)/) || [])[1] || '1');
    for (let i = 0; i < 70; i++) updateCrowdVisual(0.05); const cooled = crowdEnergy;
    return { bright, cooled };
  });
  check('the crowd band brightens with energy', visual.bright > 1.1, 'brightness ' + visual.bright);
  check('crowd energy decays back down when it’s quiet', visual.cooled < 0.05, 'settled ' + visual.cooled.toFixed(2));

  // 4 · a heavy hit triggers a crowd pop (energy rises through the real combat path)
  const onHit = await page.evaluate(() => {
    crowdEnergy = 0; match.lastActionT = 0;
    const atk = { kind: 'grapple', move: { type: 'power', name: 'Slam', dmg: [30, 30] }, side: 'player', cfg: ATK.grapple };
    match.pX = 180; match.oX = 205; match.oBlock = false; match.oInvuln = 0;
    resolveAttack(atk);
    return { energy: crowdEnergy, actioned: match.lastActionT > 0 };
  });
  check('a landed heavy hit pops the crowd', onHit.energy > 0 && onHit.actioned, 'energy ' + onHit.energy.toFixed(2));

  // 5 · the boo has a cooldown so it can’t spam every frame
  const cool = await page.evaluate(() => { let n = 0; const orig = crowdEnergy; for (let i = 0; i < 5; i++) { const b = crowdEnergy; crowdReact('boo'); if (crowdEnergy !== b) n++; } return n; });
  check('boos are rate-limited (no spam)', cool <= 1, cool + ' boos fired from 5 calls');

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.18 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
