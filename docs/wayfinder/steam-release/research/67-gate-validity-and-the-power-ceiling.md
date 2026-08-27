# Why the run-gate numbers do not answer the balance question — and the two design gaps behind that

**For:** the design agent (deck-archetypes map, and whoever rules on ticket 67's residual)
**From:** the steam-release map, session 67-build, 2026-08-26
**Status:** findings, Henry's rulings on the three questions (§9), and the boss diagnostic those
rulings asked for (§10 — **prepared 0/60, control 0/60**). **Nothing has been tuned, and
no card content has been written.** Two sub-questions remain open and are marked as such.

---

## 1. Read this first

The steam-release map has a simulation harness called the **run gate** (`npm run balance:run-gate`).
It plays the game against itself and reports win rates against three ruled targets: **95% against
ordinary wilds, 75% against elites, 60% against each individual gym fight**, at tier 1.

It was run twice this week, before and after ticket 60's enemy-ladder rebuild. The numbers improved a
lot and are still nowhere near the targets.

**This document argues that the gap is mostly not a tuning problem.** The gate is measuring a player
who cannot exist and could not win, and two of the three things a real player does to win are either
unmodelled or absent from the content. Those two things are design decisions, which is why this is
addressed to design rather than filed as a tuning ticket.

The three questions in §7 are the ones that needed ruling before another number was worth taking.
**Henry ruled all three on 2026-08-26 — §9 carries them, and §9 is the section a design agent
should act on. §10 carries the boss diagnostic those rulings asked for, and it is the loudest
single number in this document: a PREPARED player, bringing the counter-element, wins the gym
boss 0 times in 60.** In short: report a control number and a prepared number for every band; add a
power tier of **2–3 anti-boss cards per deck** (24–36 cards); and the 95/75/60 targets grade the
**prepared** player, not the control.

---

## 2. What the run gate does, precisely

One simulated battle:

1. **Start a real run.** Same code path as the player pressing Start Run — a generated region map,
   three biomes, a gym leader.
2. **Walk to a named spot.** e.g. an ordinary wild node in biome 2, or the biome-1 exit elite, or gym
   fight 3.
3. **Ask the game what is standing there.** It calls `rollEncounter` / `rollGauntletFight` — the same
   functions the shipped game calls. Enemy species, decks, firmware and stat rolls are exactly what a
   player would meet on that node.
4. **Build the player's side** as it would be at that depth: 1 member with 8 cards in biome 1, 2 with
   13 in biome 2, 3 with 18 in biome 3.
5. **Play it out.** Both sides driven by the game's own `TacticalAI`.
6. **Record win or loss**, then repeat on a new seed.

Nine spots are measured — wild × 3 biomes, elite × 3 biomes, gym × 3 fights — and grouped into the
three bands. Equal sample count within each band, so a band is the mean of its three spots.

**Two known biases, in opposite directions, both documented in the harness:**

- The simulated player **never shops and never takes reward cards.** It fights with the deck it
  started the biome with. → wild and elite numbers read **low**.
- Each gym fight is played **from full HP**. A real gauntlet is three fights with no healing between
  them. → gym numbers read **high**.

---

## 3. The results

Ticket 60's ladder replaced enemy-difficulty-by-biome-depth with enemy-difficulty-by-node-kind: every
enemy now holds the full tuned deck, and the rung raises **how well it plays it** (wild = no firmware
and no lookahead; elite = firmware + narrowed lookahead; gym = firmware + full lookahead). Enemy stat
rolls were flipped at the same time (wilds now roll *below* the player, elites level with them, the
gym boss has fixed authored stats).

**1,080 battles, 4h 09m:**

| band | target | before the ladder | after | 95% margin |
|---|---|---|---|---|
| WILDS | 95% | 52.8% | **79.5%** | ±3.2 |
| ELITES | 75% | 41.7% | **46.3%** | ±5.6 |
| GYM FIGHTS | 60% | 50.0% | **51.1%** | ±7.2 |

By spot:

| | biome 1 | biome 2 | biome 3 |
|---|---|---|---|
| wilds — before | 67.1% | **26.7%** | 50.0% |
| wilds — after | 73.5% | 79.0% | 86.0% |
| elites — before | 36.9% | 42.5% | 41.7% |
| elites — after | 39.0% | 48.0% | 52.0% |

| gym | fight 1 | fight 2 | fight 3 (boss) |
|---|---|---|---|
| before | 75.0% | 66.7% | 8.3% |
| after | 68.3% | 81.7% | **3.3%** |

Winning all three gym fights in sequence compounds to **~1.8%** — and that is optimistic, because the
harness does not carry HP between fights.

### What is structurally sound in this data

**The difficulty curve is monotonic now, and that result does not depend on any of the objections
below.** Before the ladder, biome 2 was the hardest part of the game — harder than biome 3. The cause
was ticket 08's middle row, which gave biome-2 enemies "the five engine cards alone, no filler": a
*sharper* list than the full tuned deck, not a weaker one. The system intended to make the middle
easier was making it the hardest. That spot moved **+52 points** and both bands now rise with depth
(wilds 73.5 → 79.0 → 86.0; elites 39.0 → 48.0 → 52.0).

Also sound: the relative ordering of the three ladder rungs, and the fact that all of this is measured
against the **worst possible player**, so these figures are a floor.

---

## 4. Finding A — the gate picks the player's team blind to the biome, and type is close to a win condition

`lineupFor()` selects the player's party by walking the 12 tuned firmwares in a fixed stride. It never
consults the biome's element. The gym offer is picked by sample index. **The matchup is arbitrary.**

Measured over 60 samples per spot:

| spot | player has the edge | neutral | enemy has the edge | both sides have an edge |
|---|---|---|---|---|
| wild, biome 1 (solo) | 17 | 23 | 20 | 0 |
| wild, biome 3 | 6 | 0 | 17 | 37 |
| **gym boss** | **7** | 0 | 14 | 39 |

**At the boss, the simulated player brought a type-favourable team 12% of the time.**

That would be a minor sampling note in most games. It is not minor here. From
`combatUtils.ElementalMatrix`'s own header, recording an earlier experiment:

> Measured over 1,440 games per variant, a PERSISTENT MULTIPLICATIVE damage modifier is a win
> condition rather than matchup flavour — it applies to every attack all game… Even 1.05/1.0 still
> produced an **89/11 cross-element split**, and doubling game length did not help.

Type advantage ships at **1.5× on every attack, for the whole battle**. So matchup is very likely the
largest single term in every number in section 3, and the gate is averaging over a lottery on it.

**Consequence:** the absolute numbers, and the boss's 3.3% in particular, cannot currently
distinguish "this fight is too hard" from "the harness almost never brought the right element."

---

## 5. Finding B — there is no power ceiling above the tuned decks

The design intent (as stated to this session) is that a player wins by *building a deck better than
the enemy's*. The content does not currently allow that.

| | count |
|---|---|
| programs in the registry | **216** |
| of those, inside one of the 12 tuned launch decks | **148** |
| outside every tuned deck | **68** |

Rarity exists (94 Common / 73 Uncommon / 45 Rare / 4 Token), so the *axis* is there. What is missing
is a tier of card that is categorically stronger than what a tuned deck already contains. Combined
with the standing ruling that shop stock and reward picks draw from **the current party's own species
pools** (ticket 56), the upgrade pool for a Kraken player is effectively "the Kraken cards you did
not start with."

So a run can build toward **consistency** (more copies of the payoff, fewer generics) and toward
**coverage**, but not toward **power**. The enemy holds the same ceiling the player is climbing
toward — and since ticket 60, the enemy holds it from the first fight.

**What already exists that a power tier could be built from** — cards outside every tuned deck, in
the three EA-launch elements plus generics:

| element | Rare | Uncommon | Common | total |
|---|---|---|---|---|
| Fire | 4 | 3 | 4 | 11 |
| Water | 4 | 2 | 4 | 10 |
| Nature | 4 | 5 | 2 | 11 |
| None (generic) | 0 | 3 | 4+1 token | 8 |

The other 28 off-deck cards belong to elements not shipping at EA (Earth, Air, Ice, Light, Dark).

**Twelve Rare cards across the three launch elements are sitting outside every deck.** That is the
nearest thing to an existing upgrade tier, and it may be enough to prototype one without authoring new
content — or it may not be, which is a design call.

---

## 6. Finding C — the roster is small enough that "bring the counter" is a real constraint

The EA six, and the type triangle they form:

| species | element | firmwares |
|---|---|---|
| fenrir | Fire | `fenrir_v1`, `fenrir_v2` |
| skoll | Fire | `skoll_v1`, `skoll_v2` |
| kraken | Water | `kraken_v1`, `kraken_v2` |
| jormungandr | Water | `jormungandr_v1`, `jormungandr_v2` |
| ratatoskr | Nature | `ratatoskr_v1`, `ratatoskr_v2` |
| huldra | Nature | `huldra_v1`, `huldra_v2` |

Effectiveness among them is a clean cycle: **Fire → Nature → Water → Fire**, each at 1.5×.

Two consequences worth holding while ruling:

- With three party slots, two species per element, and the no-duplicate-species clause, the most a
  player can commit to one element is **two members** (e.g. fenrir + skoll into a Nature biome).
- Being able to bring the counter requires **owning the blueprint**, which drops from fights. So
  "swap the roster for type advantage" is gated on drops the player may not have. Whatever the gate
  models here should reflect that gate, not assume a full roster.

Tuned deck sizes, for reference: 8–11 cards (`kraken_v1/v2` 8, `ratatoskr_v1` 11, the rest 9).

---

## 7. The three decisions

Each of these changes what a "correct" balance number even means. None can be made by an
implementation agent.

> **All three were ruled by Henry on 2026-08-26 — see §9.** The framing below is kept because the
> options and their consequences are what the rulings were made against.

### Q1 — which player should the gate model?

Options, roughly:

- **(a) The prepared player.** Counter-element team where the roster allows, a deck that has been
  shopped and pruned. Measures the ceiling: *can a good player clear this?*
- **(b) The average player.** Today's behaviour — arbitrary matchup, starting deck. Measures the
  floor: *is this survivable without knowing anything?*
- **(c) Both, as two numbers per band.** Costs roughly double the compute; gives a band rather than a
  point, and the width between them is itself the answer to "does preparation matter?"

**This choice will move every band further than anything the ladder rebuild did.** It is currently
(b) by accident rather than by decision.

### Q2 — does the run need a power tier above the base decks?

If "build a deck better than the enemy's" is the intended win path, something has to be better. Sub-
questions the design agent would need to settle:

- Is it **new cards**, or a promotion of the 12 existing off-deck Rares into an upgrade pool?
- Where does it appear — elite rewards only? Marketplace at a premium? Gym clears?
- Does it stay inside the party's species pool (preserving ticket 56's ruling) or break out of it?
- Does the **enemy** ever get it? Ticket 60's ladder deliberately gives every enemy the same deck; a
  power tier the player alone can reach is the first asymmetry in the other direction.

