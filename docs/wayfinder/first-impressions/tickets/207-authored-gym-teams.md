# Ticket 207: Authored gym teams: the leader's locked team and deck, and its cards in fights 1 and 2 (design)

**Type:** design session with Henry, then a small engine change. Henry reviews every deck list before it reaches the registry. **Status:** **OPENED 2026-10-08** (Henry: *"we probably need to lock in the deck and mingming of each final boss them give some of those cards to flights 1 and 2. Add this as it's own ticket"*); not started. Split out of [206](206-gym-difficulty-and-biome-order.md).

## Why

The gym is meant to be a designed exam. Today only part of it is designed:

- **The leader's team (fight 3)** is authored by species and firmware only (`AUTHORED_BOSSES` in `src/engine/run/bosses.ts`): Emberfall fields fenrir_v2, skoll_v2, huldra_v1; Tidewrack fields jormungandr_v1, kraken_v2, skoll_v2; Rootfall fields huldra_v2, ratatoskr_v2, jormungandr_v2. Its IVs are fixed (`BOSS_IVS`, 20/20/20). Its **decks are not authored**: each member gets that firmware's tuned list from `getDeckForOS`, the same list a wild or elite of that species would hold. So any card change to a species' tuned deck changes the gym too, without anyone deciding that.
- **Fights 1 and 2** are rolled: species drawn from the run's biome pools, a random firmware, IVs rolled from 0–31, and the tuned deck for that firmware (`rollGauntletFight` and `buildEnemy` in `src/engine/run/gauntlet.ts`). Nothing in them points at the leader, so they do not prepare the player for fight 3.

## What this ticket does

1. **Lock in each leader's team:** species, firmware and IVs per member (as today), plus **an authored deck list per member**, kept in the gym table rather than read from `getDeckForOS`. A design session where Henry reviews and signs off each list. Changes to a species' normal tuned deck no longer move the gym.
2. **Give some of the leader's cards to fights 1 and 2.** The enemies in the first two fights carry a few of the leader's signature cards, so the player meets the leader's plan before the leader. How many cards, and whether they replace cards in the rolled deck or are added to it, is decided in the session.
3. **Keep the scout and the telegraph honest.** The gym scout and the elites' Driver preview read the same table (ticket 28a: one gym comp table), so they show the locked team.

## Open questions for the session

1. Should fights 1 and 2 keep rolled species, or be authored too? (Henry asked for the cards only; this ticket keeps the rolled species unless he says otherwise.)
2. How many leader cards go into fights 1 and 2, and do they swap in or get added?
3. Do the leader's decks follow the same card-count and payoff rules as a player deck (one payoff per kit is a start-kit rule, not a deck rule)?

## Rows

| Row | What | State |
|---|---|---|
| 207a | Design session: the three leaders' deck lists, and the leader cards for fights 1 and 2 | Not started; Henry |
| 207b | Engine: authored decks in the gym table; fights 1 and 2 take the chosen leader cards; scout and Driver preview read the table; tests pin each gym's team and deck | After 207a |
| 207c | Re-measure: run 206a's gym bench on the base arm again, since locked decks change how hard the gym is | After 207b and 206a |

## Interplay with 206

206 picks the gym's setting (IVs, heal, revive) on the bench. This ticket changes the teams that setting is applied to. 206's D4 asks Henry which comes first.

## Decisions for Henry

1. **D1:** fights 1 and 2: cards only (as asked), or authored species too?
2. **D2:** the number of leader cards in fights 1 and 2, and swap or add (in the session).

## Resolution

Not started.
