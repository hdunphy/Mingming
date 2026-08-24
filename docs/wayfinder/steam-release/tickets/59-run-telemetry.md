# Run telemetry: log a playtest so it can be analysed after the fact (ticket 59)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [23](23-save-v4.md), [19](19-run-end.md)
- Phase: Vertical Slice

## Why this exists

Henry, after the 2026-08-24 playtest: *"We should record/log everything I do in the playtest run so you can analyze it later."*

He is right that it does not exist, and the gap is wider than it looks. Everything the session found — the mandatory card pick diluting the deck past its own gate, seven fights to afford a 25-scrap recruit, a recruit arriving with three of its five kit cards — was reconstructed from **one sentence of recollection each**, then confirmed by reading the constants. Nobody could answer "how many cards did that run actually end with", "which node kinds did he walk", or "what was his scrap curve", because nothing wrote them down.

## What exists today

- **`engine/run/runTelemetry.ts`** — **ten scalars per FINISHED run**: `runKey`, `outcome`, `startedAt`, `endedAt`, `durationMs`, `fightsResolved`, `deckSize`, `biomeReached`, `gymId`, `tier`. Written once, on `RunSummary` mount. Bounded to the last 50 runs under its own storage key. **No per-fight rows, no purchases, no picks, no route, no party, no HP, no damage. No export path and no viewer** — reading it means opening devtools and pasting `localStorage['mingming_run_telemetry']`. The only other consumer is `wipeSave`, which deletes it.
- **`debug/actionTape.ts`** — every dispatched action, but capped at 256 in a ring buffer, **reset at every battle boundary**, in memory only, and DEV-only. A whole run is never on one tape.
- **`Ctrl+Shift+E`** (`debug/snapshotIO.ts`) — the only file export, and it writes **one `IBattleState`**: a board, not a run. No `IRunState`, no scrap, no deck ledger, no path.

## Deliverable

A per-run **event log** that survives the run and can leave the machine as a file.

1. **An append-only event stream on the run**, one row per thing the player did or was paid: `FIGHT_STARTED` / `FIGHT_WON` (node kind, enemy count, turns, party HP after), `SCRAP` (delta, reason), `CARD_PICKED` / `CARD_SKIPPED` (dataId, the three offered), `CARD_BOUGHT` / `CARD_REMOVED`, `RECRUITED`, `REFLASHED`, `MACRO_BOUGHT` / `MACRO_FIRED`, `NODE_ENTERED` (kind, biome, layer), `RUN_ENDED`. Each row carries the run's turn/fight index and the deck size at the time, because *"when did the deck get big"* is the question the last playtest could not answer.
2. **One writer.** These are already all Redux actions — the `tapMiddleware` seam in `store.ts` exists and is the natural place, but it is the **single-slot `actionTap`** the debug tape holds (see `useCodexRecorder`'s docblock for why that slot is a trap). Either widen the seam to a list or subscribe alongside; **do not take the slot**.
3. **A file the player can send.** A "Export run log" control (settings, or the run summary) writing JSON via the same Blob path `snapshotIO` already uses. A playtester who cannot hand over the log is a playtester describing it from memory, which is what this ticket exists to stop.
4. **A read side.** A debug panel that renders the log of the last run — scrap curve, deck size over fights, what was picked vs skipped vs bought. It does not have to be pretty; it has to make the three questions above answerable in one screen.
5. **Bounded and privacy-clean.** Cap the stream (a run is a few hundred rows; a cap stops a pathological loop filling storage) and keep it to game events — no timestamps finer than the run needs, nothing about the machine. It ships in the build, so it is subject to whatever ticket 54 says about data.

## Explicitly out of scope

- Uploading anywhere. This is a local file the tester attaches to a message. Opt-in remote telemetry is ticket 53's, post-launch.
- Replay. The action tape's header already notes it is *"a readable record, not a re-runnable script"*; determinism work is not this ticket's problem.
- Battle-level detail (per-card damage rows). The `damageLedger` added 2026-08-24 makes that newly cheap, and it is a tempting scope creep — but the questions this ticket must answer are run-shaped, and a per-hit log would bury them.

## Done when

A full run produces a log containing every event class above; the log survives a reload and can be exported to a file in one click; the debug panel answers "how did the deck grow", "where did the scrap go" and "what did he skip" from that file; ticket 25's protocol is amended to say "attach the run log" instead of "collect a snapshot on any bug"; map updated.

## Resolution

_(open)_
