# Steam Release — Wayfinder Map

Label: `wayfinder:map` · Branch: `steam-release-prep` · Charted 2026-08-21

**Tracker conventions (local-markdown, same as deck-archetypes):** tickets are files in [`tickets/`](tickets/). Each carries `Type` (`wayfinder:research|prototype|grilling|task`), `Status` (`open|closed`), `Assignee` (blank = unclaimed), `Blocked by` (links, including cross-wayfinder ones) and `Phase`. A session claims a ticket by writing its name into `Assignee` before working. The **frontier** is every ticket that is open, unblocked (all Blocked-by closed) and unclaimed. Resolutions go in the ticket's `## Resolution` on close and are gisted under **Decisions so far**. **One ticket per session.**

## Destination

Mingming is on sale on Steam — a shipped desktop build of the ruled game (expedition roguelike: three two-element biomes, an explorable region graph, 1→2→3 recruiting into a shared deck, a three-fight no-heal gauntlet, a persistent ranch fed by consumable blueprints, no leveling) with a store page, achievements, cloud saves, a demo that has been through Steam Next Fest, and at least **10 Steam reviews** within the first months. Release shape (Early Access vs 1.0) is decided in [Release shape](tickets/05-release-shape.md) — this wayfinder's recommendation is **Early Access**, see below. Success, per Henry (2026-08-21): *shipped + 10 reviews*; PvP is not part of it.

### Why the recommendation is Early Access

Henry has ~5–15 focused hours a week plus heavy agent time, a fourth child arriving, and a $0–500 art budget. Three numbers drive the call. (1) The content ladder the design already chose — tiers, more biome pairs, more gyms, enemy Drivers, run modifiers — is exactly what Early Access is for: the loop ships complete and the ladder grows in public. (2) Steam's 10-review bar and the algorithm's first-week window reward a finished *loop*, not a finished *catalogue*; a Vertical Slice that is genuinely fun plus ~6 biome pairs and 3 tiers is a credible EA launch, while a 1.0 that promises "the full game" at the same content level invites "thin" reviews. (3) Calendar: EA lets the launch land before or shortly after the baby, with the post-launch patch cadence sized to family life (ticket 53), instead of holding the release for a content-complete bar that moves. The costs are real and recorded: Next Fest is one-time and must precede the EA launch; EA launch *is* the launch for review momentum (there is no second first impression), so the EA entry bar must be high on polish and low on quantity. Henry rules in ticket 05.

## Notes

- **Domain:** React 19 / TypeScript / Vite / Redux Toolkit; headless engine in `src/engine`; UI in `src/ui`; debug toolkit in `src/debug` (DEV-gated, build asserts it is absent). Binding design docs, in precedence order: [vision.md](../deck-archetypes/research/vision.md), [exploration-map.md](../deck-archetypes/research/exploration-map.md), [economy-session.md](../deck-archetypes/research/economy-session.md), [macros-and-drivers.md](../deck-archetypes/research/macros-and-drivers.md), [session-2026-08-19-decisions.md](../deck-archetypes/research/session-2026-08-19-decisions.md) (wins over older docs). `docs/roadmap.md`, `docs/tech_bible.md` and the `Epic*` specs are **historical** where they disagree.
- **Scope boundary:** the [deck-archetypes map](../deck-archetypes/map.md) owns combat balance, decks, cards, OS design, statuses and the sim pipeline. This map never tickets in those areas; where it depends on them it links their tickets as `Blocked by` (today: 109 for Driver compounding and boss comps). Requests TO that wayfinder (e.g. the 32 start-kit tags) are filed there, referenced here.
- **Standing laws every ticket respects:** power dies at the surface (true numbers in UI; `power` is internal pricing only); no duplicate species per team; difficulty = encounter tiers, never stat scaling; no leveling; Macros and Drivers are never called potions or relics; blueprints are the only persistent currency and are consumable; scrap and cards are run-scoped; Henry is in every design decision — agents implement, never "try stuff".
- **Execution override:** like the other two maps, this map carries implementation — `task` tickets build, `grilling`/`prototype` tickets decide with Henry, `research` tickets are AFK.
- **Repo rules:** read `_WARNING-line-endings.md` until ticket 02 deletes it; stage explicit paths only; CRLF in `docs/wayfinder`; one commit per ticket, author Henry Dunphy; `npx vitest run`, `npx tsc -b`, `npx vite build` clean before any code ships; never commit `package-lock.json`. One writer in the tree at a time — Henry sequences agents.
- **Capacity model (for dates):** ~10 Henry-hours/week + agent sessions most days; one `task` ticket ≈ one agent session + a Henry review; one `grilling` ≈ a 20–40-minute conversation (car-friendly). Dates below assume ~3 tickets/week and slip with family life — they are planning numbers, not promises.

