# Ticket 113 — valkyrie_v2's deck is the only one that can reach the self-draw loop

**Status:** CHANGE MADE, GATE PART-RUN. Opened 2026-08-21 on `legion/balance`.
**Henry ruled 2026-08-22: `ascension` drops `exhaust`, and the 50 power is KEPT.** Applied to
`programs.json` (description updated to match); 868/868 tests green, `npm run build` clean, card scores
**6.5** against the 2e band of 5.2-6.5. Second seed base still to run, and §7 raises one decision.
**Depends on:** ticket 111 (the engine defect). Read that first; this ticket may not be needed at all.

---

## 1. Why this deck specifically

Ticket 111's loop needs the **circulating pool** — cards that can come back around, i.e. deck size
minus everything that exhausts — to fit inside the hand. Across the eight decks holding a loop-class
card:

| deck | cards | exhaust | circulating pool | loop card | reaches the state? |
|---|---|---|---|---|---|
| **`valkyrie_v2`** | 8 | **3** | **5** | `glimmer` | **yes, in nearly every long game** |
| `hraesvelgr_v2` | 8 | 0 | 8 | `slipstream` | theoretically |
| `kraken_v1` | 8 | 0 | 8 | `undertow` | theoretically |
| `jormungandr_v1` | 9 | 0 | 9 | `undertow` | theoretically |
| `hel_v2` | 10 | 0 | 10 | `forage` | no |
| `ratatoskr_v1` | 11 | 1 | 10 | `forage` | no |
| `sleipnir_v1` | 12 | 1 | 11 | `slipstream` | no |
| `hraesvelgr_v1` | 12 | 0 | 12 | `slipstream` | no |

`falling_star` ×2 and `ascension` all exhaust, so **three of her eight cards leave circulation
permanently** and her pool is five — the smallest on the roster by a wide margin, and half the size of
the next-nearest. The other three "theoretical" decks need their *entire* pool in hand simultaneously,
which needs drawing everything and playing nothing; none of them shows the signature in the committed
grid, and valkyrie does.

**Measured cost, from `docs/balance/deck_grid.json` — committed data, not a new run:**

| cell | decisive | win rate | turns |
|---|---|---|---|
| `valkyrie_v2` vs `huldra_v1` | **17 / 60** | 0.0% | 8.25 |
| `huldra_v1` vs `valkyrie_v2` | **17 / 60** | 100.0% | 8.13 |
| `valkyrie_v2` vs `huldra_v2` | 60 / 60 | 83.3% | 6.53 |

43 of 60 games never decide, against the same species' *other* deck she wins 83.3%, and the pair reads
as a **NEUTRAL 100%/0% absolute**. Live re-measure: `glimmer` played 209 times a game, max streak 249,
max plays in a turn 254. (**§4 corrects an early reading of this**: the absolute is REAL — `huldra_v1`
beats her 100% with the loop removed too — so it is not a tracked absolute that the loop invented.)

## 2. The tension — her small pool is not an accident, it is her engine

REBIRTH_CYCLE_OS triggers on `onDeckShuffled`. **She is paid for cycling**, and `0-VALK-ENGINE`
records that *"shuffles/turn go UP when cards LEAVE — deck size drives cycling"*. So the exhaust
package that shrinks her pool to five is part of what makes her OS fire, and her OS is worth **50 of
her 88 field points**. Anything that grows the pool to break the loop takes procs off the engine that
carries her.

Two more constraints from the same entry, both load-bearing here:

- **Deck size is not a power lever for her** — 6, 7 and 8 cards all read 87-91% field. So a size change
  is cheap in power terms, which is the one thing working in this ticket's favour.
- **Her once-per-turn REBIRTH guard is load-bearing** — she reshuffles more than once on 34.7% of
  turns and the cap eats every extra one. That guard is also why the loop is "only" a turn that never
  ends rather than an infinite OS engine: during the loop she reshuffles ~250 times in a turn and the
  guard pays her for exactly one of them.

## 3. Options

**A — change nothing here; fix the engine (ticket 111, Fix B).** Excluding the currently-resolving card
from a mid-resolution reshuffle makes the reshuffle find an empty discard, the draw find nothing, and
the loop unable to form at any pool size. Zero balance cost, zero deck-list churn, and it protects the
other three theoretical decks and any future deck that drifts into the state. **This is my
recommendation, and it is why this ticket may close with no deck change at all.**

