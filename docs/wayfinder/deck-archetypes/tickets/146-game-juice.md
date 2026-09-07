# Ticket 146 — Game juice: particles, status flames, elemental attacks, hit-stop

**Type:** UI/VFX. **Asked by Henry, 2026-09-07:** *"add juice — particles, flames on burn,
elemental attack animations."*
**Depends on:** 145 (stable slot anchors via `useStageAnchors()`). Rows 146a–146b can be built
against today's spotlight positions and re-anchored when 145 lands; 146c wants 145 first.
**Relates to:** 147 (every emitter below has a sound in 147). **Branch:** `legion/ai-perf`.

---

## 1. What exists, so nothing is built twice

The engine already emits a typed battle event stream (`src/engine/events.ts`: `PROGRAM_PLAYED`,
`DAMAGE_TAKEN` with element and amount, `HEAL`, `STATUS_APPLIED` / `STATUS_REMOVED`, `CARD_DRAWN`,
`DECK_SHUFFLED`, `TURN_START/END`, `LEVEL_UP`). `useBattleVfx` (`src/ui/hooks/`) subscribes and
produces per-entity `UnitFx` descriptors; `UnitFxLayer.tsx` renders hit flash, heal pulse, status
ring, floating numbers; `MingmingUnit` / `BattleStage` do shake (scaled by damage fraction), lunge
and death glitch, all framer-motion, all respecting reduced motion (shake degrades to an opacity
dip). `PlayedCardReveal` holds the card 700 ms.

What is missing is anything that moves *between* units or *persists on* a unit. That is what reads
as juice, and it is two things: a particle layer, and a table from events to emitters.

## 2. 146a — The particle layer (the only infrastructure)

One `<canvas>` absolutely positioned over `.stage-area`, sized to it with `devicePixelRatio`,
`pointer-events: none`, z-order above sprites and below the reveal lane. A single
`requestAnimationFrame` loop that runs only while there are live particles (idle = no frames).
A hand-rolled pooled emitter — no library:

```ts
type Particle = { x, y, vx, vy, life, maxLife, size, r, g, b, a, drag, gravity, shape: 'dot'|'spark'|'leaf'|'drop'|'star' };
```

Pool of 600, reuse the oldest when full. Emitters are pure functions `(anchor, intensity, rng) =>
Particle[]`. Positions come from `useStageAnchors()` (145) — until 145 lands, from the two
spotlight frames' `getBoundingClientRect()`, which is what the floats use today. **Nothing here
touches React state per particle;** the loop draws straight to the canvas. Budget: < 2 ms a frame at
600 particles on an integrated GPU, measured in the write-back.

Reduced motion (`prefers-reduced-motion`, and the existing settings toggle): the particle layer is
**off**, not smaller — the plaque chips still carry every status.

## 3. 146b — Persistent status emitters (do this first: it is juice AND readability)

A looping emitter attached to a unit while it holds the status, intensity = stacks. Each one is a
different shape and direction so they read at a glance without colour:

| status | emitter | scales with stacks |
|---|---|---|
| Burn | flame tongues rising off the sprite's lower half, orange → yellow, flicker | 1 → 4 tongues (the cap makes this legible) |
| Poison | slow green drops falling from the sprite, splash dot on the ground line | rate |
| Dazed | 2–3 small stars orbiting the head | orbit speed + count |
| Weakened | grey haze sinking, faint downward chevrons | density |
| Strengthened | red embers rising fast, tight column | rate |
| Sharp | brief white glints along the sprite's edge every ~0.6 s | glint count |
| Regen | soft green motes drifting up, slow | rate |
| Bark Shield | a bark-textured ring at the base that thins as stacks fall; **cracks** (burst of brown chips) on each absorb | ring thickness |
| Energized | yellow pips popping around the EP pips on the plaque | count |

`STATUS_APPLIED` starts/updates, `STATUS_REMOVED` (or stacks → 0) stops with a short dissipate.
Poison/Burn **ticks** at turn start get a one-shot burst (the DoT hit) on top of the loop.

## 4. 146c — Elemental attacks: trail + impact

On `PROGRAM_PLAYED` with an attack action, a projectile emitter travels caster-anchor → target-anchor
over 180–260 ms (the lunge already fires; the trail leaves with it), then `DAMAGE_TAKEN` triggers the
impact at the target scaled by damage fraction (0–1, the same number the shake uses):

| element | trail | impact |
|---|---|---|
| Fire | ember streak with smoke tail | fireball splash, radial sparks, brief orange bloom |
| Water | droplet arc, slight gravity | splash ring + upward droplets |
| Nature | leaf/seed spiral | thorn burst (spark shape, green), petals drift down |
| None (generic hit) | short white streak | small white burst |

Multi-hit cards (`twice`) fire two trails 90 ms apart. Side-target cards fire one trail per living
enemy from the caster. Heals: green motes rising at the target, no trail. Self-buffs: the
Strengthened/Sharp emitter gets a one-shot burst so the buff is *seen applied*.

**Super-effective (×1.5):** the impact bloom doubles and takes the attacking element's colour, plus a
1-frame white flash on the target frame. **Resisted (×0.67):** the impact shrinks and greys, the trail
fizzles. This is the element-legibility fix from the 08-30 playtest, done where the eye already is.

## 5. 146d — Hit-stop and stage shake (the cheapest juice there is)

- **Hit-stop:** on a hit ≥ 25% of the target's max HP, or a kill, freeze the stage 70 ms
  (pause the particle clock and framer animations via a `stageClock` that the loop and the motion
  transitions read) — then release. On a kill, 110 ms and the death glitch starts on release.
- **Stage shake:** the whole `.stage-area` translates 4–8 px for 120 ms on those same hits (the
  per-unit shake stays for ordinary hits). Never both a stage shake and a hit-stop for a < 25% hit.
- **Card slam:** the played card in the reveal lane arrives with a 60 ms overshoot scale and a
  soft impact ring — makes every play feel like a hit even when it is a skill.
- **Low HP:** a unit under 25% gets a slow red vignette pulse on its slot (not the screen).

## 6. Order and gates

146a with Burn flames as the proof (one screenshot + a 5-second GIF in the write-back), then the
rest of 146b, then 146c, then 146d. Each row: reduced-motion off-switch verified, the frame budget
measured (Chrome performance panel, 3v3 with all six units carrying two statuses each), and no
change to any `useBattleVfx` test. Henry judges each row on the GIF — juice is not a number.

## 7. Not in this ticket

Sprite animation (art), biome backgrounds (34), screen transitions, sound (147).
