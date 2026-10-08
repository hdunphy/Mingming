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
| 206a | **Measure the gym today:** the full-party gauntlet win rate at tier 0 on the walker, per gym, against the soft 60% target | Not started |
| 206b | **Build the compromise order behind a flag and measure both orders:** per-starter biome reads, full-run walker win rate, where runs end, and the recruits each order hands out | Not started |
| 206c | **The gym knobs, measured one at a time,** for Henry to pick from | Not started |
| 206d | **One agent night** on the configuration Henry picks | After the rulings |

### 206a: The gym today

The walker's gauntlet cells (ticket 77's shape) with a full party of three at tier 0, per gym, against the soft 60% target. Report beside it what the agent did: 55% (plain) and 71% (primed) with three at the gym on 10-08. **Measure with 202b's revive between gym fights in** (Henry, 2026-10-08: it ships before this ticket's tuning; another agent is building it on its own branch). If it has not merged yet, measure on that branch, or wait for the merge, and say which build the numbers come from.

### 206b: The two orders

1. A run option (a flag on `createRun`, or a modifier the walker can set) that swaps `walkOrderFor` for the compromise. The game default stays as it is until Henry rules.
2. Measure both orders:
   - each starter's wild and elite reads in biome 1 and in biome 2;
   - the full-run win rate on the walker (157's 30×12 shape if it is cheap enough, else 12×12);
   - where runs end (biome and node kind);
   - which species the rivals and Trace drops offer in biomes 1 and 2.
3. **Henry's worry, measured.** Under the compromise a Fire starter recruits from the Nature biome first and then meets Fire in half of biome 2. Report how often a recruit made in biome 1 is downed in biome 2, under each order.

### 206c: The gym knobs

Each knob is measured as a single change on 206a's baseline, with the walker's full-party gym win rate. Numbers move in 5s, and no caps (standing rules).

- `BOSS_IVS` (today 20/20/20 for the leader's team).
- `GAUNTLET_HEAL_PERCENT` (today 30).
- The leader's Totem on fights 1 and 2 (today a tier 3 rule only).
- The gauntlet fights' enemy kit size or AI grade (today the full lookahead, beamless).
- 202b's revive floor (it ships first; its floor can still be a knob).

The table goes to Henry. He picks one knob or a pair.

### 206d: The night

A primed night (205b's default) on the 10-04 seeds with the picked configuration. The target is a full-team gym win rate near 60% for the agent.

## Decisions for Henry

1. **D1, the biome order:** today's or the compromise, after 206b's numbers. **Pending Henry's review** (2026-10-08: *"I'll take a look later"*).
2. **D2, the gym knob(s)** from 206c's table.
3. ~~**D3, 202b's revive:**~~ Answered 2026-10-08: it ships **before** this ticket's tuning, from another agent's branch; 206a's baseline includes it.

## Resolution

Not started.
