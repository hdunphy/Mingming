# The first-KO snowball: action economy, overkill aversion, and comebacks (ticket 70)

- Type: wayfinder:grilling
- Status: open
- Assignee: legion-70-measure (MEASUREMENT STEP ONLY - the grilling is Henry's)
- Blocked by: nothing hard - the measurement step below should run BEFORE the grilling session
- Phase: Vertical Slice
- Scope note: this ticket rules DIRECTION. Anything it decides that touches cards, statuses, OS
  behaviour or the AI lands through deck-archetypes coordination, per the map's scope boundary.

## Why this exists - Henry's play report, 2026-08-28

> "The main issue I see in our battles is the first mingming defeated causes a massive advantage
> for the remaining 3 roster. It might be tied to another issue where if you don't capitalize on
> finishing a kill you lose. One of my plays I avoided playing two Stampedes on a mingming because
> it would have overkilled by 40 damage - but then I lost because while the enemy had 3 low
> mingmings he was able to get one kill then outnumber me. How can we make a death less penalizing
> and allow comebacks - or even let the team with overall more HP keep their lead. I'm not sold on
> this second part as a problem - maybe that's the drawback if you want to focus fire - but it
> feels like it limits strategies."

This is the second time the same shape has surfaced: the round-5 playtest report already said
*"the first KO usually means a win."* The boss rework (68) reduced how often the PLAYER is on the
wrong end of it at Emberfall, but the mechanism is symmetric and run-wide.

## The mechanism, in engine facts (verified 2026-08-28)

- **Energy is per member and dies with the member.** Each unit refills to its own `maxEnergy` at
  turn start; *"defeated units get no energy refill"* (`battleReducer`, turn-start refresh). A
  3x2e side runs 6e/turn; after one KO it runs 4e/turn against an intact enemy's 6e - a permanent
  -33% throughput cliff from a single event. **AND THAT IS HALF THE CLIFF (measured 2026-08-29):**
  `battleReducer`'s PRE_TURN draw is `sum(cardDraw over ALIVE) - aliveCount + 1`, so the same death
  also costs **-28.9%** of the hand. Compounded across the reference panel, averaged over which
  member dies: **one KO costs a side -52.5% of its turn throughput**, within a point on all six
  comps. That is what the 91.7% below is made of.
- **A KO silences the member's OS** - the enabler its 5-card engine was tuned around. The engine
  cards stay in the side's shared deck as devalued draws (castable by a living caster, losing STAB
  and the OS trigger - exact caster rules to be pinned in the facts pass).
- **No switching, simultaneous 3-active** (ruled): there is no reserve to promote and no way to
  hide a wounded member.
- **Focus fire is AI-optimal and both sides know it** - the full-lookahead AI's 5.3-turn boss routs
  and the 92.5% panel-zoo finding are both focus-fire results.
- **Overkill is pure waste today** (to verify in the facts pass: no overflow, no carry, no refund),
  so a rational player under-commits on lethal - which is exactly the wrong incentive in a game
  where the first KO decides fights. Henry's Stampede regret is this incentive working as coded.

## Measurement BEFORE the grilling (agent - cheap, report-only)

