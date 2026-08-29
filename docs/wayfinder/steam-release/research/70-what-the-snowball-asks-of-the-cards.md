# What the first-KO snowball asks of the cards — a report for the deck-archetypes map

**From:** steam-release, ticket [70](../tickets/70-first-ko-snowball.md), measured 2026-08-29.
**For:** the design agent working the deck-archetypes map.
**Status of the ticket:** OPEN. It is a `wayfinder:grilling` and **Henry has not answered any of its
four questions.** This report exists so that when he does, you are not starting from zero — and so
that the one question that is already answered does not get re-litigated.

Nothing here is a ruling. Steam-release measured; what the card pool does about it is yours and his.

---

## 1. The headline

**The first KO is worth 91.7% of the game, and two thirds of the battle is played out after it.**

Henry's play report, 2026-08-28:

> *"The main issue I see in our battles is the first mingming defeated causes a massive advantage
> for the remaining 3 roster… I avoided playing two Stampedes on a mingming because it would have
> overkilled by 40 damage - but then I lost."*

Both halves are now measured, and both are worse than they read.

## 2. The four numbers

60 battles, `REFERENCE_PANEL` round-robin (30 ordered pairs, both turn orders), `maxTurns 40`,
full-lookahead AI on both sides. **Every battle reached a KO**, so nothing rests on a stalled
sample. Reproduce with `npm run balance:snowball -- --iterations 1 --pairs --out <file>`.

| | measure | result |
| --- | --- | --- |
| 1 | **P(win \| scored first KO)** | **91.7%** (n=60) |
| 1 | comeback rate | **8.3%** — 5 battles in 60 |
| 2 | **share of the fight after the first KO** | **66.9%** (4.3 of 6.5 turns) |
| 3 | overkill wasted per battle | **17.8 dmg** = **7.4%** of a side's pool (median 13.5) |
| 4 | **P(win \| higher STARTING HP)** | **50.0%** — a clean null |
| — | members lost by the loser / winner | **3.0 of 3** / 0.9 of 3 |

**Line 2 is the one that changes the framing.** A fast rout would be a balance problem. This is a
*long* decided fight — the player spends the majority of every battle in a position that loses
91.7% of the time, and the game will not end. That is an experience problem, and it is the strongest
argument in the measurement for doing anything at all.

**Line 4 can close with no change.** Henry: *"I'm not sold on this second part as a problem."* He is
right — starting HP does not predict the winner, and that null holds across a genuine spread (comp
pools 217–312, a 43.8% range; median pairwise gap 11.2%, max 35.9%; only 6 of 30 pairs inside 5%).
Stated limit: this is *starting* HP, not a mid-fight lead.

## 3. THE MECHANISM IS TWICE AS STEEP AS THE TICKET SAYS

Ticket 70's engine-facts section lists the energy cliff: *"a 3×2e side runs 6e/turn; after one KO it
runs 4e/turn… a permanent -33% throughput cliff from a single event."* That is correct and it is
**half the story**.

`battleReducer`'s PRE_TURN draw is:

```
totalCardDraw = sum(cardDraw over ALIVE members) - aliveCount + 1
```

So the same death also cuts the hand. Across the six panel comps, **averaged over which member
dies** (not assuming the last one):

| | full | after one KO |
| --- | --- | --- |
| energy | 6–7/turn | **−33.3%** |
| cards drawn | 7–8/turn | **−28.9%** |
| **compound** | | **−52.5%** |

**One death costs a side about half of its turn.** The figure is within a point across all six
comps, so it is a property of the engine's two formulas rather than of any comp.

That is what 91.7% is made of. It is not "a bit of an advantage" — it is halving the opponent's
action economy at a stroke, permanently, in a game whose average fight is 6.5 turns long.

### A note on the merge report's framing

`MERGE-REPORT-balance-to-steam-release.md` §5 lists the 3v2 snowball under *"not started"* and
describes it as **"the absence of any comeback mechanism rather than a resource asymmetry —
`battleReducer` already scales draw from `aliveUnits`, so 7 cards at three bodies, 5 at two, 3 at
one."**

The fact is stated exactly right. The inference is worth a second look: **draw scaling from
`aliveUnits` is not a mitigation of the asymmetry, it is the second half of it.** Fewer bodies draw
fewer cards. Read as compensation it would point away from the resource question; read as a formula
it is −28.9% stacked on top of −33.3%. Both readings can then agree that comeback mechanics are also
missing — but the resource asymmetry is real, large, and measurable, and it is the thing that makes
the comeback hard rather than merely unaided.

## 4. What lands in your scope

