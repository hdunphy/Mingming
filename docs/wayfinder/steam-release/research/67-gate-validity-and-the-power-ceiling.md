# Why the run-gate numbers do not answer the balance question — and the two design gaps behind that

**For:** the design agent (deck-archetypes map, and whoever rules on ticket 67's residual)
**From:** the steam-release map, session 67-build, 2026-08-26
**Status:** findings, Henry's rulings (§9), the boss diagnostic (§10), and the isolation arms plus
prepared/control bands ruling R3 asked for (§12 — **the relics are the boss wall, and the wild and
elite bands both PASS for a prepared player**). **Nothing has been tuned, and
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
should act on. §10 and §12 carry the measurements those rulings asked for.**

**§12 is the section to read if you read only one.** Measured properly, against a player who brings
the counter-element: **wilds 95.7% against a 95% target and elites 73.7% against 75 — both PASS.**
The game is not broadly mistuned. **One fight is**: the gym boss sits at 0/60, and isolating its
knobs shows the wall is the `boss_relic_*` firmware, not the stats — halving `BOSS_IVS` buys 1.7
points, switching the relic hooks off buys 58.3. In short: report a control number and a prepared number for every band; add a
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

---

## 12. ISOLATION ARMS AND PREPARED BANDS — run 2026-08-27. Two of three bands already pass.

Ruling R3 (ticket 67) asked for two things as a measurement task: **which knob is the boss wall**, and
**the prepared and control bands for wilds and elites**, which had only ever been measured blind.
Both are below. **Nothing was tuned.** The boss AI grade stays locked at full lookahead per R2, and
`BOSS_IVS` and the relic firmware are untouched in the shipped tree — the two isolation arms are
run-scoped CLI flags (`--boss-ivs`, `--boss-relics off`) precisely so the baseline they are compared
against still exists.

### 12a. The boss isolation — it is the relics, and it is not close

`gauntlet:fight2`, `--matchup favourable`, 60 battles per arm. Everything identical to the 0/60
baseline except the one named knob: same enemy roll, same decks (verified byte-identical), same
player side, same seed.

| arm | what changed | result | 95% CI | vs baseline |
|---|---|---|---|---|
| baseline (§10) | nothing — boss as shipped | 0/60 — **0.0%** | 0.0–6.0 | — |
| **A — stats** | `BOSS_IVS` 20/20/20 → **10/10/10** | 1/60 — **1.7%** | 0.3–8.9 | **+1.7pt** |
| **B — relics** | `boss_relic_*` hooks **off** (tuned OS, same deck) | 35/60 — **58.3%** | 45.7–69.9 | **+58.3pt** |

**Halving the boss's stats does not make the fight winnable. Removing the relic firmware does —
essentially to the 60% target.**

There is a mechanism behind that, and it is worth stating because it means the result is structural
rather than a quirk of this sample: **the relic effects are largely stat-independent by
construction.**

| relic | what it does | what it scales on |
|---|---|---|
| `FIRE_RELIC_OS` | end-of-turn field ignition on the whole player party | the boss's **Sharp stacks** |
| `WATER_RELIC_OS` | heals the enemy team on every damage event its side takes | **5% of max HP** |
| `ICE_RELIC_OS` | player programs aimed at a poisoned target cost +1 | **energy** |

None of the three reads the boss's attack or defence roll. Lowering IVs therefore *cannot* reach
them — and the measurement shows exactly that: arm A's battles ran **longer** than the baseline
(6.2 turns against 5.3) and still lost. A softer boss that grinds the party down the same way.

Arm B's interval is wide (±12.1) because 60 battles is a thin sample for a rate near 50%. The
direction is not in doubt — the two arms do not overlap even slightly — but if the gauntlet target
gets ruled against arm B's *number*, that cell wants deepening first.

### 12b. The prepared and control bands

Wilds at 200 battles per biome, elites at 100, both arms, equal `n` within each band. **1,800
battles.** The blind column is the earlier run (§3), included because the three arms together are
what "how much does preparation buy" actually means.

| band | target | blind | **CONTROL** (type removed) | **PREPARED** (counter-element) | verdict on prepared |
|---|---|---|---|---|---|
| WILDS | 95% | 79.5% | 84.5% (507/600) | **95.7%** (574/600) | **PASS** — CI 93.7–97.0 |
| ELITES | 75% | 46.3% | 53.7% (161/300) | **73.7%** (221/300) | **PASS** — CI 68.4–78.3 |
| GYM BOSS | 60% | 3.3% | 0.0% | **0.0%** (0/60) | FAIL by 55pt |

Per spot, and this is where the story is:

| spot | control | prepared | what preparation is worth |
|---|---|---|---|
| wild, biome 1 (solo) | 74.5% | **97.0%** | **+22.5** |
| wild, biome 2 | 90.5% | 94.0% | +3.5 |
| wild, biome 3 | 88.5% | 96.0% | +7.5 |
| elite, biome 1 (solo) | 37.0% | **61.0%** | **+24.0** |
| elite, biome 2 | 65.0% | 82.0% | +17.0 |
| elite, biome 3 | 59.0% | 78.0% | +19.0 |

### What this settles

**1. Two of the three bands already hit their targets, and the game is not broadly mistuned.**
Wilds 95.7% against 95, elites 73.7% against 75 — both inside the ±5 window, and the wild band is
sampled tightly enough (±1.6) for that verdict to be evidence rather than provisional. Every number
before this was measuring a player who does not think about type.

**2. Preparation is worth 11 points at the wild band and 20 at the elite band** — and it is worth
most exactly where the run is hardest. The two biggest gaps in the table are both the **solo** spot
(+22.5 and +24.0), which is the fight §10 identified as the run's worst position: one mingming,
eight cards, against a full tuned deck. Bringing the counter is what makes that survivable.

**3. The gym boss is now the ONLY failing band**, and 12a says which knob it is. The
"is the whole game too hard" question is answered: no. One fight is.

**4. `BOSS_IVS` is not the lever.** R2 left both stats and relics open. The measurement says stats
buy 1.7 points and relics buy 58.3. Whatever the boss ruling turns out to be, turning the stat knob
is not it.

### What this does NOT settle

- **The gauntlet's first two fights have only ever been measured blind** (68.3% and 81.7%). The
  gauntlet band above is the boss cell alone. A prepared end-to-end gauntlet number needs those two
  re-run, ~2h.
- **Arm B is a diagnostic, not a proposal.** It measures what the fight is worth *without* the relics;
  it does not say the relics should be removed, weakened, or answered with cards. That is R2's open
  ruling and the three options are still live: soften the relics, author cards that answer them, or
  both.
- **The prepared arm still does not shop.** These bands are an un-drifted starting deck plus the
  right elements. A played run's deck is better than this, so the wild and elite numbers remain a
  floor — they are passing from below.
- **Nothing here is measured under a played gauntlet's HP carry.** Every gym number in this document
  still reads high against a real run.

### One harness observation worth recording

The control arm at `wild:biome0` produced **15 stalled battles out of 200** and an average of 8.8
turns, against 4.1 for the prepared arm. Same-element mirrors between two copies of a tuned deck
grind: neither side has the multiplier that closes a game. It does not affect the verdict (a stall
scores as a non-win, which is the conservative direction for a control) but it is why that cell is
the slowest cheap cell in the gate, and it is a small piece of evidence for the 89/11 finding in §4 —
without the multiplier, these decks struggle to kill each other at all.

### Reproducing

```
# 12a — the isolation arms
npm run balance:run-gate -- --cells gauntlet:fight2 --iterations 60 --matchup favourable --boss-ivs 10
npm run balance:run-gate -- --cells gauntlet:fight2 --iterations 60 --matchup favourable --boss-relics off

# 12b — the bands, one cell per invocation (a long multi-cell run risks losing everything to one kill)
npm run balance:run-gate -- --cells wild:biome0  --iterations 200 --matchup favourable   # and control
npm run balance:run-gate -- --cells wild:biome1  --iterations 200 --matchup favourable   # and control
npm run balance:run-gate -- --cells wild:biome2  --iterations 200 --matchup favourable   # and control
npm run balance:run-gate -- --cells elite:biome0 --iterations 100 --matchup favourable   # and control
npm run balance:run-gate -- --cells elite:biome1 --iterations 100 --matchup favourable   # and control
npm run balance:run-gate -- --cells elite:biome2 --iterations 100 --matchup favourable   # and control
```

Both override flags are **run-scoped** and print on the report header, so a pasted number cannot lose
which boss it was measured against. `--boss-ivs` accepts one value or `hp/attack/defense`.

---

## 13. THE REBUILT EMBERFALL — run 2026-08-28. The wall is gone, and the fight overshot the other way.

Ticket 68's build steps 1-6 shipped and step 7 measured them. **No tuning.** `BOSS_IVS` is untouched
at 20/20/20, the boss AI grade is still full lookahead (R2), and nothing in this section proposes a
number. What follows is the rebuilt fight measured against the 0/60 it replaced.

### What changed between §12 and this

§12 established that the `boss_relic_*` stack was the wall — **+58.3pt** from switching the relic
hooks off, against **+1.7pt** from halving `BOSS_IVS`. Henry then reviewed the relic system in
session (it had never been through him) and rebuilt the fight from first principles. Three of ticket
68's rulings decide these numbers:

- **The relics are retired as a concept.** Enemy passives are DRIVERS, side-level, on the same
  machinery as the player's. Ticket 60's *"kit + OS + Driver"* rung is literal now rather than
  aspirational.
- **The boss team is hand-authored and keeps its own firmware.** Emberfall fields fenrir_v1
  (UNBOUND_KERNEL) + skoll_v1 (TREACHERY_KERNEL) + ratatoskr_v2 (INSTIGATOR_OS) — three real tuned
  decks a player could build — with **one** Driver over the side instead of three relics on three
  bodies.
- **WAR FOOTING** is that Driver: *at the end of this side's turn every member gains 1 Strengthened;
  from turn 4 on, 2.*

### A note on what these numbers are OF, because it changed

`gauntlet:fight2` walks all three leaders (`index % 3`), and after ruling 6 **the three leaders are
no longer the same fight** — Emberfall is rebuilt, Tidewrack and Rootfall still field the formula
boss. An unpinned run of that cell blends twenty rebuilt bosses with forty unchanged ones and reports
the average as a number about neither. So this ticket added `--gym`, and arms A, B and D below are
**pinned to `gym_emberfall`**. They are a different POPULATION from §12's, not a deeper sample of it.
The comparison to 0.0% still holds in the only direction that matters: §12's unpinned 0/60 means
every gym was zero, Emberfall included. Arm C keeps the unpinned stride for continuity, and is the
arm to compare against §12 directly.

### 13a. The rebuilt boss

| arm | pinned | result | 95% CI | vs §12's 0/60 | avg turns |
|---|---|---|---|---|---|
| **A** — PREPARED (`--matchup favourable`) | Emberfall | 48/60 — **80.0%** | 68.2-88.2 | **+80.0pt** | 4.1 |
| **B** — CONTROL (`--matchup control`) | Emberfall | 39/60 — **65.0%** | 52.4-75.8 | +65.0pt | 4.5 |
| **C** — PREPARED, all three leaders | no | 14/60 — **23.3%** | 14.4-35.4 | +23.3pt | 5.1 |

Target 60%, window ±5. **The control arm PASSES at 65.0%** (top edge). **The prepared arm — the one
Q3 rules the targets grade — FAILS by 15 points in the OTHER direction.** The fight the whole of this
document has been about being impossible is now, for a prepared player, too easy.

**Arm C is the cross-check, and it lands where the arithmetic says it should.** One rebuilt gym in
three at 80% and two unchanged gyms at 0% predicts 26.7%; the unpinned cell measures **23.3%**, well
inside its interval. Nothing else moved. That is as clean a confirmation as this instrument gives
that the change is confined to the gym ruling 5 authored.

Zero first-turn kills and zero stalls in all 180 battles.

### 13b. The whole gauntlet, prepared, at the authored gym

Ruling 7 asked for fights 1-2 if compute allowed. It did — they are the cheap ones.

| fight | who | result | avg turns |
|---|---|---|---|
| 1 | the leader's team, rolled from the region | 50/60 — **83.3%** | 5.5 |
| 2 | the same, re-rolled | 54/60 — **90.0%** | 4.9 |
| 3 | the authored trio under WAR FOOTING | 48/60 — **80.0%** | 4.1 |

**Compounded: 0.833 x 0.900 x 0.800 = 60.0%** — exactly the gauntlet target, which is a coincidence
worth naming as one rather than reading as a result. It is also **an upper bound**, and by more than
usual: the harness fights each of the three from full HP and a real gauntlet carries damage forward
with no heal between fights. The true end-to-end number is below this, by an amount nothing in this
document has ever measured.

It does settle the shape question R3 deferred, though. Under the old boss the three fights read
68.3 / 81.7 / 3.3 — a cliff. They now read 83.3 / 90.0 / 80.0, which is a gauntlet: three hard fights
of comparable weight, with the boss slightly the hardest of the three.

### What this settles

1. **The wall was the relics, and removing them removed it.** §12's arm B predicted +58.3pt from
   switching the relic hooks off; the rebuilt fight measures **+80.0pt**. More than the isolation
   arm, in the expected direction — arm B stripped the relics and kept the formula team, while this
   replaces the team too.
2. **A boss made of real tuned decks is a legible fight.** 4.1 turns, no stalls, no first-turn kills;
   it resolves the way an ordinary 3v3 does. §12's verdict on the old one was *"not a difficulty
   step, it is a different game"*. That is gone.
3. **Preparation is worth +15.0pt at this boss** — against +20.0 at the elite band and +11.2 at
   wilds (§12b). Type advantage does ordinary work here rather than deciding the fight, which is what
   ruling 3's *"counter to the counter"* third member is for. This is the first evidence it does
   anything: the Nature member is there precisely to tax the Water team a prepared player brings to a
   Fire gym.
4. **The change is contained.** Arm C, and the suite: Tidewrack and Rootfall still roll the formula
   boss, still get three distinct relics, and still carry no Driver.

### What this does NOT settle, and one of them is a decision waiting

- **Whether 80.0% is wrong, and if so which side of it moves.** The target says 60; a prepared player
  measures 80. **That is Henry's call and nothing was turned** — ruling 7 pins `BOSS_IVS` and the AI
  grade for this ticket. The unturned levers, in the order they cost least: `BOSS_IVS` (20/20/20;
  §12 measured it nearly inert against the OLD boss, and ruling 7 explicitly asks for it to be
  re-checked against the new one — that re-check has not been run); WAR FOOTING's numbers; the
  authored composition itself. There is also a fourth option this document should say out loud: **the
  60% target was set against a boss nobody had designed**, and it is as re-openable as the numbers
  are.
- **WAR FOOTING's escalation clause barely fires.** The fight averages 4.1 turns and the clause starts
  at turn 4, so in most battles the Driver is worth exactly 1 Strengthened a round and *"from turn 4
  on, 2"* is decoration. The escalation is built, tested and live — it is why the `turnAtLeast` hook
  condition exists — but at this fight length it is not part of the measured difficulty. If the
  intent was an aura that punishes a long fight, this fight is not long.
- **Tidewrack and Rootfall are unmeasured and unchanged.** Ruling 6 keeps them on the formula boss;
  their 0/60 stands until their own authoring sessions. Arm C is the only number that includes them.
- **Still no HP carry.** Every number here fights from full — see 13b.
- **The prepared arm still does not shop.** An un-drifted starting deck plus the right elements.
- **The final-elite telegraph is unmeasured.** Ruling 4 gives the elites in the gym's own biome the
  gym's Driver; the elite band was not re-run, so what that costs the ELITE rung at Emberfall is
  unknown. It is one cell (`elite:biome2 --gym gym_emberfall`, ~15 min at 100 iterations).

### Reproducing

```
# 13a — the rebuilt boss, pinned. --gym is new in ticket 68.
npm run balance:run-gate -- --cells gauntlet:fight2 --iterations 60 --matchup favourable --gym gym_emberfall
npm run balance:run-gate -- --cells gauntlet:fight2 --iterations 60 --matchup control    --gym gym_emberfall
npm run balance:run-gate -- --cells gauntlet:fight2 --iterations 60 --matchup favourable   # unpinned, arm C

# 13b — the first two fights at the same gym
npm run balance:run-gate -- --cells gauntlet:fight0,gauntlet:fight1 --iterations 60 --matchup favourable --gym gym_emberfall
```

Two lanes, ~2h 40m of wall clock for 300 battles. **One arm per process**, as §12 learned the hard
way: a multi-cell invocation prints its summary only at the end, so a kill mid-flight loses every
cell it had finished. The report header states the pin, the matchup and the boss override, so a
pasted number cannot lose which fight it was measured against.

