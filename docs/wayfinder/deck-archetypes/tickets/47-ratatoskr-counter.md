# Ratatoskr's 0.20 was a counter, not a gap — and half the roster had never met the floor

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-10
- Blocked by: [46-pricing-cleanse](46-pricing-cleanse.md) (closed)

## Question

`OS_GAP os:ratatoskr` had been lit since ticket 40 and had fallen twice more since — 0.610 → 0.330
(ticket 40) → 0.180 (ticket 43) → 0.200. §2.3 says the same thing every time: *"the weaker variant
needs a buff or a lower cost."*

It was wrong about which problem this is.

## The measurement that reframed it

A round robin of both ratatoskr decks against the nine tuned species, 50 games per pairing:

| deck | vs the field | vs the control floor |
|---|---|---|
| ratatoskr_v1 | **0.469** (211–239) | control wins **0.00** |
| ratatoskr_v2 | **0.416** (187–263) | control wins **0.50** |
| head to head (§2.3) | v1 **0.207** | — |

**Five points apart against the field; sixty apart against each other.** Their per-opponent profiles
are near-clones — both beat kraken 1.00 and jormungandr 0.96/1.00, both lose to fenrir, sköll,
huldra, hel and nidhoggr. Neither deck is mis-powered. §2.3 was reporting an *interaction*.

Buffing v1 was therefore the only safe direction — but for the reason §2.3 does not state. Nerfing
v2 would have pushed the deck that is **already the weaker of the two against the field** further
down to satisfy a gate that cannot see absolute power. That is precisely the mistake ticket 39 made
with nidhoggr, in the opposite direction.

## Why v2 eats v1

v2 applies **17.4 Dazed per game**. `slander` casts at a **median of 13 stacks for 16.2 damage a
play**, and `nagging_bite`'s +20 conditional is effectively unconditional. Against that:

**v1 is the only deck in the roster with no answer to a status clock at all** — no cleanse, no shed,
and GOSSIP_NODE's entire payout is 2.5% of maxHP per 0-cost play, which on a 62 HP frame floors to
**1 HP**. Across ~34 plays that is ~17 HP of healing against 77.5 damage. `healing_mist` adds 7.9
HP/game across 2.8 plays.

**The two firmwares pay out at exactly the same rate — one HP or one Dazed per 0-cost play — and one
of those is worth far more than the other.** That is the whole matchup.

## The dial (150 games each, common seeds, replacing `healing_mist`)

| v1's answer | §2.3 |
|---|---|
| none — as shipped | **0.207** |
| 0e, −1 Dazed −1 Weakened | 0.300 |
| 0e, −2 Dazed | 0.373 |
| 0e, −2 Dazed −2 Weakened | 0.407 |
| 0e, −2/−2 **plus** heal 15 | 0.533 |
| 0e, −3 Dazed −3 Weakened | 0.600 |
| 1e, full `purify` | 0.647 |

Three findings live in that table.

1. **A full cleanse is a switch; a partial one is a dial.** `purify` swings the matchup 0.21 → 0.65
   with nothing in between, which is the hard-counter behaviour Henry predicted in ticket 45 when he
   priced the control's cleanse at 2 Energy. A *partial* shed is monotonic and tunable across the
   whole band. Same lesson as ticket 35's type multiplier: **when a mechanic is a coin flip, change
   its shape, don't shave its number.**
2. **Dazed is the load-bearing half.** Removing 3 Dazed reads 0.450 against 0.350 for removing 3
   Poison, because Dazed feeds `slander` *and* `nagging_bite` while Poison only ticks.
3. **A 1e utility card is strictly worse than the same effect at 0e in this deck.** A larger 1e shed
   (−4/−4/−4) measured **0.388** against the 0e −2/−2's **0.407**: at 1e it costs the whole turn's
   Energy on a 3-Energy frame *and* skips both the `echo_chamber` token and the OS proc. A 0-cost
   spam deck pays for utility twice.

**The enabler fix was tried first and overshot.** Giving GOSSIP_NODE "shed 1 debuff stack per 0-cost
play" — the exactly symmetric answer to INSTIGATOR_OS — lands at **0.807**, because v1 plays ~34
cards a game against v2's 17 Dazed and the rate cancels the engine outright. Another switch. Henry's
enabler-first law is still right about *where* to look; here the rate the enabler fires at is the
thing that makes it unusable as a knob.

## Change

**New card `shrug_off`** — 0e Nature, *"Remove 2 Dazed and 2 Weakened."* Element-shared, so the
Nature pool carries it rather than ratatoskr alone.

**ratatoskr_v1: `squirrel_away` → `shrug_off`.** Eleven cards, unchanged count. Three placements
were measured; this one moves v1's field score least:

| slot taken | §2.3 | v1 vs field |
|---|---|---|
| `squirrel_away` (1e, draw 2) — **shipped** | 0.420 | **0.525** |
| `healing_mist` (0e heal) | 0.407 | 0.542 |
| one `water_slap` | 0.460 | 0.586 |

**Say this plainly: fixing the gate widens the true spread.** v1/v2 were 0.47/0.42 against the field
and are now ~0.53/0.42. §2.3 goes from 0.207 to 0.510 while the decks move *further* apart in
absolute power. The gate improves; the underlying fact gets slightly worse. That is the honest cost
of satisfying a same-species gate, and it is worth watching if v2 is ever revisited.

## Two scorer fixes the card required

