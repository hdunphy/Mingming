# Gap audit — what the codebase covers and where the gaps are (2026-08-21)

Two read-only sweeps of the tree at the archetype-web merge (`7f6436d`), one over game systems, one over shipping/content/quality. Paths are repo-relative. Counts are from this snapshot and will drift — re-measure before quoting in a later ticket.

## 0. Shape and size

`src/` at depth 2: `assets/battleArt`, `debug/{balance,panels,scenarios,verbs}`, `engine/{actions,ai,core,data,data/lib,sim}`, `ui/{audio,components,hooks,screens,store,utils}`.

| Area | Files | Lines |
|---|---|---|
| `src/engine` (root incl. tests) | 47 | 12,673 |
| `src/engine/actions` (`ActionExecutors.ts`) | 1 | 907 |
| `src/engine/ai` (`TacticalAI.ts`) | 1 | 831 |
| `src/engine/core` | 9 | 1,749 |
| `src/engine/data` | 19 | 3,288 |
| `src/ui/components` | 17 | 4,034 |
| `src/ui/screens` | 7 | 1,905 |
| `src/ui/store` | 7 | 1,213 |
| `src/ui/audio` + `hooks` + `utils` | 11 | 2,122 |
| `src/debug` (all) | 69 | 15,864 |

Largest files: `engine/battleReducer.ts` 1,257; `debug/panels/ScenarioLauncherPanel.tsx` 1,066; `engine/data/mingmingRegistry.ts` 965; `debug/balance/powerscale.ts` 972; `ui/components/BattleArena.tsx` 746; `ui/components/MingmingUnit.tsx` 636; `src/index.css` 2,567 (vs `App.css` 6 lines).

Navigation: `src/App.tsx:36-45`, `type Tab = 'hub'|'terminal'|'battle'|'deck'|'roster'|'lab'|'relic'|'debug'`; `TAB_CONFIG` renders Hub, Terminal, Deck, Roster, Lab, Relics (+ Debug under `import.meta.env.DEV`). Two early returns: `isInBattle → <BattleArena/>`, `rosterSize === 0 → <MainMenuView/>`.

## 1. Run structure — partial stub; the biggest gap

**Exists.** Gauntlet: `IGauntletState { type; element; currentBattleIndex; totalBattles; persistedStats }` (`engine/gameTypes.ts`), reducers `startGauntlet`/`updateGauntlet`/`completeGauntlet` (`ui/store/gameSlice.ts`), 3 fixed battles with HP-only carry-over; tiering hardcoded in `engine/data/battleFactories.ts:150-215` (index 0 = 1–2 procedural grunts, 1 = 3 procedural "Elite", 2 = `wardenPool[0]` at `maxHp × 1.5` with a `boss_relic_*` OS and three generic authored moves, flanked by two "Firewall Sentinel" guards). Sector select: `ui/screens/SectorTerminal.tsx` (279) — 8 element cards, `unlockedSectors` gating (only Fire/Water/Nature start unlocked), one-line flavour each. Encounters: `engine/data/EncounterGenerator.ts` (135), seeded, **level-scaled `avgPlayerLevel ± 2`**, party size `1..playerParty.length`, element-filtered deck of 1 daemon + 9 cards (not the tuned per-OS decks). Rewards: `engine/RewardSystem.ts` (260) — `rollDropTable` (scrap 5–15 per foe, roster-scaled blueprint rate 0.75/0.50/0.15, `SALVAGE_CHOICES_PER_FOE = 3` pick-1-of-3 per foe) and `rollDraftRounds` (gym clear: 3× pick-1-of-3, 70% element bias); UI in `ui/components/BattleReport.tsx` (453), wired from `BattleArena.tsx:395-460`. `completeGauntlet` unlocks the next sector.

**Missing (zero hits in `src/engine` + `src/ui`).** A run object / run slice / run start-end (defeat = `resetSave` + `deleteSave`, `BattleArena.tsx:340`, `HubScreen.tsx:44`); region or node map; difficulty tiers; run modifiers; marketplace/shop/vendor (scrap is spendable only in `SynthesisLab` and `FirmwareTerminal`); named elites, events, workshops. `HubScreen.tsx` (138) is a "QUICK DEPLOY" button with a hardcoded element triangle plus "RESTART RUN (WIPE DATA)". `docs/Epic8_GameLoop.md`'s "Initiation" tutorial battle and "Mirror Rival" are unimplemented.