## Decisions so far

- [Gap audit](tickets/01-gap-audit.md) — engine, 3v3, persistence and the debug toolkit are strong; run structure, economy nodes, Macros/Drivers, onboarding, settings, packaging and Steamworks are missing outright; leveling is still everywhere and must be frozen out. Full findings in [research/01-gap-audit.md](research/01-gap-audit.md); Steam facts in [research/02-steam-facts.md](research/02-steam-facts.md).
- **PvP is out of scope for the first release** (Henry, 2026-08-21) — see Out of scope.
- **Success metric = shipped + 10 reviews; art budget ≤ $500 and only if recoupable; audio from owned/free packs** (Henry, 2026-08-21) — the marketing lane is sized to this.
- [Desktop wrapper](tickets/26-wrapper-research.md) — **Electron + `steamworks.js`**, and the reason is not size but the overlay: Tauri's overlay issue is closed as *not planned*. A spike boots the real `dist/` (Electron 43 / Chromium 150, ~410 ms warm start, 249–314 MB packaged around a 1.0 MB game) and confirms **`base` must become `'./'`**. `localStorage` → file is only 6 call sites; Steam Auto-Cloud, and [ticket 23](tickets/23-save-v4.md) should introduce the adapter seam. Findings in [research/26-wrapper.md](research/26-wrapper.md); Henry ratifies in [42](tickets/42-desktop-packaging.md).
- [Error boundary + crash-safe saves](tickets/04-error-boundary.md) — a render throw now shows a "your save is safe" screen with return-to-ranch and a copy-crash-report button instead of a white screen; `saveGame` is explicitly validate→serialize→write with a typed failure `kind`, and a failed autosave reaches the **player** through a banner rather than a console a shipped build does not have. Suite 868 → **902**.
- [CI gate](tickets/03-ci-gate.md) — `ci.yml` hard-gates `npm ci` / `tsc -b` / `vitest run` / `build` on every push and PR, and `deploy.yml` calls it via `workflow_call` so **a red test blocks the Pages deploy**. The suite is **green: 69 files, 868 tests, 39 s** — the committed `test_output.txt` "4 failed" was a stale partial run. **Lint runs non-blocking** (Henry, 2026-08-21): 510 pre-existing errors, burndown split out as [ticket 55](tickets/55-lint-burndown.md).
- [Repo hygiene](tickets/02-repo-hygiene.md) — line endings **normalized once** (`.gitattributes` `* text=auto eol=crlf` + `git add --renormalize`; 339 CRLF / 340 LF / 11 mixed blobs → 683 LF), so the sweep cannot recur; root artifacts untracked into `_to_delete/`; **`scratch/` stays tracked** (Henry, 2026-08-21 — six live provenance comments cite it); Kraken 7.37 MB → 95 KB and **`dist/` 8.0 MB → 1.0 MB**.

## Phases

### Phase 0 — Foundations (now → ~mid-September 2026)

Cheap, unblocked, and everything downstream is safer for them. **02, 03, 04 and 26 all closed 2026-08-21**; 55 (lint burndown) graduated out of 03 and is the only agent-runnable ticket left in this phase. 05 and 06 are Henry sessions and now gate everything.

