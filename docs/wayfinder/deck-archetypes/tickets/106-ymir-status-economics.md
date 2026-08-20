# Ymir_v2 status-turn economics (ticket 106): protect a favorite - it regressed

- Type: wayfinder:task - from playtest round 3's regression gate: ymir_v2 (a Henry
  favorite) got LESS fun under POWER+1. Branch archetype-web. Runs after 103 (bounds
  reshape the status math it tunes against).
- Status: **CLOSED 2026-08-20** - one card changed, EV table delivered. 862 tests, tsc + build clean.

Henry's diagnosis, verbatim intent: 'Early build str + weaken enemy and then slam in the
last few turns' - but under one-card-per-turn scarcity, a status turn costs a whole
GLACIAL-boosted 2e nuke turn, and at +1/stack a 2-stack card needs ~3+ remaining turns to
repay it. The fun choice loses to arithmetic.

Fix within standing policy (the sanctioned buff lever: RAISE PRINTED STATUS COUNTS,
enabler-first): sweep his status cards' stack counts (e.g. 2 -> 3/4) until the
build-early-slam-late line is within ~10% EV of the nuke-every-turn line by turn 6 - then
Henry playtests the feel. Do NOT touch GLACIAL_PACE or the 2e nukes (the slam is the
payoff; the build-up is what needs to compete). Gates: band standard, FTK 0, §2.3
diagnostic; deliverable includes the EV math table both lines. ONE commit.

---

# Resolution

Report: [research/ymir-status-economics.md](../research/ymir-status-economics.md). ONE commit.

## THE TICKET'S PREMISE IS ARITHMETICALLY WRONG - the build line was ALREADY winning

`scratch/ymirline.ts` plays scripted lines against a fat target and reports cumulative damage, one
card a turn. **Live numbers, before any change:**

| line | T1 | T2 | T3 | T4 | T5 | T6 | vs NUKE | crossover |
|---|---|---|---|---|---|---|---|---|
| NUKE (maul, maul, spears) | 21 | 42 | 48 | 54 | 60 | 66 | - | - |
| BUILD1 (one build, then slam) | 5 | 27 | 49 | 56 | 63 | 70 | **+6.1%** | **T3** |
| BUILD2 | 5 | 10 | 32 | 54 | 62 | 70 | +6.1% | T4 |
| DEBUFF2 | 6 | 12 | 34 | 56 | 63 | 70 | +6.1% | T4 |
| HENRY (build str + daze + thaw, then slam) | 5 | 12 | 15 | 38 | 61 | 71 | +7.6% | T5 |

**The gate - "within ~10% EV by turn 6" - passed before anything was touched.** Two things the
table shows that the gate does not:

1. **CROSSOVER is the metric, not the turn-6 total.** ymir_v2's games run **5.57 turns** on the live
   grid; a line that pays at T6 does not pay.
2. **Three build turns is unsupportable and SHOULD be.** Filling a 33-damage hole in two slams needs
   each slam to roughly double - about sixty stacks. Half a six-turn game spent not attacking should
   not win. **One build turn is the plan the deck supports, and it already crossed at T3.**

## What was actually broken: the payoff is INVISIBLE

`bracing_cold` granted 3 Strengthened. Three stacks on a 65-power `glacial_maul` is **+1 damage**.
The plan was correct and the feedback was a rounding error.

**Raising stacks does not move the crossover** (swept 3/6/9/12: BUILD2 stays T4, HENRY stays T5 until
12) because the crossover is set by the HOLE the build turn digs, not the payoff size. Raising the
build card's POWER does move it - but needs 45 power, and a 45-power build card beside a 65-power
nuke is not a choice, it is a second nuke. **Neither lever fixes the crossover at a sane value, and
the crossover did not need fixing.** Visibility did.

## The obstacle, and the way through: ZERO BUDGET HEADROOM

Every status card is pinned to its ceiling: `bracing_cold` 2.9/3.0, `numbing_gale` **3.0/3.0**,
`thaw` **3.1 - already over**, `ice_spear` 2.6/3.0. One extra stack on `bracing_cold` reads 3.3,
over budget. **The ticket's lever cannot be pulled at 1 Energy at all.**

**The cost buys the room.** GLACIAL_PACE = one card a turn on a 2-Energy frame, so **Energy is not a
real constraint for this deck** - 1e -> 2e costs him nothing he was using and opens the band to
5.2-6.5. And `bracing_cold` is the ONLY card in his deck no other deck runs (`numbing_gale` ->
draugr_v2; `thaw` -> ymir_v1; `ice_spear` -> ymir_v1 + both draugrs; `glacial_slam` -> draugr_v2).

## Shipped: ONE card

**`bracing_cold`: 1e / 15 power / 3 Strengthened -> 2e / 15 power / 9 Strengthened.** Scores 5.6
against 5.2-6.5, in band. **Power deliberately NOT raised** - the turn-one hole is the COST of the
decision; filling it would remove the choice instead of making it worth taking.

After: BUILD1 +19.7% (T3), BUILD2 +36.4% (T4), HENRY +24.2% (T5). The real change is not the maul
(21 -> 24) but his CHEAP cards: `ice_spear` 22 power -> 31, `numbing_gale` 20 -> 29. **Building makes
his whole hand good, not just the slam.**

GLACIAL_PACE, the 2e nukes, and every shared card untouched, exactly as specified.

## The cost, stated plainly

**ymir_v2 58.0% -> 66.3% field on the full grid - +8.3 points** (more than my first
smaller-sample estimate of +6). **That is more than a pure feel fix should normally buy** - accepted because the alternative is a favorite whose signature play
produces +1 damage, but it IS a power increase. **The knob if it plays too strong is one number:**
`bracing_cold`'s stack count; 6 gives back about half.

## Gates

- **862 tests green**, `tsc` clean, `npm run build` clean. `bracing_cold` in band at 5.6.
- **Redlines 68 -> 66**, and the one that RESOLVED is `os:ymir` - the §2.3 variance gap between his
  two decks closed, because v2 moved toward v1 (58.0 -> 66.3 against v1's 61.9). No new redlines.
- **8-DIFF: 3 of 32 rows moved.** `ymir_v2` **58.0 -> 66.3** (+8.3) and `huldra_v1` -1.8 as
  collateral; nothing else moved a point. Band **31/32**, NEU absolutes **30**, FTK **2**, dead
  20.8%, turns 5.21 -> 5.20 - all unchanged. **ymir_v2's own neutral absolutes: 0.**
- **For Henry's playtest, the two things the sim cannot answer:** is nine stacks VISIBLE enough (watch
  the 1e cards' damage preview after a build turn - it tells the truth now, per ticket 104), and does
  one build turn feel like a CHOICE or an OBLIGATION? If building is obviously correct every game the
  pendulum went too far and the count comes back down.
