# Ticket 112 — which OSes scale with body count, and which were only ever scoped by accident

**Status:** MEASURED 2026-08-22 — and the measurement retires the audit's alarm. See §6. Opened 2026-08-21 on `legion/balance`.
**Asked for by Henry, 2026-08-21:** *"all OS's were tuned for 1v1 but some are not tied to that mingming.
So some of the draw card or maybe even play 0 cost card might not be scoped to a mingming."*
This is also ticket 98's deliverable 4 (entity-count audit tags), derived **from the pool** rather than
from design intent — which is what ticket 109 asked for after finding two tags naming things that do
not exist.

---

## 1. The engine fact this all turns on

There are **two different hook-collection paths**, and they have opposite defaults.

**Narrow path** — `applyDamageModifiers` and `applyHealModifiers` in `core/Hooks.ts` collect hooks only
from `[context.source, context.target]`, deduped by id. A bystander ally's firmware is never offered
the event. `onDamageCalculated`, `onHealCalculated`, `onStatusDamageCalculated` and `onCostCalculated`
are **owner-scoped by construction** and cannot leak at width.

**Broadcast path** — `executeResolutionStackInner` in `resolutionEngine.ts:363` collects from
**every living entity on BOTH parties**, with the comment *"We check all alive entities so that
side-wide or global passives work."* At 1v1 that offers each event to 2 firmwares; **at 3v3 it offers
every event to 6.** Everything else runs through here: `onActionStart`, `onActionEnd`, `onCardDraw`,
`onTurnStart`, `onTurnEnd`, `onStatusApplied`, `onStatusRemoved`, `onPostDamage`, `onDiscarded`,
`onDeckShuffled`, `onHeal`, `onHpThresholdCrossed`, `onUnitFainted`.

**So on the broadcast path, whether an OS stays tied to its own mingming is decided entirely by its own
`when` guard.** `ConditionValidator.ts:37-53`:

| guard | meaning | trigger rate at 3v3 |
|---|---|---|
| `source: "SELF"` | `context.source.id === owner.id` | **unchanged** — owner-scoped |
| `source: "ALLY"` | same side as owner (owner included) | **×3** — any teammate's event |
| `source: "OPPONENT"` | the other side, any member | **×3** — any enemy's event |
| *no `source` clause*, or `"ANY"` | matches everything | **×6** — every event, both sides |

The same applies to `target`. And separately, an **effect** aimed at `ALLIES` or `ENEMIES` pays out over
three bodies instead of one, while an effect aimed at `RANDOM_ENEMY` is **diluted to a third** of its
1v1 concentration.

**A second multiplier that is easy to miss:** `onTurnEnd` is dispatched **once per living entity on the
acting side** (`battleReducer.ts:894`, a loop over `candidates`), not once per side-turn. A `SELF`-scoped
hook still fires once, because only one pass through the loop matches its owner — but an unscoped or
`OPPONENT`-scoped `onTurnEnd` hook fires three times at 3v3. Any future `onTurnEnd` firmware written
without a `source` guard triples silently.

## 2. The audit — 48 data hooks, 15 flagged

Owner-scoped hooks with owner-scoped effects are omitted; they behave identically at every width.

| OS / daemon | trigger | guard | trigger rate at 3v3 | effect at width |
|---|---|---|---|---|
| **`skoll_v1` TREACHERY_KERNEL** | `onPostDamage` | `source: OPPONENT`, `target: ALLY` | **×3** | — |
| **`nidhoggr_v2` BLOOD_SCENT_OS** | `onHpThresholdCrossed` | **no guard at all** | **×3** (6 units can cross, vs 2) | — |
| **`audhumbla_v2` PRIMORDIAL_MILK** | `onHeal` | `target: SELF` — **not `source`** | **×3** (any ally healing her) | — |
| **`audhumbla_v1` GENESIS_FIRMWARE** | `onHeal` | `target: SELF` — **not `source`** | **×3** | — |
| `kraken_v1` ABYSSAL_INK_SYS | `onCardDraw` | `source: ALLY` (deliberate) | **×3** | diluted ⅓ (`RANDOM_ENEMY`) |
| `nidhoggr_v1` ROOT_CORRUPTION | `onTurnEnd` | `source: OPPONENT` | **×3** — and correctly so | maintains on all 3 enemies |
| `ratatoskr_v1` GOSSIP_NODE | `onActionStart` | `source: SELF` | unchanged | **×3** (`ALLIES` heal) |
| `boss_relic_water` WATER_RELIC | `onPostDamage` | **no `source` guard** | **×6** | **×3** (`ALLIES` heal) |
| `boss_relic_fire` FIRE_RELIC | `onTurnEnd` | `source: SELF` | unchanged | **×3** (`ENEMIES`) |
| `draugr_v1` PERMAFROST_WAKE | `onStatusRemoved` | no `source`, but `target: SELF` | unchanged — scoped by target | — |
| `feedback_loop_daemon`, `hoofbeat_daemon`, `hraesvelgr_v1` GALE_FORCE, `huldra_v1` ALLURE_PROXY, `valkyrie_v2` REBIRTH_CYCLE | various | `source: SELF` | unchanged | diluted ⅓ (`RANDOM_ENEMY`) |
| `einherjar_standard` | `onDamageCalculated` | `source: SELF` | narrow path | `ALIVE_ALLIES` — **designed** to scale, +0% at 1v1, +20% at 3v3 |

