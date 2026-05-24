import { chromium } from 'playwright';

// SC v4.14: deep face customization — beard (4 styles) + eye color (7), in create-a-fighter + the look editor, rendered in 3D.
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

  // 1 · the palettes exist
  const pal = await page.evaluate(() => ({ beards: Array.isArray(BEARDS) && BEARDS.length, eyes: Array.isArray(EYE_COLORS) && EYE_COLORS.length, hasFull: BEARDS.includes('full') }));
  check('beard + eye-color palettes exist', pal.beards === 4 && pal.eyes === 7 && pal.hasFull, pal.beards + ' beards / ' + pal.eyes + ' eyes');

  // 2 · the 3D face renders MORE meshes with a beard than without (beard meshes are added)
  const beardMesh = await page.evaluate(() => {
    const count = (art) => { const g = build3DFighter(art); let n = 0; g.parts.head.traverse(o => { if (o.isMesh) n++; }); return n; };
    const baseArt = { skin: '#d8b090', skinDark: '#a08068', hair: '#222', hairStyle: 'short', accent: '#c8a060', shorts: '#26262e' };
    const clean = count(Object.assign({}, baseArt, { beard: 'none' }));
    const full = count(Object.assign({}, baseArt, { beard: 'full' }));
    const goatee = count(Object.assign({}, baseArt, { beard: 'goatee' }));
    return { clean, full, goatee };
  });
  check('a beard adds facial-hair meshes to the 3D head', beardMesh.full > beardMesh.clean && beardMesh.goatee > beardMesh.clean, `none ${beardMesh.clean} → full ${beardMesh.full}`);

  // 3 · eye color flows into the art + changes the render signature (so the preview refreshes)
  const eye = await page.evaluate(() => {
    const a1 = creatorArt(); creator.eyeColor = '#2a5278'; creator.beard = 'goatee'; const a2 = creatorArt();
    return { applied: a2.eyeColor === '#2a5278' && a2.beard === 'goatee', sigDiff: artSig(a1) !== artSig(a2) };
  });
  check('eye color + beard flow into the fighter art', eye.applied === true);
  check('changing face features busts the 3D preview cache (artSig)', eye.sigDiff === true);

  // 4 · CREATE-A-FIGHTER screen exposes BEARD + EYE COLOR controls
  const creatorUI = await page.evaluate(() => {
    goto('create');
    const html = document.getElementById('create-form').innerHTML;
    return { beard: /BEARD/i.test(html), eye: /EYE COLOR/i.test(html) };
  });
  check('create-a-fighter shows BEARD + EYE COLOR pickers', creatorUI.beard && creatorUI.eye);

  // 5 · a saved custom fighter persists beard + eyeColor, and the look editor applies them to anyone
  const persist = await page.evaluate(() => {
    creator.name = 'BEARDO'; creator.beard = 'full'; creator.eyeColor = '#2a6a44';
    saveCustomFighter();
    const spec = save.customFighters[save.customFighters.length - 1];
    const f = FIGHTERS.find(x => x.id === spec.id);
    const specOk = spec.beard === 'full' && spec.eyeColor === '#2a6a44';
    const artOk = f && f.art.beard === 'full' && f.art.eyeColor === '#2a6a44';
    // look editor on an existing brother
    const bro = FIGHTERS.find(x => !x.cpu && !x.custom && !x.admin);
    save.profiles[bro.id] = { name: 't', pin: null, look: { beard: 'goatee', eyeColor: '#7a3a3a' } };
    applyProfileLooks();
    const broOk = bro.art.beard === 'goatee' && bro.art.eyeColor === '#7a3a3a';
    return { specOk, artOk, broOk };
  });
  check('a created fighter saves its beard + eye color', persist.specOk && persist.artOk);
  check('the look editor can put a beard on any brother', persist.broOk === true);

  check('zero page/console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check('test ran without throwing', false, e.message); }

await browser.close();
const passed = checks.filter(c => c.p).length;
console.log(`\nV4.14 FEATURES: ${passed}/${checks.length} passed`);
process.exit(passed === checks.length ? 0 : 1);
