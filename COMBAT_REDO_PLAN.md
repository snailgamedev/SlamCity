# 🥊 SLAM CITY — COMBAT REDO (full 3D rebuild) · LIVING BRAINSTORM
*Started 2026-06-03. Brainstorm-only — Eli pulls the trigger to start building.*

## 0. THE MANDATE (Eli's words, 2026-06-03)
1. **Scrap the ENTIRE fighting code.** Full rewrite, not a patch.
2. **True 3D with a moving camera** that follows the player from **behind + above** ("projects the view from back-top of you") — a third-person chase / over-the-shoulder cam, not the old fixed side-view.
3. **Fighters must LOOK like their customization** — rebuild the bodies so the character-creator drives the actual 3D model.
4. Keep brainstorming in a loop until Eli says GO.

---

## 1. KEEP vs SCRAP
**SCRAP:** combat loop, hit logic, fighter rendering, old bodies, old camera, old animation.
**KEEP (re-map, don't rebuild):** roster + brother-crew identities · customization DATA (re-pointed at the new model) · faith finishers + walkout scripture · UI shell (menu, splash, **control picker**) · SW/PWA plumbing · vendored three.js (r128).

## 2. CAMERA — the "back-top follow cam" (his #1 ask)
- Third-person chase cam anchored **behind + above** the player — local offset ≈ `(0, +3.2, -5.5)`, looking slightly down at them.
- **Smooth trail:** lerp position + slerp the look target so it follows fluidly, never rigid/snappy.
- **Soft lock-on:** once engaged, frame BOTH fighters — look at the midpoint, pull back as they separate so the action's always in frame.
- **Look-ahead:** nudge the cam toward movement direction so you see where you're going.
- **Collision-aware:** raycast player→desired cam spot; pull in if a rope/turnbuckle/floor would clip.
- **Cinematic hooks:** finisher → orbit + slow-mo; entrance → ring sweep.
- Mobile = cam fully auto. PC = optional mouse/right-stick orbit on top.

## 3. FIGHTER MODEL = customization-driven procedural rig (his #3 ask)
- **Skeleton (~16 joints):** hips→spine→chest→neck→head · shoulders→elbows→wrists→hands · hips→knees→ankles→feet.
- **Geometry:** capsules/boxes per bone, scaled by body params → no external 3D model files needed.
- **Customization → model params:** skin tone · body type (lean / athletic / buff / heavy) · height · hair style+color · face features · outfit (trunks/singlet color, gear, boots, accessories) · optional logo/tattoo.
- Each **brother-crew fighter** = a preset param set matching the real person + their look.
- **Animation with NO mocap files = procedural:** code-defined keyframe poses (joint rotations) lerped through wind-up→strike→recover; **IK** for hands locking during grapples + feet planting on the mat; **ragdoll-lite** blend on knockdowns/big slams. ← this is the make-or-break for "feel."

## 4. COMBAT ENGINE (real-time)
- Fixed-timestep sim (60Hz) + interpolated render.
- **Movement:** joystick/WASD in **camera-relative** world space; accel + friction; soft auto-face toward opponent.
- **States:** idle/move · strike (light/heavy) · block · dodge/roll · clinch/grapple · throw/slam · hitstun/stagger · knockdown/getup · pin/submit · finisher.
- **Hit detection:** active-frame hitboxes on limbs vs hurtbox capsules; facing + proximity gate; ignore self.
- **Health + momentum/stamina meter** (gates specials + unlocks the finisher).
- **Knockback + hitstop** scale with hit weight; ragdoll impulse on slams.
- **Win conditions (wrestling!):** PIN (knockdown→hold→kickout meter) · SUBMIT (clinch→submission→tap meter) · KO (health). Mixable per match.

## 5. MOVESET (wrestling, brother-crew flavor)
- **Universal:** jab · heavy · grab/clinch · irish-whip · body slam · suplex · throw · block · dodge · taunt · signature · finisher.
- **Per-fighter signatures + finishers** tied to identity (power bro = slam; quick bro = aerial; gospel-tier = scripture-strike finisher per existing lore).
- **Depth:** light→light→heavy strings · grapple chains · reversal window (well-timed block/dodge → counter).

## 6. FEEL / JUICE (peak — never ship the plain version)
Hitstop · screen shake · camera punch-in · impact sparks/sweat/dust · layered sound · slow-mo finisher · crowd swell · rope & ring flex · dynamic music. **Faith layer:** walkout scripture + scripture-strike finishers at high tiers — gentle, the G leads, never forced.

## 7. CONTROLS (cross-platform — reuse the existing picker)
- **Mobile:** left joystick move · right cluster strike/grapple/block/special · finisher button lights when ready.
- **PC:** WASD move · mouse-look cam · action keys · optional gamepad.

## 8. ARCHITECTURE (modules)
SceneManager · CameraRig · Fighter(model+rig+state) · AnimationController(procedural) · CombatSystem · InputController · AIController · MatchManager(rules/win) · FX/Juice · AudioManager · **CharacterBuilder(customization→model)**.
*Decision pending: keep SC single-file (modular IIFE sections, matches deploy model) vs split files. Lean single-file.*

## 9. PHASING (each stage playable)
- **P1** 3D ring + chase cam + one gray-box fighter moving.
- **P2** CharacterBuilder — customization drives the body; load the crew.
- **P3** Core strikes + hit detection + health + feel (hitstop/shake).
- **P4** Grapples/slams/throws + ragdoll-lite.
- **P5** Opponent AI.
- **P6** Win conditions (pin/submit/KO).
- **P7** Signatures/finishers + faith layer + entrances.
- **P8** Polish · juice · balance · mobile perf.

## 10. RISKS / HARD PARTS
- **Procedural animation quality** (no mocap) — make-or-break for feel.
- **Mobile perf** — 3D + two rigged fighters + shadows; need LOD + a frame budget.
- **Customization→3D fidelity** (faces) — go stylized/arcade, not realistic; manage scope.
- **Grapple sync** — two bodies locked together via IK + shared state.

## 11. OPEN QUESTIONS FOR ELI (noted, NOT blocking the brainstorm)
- 1v1 only, or tag/multi-man?
- Customization depth: full creator vs curated presets?
- Look: stylized/arcade vs going-for-realistic?
- Match types: exhibition / pin-only / submission / story mode?
- Any move or fighter that MUST be in for it to feel like Slam City?

---

## 12. DEEP DIVE — PROCEDURAL ANIMATION SYSTEM (the make-or-break)
**Pose format:** a `pose` = a map of `jointName → { quat }` (local rotation), plus an optional root offset. Stored as plain code objects — no files. A neutral `GUARD` pose is the home base.
**Move = timed keyframe track:** e.g. `JAB = [{t:0,pose:GUARD},{t:0.08,pose:WINDUP_R},{t:0.14,pose:EXTEND_R},{t:0.30,pose:GUARD}]` (seconds + easing per segment).
**AnimationController (per frame):**
- Find the active segment for the current move's clock; **slerp** each joint quat between the two keyframes by an eased `t` (easeOutCubic for strikes = snappy).
- **Cross-fade** between moves over ~100ms so transitions never snap (blend old final pose → new pose track).
- **Layered/additive:** base layer = locomotion (procedural walk/run cycle driven by speed); upper-body layer = actions, so you can throw while moving. Per-layer weights; upper-body overrides lower on full-body moves (slams).
- **Idle life:** low-amp procedural sway + breathing noise so a standing fighter is never frozen.
**IK (two-bone analytic solver, cheap):**
- **Grapple hands:** solve shoulder→elbow→wrist so the hand reaches a world target (collar tie / lock-up / grip point on opponent). The grabbed fighter's limb is IK'd to match the grabber's hand = hands actually connect, not clip.
- **Foot planting:** raycast down from each hip; plant the foot on the mat surface, solve knee bend, align ankle. Kills foot-sliding/floating during stance + lunges.
**Ragdoll-lite (mobile-safe hybrid, NOT full rigid-body):** on knockdown/big slam, blend animated pose → a physics-flavored fall: apply an impulse + lean, run a few verlet-constrained limb points for flop, settle. Blend back to animated on get-up. Cheaper than a real ragdoll solver, reads as "got dropped."
**Move chaining / buffering:** once a move enters its recovery window, an **input buffer** lets the next queued move start early (cross-faded) = combos. **Cancel windows** allow dodge/block to interrupt recovery (the reversal skill-expression). Directional **hit-reaction** poses (front/left/right) blend in on getting hit; stagger + flinch as light reactions, knockdown as heavy.

## 13. DEEP DIVE — CHARACTERBUILDER (customization → model)
**The "DNA" object (one per fighter, the single source of look):**
```
dna = {
  body:   { heightScale:0.9–1.15, build:'lean|athletic|buff|heavy', shoulderW, headScale },
  skin:   { tone },
  hair:   { style:'bald|short|afro|braids|fade|long', color },
  face:   { brow, eyes, facialHair, expression },   // stylized/low-poly, simple
  outfit: { type:'trunks|singlet|tights', primary, secondary, boots, gear:[kneepads|wristbands|mask|belt], emblem },
  extras: { tattoo, warPaint, entranceGear }
}
```
**`buildFighter(dna) → THREE.Group`:** scales skeleton bones from `body` (height/build → limb girth + torso width), sets skin/outfit **material colors**, attaches prebuilt primitive meshes for hair/gear onto the right joints, applies the stylized face. Pure params → rig; deterministic.
**Brother-crew presets:** each real person = a `dna` preset capturing their build + look + signature colors, stored in a `CREW` array re-mapped from the existing roster identity data. Headline **AARON** = flagship preset. Players build customs via the SAME schema → same builder.
**Live preview = the promise:** the customization screen renders the EXACT same rig under the chase cam (or a turntable). **What you build is literally who walks out** (Eli's core ask). DNA persists to localStorage; crew presets ship in code.
**Faith hook:** gospel-tier fighters carry their walkout scripture + scripture-strike finisher in their preset (the G rides in the DNA, gentle, never forced).

## 14. DEEP DIVE — CAMERA MATH (the "back-top follow cam")
**Framing axis:** when an opponent is locked, the cam frames along the **opponent→player** line (sits behind the player, looking past them toward the foe). `dirAwayFromFoe = normalize(player.pos - foe.pos)`.
**Desired position:** `camDesired = player.pos + dirAwayFromFoe*backDist + UP*height`. Free-roam (no foe) falls back to player-local offset `(0, +3.2, −5.5)`.
**Separation scaling:** `backDist = base + sep*kBack`, `height = baseH + sep*kH` (sep = distance between fighters) → as they spread, cam eases back + up so BOTH stay in frame; tight when clinched.
**Look target:** biased toward the **midpoint** of the two fighters (`lerp(player, midpoint, 0.5)`) so neither leaves frame. Add **look-ahead**: `+ player.velocity * lead`.
**Frame-rate-independent smoothing:** `cam.pos = lerp(cam.pos, camDesired, 1 − exp(−rate*dt))`; orientation via **slerp** toward the lookAt quaternion (separate, slower rate so rotation trails position slightly = natural).
**Collision pull-in:** raycast from the look-anchor → camDesired; on hit (rope/turnbuckle/floor/wall), seat cam at `hit − skin`. Smooth the pull-in AND the return so it doesn't pop.
**Polish:** small **dead-zone** so micro-jitter doesn't move the cam · **pitch clamp** (never under the mat / over the top) · subtle **FOV punch** (+2–3° eased back) on heavy hits.
**Cinematic states:** FINISHER → detach from follow, **orbit** the action on an arc + drop time-scale (slow-mo) + lower FOV, then ease back to follow. ENTRANCE → scripted spline sweep of the ring. Mobile = all automatic; PC = optional mouse/right-stick orbit layered on top.

## 15. DEEP DIVE — COMBAT STATE MACHINE
**States:** IDLE · MOVE(walk/run) · STRIKE_LIGHT · STRIKE_HEAVY · BLOCK · DODGE(roll/sidestep) · CLINCH(lock-up) · GRAPPLE_MOVE(slam/suplex/throw: windup→execute) · HITSTUN(light) · STAGGER(heavy) · KNOCKDOWN · GETUP · PIN_ATTEMPT/PINNED · SUBMISSION/SUBMITTED · FINISHER · WIN/LOSE.
**Frame-data model (per action):** **STARTUP** (windup, no hitbox) → **ACTIVE** (hitbox live, can connect) → **RECOVERY** (vulnerable; cancelable in the cancel window). Each phase a set duration → readable, learnable timing.
**Boxes:** hurtbox always on (shrinks during DODGE i-frames); **hitbox only during ACTIVE frames**, parented to the striking limb.
**Transition rules:**
- IDLE/MOVE → any action on input.
- **RECOVERY cancel window:** defensive cancel → DODGE/BLOCK; offensive cancel → next buffered combo move.
- **On hit received:** → HITSTUN / STAGGER / KNOCKDOWN by hit-weight vs a balance meter; interrupts current action UNLESS in **hyper-armor** frames (some heavies).
- **DODGE:** i-frames during ACTIVE; whiff recovery is punishable.
- **BLOCK:** cuts damage + chip; **perfect-block** (early frames) → parry → free counter window.
- **CLINCH:** both lock; timing/mash mini-contest decides who gets GRAPPLE_MOVE; loser has a reversal window.
- **KNOCKDOWN:** opponent may PIN_ATTEMPT (→ kickout meter) or keep striking; downed fighter has a getup option w/ brief i-frames.
**Meters:** HEALTH · STAMINA (gates dodge-spam/specials) · MOMENTUM/FINISHER (fills on offense+defense; unlocks FINISHER). Input model = state machine consumes **buffered** inputs; each state declares accepted inputs + their transitions.

## 16. DEEP DIVE — AI BEHAVIOR
**Core principle = FAIR:** the AI uses the **same state machine + inputs as the player** ("presses buttons"). Difficulty scales *reaction + decision quality + aggression* — NOT secret damage/stat cheating.
**Brain = lightweight utility FSM, ticked every ~N ms (not per-frame):** evaluates distance-to-player, player's current state (attacking? recovering? blocking?), own health/stamina/momentum → picks an action by weighted utility (+ a human-feel delay).
**Behavior states:** APPROACH (close gap) · SPACING/FOOTSIES (hover at range, bait) · STRIKE (in range → string) · GRAPPLE (close → clinch attempt) · DEFEND (block/dodge under threat) · PUNISH (react to player whiff/recovery) · RETREAT (low HP/stamina → make space, recover) · TAUNT (when dominant).
**Reaction time = the main difficulty lever** (feels fair, mirrors reflex): ~200ms ROOKIE → ~90ms ELITE before responding to player actions.
**Footsies:** AI holds a preferred range, dances in/out, pokes to bait a whiff, then **whiff-punishes** during the player's recovery.
**Tiers:** ROOKIE (slow, rarely blocks, simple strings) → … → ELITE/boss (fast reads, blocks/parries, mixups, grapple reversals, smart finisher use).
**Personality profiles** (per brother-crew fighter): aggression · patience · grapple-preference · risk → the crew feels distinct; bosses get signature aggression.
**Anti-frustration:** AI leaves deliberate openings, doesn't perfect-read every input. Honest difficulty, not input-reading cheese.

## 17. DEEP DIVE — MOBILE PERFORMANCE BUDGET
**Target:** 60 FPS on modern phones, graceful **30 FPS floor** on low-end (~16ms / ~33ms frame budgets).
**Scene scope:** 2 rigged fighters + ring + crowd impostors + minimal props. Keep **draw calls <~80**, tris modest.
**Geometry:** each fighter = **merged** primitive meshes (1–2 draw calls via merged BufferGeometry + few materials). Ring = one static merged mesh. **Crowd = instanced/billboard impostors**, never real models.
**Shadows:** ONE directional light + ONE shadow map (1024, drop to 512 low-end), tight frustum around the ring; on low-end swap real shadows for a **blob/decal contact shadow** under each fighter.
**Lighting/materials:** 1 directional + hemisphere/ambient; avoid many dynamic lights + heavy PBR maps (cheap Lambert/Standard).
**Adaptive quality auto-scaler:** watch FPS; on sustained dips → lower shadow res → disable shadows → cut particles → clamp `setPixelRatio` (1.5 → 1) → simplify crowd. Ramps quality to the device.
**three.js levers:** clamp devicePixelRatio · frustum culling · instancing (crowd/particles) · reuse geometries/materials · **object-pool** all FX · AA off (or cheap FXAA) on low-end · `powerPreference:'high-performance'` · dispose on scene change.
**Cheap by design:** procedural anim = quat math on ~32 joints/frame (negligible) · two-bone IK is O(1) · **no heavy physics lib** — custom capsule overlaps + simple impulses + few-point verlet for ragdoll-lite.

## 18. DEEP DIVE — FAITH-LAYER INTEGRATION (the G leads, never forced)
**Rules:** KJV/canonical ONLY — never alter or fabricate the Word. The G **leads** but is never preachy/stamped/forced (honors the-g-doctrine + user-faith anti-patterns). Dose = **LIGHT-MEDIUM** (brother-crew family game for Aaron).
**Walkout scripture:** ~5–8 of the crew carry a gentle walkout verse (lower-third, brief) during entrance, tied to their character — not every fighter, not a sermon.
**Scripture-strike finisher:** gospel/Goliath-tier ONLY — a verse beat flashes on the big finishing moment. Rare, earned, gentle.
**Grace-note placement:** loading screens · a quiet victory-screen blessing · the occasional verse — woven into boring spots, never shoved between the player and the action.
**Brother-crew witness:** clean by design (no gore / no real-money gambling), warm ribbing not malice; **Pastor / Mary / Prophet** gospel-tier characters carry the heaviest dose; scripture reads as the crew's REAL faith, not a gimmick.
**Data:** each fighter's `dna` carries its `walkoutVerse` + (if gospel-tier) `finisherScripture`, pulled exact from the scripture library. See [[feedback_scripture_library]] [[user_faith]] [[the-g-doctrine]].

## 19. DEEP DIVE — MATCH / WIN FLOW + ENTRANCES
**Setup:** pick mode (exhibition / pin-only / submission / KO / story) → fighter(s) + opponent → venue → rules (time limit, fall count). 
**Fighter select = the live-preview rig:** the chosen fighter renders in 3D (turntable/chase cam) EXACTLY as customized → what you see is who walks out (Eli's core ask, surfaced here).
**Entrance/walkout:** cinematic cam **spline sweep** · fighter enters the ring · name + (gospel-tier) walkout scripture lower-third · signature pose · music. **Skippable.**
**Round/match flow:** bell → real-time combat → win by **PIN** (knockdown→cover→kickout meter) · **SUBMIT** (clinch→submission→tap meter) · **KO/TKO** (health) · optional time-limit→decision. Single fall or best-of.
**Victory + POTG moment:** winner pose · cam orbit · **slow-mo replay of the finishing blow** (a "Play of the Game" beat — same flavor Eli loves in the Hawks/MyGM POTG) · stats card (damage, biggest hit, reversals) · faith beat if gospel-tier.
**After:** rematch · change fighter · menu. **Story mode** = ladder through the crew → boss (Goliath-tier scripture-strike). Results/unlocks/records persist to localStorage.

## 20. DEEP DIVE — AUDIO DESIGN
**Discipline first (the bug we just killed in CK + WordUp):** AudioContext **resume()** in the getter + one-time gesture unlock + resume-on-`visibilitychange` → SC sound never cuts out on mobile. Bake it in from line 1. See [[feedback_web_audio_overlap]].
**SFX categories:** strikes (light/heavy thuds) · grapples (grab/lift/slam) · body-fall · blocks (thud/clang) · swing/dodge whoosh · rope twang · crowd (ambient bed + swells + cheers/boos) · bell (round start/end) · finisher stinger.
**Impact-weight layering:** a hit = stacked layers (low thud + mid flesh + high snap) scaled by damage — bigger hit = more layers, lower pitch, longer tail; **synced to hitstop** so the freeze lands on the audio peak.
**Dynamic music:** intensity bed that rises with momentum/round state · **filters/drops during slow-mo finisher** · victory theme · gospel-tier boss carries an orchestral/worship-tinged cue (snail-game boss-music precedent).
**Mix:** master gain · music **ducks** under big SFX · per-category volume + mute toggle (persisted) · cheap stereo pan by fighter screen-x. Mobile = small pooled buffers, respect the resume discipline.

## 21. DEEP DIVE — UI / HUD LAYOUT
**Law:** UI **NEVER covers the action** (ui-overlay-law). HUD lives at the screen edges; the center/upper stays clear for the fighters (the chase cam frames them center-upper, so a **bottom control band is safe**).
**In-match HUD:** top corners = each fighter's **HEALTH** bar + name + portrait; **STAMINA** bar beneath; **MOMENTUM/FINISHER** meter that glows + flashes "FINISHER READY" when full; small round/timer center-top.
**Contextual meters:** pin **kickout-mash** bar / submission **tap** bar appear only during those states, centered-low, unmistakable.
**Mobile controls:** left **joystick** bottom-left · action cluster bottom-right (strike/grapple/block/special + finisher) · semi-transparent, thumb-reach, never over the fighters. Per [[feedback_cross_platform_default]] + [[feedback_all_device_friendly]].
**PC:** minimal on-screen (kb/mouse), HUD bars only, controls hint on pause.
**Readability:** high-contrast bars · optional damage numbers · hit-direction indicator · low-health pulse · **never-cut text (word-wrap)** · safe-area/notch insets · scales to viewport.
**Pause/settings overlay:** resume · rematch · quit · controls · volume · quality toggle.

## 22. DEEP DIVE — V4.x MIGRATION / ASSET-SALVAGE (verified against the 6,115-line index.html)
**Reality check (from code):** SC's "REAL 3D" today is **CSS/SVG fighters** (`.ring-fighter svg`, `.f3d-inner` CSS-3D transforms) + CSS-transform movement — three.js is loaded (line 33) but **NOT driving the fighters.** That's precisely why a true-WebGL rebuild is needed (not a patch).
**KEEP / salvage (re-map, don't rebuild):**
- **UI shell** = the screen system: `#platform` (control picker), `#hub`, `#settings`, `#rankings`, `#faith`, `#profile`, `#roster` — whole menu/nav skeleton stays.
- **Faith systems** (gold): `walkout-intro` + walkout scripture data · `finisher-reverence` (scripture finisher) · `result-scripture` · scripture captions → re-point at the new match flow.
- **Roster/fighter IDENTITY data** (names, class/sport, signature + finisher names, walkout verses) — the DATA feeds the new `dna` presets.
- Control-picker UI · SW (sc-v3, just fixed) + manifest/PWA · pa-hub back-link · the gold/wrestling theme + fonts.
**GUT / replace:** CSS/SVG fighter rendering · CSS-3D `.f3d-inner` · CSS-transform ring · CSS-position movement + the old hit logic · joystick→CSS glue → all become the WebGL scene + procedural rig + CombatSystem + camera-relative movement.
**Gut without breaking the shell:** menus are `class="screen"` toggles; the **match is just one screen**. Drop a `<canvas>`+WebGL into the match screen and leave every other screen intact. New engine = isolated modules that mount into the match screen; menu→match→result flow survives.
**Single-file vs split — DECISION: keep single-file** (matches deploy + SW shell-cache, no build step), organized as clearly-delimited IIFE module sections (SceneManager/Fighter/Camera/Combat/…). Externalize later only if size forces it.
**Approach:** build the new 3D match behind a new screen ALONGSIDE the old → land P1 → swap the match screen over → delete old combat/CSS-fighter code once at parity. Salvaged shell stays throughout = low-risk migration.

## 23. DEEP DIVE — PER-PLATFORM CONTROLS (reuse #platform picker + existing .joystick)
**MOBILE:** left-thumb **joystick** (analog dir + magnitude → camera-relative move speed). Right cluster: **STRIKE** (tap=light, hold/double=heavy) · **GRAPPLE/GRAB** · **BLOCK** (hold) · **SPECIAL/SIGNATURE** · **FINISHER** (lit when ready). Dodge = joystick flick+block or a dedicated button. Haptics (`navigator.vibrate`) on hit. Buttons semi-transparent, thumb-zone, never over fighters.
**PC/MAC:** WASD/arrows move (camera-relative) · mouse = camera look/orbit · J/K/L or mouse buttons = light/heavy/grab · Shift/RMB = block · Space = dodge · Q/E = special/finisher · ideally rebindable.
**Gamepad (optional, Gamepad API):** L-stick move · R-stick camera · face buttons strike/grab/block/special · triggers heavy/finisher.
**Input buffering:** every input → a ~150ms buffer the state machine consumes → combos/cancels feel responsive regardless of frame timing.
**Feel:** joystick deadzone + response curve · dodge coyote-time · button priority (block > strike) on overlap. Reuse the existing `#platform` PC/MAC-vs-MOBILE auto-detect picker to route the scheme.

## 24. P1 FIRST-BUILD SLICE (the proof-of-concept milestone — 0 combat)
**Goal:** prove the 3D foundation + camera + movement FEEL before any fighting is built on top.
**Scope:** three.js `WebGLRenderer` + scene + **static ring** (mat, ropes, posts, turnbuckles) + 1 directional light + shadow · **ONE gray-box rigged fighter** (~16-joint capsule/box skeleton) with the procedural walk/run cycle · the **chase cam** (back-top follow, smoothing, look-ahead, collision pull-in — no lock-on yet, only 1 fighter) · **movement** (joystick mobile / WASD PC, camera-relative, accel/friction, **foot-plant IK**) · mounted into the salvaged match screen, routed by the control picker · FPS meter + perf-scaler stub.
**Acceptance criteria (eyes-on verified, mobile + PC):** 60fps desktop / ≥30fps mid phone, 0 console errors · fighter moves fluid, **feet plant (no sliding)**, walk/run reads · chase cam follows smooth from back-top, leans into movement, pulls in at ropes, never clips under the mat · works via the picker on both platforms · no horizontal scroll, notch-safe.
**What it proves:** the hardest unknowns up front — WebGL on mobile at framerate + the procedural rig + the signature camera + movement feel. If **P1 feels good, everything else is additive.** If cam/perf/rig feel is off, we learn it cheap — before building combat on top.

## 25. HONEST SCOPE / EFFORT + RISK REGISTER (real talk)
**This is a ground-up 3D game engine in the browser, single-file, no mocap — the biggest build in the arcade by far.** Multi-session, phased; NOT a one-shot. I won't pretend otherwise.
**Per-phase weight (relative, honest):** P1 scene+cam+rig = heavy foundation (riskiest learning, do first) · P2 CharacterBuilder = medium · P3 strikes+hit+feel = large (combat core) · P4 grapples/slams/ragdoll = large (IK sync, finicky) · P5 AI = medium · P6 win conditions = medium · P7 signatures/finishers/faith/entrances = medium · P8 polish/balance/perf = ongoing long tail.
**Make-or-break (watch these or scope-adjust early):** ① procedural-animation FEEL · ② mobile perf with 2 rigs + shadows · ③ chase-cam feel · ④ grapple IK sync.
**Risk register → mitigation:** anim stiff/floaty → nail P1 walk + one strike, eyes-on iterate before scaling · mobile FPS tanks → perf budget + auto-scaler from P1, test on a real mid phone · custom faces hard → go stylized/low-poly, set expectations · single-file size balloons → monitor, externalize modules if forced · scope creep (it's huge) → ship each phase PLAYABLE + eyes-on gate + Eli checkpoint.
**Ship gates per phase ([[feedback_pre_ship_gameplay_gate]]):** each phase ends with headless Playwright + screenshot eyes-on (mobile+PC) · 0-error console · perf check · **Eli checkpoint for feel/taste** (PLATINUM is his call). No phase ships blind.

---

## ✅ STATUS: DOC IS BUILD-READY
§0–§25 cover mandate · keep/scrap · camera · rig · animation · CharacterBuilder · combat engine + state machine · moveset · AI · perf · faith · match flow · audio · HUD · controls · verified migration · P1 slice · scope/risk. **When Eli pulls the trigger → lock the plan + start P1.** Remaining loops = consolidate open decisions for Eli + any deeper polish, light touch.

---

## 26. 🎯 OPEN DECISIONS FOR ELI (answer fast → I start P1)
*Each has my recommended default so we can move even if you just say "go with your calls." ⭐ = my rec. 🔴 = genuinely needs YOU (can't default well).*

1. **Match format:** ⭐ **1v1 first** (ship it), tag/multi later · or tag from the start?
2. **Customization rollout:** ⭐ **crew presets first** (ships looking right), then open the **full creator** on the same `dna` schema · or full creator immediately?
3. **Art direction:** ⭐ **stylized-arcade** (mobile-perf friendly, matches SC's gold/wrestling vibe, realistic faces are brutal in-browser) · or push toward realistic?
4. **Match types (first build):** ⭐ **exhibition + KO + pin** · add submission + story-ladder later?
5. 🔴 **Must-have moves/fighters:** which are non-negotiable to feel like Slam City? (e.g., **AARON's signature**, the gospel-tier scripture finisher). I need your bar here.
6. **Single-file:** ⭐ **keep one index.html** (IIFE module sections, no build step) · or split files?
7. 🔴 **Vibe/tone:** how gritty vs arcade-fun? music style? crowd energy? — shapes the whole feel; want your read.
8. **PC camera:** ⭐ **auto follow-cam with optional manual orbit** · or manual-heavy?
9. **Build cadence:** ⭐ **phased, each playable + your checkpoint** (P1→P8) · or push further before showing you?
10. 🔴 **The "THAT'S Slam City" thing:** the one feeling/moment that, if nailed, makes you say yes — name it so P1 aims at it.

**Fast path:** if you just say *"go with your calls,"* I run all ⭐ defaults and only stop to ask on the 🔴 three (must-have moves/fighters · vibe/tone · the "THAT'S it" moment) — those genuinely need your voice.

---

## APPENDIX A — CONCRETE P1 STARTING NUMBERS (so P1 isn't guesswork)
*Units: 1 three.js unit = 1 meter. Tunable, but these are sane defaults to build against.*
- **Ring:** 6×6 m mat, height 1.0 m off floor; 4 corner posts ~1.6 m; 3 ropes at y ≈ 0.4 / 0.8 / 1.2 m above the mat. Camera floor plane below for shadow.
- **Skeleton (athletic base, total height ~1.85 m):** head 0.23 · neck 0.07 · torso hips→chest 0.55 · upperArm 0.30 · forearm 0.27 · hand 0.18 · thigh 0.45 · shin 0.43 · foot 0.26. ~16 joints.
- **Walk cycle (procedural):** `phase = t * freq` (freq scales with speed); legs offset by π; thigh swing ≈ sin(phase)*25°, knee bend ≈ max(0, sin(phase+0.5))*45° (or IK foot target on a stretched ellipse), arms counter-swing ≈ sin(phase)*18°, subtle hip roll + torso bob ≈ sin(2·phase)*0.03 m. Run = higher freq + bigger amplitudes.
- **Chase cam constants:** base local offset (0, +3.2, −5.5) · `backDist = 5.5 + sep*0.4` · `height = 3.2 + sep*0.25` · posLerpRate ≈ 8/s, lookLerpRate ≈ 5/s (rotation trails position) · lookAhead = velocity*0.15 · FOV 55° (punch +2–3° on heavy) · collision skin 0.3 m · pitch clamp [−10°, −45°] looking down.
- **dna → bone scale:** `heightScale` (0.9–1.15) multiplies ALL bone lengths · build radius mult: lean 0.85 / athletic 1.0 / buff 1.2 / heavy 1.4 on limb+torso capsule radii · `shoulderW` scales clavicle spread · `headScale` the head only.
- **Movement feel:** walk ≈ 2.5 m/s, run ≈ 5 m/s · accel ≈ 18 m/s² · friction ≈ 12 m/s² · joystick deadzone 0.12, response curve squared.

## APPENDIX B — SAMPLE FRAME-DATA (starting balance, ms · tune in P3+)
| Move | Startup | Active | Recovery | Dmg | On-hit | Stamina | Notes |
|---|---|---|---|---|---|---|---|
| Jab (light 1) | 80 | 60 | 140 | 4 | tiny push | 4 | cancels into combo |
| Cross (light 2) | 100 | 70 | 160 | 6 | small push | 5 | chains from jab |
| Haymaker (light 3) | 160 | 80 | 240 | 11 | stagger | 9 | combo finisher |
| Heavy strike | 220 | 90 | 320 | 14 | knockback | 12 | **hyper-armor** in active |
| Grab/clinch | 120 | 90 | 220 | 0 | → CLINCH | 8 | whiff is punishable |
| Body slam (from clinch) | 400 | 350 | 500 | 18 | **knockdown** | 18 | reversible in early window |
| Suplex (from clinch) | 450 | 380 | 520 | 20 | knockdown | 20 | bigger arc |
| Dodge roll | 60 | 220 (i-frames) | 200 | — | — | 14 | invuln during active |
| Block | 0 (hold) | — | 120 (release) | — | chip only | drains on hit | first 80ms = **perfect-block → parry** |
| Finisher | 300 (cinematic) | big | low | massive | finishing | full meter | only when MOMENTUM full |

Read: STARTUP = windup (no hitbox) · ACTIVE = hitbox live · RECOVERY = vulnerable/cancelable-in-window. Lights are safe + comboable; heavies hit hard but punishable on whiff/block; grapples are commit-heavy with reversal windows = the risk/reward spine.

## APPENDIX C — SINGLE-FILE MODULE SKELETON (IIFE sections, build/dependency order)
*All within one index.html as delimited sections. Salvaged menu shell stays separate. "First needed" = the phase that first requires it.*
1. **Core/Loop** — fixed-timestep sim + interpolated render, RAF, clock, global state. → P1
2. **SceneManager** — WebGLRenderer, scene, lights, ring mesh, shadow, floor. → P1
3. **CameraRig** — chase-cam follow + (later) lock-on/collision/cinematic. → P1
4. **Skeleton/Fighter** — joint hierarchy, transforms, capsule/box geometry. → P1
5. **AnimationController + IK** — pose tracks, blend/cross-fade, two-bone IK, ragdoll-lite. → P1 (walk) · P3 (strikes) · P4 (ragdoll)
6. **CharacterBuilder** — `dna`→rig, crew presets, live preview. → P2
7. **InputController** — mobile joystick/buttons + PC/gamepad + 150ms buffer. → P1 (move) · P3 (actions)
8. **CombatSystem + StateMachine** — states, frame-data, hitboxes, damage, meters. → P3
9. **AIController** — utility brain driving the same state machine. → P5
10. **MatchManager** — setup, rounds, win conditions, flow, persistence. → P6
11. **FX/Juice** — hitstop, screen-shake, particles, slow-mo. → P3
12. **AudioManager** — WebAudio + resume discipline, SFX/music. → P3
13. **HUD/UI** — bars, meters, mobile control overlay, pause. → P3
14. **Bootstrap** — wires modules, mounts canvas into the match screen, starts the loop. → P1

**P1 needs only 1–5, 7 (move-only), 14.** That's the whole proof-of-concept surface — small, focused, and it de-risks everything downstream.

---
*Doc complete (§0–§26 + Appendices A–C). Build-ready. Holding for Eli's trigger.*
