# Ticket 206: The gym's difficulty and the biome order (design)

**Type:** design and measurement, then Henry rules; no change ships from this ticket without his ruling. **Status:** **OPENED 2026-10-08** (Henry: *"Add a separate design ticket"*); not started. Split out of the 10-08 night review ([205](205-night-2026-10-08-findings.md)).

## Why

On 2026-10-08 the Haiku agent won the gym in 6 of 11 runs that brought a full team on the plain brief (55%), and 12 of 17 on the primed brief (71%). Several winners called the run easy. Henry:

> *"I think we said 60% but that's not a hard rule. We should probably target that for the agent because it appears to play sub optimally. I reach it everytime and win most matches although that's just on tier 0. Still I think we might need to increase the difficulty slight."*

He also proposed a change to the biome order, which could smooth the curve on the way to the gym. That would also help the v1 starters that lose in biome 1 (fenrir_v1, skoll_v1, jormungandr_v1; ticket 203 is Jörmungandr's redesign):

> *"One thing to consider is the biome order. We go mirror element first, which I made that decision because when you do strength first then mirror second … you're a fire starter and you go against grass first. [You] recruit a rat going to biome 2. You face all fire and that wipes out your rat, making biome 2 significantly harder. Or a compromise could be: if you choose fire, you start going against grass, which should also help those other v1 decks losing in biome 1. Then biome 2 would be your element plus where you're starting against, so fire and nature. Then the last matches the gym, so nature and water. That might smooth out the difficulty curve, but we still should address the gym."*

## The two orders

Today (`walkOrderFor` in `src/engine/run/gyms.ts`, Henry 2026-08-30, plus 142 §7's gym biome), shown for a Fire starter at Rootfall:

| | Biome 1 | Biome 2 | Biome 3 (gym biome) | Gym |
|---|---|---|---|---|
| **Today** | Fire (the starter's own: mirror fights) | Nature (the gym's) | Nature + Water (the gym's team) | Nature, Nature, Water |
| **Henry's compromise** | Nature (what the starter beats) | Fire + Nature (the starter's own + biome 1's) | Nature + Water (unchanged) | unchanged |

The same shape for the other two: a Water starter at Emberfall goes Fire → Water + Fire → Fire + Nature. A Nature starter at Tidewrack goes Water → Nature + Water → Water + Fire. Biome 2 becomes a two-element biome, which `IBiome.elements` already allows.

## What is already measured

From the 2026-10-07 run gate (`wild:biome0` and `elite:biome0`, 1,440 samples, the bare 8-card start kit, 1v1, before any pick; skoll_v1 before its 202k kit swap). "Home" is today's biome 1; "favourable" is the compromise's biome 1.

| Starter | Wild, home | Wild, favourable | Elite, home | Elite, favourable |
|---|---|---|---|---|
| fenrir_v1 | 87.8% | 100% | 54.1% | 97.9% |
| skoll_v1 | 71.1% | 100% | 7.5% | 75.7% |
| jormungandr_v1 | 29.7% | 97.2% | 0.0% | 29.4% |
| ratatoskr_v1 | 78.0% | 100% | 53.7% | 93.3% |
| all twelve | 89.3% | 99.5% | 51.9% | 77.5% |

So the compromise clears the 85% wild rule (2026-09-25) for every starter, and lifts the first elite to about the 75% elite target. The other side of it: a 99.5% first biome teaches less, and the run's difficulty moves later, which is where the gym question sits.

## Rows

| Row | What | State |
|---|---|---|
| 206a | **The gym replay bench:** replay the gauntlet with the exact teams and decks the agents brought to the gym, under different settings | Not started |
| 206b | **Build the compromise order behind a flag and measure both orders:** per-starter biome reads, full-run walker win rate, where runs end, and the recruits each order hands out | Not started |
| 206c | **Run the bench's arms** (Henry's list) and report each against the soft 60% target | After 206a |
| 206d | **One agent night** on the configuration Henry picks | After the rulings |

Parked: tuning the Totems' own numbers (Henry, 2026-10-08: *"Ignore this for now, but we could tune the totems themselves try increasing the numbers"*). Moved to its own ticket: locking in each gym leader's team and deck and giving some of its cards to fights 1 and 2 ([207](207-authored-gym-teams.md)).

### 206a: The gym replay bench

Henry (2026-10-08): *"It would be great to measure those with an AI … if we can take the final decks that each AI made it to the gym with and then replay those battles with the different settings."*

1. **The input is real gym arrivals.** These are the agent sessions that reached the gym: 32 on the two 2026-10-08 nights (15 plain, 17 primed), with more from every night after. For each one, rebuild the run at the gym gate with the playtest tool's replay, to the move before `gauntlet:begin`. That gives the party, each member's Instinct, Rune and stats, the deck, the Draughts and the Totems, as the agent built them and after its free gate picks. Convert it to the walker's `GymSnapshot` (`src/debug/balance/gymSnapshot.ts`).
2. **Play the gauntlet from that snapshot** with `playGauntlet` (`src/debug/balance/ghostWalk.ts`), K seeds per team per arm. Use the same seeds in every arm, so the arms are paired. The game AI plays both sides, which is how run mode played these fights on the nights, so the bench measures the same thing the nights did.
3. **Check the bench before trusting it.** The base arm's win rate over the 32 teams should land near what the nights saw: 6 of 11 full teams won on the plain night and 12 of 17 on the primed night. If it does not, find out why before reading any other arm.
4. **Report** per arm:
   - the full-team win rate with a 95% interval, and the same for 2-member teams;
   - per gym;
   - which gym fight each loss came in.
5. **Cost.** A 3v3 gym fight costs 30–70 s on one core (ticket 61's measurement). 32 teams × 5 seeds × 8 arms × up to 3 fights is about 3,800 fights, which is 30 to 70 hours on one core. So the bench runs teams in parallel across worker threads and is a night job on Henry's machine. Start at 3 seeds and add seeds only to the arms that land near 60%.
6. **A small module per job:** the snapshot reader (session → `GymSnapshot`), the arm table, the runner, the report. The arms are named run options read by the gauntlet, never edits to the constants, so the game default is untouched until Henry rules.

### 206b: The two orders

1. A run option (a flag on `createRun`, or a modifier the walker can set) that swaps `walkOrderFor` for the compromise. The game default stays as it is until Henry rules.
2. Measure both orders:
   - each starter's wild and elite reads in biome 1 and in biome 2;
   - the full-run win rate on the walker (157's 30×12 shape if it is cheap enough, else 12×12);
   - where runs end (biome and node kind);
   - which species the rivals and Trace drops offer in biomes 1 and 2.
3. **Henry's worry, measured.** Under the compromise a Fire starter recruits from the Nature biome first and then meets Fire in half of biome 2. Report how often a recruit made in biome 1 is downed in biome 2, under each order.

The bench (206a) cannot measure this row: the biome order changes the teams that reach the gym, so it needs whole runs.

### 206c: The arms (Henry, 2026-10-08)

One change from the base arm each. The base arm is today's game plus 202b's revive, with the revive at the heal's percentage (Henry: *"For simplicity keep this the same % as the heal"*).

| Arm | What changes |
|---|---|
| base | today: leader IVs 20/20/20, fights 1–2 roll their IVs, heal 30%, revive at 30% |
| leader +5 | the leader's team only: `BOSS_IVS` 25/25/25 |
| all +5 | the leader's team 25/25/25, and the enemies in fights 1 and 2 roll their IVs from 5–36 instead of 0–31 (`ENEMY_LADDER.gauntlet.iv`; the gauntlet rung only, since it shares `ELITE_IV` with the elite rung, which stays 0–31). Above 31 is a stat line no player Mingming can roll; if that reads wrong, run 5–31 as well and report both |
| heal 25 | heal 25%, revive 25% |
| heal 20 | heal 20%, revive 20% |
| heal 15 | heal 15%, revive 15% |
| heal 10 | heal 10%, revive 10% |
| revive off | heal 30%, a downed member stays down (today's rule before 202b) |

If one arm lands near 60% for full teams, that is the proposal. If none does, the next step is a pair: the IV arm closest to 60% plus one heal step.

### 206d: The night

A primed night (205b's default) on the 10-04 seeds with the picked configuration. The target is a full-team gym win rate near 60% for the agent.

## Rulings (2026-10-08)

- Target a full-team gym win rate near 60% for the agent; *"that's not a hard rule"*. Henry reaches the gym every time at tier 0 and wins most, and the agent plays below him, so the agent's 60% is the yardstick.
- 202b's revive ships before this ticket's tuning (another agent's branch), and **the revive's HP equals the heal's percentage** (*"For simplicity keep this the same % as the heal"*). That is a ruling for 202b's D1 too; 202b's owner should take it from here.
- Measure the settings by replaying the agents' real gym teams (206a), with the arms above (206c).
- The Totems' own numbers: parked.
- The leader's locked team and deck, and its cards in fights 1 and 2: ticket 207.

## Decisions for Henry

1. **D1, the biome order:** today's or the compromise, after 206b's numbers. **Pending Henry's review** (2026-10-08: *"I'll take a look later"*).
2. **D2, the gym setting(s)** from 206c's table.
3. ~~**D3, 202b's revive:**~~ Answered 2026-10-08: it ships **before** this ticket's tuning, from another agent's branch; 206a's baseline includes it, at the heal's percentage.
4. **D4, order against 207:** pick the setting before or after 207's locked leader decks land? 207 will change how hard the gym is, so a setting picked first may need picking again.

## Resolution

Not started.
