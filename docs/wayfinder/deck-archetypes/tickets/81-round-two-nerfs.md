# Round two of nerfs (ticket 81): hel's healing bonus, hraesvelgr_v2, ymir_v1, valkyrie_v2

- Type: wayfinder:task - Henry-directed, 2026-08-18.
- Status: **closed** (2026-08-18)

## Shipped - every change is an OS change, no card or deck list touched

| deck | before | after | change |
|---|---|---|---|
| `hel_v2` | 71.0% | **55.9%** | healing bonus +50% **removed** |
| `hraesvelgr_v2` | 75.2% | **64.7%** | UPDRAFT_KERNEL waits for the **2nd** deck cycle |
| `ymir_v1` | 77.1% | **69.6%** | GLACIER_HEART gives **4** Bark Shield a turn, not 5 |
| `valkyrie_v2` | 70.3% | **63.8%** | REBIRTH_CYCLE hits and heals for **12**, not 15 |

Report: [research/round-two-nerfs.md](../research/round-two-nerfs.md).

## Hel's healing bonus

Henry: *"does Hel have a bonus to healing? If she does it should definitely be nerfed. Otherwise
the HP as costs doesn't work."* She did - UNDERWORLD_GATEWAY's third clause. **It is what stopped
HP-as-a-cost working**: a heal that out-earns the blood price turns the cost into a loan, which is
exactly why ticket 80 found that REMOVING her turn cap made her stronger. Removed entirely;
`dawns_respite` now costs 12 HP and heals 12, net zero. Softer option measured 58.3% (1.25).

**Henry's note for next time, recorded in METHOD.md:** the heals should all be RIDERS so a heal
card is never a blank, and *"that change might allow us to lift the cap."* Two of her three heals
(`dawnstrike`, `leech_strike`) are already riders; `pale_mercy` is the pure heal. The cap machinery
is still in place for that experiment.

## The three diagnostics

**All three are OS-driven, far more than the previous group (+7 to +21):**

| deck | live | OS off | worth |
|---|---|---|---|
| `hraesvelgr_v2` | 74.6% | **10.2%** | **+64.4** - largest measured anywhere |
| `ymir_v1` | 77.8% | 22.1% | +55.7 |
| `valkyrie_v2` | 70.5% | 36.0% | +34.5 |

- **`hraesvelgr_v2`**: +1 max Energy on the first cycle, and `thermal_lance` scales on Energy spent
  **SQUARED**, so the third point is worth 2.25x not 1.5x. An 8-card deck with four draw cards
  cycled by ~turn 2. Now waits for the second cycle - "trigger less", unchanged in kind.
- **`ymir_v1`**: the OS feeds the uncapped scaler. **She holds a mean 9.9 Bark Shield when casting
  `avalanche`, against 5.1 with the OS off** - the free 5 a turn roughly doubles the pile, which
  doubles the payoff (median 30% of a health bar, **max 81%**, vs 13%/56% without). 5 -> 4 is the
  gentlest engine cut; 3 overshot to 54.8%.
- **`valkyrie_v2`**: unusually, her payoff cards barely move with the OS off (`starfall` 14% ->
  13%). The OS is not enabling anything - it is **free damage plus free sustain every turn** on a
  thin deck that reshuffles constantly.

## Gates

Roster: absolute 0% cells **71 -> 64**, 100% cells **70 -> 63**, NEUTRAL absolutes **26/26 ->
21/20**, band violations **369 -> 357**, FTK unchanged at 2. Redlines **55 -> 53** - `os:hel` and
`os:hraesvelgr` both cleared. 8-DIFF 7 of 67 rows, all in the four affected species. 843/843 tests.

**The top of the ladder is flat**: six decks between 64.7% and 70.3%, where two tickets ago the
leader was 81.4%.

## Next

1. **`fenrir_v1` at 24.9%, 12 zero cells, 22/31 out of band** - now by far the worst deck and the
   biggest remaining source of blowout cells. Never had a pass. **The roster's problems are now at
   the bottom, not the top.**
2. **`audhumbla_v1` rose to 70.1%** untouched, purely from everything around it being cut.
3. **`avalanche`'s uncapped rate survives** - 81% of a health bar from one card is still the largest
   single hit measured.
4. **`ymir_v1` still has 5 cells at 100% and 15 out of band**, the most of any top-six deck. Her
   field number is fine; her spread is not.