**Card content belongs to the deck-archetypes map**, per the steam-release map's standing scope rule.
This is a request, not a ticket.

### Q3 — are 95 / 75 / 60 still the right targets?

They were ruled against a game whose biome-2 wilds measured 26.7%, and against an unspecified player.
A 95% wild band means losing one ordinary fight in twenty across the ~8–10 a run contains. Worth
re-confirming now that the curve underneath is monotonic and the player being measured is defined.

---

## 8. The cheapest next measurement

**Re-run the gym boss with a deliberately type-favourable team.** Same fight, same fixed boss stats,
only the player's element changes. ~30–40 minutes of compute.

- If it lands near 55%, the boss is fine and Finding A was the whole problem.
- If it lands near 15%, the boss is a genuine wall and needs its own answer.

This is a diagnostic, not a tuning pass, and it discriminates between the two live hypotheses more
cheaply than anything else available.

> **RUN, 2026-08-26 — see §10. Both arms came back 0/60.** The boss is a wall and type advantage
> cannot rescue it; the artefact hypothesis is dead.

---

---

## 9. Henry's rulings on the three questions — 2026-08-26

Recorded verbatim in substance, with the open sub-question and the consequences named underneath
each. **These are directions to build toward, not measurements.**

### Q1 — RULED: report BOTH numbers

