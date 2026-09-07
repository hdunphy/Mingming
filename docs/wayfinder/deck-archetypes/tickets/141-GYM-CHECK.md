# Ticket 141 addendum — the gym check (Fire×2 + Nature must beat Nature×2 + Water)

**Why (Henry, 2026-09-05):** *"Fire doesn't pair with Nature because there is no synergy. We need
there to be some synergy, otherwise you can't beat the Nature gym, which will run Nature×2 + Water;
Fire×2 + Nature is the counter."*

**The gap, from the card data:** there are **no ally-target cards in the game** — every Nature buff
(Growth, Iron Bark, Shrug Off) is Self — so Nature can only touch a Fire body's engine through an
OS, and pre-141 no Nature OS reads a Fire body's actions. Fire makes Strength (fenrir_v1's OS,
fury_strike, battle_rhythm, all_in, overdrive); Nature makes Sharp and Weakened and converts
Weakened to Poison (hexbloom). The bridge exists in the numbers; it does not cross the body line.

**Where 141 already builds it:** the STATUS mutation fires `onStatusApplied` for every status
application, OS-applied included, with `source` = the OS owner (`effectHandlers.ts` ~L610). So
under 141f, huldra_v1's ALLURE reads fenrir_v1's OS (2 Strengthened per attack → **2 Weakened on a
random enemy per Fenrir attack**), skoll_v1's TREACHERY procs, and fenrir_v2's Sharp gains.
fenrir_v1 + skoll_v1 + huldra_v1 becomes an engine, and hexbloom cashes the pile as Poison.
That is a prediction, not a measurement — hence this check. Weakened is uncapped; it may be hot.

## The run (arm B, after the §4 screen)

`scratch/compgrid.mjs` has two new flags: `--panel a+b+c,d+e+f` scores the comps against those
opponents instead of the ticket-140 panel, and `--panel-iters 0` skips the panel round robin.

`scratch/gym-ffn.txt` (the counter candidates):
```
fenrir_v1+skoll_v1+huldra_v1
fenrir_v1+skoll_v1+ratatoskr_v2
fenrir_v2+skoll_v2+huldra_v1
fenrir_v2+skoll_v1+huldra_v1
```
Opponents — the Nature gym as round 2 says it would be built (the two best NNW comps, plus the zoo):
```
node scratch/compgrid.mjs --comps scratch/gym-ffn.txt \
  --panel kraken_v1+ratatoskr_v1+huldra_v1,kraken_v1+ratatoskr_v2+huldra_v2,ratatoskr_v1+huldra_v1+kraken_v1 \
  --rounds 2 --panel-iters 0 --lanes 4 --outdir results/gymcheck_armB
```
`--rounds 2` = 1 + 2 paired iterations = 6 battles a cell, 72 battles total (about 40 minutes on
4 lanes). Run the same command on the arm-A commit into `results/gymcheck_armA` for the baseline.

## Pass bar

The best FFN counter scores **≥ 55** against the three NNW opponents under arm B (arm A will be
well under 50 — those comps were 2/6 into the zoo in round 2). If arm B clears it, the gym counter
exists and no bridge card is needed for launch. If it does not, the next row is the bridge card
from ticket 140 §2, `chorus` (Nature, 1e, Skill: *"Draw a card. Every ally gains 1 Sharp."*) —
which needs a small engine row first, because programs have no ally-side target today
(`ALLIES` exists for hooks only). Do not build the card until the check says it is needed.

## Not a bug

