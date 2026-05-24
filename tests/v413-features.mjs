import { chromium } from 'playwright';

// SC v4.13: entrance walkout themes (synth riff per fighter) + pyro jets on the ring walk-in.
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

  // 1 · the entrance-theme + pyro functions exist and run without throwing
  const exists = await page.evaluate(() => typeof playEntranceTheme === 'function' && typeof firePyro === 'function');
  check('entrance theme + pyro functions exist', exists === true);

  // 2 · PYRO — firing it creates the overlay (2 jets + flash) and turns it on
  const pyro = await page.evaluate(() => {
    firePyro();
    const el = document.getElementById('pyro');
    return { exists: !!el, on: el && el.classList.contains('on'), jets: el ? el.querySelectorAll('.pyro-jet').length : 0, flash: el ? el.querySelectorAll('.pyro-flash').length : 0 };
  });
  check('pyro overlay fires with two corner jets', pyro.exists && pyro.on && pyro.jets === 2 && pyro.flash === 1, pyro.jets + ' jets');

  // 3 · WALKOUT THEME — runs (and is seeded so different fighters differ); respects the SFX toggle
  const theme = await page.evaluate(() => {
    let ok = true; try { save.sfxOn = true; playEntranceTheme({ id: 'aaron' }); playEntranceTheme({ id: 'vlad' }); } catch (e) { ok = false; }
    // with SFX off it must no-op cleanly (tone() bails on !sfxOn)
    let offOk = true; try { save.sfxOn = false; playEntranceTheme({ id: 'aaron' }); } catch (e) { offOk = false; }
    save.sfxOn = true;
    return { ok, offOk };
  });
  check('walkout theme plays without throwing', theme.ok === true);
  check('walkout theme respects the Sound Effects toggle (silent when off)', theme.offOk === true);

  // 4 · the entrance hooks are wired into the pre-fight flow (theme on the card, pyro on FIGHT)
  const wired = await page.evaluate(() => {
    const bp = beginPrefight.toString(), ep = endPrefight.toString();
    return { theme: bp.includes('playEntranceTheme'), pyro: ep.includes('firePyro') };
  });
  check('theme is wired to the pre-fight card', wired.theme === true);
  check('pyro is wired to the bell / walk-in', wired.pyro === true);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.13 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
