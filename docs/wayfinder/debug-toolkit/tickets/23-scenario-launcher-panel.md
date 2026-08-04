# Scenario launcher panel

- Type: wayfinder:task
- Status: closed
- Assignee: cowork-2026-08-03-opus5
- Blocked by: [Save slots](24-save-slots.md) ([Scenario launcher UI prototype](04-scenario-launcher-ui-prototype.md) closed)

## Question

Build the launcher as a real debug panel. The visual spec is the approved prototype at
[`prototypes/04-scenario-launcher.html`](../prototypes/04-scenario-launcher.html); the layout
decisions it locks are listed in [ticket 04's resolution](04-scenario-launcher-ui-prototype.md).
Henry approved it as mocked and cut nothing, so v1 covers the whole of `ComposedSetupSchema`.

Checklist:

- `src/debug/panels/ScenarioLauncherPanel.tsx`, registered in `src/debug/panels/index.ts`
  (two steps, no `DebugRoot.tsx` edit — see the ADDING A PANEL note in that file).
- Three-column layout: player | enemies | live `ComposedSetup` JSON, per the prototype.
- Per-unit progressive disclosure: species / level / OS always visible; IVs, `currentHp`,
  starting statuses and (enemies) `maxHpOverride` + deck behind a `▸ more` toggle.
- Real pickers off the live registries — `MingmingRegistry` for species and `availableOS`,
  `programRegistry` for cards, `relicRegistry` for relics, saved decks off the player save.
- `Mirror my save party` preset as the primary player-column action; `Match player level` on
  the enemy column.
- Seed field: blank means roll at launch; `⟳ Roll` pins one and shows it.
- Load `.scenario.json` from disk and save the current composition, routed through
  `loadScenario` / `saveScenario` so the registry-hash warning fires (ticket 02 §2).
- Launch dispatches `setBattleState(buildScenarioState(setup))` and closes the debug layer.
- CARDS-mode warning when enemies exist without decks — the failure mode fixed in `cf7ad48`.
- **Name the destination slot before launching.** Ending a scenario battle writes XP, rewards and
  relics into whatever save slot is active ([Save slots](24-save-slots.md) explains why). The
  launcher must say which slot that is, in plain words, next to the Launch button.

### Changes from the approved prototype

Henry resolved all three of ticket 04's deferred questions on 2026-08-03. The committed mockup
predates these, so where they conflict, this section wins:

- **JSON column gets a show/hide button.** Visible by default, collapsible once the form is trusted.
- **Ad-hoc deck mode is cut.** Deck modes are base decks / saved deck only. The workflow for an
  arbitrary deck already exists end to end: save editor `grant cards` → build and save it in
  `DeckTerminal` (the real deck builder, Milestone 3.1, constrained to `cardInventory`) → pick it
  here under Saved deck. No new deck builder is needed. Drop the prototype's `prompt()` picker.
- **Relics stay in the launcher and take precedence over the save.** This is already how the schema
  behaves — `ComposedSetup.player.relics` is an explicit list, never read from `IPlayerSave` — so
  the launcher is the authority for a scenario's relics and the save editor's grant-relic is for
  ordinary play.

Done when: `npx vitest run` + `npx tsc -b` + `npm run build` all green (the build runs
`assert-no-debug`), and a composed scenario launches into a real battle from the Debug tab.


## Resolution

Implemented 2026-08-03. Verified: `npx vitest run` 53 files / 630 tests green (+30 from this
ticket), `npx tsc -b` clean, `npm run build` clean including `assert-no-debug`.

**Accepted 2026-08-03.** Henry ran the click-through and a composed scenario launches into a real
battle from the Debug tab. The Done-when is met and the ticket is closed.

~~Left open deliberately.~~ The ticket's Done-when includes "a composed scenario launches into a
real battle from the Debug tab", and that cannot be verified without a browser. Everything up to
and including the dispatch is tested against a real store; the React `onClick` wiring is not. See
Outstanding below — closing this is Henry's click-through, not another session's work.

Landed: `src/debug/scenarios/composeScenario.ts` (headless composition — `LauncherDraft`,
registry-backed option lists, `mirrorSaveParty`, `matchPlayerLevel`, `resolveDeck`,
`toComposedSetup`/`draftFromSetup`, `cardsModeWarning`, `launchBlockers`, `destinationSlot`,
`launchScenario`) + 22 tests; `src/debug/panels/ScenarioLauncherPanel.tsx` (controls and `useState`
only) + 8 markup tests; one import and one entry in `panels/index.ts`. `snapshotIO.triggerDownload`
was exported rather than copied. `DebugRoot.tsx` untouched.

Logic was split out of the panel (precedent: `snapshotIO`, `saveSlots`) with `dispatch` passed as a
parameter — the only way to test the launch path given the repo has no `@testing-library/react`.

### The destination-slot warning

`destinationSlot()` reads the active slot at render time and renders a warning banner directly above
Launch: **"This battle will end into your "<name>" save (<slotId>)"**, explaining that finishing
writes XP, rewards and relics there, that `syncPartyStats` matches roster members by id, and that a
mirrored party reuses real ones — with the fix (switch to a scratch slot in the Slots panel). The
slot name is also baked into the button label (`▶ LAUNCH BATTLE INTO <SLOT>`) so it cannot be
scrolled past or mistaken for chrome.

### Deviations beyond the three amendments

- **A third, read-only `loaded` deck mode.** `IPlayerSave` has no deck *library*, only `activeDeck`,
  so a loaded file's arbitrary card list matches neither Base nor Saved. Parking it in a read-only
  mode stops load-then-save silently rewriting the deck. No UI adds cards to it. Loaded per-member
  `moves` carry through verbatim; there is no moveset editor.
- **Launch is disabled with a blocker banner** when the party or enemy list is empty — exactly where
  `buildScenarioState` throws.
- **Blank seed is rolled inside `launchScenario` and pinned back into the field** after a successful
  launch. A scenario you cannot re-run identically is not a repro.
- Status ids are authored (`burn_0`) rather than rolled, so the JSON stays diff-stable.
- Floating presentation stacks to one column; 720px cannot hold three.

### Outstanding — manual acceptance

Open the Debug tab → Launcher, mirror a party, add an enemy, press Launch, confirm a battle starts.
That exercises the only untested hop: `onClick` → the tested functions, plus the `<input type=file>`
read path, the Blob download, `setOpen(false)` collapsing the floating layer, and `App.tsx` swapping
to `BattleArena` once `state.battle.battle` is non-null. **Do it in a scratch save slot.**


### What acceptance found

The click-through failed the first time, and the cause was **not** in this panel. `App.tsx` checked
`rosterSize === 0 → MainMenuView` *before* `isInBattle → BattleArena`, and a fresh save slot starts
from `createDefaultSave()` with an empty roster — so Launch created the battle in the store and then
rendered the main menu over it. Fixed in `9165b46` by making a live battle outrank an empty roster.

That is the audit's blocker #6 (the roster-0 lockout), and it amends
[Debug gating architecture](03-debug-gating-architecture.md) §2's decision to leave the early
returns untouched. That decision held for *reaching* the debug layer — it is hoisted above both
returns — but not for *rendering* a battle composed from an empty-roster slot.

Two usability failures surfaced in the same pass and were fixed rather than documented:

- The banner named the destination slot and then sent you to another panel to change it. The
  Launcher now carries a slot dropdown and `+ new scratch slot` (`2eb08c0`).
- The Slots panel's controls were labelled `new slot` / `create empty` / `branch this run` — the
  panel was searched twice and missed twice. Relabelled to `+ new save slot` / `Create fresh save`
  / `Copy current save`, and creation now works in the floating overlay too (`bd4acb9`).

**This was the first bug found by driving the toolkit rather than by reading code**, which is the
outstanding half of the map's destination.
