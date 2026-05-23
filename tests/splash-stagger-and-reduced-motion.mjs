import { chromium } from 'playwright';

const SC_PATH = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/SC/index.html';
const OUT = '/tmp/sc-playwright';
const browser = await chromium.launch();

// PASS 1 · normal motion · verify button now staggers in
const ctx1 = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page1 = await ctx1.newPage();
await page1.goto(SC_PATH);

const frames = [
  { ts: 50, name: 't0-50ms-FIXED' },
  { ts: 800, name: 't1-800ms-FIXED' },
  { ts: 1300, name: 't2-1300ms-FIXED' },
  { ts: 2200, name: 't3-2200ms-FIXED' },
];
const startTs = Date.now();
for (const f of frames) {
  const wait = f.ts - (Date.now() - startTs);
  if (wait > 0) await page1.waitForTimeout(wait);
  await page1.screenshot({ path: `${OUT}/${f.name}.png`, fullPage: false });
}

// Check button computed style at t=50ms-equivalent (already past now · but check animation property is set)
const btnAnim = await page1.evaluate(() => {
  const el = document.querySelector('#splash button.btn');
  const cs = window.getComputedStyle(el);
  return { animationName: cs.animationName, animationDelay: cs.animationDelay, animationDuration: cs.animationDuration };
});
console.log('SPLASH BTN ANIM:', JSON.stringify(btnAnim, null, 2));

await ctx1.close();

// PASS 2 · prefers-reduced-motion · verify animations skip
const ctx2 = await browser.newContext({
  viewport: { width: 412, height: 915 },
  reducedMotion: 'reduce',
});
const page2 = await ctx2.newPage();
await page2.goto(SC_PATH);
await page2.waitForTimeout(150);
await page2.screenshot({ path: `${OUT}/reduced-motion-150ms.png`, fullPage: false });

const reducedCheck = await page2.evaluate(() => {
  const title = document.querySelector('.splash-title');
  const btn = document.querySelector('#splash button.btn');
  return {
    titleOpacity: window.getComputedStyle(title).opacity,
    titleAnim: window.getComputedStyle(title).animationName,
    btnOpacity: window.getComputedStyle(btn).opacity,
    btnAnim: window.getComputedStyle(btn).animationName,
  };
});
console.log('REDUCED-MOTION STATE:', JSON.stringify(reducedCheck, null, 2));

await browser.close();
console.log('\n✅ Both passes captured');
