# Kraken diagnostic (ticket 65): who beats the healthy deck, and by how much

- Type: wayfinder:research - REPORT-ONLY. No changes of any kind. Suitable for a
  lower-tier model.
- Status: **closed** (2026-08-15) - report delivered, nothing changed.
- Assignee: -
- Blocked by: none (read-only); if sharing the tree with the ticket-64 agent, run after.
- Template and quality bar: research/fire-investigation.md.

## Why

Both kraken decks sit below the field window (~25-27) while passing EVERY other instrument:
control 0.76/0.85 in kraken's favor, dead cards ~0.10 (best in class), FTK 0, first-mover
+0.5% (most neutral in roster), mirror 5.2 turns. Profile says relative decay, not defect -
kraken was tuned in ticket 20, four element passes + the pace amendment + the Burn rework
ago. Measure before anyone designs.

## Questions, each with measurements (60-iteration attribution; field rows at 30 per
0-DECISION-GRADE; seed-base law near any line)

1. **Per-opponent field row for kraken_v1 and kraken_v2** (8-DIFF): all 15 species, ranked
   by win rate. Which matchups carry the sub-window number - a broad shortfall or specific
   hard counters?
2. **Damage/turn vs the roster norm** under current pace, plus per-card attribution
   (damage/play, share, dead rate) for both decks - the fire-investigation table format.
3. **TIDAL_CRUSH delivery**: how much damage does the 1.2x multiplier actually add per game
   now? And the ticket-20 P2 package (+20% boost): is it still firing at its designed rate?
4. **surge_protection post-rework read** (2e, ATTACK 40, refund): cast rate, delivered
   damage, refund uptake - it was ticket 55's accidental kraken fix; is it carrying?
5. **Detonation non-interaction confirmed**: kraken applies no Burn - verify its rows moved
   only within noise across the ticket-62 ship (8-DIFF against the pre-62 report).
6. **Game-length context**: kraken's average game vs the roster's; does the 5.2-turn mirror
   pace fit its archetype under rev-3.1 pacing?

## Deliverable

research/kraken-diagnostic.md (CRLF), findings ranked by decision-relevance with the
measurement behind each, a knob-vs-design-session recommendation WITH its supporting
numbers, questions-for-Henry list, card appendix. ONE commit (research file + ticket
closed). No changes executed.


---

## Resolution (2026-08-15) — delivered, report-only

[research/kraken-diagnostic.md](../research/kraken-diagnostic.md). 1,800 real battles (900 per
deck: 15 opponents x 30 seeds x both turn orders). **No changes of any kind were made.**

**The headline reframes the ticket's own premise.** The brief said "relative decay, not defect."
It is neither: **kraken does not lose narrowly, she loses completely.** kraken_v1 reads 26.6% and
kraken_v2 27.3%, but v1 **wins 75-100% against four species and 0% against EIGHT** - zero wins in
60 decided games each vs jormungandr, huldra, ymir, draugr, valkyrie, audhumbla, nidhoggr and
ratatoskr. A decayed deck loses 45-55% fights; this is a wall.

**Damage rate is NOT the cause, and that redirects the fix.** kraken_v1 delivers **13.0
damage/turn** and valkyrie_v2 delivers **12.9** - the same deck by that instrument, 18 field
points apart. Comparators: jormungandr_v1 22.0, hel_v2 22.9, skoll_v1 16.3, fenrir_v2 13.9,
audhumbla_v2 6.6. Kraken is mid-pack on rate and bottom-of-roster on outcome.

**Both OSes work and neither matters.** TIDAL_CRUSH fires 1.23 times a game for **5.02 HP**,=
**8.0%** of v2's output - turning it off entirely would not touch a single 0% matchup.
ABYSSAL_INK applies 2.12 Dazed a game. **`surge_protection`'s refund fires on 3,371 of 3,371
casts (100%)** - the "if you drew a card" condition does not exist on a species that draws 3 and
builds around drawing more - but 40 printed power delivers **10.4 damage**.

**Per-card: her chip cards do not exist.** `water_slap` 1.4 and `whirlpool_v2` 1.5 damage a play,
`pressure_point` 5.6, against payoffs at 27-31. v2 is a two-card deck - `hydro_blast` 37.6% and
`surge_protection` 34.2% are 72% of her damage. `capacitor` deals 0.0 across 1,842 plays by
design, but costs 2 Energy on a 2-Energy frame twice a game.

**Detonation non-interaction: confirmed from the record rather than re-measured.** Ticket 62's
8-DIFF showed 57 of 67 rows bit-identical and every kraken row was among them; re-asking at 30
iterations would give a noisier answer than the byte-identity on file.

**Pace is exactly normal.** Kraken's 5.2-turn mirror against a roster median of 5.28, and
control-gauntlet games at 7.28/6.95 vs a 6.66 mean. Nothing indicts the clock.

**RECOMMENDATION: design session, not a knob**, with the number behind it - every available dial
moves damage output, and damage rate is measurably not what separates her from a 45% deck.
Doubling TIDAL_CRUSH to 30% buys ~5 HP a game against opponents she beats 0% of the time. What
the data points at instead: **no answer card for sustain or long games** (the eight zeros are the
roster's healers, wallers and outlasters), **the lowest HP frame in the game at 58**, and **chip
cards that deliver 1.4-5.6 damage**.

Four questions returned; the load-bearing one is whether the bimodal shape is intended identity
or a thing to flatten. **Flagged for a design session: confirm none of the eight zeros is a
mechanical lockout** - that would be a defect rather than balance, and this diagnostic did not
test for it.
