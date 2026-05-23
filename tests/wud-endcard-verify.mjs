import { chromium } from 'playwright';

const WUD_PATH = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/Would-U-Dunk/index.html';
const OUT = '/tmp/sc-playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();

// Suppress noise · WUD has a lot of console activity
page.on('console', () => {});
page.on('pageerror', () => {});

await page.goto(WUD_PATH, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);

// Pre-trigger screenshot
await page.screenshot({ path: `${OUT}/wud-before.png` });

// Force the endcard ON via JS · bypass game logic · just observe the CSS entrance
await page.evaluate(() => {
  const ec = document.getElementById('endcard');
  if (ec) {
    ec.classList.add('on');
  }
});

// Capture at 4 points across the entrance
const frames = [
  { ts: 30, name: 'wud-endcard-30ms' },
  { ts: 150, name: 'wud-endcard-150ms' },
  { ts: 350, name: 'wud-endcard-350ms' },
  { ts: 700, name: 'wud-endcard-700ms' },
];
const startTs = Date.now();
for (const f of frames) {
  const wait = f.ts - (Date.now() - startTs);
  if (wait > 0) await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${f.name}.png` });
}

const endcardAnim = await page.evaluate(() => {
  const ec = document.getElementById('endcard');
  const panel = ec ? ec.querySelector('.panel') : null;
  return {
    endcardAnim: ec ? window.getComputedStyle(ec).animationName : 'NO_EC',
    endcardDuration: ec ? window.getComputedStyle(ec).animationDuration : 'NO_EC',
    panelAnim: panel ? window.getComputedStyle(panel).animationName : 'NO_PANEL',
    panelDelay: panel ? window.getComputedStyle(panel).animationDelay : 'NO_PANEL',
  };
});
console.log('WUD ENDCARD COMPUTED:', JSON.stringify(endcardAnim, null, 2));
await browser.close();
console.log('✅ WUD endcard frames captured');
