# Ticket 146 — Game juice (v2, RULED 2026-09-12): the cast sequence, element trails, hit-stop, status tells, OS tells

**Type:** UI/VFX + three small engine event fields. **Status:** RULED by Henry in the 2026-09-12
design session (answers to `research/vfx-capabilities.md` §5, quoted below); ready for Legion.
**Depends on:** 145 (built: `useStageAnchors()`, the plaque, the reveal lane). **Relates to:** 147
(one sound per row here — build them together where the row says so), 145-mock (the geometry).
**Branch:** current working branch, one commit per lettered row, authored as Henry.
**Capabilities reference:** `../research/vfx-capabilities.md` — the technique per effect is chosen
there; this ticket does not re-litigate it. Stack: framer-motion for motion, **one** Canvas 2D
particle layer over the stage, SVG filters only where a row says so, no WebGL.

---

## 1. The rulings

1. **Palette: Slay the Spire — a few effects, each sharp.** *"Slay the Spire: a few effects."* Every
   row below is one effect with one job; nothing runs when nothing is happening.
2. **Hit-stop on every hit, scaled by damage.** *"Everything gets a hit stop but it scales with
   damage."* Floor 30 ms, ceiling 110 ms, linear in `damage.applied / target.maxHp` (0.05 → 30 ms,
   ≥0.35 → 110 ms); a kill takes the ceiling plus the stage shake.
3. **No persistent status emitters.** *"For now no persistent status emitters; it was the apply
   status or remove status that should get an emitter."* The plaque badges (145) are the standing
   read; the *moment* a status lands or leaves gets the effect.
4. **One trail shape per element, with that element's particle.** *"Water drop, flame, leaf."*
   Fire: a flame arc that flares. Water: a lash that ripples, drops behind it. Nature: a vine that
   curls, leaves behind it. None (neutral/physical): a plain streak, no particles. The other
   elements (Earth, Ice, Air, Light, Dark) get the neutral streak tinted in their colour until
   they have a shape — a slot, not a debt.
5. **The player's cast is a sequence, and the card sits *behind* the effects.** *"Player card
   flies to the lane, then the animations play, then go to discard … on a fire card a flame shoots
   across the screen in front of the card in the lane, hits the target and 'explodes', then
   statuses get applied, then the card zooms to the discard."*
6. **The enemy's cast is the same sequence from the caster.** *"Cards originate from the caster and
   do a similar thing except discard back at the caster."*
7. **Status damage looks different from card damage.** Poison and Burn ticks are not a hit; they
   have their own tell (§2f).
8. **Every OS gets a unique tell on trigger.** *"OS should have some unique VFX for each effect to
   help with the trigger."* Built as a family default plus an authored signature per OS, the Early
   Access twelve first (§2g).
9. **Everything is toggleable in Settings**: particles, VFX, animations — three switches, plus the
   existing reduced-motion choice (§2a).
10. Deferred to the art pass: shaped attacks (sprite/Lottie), WebGL post, screen-space bloom.

## 2. Rows

### 146a — The particle layer and the settings switches (infrastructure; nothing visible yet)

`ParticleLayer` — one `<canvas>` absolutely positioned over `.stage-area`, sized to it with DPR,
`pointer-events: none`, `z-index` above the sprites and the reveal-lane card, below the plaques and
the top bar. A pooled array (600) of `{x, y, vx, vy, life, kind, color, size}`; a single `rAF` loop
that runs only while `alive > 0`; an `emit(kind, at, opts)` API driven by the same
`globalBattleEventBus` subscription `useBattleVfx` uses. No React state per frame. `kind` draws
one of: `flame`, `drop`, `leaf`, `spark`, `puff`, `ring`, `streak` — the whole vocabulary of this
ticket.

Settings (`src/ui/settings/settings.ts`, `SettingsScreen`): `particles: boolean` (default on),
`vfx: boolean` (default on — flashes, trails, impact, status tells, OS tells), `animations:
boolean` (default on — card flight, lunges, lifts, hit-stop, shake). `reducedMotion` stays and
maps to: particles off, animations off, vfx → flashes only. Each switch is a `data-` attribute on
the root like `data-reduced-motion` so CSS and the layer read the same truth. **Off means off**:
with `animations` off the card appears in the lane and the discard count ticks; with `vfx` off
the plaque numbers and badges are the only feedback; the game is fully playable with all three off.

