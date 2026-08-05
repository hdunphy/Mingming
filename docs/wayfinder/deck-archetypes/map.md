# Deck Archetypes — Wayfinder Map

Label: `wayfinder:map`

**Tracker conventions (local-markdown fallback):** tickets are files in [`tickets/`](tickets/). Each carries `Type` (`wayfinder:research|prototype|grilling|task`), `Status` (`open|closed`), `Assignee` (blank = unclaimed), and `Blocked by` (links). A session claims a ticket by writing its name into `Assignee` before working. The **frontier** is every ticket that is open, unblocked (all Blocked-by closed), and unclaimed. Resolutions are recorded in the ticket's `## Resolution` section on close, and gisted below.

## Destination

Every species ships **per-OS starting decks** — 32 decks across 16 species — each deliberately built so its firmware's mechanic matters in play, every card priced inside the rev-3 power curve (`docs/power_curve_spec.md`), validated by `npm run balance` (with team-battle scenarios where a hook needs allies), and landed in the game's data model as player-facing content. Done when all 32 decks are in the registry, the §2.3 OS Variance Audit measures real firmware gaps (no matchup where one side's hook cannot fire), and the OS-gap redline list reflects firmware, not deck fill.

## Notes

- **Execution override:** like the debug-toolkit map, this map carries implementation — build tickets graduate out of the fog as design tickets resolve.
- **Scope, locked in the charting grilling (2026-08-05, Henry):** all 16 species get the treatment (the three starters' decks are seeds, not sacred — Henry rates fenrir, kraken, maybe ratatoskr and fafnir as the only solid decks today, and even those can be reworked so the 32 land well together). New cards are freely in scope — the thin element pools (Earth/Ice/Light 9 cards, Air 10, Dark 11 vs Fire 20/Nature 20/Water 21) make that unavoidable — but every new or changed card lands on the rev-3 curve (`50×E−10`, the status price table, `BUDGET_BANDS {0:1.0, 1:4.0, 2:9.0, 3+:14.0}` in `src/debug/balance/powerscale.ts`) and is graded by `npm run balance`. Hooks that are structurally dead in 1v1 (skoll_v1, valkyrie_v2, nidhoggr_v2) get **team-battle scenarios**, not redesign-by-default.
- **Why this map exists — the confound, with numbers:** `osVarianceScenario()` hands the same shared `baseDeck` to both firmware variants, and the charting audit found the current §2.3 redlines partly measure dead hooks, not power. kraken_v2 needs a 3e+ Water card (deck max cost: 2 — hook never fires) yet "wins 100%"; hraesvelgr_v1 needs a discard outlet (**zero exist in the whole 111-card pool**) yet v2 "wins 100%"; skoll shows *no* gap because both its hooks are dead in the sim (v1 needs an ally taking damage, v2 needs enemy Burn the deck can't apply); nidhoggr_v2's on-faint hook can't matter in 1v1 yet shows a 40% gap. Current §2.3 run (2026-08-05): 9 species over the 15% cap, three at 100%.
- `docs/NorseExpansion_Full.md` is **inspiration only**: it predates the registry (its Jormungandr archetypes are stun/energy-denial Water, the registry's jormungandr plays Poison; its Surtr slot is now fenrir), and many of its card ideas need mechanics the engine doesn't have (Scrap economy, energy transfer, Ice-vulnerability, discard outlets). The real vocabulary is `ActionType`/`StatusType` in `src/engine/types.ts`. Anything needing new engine work surfaces as its own decision, never assumed.
- **Cross-map:** `docs/wayfinder/power-curve-rebalance/tickets/` 01 (mirror stalemates), 02 (OS variance gaps) and 03 (budget overages) are downstream of this map — deck rebuilds re-baseline their numbers. Don't re-derive their findings; don't fix them there while decks are in flight here.
- Domain: React 19 / TypeScript / Vite / Redux Toolkit; headless engine in `src/engine`. Repo rules: `npx vitest run` + `npx tsc -b` + `npx vite build` before shipping; for balance/deck changes also `npm run balance` and read the `docs/balance/balance_report.json` diff. Never commit `package-lock.json`. Commit author Henry Dunphy <hdunphy15@gmail.com>, CRLF line endings, one commit per ticket (map/ticket edits together with the ticket's code/data). Git lock errors: move lock files into `_to_delete/git-locks/` and retry. All work on branch `card-dev`.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

## Not yet specified

- **The 32 deck designs themselves** — per-species archetype passes, probably batched by element so shared-pool species (sleipnir/hraesvelgr on Air's 10 cards) are designed together. Can't ticket until the [archetype identity template](tickets/04-archetype-identity-template.md) and the enabler matrix from [the firmware audit](tickets/01-firmware-truth-and-enabler-audit.md) land.
- **New-card authoring waves** — which cards, how many, per element; shape depends entirely on the deck designs. Each card rev-3-priced and `npm run balance`-graded.
- **Data-model implementation & migrations** — registry shape for per-OS decks, save migration, scenario schema v2 (the debug-toolkit map already bounded this: `player.deck` moves to `PartyMemberSetup.deck`, version bump, absorbed by `migrateScenario`), launcher/DeckTerminal UI. Waits on [the data-model audit](tickets/02-per-os-deck-data-model-audit.md) and [OS-swap rules](tickets/03-os-swap-deck-rules.md).
- **Balance-suite wiring** — `osVarianceScenario()` handing each side its own deck; team-battle scenario implementation per [ticket 05](tickets/05-team-battle-os-variance-design.md); what §2.3 asserts during the transition while some species still share a deck.
- **Post-rebuild re-baseline** — which of the 9 OS-gap redlines, 7 mirror stalls (kraken/hel/audhumbla at 400/400 draws), and 20 budget overages survive once decks are real; hand back to the power-curve-rebalance tickets.
- **Firmware redesigns, if any** — where [ticket 01](tickets/01-firmware-truth-and-enabler-audit.md) finds a mechanic that's unimplemented, degenerate, or unfeedable even with new cards, changing the firmware itself becomes a decision; not assumed.
- **Playtest & ship criteria** — what Henry actually plays before a deck is "in the game," and whether decks ship per-sector-unlock or all at once.

## Out of scope

- Mirror-stalemate *formula* diagnosis (Regen/BarkShield vs damage-per-turn math) — that's [power-curve-rebalance ticket 01](../power-curve-rebalance/tickets/01-mirror-stalemates.md)'s question; this map only changes what decks those mirrors run.
- Budget fixes for cards no new deck touches — [power-curve-rebalance ticket 03](../power-curve-rebalance/tickets/03-card-budget-overages.md).
- New engine mechanics (Scrap economy, energy transfer, new statuses) unless a ticket here explicitly promotes one — default is no.
- Art, audio, and player-facing deck-builder UI improvements beyond what per-OS decks strictly require.
