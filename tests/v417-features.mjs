import { chromium } from 'playwright';
import fs from 'fs';

// SC v4.17: install/offline polish — real PNG icons (iOS home-screen) + manifest PNG entries + SW caches them.
const DIR = new URL('../', import.meta.url);
const SC = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/SC/index.html';
const checks = [];
function check(n, p, d = '') { checks.push({ n, p }); console.log(`  ${p ? '✅' : '❌'} ${n}${d ? ' · ' + d : ''}`); return p; }

// 1 · the PNG icons exist on disk (real raster, not SVG)
for (const s of [180, 192, 512]) {
  let ok = false, dim = '';
  try { const b = fs.readFileSync(new URL(`icon-${s}.png`, DIR)); ok = b.slice(1, 4).toString() === 'PNG'; const w = b.readUInt32BE(16), h = b.readUInt32BE(20); dim = `${w}x${h}`; ok = ok && w === s && h === s; } catch (e) {}
  check(`icon-${s}.png exists at ${s}x${s}`, ok, dim);
}

// 2 · manifest lists the PNG icons + service worker caches them
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', DIR), 'utf8'));
check('manifest lists PNG icons', manifest.icons.some(i => i.type === 'image/png' && /192/.test(i.src)) && manifest.icons.some(i => /512/.test(i.src)));
const sw = fs.readFileSync(new URL('sc-sw.js', DIR), 'utf8');
check('service worker pre-caches the PNG icons', sw.includes('icon-180.png') && sw.includes('icon-192.png') && sw.includes('icon-512.png'));

// 3 · the apple-touch-icon points to a PNG (iOS ignores SVG) + manifest is linked
const html = fs.readFileSync(new URL('index.html', DIR), 'utf8');
const atiMatch = html.match(/apple-touch-icon"\s+href="([^"]+)"/);
check('apple-touch-icon points to a PNG (iOS home-screen)', !!atiMatch && /\.png$/.test(atiMatch[1]), atiMatch ? atiMatch[1] : 'missing');
check('manifest + service-worker registration are wired', /rel="manifest"/.test(html) && /serviceWorker\.register/.test(html));

// 4 · the page still loads clean with the new icon wiring (no console/page errors)
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 412, height: 915 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('c:' + m.text()); });
try {
  await page.goto(SC, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  check('install modal still opens', await page.evaluate(() => { openInstall(); const el = document.getElementById('install-modal') || document.querySelector('.modal.on, #install'); return !!el; }));
  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }
await browser.close();

const passed = checks.filter(c => c.p).length;
console.log(`\nV4.17 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