Instrument the 3v3 harness (and read ticket 59's run logs the same way) to report, per battle:
which side scored the first KO, the winner, turns from first KO to battle end, and total overkill
damage wasted. Then report across the existing 3v3 cells:

1. **P(win | scored first KO)** and its complement - how decisive is the first KO really (Henry's
   felt answer: ~always; get the number).
2. **Average turns from first KO to end** - is the rest of the fight real play or a formality.
3. **Overkill wasted per battle** - how big is the incentive problem in damage terms.
4. **P(win | higher total starting HP)** - does the bigger team actually lose to the
   first-kill team, or does HP advantage still carry (Henry's second, unconfirmed issue).

These four numbers frame every option below; the grilling should not run without them.

## Measurement instrument — BUILT 2026-08-29

`npm run balance:snowball` (`src/debug/balance/runSnowball.ts` -> `snowball.ts`), report-only, exits
0, rules nothing. It prints the four numbers this section asks for, in this section's order.

**RUN IT ON A REAL MACHINE, WITH `--out`.** Measured cost is **~120 s per pair**, so 30 pairs at
`--iterations 1` is about an hour. Two things learned the hard way on 2026-08-29: an agent's cloud
container reclaims background processes during idle gaps (a run died at pair 5 of 30 with nothing
to show), and Node BLOCK-buffers stdout to a pipe, so `> file.txt` leaves an empty file for minutes
and loses everything if the run is killed. `--out <path>` appends each line as it happens, so a
run that dies at pair 18 still leaves eighteen pairs of evidence:

```
npm run balance:snowball -- --iterations 1 --pairs --out snowball-70.txt
```

**Population:** `REFERENCE_PANEL` round-robin, mirrors excluded — 30 ordered pairs, both turn
orders. That is the repo's standing 3v3 reference set (ticket 109), which is what *"the existing 3v3
cells"* means here. Deliberately role-diverse rather than launch-scoped: the snowball is a mechanism
question, and restricting to the EA elements would measure the same effect through a smaller and
more lopsided sample. **These are standalone battles, not a run** — no HP carries between fights, so
nothing here speaks to gauntlet attrition.

**Overkill comes off the DAMAGE LEDGER, and that is the load-bearing decision.**
`effectHandlers.handleAttack` floors HP at zero, so a 60-damage hit on a 5 HP target moves 5 HP: an
HP-diff instrument cannot see overkill *by construction* and would have reported ~0 with a straight
face. `IDamageRecord` (added 2026-08-24, at Henry's *"it's really important to know the exact
damage"*) records `raw` before the floor and before shields, so the measure is
`max(0, raw - absorbed - applied)` summed over every hit. The ledger is cleared per action, so the
instrument reads it after **every** dispatch — including the forced `END_TURN`, because a Burn or
Poison tick killing a unit is a KO like any other and skipping it would under-count DoT deaths.

**First-KO attribution is by whose member DIED, not by `state.activeSide`** — a unit dying to its
own end-of-turn Burn dies on its own side's turn, and crediting the actor would hand that kill to
the wrong team. A KO on both sides in one dispatch records `firstKoBy: null` and is excluded from
line 1 rather than assigned to one side.

**Three exclusions, each of which would otherwise fake a result:** draws are out of line 1 (a draw
says nothing about whether the first KO decided the fight, and counting it against the killer
manufactures a comeback rate); simultaneous KOs are out of line 1; equal-HP battles are out of line
4 (folding them in at 50% biases it toward "no effect" using samples that carry no signal). Each
exclusion is counted and printed, never silent.

`snowball.test.ts` pins the arithmetic against fabricated runs with hand-worked answers — the only
way these ratios get checked at all, since a real batch cannot be given a known result.

**Smoke check (4 battles, panel-zoo vs panel-control both ways):** first-KO side won 4/4; mean
overkill 18.5 damage = 7.8% of a side's starting pool; the loser lost all 3 members every time.
Shape is right; the real numbers follow.

### THE NUMBERS — measured 2026-08-29, 60 battles, 39 minutes

Run on Henry's machine (the agent container reclaims long jobs): `--iterations 1 --pairs`,
30 ordered pairs of `REFERENCE_PANEL`, both turn orders, `maxTurns 40`. **Every one of the 60
battles reached a KO**, so nothing here rests on a stalled sample.

| # | measure | result |
| --- | --- | --- |
| 1 | **P(win \| scored first KO)** | **91.7%** (n=60) |
| 1 | P(win \| conceded first KO) — *the comeback rate* | **8.3%** — 5 battles in 60 |
| 2 | mean turns after the first KO | **4.3** (median 4.0) |
| 2 | mean battle length | 6.5 turns |
| 2 | **share of the fight that happens after the first KO** | **66.9%** |
| 3 | mean overkill wasted per battle | **17.8 damage** (median 13.5) |
| 3 | as a share of one side's starting HP | **7.4%** |
| 4 | **P(win \| higher total starting HP)** | **50.0%** (n=60) |
| — | members lost by the loser | **3.0 of 3** |
| — | members lost by the winner | 0.9 of 3 |

#### Line 1 — Henry's felt answer was right, and it is 91.7%

*"The first mingming defeated causes a massive advantage"* and the round-5 report's *"the first KO
usually means a win"* are both confirmed. **The comeback rate is 8.3%.** The loser loses all three
members in every single decided battle (3.0 of 3), while the winner averages 0.9 — so this is not
a close game that tips, it is a rout that begins at the first death.

#### Line 2 — the surprise, and the finding that changes the framing

The ticket asked whether the rest of the fight is *"real play or a formality"*. It is **both, and
that is worse than either**: **two thirds of the average battle (4.3 of 6.5 turns) is played out
AFTER the first KO**, in a position that is lost 91.7% of the time.

A fast rout would be a balance problem. This is an **experience** problem — the player spends the
majority of every fight in a decided position, and the game does not end. That is the shape Henry
described from the other side ("*while the enemy had 3 low mingmings he was able to get one kill
then outnumber me*"), and it is the strongest argument in the measurement for doing something,
whatever Q2 rules.

#### Line 3 — the overkill incentive is real but smaller than it feels

**17.8 damage a battle on average, 7.4% of a side's pool** — but the median is 13.5 and one pair
reached 66.5, so the distribution is right-skewed and Henry's remembered 40 is in the tail rather
than at the centre. Two things worth holding together before Q1:

- This is the waste an AI incurs while **not** avoiding it. It is the price of playing greedily.
- The price of *avoiding* it, in Henry's own game, was losing — because line 1 says the kill was
  worth 91.7% and the 40 wasted damage was worth 7.4% of a health bar.

So the incentive is not merely mispriced, it is **inverted at the scale that matters**: the thing
the player is tempted to protect is worth an order of magnitude less than the thing they give up by
protecting it.

#### Line 4 — a clean null, and it holds at a 36% HP advantage

**50.0% exactly, n=60.** Starting HP predicts the winner not at all.

This was checked rather than reported, because a flat 50% is exactly what a measurement with no
spread in its predictor would produce. It has spread: the six comps' base HP pools run **217
(panel-mixed-a) to 312 (panel-ramp), a 43.8% range**, with a **median pairwise gap of 11.2%** and a
maximum of **35.9%**; only 6 of the 30 pairs are inside 5%. So the null is real across a genuine
range of advantages, not an artefact of comparing near-identical teams.

**This is the half of the ticket that can close with no change.** Henry: *"I'm not sold on this
second part as a problem - maybe that's the drawback if you want to focus fire."* The measurement
says the bigger team does **not** systematically lose to the first-kill team. It also says HP
advantage buys nothing — which is a different fact from the one Q4 asks about, and is not by itself
a problem.

**The limit of line 4, stated:** it measures **starting** HP, not a mid-fight HP lead. A team that
is ahead on total HP at turn 4 is a different population from a team that began with more, and this
number does not speak to it.

#### An observation for Q2/Q3, offered as a hypothesis and NOT a finding

**`panel-ramp` — the highest HP pool (312) and the sustain/shield comp — appears in 4 of the 5
comeback battles.** It sits in 10 of the 30 ordered pairs, so uniform comebacks would put it in
about 1.7 of 5.

If that survives more samples it matters for Q3, because it would mean **a comeback mechanism
already exists and is called sustain** — the question would become whether it is distributed and
priced to do that job, rather than whether to build a new one. At n=5 comebacks it is nowhere near
established; the way to settle it is `--iterations 5` or a targeted ramp-versus-field run.

#### What was NOT measured

- **This is not a run.** Standalone 3v3s, no HP carried between fights, so nothing here speaks to
  gauntlet attrition — the run gate owns that.
- **Mid-fight HP leads**, per line 4's limit above.
- **Ticket 59's run logs** were not read: no player has generated any yet, so the harness route is
  the only one with data in it.

Raw output: `snowball-70.txt` (untracked, Henry's machine).

**Handover to the design agent:**
[research/70-what-the-snowball-asks-of-the-cards.md](../research/70-what-the-snowball-asks-of-the-cards.md)
— what each option below would cost the card pool, and three findings that came out of writing it:
the KO cliff is **twice as steep as this ticket's engine-facts section says**, `Overkill Recovery`
and `First Blood` are **already-ruled Driver names that collide with Q1 and Q2**, and **Q2a is not a
do-nothing option** — it is ticket 16, blocked behind deck-archetypes 109.

### EXPERIMENTAL ARM built 2026-08-29 — Q2b, on Henry's ask

Henry: *"run another test where if an ally dies that side gets a stack of energized, see if that
allows more comebacks."* Built as an arm in the harness, **not** in `battleReducer` — the reducer has
a committed scenario corpus behind it, and a rule added there to answer a grilling question would
change every recorded battle in the repo and have to be reverted whichever way this ticket is ruled.
The harness expresses the same rule over the same states and leaves the engine bit-identical.

```
npm run balance:snowball -- --iterations 1 --energized once     --pairs --out arm-once.txt
npm run balance:snowball -- --iterations 1 --energized standing --pairs --out arm-standing.txt
```

**There are two modes because "a stack of Energized" is a ONE-SHOT.** `battleReducer`'s PRE_TURN
refill reads the stacks, adds them to that unit's refill, and then **strips the status**. So the
literal ask pays out once, on the bereaved side's next turn, and never again — against a cliff that
is *permanent* and has 4.3 turns left to run. Measuring only that would answer *"does a small
one-off cushion produce comebacks"* while looking like it had answered *"does removing the energy
cliff produce comebacks"*.

- **`once`** — the literal ask. Survivors gain 1 Energized at the death; paid once.
- **`standing`** — re-topped every dispatch, so the side keeps +1 energy per survivor for as long as
  it is down a member. This is the energy cliff actually repaired.

**It does not touch the CARD cliff**, which is the larger half (-28.9% vs -33.3%, compounding to
-52.5%). So a small movement in the comeback rate must NOT be read as "energy is not the problem" —
half the mechanism is still in place.

**ARM LIVENESS IS PRINTED NEXT TO THE RESULT.** The report states how many Energized stacks were
granted, and calls a zero-grant run **VOID rather than null**. That is the merge report's costliest
lesson applied directly: *"a dead arm reads exactly like a null result."*

**Validated on a single battle** (identical scenario and seed, three arms):

| arm | turns | losses P/E | stacks granted |
| --- | --- | --- | --- |
| baseline | 4 | 0 / 3 | 0 |
| `once` x1 | 4 | 0 / 3 | 3 |
| `standing` x1 | **7** | **2** / 3 | 19 |

`once` fired and changed nothing; `standing` turned a 4-turn shutout into a 7-turn fight the winner
paid two members for. The arm demonstrably works, and the two modes are demonstrably different.

**Not yet run at scale, and a power warning.** A 4-battle CLI smoke granted 54 stacks under
`standing` and moved neither the comeback rate nor the battle length — n=4, so it means nothing
either way. More importantly: the baseline comeback rate is **5 battles in 60**, so at
`--iterations 1` only a *large* effect is detectable. Both arms are seeded identically to the
baseline, so the honest comparison is per-pair (`--pairs`) rather than the headline rate; if the
effect looks small, `--iterations 2` or 3 is needed before concluding anything.

**Superseded by the results below** — the pairing rescued the power problem. McNemar on the
same-seed battles gives `standing` p = 0.039 where an unpaired test on the identical data gives
p = 0.114.

### ARM RESULTS — measured 2026-08-29, 60 battles each, both arms

Run on Henry's machine, `--iterations 1 --pairs`, seeded identically to the baseline.

**ARM LIVENESS FIRST, because a dead arm reads exactly like a null result.** `once` granted **269**
Energized stacks (4.5/battle); `standing` granted **869** (14.5/battle). Both arms fired. Neither
result is void.

| | baseline | `once` | `standing` |
| --- | --- | --- | --- |
| P(win \| scored first KO) | 91.7% | **83.3%** | **80.0%** |
| **comeback rate** | **8.3%** (5/60) | **16.7%** (10/60) | **20.0%** (12/60) |
| mean turns after first KO | 4.3 | 4.3 | **3.9** |
| mean battle length | 6.5 | 6.5 | **6.0** |
| share of fight after first KO | 66.9% | 66.8% | **64.4%** |
| mean overkill wasted | 17.8 | **22.2** | **21.9** |
| P(win \| higher starting HP) | 50.0% | 51.7% | 55.0% |
| members lost by the winner | 0.9 | 1.1 | 1.1 |

#### The paired test, which is the one that settles it

Both arms replay the **same 60 battles** with one rule changed, so the comparison is paired and
McNemar's exact test applies. Counted in battles:

| | flipped TO a comeback | flipped AWAY | pairs unchanged | **McNemar exact, two-sided** |
| --- | --- | --- | --- | --- |
| `once` | 6 | 1 | 23 of 30 | **p = 0.125** |
| `standing` | 8 | 1 | 21 of 30 | **p = 0.039** |

**Pairing is what makes this readable at n=60.** Treated as independent samples the same data gives
Fisher p = 0.269 (`once`) and p = 0.114 (`standing`) — both unremarkable. Throwing away the fact
that every battle is the *same* battle with one rule changed costs most of the power in the
experiment. The 95% Wilson intervals on the raw rates overlap heavily (baseline 3.6-18.1%,
`standing` 11.8-31.8%), which is the same point from the other side.

#### Reading it honestly

**`standing` — an effect. 8 battles flipped to a comeback and 1 flipped away, p = 0.039.** The
comeback rate goes 8.3% -> 20.0%, a 2.4x lift, and the direction is consistent (8:1). At this sample
size that is a real signal, but NOT a good estimate of the effect's *size* — the interval is wide.

**`once` — underpowered to tell, and pointing the same way.** 6:1 in the same direction, p = 0.125.
That is not "no effect"; it is a smaller sample of the same phenomenon failing to clear the bar. It
is also exactly what the mechanism predicts: `once` pays one extra energy on one turn against a
cliff that is permanent, so it should do *less* than `standing`, and it does.

**Two things moved that nobody asked about, and both matter:**

1. **`standing` made fights SHORTER, not longer** — 6.5 -> 6.0 turns, and 4.3 -> 3.9 after the first
   KO. The intuition was that helping the losing side would drag decided fights out. The opposite
   happened: the bereaved side either turns it around or dies faster, so **there is less time spent
   in the decided-but-not-over state** that line 2 identifies as the experience problem. This lever
   improves both measurements at once, slightly.
2. **Overkill went UP in both arms** — 17.8 -> 22.2 / 21.9 damage per battle. More energy means more
   cards played means more damage thrown at nearly-dead units. So this lever **mildly worsens Q1's
   problem while improving Q2's**, which is worth knowing before the two are ruled separately.

#### The confound, stated whichever way it is read

**Both arms repair only the ENERGY half of the cliff.** The card half — `sum(cardDraw over ALIVE) -
aliveCount + 1`, i.e. -28.9% — is untouched, and the two compound to -52.5%. So this is **half a
repair producing a 2.4x comeback lift**, and the honest reading is that the resource asymmetry is a
real driver of the snowball rather than that it is the whole of it.

#### What would settle it

`--iterations 3` (180 battles per arm, ~2 hours each) would turn `once`'s 6:1 into a verdict and put
a usable interval on `standing`'s effect size. A `standing` arm that also repaired the card cliff
would measure the full mechanism rather than half of it. Neither is needed before the grilling —
these numbers are enough to frame Q2 and Q3 — and both are cheap to run if Henry wants the lever
sized rather than merely detected.

**Nothing here is a ruling.** Q2b now has evidence behind it; Q2a, Q2c, Q2d, Q1 and Q3 do not, and
this measurement does not compare the options against each other.

### THE CARD ARM — built 2026-08-29, on Henry's follow-up

Henry, after seeing the energy results: *"I don't like the games ending faster so I like the once
energize. can we do another run that does the same with card draw. both permanent card draw and a
one turn boost then see them combined with the energized. I want to maintain game length but fine
with 15-20% comeback rate."*

**A stated target, for the first time in this ticket: comeback rate 15-20%, battle length HELD at
the baseline's 6.5 turns.**

```
npm run balance:snowball -- --iterations 1 --pairs --draw once                  --out arm-draw-once.txt
npm run balance:snowball -- --iterations 1 --pairs --draw standing              --out arm-draw-standing.txt
npm run balance:snowball -- --iterations 1 --pairs --energized once --draw once     --out arm-both-once.txt
npm run balance:snowball -- --iterations 1 --pairs --energized once --draw standing --out arm-both-mixed.txt
```

**`--draw-cards` defaults to 2, which is the FULL card cliff** — `sum(cardDraw over ALIVE) -
aliveCount + 1` takes a three-member side from **7 cards to 5** on a death. That is the honest
parallel to the energy arm, where one Energized per survivor restored the whole 2-energy loss.
`--draw-cards 1` is the half-repair if 2 overshoots.

**Timing mirrors the reducer, not the death.** Cards arrive at the bereaved side's **turn start**,
capped by `HAND_SIZE_LIMIT`, because that is where the refill happens — handing them over at the
instant of the death would put cards in a hand mid-turn, which no rule in this game does. `once` is
the first turn after the death only; `standing` is every turn while down. The grant does **not**
scale with a second death; that is a separate question and folding it in would measure two changes
as one.

**Liveness validated on one battle** (same scenario and seed throughout):

| arm | turns | losses P/E | winner | energized | cards |
| --- | --- | --- | --- | --- | --- |
| baseline | 7 | 2 / 3 | PLAYER | 0 | 0 |
| `draw once` | 5 | 1 / 3 | PLAYER | 0 | 4 |
| `draw standing` | 6 | 3 / 2 | **ENEMY** | 0 | 16 |
| `energized once + draw once` | 5 | 1 / 3 | PLAYER | 5 | 4 |
| `energized once + draw standing` | 5 | 1 / 3 | PLAYER | 5 | 10 |

Both arms fire and compose; `draw standing` flipped the winner outright in this one battle. The
report prints a per-arm liveness line and calls a zero-grant arm **VOID rather than null**.

**A warning the single battle already raises:** four of the five arms made this fight *shorter*
(7 turns -> 5 or 6), which is the thing Henry explicitly does not want. n=1 means nothing, but it is
the number to read first in the real runs.

**AND THE RESULT ALREADY IN HAND MAY BE THE ANSWER** (it was - see the arm results below)**.** `energized once` measured **16.7% comebacks**
— inside the stated 15-20% band — at **6.5 turns and 4.3 after the KO**, i.e. length-neutral to a
tenth of a turn against the baseline. If the card arms come back shorter, `energized once` is the
lever that already meets both halves of the target.

### ALL SIX ARMS — measured 2026-08-29. THE CLIFF BITES THROUGH ENERGY, NOT CARDS.

360 battles total, six arms of 60, every one seeded identically to the baseline. **Every arm's
liveness counter is non-zero** — no run here is void.

| arm | comeback rate | 95% CI | flips to / away | McNemar p | length | after KO | overkill |
| --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | 8.3% (5/60) | 3.6-18.1 | — | — | **6.5** | 4.3 | 17.8 |
| **`energized once`** | **16.7%** (10) | 9.3-28.0 | **6 / 1** | 0.125 | **6.5** | **4.3** | 22.2 |
| `energized standing` | 20.0% (12) | 11.8-31.8 | **8 / 1** | **0.039** | 6.0 | 3.9 | 21.9 |
| `draw once` | **8.3%** (5) | 3.6-18.1 | **3 / 3** | **1.000** | 6.4 | 4.2 | 16.8 |
| `draw standing` | 10.0% (6) | 4.7-20.1 | **4 / 3** | **1.000** | 6.2 | 4.0 | 17.1 |
| `E once + D once` | 13.3% (8) | 6.9-24.2 | 5 / 2 | 0.453 | 6.3 | 4.2 | 21.0 |
| `E once + D standing` | 13.3% (8) | 6.9-24.2 | 5 / 2 | 0.453 | 5.8 | 3.7 | 21.6 |

#### The finding: cards are a NULL, and it is a clean one

`draw once` grants 206 cards and lands on **exactly the baseline** — 5 comebacks, 8.3%. `draw
standing` grants **836** cards and moves one battle.

**Their flip counts are 3:3 and 4:3 — symmetric churn.** That is the shape of a lever connected to
nothing, and it is a different object from `energized once`'s 6:1, which is a real signal short of
samples. This measurement can tell those two apart, which is the whole reason the arms are paired.

**Combining made it WORSE, twice.** `energized once` alone is 16.7%; adding either card arm drops it
to 13.3%. Both combinations land on the same 5:2, so this is not one odd run.

#### Why — and the corroboration that makes it more than a story

**The bereaved side is ENERGY-constrained, not card-constrained.** Extra cards arrive in a hand it
cannot afford to play. Two independent numbers agree:

- **Overkill rises with energy and not with cards.** Energy arms: 17.8 -> 22.2 / 21.9. Card arms:
  17.8 -> **16.8 / 17.1**, i.e. flat or slightly down. More energy means more plays resolve, which
  is why the waste goes up. More cards means no additional plays at all.
- **Battle length moves the same way.** Energy shortens the fight (6.5 -> 6.0); cards barely touch
  it (6.5 -> 6.4 / 6.2) — because nothing extra is being *done* with them.

#### THIS CORRECTS THIS TICKET AND ITS DESIGN-AGENT REPORT

The card cliff was measured at **-28.9%** against energy's **-33.3%**, and both this ticket and
[research/70](../research/70-what-the-snowball-asks-of-the-cards.md) went on to treat the card half
as comparable — the report warned in as many words that a small energy movement *"must NOT be read
as 'energy is not the problem'"* because the untouched card half was *"the larger half"*.

**That inference was wrong, and the experiment is what overturned it.** The card half is larger
**arithmetically** and inert **behaviourally**. An arithmetic cliff is not a behavioural one, and
nothing short of measuring it could have told the difference. Both documents are corrected rather
than quietly reworded, because the reasoning that produced the error is the part worth keeping
visible.

#### Against Henry's stated target

Henry, 2026-08-29: *"I don't like the games ending faster… I want to maintain game length but fine
with 15-20% comeback rate."*

**Exactly one arm meets both halves: `energized once` — 16.7% comebacks, 6.5 turns, 4.3 after the
KO.** Length-neutral to a tenth of a turn against the baseline, and dead centre of the band.
`energized standing` clears the comeback bar at 20.0% but costs half a turn of battle length; every
card arm either misses the band or shortens the game for nothing.

Its p is 0.125 — **6:1 in the right direction, short of significance at this sample.** If the
choice is to be defended on the number rather than on the mechanism, `--iterations 3` on that one
arm (~2 hours) is what would settle it.

**Ticket 70 stays OPEN.** This measures Q2b and Q3b only. Q1, Q2a, Q2c, Q2d and Q3a still have no
numbers, and the grilling is Henry's.

## The grilling - questions for Henry

**Q1 - Overkill: forgive, convert, or keep the waste?**
(a) Splash: excess lethal damage carries to another enemy (note: mechanically REWARDS focus fire
even harder). (b) Convert: overkill refunds energy or draws a card - the kill is never a regret,
but the snowball is fed a different way. (c) Keep it: precision is a skill test; Stampede-sizing
is gameplay. Each option is one number to tune; none is free of side effects on the snowball.

**Q2 - The KO cliff: soften it or defend it?**
(a) Nothing - deaths SHOULD be decisive; protecting the weakest member is the strategy, and
Bulwark Reflex (Driver) plus BarkShield-type cards are where protection lives. (b) Partial energy
inheritance: the side keeps a stated fraction of the fallen member's energy (e.g. +1e of the lost
2e) - the smallest, most tunable lever, directly shrinking the -33% cliff. (c) Death rattle: a KO
grants the bereaved side a stated, visible one-time effect (draw N / a free cast of one fallen
engine card). Overlaps deliberately with the avenge flavor that already exists (skoll_v1
TREACHERY_KERNEL, WAR FOOTING) - keep them distinguishable. (d) Fallen engines stay first-class:
a designated ally inherits the dead member's STAB/engine (real mechanism work, deck-archetypes).

**Q3 - Comebacks: structural, purchasable, or none?**
(a) Purchasable only: the Revive macro (Rare, market) IS the comeback - is it priced and
distributed well enough to do that job? (b) Structural underdog draw: a side down a member draws
+1 - visible, bounded, no bigger numbers. (c) None: comeback mechanics fight the vision
("difficulty = never stat scaling"; a comeback aura is scaling by another name) - prevention
(shields, heals, positioning of focus) is the intended counterplay.

**Q4 - Is the second issue even a problem?**
Henry, verbatim: *"I'm not sold on this second part... maybe that's the drawback if you want to
focus fire."* If measurement line 4 shows the higher-HP side still wins often, this half closes
with no change. Rule it only after the numbers.

## Interactions to keep in view

- Any change here re-opens the 67/68 boss numbers (SS13) - cheap to re-run per gym, but the
  gauntlet target ruling (HELD until all gyms rebuilt) should land AFTER this ticket's direction
  is known, or explicitly absorb it.
- The mutual-kill draw ruling is still open on deck-archetypes; a death-rattle mechanic touches it.
- The AI's lookahead will exploit whatever is ruled (e.g. splash overkill makes focus fire
  strictly better for the ENEMY too).

## RULED AND SHIPPED, 2026-08-29 — Q2b

Henry, after the six arms: *"okay please implement that change."* Referring to **`energized once`**,
the only arm that met both halves of his stated target.

**THE RULE.** On any KO, every surviving member of the bereaved side gains **one `Energized`**.
Both sides, always. It lives in `effectHandlers.applyBereavementRally`, called from `checkDefeat` —
the single chokepoint every death in the engine passes through, whose three call sites are each
guarded on the alive-to-dead transition, so it fires exactly once per death.

**Measured effect:** comebacks **8.3% -> 16.7%**, battle length **6.5 -> 6.5**, turns after the
first KO **4.3 -> 4.3**. Inside the 15-20% band and length-neutral to a tenth of a turn.

### What was ruled, and what was NOT

| question | status |
| --- | --- |
| **Q2b** partial energy inheritance | **RULED AND SHIPPED** — this rule |
| **Q3b** underdog draw | **RULED OUT by measurement** — a null across four arms |
| Q1 (overkill), Q2a, Q2c, Q2d, Q3a, Q3c | **still open, still unmeasured** |

**The ticket stays OPEN.** Six of its ten options have no numbers and no ruling.

### Three implementation decisions, and why

**Through `EnergizedBehavior.onApply`, not a pushed literal.** That is what builds a well-formed
`StatusEffectInstance` (with its `id`) and what stacks correctly on top of an `Energized` a card
already granted. The measurement harness pushed an object literal with a bogus `duration` field and
no `id` and got away with it because the refill reads only `type` and `stacks` — shipped code does
not get to rely on that. **A deliberate divergence from the measurement:** where a survivor already
holds Energized, the harness granted nothing and the engine adds one. The engine behaviour is the
correct rule; the harness's was an artefact of topping up to a target.

**After `onUnitFainted`, not before**, so those hooks still see the side as it was at the moment of
death.

**PROC-VISIBLE.** The rally writes a combat-log line. Ticket 16's standing law is that no passive is
invisible, and a rule that silently hands out energy is exactly the modifier the vision bans.

### WHAT THIS INVALIDATES — read before trusting any measured number in this repo

The rule changes every battle in which anything dies, which is nearly all of them. Confirmed on a
fixed seed: the same matchup that went **7 turns, PLAYER, losses 2/3** before now goes **6 turns,
ENEMY, losses 3/2**. The winner flipped.

Stale as of this commit:

- **`docs/balance/deck_grid.json`** — all 960 cells, and every band verdict read off it.
- **The gym-boss numbers**, [67](67-enemy-ladder-and-bands.md) SS13 and [68](68-boss-redesign-drivers.md):
  Emberfall's 80.0% prepared / 65.0% control were measured on the old engine. They were already
  stale from the balance merge; this compounds it.
- **`snowball-70.txt` itself.** A no-arm run of `npm run balance:snowball` should now report ~16.7%,
  not 8.3%. **`--energized` now stacks ON TOP of the shipped rule** rather than creating it — the
  CLI header says so.

**Not yet done: a confirming full run.** `npm run balance:snowball -- --iterations 1 --pairs --out
confirm.txt` on the new engine should land near 16.7% with no arm. That is the check that the
shipped rule matches the arm that justified it, and it has not been run.

Gates at the time of the change: `tsc --noEmit -p tsconfig.app.json` clean, `eslint .` at 0,
**140 files / 2001 tests green** — no existing test broke.

## Resolution

_(open)_


## Rulings (Henry, 2026-08-29 grilling — both rounds)

The four measurements were taken (research/70, verified: energy formula and draw formula both
confirmed against `battleReducer`; the "-52.5% compound" framing is corrected to "both pipes shrink
~30% each; true throughput loss lies between -33% and -52% depending on which binds").

1. **Q1 OVERKILL: keep the waste.** Precision is a skill test. Revisit only if the cliff work
   changes the feel.
2. **Q2 KO CLIFF: the death-Energized rule, as a SYMMETRIC ENGINE RULE.** Any side that loses a
   member gains Energized — player and enemy alike. Henry's experiment (Legion) sizes it. The
   **draw-formula patch is the reserved second lever**, built only if Energized is not enough.
   Spec note for the feel pass: Energized is consumed at the next refill, so the base form is a
   one-turn cushion over a permanent cliff. The escalation ladder if "not enough": bigger one-time
   grant → Energized RENEWED each turn a side is down a member (true inheritance) → the draw patch.
3. **"Enough" is ruled by FEEL, not a numeric bar.** Legion reports the new comeback rate
   (baseline 8.3%); Henry plays with the rule on and rules from feel.
4. **Q3 COMEBACKS: Revive stays Rare.** Purchasable comebacks stay premium; no structural
   underdog mechanic.
5. **Q4 RATIFIED AS A NULL and closed.** Starting HP does not predict the winner (50.0%, n=60);
   the focus-fire-drawback reading stands. The panel-ramp sustain probe is SKIPPED.
6. **No concede, no fast-forward.** With comebacks live, watching it slip away is stakes and an
   early concede is often a misplay. No UX ticket.
7. **Driver renames (Overkill Recovery, First Blood) wait for ticket 16.**

Consequence: the death-Energized rule shifts every 3v3 number — all three gym fights re-measure
under it (tickets 71/72 carry this) BEFORE the gauntlet-target ruling, which stays HELD.

Ticket stays OPEN until Henry's feel verdict on the experiment closes Q2.