Ticket 70's own scope note: *"Anything it decides that touches cards, statuses, OS behaviour or the
AI lands through deck-archetypes coordination."* Mapping its four questions onto that line:

| ticket 70 option | whose | what it would ask of you |
| --- | --- | --- |
| **Q1a** overkill splashes to another enemy | **yours** | A targeting/damage rule. Note it makes focus fire *strictly better*, for the AI too. |
| **Q1b** overkill refunds energy or draws | **yours** | A conversion rule; feeds the snowball through a different pipe. |
| **Q1c** keep the waste | — | No work. Precision stays a skill test. |
| **Q2a** nothing; protection is the counterplay | **yours, and BLOCKED — see §5** | Then Bulwark Reflex and BarkShield-type cards **are** the answer, and their pricing and distribution is the deliverable. |
| **Q2b** partial energy inheritance | engine | The smallest lever. Halves one of the two cliffs. **MEASURED — see §5a. It works.** |
| **Q2c** death rattle | **shared** | Overlaps `skoll_v1` TREACHERY_KERNEL and WAR FOOTING — keep distinguishable. |
| **Q2d** an ally inherits the fallen engine | **yours, and large** | Real mechanism work on STAB/OS ownership. |
| **Q3a** the Revive macro IS the comeback | **yours** | Is it priced and distributed to carry that job? |
| **Q3b** underdog draw (+1 down a member) | engine | Directly edits the formula in §3 — it would cut the −28.9% to roughly zero. |
| **Q3c** none; comebacks fight the vision | — | Defensible: *"difficulty = never stat scaling"*. |

## 5. THREE OF THESE OPTIONS COLLIDE WITH DRIVERS YOU HAVE ALREADY RULED

`macros-and-drivers.md` ruled eight player Drivers. [Ticket 16](../tickets/16-drivers.md) implements
them and is **open, unstarted, and blocked behind your own
[ticket 109](../../deck-archetypes/tickets/109-3v3-pricing-and-canary.md)**. Three of the eight sit
directly on ticket 70's questions, and **two of them are named in a way that will mislead anyone
reading the grilling cold.**

**`Overkill Recovery` — "enemy faints → party heals". Read the effect, not the name.**
In the context of a ticket whose Q1 is *"overkill: forgive, convert, or keep the waste"*, that name
reads as *the wasted damage comes back*. It is not that. As ruled it is an **on-faint heal for the
side that scored the kill** — which, against the 91.7%, is a snowball **amplifier**: the team that
is already winning gets healthier at the exact moment it takes the lead. It is not a candidate for
Q1b; it is arguably a thing Q2 should look at.

**`First Blood` — "each member's first attack per turn +power". Nothing to do with the first KO.**
Pure name collision with this ticket's entire subject. Worth renaming before someone implements one
and discusses the other.

**`Bulwark Reflex` — "member drops below 50% → gains BarkShield, once per fight".**
Ticket 70's Q2a names this correctly: it is where protection lives. **But it does not exist yet.**

**So Q2a is not a "do nothing" option — it is a "build ticket 16" option, and ticket 16 is blocked
behind ticket 109.** If Henry rules Q2a, the answer to the snowball is a Driver layer nobody has
built, gated on the ticket the steam-release HANDOFF already calls the single highest-leverage item
on the board with nine tickets behind it. **109 is on the critical path for this question too**,
which is worth knowing when you decide what to work on next.

## 5a. Q2b HAS BEEN MEASURED, AND IT MOVES THE NUMBER

Henry asked for it directly on 2026-08-29 — *"if an ally dies that side gets a stack of energized,
see if that allows more comebacks"* — and it was run as an arm in the harness (never in
`battleReducer`; the engine is bit-identical). 60 battles per arm, seeded identically to the
baseline.

| | baseline | `once` (one-shot) | `standing` (cliff repaired) |
| --- | --- | --- | --- |
| **comeback rate** | 8.3% (5/60) | 16.7% (10/60) | **20.0% (12/60)** |
| turns after first KO | 4.3 | 4.3 | 3.9 |
| battle length | 6.5 | 6.5 | 6.0 |
| overkill wasted | 17.8 | 22.2 | 21.9 |

**Paired (same battles, one rule changed), McNemar exact: `standing` p = 0.039** — 8 battles flipped
to a comeback, 1 flipped away. `once` is 6:1 in the same direction at p = 0.125, which is
underpowered rather than null, and is what the mechanism predicts: a one-shot grant against a
permanent cliff should do less, and does.

Arm liveness: 269 and 869 stacks granted. Neither run is void.

**Three things in this that bear on your work:**

