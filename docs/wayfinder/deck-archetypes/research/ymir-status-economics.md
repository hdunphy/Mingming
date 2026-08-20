# Ymir's build turn: the arithmetic was already fine, the feedback was invisible

- Type: wayfinder:implementation. **Ticket 106.** Branch `archetype-web`.
- **862 tests green**, `tsc` clean, build clean.

---

## 0. The short version

You said: *"Sometimes I want to build statuses, but the 2e cards do too much dmg compared to the 1e
so it feels like I can't make the fun choice... Early build str + weaken enemy and then slam in the
last few turns. This time it didn't feel as fun."*

The ticket's premise was that the build line loses on EV. **I measured it, and it doesn't — it was
already winning.** Building one turn and then slamming beats slamming every turn from **turn three
onward**, at the numbers you were playing.

What's actually broken is that you can't *see* it. `bracing_cold` grants 3 Strengthened. Three
stacks on a 65-power `glacial_maul` is **+1 damage**. You spent your entire turn — the only card you
get — to make your next nuke hit for 22 instead of 21. The plan was correct and the feedback was a
rounding error.

Fixed by making the pile big enough to watch: **`bracing_cold` is now 2 Energy, 15 power, 9
Strengthened** (was 1 Energy, 15 power, 3 Strengthened).

---

## 1. The EV table the ticket asked for

`scratch/ymirline.ts` plays scripted lines against a target with enough HP to survive six turns and
reports cumulative damage. One card a turn, because that's what GLACIAL_PACE allows.

**Before:**

| line | T1 | T2 | T3 | T4 | T5 | T6 | vs NUKE | crossover |
|---|---|---|---|---|---|---|---|---|
| NUKE (maul, maul, then spears) | 21 | 42 | 48 | 54 | 60 | 66 | — | — |
| BUILD1 (one build, then slam) | 5 | 27 | 49 | 56 | 63 | 70 | **+6.1%** | **T3** |
| BUILD2 (two builds, then slam) | 5 | 10 | 32 | 54 | 62 | 70 | +6.1% | T4 |
| DEBUFF2 (two gales, then slam) | 6 | 12 | 34 | 56 | 63 | 70 | +6.1% | T4 |
| HENRY (build str + daze + thaw, then slam) | 5 | 12 | 15 | 38 | 61 | 71 | +7.6% | T5 |

**Every build line was already ahead at turn 6.** The ticket's gate — *"within ~10% EV of the
nuke-every-turn line by turn 6"* — passed before I touched anything.

Two things the table shows that a win rate cannot:

- **The crossover turn is what matters, not the turn-6 total.** ymir_v2's games run **5.57 turns** on
  the live grid. A line that only pays on turn 6 doesn't pay.
- **Three build turns is arithmetically unsupportable and should be.** Your line spends turns 1–3
  building while the nuke line banks 48 damage. Filling a 33-damage hole in two slams would need
  each slam to roughly double — about sixty stacks. Spending half a six-turn game not attacking
  shouldn't win, and no amount of tuning should make it.

**One build turn is the plan the deck can actually support**, and that plan was already correct.

---

## 2. Why raising stacks alone doesn't move the crossover

I swept the stack counts first, since that's the ticket's named lever:

| bracing_cold stacks | BUILD1 turn-6 | BUILD2 crossover | HENRY crossover |
|---|---|---|---|
| 3 (live) | +6.1% | T4 | T5 |
| 6 | +7.5% | T4 | T5 |
| 9 | +17.9% | T4 | T5 |
| 12 | +27.9% | T4 | **T4** |

**The crossover barely moves.** More stacks make the late turns bigger; they don't fill the hole the
build turn digs on turn one. The crossover is set by the *cost* of building (5 damage instead of
21), not by the size of the payoff.

I swept the build card's own power too, and that *does* move the crossover — but it needs
`bracing_cold` at 45 power to pull BUILD2 to T3, and a 45-power build card next to a 65-power nuke
isn't a choice any more, it's just a better nuke.

So neither lever fixes the crossover at a sane value, and **the crossover didn't need fixing** — one
build turn already crosses at T3. What needed fixing was the visibility, which is a stacks problem.

---

## 3. The obstacle: zero budget headroom

Every one of his status cards is already priced to the top of its band:

