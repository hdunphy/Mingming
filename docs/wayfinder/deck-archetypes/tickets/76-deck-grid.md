# Deep field grid (ticket 76): all 32 decks head to head, and do both wheels turn?

- Type: wayfinder:research - REPORT-ONLY. Henry-requested, 2026-08-17.
- Status: **closed** (2026-08-17)

## Ask

Henry: *"do a deep field test to see where each deck lives (all 32 please), figure out what 0 win
cells remain between matchups. I also want to see if our advantages hold. Type gives the most
advantage, but then check our deck archetype rock-paper-scissors matchups are correct. Zoo beats
ramp beats control beats zoo."*

## Why it had to be a DECK grid

Ticket 69's census ran 32 decks x 15 opponent SPECIES, with the opponent always on
`availableOS[0]`. That is enough to find 0%/100% cells and it is what the standing gate suite
runs - but it **cannot test the archetype web**, because roles are assigned per DECK.
`jormungandr_v1` is Zoo and `jormungandr_v2` is Burst, and half of every role's members were
never on the board as an opponent. So the wheel had never been measured at all.

960 cells (same-species pairings excluded - the OS-variance suite owns those), 30 iterations x
both turn orders, **57,600 battles**.

## Resolution (2026-08-17)

Report: [research/deck-grid-census.md](../research/deck-grid-census.md). Instrument
`scratch/deckgrid.ts`, artifact `docs/balance/deck_grid.json`.

**Type holds and is bigger than we thought: a 67-point swing** (ADV 83.7% / NEU 50.2% / DIS
16.7%), up from the species census's 61.5 because the deck grid removes the smoothing. Perfectly
one-directional - **no advantaged deck ever loses a cell 0-100 and no disadvantaged deck ever
wins one** - and neutral sits dead centre. The type chart needs no work.

**The archetype wheel does not turn. One leg of three.**

| claim | raw | normalised* | verdict |
|---|---|---|---|
| ZOO beats RAMP | 35.8% (19 cells) | **-4.3 pts** | **INVERTED** |
| RAMP beats CONTROL | 72.8% (41 cells) | +5.8 pts | **HOLDS** |
| CONTROL beats ZOO | 53.3% (**3 cells**) | +26.1 pts | **unmeasurable** |

\* win rate minus the attacking deck's own neutral average, which separates "good matchup" from
"strong role".

Read the normalised table by COLUMN and the structure is not a wheel but a **ladder**: every role
does better than usual into ZOO and worse than usual into RAMP. **RAMP 58.5% > BURST 51.9% > ZOO
40.0% > CONTROL 35.0%** on neutral cells.

**The wheel cannot close because of role sizes: ZOO 3 decks, RAMP 9, CONTROL 7, BURST 13.** The
Control-beats-Zoo leg has **3 neutral cells in the entire grid** - Zoo x Control is 21 pairings
and the type chart claims 18 of them. The one leg that holds is the one with the most cells
behind it.

**The roles themselves are real**: game length by attacking role is ZOO 4.8 turns, BURST 5.2,
CONTROL 7.2, RAMP 7.3. The archetypes behave as labelled; the counter-relationships between them
do not exist.

**Where the decks live: a 57-point spread, 24.4% to 81.4%.** 43.8% of cells out of band, **84 at
absolute 0% and 83 at absolute 100%**, of which **38 and 38 are NEUTRAL** - 76 failures of the
bucket-band hard gate. FTK 2, the accepted cell, unchanged.

New names the queue does not have:

- **`fenrir_v1` is the worst deck in the game by cell count** - 24.4% field, **14 zero cells**,
  21 of 31 out of band - and is in no queue.
- **`hraesvelgr_v1` has ONE cell out of band in the whole grid**, the cleanest deck by a
  distance, and the model for what the standard looks like when met.
- **`audhumbla_v2` has 6 zeros AND 5 hundreds at a 44.0% mean** - the `gullinbursti_v1` pathology
  in its purest form.
- **`ymir_v1`/`v2` hold 11 and 10 cells at 100%**, the biggest blowout dealers on the roster, and
  neither has had a pass.
- `jormungandr_v1` lands at 49.8% post-ticket-74, mid-pack, 1 zero and 2 hundreds.

Six questions for Henry at the end of the report; the two that block other work are whether the
wheel gets deck REASSIGNMENT before any tuning, and whether "ramp is the best archetype" is
intended.
