# The deep field grid (ticket 76): where every deck lives, and whether the two wheels turn

Henry, 2026-08-17: *"do a deep field test to see where each deck lives (all 32 please), figure
out what 0 win cells remain between matchups. I also want to see if our advantages hold. Type
gives the most advantage, but then check our deck archetype rock-paper-scissors matchups are
correct. Zoo beats ramp beats control beats zoo."*

**Instrument.** Every deck against every other DECK - not against a species' default OS, which is
what ticket 69's census did and why it could not test the archetype web at all. **960 cells, 30
iterations x both turn orders = 57,600 battles.** Baseline `2c09625`, after tickets 73, 74.
`scratch/deckgrid.ts`, artifact `docs/balance/deck_grid.json`.

Why the deck-level grid was necessary: roles are assigned **per deck**. `jormungandr_v1` is Zoo
and `jormungandr_v2` is Burst. With the opponent always playing `availableOS[0]`, half of every
role's members were never on the board as an opponent, so the wheel had never actually been
measured.

## 1. Where each deck lives

| deck | field | 0% cells | 100% cells | out of band /31 |
|---|---|---|---|---|
| fenrir_v1 | **24.4%** | **14** | 1 | **21** |
| hel_v1 | **24.7%** | 5 | 0 | 8 |
| kraken_v2 | **25.1%** | 5 | 0 | 15 |
| fafnir_v1 | 29.1% | 5 | 2 | 20 |
| fafnir_v2 | 31.8% | 7 | 3 | 19 |
| draugr_v2 | 35.1% | 5 | 2 | 18 |
| sleipnir_v2 | 36.5% | 2 | 0 | 13 |
| skoll_v2 | 38.3% | 2 | 0 | 13 |
| sleipnir_v1 | 39.1% | 0 | 1 | 4 |
| kraken_v1 | 40.8% | 5 | 2 | 21 |
| gullinbursti_v2 | 41.0% | 4 | 2 | 12 |
| ratatoskr_v2 | 43.9% | 4 | 0 | 11 |
| skoll_v1 | 43.9% | 6 | 4 | 15 |
| ratatoskr_v1 | 44.0% | 1 | 0 | 10 |
| audhumbla_v2 | 44.0% | **6** | **5** | **20** |
| fenrir_v2 | 45.1% | 1 | 2 | 9 |
| hraesvelgr_v1 | 45.2% | 0 | 0 | **1** |
| draugr_v1 | 46.5% | 1 | 0 | 10 |
| jormungandr_v1 | 49.8% | 1 | 2 | 13 |
| huldra_v2 | 52.0% | 2 | 4 | 14 |
| gullinbursti_v1 | 53.6% | 3 | 5 | 17 |
| valkyrie_v1 | 55.6% | 2 | 3 | 13 |
| jormungandr_v2 | 56.1% | 1 | 4 | 12 |
| huldra_v1 | 56.9% | 1 | 5 | 17 |
| audhumbla_v1 | 66.3% | 0 | 1 | 8 |
| valkyrie_v2 | 69.9% | 0 | 2 | 9 |
| hraesvelgr_v2 | 74.5% | 0 | 1 | 7 |
| ymir_v1 | 75.7% | 0 | **11** | 15 |
| nidhoggr_v2 | 76.1% | 1 | 3 | 14 |
| nidhoggr_v1 | 78.2% | 0 | 4 | 13 |
| ymir_v2 | **81.4%** | 0 | **10** | 15 |
| hel_v2 | **81.4%** | 0 | 4 | 13 |

**57-point spread, 24.4% to 81.4%.** 43.8% of cells out of band, **84 at an absolute 0% and 83 at
an absolute 100%**, FTK 2 (the accepted `skoll_v1`-vs-`jormungandr` cell, unchanged).

Two decks worth naming immediately:

- **`fenrir_v1`: 14 zero cells and 21 of 31 out of band.** By cell count this is the roster's
  most broken deck and it is not in any queue.
- **`hraesvelgr_v1`: ONE cell out of band across the whole grid.** The cleanest deck in the game
  by a distance, and the model for what the standard looks like when it is met.
- **`audhumbla_v2`: 6 zeros AND 5 hundreds at a 44.0% mean.** The `gullinbursti_v1` pathology in
  its purest form - perfectly average on aggregate, decided outright in 20 of 31 matchups.

## 2. Type advantage: it holds, and it is bigger than we thought

| bucket | cells | mean win rate | out of band | 0% | 100% |
|---|---|---|---|---|---|
| ADVANTAGED | 176 | **83.7%** | 55.7% | **0** | 45 |
| NEUTRAL | 608 | 50.2% | 37.7% | 38 | 38 |
| DISADVANTAGED | 176 | **16.7%** | 52.8% | 46 | **0** |

**A 67-point swing** - up from the 61.5 the species-level census measured, because the deck-level
grid removes the smoothing. And it is perfectly one-directional: **no advantaged deck ever loses
a matchup 0-100, and no disadvantaged deck ever wins one.** Neutral sits at 50.2%, dead centre.

The type chart is doing exactly what it was designed to do. Under the 3v3 decision this is the
strategic layer and these cells are exempt by design.

## 3. The archetype wheel: one leg of three

Neutral cells only, so the type chart is out of the picture. Raw:

| attacker \ defender | ZOO | RAMP | CONTROL | BURST |
|---|---|---|---|---|
| **ZOO** | 53.6% | 35.8% | 40.0% | 39.9% |
| **RAMP** | 65.7% | 51.3% | 72.8% | 54.5% |
| **CONTROL** | 53.3% | 27.1% | 49.9% | 31.9% |
| **BURST** | 59.5% | 46.2% | 67.9% | 49.8% |

