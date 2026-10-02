# Ticket 150d — arm A is dead level with the shipped hook, and arm B is +27.9

**Run 2026-09-24.** `scratch/t149_castprobe.ts --width 1 --owner gullinbursti_v2 --iter 20`, all 30
opponents (15 species x 2 OS), 1,200 games per arm, beamless. Same harness and same seed derivation
as 150c, so the two rows are comparable to each other as well as to their own baseline.

## The measurement

| `gullin_v2_ram` | field | vs baseline | turns | procs/game |
|---|---|---|---|---|
| **shipped** (`onDamageCalculated`, `bonus: 2.5` flat HP) | **49.00%** | — | 6.4 | 22.3 |
| `onPowerCalculated`, `bonus: 1` — **arm A**, the equivalence arm | 49.25% | **+0.2** | 6.4 | 22.6 |
| `onPowerCalculated`, `bonus: 1.5` | 62.83% | +13.8 | 5.8 | 20.2 |
| `onPowerCalculated`, `bonus: 2` | 72.67% | +23.7 | 5.3 | 18.3 |
| **`onPowerCalculated`, `bonus: 2.5` — arm B, as printed (RULED, SHIPPED)** | **76.92%** | **+27.9** | 5.0 | 16.7 |

## Arm A lands on the number Section 2 predicted, which is worth saying out loud

Section 2's conversion table gives KINETIC_RAM's 2.5 flat HP as **"~1 power per stack (0.8 STAB'd,
1.1 not)"**. Arm A measures **+0.2 field points** against the shipped hook over 2,400 games. That is
equivalence to within the harness's own noise, and it is the cleanest confirmation the conversion
method has had.

It is worth saying because the same table got 150c **wrong** — not the table, the sentence under it,
which took the STAB'd end of the range where the field takes the un-STAB'd one. Here the two ends
(0.8 and 1.1) bracket 1 tightly enough that the choice does not matter, so the prediction held. The
lesson from 150c stands unchanged: **the table is a range and the field picks the point.**

## So arm B is a buff, and this is its size

Section 2 said as much in advance — *"KINETIC_RAM as printed (+2.5 power) is ~2.5x what it delivers
today... it is a buff, and it gets an arm, not an assumption."* The arm has now been fielded:
**+27.9 points, 49.0% to 76.9%.** Henry ruled arm B on 2026-09-24 on the description's authority
(*"Kinetic_ram should also be +2.5 power per stack, that's what the description says"*), and the
number is here so that the ruling is made against a measurement rather than an estimate.

**gullinbursti_v2 is now the top of the 1v1 field** where 136 round one left her at ~40. Nothing is
tuned in response: no numeric tuning before playtest (ruled 09-24), and she is post-EA anyway.

## The dial, and where it stops being one

1.0 -> 1.5 -> 2.0 -> 2.5 pays 13.8, then 9.8, then 4.3 field points. **The dial flattens at the
top**, and the reason is in the two columns beside it: games shorten (6.4 -> 5.0 turns) and the hook
therefore fires less (22.6 -> 16.7 procs a game). Past about +2 the OS is killing the opponent before
the extra power can be spent, so the last half-point buys a quarter of what the first one did.

That is a different shape from TOXIN_FANG, whose dial was *straight* at ~11 points per unit across
its whole range. Worth keeping: a saturating dial is a hint that the deck is winning on tempo rather
than on the hook, and a straight one is a hint that the hook is the deck.

## What the scorer says, before and after

`scoreOS('gullinbursti_v2')`, Section 1.4 of the balance report:

| | per proc | % of a pool a game | verdict |
|---|---|---|---|
| before (`onDamageCalculated`, priced as flat HP) | 0.20 | **15.6%** | IN BAND |
| after (`onPowerCalculated`, priced as power) | 0.75 | **58.5%** | **FLAGGED** |

Both readings are of the SAME hook paying 2.5 per stack; the move is what the scorer can see. 150c
taught the unit lesson on TOXIN_FANG and the scorer already reads the trigger, so this needed no
code — but it is the first firmware to cross the 50% flag since that band was set, and Section 1.4
will say so until somebody rules on it. The flag is a report, not a gate.

## One rounding note, since `2.5` is not an integer

`HookFactory` floors the modified value once, at the end of the hook. On an odd Sharp pile the half
point is dropped: 13 stacks pays +32 power, not +32.5. That is a third of a percent of a 30-power
attack and no dial reaches it, but it is the reason a hand-computed expectation will read half a
point high on half the procs.

## The instrument needed one line

`t149_castprobe.ts` wrapped four modifier phases and `onPowerCalculated` was not one of them, so a
moved hook would have measured as **zero procs** — a broken-hook reading on a working hook, which is
exactly the class of failure this ticket is about. Added, with the unit written next to it: the probe
`modDelta` for a power-side hook is POWER, and the HP column beside it is not comparable to it.
