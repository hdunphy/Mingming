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

## Not shipped

§3: *"If it lands outside ±5, report — do not tune."* The specified arm landed outside, so nothing
was committed. `hooks.json` is byte-identical to the 150a state.

**The decision is one word.** `bonus: 4` and the description reads *"+4 power per Poison stack on
the target"*; `bonus: 3` and the OS takes a deliberate 10-point nerf.

One thing that ships with whichever number is chosen, and is not a design decision: `powerscale`'s
firmware scorer (149c-7) prices a `bonus` hook as flat HP. Once TOXIN_FANG's bonus is power, that
conversion is wrong for it and has to read the trigger rather than assume the unit.
