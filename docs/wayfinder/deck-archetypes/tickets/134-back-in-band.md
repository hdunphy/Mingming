# Ticket 134 — Getting the roster back in band: five knobs measured, four dead

**Status:** measured, awaiting Henry's ruling
**Branch:** `legion/ai-perf`
**Asked by Henry:** *"I feel like we need to nerf the zoo decks maybe change our powerscale, especially considering they dominate the 3v3s. Give me some knobs/options to try to get the decks back in band or do we need a full redesign given the new rules?"*

---

## The short version

I tested five economy-wide knobs. **Four of them did nothing to the spread, and the fifth
overshot so hard it killed three decks outright.** That is not a failure of the knobs. It is the
answer to the question: there is no global multiplier that puts the roster back in band, because
the roster did not go out of band for a global reason.

The good news is the fifth knob told us exactly *what* the reason is, and it is smaller and more
fixable than a full redesign.

---

## What changed and why the roster moved

Three things shipped in tickets 131a–131e:

1. Every mingming draws **+1 card**, and the hand cap went 9 → 15.
2. Every mingming got **+50% HP**.
3. All health and damage numbers were multiplied by **10**.

Number 3 is cosmetic — it multiplies both sides of every comparison. Numbers 1 and 2 are real, and
together they changed what the game is *short of*.

**Before:** you ran out of cards. Henry's own words: *"I seem to always play all my cards and often
have an energy left over."* When cards are the scarce thing, a card that costs 2 energy is not
much worse than a card that costs 0, because you were never going to get to cast a fourth card
anyway. Card *quality* is what mattered.

**After:** you run out of energy. With +1 draw per body (which is +3 cards a turn at 3v3) and a
15-card hand, you now hold more cards than you can pay for. When energy is the scarce thing, a
0-cost card is strictly better than a 2-cost card of equal power, because you get to cast three of
them instead of one. Card *cost* is what matters.

That is the whole mechanism, and the re-baseline grid measured it independently: **average card
cost predicts how far a deck moved at r = −0.568**, and **0-cost share predicts it at r = +0.571**.
Those are the two strongest signals in the data and they are the same signal seen from both ends.

The zoo decks are not a special case. They are simply among the cheapest decks in the game, so they
caught the biggest tailwind. Nerfing three decks would not fix an economy-wide shift.

---

## The five arms

All five were run on the ten decks that moved furthest — five from each tail — so a knob that only
helps one side shows up as one-sided instead of averaging out to "no effect."

