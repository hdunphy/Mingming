# Ticket 152 — does a brake on `undertow` stop the loop? No.

**Run 2026-09-23**, Henry's question: *"what happens with jorm if we add recoil damage or self
weaken to undertow"*. Six arms on `jormungandr_v1`, 1,200 games each, all 30 opponents, beamless.
`undertow` patched in a working copy and restored; `programs.json` verified byte-identical after.

## The table

| | shipped | recoil 5 | recoil 10 | recoil 15 | self-Weaken 1 | self-Weaken 2 |
|---|---|---|---|---|---|---|
| **field win %** | **69.6** | 66.8 | 59.5 | **50.7** | **48.2** | 26.2 |
| turns with ≥6 undertow casts | 12.7% | 11.9% | 8.3% | **4.8%** | 9.9% | 4.3% |
| max undertow in one turn | 18 | 18 | 16 | **14** | 14 | 8 |
| `ink_stream` max triggered draws | 19 | 19 | 17 | 15 | 15 | 9 |
| turns dealing ≥75% of a pool | 16.8% | 15.9% | 11.7% | **7.7%** | 9.9% | 2.9% |
| damage/turn p90 | 94.2% | 93.9% | 87.8% | 60.8% | 74.2% | 43.0% |
| **damage/turn max** | **145.0%** | 145.0% | 149.1% | **146.5%** | 118.6% | 100.0% |
| self-damage/turn p90 | 0% | 5.9% | 8.2% | 9.1% | — | — |
| **self-damage/turn max** | 0% | 18.9% | 32.5% | **40.4%** | — | — |

For comparison, the two levers that DO remove it: the wild-rung de-duplication (shipped) and either
§3 card swap both give **0.0%** of turns at ≥6 casts and a max of **2**.

## The answer

**No brake removes the loop.** At `recoil 15` — `forage`'s own number, the strongest arm that leaves
the card playable — jormungandr still loops six deep in one turn in twenty and fourteen deep at
worst, and **one turn in thirteen still removes three quarters of a health pool**. The one-turn kill
that opened this ticket survives every recoil arm: the worst turn is 145.0% of a pool shipped and
**146.5%** at recoil 15.

**He pays the cost gladly, and the numbers say how gladly.** At recoil 15 he spends up to **40.4% of
his own health pool in a single turn** to run the loop. That is the whole finding: a cost does not
deter a loop whose payoff scales with the loop. `ink_stream` reads cards drawn this turn and
`serpents_coil` reads cards played this turn, so every iteration pays for itself several times over
— there is no recoil small enough to be fair and large enough to stop it.

**This is why `forage` is different.** `forage` is "draw 1, take 15 power" and its brake works,
because its draw feeds nothing in particular. The brake is not doing the work in `forage`; the
absence of a payoff is.

## What the brake costs instead

It taxes the deck hard while leaving most of the problem:

- `recoil 15`: 69.6% → **50.7%** field, and still 7.7% of turns at ≥75% of a pool.
- `self-Weaken 2`: 69.6% → **26.2%**, below the 47–64% EA peer band, and still 4.3% of turns at ≥6
  casts.

`self-Weaken 1` is the most interesting of the six — 48.2% field, near the peer median — but it
still leaves 9.9% of turns looping six deep, which is most of the shipped rate.

## The collateral, which is the part a card change always has

`undertow` is a pool card. It is also in **kraken_v1**'s tuned deck and start kit (one copy, no
loop), and in **jormungandr_v1's player start kit** — so a brake taxes a card the PLAYER holds, on
a deck that was never doing anything wrong:

| kraken_v1 | field |
|---|---|
| shipped | **47.3%** |
| recoil 10 | 36.4% |
| recoil 15 | 33.9% |
| self-Weaken 1 | 41.4% |

Eleven to thirteen points off a deck that runs one copy and cannot loop it.

## A measurement bug this found in my own harness

The first cut of the table summed every cast's damage, so a recoil arm scored **its own recoil as
damage dealt** — `recoil 10` read a 177.4% worst turn against the shipped deck's 145.0%, i.e. the
brake appeared to make the card more dangerous. `scratch/t152_gates.ts` now splits self-facing casts
into their own column, which is also where the 40.4% figure above comes from.

## Nothing shipped

`programs.json` is byte-identical to what it was; the wild-rung rule from the previous commit is
untouched and remains the fix in place.
