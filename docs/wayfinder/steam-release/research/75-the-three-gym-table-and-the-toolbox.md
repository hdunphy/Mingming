# The three-gym table, measured properly — and the counter-cards are a net negative at every gym

**Date:** 2026-08-31 · **Ticket:** [75](../tickets/75-tidewrack-rolled-fights.md) · six arms, **1,080 battles**
**Conditions, identical across all six:** `--bands gauntlet --matchup favourable --iterations 60`, all
three gauntlet cells, Bereavement Rally live, current tree (`ea26590`), paired seeds. The only
variable between the two arms at each gym is `--toolbox`.

This is ticket 75's step 1: *"re-measure Emberfall and Rootfall at matched conditions before anything
is ruled."* It was supposed to settle whether Tidewrack was behind the other gyms. It did — by
demolishing the question.

---

## 1. The headline

| gym | fight 1 | fight 2 | boss | **clears all three** | verdict |
|---|---|---|---|---|---|
| **Emberfall**, no toolbox | 90.0% | 80.0% | 86.7% | **62.4%** | **PASS** (+2.4pt) |
| Emberfall, toolbox | 88.3% | 76.7% | 65.0% | 44.0% | FAIL −16.0pt |
| **Tidewrack**, no toolbox | 71.7% | 81.7% | 68.3% | **40.0%** | FAIL −20.0pt |
| Tidewrack, toolbox | 60.0% | 71.7% | 65.0% | 28.0% | FAIL −32.0pt |
| **Rootfall**, no toolbox | 73.3% | 66.7% | 56.7% | **27.7%** | FAIL −32.3pt |
| Rootfall, toolbox | 48.3% | 55.0% | 41.7% | 11.1% | FAIL −48.9pt |

Two findings, and they are independent of each other:

1. **The toolbox costs the player 11.5 points of win rate at every gym.** It is not a wash and it is
   not gym-specific. 540 paired battles, **p = 0.0000017**.
2. **With the toolbox removed, Emberfall passes and the other two still fail** — Tidewrack by 20
   points, Rootfall by 32. **Rootfall is the worst gym, not Tidewrack.**

---

## 2. The counter-cards make the player worse, everywhere

Same seeds, same parties, same bosses. The only difference is whether the party carries the gym's
three ruled counter answers.

| gym | pooled per-fight, toolbox | pooled, bare | paired McNemar |
|---|---|---|---|
| Emberfall | 76.7% | 85.6% | 14 vs 30 discordant · **p = 0.023** |
| Tidewrack | 65.6% | 73.9% | 20 vs 35 · p = 0.058 |
| Rootfall | 48.3% | 65.6% | 18 vs 49 · **p = 0.00019** |
| **all three pooled (540 battles)** | **63.5%** | **75.0%** | 52 vs 114 · **p = 0.0000017** |

**This is the cards ticket 69 shipped to make these fights winnable.** Ticket 69's own report saw the
shape of it (*"the toolbox is built, and it makes Tidewrack WORSE"*, 26.7% → 16.7% at n=30) and it
was read as a Tidewrack curiosity. At n=60 across three gyms it is not a curiosity: **the toolbox is
a net negative at every gym measured, and the effect is larger than anything ticket 74 changed.**

**Where the damage lands differs by gym, and I cannot explain that.** At Emberfall it is almost
entirely the boss fight (65.0% vs 86.7%, p = 0.0072) with the rolled fights untouched. At Rootfall it
is spread across all three (−25, −11.7, −15). At Tidewrack the boss barely moves (p = 0.84) and the
rolled fights carry it. I have no verified mechanism for that pattern and I am not going to invent
one; the dilution story explains "it hurts" but not "it hurts here rather than there."

The likely direction is deck dilution — three cards added to an 18-card deck in a 5-turn fight is
17% of every draw spent on situational answers — but that predicts a uniform cost, and this is not
uniform.

---

## 3. The three-gym table, corrected

Reading the honest (bare) rows only:

| gym | favourable party the arm brings | compound | against 60 ± 5 |
|---|---|---|---|
| Emberfall | water-leaning (`kraken_v1, jormungandr_v1, fenrir_v1`) | **62.4%** | PASS |
| Tidewrack | nature-leaning (`ratatoskr_v1, huldra_v1, kraken_v1`) | **40.0%** | FAIL −20.0pt |
| Rootfall | fire-leaning (`fenrir_v1, skoll_v1, ratatoskr_v1`) | **27.7%** | FAIL −32.3pt |

**Emberfall's calibration holds.** 62.4% against a 60% target, on the current tree, at n=60, with the
toolbox off — the same conditions ticket 68 measured it under. Its 60.0% was real and it survived
every change since.

---

## 4. What this kills

**The "nature is weak" hypothesis is dead.** Ticket 75 opened on the observation that the
nature-leaning party underperforms the water-leaning one against an identical enemy pool. That is
still true — but the *fire*-leaning party at Rootfall does worse than both, so the ordering is
water ≫ nature > fire rather than "nature is the problem". Whatever this is, it is not a single
element being soft.

**Tidewrack-as-the-outlier is dead too.** It has been the outlier in every report since ticket 72.
Measured properly against its peers it is the **middle** gym, and it is Rootfall that is 32 points
under with nobody having noticed — because Rootfall's last number (67 R5: *"~7.6pt under"*) was
taken without the toolbox, at different n, before the firmware-pairing fix, before the draw-scoping
fix, and before the biome walk order was inverted.

**That is the real lesson of this run, and it is a process one.** Five separate systemic changes
landed between ticket 72's three-gym table and today, and every gym number quoted in between was
carried forward across them. The 37-point Tidewrack outlier that drove tickets 71, 73 and 74 was
measured before three of those changes. **A gym number is only worth what its measurement conditions
are worth**, and this document is the first time all three have been taken the same way on the same
tree on the same day.

---

## 5. What I need a ruling on

1. **The toolbox.** It is a net negative at every gym, significantly so at two. Options, none costed:
   pull the cards from the neutral pool; reprice them; keep them and accept the arm is measuring an
   unlucky purchase; or stop putting them in the graded arm and treat them as an optional buy. Ticket
   69 designed them and ticket 74 asked for them "purchasable" — this contradicts both, so it is
   yours to rule rather than mine to quietly drop.
2. **Which arm grades a gym?** Every gym number in the project's history is a toolbox-off number.
   Today's toolbox-on numbers are the ones I have been reporting for two days. Pick one and the table
   is comparable forever; leave both and it happens again.
3. **Rootfall.** 27.7% bare, 32 points under, never authored against. It is now the worst fight in the
   game and it has no ticket. Tidewrack got three.

## 6. Reproducing

```
npx vite-node src/debug/balance/runRunGate.ts --bands gauntlet \
  --gym <gym_emberfall|gym_tidewrack|gym_rootfall> --matchup favourable --iterations 60 [--toolbox]
```

Raw reports in `75-runs/`. Six files, named `<gym>-favourable-{toolbox,BARE}-n60.txt`.

**One arm was re-run rather than reused.** Tidewrack's toolbox arm had already been measured during
ticket 74 (28.1%), before `thorn_tithe` was repriced 40 → 30. It was re-run here (28.0%) so the whole
table sits on one build. The two agreeing to 0.1pt is also the cleanest available confirmation that
the reprice was neutral, which is what its own paired arm said (p = 1.00).