| Ticket | Type | Driver | Blocked by |
|---|---|---|---|
| [01 Gap audit: what the codebase already covers](tickets/01-gap-audit.md) | research | agent | — |
| [02 Repo hygiene: line-ending sweep, stray artifacts, the 7 MB Kraken](tickets/02-repo-hygiene.md) | task | agent | — |
| [03 CI gate: typecheck, tests, lint and build on every push](tickets/03-ci-gate.md) | task | agent | [02](tickets/02-repo-hygiene.md) |
| [04 Error boundary + crash-safe saves](tickets/04-error-boundary.md) | task | agent | — |
| [05 Release shape: Early Access or 1.0, and the entry bar in numbers](tickets/05-release-shape.md) | grilling | Henry | [01](tickets/01-gap-audit.md) |
| [26 Desktop wrapper research: Electron + steamworks.js vs Tauri, with a spike](tickets/26-wrapper-research.md) | research | agent | — |
| [55 Lint burndown: clear 510 errors and make the lint gate blocking](tickets/55-lint-burndown.md) | task | agent | [03](tickets/03-ci-gate.md) |

### Phase 1 — Vertical Slice (~mid-September → ~late November 2026)

**Definition:** one region offer (three biomes, three gyms to choose from), the full loop playable — ranch → start → map → fights/market/workshop/elite → gauntlet → run end → ranch — with Macros, Drivers, partial start kits growing to 20–25 cards, no leveling, save v4, and a playtest round that measures the run against the ruled envelope (35–45 min, 10–13 fights). Placeholder art is fine. This phase is the whole game's spine; nothing in phases 2–3 is worth starting before it is fun.

