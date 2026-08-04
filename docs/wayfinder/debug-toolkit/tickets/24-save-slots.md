# Save slots

- Type: wayfinder:task
- Status: closed
- Assignee: cowork-2026-08-03-opus5
- Blocked by: —

## Question

**This is the guard that stops debug work destroying a real save, and it blocks
[Scenario launcher panel](23-scenario-launcher-panel.md).**

Today there is no isolation at all. Injecting a battle is safe (it only touches `state.battle`),
but when a battle *ends* `BattleArena` dispatches `syncPartyStats` (`:428`), `applyRewardBundle`
(`:443`), `addRelic` (`:445`) and the gauntlet actions into `gameSlice`, and `store.ts:18-31`
autosaves every `state.game` change straight to localStorage. `syncPartyStats` matches by
`member.id`, and the launcher's primary action — `Mirror my save party` — reuses **real roster
ids**, so fabricated levels and XP land on real mingmings. This already applies to the shipped
God Tools and snapshot import, not just the launcher.

Decided 2026-08-03 with Henry: solve it with **multiple save files**, not a single hardcoded debug
key. He wants to spin up a scratch save per scenario, and to branch a copy of a real run to test
what happens after a battle and into the next one. Scope agreed: **engine support plus a
debug-panel switcher now; a player-facing picker in `MainMenuView` is explicitly deferred** and is
game-feature work rather than part of this map.

Effort was measured before choosing: `SAVE_KEY` is one module-level const (`SaveSystem.ts:9`) and
there are six non-test callers — `loadGame` in `App.tsx:55` and `SaveEditorPanel.tsx:167`,
`saveGame` in `store.ts:46`, `deleteSave` in `BattleArena.tsx:343,421` and `HubScreen.tsx:48`.
None of them pass a key, so all six keep their signatures.

Checklist:

- `SaveSystem`: replace the `SAVE_KEY` const with slot-aware key derivation
  (`mingming_save__<slotId>`), plus `listSlots`, `getActiveSlotId`, `setActiveSlotId`,
  `createSlot(name, copyFromSlotId?)`, `renameSlot`, `deleteSlot`. Slot index lives at
  `mingming_saves`.
- `saveGame` / `loadGame` / `deleteSave` / `hasSave` keep their current signatures and operate on
  the active slot, so **`store.ts` needs no edit** and the gate invariant survives.
- Migration: on first read, if legacy `mingming_save` exists and no index does, adopt it as the
  first slot and make it active. **Copy, do not move** — leave the legacy key in place as a
  one-time recovery net.
- Switching slots must clear any live battle (`setBattleState(null)`) before loading the new save,
  or a battle started in slot A can end and write its rewards into slot B.
- Debug-panel switcher: create / switch / duplicate ("branch this run") / rename / delete. Route
  writes through the same `prepareEdit` + `PlayerSaveSchema` dry-run discipline `saveEdit.ts` uses,
  so a bad slot can never wedge autosave silently (audit gap #18).
- Tests: legacy adoption; autosave lands in the active slot only; switching does not cross-write;
  deleting a slot leaves neither an orphaned index entry nor an orphaned key.

Deferred, deliberately: the player-facing slot picker in `MainMenuView` (126 lines today, so it is
mostly new UI).


## Resolution

Implemented 2026-08-03. Verified: `npx vitest run` 51 files / 600 tests green (from 561 — +36 new,
−1 deleted false-cover test), `npx tsc -b` clean, `npm run build` clean including `assert-no-debug`.

Landed: `src/engine/SaveSlots.ts` (key derivation, index, migration, slot CRUD) + 23 tests;
`src/engine/SaveSystem.ts` now addresses `getActiveSaveKey()` with **all four signatures
unchanged**; `src/debug/saveSlots.ts` (Redux-touching ops) + 13 tests against the real app store;
`src/debug/panels/SaveSlotsPanel.tsx` + smoke tests; one import and one entry in `panels/index.ts`.

**`store.ts`, `App.tsx`, `BattleArena.tsx`, `HubScreen.tsx`, `SaveEditorPanel.tsx` and
`DebugRoot.tsx` are byte-identical to before** — verified by diff. The gate invariant and the
no-production-edits property both hold.

### Storage and migration

`mingming_saves` (index) + `mingming_save__<slotId>` (payloads) + `mingming_save` (legacy).

First read after upgrade: no index → create one with slot `slot_1` named "Main", **copy** the legacy
bytes in, mark active, read normally. The player sees their save exactly as before. The legacy key
is never written or removed again — it is a frozen snapshot from the moment slots arrived. Second
launch: index exists, adoption never re-runs. A *corrupt* index is rebuilt, but the legacy copy is
only pasted back when the slot payload is absent, so a corrupt index cannot clobber real progress
with a stale save.

### Cross-write containment

Lives in `switchToSlot` (`src/debug/saveSlots.ts`) — not the panel (a future caller could skip it)
and not the engine (it cannot dispatch). The order **is** the guarantee: vet the target payload
first (a refusal mutates nothing) → `setBattleState(null)` **while the old slot is still active**, so
an in-flight battle cannot survive to end into the new slot → `setActiveSlotId` → immediately
`loadSave` (or `resetSave` for an empty slot), or the previous slot's `state.game` would autosave
into the new key on the next change.

### Judgement calls

- `deleteSave` wipes the active slot's payload but keeps the slot — defeat and hub restart should
  not eject you from the slot you are in. Removing the index entry is `deleteSlot`'s job.
- `deleteSlot` refuses to remove the last slot; an emptied index would be rebuilt by the next read,
  silently re-adopting the legacy save.
- "Branch this run" copies the slot's **stored** bytes, not live state; the panel warns when the
  stored copy is behind live state so a branch is never silently stale.
- Slot ids are `slot_N`, not UUIDs — `crypto.randomUUID` is not guaranteed under plain node, and
  these ids surface in a debug UI where readable beats unique-forever.
- Mid-battle (floating) presentation exposes **switch only**; create/branch/rename/delete are
  docked-only. Switching stays reachable mid-battle deliberately — it is the containment move you
  most want from the battle screen.
- Two `SaveSystem.test.ts` describes gained `beforeEach(localStorage.clear())`. They had relied on
  leftover state; once writing `mingming_save` means "legacy adoption", one read a stale slot. No
  assertions or counts changed — they now genuinely exercise adoption instead of passing by
  accident.
