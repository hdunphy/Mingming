# VFX capabilities for the battle scene — a primer for the ticket-146 design session

*2026-09-12. What the React/TS/Vite stack can draw, what the game already has wired, what each
technique costs, and what the session has to decide. No decisions are made here.*

---

## 1. What already exists (the plumbing is done; 146 is the paint)

**The engine talks.** `globalBattleEventBus` (`src/engine/events.ts`) emits every combat fact
synchronously inside the reducer: `BATTLE_STARTED/ENDED`, `TURN_START/END`, `PHASE_START/END`,
`PROGRAM_PLAYED`, `PROGRAM_DISCARDED`, `CARD_DRAWN`, `DECK_SHUFFLED`, `DAMAGE_TAKEN` (with amount,
element, effectiveness), `HEAL`, `STATUS_APPLIED`, `STATUS_REMOVED`, `LEVEL_UP`. Anything you want
to "juice" is already an event; the UI never touches the engine.

**The UI listens.** `useBattleVfx` (`src/ui/hooks/useBattleVfx.ts`) turns those events into
per-unit descriptors (`UnitFx`: damage/crit/heal/absorbed floats with lateral slots, `hitKey` +
`hitIntensity` 0–1, `healKey`, `statusKey` + colour, `lungeKey`) plus the centre-screen
`PlayedCardAnnouncement`. Every setState lands in the same React batch as the store update — no
per-frame React state, which is the discipline any new effect has to keep.

**The UI draws, today:** `UnitFxLayer` (flash overlay, pulse, coloured status ring, floating
numbers, TERMINATED stamp with glitch), attack lunge, stage shake, death glitch, the 700 ms
`PlayedCardReveal`, and after 145: the stagger stage with `useStageAnchors()` giving `{x,y,w,h}`
per slot plus `reveal` and `hand`, the plaque status badges (emoji from `statusGlossary`), the rim
light on the active ally, the dead-body silhouette. Motion library: **framer-motion 12**. Audio:
`AudioEngine.playSfx` (synth Web Audio; 147 extends it). Reduced-motion: a media query is already
respected in the stage/unit components.

**Not present:** no WebGL/canvas library (no pixi, three, gsap, react-spring, lottie), no sprite
sheets (art pass is December, sprites are still coloured circles with letters), no particle system.

## 2. The five ways to draw an effect in a browser, and what each is for

| technique | what it is good at | cost | fit here |
|---|---|---|---|
| **CSS / framer-motion transforms** (translate, scale, rotate, opacity, `filter`, `mix-blend-mode`) | anything that moves a whole element: lunges, card slams, screen shake, plaque pops, HP bar drain, rim-light breathing, hit flash (`brightness(3)` for 60 ms), element tint (`hue-rotate`/`drop-shadow` in the element colour), slow-mo via `animate` duration | GPU-composited, free; ~0 code beyond what exists | **the workhorse** — 60–70% of "juice" is this |
| **SVG filters** (`feTurbulence`, `feDisplacementMap`, `feGaussianBlur`, `feColorMatrix`) applied to a DOM element | distortion: water ripple, heat shimmer over a Fire unit, a Poison ooze wobble, glitch/tear on death, "dissolve" via an animated noise mask | cheap for 1–2 elements, expensive if animated on many (each frame re-rasterises); Chromium fine, older Safari janky | **accent only** — the active caster's element aura, the death dissolve |
| **Canvas 2D particle layer** (one `<canvas>` over the stage, `requestAnimationFrame`, a pooled array, no React state) | sparks, embers, drips, motes, glints, trails from caster to target, impact bursts, persistent per-status emitters (Burn flames scale with stacks, Poison drips, Dazed stars) | one rAF loop, runs only while particles are alive; 600 pooled sprites is nothing on a 2-core laptop; positioned by `useStageAnchors()` | **the second workhorse** — what 146's brief already assumes |
| **Sprite-sheet / frame animation** (a PNG strip or Lottie JSON, stepped with `steps()` or a frame counter) | authored effects with a *shape*: a slash arc, a bite, a claw, an explosion ring, a shield crack | needs art; each effect is an asset | **after the art pass** — a Lottie or spritesheet slot in the canvas layer can be built now and left empty |
| **WebGL** (pixi.js / three.js / a fragment shader) | full-screen post-processing (bloom, chromatic aberration, vignette that actually blurs), thousands of particles, real lighting | a dependency, a second render tree, its own resize/DPR handling; overkill until sprites exist | **not now** — everything 146 lists is reachable without it; revisit with the art pass if a shader look is wanted |

Two more that are not "drawing" but are juice: **hit-stop** (freeze the animation clock 70–110 ms on
a big hit — framer-motion `useAnimationControls`/`MotionConfig` or a global `timeScale` on the
particle loop) and **audio** (147). Hit-stop is the single highest-value trick per line of code in
this whole list.

