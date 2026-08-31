# The Tidewrack nerf arms — six measured arms on Henry's playtest party

**Date:** 2026-08-31 · **Branch:** `steam-release-prep` · **Status:** measured, no ruling taken
**Party under test:** `tidewrack_playtest_v1` = `ratatoskr_v2 + huldra_v1 + kraken_v2`, run-dealt 18-card start deck
**Cell:** `gauntlet:fight2` pinned to `gym_tidewrack`, `--iterations 30`, paired seeds across every arm

> Henry, 2026-08-31: *"Yes use that deck instead and try it as is then compare with the nerfs 2, 4, &
> fix thorn_tithe or give it someway to payoff... We still might be missing the mark with the nerfs,
> but try those"*

**Nothing here is committed.** Every knob lives in `src/debug/balance/experimentalTweaks.ts`, is
named on the command line, and prints a **NOT A BASELINE** banner into its own report.
`programs.json` is untouched and stays that way until Henry rules.

---

## 1. The headline

| arm | knob | won | rate | vs baseline | paired McNemar |
|---|---|---|---|---|---|
| **A** | *(none — the party as Henry played it)* | 9/30 | **30.0%** | — | — |
| **B** | `boss-cantrips` — every `undertow` out of the enemy pile (**3 copies**) | 28/30 | **93.3%** | **+63.3pt** | **p = 0.0000038** |
| **C** | `ink-power-12` — `ink_stream` 33 → 12 printed power | 13/30 | **43.3%** | +13.3pt | p = 0.22 |
| **D** | `thorn-target` — `thorn_tithe`'s 3 Weakened `SELF` → `TARGET` | 8/30 | **26.7%** | −3.3pt | p = 1.00 |
| **E** | `boss-cantrips-2` — the first **2** copies only (jormungandr's) | 19/30 | **63.3%** | +33.3pt | p = 0.0063 |
| **F** | `boss-cantrips-1` — one copy only | 18/30 | **60.0%** | +30.0pt | p = 0.049 |

Reference line: the 60% gate grades the **gauntlet compound**, so one fight wants roughly
0.60^(1/3) ≈ **84.3%**.

**One knob moved this fight and it is not either of the two we have been turning.** Cutting the
boss's draw cantrips is worth twenty times what cutting `ink_stream`'s printed power is worth, and
the `thorn_tithe` fix is invisible at this sample size.

### The dose curve, which is the thing to look at

| cantrips removed | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| win rate | 30.0% | 60.0% | 63.3% | **93.3%** |

**It is a step, not a slope.** One copy buys 30 points. The second buys **nothing** — F vs E is 8
discordant against 9, p = 1.00, which is a coin flip. The third buys another **30** (E vs B: 1 vs 10
discordant, p = 0.012).

I do not have a verified mechanism for that shape and I am not going to invent one. The honest
statement is: *the first and third copies each move this fight ~30 points and the second does not,
and nobody should rule on a step function measured at n=30.* If the dose is the decision, this wants
n=60 at doses 2 and 3 before it is evidence.

**No dose lands in band.** 2 copies undershoots 84.3% by 21 points; 3 copies overshoots by 9. The
knob as built is coarser than the target window, so the landing point is probably a *different* cut
(one body's copies plus something else), not a count of `undertow`.

---

## 2. Arm B, and why the number is that large

`boss-cantrips` was written as *"cut the boss's draw cantrips"*. Measured against the actual pile, it
removed **three** copies, not two:

```
jormungandr(jormungandr_v1) + kraken(kraken_v1) + skoll(skoll_v2)   — 26-card pile
undertow x3   ink_stream x4   serpents_coil x2   whirlpool_v2 x2   pressure_point x2
surge_protection x2   fury_strike x2   blind_spot, corrosive_leak, strength_burst,
all_in, desperate_strike, reckless_charge, overdrive, glass_cannon, water_slap
```

`jormungandr_v1` runs `undertow` ×2; `kraken_v1` runs one more. So arm B is a **bigger** cut than
Henry's nerf 2 — which is why arms E and F exist.

**Why three cantrips are worth 63 points.** Since the 2026-08-30 scoping ruling,
`CARDS_DRAWN_TRIGGERED` reads `source.nonNaturalDrawsThisTurn` — the *casting Mingming's* triggered
draws, not the side's. Traced through this pile:

- **jormungandr** holds `ink_stream` ×2 and, after the cut, has exactly **one** remaining trigger of
  its own: the `jormungandr_v1` OS loop (*"each turn, the 5th Water card you play draws 1"*), capped
  at one proc per turn. Its cantrips were the multiplier. Without them `ink_stream` is 33 power on a
  1× — and on a turn the loop does not proc, **33 × 0 = zero damage**.
- **kraken** holds the other `ink_stream` ×2 and keeps `whirlpool_v2` ×2 and `pressure_point` ×2, so
  it loses one of five triggers.

So this is not a 30% shave on a payoff. It is *four cards in the boss's pile becoming near-dead on
jormungandr's half*, plus three fewer cards of flow. That is the asymmetry the earlier arms were
missing — and it is asymmetric in the right direction only because **this party runs no
`ink_stream`** (confirmed: 0 copies in the dealt 18).

**The pairing caveat, stated plainly.** Every other arm holds the enemy's cards fixed. Removing
cards from the pile necessarily perturbs the enemy's draw ORDER downstream as well, so a
cantrip arm is "same seed, same bodies, same node, same Drivers, different pile" rather than a clean
one-variable pair. It does not threaten a 0-vs-19 discordant split — but it is why individual
same-index fights can flip in the *unexpected* direction.

**93.3% overshoots.** Against the ~84.3% per-fight guide this is roughly 9 points too generous,
which is the whole reason for the dose bracket below.

---

## 3. Arm C — `ink_stream` power, finally measured one-sided

33 → 12 is a 64% cut, matched to the magnitude of the earlier symmetric test. Against this party it
is genuinely one-sided for the first time.

**+13.3 points, p = 0.22.** Not significant at n=30, and it does not reach 84.3% from anywhere near
here. This closes the question the last two sessions kept reopening: the earlier 3.4-point result was
*not* mostly an artifact of the nerf hitting the player's deck too. Even cleanly asymmetric, printed
power is a weak lever on this fight — because the boss's total damage is bounded by the player's HP
pool, so cutting power buys **turns**, and both sides spend turns at nearly the same rate.

The multiplier is the lever. The power is not.

---

## 4. Arm D — the `thorn_tithe` fix is not measurable here, and that is a sample-size fact

**−3.3 points, p = 1.00, three discordant each way.** That is a coin flip, not a finding.

It is **not** vacuous — the tweak is live and reaches the deck: the dealt 18 carries `thorn_tithe` ×1
and `hexbloom` ×1. But one card in eighteen, drawn maybe twice in a 5.8-turn fight, cannot move a
30% win rate detectably at n=30. Arm D says *"undetectable at this power"*, and nothing more.

**What the card looks like on paper, for the ruling rather than the measurement:**

| | energy | power | status |
|---|---|---|---|
| curve (`50×E − 10`) | 1 | 40 | — |
| `thorn_tithe` **as printed** | 1 | 40 | 3 Weakened on **SELF** |
| `hamstring` (the precedent) | 1 | 20 | 2 Weakened on **TARGET** |
| `thorn_tithe` **under `thorn-target`** | 1 | 40 | 3 Weakened on **TARGET** |

As printed it is exactly on-curve **and then charges a 3-stack self-debuff with no compensation** —
and `huldra_v1` runs `thorn_tithe` ×2 alongside `hexbloom`, which reads *"2 Poison per stack of
Weakened **on the target**"*. The kit's own combo cannot fire. This reads as a printing error rather
than a balance choice.

Henry's *"3 weakness for 10 power feels bad"* is the right instinct on the wrong number: **it is 40
power**, and it is on-curve *before* the drawback.

The tweak deliberately moves **one** variable — the transfer — and leaves 40 power alone, which puts
it strictly above `hamstring` on both halves. If a ruling lands on the transfer, the follow-up knob
is repricing power toward 25–30, **not** reverting the transfer.

---

## 5. What I need a ruling on

1. **Nerf 2 is the lever, and the dose is a design choice I can't make from this data.** Three
   copies overshoots (93.3%), two undershoots (63.3%), and the gap between them is a 30-point step
   with nothing in it. Which cut — jormungandr's copies, kraken's copy, `undertow`'s printing, or the
   `jormungandr_v1` OS loop — is yours. Say the word and I'll take doses 2 and 3 to n=60 first, since
   a step function at n=30 is not something to reprice a boss on.
2. **Should `ink_stream`'s power move at all?** Arm C says it buys little on its own. It may still be
   worth something *alongside* a cantrip cut, but that is another arm, not an inference.
3. **`thorn_tithe`.** The measurement can't decide this one; the printing table in §4 can. If the
   transfer is right, say so and I'll take the power reprice as a second arm.

## 6. Reproducing

```
npx vite-node src/debug/balance/runRunGate.ts \
  --bands gauntlet --cells gauntlet:fight2 --gym gym_tidewrack \
  --handbuilt tidewrack_playtest_v1 --iterations 30 \
  --tweak <boss-cantrips|boss-cantrips-N|ink-power-N|thorn-target>
```

Raw reports in `73-runs/`. Knobs and their rationale in
`src/debug/balance/experimentalTweaks.ts`; threading guarded by `optionsThreading.test.ts`.