**B — grow the circulating pool above the hand size.** Needs pool ≥ 10, i.e. **12 cards with at most 2
exhaust**. That is inside the 8-12 rulebook band, so it is legal — but it is a near-rebuild of an
8-card deck, it cuts one exhaust card out of a package that is doing work, and it reduces her cycling,
which is her OS's fuel. Expensive, and it fixes one deck rather than the class.

**C — a deck-rulebook rule: a deck holding a 0-cost non-exhaust drawer must have a circulating pool
larger than the hand size.** Prevents the whole class by construction, which suits Henry's instinct
that this should be solved in the cards. But as written it indicts **four** decks today
(`valkyrie_v2`, `hraesvelgr_v2`, `kraken_v1`, `jormungandr_v1`), three of which have never actually
looped — over-broad relative to the observed harm. Worth keeping in reserve behind A rather than
shipping alongside it.

**D — take `glimmer` out of her list. Do not.** Already tried and reversed: `0-DECK-SIZE-EXCEPTION` was
undone by ticket 61 specifically to put `glimmer` back and return her to 8 cards. Re-treading it would
undo a ruling for a reason that Fix B handles for free.

## 4. MEASURED: fixing it does NOT make her stronger — I was wrong about this

The first version of this ticket claimed the fix would be worth about +2.8 field points to her and
would retire a neutral absolute. **Both claims were wrong, and the measurement is in
`scratch/valkcounter.ts`.** Two arms on the cell where the loop fires, same seeds, 60 games each —
SHIPPED, and NOLOOP (`glimmer` given `exhaust: true` in memory, so it still draws but cannot reshuffle
into its own draw):

| arm | decided | win rate | turns | glimmer plays/game | max streak | damage/game | starfall share |
|---|---|---|---|---|---|---|---|
| SHIPPED | **12 / 60** | 0.0% | 8.27 | 213.1 | 249 | 33.9 | 16.7% |
| NOLOOP | **60 / 60** | 0.0% | 8.20 | 1.0 | 1 | 32.2 | 11.3% |

**She wins 0% either way.** Removing the loop converts 48 stalled games into 48 decided *losses*. Her
recorded win rate does not move, because it is computed over decided games and was already 0.

So the two corrections:

- **No field-point gain.** Her row keeps the number it has. The fix changes 46 undecided games across
  her 1800-game row into decided ones and moves no win rate.
- **The neutral absolute is REAL.** `huldra_v1` beats `valkyrie_v2` 100% on the merits, not because of
  the loop. It should stay on the absolutes list, and anything the absolutes work concluded about it
  stands.

**Henry's hypothesis was half right, and worth recording with the number.** The loop *does* feed
`starfall` — which reads "18 power for each card a card, OS or daemon drew you this turn" — but only
by **+1.7 damage a game** (33.9 vs 32.2; starfall 5.7 vs 3.6). It is nowhere near enough to matter,
because the 250-play turn ends by hitting the per-turn action cap before she can cash the draws, and
she is at 0 Energy by then anyway.

**What the loop actually is, then: a playability bug, not a balance one.** 48 of 60 games in this cell
are turns that never end. A sim records an ordinary truncated result; a human sits there. That lowers
the priority relative to what this ticket first implied — and matches Henry's original instinct — while
raising how clearly it should be described: it is unambiguously broken *to play*, and worth nothing
either way *to balance*.

## 5. MEASURED: the deck arms Henry asked for (2026-08-22, `scratch/valkarms.ts`)

Five opponents spanning her recorded range, 60 games each, `glimmer` untouched in every arm.
(Making glimmer exhaust in §4 was a diagnostic stand-in to prove causation — never a proposed fix.)

| arm | deck | pool | huldra_v1 | gullin_v1 | draugr_v2 | kraken_v1 | skoll_v1 | mean | loop | undecided |
|---|---|---|---|---|---|---|---|---|---|---|
| BASE (shipped) | 8 | 5 | 0.0% | 0.0% | 8.3% | 88.3% | 86.7% | **36.7%** | streak 249 | **44** |
| **C0** ascension→supernova_v2 | 8 | 6 | — | — | 60.0% | 95.0% | 98.3% | **78.0%** | clean | 0 |
| A1 one falling_star→smite | 8 | 6 | 0.0% | 0.0% | 5.0% | 78.3% | 78.3% | 32.3% | clean | 0 |
| A2 both falling_star→smite | 8 | 7 | 0.0% | 0.0% | 0.0% | 73.3% | 73.3% | 29.3% | clean | 0 |
| A3 + ascension→supernova_v2 | 8 | 8 | 53.3% | 26.7% | 58.3% | 85.0% | 100.0% | 64.7% | clean | 0 |
| B1 +2 damage cards | 10 | 7 | 0.0% | 0.0% | 1.7% | 46.7% | 51.7% | 20.0% | clean | 0 |
| B2 +4 damage cards | 12 | 9 | 38.3% | 8.3% | 31.7% | 90.0% | 88.3% | 51.3% | clean | 0 |
| B3 +4, one slot draw | 12 | 9 | 0.0% | 0.0% | 3.3% | 38.3% | 30.0% | 14.3% | clean | 0 |