Every arm asserts its change took effect and throws if it did not (ticket 103's dead-arm trap).
All numbers are 1v1, beamless, 30 iterations per matchup, every deck against the full opponent field.

| deck | before 131 | now | +1 energy | −15% cheap attacks | ÷1.5 % effects | 0e → 1e |
|---|---|---|---|---|---|---|
| ratatoskr_v1 | 40.7 | **75.3** | 68.6 | 74.5 | 77.8 | **7.0** |
| huldra_v1 | 62.1 | **91.8** | 83.4 | 91.5 | 92.2 | **90.6** |
| jormungandr_v1 | 45.8 | **74.6** | 72.7 | 69.1 | 77.1 | **2.6** |
| nidhoggr_v1 | 52.3 | **78.5** | 68.3 | 81.0 | 81.7 | **79.7** |
| sleipnir_v1 | 56.8 | **72.4** | 71.1 | 72.0 | 74.7 | **1.2** |
| ymir_v2 | 66.4 | 42.1 | 19.9 | 46.4 | 46.8 | 63.3 |
| fafnir_v2 | 38.5 | 17.8 | 19.0 | 15.6 | 20.1 | 26.0 |
| nidhoggr_v2 | 53.8 | 35.3 | 26.0 | 33.8 | 32.9 | 33.5 |
| fafnir_v1 | 34.6 | 19.0 | 28.1 | 21.4 | 22.1 | 23.6 |
| sleipnir_v2 | 56.4 | 41.4 | 38.9 | 28.6 | 46.6 | 71.9 |
| **mean** | 50.7 | 54.8 | 49.6 | 53.4 | 57.2 | 39.9 |
| **spread (sd)** | **10.0** | 25.3 | 24.1 | 26.0 | 25.2 | **31.9** |
| **in band (35–80)** | **9/10** | 7/10 | 5/10 | 4/10 | 5/10 | 3/10 |

The band is **35–80**, the standing grid band from `scratch/rebaseline.mjs:124`. (An earlier draft
of this ticket used 35–65 by mistake and reported much lower counts. The ranking of the arms is
unchanged — nothing beat leaving it alone either way — but the absolute counts here are the correct
ones.)

**Nothing beat leaving it alone.** The spread was 10.0 before ticket 131 and 25.3 after. No knob
brought it back below 24. Across the full 32-deck grid the same story reads sd **9.2 → 19.4** and
in band **31/32 → 22/32**.

### Why each one failed, individually

**+1 energy on every mingming** — *made the losing decks worse*, which is the opposite of what it
was for. ymir_v2 went 42.1 → 19.9. The reasoning was "expensive decks now draw cards they can't
pay for, so give them the energy." The reality is that the cheap decks had *more cards in hand* to
spend the extra energy on, so handing out energy amplified exactly the advantage it was meant to
offset. This knob is actively harmful.

**−15% power on every 0-cost and 1-cost attack (89 cards)** — barely moved the winners at all.
ratatoskr 75.3 → 74.5, huldra 91.8 → 91.5. The reason is that the decks winning are cheap
*utility and sustain* decks — heals, Regen, Poison, status — not cheap aggro decks. There was
almost no cheap attack power in them to cut.

**Heal power ÷1.5 and Burn/Poison damagePercent ÷1.5 (28 things)** — the theory here was sound:
the +50% HP buff did not weaken heals and damage-over-time, because those read `maxHp` and plain
damage does not. Measured, a 40-power attack went from 10.4% of a health bar to 6.9%, while a
30-power heal stayed at 7.5% — the attack-to-heal ratio fell from 1.39 to 0.92. But dividing the
percentage effects back out **raised everything on the panel by about 2.4 points on average and
changed the spread not at all** (25.4 → 25.2). It shifted the level, not the shape. Percentage
denomination is a real pricing bug worth fixing on its own merits, but it is not what is driving
the band problem.

**−1 cost on every 3-cost-or-higher card** — **a dead arm, and the dead arm is the finding.** Only
**12 of 223 cards in the game cost 3 or more**, and exactly one of them appears anywhere in the
ten-deck panel. I killed the run once that was clear. See the cost curve section below.

**Every 0-cost card becomes 1-cost (40 cards)** — the only knob with real force, and it has far too
much of it. It moved decks by *seventy points*: ratatoskr 75.3 → 7.0, jormungandr 74.6 → 2.6,
sleipnir_v1 72.4 → 1.2. It also lifted the losing tail the way it was supposed to (sleipnir_v2
41.4 → 71.9, ymir_v2 42.1 → 63.3). But it left two of the five winners completely untouched —
huldra 91.8 → 90.6 and nidhoggr_v1 78.5 → 79.7 — so the spread got *worse*, not better (25.4 →
31.9).

---

## The two things the failures point at

### 1. The cost curve has almost no top end

| cost | cards | share |
|---|---|---|
| 0 | 40 | 18% |
| 1 | 101 | 45% |
| 2 | 66 | 30% |
| 3 | 11 | 5% |
| 4 | 1 | 0% |

**93% of the game costs 0, 1 or 2 energy.** Across the ten-deck panel the average card cost ranges
from 0.67 to 1.50 — that is the entire spread of "expensive deck" versus "cheap deck" in this game.

While cards were the scarce resource that flatness was invisible, because cost was not the binding
thing. Now that energy is the scarce resource, cost is the main axis of the game, and the main axis
of the game has three notches on it. That is why a flat +1 on 0-cost cards is a 70-point swing:
+1 on a curve that only runs 0–2 is a *50% cost increase on a fifth of the game*. There is no
gentler version of this knob available, because there is no room between the notches.

### 2. There are two different kinds of winner, and only one of them is a cost problem

The 0e→1e arm separates them cleanly:

**Group A — cheap-tempo decks, annihilated by the cost change.** ratatoskr_v1 (6 of 11 cards free),
jormungandr_v1 (4 of 9), sleipnir_v1 (5 of 12). These decks win *because* the cards are free. They
are a pure cost problem and they respond violently to a cost lever.

**Group B — 1-cost sustain decks, completely immune to every knob tested.** huldra_v1 (91.8, and
between 90.6 and 92.2 under all five arms) and nidhoggr_v1 (78.5, between 68.3 and 81.7). These
have almost no free cards — huldra is 4 free / 4 one-cost, nidhoggr_v1 is 4 / 3 / 3 — and they are
56% and 80% percentage-denominated respectively. They are winning on card quality under the longer
games the HP buff created, not on cost.

Being cheap is also **not sufficient** to be a winner: nidhoggr_v2 has 5 free cards and scores
35.3, fafnir_v1 has 6 free cards and scores 19.0. Cost predicts how far a deck *moved*, not where
it *ended up*. Where it ended up is still mostly about the cards themselves.

---

## So: knobs, or redesign?

**Neither, as stated.** The honest read of five arms is:

- The **global knobs are exhausted.** Power multipliers cannot fix this because it is not a power
  problem; the one knob with the leverage to fix it (cost) has no fine adjustment available on a
  three-notch curve.
- A **full redesign is not warranted.** The level is fine — mean 54.8 now versus 50.7 before,
  which is close enough. Games got longer, the hand feels full, and Henry's two feel complaints
  (leftover energy, three-card hands with no combos) are fixed. Throwing that away to re-derive a
  9.9 spread would be trading a good-feeling game for a tidy spreadsheet.
- What is left is **per-deck work on a named list**, which is a much smaller job than either.
  Five decks are outside the band on the high side and five on the low side, and the arms above
  tell us which of the two problems each one has.

### The four options, in the order I'd rank them

**Option 1 — Widen the cost curve, then re-cost per deck. (My recommendation.)**
Add a real 3–4 energy tier so cost has somewhere to go, and move Group A's free cards up into the
space that creates. This is the only option that fixes the root cause rather than the symptom, and
it directly serves the feel goal: a genuinely expensive card is what makes a full hand a *decision*
instead of a play-everything sequence, which was the original complaint. Cost: real design work on
maybe 20–30 cards, plus a re-baseline. This is roughly ticket 114 territory.

**Option 2 — Leave the economy alone and re-cost the ten named decks by hand.**
Cheapest path to a tight band. Group A gets +1 on a *subset* of its free cards (not all of them —
that is the 70-point overshoot); Group B gets its sustain cards priced against the longer games.
Does not fix the flat curve, so the next content drop reopens the same problem. Cost: a day of
per-deck iteration.

**Option 3 — Roll the HP buff from +50% back to +25%.**
Untested — the multiplier is a compile-time constant so I could not run it as an arm without
patching the source, which I did not want to do mid-comparison. Worth measuring because shorter
games specifically hurt Group B, whose whole advantage is grinding out a long game with sustain.
Costs some of the feel win, but only half of it.

**Option 4 — Fix percentage denomination as its own ticket, not as a band fix.**
The ÷1.5 arm proved this does not fix the band. But 65 of 223 cards being priced against a health
bar that just grew 50% is a real bug — it silently buffed every heal and every DoT relative to
every attack, and it will keep silently repricing them every time HP changes. Fix it for
correctness and stop expecting it to fix the spread.

---

## Decisions I need from Henry

1. **Which option do you want me to build?** My recommendation is Option 1 (widen the cost curve),
   with Option 4 done alongside it as a separate correctness fix. If you want the fast path
   instead, say Option 2 and I will start on the ten named decks.

2. **Do you want the 3v3 numbers before you decide?** Everything above is 1v1. The game ships 3v3,
   and at 3v3 the driving mechanism is **three times stronger** — +1 draw per body is +3 cards a
   turn, so the shift from card-scarce to energy-scarce is far more pronounced. I expect the same
   ranking with bigger gaps, but I have not measured it. It is about four hours of machine time and
   I can start it now without blocking anything else.

3. ~~**Should `results/rebaseline/` be promoted?**~~ — **DONE, Henry said promote it.**
   `scratch/promotegrid.mjs` replaced the 960 measured cells in `docs/balance/deck_grid.json`
   from the re-baseline CSVs. 772 of 960 cells moved 5+ points; the biggest single cell was
   `fafnir_v2` vs `huldra_v1` at −96.7. The grid now reads mean 49.9, sd 19.4, 22/32 in band,
   and the ten decks it names as out of band are the working list for whichever option is picked.

## Still open from before

- **Ticket 133** — `dawns_respite` heals 6.25% and costs 6%, so playing it repeatedly is free
  value. Recommendation is heal power 25 → 24, which makes it exactly 6%. Needs a yes.
- **Ticket 130** — daemon pricing: `EXPECTED_DAEMON_PROCS = 4` is a guess (measured is 0.75/turn
  per unit), the `if (score === 0)` guard voids a daemon's hook value if it has any actions at all,
  and `DRAW` is priced at 15 which is wrong under the new hand economy.
- **Ticket 128, UI half** — at 3v3 the caster selection persists between plays, so 16 firmwares
  that gate on `source: SELF` fire for the wrong body. This is the "fenrir_v2 doesn't work" bug and
  it is still live.

---

## Reproducing any of this

```
npx vite-node scratch/bandarms.ts -- --arm ENERGY      --iter 30
npx vite-node scratch/bandarms.ts -- --arm CHEAPNERF   --iter 30
npx vite-node scratch/bandarms.ts -- --arm PCTNERF     --iter 30
npx vite-node scratch/bandarms.ts -- --arm ZEROCOST    --iter 30
npx vite-node scratch/bandarms.ts -- --arm BIGDISCOUNT --iter 30   # dead arm, 12 cards
```

Each arm prints how many things it changed and throws if that number is zero. All arms mutate the
raw JSON *before* the registry loads, because `GetProgramData` inflates a fresh object per call and
mutating after load is a silent no-op.
