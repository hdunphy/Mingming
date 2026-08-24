# Run telemetry: log a playtest so it can be analysed after the fact (ticket 59)

- Type: wayfinder:task
- Status: closed
- Assignee: session-59 (run telemetry)
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

**Closed 2026-08-24.** A run now writes a transcript of itself, it survives a reload, it leaves the machine as a file in one click, and a debug panel answers the ticket's three questions from it. 1629 tests green across 123 files; tsc, lint, build and the debug-absence gate clean.

### The shape

`engine/run/runLog.ts` — the rows and the store. `IRunEvent` is a discriminated union over the fourteen classes the deliverable listed, and **every row carries `seq`, `fightIndex`, `deckSize` and `scrap`**. That last part is the design's one real decision: *"when did the deck get big"* and *"where did the scrap go"* are questions about a curve, and a curve you have to reconstruct by interleaving two event streams is a curve nobody plots. Stamped inline, every row is a sample and both curves fall out of one pass with no joining — `runCurves` is a `.map`.

Storage follows `runTelemetry`'s conventions exactly and its header does not repeat them: own key (`mingming_run_log`), through the `ISaveStorage` adapter, never `localStorage`, no clock reads in the engine. It is a **sibling of** `runTelemetry`, not a replacement: that is ten scalars per run fifty runs deep, this is the transcript of one run three deep. Summary and transcript, neither derivable from the other.

**Two bounds, both needed.** `RUN_LOG_EVENT_CAP = 800` bounds one run, `RUN_LOG_RUNS = 3` bounds the store. A single bound big enough for three normal runs is also big enough for one pathological run (a reroll held down) to evict every other run. At the cap a row is **dropped and counted**, not evicted — the questions here are about how a run *develops*, so a head-truncated transcript is useful and a tail-truncated one is not, and `droppedEvents` is what stops the truncation being silent. The panel prints it in warning yellow.

### One writer, and the one thing it cannot see

`ui/store/runLogMiddleware.ts`. A real middleware `concat`ed alongside the tap in `store.ts` — **not** `setActionTap`, which the ticket forbade and `store.ts`'s own docblock explains: one slot, last caller wins, held by the debug action tape. A production consumer there would silently disable the tape, and opening the debug panel would silently disable the log.

Most rows are **derived from what changed**, not announced by call sites. `SCRAP` is the clearest case: nothing dispatches it, the middleware notices `run.scrap` moved and names the action that moved it — so a sink added next month is logged before anyone remembers this file exists. `FIGHT_STARTED` / `FIGHT_ENDED` are state transitions on `battle.battle` rather than actions, because a fight can begin from a node, a gauntlet step or the debug launcher and ends however it got there; `FIGHT_ENDED` reads the **pre**-dispatch board, since by the time the battle is null the turn count and party HP are gone.

The exception is a **declined** card pick. Skipping (ruling 4, the same playtest) lives in `BattleReport`'s component state and reaches no reducer, so from the store's side "three offered, none taken" and "no rewards this fight" are the same silence — and which it was is exactly the question the log exists to answer about deck size. `BattleArena.handleContinue` reports it with `logRunEvent`, a logging-only action no reducer handles. One call site, and it is the only one.

Every branch is wrapped: instrumentation may not break a dispatch. A log that threw while recording a purchase would cost the purchase, which is strictly worse than losing the row. Writes are coalesced onto a microtask; `RUN_ENDED` is written immediately, because the next thing that happens may be teardown or the player closing the game.

### Reload

`setRun` fires on every boot with a run in progress, so the recorder **resumes** rather than starting fresh — and it has to, because `writeRunLog` replaces by `runKey`: a fresh start would not merely split a run's transcript across sessions, it would overwrite the earlier half. `seq` continues from the highest row already stored.

### Out

`ui/settings/exportRunLog.ts` — Settings → **Playtest** → Export run log, above the danger block on purpose (it is the one thing a tester is asked to do; it must not sit one scroll from the wipe). The button names the file it wrote, because "Saved!" with no name is a tester hunting a downloads folder. It does NOT import `debug/snapshotIO.triggerDownload` despite duplicating twelve lines of it: `src/debug` is behind the build gate `scripts/assert-no-debug.mjs` enforces, and a production module importing it would drag the toolkit into `dist/`.

`debug/panels/RunLogPanel.tsx` — run picker, the two curves as inline SVG (no library: lockfile changes are forbidden and this ships in the DEV chunk), scrap by cause, the card flow, and the last 60 raw rows. The deck-size curve prints the 20-25 gate next to the final figure, because a curve with no target is a decoration.

`wipeSave` clears the logs too, and says so.

### Tests, and the one they caught

- `runLog.test.ts` (13) — the cap's direction and its counter, replace-by-`runKey`, the run window, absent/unparseable/version-mismatched all reading as empty, a failed write costing the log and not throwing, the injected export clock, and the three reader functions.
- `runLogMiddleware.test.ts` (10) — a whole run driven through a real store, asserting **all fourteen event classes actually fire**. That assertion exists because the design's risk is a row class nothing emits: the log looks healthy, the panel renders, and a sink is quietly missing.
- `exportRunLog.test.tsx` (3) — clicks the button (jsdom + `createRoot`, ticket 58's harness), disabled with nothing to save, names the file when there is.
- **A wiring test.** Every other case builds its own store, which leaves the failure this ticket is most exposed to uncovered: a middleware that works perfectly and is not in the chain. Verified to fail when the `concat` is reverted.
- **The `REFLASHED` row was wrong before it shipped** and the tests caught it: `game/swapOS` takes `{ id, targetOS }`, not `{ memberId, osId }`. The row recorded two empty strings — a reflash you can see happened and cannot identify, which is worse than no row.

### Deliberately not done

Uploading (ticket 53's, post-launch), replay, and per-hit damage rows — the last one newly cheap thanks to the same day's `damageLedger`, which is exactly why the ticket named it out of scope: the questions here are run-shaped and a per-hit stream would bury them.

### Ticket 25 amended

Its protocol said *"collect snapshot exports on any bug"*. It now says **attach the run log**, once per tester per session, with snapshots kept for bugs (they carry the board; the log does not).

### One flag for Henry

**`RUN_LOG_RUNS = 3` and `RUN_LOG_EVENT_CAP = 800` are mine, not ruled.** Three runs is a guess at "a playtest session is a handful"; if a round-4 tester plays five runs before exporting, the first two are gone. Raising it is one line, and the cost is quota shared with the ranch save — which is the thing the bound exists to protect. Worth a number from you before ticket 25 runs.
