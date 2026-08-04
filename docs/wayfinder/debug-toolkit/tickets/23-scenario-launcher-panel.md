# Scenario launcher panel

- Type: wayfinder:task
- Status: open
- Assignee:
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