> *"We should report both numbers. No type matchup — although I'm not sure what form this control
> takes: same type, mixed type, or remove type adv? The other number is player with matchup adv."*

So the gate grows from three numbers to six: a **control** band and a **prepared** band for wilds,
elites and gym fights.

**The prepared arm is unambiguous:** the player brings the counter-element for the biome, within what
the roster allows (see §6 — two species per element, so a full commitment caps at two party slots).

**The control arm is still open, and it is a real choice.** Three candidate forms, with what each
actually measures:

| control form | multiplier in play | what it isolates | cost | catch |
|---|---|---|---|---|
| **(a) same element** — Fire team into a Fire biome | 1.0× both directions | deck, AI grade and stats, with type genuinely removed | free | **impossible at party size 3** — see below |
| **(b) mixed team** — one of each element | 1.5× in *both* directions at once | a realistic messy team | free | not a control at all; it is "both sides have an edge" |
| **(c) matrix disabled** — flatten the type chart in the harness | 1.0× by force | everything except type, perfectly | small harness change | measures a game that does not ship, and runs different combat code from the treatment arm |
| **(d) today's numbers** — arbitrary lineup, averaged | mixed, unbiased | the population mean over all matchups | already measured | an average, not a neutral — the §4 table shows the mix it rolled |