**1. Negative `stacks` had no sign flip (HANDOFF item 14, open since ticket 29).** `absStacks`
strips the sign before the status tables are read, so `soothe` — *"remove 1 Weakened, remove 1
Dazed"* on SELF — priced as if it **applied** both and then took the self-debuff negation. It scored
**−0.80** for a card that helps you. Fixed with the same shape as ticket 43's `consume` flip.

**2. A partial removal cannot be worth more than removing everything.** Ticket 46 priced CLEANSE at
10 power from the measured debuff *load*; the status tables price *stacks*. So "remove 2 Dazed + 2
Weakened" scored **1.70** while a full cleanse — which removes that and everything else — scored
**1.00**. A card's total self-facing debuff removal is now capped at `CLEANSE_POWER`, on the
dominance argument: a full cleanse strictly dominates any partial one, so it must price above it.

Capped on the **card's total, not per action** — the dominance argument is about what the card does,
and two half-removals summing past a full cleanse is exactly the case being caught.

Exactly four cards in the registry are touched, and every move is downward:

| card | before | after | note |
|---|---|---|---|
| `soothe` 0e | **−0.80** | **0.80** | sign fix; now sits on its 0e floor |
| `shrug_off` 0e | — | **1.00** | 1.50 uncapped; capped lands it exactly at band |
| `umbral_feast` 1e | 2.60 | **2.00** | now reads *under* its 2.4 floor |
| `ash_communion` 2e | 9.70 | **7.10** | still over its 6.5 band, by 0.6 instead of 3.2 |

`umbral_feast` and `ash_communion` both consume their **own** debuff as fuel, so the removal was
being counted as a defensive gain *and* as the payoff's input. The cap bounds only the defensive
half; the `STATUS_CONSUMED` payoff is priced separately and did not move. Neither card's behaviour
changed. **`umbral_feast` reading under band is a reading, not a defect** — nidhoggr_v2 is untouched
and still passes.

## The gauntlet only ever measured `availableOS[0]`

Found while checking whether v2 was weak in absolute terms: **the archetype gauntlet took the
registry's default OS for every opponent, so in a roster where every species carries two decks, half
of them had never been measured against the floor at all.** §2.3 cannot cover for it either — it
reports the gap *between* the two firmwares and is blind to where either one sits — so a deck could
be below the floor with every gate green. Same class of blind spot as ticket 42's, and Henry's call
was to fold the fix into this ticket.

The gauntlet now runs every firmware. **The control's win rate against each slot-2 deck, measured
for the first time:**

| control wins | slot-2 deck |
|---|---|
| **0.99 / 0.95 / 0.94** | **jormungandr_v2, valkyrie_v2, hel_v2** |
| 0.77 / 0.64 | draugr_v2, sköll_v2 |
| 0.53 / 0.50 / 0.44 | kraken_v2, ratatoskr_v2, fenrir_v2 |
| 0.17 / 0.01 / 0.01 | huldra_v2, sleipnir_v2, fafnir_v2 |
| 0.00 | ymir_v2, nidhoggr_v2, hræsvelgr_v2, gullinbursti_v2, audhumbla_v2 |

Aggregates, recorded as their own rows so the calibration stays checkable:

- **slot 1: 0.235** — ticket 45 calibrated the control to 0.237 against exactly this set, so the
  floor is still where it was put.
- **slot 2: 0.367**
- pooled: 0.301

**The roster's slot-2 decks are systematically weaker than its slot-1 decks, and eight of sixteen sit
at or below the floor.** `hel_v2` at 0.94 is the loudest: hel shipped in ticket 36 passing every
first-pass band, and every one of those bands was blind to this.

## Gate

Full committed run, registry `1:4d47138a`. **Redlines 45 → 44.**

- **cleared** `OS_GAP os:ratatoskr` — **0.200 → 0.510**, dead centre of the 0.30–0.70 band
- **changed** `ash_communion` 9.70 → 7.10 (still a redline, smaller)
- nothing added
- `mirror:ratatoskr` 400/400 decided at 4.57 turns, dead cards 4.3%/4.2%, ftk 0
- 766/766 tests, `tsc --noEmit` clean

**Read the gauntlet rows as a re-measurement, not a diff.** `matchupScenario`'s default seed embeds
`enemyOS`, which is now always explicit, so every gauntlet seed changed. Slot-1 rows moved within
±0.07 (draugr 0.86 → 0.79 and valkyrie 0.98 → 0.94 are the largest) with no structural change. Every
`os:` and `mirror:` row outside ratatoskr is byte-identical, which is the check that confirms the
movement is reseeding and not the deck.

## Left open

- **Eight slot-2 decks at or below the floor**, `hel_v2` (0.94), `valkyrie_v2` (0.95) and
  `jormungandr_v2` (0.99) worst. Each wants its own pass; hel is the surprise because she passed
  everything.
- **v1 and v2 are further apart in absolute power than before** (~0.53 / 0.42) even though §2.3 now
  reads 0.51. If ratatoskr is revisited, that is the number to move, not the gate.
- **`umbral_feast` now reads under its 1e floor** at 2.00 — a consequence of the removal cap, not a
  regression.
- **`ash_communion` is still over budget** at 7.10 against 6.5, and still in fenrir_v2. Wants the
  fenrir polish pass HANDOFF has been asking for since ticket 43.
- **The `soothe` fix generalises.** Any future "shed N stacks" card now prices correctly; before this
  ticket every one of them would have scored negative.
