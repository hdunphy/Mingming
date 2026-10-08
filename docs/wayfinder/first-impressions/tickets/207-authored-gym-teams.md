# Ticket 207: Authored gym teams: the leader's locked team and deck, and its cards in fights 1 and 2 (design)

**Type:** design session with Henry, then a small engine change. Henry reviews every deck list before it reaches the registry. **Status:** **OPENED 2026-10-08** (Henry: *"we probably need to lock in the deck and mingming of each final boss them give some of those cards to flights 1 and 2. Add this as it's own ticket"*); **shape ruled 2026-10-08** (D1); not started. 206 picks the gym setting after this lands (206 D4). Split out of [206](206-gym-difficulty-and-biome-order.md).

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

### How the slots are placed (proposal, for the engine row)

Six slots, three required Instincts. Draw which of fights 1 and 2 gets two of the required Instincts and which gets one (seeded), place them, then roll the remaining three slots from the pool as today. A fight never holds all three required Instincts (a rolled slot in the fight that already has two may not roll the third), so neither can match the leader's trio. A required species need not be in the run's biome pools; it is placed, not drawn. `drawSpecies`'s no-repeat-in-a-fight rule still holds.

## Open questions for the session

1. **Swap or add:** does the leader card replace a card in that enemy's tuned deck (which one?) or get added to it?
2. **Which card per Instinct:** one of the cards already in that Instinct's deck, or a new card authored for the gym?
3. Do the leader's decks follow the same card-count rules as a player deck?

## Rows

| Row | What | State |
|---|---|---|
| 207a | Design session: the three leaders' deck lists, and the leader cards for fights 1 and 2 | Not started; Henry |
| 207b | Engine: authored decks and leader cards in the gym table; fights 1 and 2 place the three leader Instincts (each at least once, never the full trio in one fight) with their leader cards; scout and Driver preview read the table; tests pin each gym's team, deck and placement rule | After 207a |
| 207c | Measure on 206a's bench: the base arm, and the loss rate per fight (fight 3 should be the highest) | After 207b and 206a |

## Interplay with 206

206 picks the gym's setting (IVs, heal, revive) on the bench. This ticket changes the teams that setting is applied to, so (Henry, 206 D4) 206's arms run after this lands.

## Decisions for Henry

1. ~~**D1, fights 1 and 2:**~~ Answered 2026-10-08: a leader card for each Instinct; all three Instincts appear at least once in fights 1 and 2; neither fight is the leader's exact trio; the rest stays rolled.
2. **D2, swap or add,** and **which card per Instinct** (in the session).

## Resolution

Not started.