| claim | measured | verdict |
|---|---|---|
| ZOO beats RAMP | **35.8%** over 19 cells | **INVERTED** - ramp beats zoo 65.7% |
| RAMP beats CONTROL | **72.8%** over 41 cells | **HOLDS** |
| CONTROL beats ZOO | 53.3% over **3 cells** | **FLAT, and unmeasurable** |

Raw win rate confounds "this is a good matchup" with "this role is just stronger", so here is the
same table with each deck's own neutral average subtracted - **positive means this deck does
better than usual into that role**:

| attacker \ defender | ZOO | RAMP | CONTROL | BURST |
|---|---|---|---|---|
| **ZOO** | +13.2 | **-4.3** | -0.4 | +0.2 |
| **RAMP** | +16.4 | -5.6 | **+5.8** | -3.0 |
| **CONTROL** | **+26.1** | -8.1 | +13.7 | -2.5 |
| **BURST** | +9.2 | -5.2 | +4.0 | +0.4 |

Read the **columns**, not the diagonal. **Every role does better than usual into ZOO** (+13.2,
+16.4, +26.1, +9.2) and **every role does worse than usual into RAMP** (-4.3, -5.6, -8.1, -5.2).

**That is not a wheel. It is a ladder: RAMP > BURST > CONTROL ~ ZOO.** Zoo is food for everyone
and ramp is hard for everyone, regardless of who is asking.

Role means, neutral cells: **RAMP 58.5%, BURST 51.9%, ZOO 40.0%, CONTROL 35.0%.**

### Why the wheel cannot close

**The Control-beats-Zoo leg has 3 neutral cells in the entire grid.** Zoo has only **3 decks**
(`hraesvelgr_v1`, `jormungandr_v1`, `sleipnir_v1`) against Control's 7, so there are 21 possible
pairings - and the type chart claims 18 of them. The leg that closes the wheel is drowned by the
other wheel.

Role sizes are the root problem:

| role | decks | share |
|---|---|---|
| BURST (flex, no licence) | **13** | 41% |
| RAMP | 9 | 28% |
| CONTROL | 7 | 22% |
| **ZOO** | **3** | **9%** |

**A wheel with a 3-deck spoke and a 13-deck flex hub cannot turn.** The one leg that does hold -
RAMP into CONTROL, +5.8 normalised over 41 cells - is the pairing with the most cells behind it,
which is not a coincidence.

### The roles ARE real, though

Average game length by attacking role: **ZOO 4.8 turns, BURST 5.2, CONTROL 7.2, RAMP 7.3.** The
archetypes behave exactly as labelled - the fast decks are fast and the slow decks are slow. The
identities exist. What does not exist is the counter-relationship between them.

## 4. Neutral absolutes - the hard gate

**38 neutral cells at 0% and 38 at 100%**, which under the bucket-band standard are 76 gate
failures. Worst offenders:

| deck | neutral cells lost outright | | deck | neutral cells won outright |
|---|---|---|---|---|
| fenrir_v1 | 7 | | ymir_v1 | 5 |
| audhumbla_v2 | 6 | | audhumbla_v2 | 5 |
| hel_v1 | 5 | | hel_v2 | 4 |
| fafnir_v2 | 3 | | nidhoggr_v1 | 4 |
| draugr_v2 | 3 | | gullinbursti_v1 | 3 |

`audhumbla_v2` appears on **both** lists with 6 and 5. `fenrir_v1` loses 7 neutral cells outright
- to `audhumbla_v1/v2`, `hraesvelgr_v2`, `nidhoggr_v1/v2`, `valkyrie_v1/v2`, which is "every ramp
deck and both nidhoggrs."

## 5. What I would put to Henry

1. **The wheel needs deck reassignment before it needs tuning.** Three zoo decks cannot counter
   nine ramp decks, and 13 burst decks is not a flex spoke, it is the roster. Either promote
   decks into ZOO/CONTROL or accept a different structure.
2. **Zoo is the weakest role and loses to everything, including the role it is supposed to prey
   on.** If Zoo-beats-Ramp is a design commitment, that is the single biggest gap in the game -
   and `jormungandr_v1`, ticket 74's patient, is one of the three zoo decks.
3. **The RAMP role is 9 decks at a 58.5% neutral mean and beats every other role.** The ladder is
   really "ramp is the best archetype." Worth deciding whether that is intended before individual
   deck passes chase it.
4. **`fenrir_v1` should jump the queue.** 24.4% field, 14 zero cells, 21/31 out of band - the
   worst deck in the game by cell count and not currently scheduled.
5. **`ymir_v1`/`v2` (11 and 10 cells at 100%) are the biggest blowout dealers** and, unlike
   `jormungandr_v1`, have never had a pass.
6. **The type chart needs no work.** 67-point swing, perfectly one-directional, neutral dead
   centre at 50.2%. It is the healthiest system in the game.

## Method notes

- Same-species pairings (v1 vs v2) are excluded - the OS-variance suite owns those - which is why
  960 cells rather than 992.
- Decisive win rate, pooled across both turn orders.
- 60 games a cell puts 1-sigma around 6 points mid-band, so a single cell reading 88 vs 92 is not
  a distinction. The **counts** of 0%/100% cells and the role aggregates (19-108 cells each) are
  solid.
- Roles are read from `research/archetype-web.md` including Henry's 2026-08-16 orphan
  assignments. `fafnir_v1` RAMP, `fafnir_v2` BURST, `gullinbursti_v1/v2` BURST.
