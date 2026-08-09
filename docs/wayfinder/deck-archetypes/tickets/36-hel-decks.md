# Hel decks, dual-type species, and two new hook triggers

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-08
- Blocked by: [35-type-advantage](35-type-advantage.md) (closed)

## Question

Hel was the worst-measured species in the registry: **0/400 decided at the 61-turn cap**, and §2.3
produced no number at all. Her v1 firmware (EQUINOX_TOGGLE) was diagnosed as near-worthless - the
stance bonuses live on the *statuses*, so any Mingming playing `nightfall_edge` got +30% damage and
the OS's entire contribution was `DRAW 1` per shift. Henry replaced both OSes, made her the roster's
first dual-type species, and specified the two hook triggers the design needs.

## What landed

**Two new engine triggers, both generally useful beyond Hel.**

- `onActionEnd` - the symmetric partner to `onActionStart`, dispatched **once per program** after
  the multi-hit action loop. Once per program, not once per action, or a multi-action card would
  flip her stance mid-card. End-of-action rather than start is the entire design: the card that
  *sets* a stance must never benefit from it, only the next one.
- `onHealCalculated` - healing had **no modifier path at all**. `onHeal` fires after the heal
  resolves (a reaction hook; audhumbla_v2 converts overheal into damage with it), so there was
  nowhere to scale a heal before it landed.

**`HookFactory` needed no structural change for either trigger** - as predicted. Event hooks build
generically from the trigger string; the modifier branch needed the new trigger name added to its
`||` chain and nothing else.

**LightStance redefined**: +50% healing -> **-30% damage taken**. It was dead weight on a
defense-60 striker. The +50% moved onto hel_v2's frame, which actually wants it. The old behaviour
was hardcoded in two places that **disagreed with each other** - `calculateHeal` boosted power-based
heals, `HealExecutor` boosted `healOverride` heals - and both are gone.

**Hel is dual-type (Dark/Light)**, the first `secondaryElement` that is not `None`; pool 11 -> 21
cards. The `baseDecks.test.ts` validity invariant was widened to `[primary, secondary, 'None']`,
which is a verified no-op for the other 15 species.

**Both OSes replaced.** v1 **TWILIGHT_CADENCE**: the element she casts sets her stance at end of
action (Dark = +30% dealt, Light = -30% taken); None-element cards set no stance, which makes Tackle
and `hamstring` the designed way to act without committing. v2 **UNDERWORLD_GATEWAY**, per Henry's
amendment: her cards cost **no Energy at all** (`onCostCalculated` multiplier 0) and drain 5% of max
HP per point of printed cost instead, with healing x1.5 at the enabler so the cards stay on-curve.

**Seven cards**: `shadow_claw` redesigned (10-power vanilla -> 5 power + 1 Weakened), and six new -
`pale_mercy`, `nights_bite`, `dawnstrike`, `eclipse`, `last_rites`, and the amendment's 3e payoff
`soul_tithe`. **Every one scored exactly what Henry's port predicted**: 0.9 / 0.9 / 3.0 / 2.9 /
6.1 / 6.5 / 10.4 against bands 1.0 / 1.0 / 3.0 / 3.0 / 6.5 / 6.5 / 10.5. Nothing needed re-pricing.

## Three engine bugs the design walked into

**1. `multiplier: 0` was silently dropped.** `HookFactory` guarded the modifier with
`if (modifierData.multiplier)` - and `0` is falsy, so UNDERWORLD_GATEWAY's cost-zeroing hook did
nothing at all. `soul_tithe` stayed a 3e card on a 2-Energy frame and never resolved. Fixed to
`!== undefined`; every other multiplier in the registry is non-zero, so it is a no-op for them.

