# Ticket 150c — +3 power fails its own gate; +4 passes, and §2's table already said so

**Run 2026-09-22.** `scratch/t149_castprobe.ts --width 1 --owner jormungandr_v2 --iter 20`, all 30
opponents, 1,200 games per arm, beamless. Baseline measured in the same harness rather than taken
from §3's "~62", which is ticket 143's 3v3 grid number and not comparable.

## The measurement

| `jorm_v2_toxin_fang` | field | vs baseline |
|---|---|---|
| **shipped** (`onDamageCalculated`, `bonus: 10` flat HP) | **53.2%** | — |
| §3's arm: `onPowerCalculated`, `bonus: 3` | 42.5% | **−10.7** |
| `bonus: 4` | **55.0%** | **+1.8** |
| `bonus: 5` | 66.6% | +13.4 |
| `bonus: 6` | 74.9% | +21.7 |

§3's gate is ±5. **+3 fails it by more than twice over.** +4 passes comfortably.

## Why +3 is short, and why §2 already contained the answer

§2's conversion table gives TOXIN_FANG's equivalent as *"**~3 power** (2.9 STAB'd, 3.9 not)"* and
then concludes *"TOXIN_FANG at +3 power per stack is the same OS it is today, just honest."* That
conclusion takes the **STAB'd** end of its own range.

TOXIN_FANG fires on every attack Jörmungandr makes, against the whole 30-opponent field. Most of
those attacks are not type-advantaged, so the un-STAB'd conversion — **3.9** — is the one that
describes what the OS actually does over a field run. Rounded, that is 4, and 4 is what the field
measures at +1.8.

The table had it right and the sentence under it picked the wrong end.

## The dial is sharp, which is worth knowing before anyone turns it

One point of `bonus` is worth roughly **eleven field points** on this deck: 42.5 → 55.0 → 66.6 →
74.9. There is no comfortable middle here — +3 is a serious nerf and +5 is a serious buff, and the
only value that leaves the OS where it is happens to be an integer.

That steepness is itself an argument for the change: at `bonus: 10` flat HP the same sharpness
exists but sits **after** the pace divisor, the attack/defense ratio and type effectiveness, where
none of the game's dials can reach it. On the power side, every one of them can.

## Ruled and shipped: `bonus: 4`

§3 says *"If it lands outside ±5, report — do not tune"*, so the +3 arm was reported rather than
committed and Henry ruled on the table above: **4**. Re-measured on the shipped file: **55.0%**
against the 53.2% baseline, +1.8.

The description reads *"his attacks deal +4 power per Poison stack on the target"*, and
`descriptionData.test` passes against it with no allowlist entry — the printed number and the data
are the same number now, which they were not when the text said "+10 damage" and the hook added
flat HP after the divisor.

### The unit fix that shipped with it

`powerscale`'s firmware scorer (149c-7) priced every `bonus` hook as flat HP, converting it back
through the scorer's own HP table. An `onPowerCalculated` bonus is already power, and running it
through that table divides it by the frame a second time — a 4x error on the one hook this row
just moved. It reads the trigger now.

§1.4 has TOXIN_FANG_OS at **22.8%** of a pool a game, up from the 15.2% the HP conversion gave it,
and still in band. The census's 40% is the owning deck at 9.4 Poison stacks against the
roster-general 3 — 149c-6's ceiling column again, not a disagreement.
