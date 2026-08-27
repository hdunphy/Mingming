# Why the run-gate numbers do not answer the balance question — and the two design gaps behind that

**For:** the design agent (deck-archetypes map, and whoever rules on ticket 67's residual)
**From:** the steam-release map, session 67-build, 2026-08-26
**Status:** findings and open questions. **Nothing here has been decided, and nothing has been tuned.**

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

The three questions at the end are the ones that need ruling before another number is worth taking.

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

---

## 9. Facts appendix

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
