# Ratatoskr decks + card-spam engine work

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-07
- Blocked by: [31-skoll-cost-curve](31-skoll-cost-curve.md) (closed)

*Numbered 32, not 30 — the prompt was written against `74923de` and tickets 30 and 31 landed in
between. Based on `34df714`.*

## Question

Nature is next at 12/32 decks. Ratatoskr is the roster's outlier frame — **attack 55, the lowest
of all 16 species**, offset by 3 Energy and cardDraw 4. Both his OSes key on 0-cost cards:
GOSSIP_NODE heals per 0-cost, INSTIGATOR_OS applies Dazed per 0-cost. Both ran the same
placeholder list. Build a card-spam deck around a self-replicating 0-cost engine and a
Dazed-scaling deck on the same fuel.

## The premise had already changed

The prompt's baseline said ratatoskr failed three of five bands. **At `34df714` it failed none.**

| metric | prompt baseline (`74923de`) | actual (`34df714`) | band |
|---|---|---|---|
| §2.3 | 0.16 ✗ | **0.570** ✓ | 0.30–0.70 |
| mirror turns | 56.7 ✗ | **16.4** ✓ | ≤ 30 |
| mirror decided | 53/400 = 13% ✗ | **400/400 = 100%** ✓ | ≥ 60% |
| deadCards | 0 / 0 ✓ | 0.0% ✓ | ≤ 0.35 |
| ftk | 0 ✓ | 0 ✓ | 0 |

Cause: `pollen_cloud` is in the placeholder list and ticket 30 reworked it from "Apply 1 Weakened"
(zero damage) to "4 power. Apply 1 Weakened and 1 Poison." The deck's damage problem had already
been fixed sideways. The work still stood — both slots ran the *same* list, so §2.3 was measuring
the OSes alone — but the bar became "do not break what passes."

**A second stale assumption, which turned out not to matter.** The prompt sizes `slander` against
"`crippling_vine` supplies 8 stacks in one card"; ticket 30 reverted that card to **2** Dazed. The
design was costed at a realistic 13 stacks. Measured after implementation: **13.7 Dazed at cast**,
peaking at 19.9. The OS plus echo_chamber's token-doubling generates far more Dazed than
`crippling_vine` ever did, so the deviation was harmless. No design change needed.

## Resolution

### Engine

- **`RETURN` cost filter, clamped to the hand limit.** `filter.maxCost` on `ReturnActionData`,
  applied before the slice, then clamped to `HAND_SIZE_LIMIT - hand.length`. RETURN previously
  ignored the hand limit and silently dropped the overflow. `HAND_SIZE_LIMIT` was declared
  independently in `battleReducer.ts` and `deckLogic.ts`; it is now exported from `deckLogic.ts`
  and imported by both other sites. **No circular import** — `deckLogic` reaches only types,
  programRegistry, events and PRNG.
- **`DAZED_STACKS` scaler, target-side, uncapped.** Threading `target` into
  `getEffectiveAttackPower` was **not** invasive: two call sites (`AttackExecutor` and the UI's
  `computeDamagePreview`), both of which already hold a target, so it went in as an optional third
  parameter and preview/reality still share one helper.
- **GOSSIP_NODE flat → power-based heal.** `healOverride: 1` → `power: 10` (= 2.5% maxHP), so it
  scales with level. Verified at `BALANCE_LEVEL`: maxHp 74 → heals **1**, identical to before.
  Power 5 would have floored to **0** and switched the OS off silently.
- **powerscale scores daemons.** See `power_curve_spec.md` rev 3.6.

### Cards

Five new: `forage`, `squirrel_away`, `nagging_bite`, `hoarders_cache`, `slander`. Three changed:
`feedback_token` 3 → 10 power, `seed_bomb_v2` 22 → 15, `echo_chamber_v2` description. `leaf_blade`
retired into Tackle (`water_slap`) across 4 files.

