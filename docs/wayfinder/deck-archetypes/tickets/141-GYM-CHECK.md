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
anti-synergy is fine and should not be "fixed": fenrir_v2 (Burn → Sharp, cinder_lance reads Sharp,
Nature makes Sharp) is the Nature-facing Fenrir; fenrir_v1 is the Water-facing one (60–70 in
FWW/FFW comps in round 2). Two Fenrirs with two partner elements is a feature.
