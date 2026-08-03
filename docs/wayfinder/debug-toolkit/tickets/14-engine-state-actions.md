# Engine state actions

- Type: wayfinder:task
- Status: open
- Assignee:
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