Every score matched the prompt's expectation exactly once the two model gaps were closed — the
`DAZED_STACKS` branch in powerscale, and `GENERATE_CARD` no longer taking a scope multiplier on top
of the generated card's own (already-scoped) score:

| card | expected | measured |
|---|---|---|
| `forage` | 0.5 / 1.0 | 0.50 ✓ |
| `squirrel_away` | 2.3 / 3.0 | 2.30 ✓ |
| `nagging_bite` | 2.9 / 3.0 | 2.90 ✓ |
| `hoarders_cache` | MANUAL → 0.0 | 0.00, `MANUAL[RETURN]` ✓ |
| `slander` | 1.5 static | 1.50 ✓ |
| `feedback_token` | 0.9 / 1.0 | 0.90 ✓ |
| `echo_chamber_v2` | 4.9 / 6.5 | 4.90 ✓ |

**No fixture depended on `leaf_blade` being Nature-element** — both `BugFixes.test.ts` uses treat it
as a generic playable card, so the swap was safe.

### Decks

| deck | cards | 0e / 1e / 2e / 3e |
|---|---|---|
| ratatoskr_v1 | 11 | 5 / 3 / 3 / 0 |
| ratatoskr_v2 | 9 | 4 / 2 / 3 / 0 |

Both match the prompt's composition table; ≤2 copies everywhere. `hoarders_cache` is authored and
deliberately in no deck. Huldra took the holding swap only.

## Gate

| | §2.3 | mirror turns | mirror decided | deadCards v1/v2 | ftk |
|---|---|---|---|---|---|
| ratatoskr before | 0.570 | 16.4 | 400/400 | 0.0% / 0.0% | 0 |
| **ratatoskr after** | **0.590** | **4.7** | **400/400** | **1.2% / 3.8%** | **0** |
| huldra before | 0.436 | 54.6 | 153/400 | 14% / 13% | 0 |
| huldra after | 0.410 | 54.6 | 151/400 | 14.2% / 16.1% | 0 |

All five ratatoskr bands pass; the mirror fell **16.4 → 4.7 turns**, which is what this pass was
buying. Huldra is unchanged within noise — the holding swap broke nothing — and remains out of band
pending her own ticket.

### `slander` measured

68 plays over 60 games: **13.7 Dazed at cast**, **16.8 damage per play**, peak Dazed 19.9. On an
attack-55 frame that is on rate for a 2e card. **Knob 6 (cap `DAZED_STACKS`) was not needed** and
was not used — the law in rev 3.6 held.

### Knob rounds — two used

1. **`seed_bomb_v2` 15 → 10** (knob 2, v1-ward skew). **Overshot to 0.280, below the band** —
   it is a per-card multiplier, so a 5-step is a 20-power swing at ratatoskr's 4-card count.
   Reverted.
2. **`forage` self-hit 10 → 15** (knob 4, the finer instrument). §2.3 **0.660 → 0.590**, sideBias
   32% → 18%, first-mover edge +10% → +5%, mirror sideBias 1.5%. Kept.

Both `slander` upward (knob 1) and `nagging_bite` upward (knob 3) were considered and **rejected as
unauthorised**: at 13.7 realistic stacks `slander` at 6/stack hand-prices to 8.2 against a 6.5 band,
and `nagging_bite` at 25 scores 3.25 against 3.0. §7 forbids a knob that pushes a card over budget.

## Reported, not fixed

- **`fertile_ground_daemon` 7.60 against a 6.5 band** — the only daemon over budget now that they
  are scored. Follow-up ticket.
- `core_overclock_daemon` and `einherjar_standard` still score 0.00. Correct: their hooks carry no
  `do` array (a damage multiplier and a passive), so the model declines to invent a number.
- **§9's two "repo drift" items are already resolved.** `battle_rhythm` scores **3.10** (not 3.6)
  and `blood_rite` **3.40** (not 4.4) — ticket 28's mutually-exclusive-branch fix and ticket 29's
  data corrections caught both.