| card | printed | score | 1e band | headroom |
|---|---|---|---|---|
| `bracing_cold` | 15 power + 3 Str | **2.9** | 2.4–3.0 | 0.1 |
| `numbing_gale` | 20 power + 2 Dazed | **3.0** | 2.4–3.0 | **0.0** |
| `ice_spear` | 22 power + 1 Weakened | 2.6 | 2.4–3.0 | 0.4 |
| `thaw` | 8 power + 3 Str + 3 Sharp | **3.1** | 2.4–3.0 | **already over** |

One extra Strengthened on `bracing_cold` puts it at 3.3, over budget. The ticket's lever cannot be
pulled at 1 Energy at all.

**The cost is what buys the room.** GLACIAL_PACE lets him play one card a turn on a two-Energy
frame, so **Energy is not a real constraint for this deck** — moving a card from 1e to 2e costs him
nothing he was using, and it opens the band from 2.4–3.0 to 5.2–6.5.

And `bracing_cold` is the only card in his deck no other deck runs:

| card | also run by |
|---|---|
| **`bracing_cold`** | **nobody — ymir_v2 only** |
| `numbing_gale` | draugr_v2 |
| `thaw` | ymir_v1 |
| `ice_spear` | ymir_v1, draugr_v1, draugr_v2 |
| `glacial_slam` | draugr_v2 |

So it is the only one that can move without collateral, and it's the one carrying the plan.

---

## 4. What shipped

**`bracing_cold`: 1 Energy, 15 power, 3 Strengthened → 2 Energy, 15 power, 9 Strengthened.**
Scores 5.6 against a 5.2–6.5 band — in band, where the old card was pinned against its ceiling.

I deliberately did **not** raise its power. The turn-one hole is the *cost of the decision*, and
filling it in would remove the choice rather than make it worth taking. Building still costs you a
nuke. It just pays you something you can see now.

**After:**

| line | T1 | T2 | T3 | T4 | T5 | T6 | vs NUKE | crossover |
|---|---|---|---|---|---|---|---|---|
| NUKE | 21 | 42 | 48 | 54 | 60 | 66 | — | — |
| BUILD1 | 5 | 28 | 51 | 61 | 71 | 79 | **+19.7%** | T3 |
| BUILD2 | 5 | 12 | 39 | 66 | 78 | 90 | +36.4% | T4 |
| HENRY | 5 | 13 | 19 | 45 | 71 | 82 | +24.2% | T5 |

The nicest part isn't the maul. Nine Strengthened turns a 65-power nuke from 21 damage into 24 —
noticeable but not dramatic. What it does to his **cheap** cards is the real change: `ice_spear`
goes 22 power → 31, `numbing_gale` 20 → 29. **Building makes his whole hand good, not just the
slam** — so "build early, slam late" stops meaning "wait for the nuke" and starts meaning "everything
I draw from here hits harder."

I did not touch GLACIAL_PACE, the 2e nukes, or any card another deck runs, exactly as the ticket
specified.

---

## 5. The cost, stated plainly

**ymir_v2 goes from 58.0% to 66.3% field** on the full 960-cell grid — **+8.3 points**. (More
than my first estimate; I read +6 off a smaller sample and the full grid says +8.3.)

That is more than a pure feel fix should normally buy. I think it's the right trade — he's well inside the 35–80 band, his blowout matchups
are unchanged, and the alternative is leaving a favorite deck whose signature play produces +1
damage. But it is a real power increase and you should know that's what you're getting.

**If it feels too strong in your hands, the knob is one number:** `bracing_cold`'s stack count. 6
stacks prices at 4.2 (under the 2e band but legal) and gives back roughly half the gain.

---

## 6. What I'd want to know from playtesting

The ticket ends with *"then Henry playtests the feel"*, and there are two specific things a sim
can't answer:

1. **Is nine stacks visible enough?** The number to watch is the damage preview on your 1-Energy
   cards after a build turn — `ice_spear` should read noticeably bigger. (The preview tells the
   truth now, as of ticket 104.)
2. **Does one build turn feel like a choice, or like an obligation?** If building is now
   *obviously* correct every game, the pendulum went too far and the stack count comes back down.
   The intent is that skipping a 21-damage nuke should still hurt.