| Ticket | Type | Driver | Blocked by |
|---|---|---|---|
| [06 Run data model: what a run IS in state, and save schema v4](tickets/06-run-data-model.md) | prototype | Henry | [01](tickets/01-gap-audit.md) |
| [07 Region graph: generation, branch width, visibility depth, node mix](tickets/07-region-graph.md) | prototype | Henry | [06](tickets/06-run-data-model.md) |
| [08 Start-kit rule: which third of a species' kit begins the run](tickets/08-start-kit-rule.md) | grilling | Henry | [06](tickets/06-run-data-model.md) |
| [09 Run start: pick your starter, pick one of three gyms, seed the run](tickets/09-run-start.md) | task | agent | [06](tickets/06-run-data-model.md), [07](tickets/07-region-graph.md), [08](tickets/08-start-kit-rule.md) |
| [10 Region map screen: render the graph, fog, routing, node states](tickets/10-region-map-screen.md) | task | agent | [07](tickets/07-region-graph.md) |
| [11 Node encounter flow: wild fights, symmetric parties, full heal, no level scaling](tickets/11-encounter-flow.md) | task | agent | [06](tickets/06-run-data-model.md), [21](tickets/21-leveling-freeze.md) |
| [12 Post-fight rewards refit: scrap, 1-of-3 card pick, consumable blueprint drops, no XP](tickets/12-rewards-refit.md) | task | agent | [06](tickets/06-run-data-model.md), [11](tickets/11-encounter-flow.md) |
| [13 Marketplace node: buy cards, sell cards, card removal](tickets/13-marketplace-node.md) | task | agent | [06](tickets/06-run-data-model.md), [12](tickets/12-rewards-refit.md) |
| [14 Workshop node: assemble a blueprint mid-run, reflash an OS](tickets/14-workshop-node.md) | task | agent | [06](tickets/06-run-data-model.md), [12](tickets/12-rewards-refit.md), [20](tickets/20-ranch-minimal.md) |
| [15 Macros: the 10 ruled single-use slots, engine + UI](tickets/15-macros.md) | task | agent | [06](tickets/06-run-data-model.md), [13](tickets/13-marketplace-node.md) |
| [16 Drivers: the 8 ruled party-wide passives (proc-visible)](tickets/16-drivers.md) | task | agent | [06](tickets/06-run-data-model.md), deck-archetypes [109](tickets/../../deck-archetypes/tickets/109-3v3-pricing-and-canary.md) |
| [17 Elite nodes: one harder fight with the Driver as visible stakes; alpha and ambush](tickets/17-elite-nodes.md) | task | agent | [11](tickets/11-encounter-flow.md), [16](tickets/16-drivers.md) |
| [18 Gym gauntlet refit: three unhealed fights, boss draws one mingming per biome](tickets/18-gauntlet-refit.md) | task | agent | [11](tickets/11-encounter-flow.md), [15](tickets/15-macros.md) |
| [19 Run end: victory and defeat, blueprint bank, run summary, teardown](tickets/19-run-end.md) | task | agent | [12](tickets/12-rewards-refit.md), [18](tickets/18-gauntlet-refit.md) |
| [20 Ranch-minimal: roster, blueprint-only assembly and reflash, species clause, no XP](tickets/20-ranch-minimal.md) | task | agent | [06](tickets/06-run-data-model.md), [21](tickets/21-leveling-freeze.md), [23](tickets/23-save-v4.md) |
| [21 Leveling removal: freeze the engine at the calibration point everywhere](tickets/21-leveling-freeze.md) | task | agent | [01](tickets/01-gap-audit.md) |
| [22 3v3 game-side completion: six-entity UI, shared hand, caster STAB, energy transfer decision](tickets/22-3v3-game-side.md) | task | agent | [06](tickets/06-run-data-model.md) |
| [23 Save schema v4: ranch + run, migration from v3, in-progress run survives restart](tickets/23-save-v4.md) | task | agent | [06](tickets/06-run-data-model.md) |
| [24 Onboarding-lite: the first fight teaches the fight, the first run teaches the run](tickets/24-onboarding-lite.md) | task | agent | [09](tickets/09-run-start.md), [10](tickets/10-region-map-screen.md), [18](tickets/18-gauntlet-refit.md) |
| [25 Vertical Slice playtest round: protocol, scoresheet, findings](tickets/25-vs-playtest.md) | task | agent | [09](tickets/09-run-start.md), [10](tickets/10-region-map-screen.md), [11](tickets/11-encounter-flow.md), [12](tickets/12-rewards-refit.md), [13](tickets/13-marketplace-node.md), [14](tickets/14-workshop-node.md), [15](tickets/15-macros.md), [17](tickets/17-elite-nodes.md), [18](tickets/18-gauntlet-refit.md), [19](tickets/19-run-end.md), [20](tickets/20-ranch-minimal.md), [22](tickets/22-3v3-game-side.md), [24](tickets/24-onboarding-lite.md) |

### Phase 2 — Content Complete (~December 2026 → ~March 2027)

Re-cut by [Content plan](tickets/27-content-plan.md) once the slice has been played. Content (gyms, tiers, events, codex), presentation (art, UI, audio), and the platform baseline (settings, resolution, input, accessibility, performance). Several of these are agent-parallel once 27 and 32 are ruled.

| Ticket | Type | Driver | Blocked by |
|---|---|---|---|
| [27 Content plan: biome pairs, gyms, tiers and events at launch — in numbers](tickets/27-content-plan.md) | grilling | Henry | [05](tickets/05-release-shape.md), [25](tickets/25-vs-playtest.md) |
| [28 Authored gym bosses: curated 3v3 teams with signature firmware per biome pair](tickets/28-authored-gyms.md) | task | agent | [18](tickets/18-gauntlet-refit.md), [27](tickets/27-content-plan.md), deck-archetypes [109](tickets/../../deck-archetypes/tickets/109-3v3-pricing-and-canary.md) |
| [29 Difficulty tiers and opt-in run modifiers](tickets/29-tiers-and-modifiers.md) | task | agent | [19](tickets/19-run-end.md), [27](tickets/27-content-plan.md) |
| [30 Events node system + the first event set](tickets/30-events.md) | task | agent | [10](tickets/10-region-map-screen.md), [13](tickets/13-marketplace-node.md), [27](tickets/27-content-plan.md) |
| [31 Codex: seen/played species, OS and cards; completion payouts](tickets/31-codex.md) | task | agent | [23](tickets/23-save-v4.md), [19](tickets/19-run-end.md) |
| [32 Art direction and budget: AI-assisted vs commissioned, disclosure, what cards look like](tickets/32-art-direction.md) | grilling | Henry | [05](tickets/05-release-shape.md) |
| [33 Species art pass: 16 battle portraits to the ruled standard](tickets/33-species-art.md) | task | agent | [32](tickets/32-art-direction.md) |
| [34 UI art and theming pass: icons, backgrounds, logo, node icons](tickets/34-ui-art-pass.md) | task | agent | [32](tickets/32-art-direction.md), [10](tickets/10-region-map-screen.md) |
| [35 Audio pass: music loops, owned SFX packs, license inventory](tickets/35-audio-pass.md) | task | agent | [36](tickets/36-settings-screen.md) |
| [36 Settings screen: audio, display, motion, keybinds, save management](tickets/36-settings-screen.md) | task | agent | [23](tickets/23-save-v4.md) |
| [37 Resolution, fullscreen and controller: 16:9, 16:10 Steam Deck, Steam Input](tickets/37-resolution-and-input.md) | task | agent | [26](tickets/26-wrapper-research.md), [10](tickets/10-region-map-screen.md), [22](tickets/22-3v3-game-side.md) |
| [38 Accessibility baseline: focus order, labels, colour, text](tickets/38-accessibility.md) | task | agent | [34](tickets/34-ui-art-pass.md), [36](tickets/36-settings-screen.md) |
| [39 Performance pass: AI turn time, motion cost, bundle size on Deck-class hardware](tickets/39-performance.md) | task | agent | [22](tickets/22-3v3-game-side.md), [33](tickets/33-species-art.md) |
| [40 Standing quality gates: parity, canary and determinism in CI; release checklist script](tickets/40-standing-gates.md) | task | agent | [03](tickets/03-ci-gate.md), [16](tickets/16-drivers.md), [28](tickets/28-authored-gyms.md) |

### Phase 3 — Steam (account work starts in Phase 1; launch ~Q3 2027)

The publishing, marketing and testing lane. [Steamworks account](tickets/41-steamworks-account.md) and [Pricing and date](tickets/46-pricing-and-date.md) should NOT wait for Phase 2 — the Coming Soon page wants months of wishlist time and Next Fest is one-time with a ~7–8-week registration lead.

| Ticket | Type | Driver | Blocked by |
|---|---|---|---|
| [41 Steamworks account, $100 app fee, tax and identity, app ID (Henry checklist)](tickets/41-steamworks-account.md) | task | Henry | [05](tickets/05-release-shape.md) |
| [42 Desktop packaging: wrapper, file-backed saves, icon, Windows + Linux builds](tickets/42-desktop-packaging.md) | task | agent | [26](tickets/26-wrapper-research.md), [23](tickets/23-save-v4.md), [36](tickets/36-settings-screen.md) |
| [43 Steamworks integration: init, overlay, achievements, Steam Cloud](tickets/43-steamworks-integration.md) | task | agent | [41](tickets/41-steamworks-account.md), [42](tickets/42-desktop-packaging.md), [44](tickets/44-achievements-design.md) |
| [44 Achievements and Steam Cloud design: the list, in numbers](tickets/44-achievements-design.md) | grilling | Henry | [31](tickets/31-codex.md) |
| [45 Store page: capsule set, screenshots, description, tags, AI disclosure, Coming Soon](tickets/45-store-page.md) | task | agent | [41](tickets/41-steamworks-account.md), [32](tickets/32-art-direction.md), [34](tickets/34-ui-art-pass.md) |
| [46 Pricing, launch window and the calendar around the baby](tickets/46-pricing-and-date.md) | grilling | Henry | [05](tickets/05-release-shape.md), [27](tickets/27-content-plan.md) |
| [47 Trailer: 45–60 seconds of captured gameplay](tickets/47-trailer.md) | task | agent | [34](tickets/34-ui-art-pass.md), [35](tickets/35-audio-pass.md) |
| [48 Demo build: a capped run for Next Fest and the store page](tickets/48-demo-build.md) | task | agent | [42](tickets/42-desktop-packaging.md), [43](tickets/43-steamworks-integration.md), [25](tickets/25-vs-playtest.md) |
| [49 Marketing calendar: Next Fest, devlogs, a playtest community, press kit](tickets/49-marketing-calendar.md) | task | agent | [45](tickets/45-store-page.md), [46](tickets/46-pricing-and-date.md) |
| [50 Playtest program: Steam Playtest/keys, three rounds, bug triage loop](tickets/50-playtest-program.md) | task | agent | [42](tickets/42-desktop-packaging.md), [43](tickets/43-steamworks-integration.md), [25](tickets/25-vs-playtest.md) |
| [51 Steam Deck and Linux verification prep](tickets/51-steam-deck.md) | task | agent | [42](tickets/42-desktop-packaging.md), [37](tickets/37-resolution-and-input.md) |
| [52 Launch checklist and release day](tickets/52-launch-checklist.md) | task | agent | [40](tickets/40-standing-gates.md), [43](tickets/43-steamworks-integration.md), [45](tickets/45-store-page.md), [47](tickets/47-trailer.md), [48](tickets/48-demo-build.md), [49](tickets/49-marketing-calendar.md), [50](tickets/50-playtest-program.md), [51](tickets/51-steam-deck.md), [54](tickets/54-legal-and-licenses.md) |
| [53 Post-launch plan: patch cadence, opt-in telemetry, the PvP roadmap post](tickets/53-post-launch.md) | task | agent | [52](tickets/52-launch-checklist.md) |
| [54 Legal and licences: entity, taxes, privacy policy, EULA, asset licence inventory](tickets/54-legal-and-licenses.md) | task | Henry | [35](tickets/35-audio-pass.md), [41](tickets/41-steamworks-account.md) |

## The critical path — ten tickets that gate the Vertical Slice, in order

1. [Run data model](tickets/06-run-data-model.md) — nothing else has a place to live until a run is a thing in state. **Henry session.**
2. [Leveling removal](tickets/21-leveling-freeze.md) — every encounter/reward/ranch ticket otherwise re-inherits XP. Agent, parallel with 06.
3. [Start-kit rule](tickets/08-start-kit-rule.md) — the "team is the deck" arithmetic. **Henry session (car-friendly).**
4. [Region graph](tickets/07-region-graph.md) — generator + Henry's parameters (count, width, visibility). **Prototype with Henry.**
5. [Save schema v4](tickets/23-save-v4.md) — lands 06; resumes a run after app close.
6. [Run start](tickets/09-run-start.md) — starter + one-of-three gyms.
7. [Region map screen](tickets/10-region-map-screen.md) — the run's hub.
8. [Node encounter flow](tickets/11-encounter-flow.md) + [Rewards refit](tickets/12-rewards-refit.md) — the fight-and-grow beat (two sessions, same week).
9. [Gym gauntlet refit](tickets/18-gauntlet-refit.md) — the exam.
10. [Run end](tickets/19-run-end.md) — closes the loop back to the ranch.

Then, to make the slice *complete* rather than merely *closed*: Ranch-minimal (20), Marketplace (13), Workshop (14), Macros (15), Drivers (16, waits on deck-archetypes 109), Elites (17), 3v3 game-side (22), Onboarding-lite (24), and the Vertical Slice playtest (25).

## Calendar (planning numbers — ticket 46 makes them real)

| When | Milestone | Gate |
|---|---|---|
| Sep 2026 | Foundations done; 05 + 06 ruled | clean tree, CI green, run model ratified |
| late Nov 2026 | Vertical Slice playtested | 35–45 min, 10–13 fights, 20–25 cards at the gauntlet, "play again" ≥ 4/5 |
| Dec 2026 | Steamworks account + Coming Soon page live | App ID; wishlists start |
| Mar 2027 | Content Complete per ticket 27 | release-check green, gates in CI |
| Apr–May 2027 | Desktop build + Steamworks + demo; playtest rounds 1–2 | 0 crashes across testers |
| Jun or Oct 2027 | Steam Next Fest with the demo | one-time — choose by readiness, not hope |
| ~6–10 weeks after Next Fest | **Launch (EA recommended)** | launch checklist complete |

Baby's arrival: Henry supplies the month (see Questions) and the calendar bends around it — the two months around the due date are planned as zero-ticket months.

## Questions for Henry (un-ruled — this map does not decide them)

1. **Release shape** — Early Access (recommended above) or 1.0? → ticket 05.
2. **Reward-pool source** (pre-seeded, open) — do post-fight picks draw from the current party's species pools (designer's recommendation), from the biome's pools, or from the whole card pool? Ticket 12 builds behind one function so the answer can land late, but the playtest should run the ruled version.
3. **Gauntlet revive shape** (pre-seeded, deferred to playtesting by design) — Revive ships as a rare Macro (ruled). The open part: is a Revive Macro the *only* route back, or does a fainted member auto-return at a reduced % if you have none? Decided from ticket 25's data, not before.
4. **PvP matchmaking scope** — closed today: PvP is out of scope for the first release; it returns as its own wayfinder post-launch (ticket 53 writes the roadmap post).
5. **Start-kit size** — how many cards does a member bring: 3, 4 or 5 of its 8–9? (3 members × 4 + ~10 picks/buys − 2 removals ≈ 20 fits the 20–25 target.) → ticket 08.
6. **Region graph numbers** — nodes per biome (6 / 7 / 8), branch width (2 / 3), visibility (1 node / 2 nodes / whole biome), and whether farming is capped. → ticket 07.
7. **Workshop cost** — vision.md (older) says spend SCRAP at a workshop; economy-session.md (newer) says assembly costs blueprints only, anywhere. The map follows the newer ruling; please confirm. → ticket 14.
8. **Energy transfer** — `TRANSFER_ENERGY` exists in the reducer, no UI uses it, and the 3v3 ruling never mentions it. Keep (and give it a UI + a price) or delete? → ticket 22.
9. **Gauntlet with fewer than 3 members** — the gauntlet is "always full 3v3 curated"; if the player arrives with 2, is it 3 vs 2 (harsh but honest) or does the boss scale to party size (contradicts "symmetric by default" only at the exam)? → ticket 18.
10. **In-progress runs across app close** — one run slot, resumable (recommended; Steam players expect it), or runs that die with the session? → ticket 06.
11. **Blueprint drop rate and scrap table** — numbers: blueprint chance per wild (15 / 20 / 25 %), scrap per win, card prices by rarity, removal price. → tickets 12/13.
12. **Content at launch** — biome pairs (6 / 8), tiers (2 / 3), events (10 / 15), authored gyms — after the slice is played. → ticket 27.
13. **Art path and the $500** — capsule commission (recommended) vs species art; AI-assisted art with Steam disclosure, yes or no? → ticket 32.
14. **Price, discount, launch month, and the baby's due month** — → ticket 46.
15. **Code signing on Windows** (~$200–400/yr for a cert vs SmartScreen warnings; Steam does not require it) — → ticket 42.
16. **A ruled decision worth a second look:** *full heal between regular nodes* plus *run-scoped scrap* leaves events with almost no HP or currency stakes outside the gauntlet; event costs will have to be deck-shaped (lose a card, take a curse-like card) — fine, but it narrows event design. Not asking to change the ruling; flagging it so ticket 30 is written with eyes open.

