# Ticket 204: The defeat screen says why when the team was short at the gym

**Type:** one line of on-screen text, game and tool. **Status:** **BUILT 2026-10-07** (`204a`). Written from the review of the 2026-10-07 agent night (`claude/overnight-2026-10-07-review.md` and `-followup.md` in the project). Kept out of [202](202-night-2026-10-06-rulings.md) because another agent is updating 202.

**Why.** Henry asked whether the full-party goal should be "yellow painted" or left for players to discover. The answer given: mostly discovered, through "Party 1 of 3" in the header (202i) and the gym's three element icons on the map (202j), plus one line at the moment of defeat. Across four agent nights, every solo run that reached the gym died in fight 1 within two turns (98 solo runs won 0; 16 party runs won 7). That is a wipe, not the narrow first loss Henry wants, and a wipe with no reason given reads as "the gym is unfair" rather than "I needed a team". Henry: *"Sure add it to the defeat-screen line."*

| Row | What | State |
|---|---|---|
| 204a | The run summary (and the tool's end screen) prints **"You fought the gym's three with one."** (or "two") after a defeat at the gym with fewer than three members | **Built 2026-10-07** |

## 204a: The line

1. **When:** `outcome` is `defeat`, the run ended on the gym node, the run is not the intro, and `partyIds` has fewer than `PARTY_SIZE` members. Not after a win, an abandon, a defeat elsewhere, or with a full team.
2. **Where:** `RunSummary.tsx`, as a fourth large line after "Reached biome ..." (`data-testid="short-handed-line"`). The tool's `endScreen.ts` prints the same words, so an agent that lost that way reads it (and, after 202c, carries it into its second run).
3. **Words:** "You fought the gym's three with one." The number comes from `GAUNTLET_ENEMY_COUNT` and the party count, written as words (`runForecast.word`). No instruction is added: the Den line (202a) and "Party 1 of 3" (202i) say what to do about it.
4. **Code:** `src/engine/run/shortHandedGymLine.ts` (one function), with tests beside it, in `RunSummary.shortHanded204.test.tsx` and in `screens/endScreen204.test.ts`.

## Also answered 2026-10-07, for 202 (another agent is updating it)

- **202 D4 (skoll_v1's kit direction): Howl out, Brute Force in**, as measured in 202d (wild at home 71.1% → 81.6%). Henry: *"Oh sure whatever you proposed here."*
- Henry also said not to disturb the other agent's card changes, so 202k (the kit change itself, in `mingmingRegistry.ts`) was not built here.

## Resolution

204a built 2026-10-07: the engine, the summary and the tool tests pass, eslint and `tsc -p tsconfig.app.json` are clean. Run `npm run gate` on Windows before pushing.