**Sleipnir's MOMENTUM_DRIVE and ratatoskr_v2's INSTIGATOR_OS — the two "0-cost card" OSes you were
worried about — are both `source: SELF` and are safe.** Sleipnir only mints off cards *he* casts, even
though the hand is shared. The probe agrees: with the deck population held constant, Strengthened rose
only ×1.42 from 1v1 to 3v3, not ×3.

## 3. The four that matter, ranked

**1. `skoll_v1` TREACHERY_KERNEL — the worst, and it was already over-feeding at 1v1.**
*"Whenever an allied Mingming takes damage from an enemy attack, Sköll gains 1 stack of Strengthened."*
At 1v1 that is one attacker hitting one ally, once a turn. At 3v3 it is three attackers hitting three
allies. HANDOFF already records this as open: peak Strength **13.7 stacks in 3.4-turn games** against a
12.5-stack damage cap. Three times the feed puts it around 40. The 3v3 guardrails listed "TREACHERY 3×
feed" as a suspicion; the guard confirms it. **This is the one I would measure first.**

**2. `audhumbla_v1`/`v2` — the card text and the code disagree, and only at width.**
PRIMORDIAL_MILK reads *"Every heal card Audhumbla **casts** also grants her 3 Regen"*, but the guard is
`target: SELF`, not `source: SELF`. **At 1v1 those are the same sentence. At 3v3 they are not** — any
ally healing Audhumbla fills her Regen battery. Ticket 101 measured that battery on a knife edge (3 per
heal accumulates, 1 per heal would exactly cancel decay) and `drink_deep` cashes it at 15 power a stack
for 68% of her damage. A support teammate is a free battery she was never priced for. **This is exactly
the class of bug you suspected, and it is a one-word fix** (`target` → `source`) — but it is a *design*
call whether the team-fed version is the better card, so it is yours.

**3. `nidhoggr_v2` BLOOD_SCENT_OS — no guard at all.**
*"Whenever any Mingming drops below half of its maximum HP"* — the text says "any", and the hook has no
`source` or `target` clause, so it means it: all six units, **including his own allies**. +1 Energy and
+1 card per crossing. At 1v1 at most two crossings exist in a battle; at 3v3, six. Worth holding next to
ticket 109's finding that `tag-antiheal-vs-stall` came **25.0%, 4th from bottom** — BLOOD_SCENT is the
designed anti-heal answer, it triples its procs at width, and the comp still lost. That points at the
deck, not the OS, and is worth knowing before anyone buffs the OS to fix the comp.

**4. `kraken_v1` ABYSSAL_INK_SYS — the answers-divide mechanism, visible inside a single OS.**
`source: ALLY` is deliberate ("whenever Kraken's *side* draws"), and with a shared deck at 3v3 it fires
about three times as often — but it applies 1 Dazed to a `RANDOM_ENEMY`, so the same output is smeared
over three bodies. Three times the procs, one third of the concentration. That is ticket 110's finding
in miniature: control's answer output does not gain from width, it just gets spread thinner.

## 4. The reverse failure, already on record — worth re-opening

`valkyrie_v1`'s **original** VALHALLA_UPLINK healed an ally 5% max HP whenever Valkyrie buffed them,
behind a `context.target.id !== owner.id` guard. `CustomFirmware.ts:296` records the consequence in
Henry's own arc: *"in a 1v1 battle there is no other ally, so it PROVABLY never fired, which is most of
why valkyrie lost 94-95% to the control."* It was **replaced**, not parked — and the replacement uses
the team not at all. The 3v3 guardrails say *park-never-delete team-shaped mechanics, with a
3v3-reserved tag*; this one predates that rule and was deleted under it. **Candidate to restore as a
3v3-reserved mechanic**, now that the mode it was written for is the shipped one.