**2. Self-targeted modifier hooks applied twice.** `applyDamageModifiers` collects hooks from
`[source, target]`, which is the *same entity* on a self-heal or a self-hit - so every one of its
hooks was collected once per slot and applied twice. hel_v2's x1.5 healing measured **x2.25**.
`applyHealModifiers` dedupes by id. **`applyDamageModifiers` has the identical latent bug for
self-damage cards** (`forage`, `dark_pact`, fenrir's recoil) and is deliberately **not** touched
here - fixing it would perturb eight tuned species outside this ticket's gates. Ticket 37.

**3. The AI and the UI both priced cards without running `onCostCalculated`.**
`getEffectiveCardCost` stops at the printed/primed cost; the reducer applies the cost hook
separately in `handlePlayProgram`. So `TacticalAI` saw `currentEnergy 2 < 3` and `continue`d past
`soul_tithe` forever - it would have measured as a 100% dead card for a reason that looks nothing
like balance. The same call in `CardHand.tsx` was worse than a display mismatch: the `energy_base`
constraint is evaluated against that cost, so her cards would render **greyed out as unplayable**
while the reducer happily played them. Both now run the hook and discard the returned state.

## Gate

Full committed run, registry `1:d7238b5d`. **Redlines 46 -> 45** (card 32 -> 32, matchup 14 -> 13).
Numbers below are the SHIPPED state, after the second pass in the next section.

| metric | baseline `1aebe0e` | after | band |
|---|---|---|---|
| §2.3 decisive win rate | **0** (0/100 decided) | **0.590** | 0.30-0.70 |
| §2.3 gap | n/a | **9.0%** | also clears the strict 15% |
| §2.3 dead cards, v1 / v2 | 0 / 0 | 0.304 / 0.307 | <= 0.35 per side |
| §2.3 ftk | 0 | **0** | 0 |
| mirror: fraction decided | **0/400** | **400/400** | >= 60% |
| mirror: average turns | **61.0** | **5.4** | <= 30 |
| mirror: dead cards, both sides | 0.003 / 0.005 | 0.106 / 0.102 | <= 0.35 |
| mirror: ftk | 0 | 0 | 0 |

**No new card redlines.** All seven cards scored exactly what Henry's port predicted and every one
landed in band; `shadow_claw` was not a redline before or after.

Matchup redlines that moved:

- **cleared `TURN_COUNT mirror:hel`** - the 61-turn stall this ticket existed to kill.
- cleared `MIRROR_WIN_RATE mirror:nidhoggr`, gained `MIRROR_SIDE_BIAS mirror:nidhoggr` - the same
  396-of-400-draw matchup reshuffling which side takes its four decided games. Noise, not signal.
- `FTK os:hel` appeared on the first pass and was **cleared** by the second (see below) - though
  a wider 800-game sample still reads ~1.6%, so read it as reduced rather than gone.

**Archetype gauntlet: kraken vs hel 0.01 -> 0.13** - hel_v1 went from losing 99% to the control
benchmark to **winning 87%**. Flagged, not tuned: the gauntlet carries no win-rate redline by
design, and hel_v1 is untouched by the knob below.

**nidhoggr re-gated and unchanged**: mirror 60.69 -> 60.7 turns, 397 -> 396 draws of 400. He was
already fully stalled at baseline; his deck pass is ticket 37.

### First pass: knob rounds used, two (the second reverted)

**Round 1 - knob 4, `UNDERWORLD_GATEWAY percentMaxHP` -5 -> -10. Kept.** At -5% the toll never bit:
over 100 games v2 played **9.3 cards to v1's 3.2** and dealt **79.5 damage to v1's 17.0** into an
80 HP pool, for **98/2**. She paid 36.8 HP a game and **never once killed herself** - the games ended
in ~1 turn, before her own clock could matter. The toll is her only real constraint, so it went
straight to the top of its authorised range rather than bisecting: **98/2 -> 50/50**.

**Round 2 - knob 6, `squirrel_away` -> `drain_life`. Reverted.** Aimed at the FTK: v2's Draw 2 is
part of what lets her empty her hand on turn 1. It went the wrong way - **§2.3 0.500 -> 0.256, out
of band** - and only halved the FTK (4 -> 2). `drain_life`'s 22 power *plus* a 15 HP lifesteal is a
better opener for her than two cards, and the lifesteal partly cancels the toll that had just been
doubled. Reverted. The round-1 state is what the second pass then built on.

### Where the first pass stopped: `FTK os:hel`, 4/100

Measured over 200 games at the flat 10% toll: **every FTK is v2 on the play; v1 never scores one.**
v2 deals 75.1 damage a game into an 80 HP pool, so when she moves first she sometimes simply
finishes before v1 acts. The toll now works as designed and then some - **66.3 HP a game, 83% of her
pool** - and in 8 of 200 games the toll alone met or exceeded her whole pool. **60 of 200 games end
as mutual kills**, which is where the 28% draw rate comes from: she kills herself finishing the job.

`soul_tithe` plays **1.22 times a game**, confirming the AI cost fix took (a 0% rate would have
meant it did not).

Handed back at that point per §9. Henry re-opened it - the next section is what came of that.

Handed back per §9 rather than opening a third round.

## Second pass — the escalating toll (Henry re-opened the FTK breach)

The first pass shipped with `FTK os:hel` at 4/100 and both authorised knob rounds spent. Henry
re-opened it, and the dissection found something no knob reaches.

**The killing turn is 6.5 cards, and she is at 32 of 80 HP when it lands.** Two cards do 80% of it:

| card, on the FTK turn | dmg/play | its all-game average |
|---|---|---|
| `soul_tithe` | 37.3 | 33.4 |
| `last_rites` | **26.8** | **21.4** |
| `dawnstrike` | 7.8 | 7.2 |

`last_rites` hits **25% harder on the turn she kills**, because the toll has already taken ~48 HP
off her and it scales on *her own missing HP*. **Her clock and her payoff were the same resource** —
paying the toll did not brake the alpha strike, it loaded it. That is why doubling the flat toll
moved §2.3 by 48 points and the FTK count by **zero**.

### The fix: `escalatePerPlay`

New optional field on any hook action: multiply it by `1 + escalatePerPlay × (plays the owner has
already made this turn)`. It composes with `scaling` instead of replacing it, and rides
`playsThisTurn`, which already existed per-unit and already reset each turn. UNDERWORLD_GATEWAY now
charges **5% of max HP per printed Energy point, ×(1 + 1.25 × prior plays)** — 10 HP, then 22, then
35 on a 200 maxHP frame. Henry chose the shape; the coefficient came from the sweep below.

| base | escalate | §2.3 | ftk | draws |
|---|---|---|---|---|
| 5% | *(flat)* | 0.020 | 0 | 0 |
| 10% | *(flat)* | 0.500 | 4 | 28 |
| 5% | 0.5 | 0.212 | 3 | 34 |
| 5% | 1.0 | 0.451 | 1 | 49 |
| **5%** | **1.25** | **0.590** | **0** | 61% |
| 5% | 1.5 | 0.684 | 1 | 62 |
| 7.5% | 1.25 | **1.000** | 0 | 42 |
| 10% | 1.25 | **1.000** | 0 | 18 |

### Two findings worth more than the number

**1. An escalating cost is ORDERED, so it is gameable — and the AI games it.** Over 800 games the
toll cut FTK from ~4% to **1.63%** but could not reach zero, because she simply plays `soul_tithe`
**first**, at the base rate: a 90-power card for 12 HP on cast one. The escalation only ever taxes
the tail. The committed run reads `ftk 0`, but that is a 100-game sample of a ~1.6% event — treat
the FTK as *reduced*, not eliminated.

**2. The matchup has no stable interior.** base 5% → v2 wins 79%; base 7.5% and 10% → v2 wins
**zero games of 100**. It crosses the whole band almost discontinuously, and **61% of games are
mutual kills**. The toll can only trade her win rate against her suicide rate, because either way
the game is over in ~2 turns. §2.3's 0.590 is computed over only ~40 decided games (the floor is
20), which is why the scoped and full runs disagree by 7 points at the same nominal n=100.