fenrir_v1's missing-HP scaler and recoil want him low; Nature's heals and Regen push him up. That
anti-synergy is fine and should not be "fixed". (Pre-measurement I guessed fenrir_v2 would be the
Nature-facing Fenrir because Nature makes the Sharp his cinder_lance reads; the result below says
otherwise — fenrir_v1 + skoll_v1 is the Fire pair that works with Nature, and it works despite the
heal anti-synergy, because ratatoskr_v2's Dazed feed is worth more to him than the missing HP.)

## Result (Henry's run, arm B on HEAD, 2026-09-05)

Opponents: kraken_v1 + ratatoskr_v1 + huldra_v1, kraken_v1 + ratatoskr_v2 + huldra_v2,
kraken_v1 + ratatoskr_v1 + ratatoskr_v2 (the zoo from a first partial run is also on disk).
`--rounds 4`, so the schedule halved the four candidates and only the winner got the full 120.

| comp | score | battles | per opponent |
|---|---|---|---|
| **fenrir_v1 + skoll_v1 + ratatoskr_v2** | **75** | 120 | 75 / 80 / 70 (and 6/6 into the zoo) |
| fenrir_v1 + skoll_v1 + huldra_v1 | 61 | 18 | 50 / 83 / 50 |
| fenrir_v2 + skoll_v1 + huldra_v1 | 50 | 6 | coin-flip, too few games |
| fenrir_v2 + skoll_v2 + huldra_v1 | 40 | 10 | coin-flip, too few games |

Average 4.96 turns, 0 truncations, 0 first-turn kills. **Pass** (bar 55). The Fire + Nature engine
that won is ratatoskr_v2's Dazed feed cashed by Fire's big hits, not huldra_v1's Weakened mirror
(directionally a pass at 61, not settled). `chorus` stays on the shelf. fenrir_v2 + Nature is
unproven and probably not a thing: Burn → Sharp wants a second Burn body, which Nature does not
have, so his partner element is Fire or Water. The Nature-gym counter for the ticket-140 doc is
fenrir_v1 + skoll_v1 + ratatoskr_v2.

Caveat: the gym comps weakened (141a) as the counter strengthened, in the same run. The arm A vs
arm B screen on `top30.txt` is what separates the two effects and remains the ship test for the
package under ticket 141 §4.

---

## RESULT — arm B clears the bar, and not with the comp the ticket expected (2026-09-05)

Run: the four FFN candidates × the three NNW opponents, `--rounds 4 --panel-iters 0 --lanes 4`,
successive halving, beamless. 120 battles on the survivor. `results/gymcheck_armB/`.

| # | comp | score | battles |
|---|---|---|---|
| 1 | **fenrir_v1 + skoll_v1 + ratatoskr_v2** | **75.0** | 120 |
| 2 | fenrir_v1 + skoll_v1 + huldra_v1 | 61.1 | 18 |
| 3 | fenrir_v2 + skoll_v1 + huldra_v1 | 50.0 | 6 |
| 4 | fenrir_v2 + skoll_v2 + huldra_v1 | 40.0 | 10 |

**Pass bar was ≥ 55. The best counter measures 75.** It is not carried by one favourable matchup
either: 75% into `kraken_v1+ratatoskr_v1+huldra_v1` (the #3 comp in the game), 70% into
`kraken_v1+ratatoskr_v1+ratatoskr_v2`, 80% into `kraken_v1+ratatoskr_v2+huldra_v2`. Games run 4.5
turns, no truncations, no first-turn kills.

**So the gym counter exists and Fire×2 + Nature is it.** Per the pass bar above, no bridge card is
needed for launch on this account. (`chorus` shipped anyway in the ticket-140 commit, as a
draftable Nature card rather than as the answer to this problem — and the premise in the §gap
paragraph above, *"there are no ally-target cards in the game"*, is half wrong: a `Side` card may
be aimed at either side, which is how all three ticket-140 bridge cards work with no engine row.)

**The prediction was half right.** §Where-141-already-builds-it expected
fenrir_v1 + skoll_v1 + **huldra_v1** — the ALLURE mirror reading Fenrir's OS-applied Strength. That
comp does clear the bar at 61.1, but successive halving cut it at round 3, and the comp that
actually wins is the same Strength pair with **ratatoskr_v2** instead: INSTIGATOR Dazing off the
free cards, rather than Weakened being mirrored into hexbloom. Worth knowing before anyone tunes
huldra_v1 on the assumption she is the Fire-facing Nature body.

### Two caveats on this number
1. **No arm-A baseline was run.** The bar is absolute (≥ 55) and arm B clears it, so the check
   passes on its own terms — but how much of the 75 is ticket 141 rather than the roster as it
   already stood is unmeasured. Arm A is commit `bcb948d`; the same command into
   `results/gymcheck_armA` answers it.
2. `results/gymcheck_armB/results.jsonl` also holds **6 rows against
   `ratatoskr_v1+huldra_v1+kraken_v1`** from an aborted first run whose panel listed that comp and
   `kraken_v1+ratatoskr_v1+huldra_v1` — the same three firmwares in a different order, so two
   thirds of the panel weight sat on one team. `summary()` filters by the current panel, so those
   rows are excluded from every number above. They are left in place as history.

Also fixed in the same pass: that first run was launched without `--outdir`, which overwrote
`results/compgrid/ranked.txt` and `SUMMARY.md` — the 144-comp ordering ticket 141 §4 takes its top
30 from. `results.jsonl` is append-only and survived, so `node scratch/compgrid.mjs --summary`
regenerated both. **A side run always names its own `--outdir`.**