**The catch on (a), which is the one worth knowing before choosing.** With the EA six there is no
element that is neutral against Fire, Water or Nature except that element itself. Checked against the
matrix: versus a Fire biome, Water and Earth have the edge, Nature and Ice are at a disadvantage, and
only Fire is neutral — and Earth/Ice do not ship at EA. Since there are **two species per element**,
a same-element team is possible at party size 1 and 2 and **impossible at size 3**. A three-member
control would have to be two same-element plus one that necessarily carries a matchup.

**Recommendation, for Henry to confirm or overrule:** run **(a) at party sizes 1 and 2**, and at size
3 use two same-element plus one whose relationship is recorded and reported beside the number rather
than hidden in the average. It keeps the control and the treatment on identical combat code, which
(c) does not, and it measures a team a player could actually field, which (c) also does not. **(d) is
worth keeping as a free third line** — the population mean is the honest answer to "what happens to a
player who does not think about type", and we already have it.

### Q2 — RULED: yes, there is a power tier, and it is anti-boss

> *"Yes, we need to offer a power tier above the base decks. Each deck should have 2-3 cards at launch
> that help you defeat the boss."*

Twelve tuned decks × 2–3 cards = **24 to 36 cards**, at launch. This is the answer to Finding B, and
it is more specific than "make some cards stronger": the tier has a **job**, and the job is the gym.

**Design agent — this is your ticket.** Card content belongs to the deck-archetypes map. What follows
is the material the steam-release side can hand over.

The three boss firmwares that exist today (`src/engine/data/lib/hooks.json`), which is what these
cards have to answer:

| firmware | what the boss does | the lever a counter-card would pull |
|---|---|---|
| `FIRE_RELIC_OS` | At the end of its turn, ignites the field: Fire damage to **your whole party**, scaled by the boss's **Sharp** stacks | strip or prevent Sharp; party-wide mitigation or shields; close before Sharp accumulates |
| `WATER_RELIC_OS` | Whenever its side **takes damage**, the whole enemy team heals 5% max HP | anti-heal / healing prevention; **one big hit instead of many small ones** — chip damage actively feeds it; execute effects |
| `ICE_RELIC_OS` | Your programs aimed at a **poisoned** target cost **+1 energy** | energy generation or cost reduction; cleansing Poison off the target; not routing your win condition through Poison |

Note the third one is pointed at a specific archetype: `jormungandr_v2` is a Poison engine
(contagion / corrosive_bolt / toxic_surge / venom_fang), so ICE_RELIC taxes that deck's whole plan.
Whether that is intended asymmetry or an accident is worth a look while the anti-boss cards are being
written.

Open sub-questions this ruling does not settle, and that the design pass will hit immediately:

- **Where do these cards appear?** Elite rewards only, marketplace at a premium, gym clears, or the
  ordinary pick pool? "At launch" says they exist, not how they are earned.
