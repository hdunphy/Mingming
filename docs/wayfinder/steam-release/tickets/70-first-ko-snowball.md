# The first-KO snowball: action economy, overkill aversion, and comebacks (ticket 70)

- Type: wayfinder:grilling
- Status: open
- Assignee: 
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
  -33% throughput cliff from a single event.
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

## Resolution

_(open)_
