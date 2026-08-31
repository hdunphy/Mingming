# The Tidewrack nerf arms — six measured arms on Henry's playtest party

**Date:** 2026-08-31 · **Branch:** `steam-release-prep` · **Status:** measured, no ruling taken
**Party under test:** `tidewrack_playtest_v1` = `ratatoskr_v2 + huldra_v1 + kraken_v2`, run-dealt 18-card start deck
**Cell:** `gauntlet:fight2` pinned to `gym_tidewrack`, `--iterations 30`, paired seeds across every arm

> Henry, 2026-08-31: *"Yes use that deck instead and try it as is then compare with the nerfs 2, 4, &
> fix thorn_tithe or give it someway to payoff... We still might be missing the mark with the nerfs,
> but try those"*

**Nothing in §§1–6 was committed.** Every knob lived in `src/debug/balance/experimentalTweaks.ts`,
named on the command line, printing a **NOT A BASELINE** banner into its own report.

> **§§1–6 ARE A HISTORICAL RECORD — read [§7](#7-ticket-74--the-comp-swap-measured-and-where-the-failure-moved) for what shipped.**
> Ticket 74 ruled on these arms 2026-08-31: the fix is a **comp swap** (`kraken_v1` → `kraken_v2`),
> `ink_stream` **stays at 33**, and `thorn_tithe`'s transfer is **committed**. The `boss-cantrips*`
> and `ink-power-*` knobs quoted below **no longer exist** — re-running a command line from §6 now
> throws rather than silently measuring the baseline. Every number in §§1–6 was taken against
> Tidewrack's **old** composition and none of them describes the shipped fight.

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

---

# 7. Ticket 74 — the comp swap measured, and where the failure moved

**Date:** 2026-08-31 · **Change under test:** `gym_tidewrack`'s trio, `kraken_v1` → **`kraken_v2`**
**n=60 per cell, all three gauntlet cells, toolbox arm, Bereavement Rally live, verdict on the
COMPOUND per 67 R5.** `ink_stream` stays at 33 (ruling 2). `thorn_tithe`'s transfer is committed.

## 7.1 The verdict

| arm | fight 1 | fight 2 | fight 3 (boss) | **compound** | vs 60±5 |
|---|---|---|---|---|---|
| **H** — `tidewrack_playtest_v1`, toolbox | 70.0% | 73.3% | **75.0%** | **38.5%** | FAIL, −21.5pt |
| **P** — favourable, toolbox *(the arm 60% grades)* | 61.7% | 66.7% | **68.3%** | **28.1%** | FAIL, −31.9pt |

**The swap did what it was ruled to do, and the gauntlet still fails.** Those are two separate
findings and they need to be read separately.

## 7.2 The boss fight is fixed

Against the same party, the boss fight goes **30.0% → 75.0%**. For the first time it is not the
worst fight in its own gauntlet — it is now the *best* of the three.

**The honest caveat on that pair of numbers:** they are not a paired comparison. Three things differ
— the composition, n (30 → 60), and the toolbox (absent → present). Only the first is the ruling.
The toolbox confound runs *against* the swap rather than flattering it: research/69 measured the
toolbox making Tidewrack **worse** (favourable 26.7% bare → 16.7% with it; control 50.0% → 43.3%),
so a toolbox-holding arm at 75.0% is if anything an understatement of what the composition bought.

**Corroboration that the mechanism is the one the ticket named:** fights now run **7.9–8.4 turns**
against the old comp's 5.8. The boss is killing far more slowly, which is what removing the second
draw engine predicts — and it is also ruling 1's *"TIDAL SURGE fires slower... part of the nerf, not
a bug"* showing up in the data rather than being asserted.

## 7.3 The failure moved, and this is the finding that matters

**Ticket 74 could only ever have fixed one fight in three.** `rollGauntletFight` consults
`authoredBossFor` **only for the boss slot** — fights 1 and 2 are rolled from the region species pool
at every gym. So their rates are untouched by the swap, and they are what the compound now fails on:

| | fight 1 | fight 2 | boss | needed |
|---|---|---|---|---|
| Tidewrack, handbuilt | 70.0% | 73.3% | 75.0% | ~84.3% each |
| Tidewrack, favourable | 61.7% | 66.7% | 68.3% | ~84.3% each |
| **Emberfall (calibrated, 67 R5)** | **83.3%** | **90.0%** | **80.0%** | 60.0% compound ✓ |

Tidewrack's lead-in fights sit **13–22 points under Emberfall's**, and nothing in ticket 74 touched
them. The old 30% boss was masking a gauntlet-wide shortfall: with the boss at 75% the compound is
still 38.5%, because three fights at ~72% multiply to 38%, not to 72%.

**This is the compound's arithmetic doing exactly what 67 R5 said it would**, and it is the reason
the ruling deserves to be read as a success on its own terms while the gate still says FAIL.

I have no ruling to offer on why Tidewrack's *rolled* fights are soft — that is a different
measurement (the region species pool and the tuned-OS ladder at a Water gym), not this one.

## 7.4 `thorn_tithe` — the reprice arm

Paired, n=60, same cell and options, against the committed 40-power card.

| printed power | won | rate | paired McNemar vs 40 |
|---|---|---|---|
| **40** (committed) | 45/60 | **75.0%** | — |
| **30** | 45/60 | **75.0%** | 3 discordant each way · **p = 1.00** |
| **25** | 42/60 | **70.0%** | 4 vs 1 · p = 0.375 |

**30 is free.** It costs nothing measurable and moves the card from *strictly above* `hamstring` on
both halves to something far closer to the curve: 1 energy, 30 power, 3 Weakened on the target,
against hamstring's 1 / 20 / 2. **25 costs about 5 points and does not reach significance at n=60.**

Recommendation, for Henry's number and not printed without it: **30**. It buys the curve discipline
the ticket wanted at zero cost to a fight that is already the healthiest of the three. 25 is
defensible if the card should visibly *pay* for the transfer; the arm cannot tell those apart.

## 7.5 What I need a ruling on

1. **Is ticket 74 done?** Its own goal is met — the boss fight is fixed and over-delivered. But the
   gauntlet it sits in still fails by 21.5pt (handbuilt) / 31.9pt (favourable). Closing 74 and
   opening a ticket on Tidewrack's *rolled* fights is my read; it is not my call.
2. **`thorn_tithe`'s number** — 30, 25, or leave it at 40. Nothing is printed until you say.
3. Both compound verdicts are flagged **UNDER-SAMPLED** (95% CI ±6.5pt and ±6.9pt against a ±5
   window). At 38.5% and 28.1% they miss by far more than the interval, so the FAIL is safe; the
   exact figures are not.

## 7.6 Reproducing

```
npx vite-node src/debug/balance/runRunGate.ts --bands gauntlet --gym gym_tidewrack \
  --handbuilt tidewrack_playtest_v1 --toolbox --iterations 60
npx vite-node src/debug/balance/runRunGate.ts --bands gauntlet --gym gym_tidewrack \
  --matchup favourable --toolbox --iterations 60
npx vite-node src/debug/balance/runRunGate.ts --bands gauntlet --cells gauntlet:fight2 \
  --gym gym_tidewrack --handbuilt tidewrack_playtest_v1 --toolbox --iterations 60 \
  --tweak thorn-power-<25|30>
```

Raw reports in `74-runs/`. **The `--tweak` knobs used in §§1–6 no longer exist** — ticket 74 retired
`boss-cantrips*` and `ink-power-*`, and `validateTweaks` now throws a message naming the ruling
rather than letting a stale command line measure the baseline and read as a null result.