## 3. What each item on the 146 brief maps to

| juice | technique | reads from |
|---|---|---|
| element trail caster → target, impact burst, super-effective bloom / resisted fizzle | canvas particles (trail + burst), one CSS flash on the target | `DAMAGE_TAKEN` element + effectiveness, anchors of source and target |
| persistent status emitters (Burn flames ∝ stacks, Poison drips, Dazed stars, Weakened haze, Strengthened embers, Sharp glints, Regen motes, BarkShield ring that cracks) | canvas emitters keyed to the plaque's status list; the crack is a one-shot | battle state statuses per unit (already in `MingmingUnit` props) |
| hit-stop + stage shake scaled to damage; kill shake | framer-motion on the stage container; `hitIntensity` | `DAMAGE_TAKEN` amount / maxHp |
| card slam (hand → reveal lane → target) | framer-motion layout animation between `hand` and `reveal` anchors, then a trail | `PROGRAM_PLAYED` |
| caster aura while a card resolves (Fire shimmer, Water ripple, Nature spores) | SVG filter on the caster sprite for 700 ms, or particles | `PROGRAM_PLAYED` element |
| low-HP vignette / heartbeat | CSS radial gradient overlay + opacity pulse; 147 adds the sound | HP fraction |
| death: dissolve + silhouette | SVG noise mask on the sprite → 145's silhouette | `DAMAGE_TAKEN` → hp 0 |
| draw / shuffle / discard | framer-motion on the pile mini-cards; a card ghost flying pile → hand | `CARD_DRAWN`, `DECK_SHUFFLED`, `PROGRAM_DISCARDED` |
| OS / daemon proc "tell" | plaque chip pulse + a small particle puff in the element colour | `STATUS_APPLIED` with a source that is a hook (needs the event to carry `sourceKind` — one engine field, 146 can ask for it) |
| turn / phase beats | top-bar pill wipe, stage dim on enemy phase | `PHASE_START` |

Everything in that table is buildable with the stack as it is. The only engine touch anywhere is
one optional field (`sourceKind` on `STATUS_APPLIED`) so the UI can tell a card's status from an
OS's.

## 4. Constraints the session should design inside

- **Placeholder art.** Sprites are circles until December. Effects that *surround* a sprite
  (auras, rings, particles at the anchor, shake, flash) survive the art pass; effects that depend
  on the sprite's shape (a bite, a claw) do not exist yet and should be designed as *slots*.
- **Frame budget.** The game runs on whatever laptop the tester has; the engine itself does
  nothing per frame. One rAF loop for particles, everything else on the compositor. No React
  state per frame, no `setInterval` timers, no effect that keeps running when nothing is happening.
- **Reduced motion is a first-class mode**, not an afterthought: particles off, hit-stop off,
  shakes → flashes, lifts instant. 145 already made that split; 146 keeps it.
- **Readability beats spectacle.** The plaque numbers and the reveal lane are the information;
  juice must never cover them. Particles live *between* the columns and *on* the sprite boxes, not
  over the plaques.
- **Emoji statuses** are the icon set for now. An emitter can use the status *colour*
  (`STATUS_COLORS`) without needing a glyph.
- **3v3 density.** Six bodies with persistent emitters is six loops' worth of particles; budget
  per status (e.g. ≤ 12 live particles per emitter) so a Burn-heavy board does not become fog.

## 5. Questions for the session

1. **The palette of the game.** Restrained and readable (Slay the Spire: a few sharp effects,
   nothing persistent) or lush (Monster Train / Balatro: everything glows, shakes, and pops)?
   This one choice sizes the ticket.
2. **What gets hit-stop?** Every hit, only ≥25% hits, only kills? The 146 brief said 70/110 ms on
   ≥25%/kills; confirm.
3. **Persistent status emitters: yes or no?** They are the biggest source of screen noise at 3v3
   and the biggest source of "I can read the board at a glance without the plaque."
4. **Element identity.** One trail shape per element (Fire arc, Water lash, Nature vine) or one
   shape tinted per element? The first needs three authored motions; the second ships now.
5. **The card slam.** Does the played card fly from the hand to the lane (current 700 ms hold), and
   does it then fly *to the target*? That is the moment most of the "feel" lives in.
6. **Enemy tells.** Enemies play from a hand; do their casts get the same reveal + slam as yours,
   or a shorter one? (Speed at beam 8 on wilds is a real constraint — 16 s enemy turns were
   ticket 127.)
7. **Deferred to the art pass:** shaped attacks (sprite/Lottie), WebGL post, screen-space bloom.

## 6. Where this goes

Rulings land in ticket 146 §1; the technique table above becomes 146's build notes. 147 (SFX)
pairs one cue with each row of §3 so the session can decide sight and sound together.