## 2. Ranch / collection — exists and works, with gaps

`ui/screens/RosterTerminal.tsx` (137): 3 party slots, roster grid, IVs, **XP bar**, active OS, `setActiveParty` (cap 3, no species clause). `ui/screens/SynthesisLab.tsx` (421): blueprint grid → OS pick → `spendScrap(compileCost)` (**flat 100**) → `createMingmingInstance` → `addToRoster`; IV rolls `rng.nextInt(0,31)` per stat via `SeedStream` (`engine/gameTypes.ts`), starters use a 10–15 band; `addToRoster` grants the species+OS base deck once (`deckGrantKey`/`baseDecksGranted`); a "BASE DECK ACQUIRED" reveal sequence. `ui/components/FirmwareTerminal.tsx` (276) + `gameSlice.swapOS`: 1 species blueprint consumed + `OS_SWAP_SCRAP_COST = 25`, first swap opens an `OS_SWAP_PICK_COUNT = 2` kit picker; tested. `ui/components/MainMenuView.tsx` (126): 3 hardcoded starters (kraken/fenrir/ratatoskr). `ui/screens/DeckTerminal.tsx` (498 + 562 CSS): full deck builder with STAB hints and `deckSuggest` — **cards are run-scoped under the rulings, so this screen's role changes**. Codex: missing; nearest are `engine/data/statusGlossary.ts` → `CardKeywordChips.tsx` and `TypeChart.tsx`.

## 3. Economy — partial