**Three findings, in order of how much they should change the plan.**

**1. Every arm kills the loop, and pool SIX is already enough.** The structural problem is one card
deep — remove any single exhaust card, or add any two cards, and the 249-play streak becomes 2 with
zero undecided games. Nothing here needs a rebuild.

**2. The win-rate spread is ONE CARD, not the pool and not the deck size.** B2 and B3 have identical
deck size and identical pool and differ by a single slot — `supernova_v2` against `lumen_surge` — and
that slot is worth **37 points** (51.3 vs 14.3). The control arm settles it: **C0 changes nothing but
`ascension` → `supernova_v2`, keeps both `falling_star`s, and reads 78.0% against BASE's 36.7%** —
higher than A3, which also drops the falling_stars. Every good arm is good because of that one card,
and the pool change rides along for free.

**3. Henry's bigger-deck hypothesis is falsified as stated.** B1 at 10 cards reads **20.0%** against
BASE's 36.7%, and B3 at 12 cards reads **14.3%** — the two worst arms in the set. Adding cards without
adding a real threat dilutes her badly: her engine is `starfall` scaling on cards drawn plus a tight
pile that cycles, and more cards means drawing the payoff less and cycling slower. Deck size fixes the
loop and costs her the deck.

**Why the exhaust axis cannot be tested cleanly, which is a design fact rather than a measurement
problem:** exhaust is what buys the extra power on the curve. `falling_star` is 1e for **40** power
*because* it exhausts; `smite` is 1e for **27** because it does not. So decrementing exhaust always
costs power (A1, A2) unless you overpay with a bigger card (A3, C0). There is no power-matched
non-exhaust replacement in the Light pool, and there is **no 2e non-exhaust Light attack anywhere near
the 65-power band** — `supernova_v2` at 108 (HP-scaled, Rare, currently only in `audhumbla_v1`) is the
only one that exists.

**So C0 is not a recommendation.** 78.0% would make her a top-of-roster deck, and `0-VALK-ENGINE`
already had her at 87-91% before the nerf arc brought her down. What C0 proves is that **the loop fix
is free if the 2e exhaust slot is the one that changes**, and that the replacement's power is the only
real dial. Landing her near her current level wants a 2e non-exhaust Light attack around the 65-power
band — which does not exist and would be a new or re-costed card. **That is Henry's call, and it is
the one decision this ticket actually needs.**

**Caveats before anything ships:** five opponents, not her full 30-cell row; one seed base; the 4-7
point gaps (BASE / A1 / A2) are inside the noise the three-tier doc quotes, while the 30-40 point
moves are not. A full field row and a second seed base are the gate.

## 6. THE ANSWER: re-cost `ascension` in place — Henry's knob, and it beats all seven of mine

*"can we just redesign the 2e exhaust card to not be so strong and remove exhaust?"* — the knob the
first sweep skipped, because every arm either kept `ascension` as printed or swapped it out entirely.

**Priced first** (`scratch/ascensionprice.ts`). The 2e band is 5.2 under / 6.5 over, and the scorer's
exhaust discount is only **×0.9** (`powerscale.ts:956`) — so dropping exhaust costs about 11% of
headroom, not a rebuild's worth:

| `ascension` variant | score | verdict |
|---|---|---|
| printed: 50 power, exhaust | 5.9 | in band |
| **50 power, NO exhaust** | **6.5** | **in band — exactly at the ceiling** |
| 45 power, no exhaust | 6.0 | in band |
| 40 power, no exhaust | 5.5 | in band |

**It does not even need the power reduction.** Measured, five opponents, 60 games each:

| arm | `valkyrie_v2` mean | loop | undecided | `valkyrie_v1` mean |
|---|---|---|---|---|
| BASE (as shipped) | 36.7% | streak 249 | **44** | 36.0% |
| **D0 — 50 power, exhaust removed** | **35.3%** | clean | **0** | **52.3%** |
| D1 — 45 power, exhaust removed | 32.0% | clean | 0 | 50.0% |
| D2 — 40 power, exhaust removed | 34.7% | clean | 0 | 45.0% |

