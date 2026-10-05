# Ticket 198: Battle VFX, second pass (follow-on to 194k)

**Type:** battle feel (VFX), presentation only, no `src/engine` change. **Status:** opened 2026-10-05; **198b built 2026-10-05** (five commits, 198b-1 to 198b-4 and 198c, on `ticket-194`). Waits for Henry to sign off the `results/198/` sheets (198c).

**Henry (2026-10-05):** *"I don't like the vfx fixes. Please make a follow on card, but make it ticket 197."* (Numbered 198 at his next instruction: *"increment those tickets by one."*) On the open stage-dim question: *"Leave it for now."* On the multi-hit freeze: *"Keep it as is."*

**Where it comes from.** [194k](194-henry-playtest-2026-10-04.md) set out to make the game look like the Battle Juice Lab (*"Basically I wanted everything to look like the lab"*). It was built on 2026-10-05 as eight commits (194k-1 to 194k-8) and gated on logic tests plus a set of captures. Henry looked at the result and does not like it. The 194k commits are **left in place**; this ticket decides whether to tune them or take them out.

---

## What 194k changed (the knobs this ticket can turn)

| Part | What it did | Where |
|---|---|---|
| 194k-1 | Damage scale `s` re-tuned from 0.45 to 0.15 of max HP, so a median hit (4% of max HP) is s = 0.54. Pours are longer. | `FULL_HIT_FRACTION`, `damageScale` in `src/ui/vfx/tiers/tierProfiles.ts` |
| 194k-2 | Big-hit thresholds (dim, charge-up, camera shake) read `s` again, as the lab does. | `isBigHit` in `choreo/bigHit.ts`, `impact/impactMath.ts` |
| 194k-3 | Light effects bring their own contrast: dark rim, opaque body, hot core. | `attacks/glow.ts`, `particles.ts`, the attack modules |
| 194k-4 | Damage numbers read their profile size and get a dark outline; status labels about 20 px. | `stage.css`, `index.css` |
| 194k-5 | Status landings at the lab's counts and sizes; a top-up lands as visibly as a fresh status; a 450 ms body glow. | `landings/`, `spriteReaction.ts` |
| 194k-6 | Impact particles at the lab's sizes; `PARTICLE_POOL` 1,600. | `impacts/`, `particles.ts` |
| 194k-7 | A multi-hit card's hits land together under one merged freeze. **Ruled: keep as is.** | `useImpactFeedback.ts`, `impact/` |
| 194k-8 | Side-by-side captures, `results/194k/`. | the stage sheet's new `?hand=`, `?foeDefs=`, `?foe1/2/3=` and `?biomeName=` parameters |

## Henry's answer (2026-10-05), and what it turned out to be

Henry: *"I'm mostly looking at the flame column and the particles look very different. Also it tried to add a black border which looks really bad. … the status effect which shows the status popping up over the mingming and then landing on the effected one looks very different. The particle trail is almost invisible. Is this because we are missing particle effects? Can we find some free ones instead of AI generated versions. I don't want AI generated art in the game."* So answer 2 (not like the lab), plus the rim.

**No art is missing.** The lab uses no image assets at all: every particle is a 64 px radial gradient the lab draws itself (`tex` in `battle-juice-lab.js`), and the beam, jet and vine are canvas strokes. Nothing to source, free or otherwise. The differences were all in the port:

1. **The spawn rate was divided by 16.7.** The lab's `tick(age, g)` counts game *milliseconds* (`acc += g * 0.16` is 160 flames a second). 190 read it as "per frame" and divided by 16.7 (`framesOf`), so the column had about 6% of its particles. This one line is most of the "thin pale line". Fixed in 198b-2 (`labTicks`).
2. **The black border is 194k-3.** Every light effect was given a *dark rim* (the element colour at 30% brightness) and the particle sprite a dark outer ring, as a way to read on the light stages. That is the border. Gone in 198b-1 with `attacks/layers.ts`.
3. **The field did not draw like the lab.** Ordinary blending instead of additive, a hold-then-fade alpha instead of the lab's `a·(1 − t²)`, a `^0.45` colour curve instead of linear, particles thinning when the lab keeps their size, and the lab's kinds (`glow`, `soft`, `bubble`, `glint`, the speed-stretched `drop`, the turning `leaf`) approximated with others. 198b-1 replaces the step and draw with the lab's, line for line (`particles.ts`, `particleShapes.ts`, `glowTexture.ts`).
4. **The light stage, answered properly.** Additive light really does vanish over sand (190's reason for ordinary blending). 198b-1's `FxCompositor` draws each frame additively *among the effects* on an offscreen canvas (so a hundred flames still sum to a white-hot core) and lays the finished frame over the stage in ordinary blending, like a sprite. On navy it is the lab's result; on sand the column covers the backdrop where it is dense and blends at its edges. No rim needed. *(Amended after the big-hit stutter investigation, 2026-10-05: the offscreen canvas was unnecessary. The layer's own canvas is transparent and the browser already lays it over the stage in ordinary blending, so drawing additively straight onto it gives pixel-identical output (0 differing pixels at DPR 1 and 2). The per-frame stage-sized copy was the stutter, about 900 ms of a 3.5 s big hit against about 90 ms for every particle sprite, and 4x worse at DPR 2. `FxCompositor` is removed; `ParticleLayer.draw.test.tsx` pins it.)*
5. **Poison Injection never lobbed an orb.** It is an Attack-category card that deals no damage, and 190c's `castKindOf` sent it down the attack timeline: a lunge and the 146d trail (a thin blue Water line) instead of the wiggle and the orb. A card that hit nobody and applied a status is a status cast now (198b-3). The orb itself is the lab's `orbFx`: a 16 px glow leaving from over the caster's head, 200 motes a second behind it (the old orb shed a 2 px spark every 30 ms).
6. **The status float fired at t = 0.** `useBattleVfx` floated "Poison" and bumped the plaque from the engine event, before anything had flown. It is a `status` stage moment said by the presenter when the orb arrives (or the rider lands) now, as 189d did for the damage number (198b-3).
7. **Impacts, landings, charge-up and death** were loose re-tunings of the lab's; 198b-4 ports `burst`, `superRing`, `fizzle`, `chargeFx`, `statusLand` and `death` line for line (Bark keeps 190f's settle toward the plaque after the lab's spiral in).