- **Do they stay inside the party's species pool?** Ticket 56 rules that stock and picks draw from the
  current party's species. Two or three per deck fits that ruling naturally — but it also means a
  player who never fields a Kraken never sees Kraken's anti-boss cards, which may be the point or may
  be a problem.
- **Does the enemy ever get them?** Ticket 60's ladder deliberately gives every enemy the same deck as
  every other. A tier only the player can reach is the first asymmetry pointing the player's way, and
  that is presumably deliberate — worth stating so nobody "fixes" it later.
- **Can the 12 existing off-deck Rares (§5) do this job**, or does this need 24–36 genuinely new
  cards? Four Rares per launch element already sit outside every deck.

### Q3 — RULED: the targets belong to an average PREPARED player

> *"These are the targets for an average prepared player."*

So **95 / 75 / 60 grade the prepared arm**, not the control. The control arm is diagnostic — it says
how much preparation is worth, and it is not expected to hit the targets.

**One definition still needs pinning**, because "average prepared" sits between the two arms as
described above. The reading this note assumes unless corrected:

> **Average prepared** = brings the counter-element where the roster and their blueprints allow, has
> shopped and pruned the deck along the way, and holds the anti-boss cards from Q2 by the time they
> reach the gym — but is not playing a solved, optimal line.

If "prepared" is meant to be *only* the matchup and not the shopped deck, that is a materially easier
bar and the gate should model it differently. Worth one sentence back.

### What these three rulings change about sequencing

1. **The boss diagnostic in §8 is now a pre-check rather than an answer.** It tells us whether the
   boss is a wall *before* the anti-boss cards exist. That is still worth knowing — if the boss is
   winnable at 55% on matchup alone, the Q2 cards are pushing on an open door, and if it is 15% they
   have real work to do. But the number that grades against 60% has to come after Q2 ships.
2. **The gate needs the prepared arm built before any band can be graded.** Until then every number in
   §3 is the control arm by accident.
3. **Q2 is on the critical path to Q3.** The targets describe a player holding cards that do not
   exist yet, so the balance question genuinely cannot be closed before the content lands. That is
   not a delay to route around — it is the actual dependency, and it means the ticket-67 grilling
   should rule on *shape* now and on *numbers* after the cards.

---

---

## 10. THE BOSS DIAGNOSTIC — run 2026-08-26. The answer is unambiguous, and it is the bad branch.

§8 proposed one measurement: re-run the gym boss with a type-favourable team and see whether the
3.3% was a wall or an artefact of the harness's matchup blindness. It has now been run, in both arms
Henry ruled for in §9, plus the blind figure already on record.

**The `--matchup` flag exists now** (`blind` | `favourable` | `control`), so this is the two-arm gate
from ruling Q1 rather than a throwaway script — every future band can be taken both ways.

### The numbers

`gauntlet:fight2`, 60 battles per arm, boss stats fixed at `BOSS_IVS` throughout. Nothing else changed
between arms except which elements the player fielded.

| arm | what the player brought | result | 95% CI |
|---|---|---|---|
| **PREPARED** | counter-element for the champion, no member the champion is strong against | **0/60 — 0.0%** | 0.0–6.0 |
| **CONTROL** | the champion's own element, 1.0× both ways | **0/60 — 0.0%** | 0.0–6.0 |
| blind (earlier run) | arbitrary lineup | 2/60 — 3.3% | 0.9–11.4 |

Pooled across all three arms: **2 wins in 180 battles (1.1%).** Average battle length 5.3 turns.

### What this settles

**The boss is a wall, and type advantage cannot rescue it.** The prepared arm is not better than the
blind arm — it is nominally worse, and the three arms are statistically indistinguishable. The
hypothesis that §4's matchup blindness was hiding a winnable fight is dead.

The 1.5× multiplier is simply not large enough to close this particular gap. A ~5-turn average means
these are **routs, not near-misses**: the boss team removes a party before it can execute, so a damage
multiplier on attacks the player does not live to make changes nothing.

### What this does NOT settle, and the distinction matters

**This is a result about the boss, not about type advantage.** The wild and elite bands have still
only ever been measured blind, and there is every reason to expect the prepared arm to move them a
lot — those are ordinary enemies at 1v1/2v2/3v3, not three champions carrying `boss_relic_*`
firmware. §4's 89/11 finding stands; it just cannot operate on a fight this lopsided.