1. **It repairs only the ENERGY half.** The card cliff (−28.9%) is untouched. So this is *half* a
   repair producing a 2.4x comeback lift — evidence that the resource asymmetry drives the snowball,
   not that energy alone is the whole of it. A full-repair arm has not been run.
2. **It made fights SHORTER** (6.5 → 6.0 turns; 4.3 → 3.9 after the KO), against the intuition that
   helping the loser drags decided fights out. The bereaved side turns it around or dies faster
   either way — so it improves §2's *experience* problem as well as the comeback rate.
3. **It made overkill WORSE** (17.8 → 22.2). More energy means more cards played means more damage
   thrown at nearly-dead units. **So Q1 and Q2 are not independent**: this lever improves Q2's
   problem and mildly worsens Q1's. If they are ruled separately, that interaction is a trap.

**What this does not do:** compare Q2b against Q2a, Q2c, Q2d or the Q3 options. Only one of the ten
has been measured. A ruling that picks Q2b because it is the one with a number attached would be
choosing on availability rather than merit — and the cheapest way to fix that is to run the other
engine-side option (Q3b, underdog draw) through the same harness, which is a few lines and the same
40 minutes.

## 6. The one thing you can act on before Henry rules

**A hypothesis worth testing, not a finding:** `panel-ramp` — the highest HP pool (312) and the
sustain/shield comp — appears in **4 of the 5 comeback battles**, against ~1.7 expected from its
share of the pairs.

At n=5 comebacks that is nowhere near established, and it is offered here as a question rather than
a result. But if it survives `--iterations 5` or a targeted ramp-versus-field run, **Q3 changes
shape entirely**: a comeback mechanism would already exist, it would be called *sustain*, and the
question becomes whether it is priced and distributed to do that job — which is a deck-archetypes
question you can answer without waiting on anyone.

That is the cheapest next measurement in this whole area, and it is yours to take if you want it.

## 7. What NOT to do

**Do not tune cards against the 91.7%.** Every option in §4 changes it, several of them by a lot,
and a card pass costed against the current number would be re-costed the moment Henry rules. The
measurement exists to frame his decision, not to open a balance pass.

**Do not treat line 4 as licence to ignore HP.** It says *starting* HP does not predict the winner.
It does not say HP is worthless — and §6's hypothesis, if it holds, says the opposite about the comp
that has the most of it.

**Do not "fix" overkill in isolation.** 7.4% of a health bar is the visible number; 91.7% is the one
that made Henry's decision wrong. An overkill rule that does not touch the KO cliff moves the small
number and leaves the large one.

## 8. Interactions with your open tickets

- **[119](../../deck-archetypes/tickets/119-side-multiplier-width-blind.md)** — the width-blind ×2.2
  Side multiplier. Anything that changes how often a fight is 3v3 rather than 3v2 changes what Side
  scope is worth, and §3 says a fight spends 66.9% of its turns *after* a body has gone. The five
  ticket-115 cards were measured at 3v3; a large share of their real playtime is not 3v3.
- **[118](../../deck-archetypes/tickets/118-playtest-session.md)** — *"whether coverage-based control
  is fun"* now has a companion question: whether the second half of a decided fight is fun.
- **[120](../../deck-archetypes/tickets/120-consume-aware-pricing.md)** / **121** — untouched by
  this. Listed only so nobody goes looking.

## 9. What was not measured

- **Not a run.** Standalone 3v3s; no HP carries between fights, so nothing here speaks to gauntlet
  attrition. The run gate owns that.
- **Mid-fight HP leads**, per line 4's limit.
- **Ticket 59's run logs** — no player has generated any yet, so the harness is the only source
  with data in it.
- **Which member dies.** The snowball record names the side, not the unit. If "losing your engine
  body" differs from "losing your bruiser", this measurement cannot see it — and that is a plausible
  next instrument if Q2d is ever live.

## 10. How to reproduce

```
npm run balance:snowball -- --iterations 1 --pairs --out snowball-70.txt
```

~40 minutes for 60 battles. `snowball.ts` is the harness, `runSnowball.ts` the CLI, and
`snowball.test.ts` pins the arithmetic against fabricated runs — the ratios cannot be checked any
other way, since a real batch has no known answer.

**One thing to trust deliberately:** overkill comes off `IDamageRecord`, not an HP diff.
`handleAttack` floors HP at zero, so a 60-damage hit on a 5 HP target moves 5 HP — an HP-based
instrument reports ~0 overkill and looks entirely healthy doing it. The ledger records `raw` before
the floor and before shields, and it is per-action, so the harness reads it after every dispatch
including the forced `END_TURN` (a Burn tick killing a unit is a KO like any other).