## First job (as written before the answer): find out what Henry does not like

Nobody has said which part is wrong, and guessing would waste a build. Before any code, Henry points at what he sees (a capture, or a moment in the game) and says which of these it is, or something else:

1. Too big, too loud or too much (the effects, the numbers, the shake, the freeze).
2. Not like the lab (shape, colour, timing).
3. Hard to read on the light backdrops.
4. The status landings or trails (194i).
5. Feels slower, or lags.

The answer picks the approach below.

## Why the 194k-8 captures cannot settle it

The captures are **not a fair side-by-side**, and Henry's screenshots do not match the lab either:

- **The hit sizes differ.** The lab column is 12 damage (s = 0.52); the game columns are 181 or 48 damage on 1,100 to 1,350 HP bodies.
- **The scenes differ.** The lab has finished sprites on a dark navy stage; the game has "ART PENDING" placeholder blobs on light sand or pale green. The same effect reads louder on navy.
- **The timing differs.** They were taken in a headless software-rendered browser, so a frame at "+1,150 ms" is approximate and the beam shows in different frames.
- **There is no lab column for a multi-hit**; the lab has none.

## Options (not ruled)

- **A. Tune, do not rebuild.** Keep 194k and change the numbers Henry names. Cheapest. Fits answers 1 and 5.
- **B. Take 194k out and start again.** Drop the eight commits and rebuild from the lab, one effect at a time, each shown to Henry before the next. Fits answer 2 if the shapes are off.
- **C. A matched comparison first.** Build a capture rig that plays the same hit (same damage, same caster and target, same stage) in the lab and the game, and puts both on one sheet, including the lab on a light stage. Then decide from what it shows. Fits answer 3, and is the first step of A or B either way.

## Known gaps from the 194k-8 sign-off notes

- The poison trail is a thin blue arc with a dark edge, much thinner than the lab's spore trail (194i).
- The lab's stage is dark navy and the game's is light.
- The lab has no multi-hit.

## Build

**Small, single-purpose modules** (Henry's standing preference): one module per effect, composed by the tier profile, not one growing effects file. One commit per part, test first.

Built 2026-10-05 as option B (rebuild from the lab), one commit a part:

- **198b-1.** The particle field is the lab's: `glowTexture.ts` (the lab's `tex`, no rim), `particleShapes.ts` (the lab's `drawParts` kinds; `puff`/`flame`/`streak`/`chevron` kept as aliases), `particles.ts` (the lab's step and draw on the old ring-buffer pool), `FxCompositor.ts` (since removed, see item 4). `attacks/layers.ts` and its rims deleted.
- **198b-2.** `framesOf` → `labTicks` (per ms). The beam, jet, wall, wave, vine and pollen draw the lab's strokes, widths, colours and blends.
- **198b-3.** `choreo/orb.ts` is `orbFx`; `castKindOf` reads hits and statuses, not the card's category; `StatusMoment` in `impact/stageMoments.ts`, said by `castBeat`'s `status-tell` and landed by `useBattleVfx` (float, sound, plaque bump). The lob's crest is kept 20 px inside the canvas for a top-row body (the game's top row has no sky above it; the lab's has 50 px).
- **198b-4.** `impacts/` (`burst` per element with its ring, `superRing`, `fizzle`), `choreo/bigHit.ts` (`chargeEffect` = `chargeFx`), `landings/` (all eight, the lab's counts, sizes, colours, fade-ins), `emitDeath` = `burst('None', 1, 1.4)`. `trails.ts` carries the lab's `hot` and `num` colours.
- **198c.** The rig: `scripts/vfx-sheet.mjs` plays one card on the stage sheet (`stage.html?hand=…`) and photographs the moments; `scripts/vfx-compose.py` puts the lab column (cropped from the 194k sheet, the only capture of the lab there is) beside it. Sheets in `results/198/`: [flame](../../../../results/198/flame.jpg) (Cinderreach and Rootfall), [flame50](../../../../results/198/flame50.jpg), [poison](../../../../results/198/poison.jpg) (Rootfall and Cinderreach), [water](../../../../results/198/water.jpg), [vine](../../../../results/198/vine.jpg), [strength](../../../../results/198/strength.jpg). **Henry signs them off; this row closes the ticket.**

Still true of the sheets: the hit sizes differ (lab 12 on 100 HP, game 181 on 1,305), the timings are a headless browser's (a frame at "+850 ms" is approximate, and at the capture's low frame rate the orb's motes bunch into a dotted line where a real 60 fps browser draws a ribbon), and the lab column is the 194k capture reused. The game itself is the real test.

Gate: `tsc -b`, `eslint .`, `vitest run src/ui` (2,355 green; `src/debug/playtest/night.test.ts` fails on the parent in the build container for an unrelated reason), `vite build`.

## Rulings carried over from 194

- **Stage dim during every attack (194 decision 9): left open.** Henry: *"Leave it for now."* Recommended: no. Decide it from the 198a sheets, not before.
- **Multi-hit kills (194k-7): keep the single merged freeze.** If it still feels flat after 198b, the alternative is to space the hits out as a rhythm.

## Done when

Henry signs off the matched captures (198c) or rules the 194k look as it stands.
