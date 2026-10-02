# Ticket 172f: the 2026-09-30 Emberfall gauntlet loss

Henry reached the Emberfall gym with Kraken v2, Jormungandr v2 and Sköll v2 and lost gauntlet fight 2. He asked whether he lost fairly or hit a wall, and suggested healing about 10% between gauntlet fights.

## What happened in his run

| Fight | Enemies (firmware, attack/defense/HP IVs) | Result | His HP after (Kraken / Jorm / Sköll) |
|---|---|---|---|
| 1 | Sköll v1 (16/31/30), Fenrir v1 (9/31/29), Ratatoskr v2 (20/19/15) | won, 3 turns | 1110/1110, 1/1350, 81/1185 |
| 2 | Sköll v1 (31/24/29), Fenrir v1 (21/26/19), Ratatoskr v2 (14/31/5) | lost, 2 turns | all 0 |
| 3 (boss) | Fenrir v2, Sköll v2, Huldra v1, all 20/20/20, Driver War Footing | not reached | |

- **Fight 1 cost him two bodies.** On the enemy's first turn about 950 damage went into Jormungandr (12 hits, from all three enemies). Her defense IV is 1 of 31, so she takes more from every hit than any other body on the field. Sköll's attack IV is 1 of 31.
- **Fight 2 started effectively 1 vs 3.** Jormungandr at 1 HP and Sköll at 81 (169 after Mend) both died on the enemy's first turn. Kraken alone lasted one more turn.
- **He held a Revive he could not use.** That was the targeting bug fixed in 172a. With it, one of the two would have come back at half health.
- **Kraken was never hit in fight 1**, in his run and in all 20 replays below. The enemy AI puts its damage into Jormungandr and Sköll.

## The replay

`scratch/t172_gauntlet.ts` plays his exact gate state against the three fights his own run rolls: the 26-card deck, the three members with their IVs and firmware, Amplifier on all three, and the Drivers First Blood, Tenth Strike and Nature. The AI plays both sides; the enemy uses the gauntlet's own AI grade and beam. HP carries between fights the way the game does it, and a member at 0 stays at 0. **No macros are fired**, so Revive and Mend are not used. Between fights, each living member is healed the given percent of max HP. There are 20 samples per row, so each number is roughly ±20 points.

| Heal between fights | Fight 1 | Fight 2 | Boss | Clears the gauntlet |
|---|---|---|---|---|
| 0% (today) | 20/20 | 18/20 | 4/18 | **4/20 (20%)** |
| 10% | 20/20 | 18/20 | 4/18 | **4/20 (20%)** |
| 30% | 20/20 | 18/20 | 7/18 | **7/20 (35%)** |
| 50% | 20/20 | 19/20 | 11/19 | **11/20 (55%)** |
| 100% of living members | 20/20 | 18/20 | 15/18 | **15/20 (75%)** |

The ruled gauntlet target is 60% (`RUN_GATE_TARGETS.gauntlet`).

## Reading

1. **Fight 2 was mostly his fight 1.** The AI, with the same deck and team, wins fight 1 every time and fight 2 18 times in 20. It usually leaves Jormungandr well above half. His line left two members near 0, which the replay's worst cases also do. The team's two 1-of-31 IVs make that line easy to fall into.
2. **The wall is the boss, reached after attrition.** From full health the boss is beaten 15 times in 18. With no healing, the party walks in carrying fights 1 and 2, and it wins 4 of 18. The boss usually finishes a depleted party in 1 to 3 turns.
3. **10% does nothing measurable.** The damage that decides the boss is bodies lost, and a percent heal does not bring anyone back. Around 50% is where this team reaches the 60% target.
4. **The balance tools cannot see this.** The run walker (`runWalker.ts`) plays each gauntlet fight from full HP: it records the carried HP but never feeds it into the next fight's setup. The run gate measures each gauntlet fight on its own. So every gauntlet number in the balance reports is the "100%" row above, not the 0% row the game plays.

## Not measured

- Revive and Mend, which a player would use (the harness fires no macros).
- Other teams, decks or gyms. This is one party at one gate.
- Henry's own play. The AI is both his stand-in and his opponent.