Blueprint drops exist (`RewardSystem.rollForEntity`, roster-size-scaled, **dedup'd on `architectureId`** — the opposite of consumable counts). Scrap: `scrapCount`, `addScrap`/`spendScrap`; sources = battle drops + card deconstruction (`getScrapYield`: Common 10 / Uncommon 25 / Rare 50 / Epic 100); sinks = compile, OS swap. Card removal = deconstruction in the Lab, not a run service. Relics: `engine/data/relicRegistry.ts` has 4 (`expansion_slot`, `heatsink`, `buffer_cache`, `overclock_module`); only `DRAW_BONUS`/`ENERGY_CAP_BONUS`/`ATTACK_MULTIPLIER` are applied (`battleFactories.ts:117-140`); `buffer_cache` (`DEATH_PREVENT`) is never read; `RelicTerminal.tsx` (96) is display-only. Potions / consumables / Macros / Drivers: none.

## 4. Persistence — exists and works; the strongest workstream

`engine/SaveSystem.ts` (191): `PlayerSaveSchema` (zod) over `version, roster, activeParty (≤3), cardInventory, activeDeck, scrapCount, blueprints, relics, gauntlet, unlockedSectors, baseDecksGranted`; `CURRENT_SAVE_VERSION = 3`; `migrateSave` v1→v2→v3 before validation; tests in `SaveSystem.test.ts` (254). Autosave: `ui/store/store.ts:43-56`, `store.subscribe` diffing `state.game` → `saveGame`, `console.error` on failure (silent to the player); an `ActionTap` middleware seam. Slots: `engine/SaveSlots.ts` (343) + tests (296): `mingming_saves` index, `mingming_save__<slotId>` payloads, legacy save adopted by copy. Slot/editor UI is debug-only (`debug/panels/SaveSlotsPanel.tsx`, `SaveEditorPanel.tsx`, `debug/saveEdit.ts`, `debug/snapshotIO.ts`). Gaps for Steam: localStorage only; no player-facing slots; `healParty` is a no-op placeholder; `syncPartyStats` persists only `level`/`experience`.

## 5. 3v3 game-side — exists at engine and UI layers

`IBattleState` holds `playerParty`/`enemyParty: ReadonlyArray<IBattleEntity>` and **one deck per side** (`playerDeck`/`enemyDeck: IDeckState`); draw pooled as `Σ cardDraw − partySize + 1` (`battleFactories.ts`). Per-entity `currentEnergy`/`maxEnergy`; `X_COST` resolves against the source; per-unit `maxCardsPerTurn`. Caster allocation: `selectedSourceId` in `battleSlice`; `PLAY_PROGRAM { sourceId, targetId, programId }`; hotkeys `W/E/R` slots, wheel cycles units, `1–9` cards (`BattleArena.tsx:198-250`); `CardHand.tsx` computes cost/STAB/preview against the selected source. **`TRANSFER_ENERGY { sourceId, targetId }`** exists (`battleReducer.ts:42,75`, `battleSlice.transferEnergy`) and is dispatched by no UI — an orphan and an un-ruled mechanic. Targeting: `TargetType = 'Single'|'Self'|'Side'|'All'`, `isValidCardTarget`, drag-line SVG, `BattleStage.tsx` (317), `MingmingUnit.tsx` (636), `UnitFxLayer`, `useBattleVfx` (268); Taunt `forcedTargetId` and `REDIRECT_TARGET` engine-side. `src/debug/balance/teamComps.ts` (221): `REFERENCE_PANEL` (6 comps), `CANARY_COMPS` (21), documents "one member per SPECIES" as an open question — **the species clause is not enforced anywhere in game code**. No shipped path gives a player 3 members early (1 starter; a second body = blueprint + 100 scrap).

## 6. Onboarding — missing

Zero production hits for tutorial/onboarding/first-run. In-context help only: keyword chips, type chart + matchup tooltip, `ui/utils/damagePreview.ts` previews, readiness nags in `SectorTerminal`. No settings screen beyond `AudioControls.tsx` (mute + volume, `localStorage['mingming_audio']`).

## 7. Shipping / packaging — nothing begun

No Electron/Tauri/NW.js/Steamworks anywhere; Steam appears only in prose (`docs/roadmap.md` milestone 5.3 "Steam/Electron Wrap", `docs/Epic5_Spec.md` "redirect LocalStorage to save.json for Steam Cloud", `docs/Epic2_Spec.md` "16:9 Steam Deck and 4:3"). Build: `tsc -b && vite build && node scripts/assert-no-debug.mjs` — the assert walks `dist/` for `__DEBUG_TOOLKIT__` and is the only release gate. `vite.config.ts` `base: '/Mingming/'` (GitHub Pages) breaks `file://`/desktop loads. `.github/workflows/deploy.yml`: push to `main` → build → Pages; no test/lint/typecheck job. `index.html` links `/vite.svg`; `public/` holds only `vite.svg`. No fullscreen/resize handling; keyboard-only input (no Gamepad API). `index.css` roots are `100vw/100vh` with 4 real breakpoints (`max-width:1000px`, `max-height:780px`, `max-width:960px`, one in `DeckTerminal.css`) and many fixed px (`.card 300×115`, portraits `56×56`, `MainMenuView` 280 px cards); `min-height: 440px` is the only floor.

## 8. Art — placeholder grade

`src/assets/battleArt/mingming/`: 13 procedural SVGs at ~1.4–1.9 KB (Audhumbla, Draugr, Fafnir, Gullinbursti, Hel, Hraesvelgr, Huldra, Jormungandr, Nidhoggr, Skoll, Sleipnir, Valkyrie, Ymir) and 3 PNGs (Fenrir 71 KB, Ratatoskr 41 KB, **Kraken 7.37 MB**). Loaded via `new URL(\`../../assets/battleArt/mingming/${artReference}\`, import.meta.url)` in `MingmingUnit.tsx:285` and `BattleStage.tsx:126`. No UI art, icons (emoji nav), backgrounds (CSS gradients), card art (`ProgramCard.tsx` is text + element glyph), logo, title art or VFX sprites. `docs/Art_Prompts.md` (50 lines) is a Midjourney prompt sheet ("Neon Industrial"), stale (names Surtr, counts 114 cards vs 216).

## 9. Audio — SFX exists, music missing

`AudioEngine.ts` (363): procedural Web Audio, lazy `AudioContext` unlocked on first input, no-op under jsdom, settings in localStorage. `limiters.ts` (86): rate limiter + 8-voice pool. `sfxRecipes.ts` (268): 20 SFX (`cardPlay, cardDraw, hit, hitCrit, absorbed, heal, statusApply, death, levelUp, turnPlayer, turnEnemy, victory, defeat, reveal, rewardClaim, stanceDark, stanceLight, discountPrimed, breach, uiClick, uiError`), union-checked complete. Tested (260 lines). No music bus, no tracks, no ducking.

## 10. Content counts

17 registry entries (16 playable + `control`); 216 programs (`programs.json`, 5,832 lines; Fire 32, Nature 29, Air 26, Ice 26, Water 24, Light 24, Dark 20, Earth 19, None 16); 33 OS (`_v1`/`_v2`) + 3 `boss_relic_*` in `lib/hooks.json`; 10 action primitives, 11 constraint primitives; 14 status types; 9 elements (8 + None); 2 tuned decks per species (8–9 cards) inline in `mingmingRegistry.ts`; ~27 3v3 comps in `teamComps.ts`. Gyms/bosses: procedural stand-ins only (see §1). Biomes/regions/events: none. Starters: 3 hardcoded.

## 11. Quality

69 `*.test.ts(x)` files, 228 `describe`, 773 `it`/`test`; 11 `*.balance.ts` on a separate config (30-minute timeouts, writes `docs/balance/*.json`). Engine coverage heavy; UI coverage thin (`App.earlyReturns`, slices, `TypeChart`, `contrastText`, `damagePreview`, `previewParity`); no component tests for `BattleArena`/`CardHand`/`MingmingUnit`. **Preview-parity suite** (`src/ui/utils/previewParity.test.ts`, ticket 104) replays cards through the real reducer on a throwaway state and asserts preview == actual; ~1 s; a standing gate. Committed `test_output.txt` ends "4 failed | 1 passed" — a partial run; CI never proves green. No `ErrorBoundary`; two screens wipe the save with `window.location.reload()`. No telemetry. Accessibility: 7 `aria-*` attributes, 0 `role=`; `motionPrefs.ts` + 3 `prefers-reduced-motion` blocks are the bright spot. Performance risks: `TacticalAI` lookahead per enemy turn (3v3 widens it), framer-motion in 16/24 components, a 7 MB PNG.

## 12. Debug toolkit — the most mature system

`src/debug/` ~4,600 lines of panels/verbs/scenarios. Gated at one edge: `App.tsx:23` `const DebugRoot = import.meta.env.DEV ? lazy(() => import('./debug/DebugRoot')) : null`; `assert-no-debug.mjs` proves absence. 7 panels (Balance, Studio, God Tools, Launcher, Snapshot, Save editor, Slots); god verbs (`setHp, setEnergy, setTempHp, applyStatus, clearStatus, addCardToHand, setIntent, executeIntent, skipTurn, killEntity`); zod-schema'd scenarios with `registryHash` drift detection, action tape, `Ctrl+Shift+E` snapshot export; 26 scenario JSONs. Invariant: nothing outside `src/debug/` imports into it; no `debugSlice`.

## 13. Playtests so far

`playtest-results/round-1/` — 6 snapshot JSONs, no findings file (protocol in `src/debug/scenarios/playtest/round-1/PLAYTEST.md`). Round 2 exists only in prose in the deck-archetypes HANDOFF. `round-3/` — 8 snapshots + `results.txt` (42 lines of Henry's notes; drove the preview-parity work). `docs/bugs.txt` — 69 lines, all sampled items closed. Every round so far tested FIGHTS; no playtest has tested a RUN, because there is no run.

## 14. Docs that are now historical

`docs/roadmap.md` (Unity→React epics, only Epic 1 checked, Steam = unchecked 5.3 "via Electron"); `docs/tech_bible.md` (mandates Zustand; the code is Redux Toolkit); `docs/GDD-lite.md` (still assumes a top-down overworld; silent on release); `docs/Epic8_3_GymGauntlet.md` (faints permanent for the gauntlet — **contradicted** by the 2026-08-20 "revivable, never gone-for-gauntlet" ruling); `docs/Epic7_TerminalLoop.md` (permadeath wipes the save — contradicted by the persistent ranch). Vision.md and the 2026-08-19/20 rulings supersede all of them.