**D0 is the fix.** Delete one field from one card and: the loop is gone (streak 249 → 2, 44 undecided
games → 0), `valkyrie_v2` moves −1.4 points which is inside noise, the card stays in band, and nothing
else changes — no new card, no deck-size change, no rebuild, her identity intact. It is a better answer
than any of the seven arms in §5, all of which either cost her power or diluted her.

**The catch, and it is `0-DECK-NOT-CARD` exactly: `ascension` is in BOTH valkyrie decks.** The same
change is worth roughly **+16 points to `valkyrie_v1`** on this sample (36.0 → 52.3; `draugr_v2`
16.7 → 65.0, `skoll_v1` 63.3 → 86.7). She sits at 46.3% field on the full grid and did not ask for a
buff. v1 never had the loop, so she gets the change as pure upside.

**The compensator exists, and it is v1-specific — which is the useful part.** The attack power dial
moves `valkyrie_v1` monotonically (50 → 40 costs her 7.3 points) and is **invisible to `valkyrie_v2`**
(35.3 / 32.0 / 34.7 — non-monotonic, i.e. all one reading). So power is a knob that can be spent
entirely on v1 without touching the deck the fix is for.

**But it probably cannot hold her all the way.** At 40 power v1 is still ~9 points up on this sample,
and holding her flat would need roughly 28 power — which scores 4.1 against a 5.2 floor, i.e. an
under-band card. So the honest options are: accept some v1 gain, spend the remaining compensation in
v1's own card list rather than on the shared card, or split `ascension` into deck-specific variants
(which this repo has avoided doing before).

**Caveats:** five opponents rather than either deck's full 30-cell row, one seed base. The 1.4-point v2
move is inside noise in both directions; the v1 moves (+16, and the 7.3 from the dial) are not. Full
rows for **both** valkyrie decks and a second seed base are the gate before this ships.

## 5. Gate

After ticket 111 ships: re-run `valkyrie_v2` vs `huldra_v1` and require **decisive 60/60** and no
same-card streak above 2 (`scratch/loopfreq.ts`); re-run her full field row and record the movement;
check the roster neutral-absolute count against the pre-fix number. `scratch/pool.mjs --verify` for
bit-identity on the rest of the 1v1 grid, since the reshuffle path is shared by every deck.


## 7. SHIP GATE, seed base A — full 30-cell rows for both decks

| deck | field before | field after | zero-cells | undecided | loop cells | FTK |
|---|---|---|---|---|---|---|
| `valkyrie_v2` | 49.6% | **47.9%** (−1.7) | 2 → 2 | **47 → 2** | 4 → 1 | 0 |
| `valkyrie_v1` | 47.7% | **64.9%** (+17.2) | 1 → **0** | 0 → 0 | 0 → 0 | 0 |

The BEFORE arm reproduces the committed grid (v1 47.7 vs 46.3, v2 49.6 vs 48.1), so the instrument
agrees with the artifact before anything is read off it.

**Two things this gate found that the five-opponent sweep could not.**

**1. The loop is MITIGATED, NOT CURED.** Four cells looped before — `huldra_v1` (streak 249, 45
undecided), `audhumbla_v2` (248, 2), `gullinbursti_v1` (23), `gullinbursti_v2` (16). After the change,
**one still does: `valkyrie_v2` vs `audhumbla_v2`, streak 248.** Removing `ascension` from the exhaust
package takes her circulating pool from 5 to 6, and **6 still fits inside a 9-card hand** — so in the
longest matchups her whole pool still ends up in hand. 45 of 47 undecided games are gone, which is 96%
of the harm, but the defect is still reachable. **Only a pool above the hand size is structurally safe,
which no legal 8-card list can reach — so ticket 111's engine fix is still required.** This change
buys playability, it does not close the hole.

**2. The `valkyrie_v1` buff is real and larger than the sample suggested: +17.2 on the full row**, with
her last zero-cell removed and **23 of 30 cells moving 5+ points** (`draugr_v2` +50.0, `ratatoskr_v2`
+38.3, `fenrir_v2` +32.9). She is still in the 35-80 first-pass band at 64.9%, but this is a wide
change to a deck that was healthy at 47.7% and was not the subject of the ticket — `0-DECK-NOT-CARD`
with a number on it.

**The decision this leaves:** accept v1 at ~65%, spend compensation in v1's own card list (the attack
power dial is a v1-only knob — 50 → 40 costs her 7.3 and is invisible to v2 — but Henry has ruled the
power stays at 50), or split `ascension` into deck-specific variants. **Henry's call.**

**Still to run:** the second seed base, per the ship-gate protocol.