Tests: the layer never schedules a frame with nothing alive; the three switches persist through
`SettingsStorage`; reduced motion implies the mapping above.

### 146b — Three engine tells (so the UI can tell what it is looking at)

The bus carries *what* happened but not always *why*. Three additive fields, no behaviour change:

- `DAMAGE_TAKEN.cause: 'attack' | 'status' | 'recoil' | 'toll'` and, for `status`, `status:
  StatusType` — set at the four emit sites (`effectHandlers.ts` L155/L606, `battleReducer.ts`
  L1091/L1463).
- `STATUS_APPLIED.source` / `STATUS_REMOVED.source`: `{ kind: 'card' | 'os' | 'daemon' |
  'engine', id: string, ownerId: string }`.
- A new `HOOK_FIRED` event `{ osId | daemonId, hookId, ownerId, trigger }`, emitted where hooks
  resolve in `Hooks.ts` **outside AI lookahead** (`isSimulating()` false — the same guard the
  ticket-149 probes used).

Tests: one per field; `SimRunner` and the balance suite are byte-identical (they ignore the new
fields).

### 146c — The cast sequence (the row most of the feel lives in; pair with 147's cardPlay/impact cues)

**Player cast**, from `PROGRAM_PLAYED` with a player `sourceId`:

1. **Flight** — the hand card animates (framer-motion layout) from its fan slot to the reveal lane
   anchor, 180 ms, ease-out, landing at the 145 lane pose (−4°). The existing 700 ms hold begins.
2. **Trail** — a streak leaves the *caster's* sprite anchor and travels to the target anchor over
   220 ms **in front of the lane card** (the particle canvas is above the card): 146d decides the
   shape. Side/All cards send one trail per target, 40 ms apart.
3. **Impact** — at arrival: hit-stop (146e), the target's flash (`brightness` 60 ms), a `ring` +
   element `puff` burst at the target anchor, the damage float. Super-effective: the ring is
   doubled and takes the attacker's colour; resisted: half-size ring, grey puff, the float reads
   smaller.
4. **Statuses** — each `STATUS_APPLIED` from this cast plays its tell (146f) at the target, 60 ms
   apart, after the impact.
5. **Discard** — the lane card shrinks and flies to the discard pile anchor, 200 ms; the discard
   count ticks on arrival. Cards that exhaust dissolve in place instead (SVG noise mask, 300 ms).

Timing rule: the hold extends to cover 2–4 so the sequence never truncates; a second cast queues
behind the first (the AI can cast faster than the sequence plays — the queue is the reveal's
existing announcement queue). `animations` off → steps 1 and 5 are instant; `vfx` off → steps
2–4 are the float only.

**Enemy cast**, from `PROGRAM_PLAYED` with an enemy `sourceId`: the card face appears *at the
caster's* sprite anchor (scale 0.6 → 1.0, 150 ms), then the same 2–4, then the card shrinks
*back into the caster* (their discard). Same timings; the enemy turn's total length is measured
before/after (ticket 127 made enemy turns fast — this must not give the time back).

### 146d — Element trails: Fire, Water, Nature, None (+ tinted slots for the rest)

| element | trail (220 ms caster → target) | particles behind it | impact puff |
|---|---|---|---|
| Fire | a flame arc — a streak with a flickering leading edge, curved upward | `flame` (rising, fade orange → red) | flames burst outward and rise |
| Water | a lash — a sinuous streak that ripples (sine along its length) | `drop` (fall with gravity, splash on the floor line) | a ring of drops that fall |
| Nature | a vine — a streak that curls as it grows, thorned edge | `leaf` (tumble, drift down) | leaves scatter and settle |
| None | a plain streak | none | a grey puff |
| Earth / Ice / Air / Light / Dark | the plain streak tinted in the element colour | none yet — **slot** | tinted puff |

One trail is one `streak` particle with a per-element path function and a spawner; the three
authored shapes are ~40 lines each. Colours from `tokens.css` (`--el-fire` etc.).

### 146e — Hit-stop and stage shake (pair with 147's hit/hitBig/kill)

