# Ticket 207: Authored gym teams: the leader's locked team and deck, and its cards in fights 1 and 2 (design)

**Type:** design session with Henry, then a small engine change. Henry reviews every deck list before it reaches the registry. **Status:** **OPENED 2026-10-08** (Henry: *"we probably need to lock in the deck and mingming of each final boss them give some of those cards to flights 1 and 2. Add this as it's own ticket"*); **shape ruled 2026-10-08** (D1); **the three teams picked 2026-10-08**; not started. 206 picks the gym setting after this lands (206 D4). Split out of [206](206-gym-difficulty-and-biome-order.md).

## Why

The gym is meant to be a designed exam. Today only part of it is designed:

- **The leader's team (fight 3)** is authored by species and firmware only (`AUTHORED_BOSSES` in `src/engine/run/bosses.ts`): Emberfall fields fenrir_v2, skoll_v2, huldra_v1; Tidewrack fields jormungandr_v1, kraken_v2, skoll_v2; Rootfall fields huldra_v2, ratatoskr_v2, jormungandr_v2. Its IVs are fixed (`BOSS_IVS`, 20/20/20). Its **decks are not authored**: each member gets that firmware's tuned list from `getDeckForOS`, the same list a wild or elite of that species would hold. So any card change to a species' tuned deck changes the gym too, without anyone deciding that.
- **Fights 1 and 2** are rolled: species drawn from the run's biome pools, a random firmware, IVs rolled from 0–31, and the tuned deck for that firmware (`rollGauntletFight` and `buildEnemy` in `src/engine/run/gauntlet.ts`). Nothing in them points at the leader, so they do not prepare the player for fight 3.

## What this ticket does

Henry (2026-10-08): *"Add some of the leader cards so you get to see them before the fight. This means we need to add leader card for each instinct and then ensure that all three instincts show up at least once in fights one and two but don't let the party be exactly the same as the final 3rd fight. That should be the hardest because it has good synergy."*

1. **Lock in each leader's team:** species, Instinct and IVs per member (as today), plus **an authored deck list per member**, kept in the gym table rather than read from `getDeckForOS`. Changes to a species' normal tuned deck no longer move the gym. Henry reviews and signs off each list in a design session.
2. **A leader card for each Instinct.** Each of the leader's three members has a signature card, named in the gym table: three per gym, nine in all. They are cards that show the leader's plan.
3. **Fights 1 and 2 show all three.** Across the six enemies in fights 1 and 2, each of the leader's three Instincts appears at least once (that species, running that Instinct), and each of those enemies carries its Instinct's leader card. The other slots stay rolled from the pool as today, with rolled IVs.
4. **No preview of the whole team.** Neither fight 1 nor fight 2 fields the leader's exact trio. The leader's team is the only place the three play together, which is what makes fight 3 the hardest.
5. **Fight 3 is the hardest.** Checked on 206a's bench: per gym, the loss rate in fight 3 should be the highest of the three fights. If fight 1 or 2 out-kills the leader, that is a finding to report.
6. **Keep the scout and the telegraph honest.** The gym scout and the elites' Driver preview read the same table (ticket 28a: one gym comp table), so they show the locked team.

### The three teams (Henry, 2026-10-08)

Henry: *"Not sure yet let's pick the Mingmings first."* Each gym keeps its shape: two members of the gym's element plus one guest from the element the gym beats (ticket 28b), and its Totem.

| Gym | Plan | Members (Instinct) | What the decks build toward |
|---|---|---|---|
| **Emberfall** (Fire) | control | fenrir_v2, skoll_v2, **huldra_v2** (guest) | Huldra: Burn for damage and scaling, while building Sharp and Bark Shield. Fenrir and Sköll: control |
| **Tidewrack** (Water) | ramp | kraken_v2, **jormungandr_v2**, **fenrir_v1** (guest) | Early turns get Energized and stack Poison; Jörmungandr scales on the Poison; the late payoff is multi-hit cards for Fenrir and Jörmungandr |
| **Rootfall** (Nature) | zoo | **ratatoskr_v1**, **huldra_v1**, **kraken_v1** (guest) | Apply Dazed; the payoff is cards that scale on cards played |

Bold is a change from today's table (`AUTHORED_BOSSES` in `src/engine/run/bosses.ts`). Today: Emberfall fenrir_v2, skoll_v2, huldra_v1; Tidewrack jormungandr_v1, kraken_v2, skoll_v2; Rootfall huldra_v2, ratatoskr_v2, jormungandr_v2.

What the change does to the tables and tests (for 207b):
- No Instinct is fielded at two gyms any more. skoll_v2 was the one named duplicate (`pathAndScout.test.ts` pins it), so that pin goes.
- jormungandr_v1 leaves the gyms. Its redesign (203) no longer moves the gym.
- The gym biomes' elements do not change: each gym's members keep the same elements (`gymCompElementPlan`), so the approach biomes stay as they are.
- The Rootfall trio is the "Gossip Tide" zoo comp from 140 (ratatoskr_v1, huldra_v1, kraken_v1), which measured strongest of the three proposed comps in the 2026-09-03 round robin (81, on an older build). 207c's per-fight read is where to check that Rootfall is not now much harder than the other two.

**The leader cards:** which card per Instinct is chosen after the deck lists, in the same session. Henry (2026-10-08): *"Not sure yet."*

### How the slots are placed (proposal, for the engine row)

Six slots, three required Instincts. Draw which of fights 1 and 2 gets two of the required Instincts and which gets one (seeded), place them, then roll the remaining three slots from the pool as today. A fight never holds all three required Instincts (a rolled slot in the fight that already has two may not roll the third), so neither can match the leader's trio. A required species need not be in the run's biome pools; it is placed, not drawn. `drawSpecies`'s no-repeat-in-a-fight rule still holds.

## Open questions for the session

1. ~~**Swap or add**~~ Answered 2026-10-08: **case by case**, decided per leader card in the session.
2. **Which card per Instinct:** after the deck lists (*"Not sure yet let's pick the Mingmings first"*).
3. Do the leader's decks follow the same card-count rules as a player deck?

## Rows

| Row | What | State |
|---|---|---|
| 207a | Design session: the three teams (**picked 2026-10-08**), their deck lists (drafted against Henry's plan per gym, then he reviews), and the nine leader cards | Teams done; deck lists next |
| 207b | Engine: authored decks and leader cards in the gym table; fights 1 and 2 place the three leader Instincts (each at least once, never the full trio in one fight) with their leader cards; scout and Driver preview read the table; tests pin each gym's team, deck and placement rule | After 207a |
| 207c | Measure on 206a's bench: the base arm, and the loss rate per fight (fight 3 should be the highest) | After 207b and 206a |

## Interplay with 206

206 picks the gym's setting (IVs, heal, revive) on the bench. This ticket changes the teams that setting is applied to, so (Henry, 206 D4) 206's arms run after this lands.

## Decisions for Henry

1. ~~**D1, fights 1 and 2:**~~ Answered 2026-10-08: a leader card for each Instinct; all three Instincts appear at least once in fights 1 and 2; neither fight is the leader's exact trio; the rest stays rolled.
2. ~~**D2, swap or add:**~~ Answered 2026-10-08: case by case.
3. ~~**D3, the teams:**~~ Answered 2026-10-08: the table above.
4. **D4, the deck lists:** Henry reviews each drafted list.
5. **D5, the leader cards:** one per Instinct, picked after the deck lists.

## Resolution

Not started.
