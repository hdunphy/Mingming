# STAB sweep — does softening STAB fix mixed-party decks?

Run 2026-08-04. Question from the deck-building philosophy discussion: `STAB_BONUS = 1.5`
(`combatUtils.ts:20`) means a mixed-element party plays any given card at full power on only one of
its three units. Proposal was to reduce it to ~1.33 or ~1.25. The worry: STAB reduction is a global
damage nerf, and seven base decks already cannot beat a copy of themselves, so it might buy
deckbuilding freedom at the cost of more stalemates.

## Method

- `runPairedBatch` from `src/debug/balance/`, **24 seeds under both turn orders** (48 battles per
  matchup), `maxTurns: 40`. Turn order is pooled because `firstMoverEdge` ranges from +24.5% to
  −39.3% by species — a single orientation measures turn order, not balance.
- **Decisive win rate** (draws excluded) throughout. Several decks stall a large fraction of runs;
  scoring those as losses manufactures bias.
- Identical seed set at every STAB value, so the comparison is paired rather than six independent
  samples.
- STAB varied through a temporary env-driven constant; `src/` was restored byte-identical
  afterwards (verified by checksum).
- **Stalemate** = a species whose mirror match ends in a draw ≥50% of the time.
- Gauntlet arm = `kraken` (the control archetype) against the other 15 species.

## 1. Stalemates — the headline risk

| STAB | stalemate decks | valkyrie draw rate | huldra draw rate |
|---|---|---|---|
| **1.50** (today) | 7 | 0.63 | 0.10 |
| **1.40** | 7 | 0.77 | 0.15 |
| **1.33** | 7 | 0.79 | 0.33 |
| **1.25** | 7 | 0.98 | 0.33 |
| **1.15** | 8 | 1.00 | 0.54 |
| **1.00** | 8 | 1.00 | 0.83 |

The count holds at 7 all the way down to 1.25 and only tips to 8 at 1.15, when huldra crosses the
threshold. **The stated concern does not bite at either proposed value.**

But the binary count hides continuous decay, and that is the real finding. Valkyrie is already
marginal at 0.63 and is **effectively dead at 1.25 (0.98)** — it just does not cross a new threshold
because it was already over it. Huldra triples from 0.10 to 0.33 by 1.33. The seven hard stalemates
(`fafnir`, `gullinbursti`, `ymir`, `draugr`, `hel`, `nidhoggr`, plus valkyrie) sit at 1.00 draws at
every value and are unaffected — their problem is not damage scale, it is that they have no closer.

## 2. Game length

| STAB | median turns | p75 | max |
|---|---|---|---|
| 1.50 | 3.35 | 4.17 | 6.23 |
| 1.40 | 3.90 | 4.38 | 6.46 |
| 1.33 | 3.94 | 4.54 | 6.48 |
| 1.25 | 4.23 | 5.00 | 7.33 |
| 1.15 | 4.79 | 5.06 | 7.54 |
| 1.00 | 5.63 | 6.04 | 8.50 |

Monotonic, as expected from a damage nerf: **+18% at 1.33, +26% at 1.25, +68% at 1.00.** In absolute
terms this is modest — 0.6 to 0.9 of a turn — because games are very short to begin with. Worth
noting against the ~29-cards-seen-per-game figure from the deck-size analysis: at 1.25 a game shows
you roughly 30 cards instead of 23, which slightly *raises* the deck size at which bloat starts.

## 3. Does it reduce archetype polarisation? No.

| STAB | win-rate stdev | polarised matchups (≤5% or ≥95%) |
|---|---|---|
| 1.50 | 0.453 | 11 / 15 |
| 1.40 | 0.462 | 12 / 15 |
| 1.33 | 0.468 | 12 / 15 |
| 1.25 | 0.455 | 10 / 15 |
| 1.15 | 0.461 | 12 / 15 |
| 1.00 | 0.428 | 11 / 15 |

**Flat.** Spread does not compress even with STAB removed entirely. Matchups stay near-totally
polarised — 10 to 12 of 15 decided at ≥95% or ≤5% — at every value.

This is the result that contradicts the premise. If the hope was that softening STAB would make weak
archetypes competitive, it will not: **STAB is not what makes matchups lopsided.** That comes from
somewhere else — the type-effectiveness matrix, OS variance (already measured at up to 100%), or
raw base-deck quality. Reducing STAB changes the mono-vs-mixed tradeoff and nothing else.

## What the data says

1. **1.33 is safe.** No new stalemates, +18% game length, no archetype it kills that was not already
   dying. If the goal is more deckbuilding freedom, this is the value the data supports.
2. **1.25 is the edge.** Same stalemate count, but valkyrie goes to 98% draws and is functionally
   removed from the game. Defensible only if valkyrie is getting a rework anyway.
3. **Below 1.25 degrades fast** — 1.15 adds a stalemate deck outright and 1.00 pushes huldra to 83%.
4. **Do not expect rebalancing.** Softening STAB buys deck flexibility. It does not fix the
   polarisation, and it does not touch the seven decks that cannot close a game.

## Limits — read before deciding

- **The mixed-party benefit was not measured.** That is a 3v3 question, and 3v3 costs ~7.8s per
  battle against ~40ms for 1v1 (depth-3 minimax over three units), so a properly powered run is a
  dedicated exercise, not a sweep arm. A first attempt at 3 seeds had both a mono party and a mixed
  party win 100% against a deliberately strong opponent set, which points at a **player-side
  advantage in 3v3 deck construction** — worth investigating on its own before any 3v3 result is
  trusted. So this sweep quantifies the *cost* of lowering STAB, not the *benefit*.
- Every arm uses base decks at level 15 with uniform IVs. Constructed decks may behave differently,
  and constructed decks are what the philosophy question is actually about.
- The gauntlet arm is `kraken` versus the field. A different control would give different absolute
  win rates, though the stdev-is-flat conclusion held across all six conditions.
- `maxTurns: 40` rather than the suite's 60. The seven hard stalemates draw at 1.00 either way; a
  deck that needs 40+ turns to win is already failing the §2.2 turn-count redline.
