# Engine state actions

- Type: wayfinder:task
- Status: closed
- Assignee: subagent-14-engine-actions (cowork-2026-08-03-opus5)
- Blocked by: — ([Live-manipulation command set](05-live-manipulation-command-set.md) closed)

## Question

Add five general-purpose state actions to the engine. Specified by
[Live-manipulation command set](05-live-manipulation-command-set.md) sections 1–4. Pure engine work
with no debug dependency — it can land before or after the debug layer exists.

Checklist:

- Extend the `BattleAction` union (`battleReducer.ts:38-43`) and add reducer cases for:
  - `SET_VITALS { entityId, hp?, energy?, tempHp?, sourceId }` — HP decrease fires damage-taken
    hooks, increase fires heal hooks; energy and tempHp fire nothing.
  - `REMOVE_STATUS { entityId, status? }` — omit `status` to clear all. Emits `STATUS_REMOVED` and
    runs the removal path, mirroring `battleReducer.ts:683-690`.
  - `ADD_CARD_TO_HAND { side, dataId }` — delegate to `handleGenerateCard`
    (`effectHandlers.ts:573`); do not reimplement hand insertion.
  - `SET_INTENT { entityId, move }` — fires nothing.
  - `KILL_ENTITY { entityId, sourceId }` — full death processing: on-death hooks, XP award,
    `levelUpQueue` (`battleReducer.ts:648`).
- Every damage-ish payload carries `sourceId`; hooks read it for retaliation targeting and on-kill
  credit, so it must be a real entity id, not a sentinel.
- Nothing here is debug-specific and nothing is DEV-gated — these ship. That is the deliberate
  narrowing of [Debug gating architecture](03-debug-gating-architecture.md) section 4 recorded in
  05's resolution.
- Tests: each action's hook firing (and non-firing) asserted; `KILL_ENTITY` awards XP and queues a
  level-up; `REMOVE_STATUS` with and without a type; a hook-cycle case that proves
  `resolutionStackDepth` terminates it (this also retires the `SnapshotPattern.test.ts:132-157` stub
  the audit flagged as gap #16).

Done when: `npx vitest run` + `npx tsc -b` + `npm run build` all green.

## Implementation status — 2026-08-03

Code landed by subagent `a1c63e07ca5aea0c3`; **open until Henry's gates pass.** Five actions added to
the `BattleAction` union and reducer, plus `src/engine/EngineStateActions.test.ts` (22 tests). CRLF
preserved. Verified via the TypeScript compiler API (0 diagnostics) and a transpiled run of the same
22 assertions.

**Correction to [Live-manipulation command set](05-live-manipulation-command-set.md) section 4.**
That resolution said `KILL_ENTITY` requires a `sourceId` because `calculateDeathXp` needs a real
receiver. The receiver reasoning was wrong: `checkDefeat` (`effectHandlers.ts:262`) derives XP
receivers from the **entire alive opposing party** and never reads a source. `sourceId` is still
required and still validated against the battle — it drives kill-credit logging and hook context —
but it is not what makes XP work. The conclusion stands; the stated reason does not.

Other findings:

- **A `SET_VITALS` decrease that reaches 0 also runs `checkDefeat`.** Beyond the ticket's wording, but
  every other damage site does it, and skipping it would leave a 0-HP unit with no XP awarded and no
  `onUnitFainted`. Ordering mirrors `handleAttack`: death processing before `onPostDamage`.
- There is no `onDamageTaken` phase — `onPostDamage` is the only post-hit phase in `HookTypes.ts`, and
  the handler reproduces `handlePlayProgram`'s exact `{source, target}` context so retaliation hooks
  behave identically.
- `REMOVE_STATUS` deliberately omits the Asleep/Stunned StableOS recovery that belongs to natural
  expiry — `handleCleanse`, the other forced-removal path, skips it too.
- `SET_INTENT` takes `IMove | null` so it can clear an intent as well as set one.
- `KILL_ENTITY` on an already-defeated unit is a no-op, so death processing cannot run twice.
- **The `SnapshotPattern.test.ts:132-157` stub can now be deleted** — replaced by a real hook-cycle
  test that runs exactly 12 times (the `MAX_RESOLUTION_DEPTH` cap) and unwinds correctly. Left in
  place deliberately; removing it is a separate call.

## Resolution

**Closed 2026-08-03.** Gates green on Windows. The five general-purpose actions ship, covered by 22 tests including a real hook-cycle test that retires the `SnapshotPattern.test.ts:132-157` stub — deleting that stub is a separate call.
