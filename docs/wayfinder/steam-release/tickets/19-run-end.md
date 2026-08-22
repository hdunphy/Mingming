# Run end: victory and defeat, blueprint bank, run summary, teardown (ticket 19)

- Type: wayfinder:task
- Status: closed
- Assignee: agent
- Blocked by: [12](12-rewards-refit.md), [18](18-gauntlet-refit.md)
- Phase: Vertical Slice

## Deliverable

Replace `resetSave`/`deleteSave`-on-defeat with a run teardown: a summary screen (fights, cards picked, blueprints banked, scrap spent, time), blueprints and codex entries written to the ranch (already banked at drop time — the summary just shows them), tier/gym unlock on victory, then return to the ranch. Defeat loses the run, never the ranch. Abandon-run from the map goes through the same path.

## Done when

Both outcomes land on the ranch with the save intact and the run cleared; the 35–45-minute run clock is recorded per run for playtest telemetry (local only).

## Resolution

**Closed 2026-08-22. The Vertical Slice loop is closed.** Victory, defeat and abandon all land on
the ranch through one teardown. Suite **1380 → 1436**, `tsc -b` clean, build green.

### One path, three endings

`ui/store/runTeardown.ts` is the single `teardownRun`. Victory at the gym, a defeat in any fight and
abandon-from-the-map all go through it, because three separately-written endings are three endings
that drift. Ticket 11's split is kept: `endRun(outcome)` marks the run finished without clearing it —
**this ticket's summary has to read the corpse** — and `clearRun` is the separate step that throws it
away and removes the run save key.

**Teardown is the complete description of what an ending does to the ranch**, which is how "defeat
and abandon unlock nothing" became checkable in one place. The victory unlock is therefore dispatched
**twice on purpose**: `BattleArena` still banks `markGymCleared` / `recordTierCleared` when the win
happens (ticket 12's argument — bank it when it happens, do not wait on a button), and teardown does
it again. Both reducers are idempotent and a test runs teardown twice to prove the recovery is a
no-op.

**The ranch surviving a defeat now has a test**, which is how the bug ticket 11 found stays fixed.

### Two things the summary could not honestly report

- **"Scrap spent" is not derivable and no field was invented.** `IRunState.scrap` is one balance that
  `addRunScrap` and `spendRunScrap` both write; there is no earned total and no spent total anywhere.
  The screen shows the **balance at the end** and says so in those words, and a test asserts the
  string "scrap spent" never appears. Earned is underivable for the same reason.
- **The deck's starting size is also not exact.** A run opens at 8 per member, but a mid-run recruit
  joins with 4 (ticket 14), and nothing records the party size at the start — so `8 x partyIds.length`
  would be a lie for any run that recruited. What *is* exact is `IRunCard.ownerId`, which the ratified
  type reserves as `null` for "bought, drafted or granted". So the summary reports **picked** and
  **kit** cards, they sum to the deck, and "runs open at 8 per member" is printed as the rule rather
  than as a claim about this run.

Every figure on screen carries its target beside it — deck against 20–25, duration against 35–45
minutes, fights against 10–13 — because the summary is the one place the player learns what the
deck-building track was *for*.

### The summary reports; it does not pay

Blueprints were banked as they dropped (ticket 12), and the screen says so. A player who read "you
earned 3 blueprints" and then lost them to a crash on this screen would be right to be angry, and
they cannot.

Getting that line onto the screen needed a provenance the ranch does not keep: `IRanchState.blueprints`
is a bare count with no history and nothing snapshots it at run start. So the run keeps a ledger in
**`IRunState.modifiers`** as `banked:blueprint:<speciesId>` — ticket 15's map-reveal precedent for
using the field the ratified type already has — with duplicates kept, because blueprints are
consumable currency. The ranch credit still goes **first**: a crash between the two costs a line on a
screen, never a blueprint.

### Codex: the honest minimum, and ticket 31 has the rest

Nothing wrote `IRanchState.codex` before this. At teardown the run's card dataIds merge into
`codex.seen`, deduped, via a new ranch reducer. **The seen/played distinction is ticket 31's** —
`played` needs an in-battle hook that does not belong here — and this records only what the run
*held*, so a card bought and later sold is not in it. Both limits are in the comment.

### The run clock — local only, bounded, behind the adapter

Key `mingming_run_telemetry`, through `getSaveStorage()` and **never a save-slot key** (asserted), the
same shape `AudioEngine` uses for `mingming_audio`. That keeps ticket 42's file-backend swap free and
keeps `grep localStorage src` clean.

`{ version: 1, entries: [{ runKey, outcome, startedAt, endedAt, durationMs, fightsResolved, deckSize,
biomeReached, gymId, tier }] }`, zod-validated on read; unparseable, unknown-version and absent all
read as `[]`. Bounded at **50 entries**, trimmed from the front — ticket 25 reads this, and an
unbounded log in a save-sized store is a leak.

Written on summary **mount** rather than at teardown, so the duration is the run and not the run plus
however long the player spent reading. Idempotent on `runKey = seed@startedAt`, which covers
StrictMode *and* an app closed on the summary and reopened. Write failures are swallowed. No
`Date.now()` in `src/engine` — the clock is read once in the component and injected, the same way
`createRun` takes `startedAt`.

### `window.confirm` is gone

Abandon is an inline two-step now ("Abandon run" → "Abandon — the run is lost" / "Keep going"). The
summary is **not** the confirmation: by the time it renders the run has already ended and there is no
button back to the map, so something still has to stand between one stray click and forty minutes.
What that something should not be is a native modal in a game that draws its own UI — unstyleable,
gamepad-unreachable (ticket 38), and untestable.

### Also worth knowing

- **Teardown order is ranch-writes-then-`clearRun`**, argued from what a crash in the middle leaves: a
  re-pressable summary beats an unrecorded gym clear.
- `DECK_TARGET_MIN/MAX` moved out of `MarketplaceNode.tsx` into the engine and are re-exported, so the
  shop and the summary cannot quote different bands.
- `clearRunTelemetry()` exists for tests and debug tools; nothing in the game calls it.


