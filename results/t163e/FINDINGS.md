# Ticket 163e — the upgrade arm barely moves the run, and the patch shelf is priced above the purse

**Run 2026-09-24**, on 157's walker. Three points, 120 runs each (10 seeds × the twelve EA
starters), paired: the same seeds, the same graphs, the same offers, one spending policy apart.
Raw: `arms.txt` (the no-upgrade / upgrade pair at 50 scrap) and `price-25.txt`.

## 1. The upgrade arm: a 54% take-rate that changes almost nothing

"Upgrade the highest-149c card when scrap ≥ price" versus never:

| | control | upgrades | delta |
|---|---|---|---|
| deck power at fight 4 | 3.06 | 3.12 | **+0.06** |
| deck power at fight 8 | 4.26 | 4.28 | **+0.02** |
| mean fights survived | 3.44 | 3.61 | **+0.17** |
| deaths in biome 0 | 97 / 120 | 93 / 120 | **−4** |
| deck power at the gym | 4.80 (n=3) | 5.40 (n=3) | +0.60 |

**The policy is used** — 58 upgrades taken at 108 benches, a **54% take-rate**, 1,810 scrap spent
at a mean of 31 each. It is not that the walker declined to buy; it is that buying barely paid.

Every row above except the last is inside the noise of 120 runs. The last is n=3 and is not a
number. **An upgrade is +40% on one card in a deck of twelve to eighteen**, and the deck's mean
moves by about what that arithmetic predicts — which is the honest reading rather than a
disappointing one: 163's own §1 rule is that an upgrade never changes a card's SHAPE.

So the upgrade bench is working as designed and is a small effect at the sizes a run reaches. The
thing that would make it a large one is a run long enough to take five or six of them, and 157 says
100 of 120 runs end in biome 0.

## 2. The shop's patch price: 50 was above the purse, and 45 is the answer the CONDITION gives

| shelf price | upgrades competing | take-rate |
|---|---|---|
| 50 | no | 8 of 46 — **17%** |
| 50 | yes | 3 of 47 — **6%** |
| 25 | yes | 9 of 51 — **18%** |

Halving the price triples the take-rate, so the shelf is price-sensitive and 50 sat above what a run
can pay. But **the take-rate is not what should set the number**, and the sweep is the evidence for
that rather than against it: the binding constraint is the PURSE. Most runs die having banked one or
two fights' scrap, so pricing this shelf to hit a take-rate now is fitting a number to a brokenness
that lives somewhere else.

**The condition instead.** A patch is permanent, run-long, one slot per body and no replacing. That
puts it between the two things either side of it on the same shelves:

- an **upgrade** is permanent too, but it is ONE CARD — 25–40 by energy;
- a **blueprint** is a whole BODY and its five-card engine — 50.

`upgrade ceiling < patch < blueprint`, which in this economy's fives is **45**. At 50 a patch cost
the same as a body, which is the one thing it certainly is not. Shipped at 45; the slope says it
will read about 8%, and **re-measuring is the right move after 157's opening-fight ruling**, not
before it.

## 3. Five of the six patches are never taken

Across 360 runs: **amplifier ×145, splitter ×3, and nothing else at all.**

`bestPatchFor` leads the gate's choice-of-two and the elite's offer, and it picks Amplifier on
almost every EA firmware; the shop stocks Amplifier by ruling. So the six riders 163c wrote against
FIELDS are, in play, one rider. That is not a bug in `patchRegistry` — the 72-cell matrix says every
one of them is well-formed — it is what happens when one transform touches more fields than the
others on this particular roster.

**Reported, not fixed.** Which of these is true is a design question: the twelve EA firmware are
Amplifier-shaped; or `bestPatchFor`'s "touch count" is the wrong ranking; or the gate should offer a
spread rather than the best two. 163 §3's own argument was that a random patch is a no-op on most
bodies, which is why the offer is ranked at all — so the fix is not simply to randomise it.

## 4. "Sent to collection" confirms 157's number

1.2% in the upgrade arm and 1.4% in the control, of 408 and 370 picks — the same ~2% 157 measured
over a different 120 runs. The reward table offers an improvement essentially every time.

## 5. What this measurement is standing on

All three points were walked on the pre-28a gym comps, which does not touch any number above: no arm
reached a gym more than three times out of 120, and every finding here is about a bench or a shelf in
biomes 0–1. The upgrade arm's gym column (n=3) is the one row that would move, and it is already
flagged as not a number.

## 6. Decisions

1. **The patch shelf ships at 45** on the ordering condition. Re-measure after the opening-fight
   ruling; the sweep flag is built in (`--patch-price`) so it costs nothing to ask again.
2. **Five of six patches are dead in practice.** Henry's call whether that is a roster fact, a
   ranking bug, or an offer-shape question.
3. **The upgrade bench is a small, working effect.** Nothing to tune; it gets large when runs get
   long, which is 157's question and not this one's.