## 5. What this audit does NOT tell you

**Every multiplier above is read off the code, not measured.** A ×3 trigger rate is an upper bound on
opportunity, not an outcome — TREACHERY needs three enemies actually attacking three living allies, and
BLOOD_SCENT needs six crossings to exist. The next step is a proc census: run each flagged OS at 1v1 and
3v3 and count actual fires per game, the same shape as `scratch/anystatuscensus.ts`. Cheap, and it turns
an audit into a finding. I have not run it — the width probe is holding both cores.

**Recommended order:** TREACHERY census first (it is the largest predicted multiplier on an OS already
known to over-feed), then the audhumbla guard, which needs a ruling more than a measurement.


## 6. MEASURED (2026-08-22, `scratch/oscensus.ts`) — not one of the six predictions holds

Handlers wrapped in place after `getOSBehavior()` populates the registry, counters gated on
`globalBattleEventBus.isLive` per `0-AI-SIM-COUNTS`. 30 games a row (15 iterations, both orders),
each subject with two teammates holding no flagged OS, against a fixed opponent trio.

**Per TURN is the number that matters.** 3v3 games are ~1.4× longer, so fires-per-game silently
credits width for length.

| OS | fires/game | turns | fires/TURN | per-turn | the audit predicted |
|---|---|---|---|---|---|
| `skoll_v1` TREACHERY_KERNEL | 7.70 → 11.43 | 3.77 → 5.63 | 2.04 → 2.03 | **×0.99** | ×3 |
| `nidhoggr_v2` BLOOD_SCENT | 2.00 → 3.87 | 4.63 → 6.23 | 0.43 → 0.62 | **×1.44** | ×3 |
| `audhumbla_v2` PRIMORDIAL_MILK | 6.70 → 6.20 | 6.43 → 10.73 | 1.04 → 0.58 | **×0.55** | ×3 |
| `kraken_v1` ABYSSAL_INK_SYS | 3.70 → 6.53 | 3.63 → 5.90 | 1.02 → 1.11 | **×1.09** | ×3 |
| `ratatoskr_v1` GOSSIP_NODE | 18.57 → 8.10 | 3.70 → 6.57 | 5.02 → 1.23 | **×0.25** | ×1 rate |
| `nidhoggr_v1` ROOT_CORRUPTION | 2.37 → 2.30 | 4.10 → 7.50 | 0.58 → 0.31 | **×0.53** | ×3 |

**Every ×3 prediction is wrong, and three firmwares fire LESS often per turn at width.**

**Why the audit was wrong, and it is worth carrying:** a guard that ALLOWS three times as many
sources does not produce three times as many events. These hooks key on things bounded by CARDS
PLAYED — attacks landing, heals cast, HP thresholds crossed, non-natural draws — and at 3v3 the hand
is SHARED, so each individual member plays *fewer* cards per turn than it would alone. Three bodies
splitting one hand is not three copies of a 1v1 deck. **A per-play, owner-scoped OS therefore fires
LESS per turn at width, not more** — the mirror image of what the guards suggested, and the same
shape as ticket 110's finding that control's answer output does not scale with body count.

**Consequences for the four flagged in §3:**

1. **`skoll_v1` TREACHERY needs no width nerf.** ×0.99 per turn — identical. Its over-feed (peak 13.7
   stacks against a 12.5 cap) is the 1v1 problem it has always had, and width does not touch it. The
   free `target: ALLY` → `target: SELF` lever stays available but is not called for by this data.
2. **`audhumbla` still wants the guard fixed, but for correctness, not for scale.** ×0.55 per turn, so
   the ally-heal leak is not a balance emergency — but the card text still says "casts" while the code
   says "is healed", and Henry has ruled the text is right.
3. **`nidhoggr_v2` BLOOD_SCENT is the only one that genuinely gains: ×1.44 per turn.** Henry called
   this intended ("it rarely fires in 1v1; this makes him powerful in a team setting") and the size is
   modest rather than alarming. A 1v1 nerf to hold the 3v3 version down is defensible but +44% is a
   long way from the ×3 the guard implied.
4. **`kraken_v1` ABYSSAL_INK is flat at ×1.09** — three times the procs it looked entitled to never
   materialised, and the effect is still smeared over three enemies. Ticket 110's answers-divide
   finding in miniature, now with the proc side measured too.

**Caveats:** 30 games a row, one opponent set, one seed base. ×0.99 and ×1.09 are inside noise; ×0.25,
×0.55 and ×1.44 are not. The win rates in the raw JSON are NOT balance readings — the teammates and
opponents are fixed for comparability, not matched.