Hit-stop: on `DAMAGE_TAKEN` with `cause: 'attack'`, freeze the particle clock and every
framer-motion animation on the stage (`MotionConfig` transition override / a shared
`useHitStop()` that gates `rAF` delta) for `30 + 80 × clamp((applied/maxHp − 0.05) / 0.30, 0, 1)`
ms. Shake: stage container, amplitude 2–8 px on the same scale, 3 cycles, 120 ms; a kill: the
ceiling stop, 10 px, plus the 145 dead-body silhouette transition. Never on `cause: 'status'`.
`animations` off → no stop, no shake; the flash stays (it is `vfx`).

### 146f — Status tells: apply, remove, and the tick (pair with 147's statusApply / DoT tick)

- **Apply** (`STATUS_APPLIED`): a `ring` in `STATUS_COLORS[status]` expanding from the target's
  sprite anchor + the plaque badge popping in (scale 1.3 → 1, 150 ms) + a 6-particle `puff` in
  the status colour. Stacks added to an existing status: the badge pulses and the count ticks; no
  ring.
- **Remove** (`STATUS_REMOVED`): the badge shrinks out and a small grey `puff` leaves the sprite.
  Cleanse of several: one ring, badges leave 40 ms apart.
- **Tick** (`DAMAGE_TAKEN` with `cause: 'status'`): **not a hit.** No hit-stop, no shake, no
  flash. Poison: a green pulse on the sprite and two `drop`s falling from it, the float in Poison
  green with a small skull glyph. Burn: an orange flare (sprite `brightness` up, warm `drop-shadow`
  100 ms) and three `flame`s rising, float in Burn orange. Regen: a green mote rising, float in
  green. Shield absorb: the existing absorbed float plus a `ring` in Sharp/BarkShield colour.
  Recoil (`cause: 'recoil'`) and hel's toll: a red pulse on the *caster*, no trail.

### 146g — OS and daemon tells (from `HOOK_FIRED`; pair with 147's osProc)

Two layers so every OS has *a* tell on day one and a *unique* one when authored:

- **Family default** (every OS and daemon): the owner's plaque firmware chip flashes in the
  element colour, a `puff` in that colour leaves the owner's sprite, and the combat-log line the
  top bar shows is the trigger text. That alone answers "why did that happen".
- **Signature** (authored per OS; keyed in `hooks.json` as `vfx: { shape, color?, at? }` so it is
  data, not code): a small vocabulary — `pulse` (owner), `rise` (motes from owner), `arc` (owner →
  target streak), `crack` (ring that shatters), `swirl` (particles orbit the owner), `drain`
  (particles target → owner), `spark` (burst at owner). **The Early Access twelve first** (ticket
  140's roster), one line each, e.g. UNBOUND_KERNEL `spark` red on the attack; TREACHERY_KERNEL
  `rise` gold Strengthened motes; ALLURE_PROXY `arc` green owner → the Weakened target; ABYSSAL_INK
  `swirl` blue Dazed; TOXIN_FANG `drain` green from target; OUROBOROS `pulse` blue on the draw;
  GOSSIP_NODE `rise` green on the ally healed; REBIRTH_CYCLE `crack` gold on the reshuffle;
  SOLAR_OVERDRIVE `spark` orange; CINDER_WALL `ring` orange Sharp; INSTIGATOR `arc` green Dazed;
  BARK_SHIELD `crack` brown when it breaks. The remaining OSes use the family default until
  authored; daemons use the default with the daemon's card colour.

### 146h — Write-back

A 10-second capture of one player cast per element and one enemy cast, at 1280×800, with all
three switches on, then all off; the enemy-turn duration before/after 146c on the ticket-127
fixture; the particle layer's frame time on a 2-core laptop with a Side card hitting three
targets (target: no frame over 16 ms). Reduced-motion screenshot. 147's cues wired in the rows
that say "pair with".

## 3. Order and gates

146a → 146b → 146e (hit-stop first: cheapest, and the sequence in 146c needs it) → 146c → 146d →
146f → 146g → 146h. Gates per row in the row; the ticket closes on Henry playing a fight with a
Fire, a Water and a Nature card and an OS proc he can name from the tell alone.

## 4. Not in this ticket

Sounds (147, paired). Sprite/Lottie shaped attacks, WebGL, bloom (art pass). Persistent status
emitters (ruled out for now — the plaque is the standing read). Any change to what a card does.
