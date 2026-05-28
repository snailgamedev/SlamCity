/* 🎯 PEAK PAIR FINDER — Coda can't see his own live spinner (the harness renders verb+tip
   independently in Eli's terminal). So this reads the spinner pools from ~/.claude/settings.json,
   tags every verb + tip by theme, finds every verb→tip combo that PAIRS (shares a theme = a Peak Pair),
   prints the catalog, and renders a montage PNG so Eli can SEE what the pairs look like.
   Run:  node peak-pairs.mjs            (catalog only)
         node peak-pairs.mjs --shot     (also render /tmp/peak-pairs.png) */
import fs from 'fs';
import os from 'os';

const S = JSON.parse(fs.readFileSync(os.homedir() + '/.claude/settings.json', 'utf8'));
const verbs = (S.spinnerVerbs?.verbs) || [];
const tips  = (S.spinnerTipsOverride?.tips) || [];

// theme → keyword/emoji signals (lowercased substring match)
const THEMES = {
  CAGEE:  ['cagee','complex','advanc','gospeliz','extend','expand','700%'],
  PAS:    ['pas','professional','accurate','sweep','verif','double-check','accuracy'],
  GISS:   ['giss','generational','inspir','sustain','legacy','future-proof'],
  SBCMS:  ['sbcms','bench','merge','split','dispatch','✂️'],
  LICU:   ['licu','lock in','lockin','cook up','locked in'],
  Cooking:['cook','chef','season','simmer','bake','bakin','recipe','stir','🍲','🍳','🧂','🔪','🥘','🌶','🍔','🍪','plate','dish'],
  Hoops:  ['dunk','hoop','basketball','dribble','crossover','three','buzzer','poster','splash','court','ankle','and-one','lob','lockdown','heater','drainin','🏀','🥅'],
  Faith:  ['gospel','faith','rock','glory','spirit','blessing','bless','pray','word','christ','jesus','firstfruit','steward','🙏','✝','🕊','⛰'],
  Coin:   ['coin','treasur','jackpot','kingdom','rank','wheel','dice','plinko','bank','tax','cash','crown','loot','chest','odds','🪙','🎰','🎲','👑','💰','🧲'],
  Brain:  ['brain','puzzle','🧠'],
  Snail:  ['snail','🐌'],
  Music:  ['riff','remix','beat','melody','rhythm','coda','acapella','🎸','🎼','🎹','🥁','🎧','🎵','🎤'],
  Arcade: ['peak arcade','install','offline','hub','more games'],
  Cards:  ['shuffl','♟','⭕','🃏','plottin'],
  Mechanic:['wrench','engine','tire','gear','soap','🔧','🏎','⚙️','🛞'],
  Honesty:['honest','trust','rate','plain english'],
};
const tag = (s) => { const l = s.toLowerCase(); const out = []; for (const [t, ks] of Object.entries(THEMES)) if (ks.some(k => l.includes(k))) out.push(t); return out; };

const vTags = verbs.map(v => ({ v, t: tag(v) }));
const tTags = tips.map(v => ({ v, t: tag(v) }));

// every qualifying pair, grouped by shared theme
const byTheme = {};
let pairCount = 0;
for (const vt of vTags) for (const tt of tTags) {
  const shared = vt.t.filter(x => tt.t.includes(x));
  if (shared.length) { pairCount++; const th = shared[0]; (byTheme[th] ||= []).push([vt.v, tt.v]); }
}

const totalCombos = verbs.length * tips.length;
console.log(`\n🎯 PEAK PAIR FINDER`);
console.log(`pools: ${verbs.length} verbs × ${tips.length} tips = ${totalCombos} possible spinner frames`);
console.log(`qualifying Peak Pairs: ${pairCount}  (~${(100*pairCount/totalCombos).toFixed(1)}% of all frames will pair)\n`);
const themesSorted = Object.entries(byTheme).sort((a,b)=>b[1].length-a[1].length);
for (const [th, pairs] of themesSorted) {
  console.log(`  ${th}: ${pairs.length} pairs`);
}
console.log(`\n── sample Peak Pairs (one per theme) ──`);
const samples = themesSorted.map(([th, pairs]) => ({ th, pair: pairs[Math.floor(Math.random()*pairs.length)] }));
samples.forEach(({th, pair}) => console.log(`  [${th}]  ${pair[0]}  ⟢  ${pair[1]}`));

// optional: render a montage so Eli SEES the pairs
if (process.argv.includes('--shot')) {
  const { chromium } = await import('playwright');
  const cards = samples.slice(0, 8).map(({th, pair}) => `
    <div class="card"><div class="th">${th}</div>
      <div class="verb">⠋ ${pair[0]}</div>
      <div class="tip">${pair[1]}</div></div>`).join('');
  const html = `<html><body style="margin:0;background:#0d0d12;font-family:ui-monospace,Menlo,monospace;padding:18px">
    <div style="color:#ffd76e;font-size:20px;font-weight:900;margin-bottom:14px">🎯 PEAK PAIRS — verb ⟢ tip that actually match</div>
    ${cards}
    <style>.card{background:#16161f;border:1px solid #2a2a3a;border-radius:10px;padding:12px 14px;margin-bottom:10px}
      .th{color:#7c5cff;font-size:10px;letter-spacing:2px;margin-bottom:6px}
      .verb{color:#ff8a5c;font-size:15px;font-weight:800;margin-bottom:4px}
      .tip{color:#cdd6ea;font-size:12px}</style></body></html>`;
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport:{width:560, height:60+samples.slice(0,8).length*92} })).newPage();
  await p.setContent(html); await p.waitForTimeout(150);
  await p.screenshot({ path:'/tmp/peak-pairs.png', fullPage:true });
  await b.close();
  console.log('\n📸 montage saved → /tmp/peak-pairs.png');
}