## Not yet specified (fog — in scope, not yet sharp enough to ticket)

- **Full tutorialization** beyond onboarding-lite: which confusions the slice playtest surfaces decides whether the run and ranch layers need guided sequences or just callouts.
- **Player-facing save slots / profiles** — depends on ticket 06's one-run-or-several answer.
- **Localization** — English only is the working assumption; if ticket 45's wishlist geography says otherwise, a string-extraction ticket graduates here.
- **Cosmetics as codex payouts** — what a "cosmetic" even is in this UI (card backs? ranch skins?) waits on the UI art pass.
- **Enemy Drivers and enemy Macros at higher tiers** — ruled as the tier ladder's tools; specifiable after tickets 16 and 29.
- **The staged overworld** (rendering the same graph as walkable places) — vision.md keeps it reachable; it is not a first-release item and graduates only if the release earns it.
- **Telemetry schema** — ticket 53 owns the opt-in decision; the exact events wait on what the playtests keep asking for.
- **Nightly long-balance run in CI** — ticket 40 keeps `npm run balance` manual; a scheduled runner is fog until the pipeline-optimization ticket (deck-archetypes 108) lands.

## Out of scope

- **Ranch-team PvP and matchmaking** (Henry, 2026-08-21) — not in the first release. It is the next effort's destination, promised publicly in ticket 53's roadmap post, charted as a fresh wayfinder, never resumed from here.
- **Combat balance, deck/card/OS design, statuses, the sim pipeline** — owned by the deck-archetypes map.
- **Mobile / web release** — the GitHub Pages build stays as a dev/preview target only; no store listings beyond Steam.
- **Mod support / workshop integration, leaderboards, daily runs** — good post-launch candidates; not charted.
- **Commissioned species illustrations and card art** beyond the $500 capsule — returns only if revenue appears (ticket 32 records the trigger).
