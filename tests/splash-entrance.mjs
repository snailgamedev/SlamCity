import { chromium } from 'playwright';

const SC_PATH = 'file:///Users/ejh/Downloads/Testing%20OUt%20Cursur/SC/index.html';
const OUT = '/tmp/sc-playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await ctx.newPage();

await page.goto(SC_PATH);

// Capture 4 frames across the entrance reveal
const frames = [
  { ts: 50, name: 't0-50ms', desc: 'just-loaded · title should be rising · sub still hidden' },
  { ts: 600, name: 't1-600ms', desc: 'title settling · sub appeared · verse not yet' },
  { ts: 1200, name: 't2-1200ms', desc: 'verse arriving · foot not yet' },
  { ts: 2500, name: 't3-2500ms', desc: 'fully landed · pulse cycle running' },
];

const results = [];
const startTs = Date.now();
for (const f of frames) {
  const wait = f.ts - (Date.now() - startTs);
  if (wait > 0) await page.waitForTimeout(wait);
  const path = `${OUT}/${f.name}.png`;
  await page.screenshot({ path, fullPage: false });
  results.push({ ...f, path });
}

// Also capture hover-state on the ENTER button
await page.waitForTimeout(500);
const btn = page.locator('button.btn').first();
const box = await btn.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/btn-hover.png`, fullPage: false });
  results.push({ name: 'btn-hover', desc: 'cursor on ENTER THE RING · lift + shadow + letter-spacing widen', path: `${OUT}/btn-hover.png` });
}

// Read the computed style of splash-title to verify animation properties applied
const titleAnim = await page.evaluate(() => {
  const el = document.querySelector('.splash-title');
  const cs = window.getComputedStyle(el);
  return {
    animationName: cs.animationName,
    animationDuration: cs.animationDuration,
    animationIterationCount: cs.animationIterationCount,
    opacity: cs.opacity,
  };
});
console.log('SPLASH TITLE COMPUTED:', JSON.stringify(titleAnim, null, 2));

const btnHoverAnim = await page.evaluate(() => {
  const el = document.querySelector('button.btn');
  const cs = window.getComputedStyle(el, ':hover');
  return { transition: cs.transition };
});
console.log('BTN TRANSITION:', JSON.stringify(btnHoverAnim, null, 2));

console.log('\nFRAMES CAPTURED:');
results.forEach(r => console.log(`  ${r.name} · ${r.desc} · ${r.path}`));

await browser.close();
