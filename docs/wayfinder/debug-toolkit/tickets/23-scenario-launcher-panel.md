# Scenario launcher panel

- Type: wayfinder:task
- Status: open
- Assignee:
- Blocked by: — ([Scenario launcher UI prototype](04-scenario-launcher-ui-prototype.md) closed)

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

Deliberately unresolved, decide while building and note what you chose:

- Whether the JSON column keeps its width or collapses to a toggle once the form is trusted.
- Whether relics belong here, given the save editor already grants them.
- The ad-hoc card picker needs search and duplicate counts; the prototype's `prompt()` is a stand-in.

Done when: `npx vitest run` + `npx tsc -b` + `npm run build` all green (the build runs
`assert-no-debug`), and a composed scenario launches into a real battle from the Debug tab.
