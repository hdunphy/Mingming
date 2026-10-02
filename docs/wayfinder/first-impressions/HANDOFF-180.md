# HANDOFF-180 — the agent playtester (ticket 180)

*Last updated: 2026-10-02, after 180f and the tonight checklist. Owned by the playtester agent; the screens agent never edits it, and this file never edits `HANDOFF.md` or `map.md`.*

## Where things stand

- **180a–180f are built and committed** on `first-impressions`: `f081a09`, `ef390fb`, `18e1dbb`, `2bf88fd`, `4001f52`, `a20a47e`. Each had its new tests shown failing on the parent commit and the full gate green. Nothing is pushed.
- **180g (the pilot) is not started.** It plays one seed four times with real model calls, so it spends real tokens. It waits for Henry's go and his choice of starter.
- Everything lives in `src/debug/playtest/` (about 90 files, none over 300 lines), `scripts/playtest-night.mjs`, `docs/playtest/agent-player.md`, and three `package.json` script lines. No game code was changed.

## How to use it

- **First real night:** follow [docs/playtest/run-tonight.md](../../playtest/run-tonight.md). It starts with a one-session trial and says what to look at before the full night.
- **Play by hand:** `npm run playtest -- new --session s1 --seed ps1 --starter <firmware> --gym 0 --mode run`, then `state`, `move <n> --why "..."`, `moves <n,n> --why "..."`, `card <name>`, `note "..."`, `replay --to <n>`. Modes: `run` (the game's AI fights), `turn` (the agent plays whole turns), `card` (one card per call, with `--expect`).
- **Results folder:** a session lives under `results/playtest/` (not committed). Any other folder is `--results <folder>`. It is a flag, not an environment variable, because vite-node empties `process.env` here.
- **A night:** `npm run playtest:night` (10 sessions, tonight's date, model `haiku`, 25 minutes each). `-- --dry-run` prints the plan and each driver command and starts nothing. `-- --runs 2 --model sonnet --date 2026-10-02` are the other flags.
- **The morning report:** `npm run playtest:report -- <date>` writes `docs/playtest/agent-runs/<date>.md` (LF). The nightly script runs it at the end unless `--no-report`.
- **Resuming:** a session with a `driver.json` is finished and skipped; one without is picked up from its saved moves.

## Not yet verified

- **The driver command** (A1): `claude -p --output-format json --model <m> --max-turns 600 --max-budget-usd 3 --tools Bash --permission-mode dontAsk --allowedTools 'Bash(npm run playtest -- *)'`, the prompt on stdin. The night script is tested end to end with a stand-in `claude`, but those flags have never run against the real thing. The pilot is where they are first used.
- **Windows:** the script quotes arguments for `.cmd` shims and kills the whole process tree on timeout, but it was built and tested on Linux.

## What Henry owes

1. **The go for 180g.** The starter is ruled: `kraken_v1` (gym 0, tier 0). It costs real tokens: four runs (`run` and `card` mode, small and stronger model).
2. **The A1 flags** stand or change once the pilot has run them.
3. **The nightly default:** the small model (`haiku`) at ten runs a night, and when to start scheduling it. Nothing is scheduled.
4. **Nothing on ticket 186:** all of it is built except 186b, which waits for evidence.
5. **Whether the report's definitions are what he wants:** `hits` counts hits on enemies only, and `status` and `self` predictions are compared whole (a status the agent forgot to list counts as a miss).

## What the tool found in the game

Ticket [186](tickets/186-playtester-findings.md), built the same day at Henry's word: random ids in the battle engine (186a), damage credited to `SYSTEM` (186e), same-worded map nodes (186c), and the text tool not showing the game's combat log (186d). The crash seen once on seed `ps2` is on watch: the nightly run will flag it as an `engine-error` if it returns. These changed game files (engine: `StatusBehaviors.ts`, `effectHandlers.ts`, `resolutionEngine.ts`; UI: `RegionMap.tsx`, `regionLayout.ts`), by Henry's ruling, with tests.

## Notes for whoever touches this next

- **No on-screen wording is pinned** in tests or in the brief. The screens agent is rewriting copy (182) and renaming words (183h); the tool prints what the game's own modules produce. If a test starts failing after a copy change, it is a bug in the test.
- `PLAYTEST_MAX_TURNS` (60) copies the walker's private `WALK_MAX_TURNS`; a test reads the walker's source and fails if they drift.
- Engine ids are repeatable since 186a (the old `stabilizeIds` renaming is gone). The replay-hash and scripted-turn tests would fail if a random id came back.
- This machine's git quirks (lock and temp files that cannot be unlinked) are in `HANDOFF.md`, "Traps on this machine".