**The underlying cause is not the toll. The 3e band assumes you spent a whole turn's Energy.**
`soul_tithe` scores 10.4 against a 10.5 band and that is correct — for a species that pays 3 Energy
for it. Hel pays 12 HP and still casts three more cards. No cost curve on the toll fixes a payoff
card that is priced for a constraint she does not have.

### Two more engine bugs, both found by this pass

**4. `zod` strips unknown keys.** `HookSchema.ts` parses `hooks.json`, so `escalatePerPlay` was
silently dropped between the data and the engine — three sim runs returned numbers *byte-identical*
to the flat rates before I stopped trusting them and instrumented the hook. **A field added to
`HookAction` but not to `HookSchema.ts` does not exist at runtime, and fails silently.**

**5. `percentMaxHP` floored the percentage, not the product.** Every `scaling` in the registry
resolved to an integer, so it never showed; the first fractional factor put **22.5 HP of damage**
into an entity. Now floored at the end. A no-op for every existing hook.

## Left open

- **FTK is reduced, not eliminated** - ~4% -> ~1.6% measured over 800 games, `0` in the committed
  100-game sample. Closing it properly means capping her casts (`maxCardsPerTurn` already exists,
  ymir_v2 precedent) or taking `soul_tithe`'s 90 power out of her opening hand. Both are design
  calls, not knobs.
- **The 3e budget band assumes a whole turn of Energy.** It is mispriced for any species that can
  cast without an Energy constraint. Worth a line in the curve spec's band table before a second
  such OS exists.
- **61% of her §2.3 games are mutual kills**, so the win rate is computed over ~40 decided games
  against a floor of 20. Scoped and full runs disagreed by 7 points at the same nominal n=100.
  Treat hel's §2.3 as +/-8, not the usual +/-4.
- **`applyDamageModifiers` double-applies on self-target** (bug 2 above). Real, out of scope here,
  and needs its own re-gate of the eight tuned species. Ticket 37.
- **hel_v1 beats kraken control 87/13** in the gauntlet - but the tuned roster spans 0-100% against
  that same benchmark (huldra and ratatoskr 100%, fenrir and skoll 0%), so she is mid-pack, not an
  outlier. That spread is ticket 35's open problem, not Hel's.
- `nightfall_edge` and `dawns_respite` are **redundant as stance shifters** now that the OS sets the
  stance from the element cast. Left in the pool, in no deck - note for re-purposing.
- **Energy is a dead stat for hel_v2** - `capacitor` and the Energy half of `lumen_surge` do nothing
  for her. Neither is in her deck; hel_v1 is unaffected and keeps `lumen_surge`.
- Expected findings confirmed and not fixed, per §10: `purify` scores 0.00 (CLEANSE is unpriced),
  `lumen_surge` ships at 4.5 against a 3.0 band, `venom_shade` (1.8) and `curse_mark` (1.3) are
  under band but belong to nidhoggr's pass, `dark_pact` at -3.2 is the most over-costed card in the
  registry and is in no deck.
- No X-cost card reaches Hel, so the `numericBaseCost()` hazard on the toll's `BASE_COST` scaling is
  latent only. If the toll hook is ever inherited or she picks one up as a drop, it computes `NaN`.
