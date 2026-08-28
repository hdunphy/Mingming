# The control deck: a yardstick that does not move

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-09
- Blocked by: [41-huldra-payoff](41-huldra-payoff.md) (closed)

## Question

Ticket 39 tuned nidhoggr to a §2.3 of 0.310 and a round robin then showed it was the **second
strongest deck in the roster at 87% against the field**, with v2 first at 94%. The gate had been
satisfied by pushing an already-overtuned deck *up*.

**Every gate we had measures a difference.** §2.3 is same-species, so it reports the gap between two
firmwares and is blind to where both sit. The mirror is a species against itself. The archetype
gauntlet does compare across species — but its benchmark was `kraken`, a real, elemental, tuned deck
that itself sits at 36% against the field. So the yardstick was **skewed** and, worse, **moving**:
every kraken retune silently rescaled every other species' reading.

Henry's proposal: a neutral control deck to measure everything against.

## What shipped

A `control` species that is a **measuring instrument, not a playable Mingming**.

- **Element `None`.** `None: {}` in `ElementalMatrix`, and no element carries a `None` entry either,
  so it is elementally inert in **both** directions — no STAB, no advantage, no resistance. Every
  species meets it on identical terms. That removes the largest confound in cross-element
  measurement: in the round robin the Fire decks beat poison decks by **+57 points** on the type
  matrix alone.
- **No firmware** — `NULL_FIRMWARE`, `hooks: []`.
- **Ten cards, curve 0e×4 / 1e×4 / 2e×2**, five distinct at ≤2 copies, every one priced **exactly at
  its band ceiling**: `baseline_jab` 1.0, `baseline_scuff` 1.0, `baseline_strike` 3.0,
  `baseline_snare` 3.0, `baseline_slam` 6.5. Two carry Dazed so the control is not a pure-damage
  dummy that flatters every mitigation deck and never tests a status answer.

`CONTROL_SPECIES` already existed as a concept — the gauntlet was always built around a benchmark,
it was just pointed at kraken — so the swap was two lines plus an exclusion from `BALANCE_SPECIES`
(the control has one firmware, so `osVarianceScenario` would throw, and "the control against itself"
measures nothing).

## The calibration is the headline finding

On the **median species frame** (82/85/78 across the 16 species), the control — on-curve cards, no
firmware — **lost 97.9% of 1,600 games against the entire registry**. Every species beat it and the
spread was 0–4%: as an instrument it had no resolution at all.

**A deck's power is cards + firmware + synergy, and the curve prices only the first.** The gap
measured here is what the other two are worth: **+37% HP and +24% attack** over the median frame to
reach the roster's midpoint. Cards stayed exactly on band; only the frame moved, to **110/105/95**.

At that frame it sits at 36% overall and discriminates across the full range:

| control's win rate | species |
|---|---|
| **0%** | nidhoggr, huldra, ymir, audhumbla |
| 3% | gullinbursti, ratatoskr |
| 9% | hel |
| 22% | fafnir |
| 37% | sköll |
| 50% | hraesvelgr, sleipnir |
| 53% | valkyrie |
| 81% | fenrir |
| 87% | draugr |
| 90% | kraken |
| **91%** | jormungandr |

It agrees with the independent round robin at both extremes — nidhoggr strongest, jormungandr and
kraken weakest — which is the validation that matters.

## Shipping report-only, not as a redline — a deliberate amendment

Henry chose a 35–65% band. **The measured roster spans 0–91%, so that band would fire on 12 of 16
species on day one**, and a redline that flags three-quarters of the roster is not actionable. The
numbers land in `balance_report.json` on every run; the band gets set once the roster has been tuned
toward it. Nothing is lost by deciding later, and no false failures are added now.

## A real bug caught on the way

Putting the control in `MingmingRegistry` made it eligible as a **wild encounter**. `MingmingRegistry`
had been doing double duty as "unit definitions" and "the playable roster". Now separated: an
`isControl` flag on the definition, and a `PLAYABLE_SPECIES` accessor that encounters, the roster
count and the moveset audit all enumerate through instead.

## Gate

Full committed run, registry `1:edcaf2e7`. **Redlines 45 → 45 — the set is byte-identical to
`d14cb76`**, and the five new cards add none. Cards audited 164 → 169, matchups 48 → 49 (kraken is
an opponent now rather than the benchmark). Mirror and §2.3 are **completely untouched** — the
control is excluded from both. 766/766 tests, `tsc -b` and `vite build` clean.

## Left open

- **The band.** Set it once the roster is tuned toward the control rather than away from it.
- **The five `baseline_*` cards are in the collectible pool.** They are legitimate neutral-tier
  cards by the tier's own definition, but if a drop pool ever enumerates by element they will
  appear. `isControl` covers species; cards have no equivalent flag.
- **Running a single balance suite file overwrites `docs/balance/balance_report.json` with a
  PARTIAL report.** The `BALANCE_ONLY` write-guard does not cover it. Caught here by a corrupted
  baseline comparison; worth a guard on `suitesMissing`.
- **Nidhoggr and jormungandr are the two ends of the roster** — 0% and 91% against the control. Both
  want a pass, and now there is an instrument to aim at.