The two bands worth measuring prepared next are **wilds** and **elites**, and those are where the
prepared-vs-control gap will actually tell us what preparation is worth.

### What it means for the anti-boss cards (§9, Q2)

It sizes the job. Those 2–3 cards per deck are not being asked to shift a 40% fight to 60% — they are
being asked to make a **0%** fight winnable at 60%, against a starting deck, and the loss is a rout
rather than a grind. Three consequences worth putting in front of the design pass:

1. **A percentage-style effect will not do it.** Nothing that scales what the player is already doing
   can move 0% far, because the player is not surviving long enough to do it. The cards likely have
   to change the fight's *shape* — survive the FIRE relic's field ignition, deny the WATER relic's
   heal trigger, escape the ICE relic's energy tax — rather than add throughput.
2. **The boss may need to move too.** `BOSS_IVS` is one authored triple per slot and exists precisely
   so that it can. A 0% fight is a long way from 60%, and asking 24–36 cards to carry all of it is a
   large bet on content that has not been written yet.
3. **The gauntlet compound is the real target.** Fights 1 and 2 measure 68.3% and 81.7% blind. Even
   if the boss reached 60%, clearing all three compounds to ~33%, and HP does not carry in the
   harness so a played run is worse. Whatever "60% per fight" is meant to produce end-to-end should
   be stated explicitly before the cards are designed against it.

### Reproducing

```
npm run balance:run-gate -- --cells gauntlet:fight2 --iterations 60 --matchup favourable
npm run balance:run-gate -- --cells gauntlet:fight2 --iterations 60 --matchup control
```

About 62–66 seconds per battle; roughly an hour per arm, and the two arms run concurrently on two
cores. The report header names the arm, so a pasted number cannot lose it.

---

## 11. Facts appendix

**Targets:** 95% wilds / 75% elites / 60% per gym fight, tier 1, ±5.

**Enemy ladder as built** (`engine/run/encounter.ts`, `ENEMY_LADDER`):

| rung | deck | firmware | AI | stat rolls |
|---|---|---|---|---|
| wild | full tuned | no | greedy (no lookahead) | 0–20 |
| elite | full tuned | yes | lite (narrowed lookahead) | 0–31 |
| gauntlet | full tuned | yes | full lookahead | 0–31; boss fixed at 20/20/20 |

Player stat rolls are 0–31 (mean 15.5), unchanged. Tier 2 turns the wild's firmware on; tier 3 takes
the wild to lite. Nothing scales with biome depth any more.

**Type chart** (attacker → defender, 1.5× where listed, 1.0× otherwise; asymmetric by design):
Fire → Nature, Ice · Water → Fire, Earth · Earth → Fire · Air → Ice · Nature → Water, Earth, Air ·
Ice → Water, Earth · Light → Dark · Dark → Light. Same-element cards also get STAB ×1.5.

**Reproducing the numbers:**

```
npm run balance:run-gate -- --cells wild:biome0,wild:biome1,wild:biome2   --iterations 200
npm run balance:run-gate -- --cells elite:biome0,elite:biome1,elite:biome2 --iterations 100
npm run balance:run-gate -- --cells gauntlet:fight0,gauntlet:fight1,gauntlet:fight2 --iterations 60
```

Two cores, ~4h 09m total. The 1v1 spots take seconds; the 3v3 spots are 27–57s per battle and are the
entire cost. `--cells wild:biome0 --iterations 1200` is 90 seconds if one spot needs deepening.

**Known limits of the harness, beyond Findings A and B:**

- No gauntlet HP carry — gym numbers read high.
- No shopping or reward drift — wild and elite numbers read low.
- Party size is assumed to be biome index + 1; a player who declines both recruits and enters the gym
  solo against three is a harsher case that is not measured.
- `alpha` and `ambush` nodes are graded as wilds; they vary enemy *count* rather than rung, and are
  not sampled as their own band.

**Where the numbers live:** ticket 67 (`docs/wayfinder/steam-release/tickets/67-enemy-ladder-and-bands.md`),
section "THE RE-MEASURE".
