# HANDOFF — steam-release map (keep this current every session)

**READ `_WARNING-line-endings.md` AT THE REPO ROOT BEFORE ANY COMMIT until ticket 02 deletes it. Stage explicit paths only. One writer in the tree at a time — Henry sequences agents; if the tree shows fresh engine/sim changes you did not make, STOP and ask.**

*Last updated: 2026-08-21 (charting session). **State: map charted, 54 tickets, 1 closed (the gap audit). Frontier today: 02 repo hygiene, 03 CI gate (after 02), 04 error boundary, 26 wrapper research — all agent-runnable in parallel — and two Henry sessions: 05 release shape and 06 run data model. Nothing in the Vertical Slice can start until 06 is ratified; 21 (leveling freeze) can run beside it.** Branch `steam-release-prep`, cut from merged `main` after archetype-web (#7).*

---

## Paste-into-a-fresh-agent prompt

You are working through a **wayfinder map**: a planning-and-build effort charted as decision tickets on disk. Repo: `C:\Users\hdunp\Documents\GameDev\Unity\GitHub\Mingming` (React 19 / TypeScript / Vite / Redux Toolkit roguelike deckbuilder; headless engine in `src/engine`, UI in `src/ui`, DEV-gated debug toolkit in `src/debug`). Branch **`steam-release-prep`**. Never commit to `main` or `archetype-web`.

The map lives at `docs/wayfinder/steam-release/map.md`. Read it first — destination, notes, the phase tables, the critical path, Henry's open questions, the fog. Tickets are files in `docs/wayfinder/steam-release/tickets/`. The codebase audit that every ticket assumes is `docs/wayfinder/steam-release/research/01-gap-audit.md` — read it before resolving any ticket. Binding design docs live in the deck-archetypes wayfinder: `docs/wayfinder/deck-archetypes/research/{vision,exploration-map,economy-session,macros-and-drivers,session-2026-08-19-decisions}.md` — where they and anything older disagree, the 2026-08-19 decisions record wins. Nothing you build may contradict `vision.md`.

### Session protocol — follow exactly

1. Load `map.md`. Do not bulk-read every ticket; open bodies on demand.
2. Choose **one** ticket. If Henry names one, use it. Otherwise take the first frontier ticket in critical-path order (map § "The critical path"), then phase order. Frontier = `Status: open`, every `Blocked by` closed (cross-wayfinder links count — open the linked file and check its Status), `Assignee` blank.
3. **Claim it** before any work: write your session name into `Assignee` and save.
4. Resolve it by `Type`:
   - `wayfinder:grilling` — a decision made **with Henry**. One question at a time, multiple-choice with numbers and a recommendation. Never answer your own questions; never assume his preference. If Henry is driving, keep replies audio-friendly.
   - `wayfinder:prototype` — build something cheap and concrete for Henry to react to (types, a generator dump, a stub screen); iterate on his reactions; link the artifact.
   - `wayfinder:task` — build it. **Design decisions inside a task stop the task**: if you find an un-ruled question, write it into the ticket, return it to Henry, do not improvise. Implementation agents adjust only what the ticket authorizes.
   - `wayfinder:research` — AFK investigation; findings to `research/NN-<slug>.md`, linked from the ticket.
5. Record the outcome: fill `## Resolution` (numbers, file paths, what was measured), set `Status: closed`.
6. Update `map.md`: one gist line under **Decisions so far** linking the ticket by name; graduate fog the resolution sharpened into new ticket files (create, then wire `Blocked by`); amend or delete tickets the decision invalidated; anything ruled beyond the destination goes to **Out of scope** with its ticket closed. Refresh the *State* line at the top of this HANDOFF.
7. **Stop after one ticket.**

### Repo rules (non-negotiable)

- Before shipping any code change: `npx vitest run` (green), `npx tsc -b`, `npx vite build` (which asserts the debug toolkit is absent from `dist/`) — all clean. Long gates (`npm run balance`) do not run on Henry's device VM (45-second kill); run them in a cloud container if a ticket needs them.
- Never commit `package-lock.json`. Author: Henry Dunphy <hdunphy15@gmail.com>. Docs under `docs/wayfinder` are CRLF.
- Commit the map/ticket edits together with the ticket's code, one commit per ticket, **explicit paths only** (no `git add -A` / `git add .`).
- Git lock files that will not unlink → move them to `_to_delete/git-locks/` and retry; never leave the commit undone. The device cannot delete files, only move them.
- Standing laws (map § Notes): power dies at the surface; no duplicate species per team; tiers not scaling; no leveling; never "potions"/"relics"; blueprints consumable and the only persistent currency; scrap and cards run-scoped; Henry is in every design decision.
- Scope: combat/deck/card/OS/status/sim work belongs to the deck-archetypes map — file a request there, link it here, do not do it here.

---

## Where things stand (findings log — newest first)

### 2026-08-21 — charting session

- **Audit headline:** the engine is a shipped game's engine; the game around it is not built. 3v3, persistence, the debug toolkit and the parity gate are real. There is no run object, no map, no marketplace/workshop/elite/event nodes, no Macros or Drivers (a 4-relic stub exists and is superseded), no onboarding, no settings, no packaging, no Steamworks. Leveling code is everywhere and must be frozen out (ticket 21). `vite.config.ts` `base: '/Mingming/'` blocks any desktop build (ticket 42). `Kraken.png` is 7.37 MB (ticket 02).
- **Henry's rulings today:** success = shipped + 10 reviews; PvP out of scope for the first release; art budget ≤ $500, art only, only if recoupable; SFX from owned packs (licence check in ticket 35).
- **Recommendation on the table:** Early Access (reasoning in map § Destination). Henry decides in ticket 05.
- **Steam facts verified 2026-08-21** (`research/02-steam-facts.md`): $100 Steam Direct fee per app, recouped after $1,000 revenue; generative-AI disclosure is mandatory for AI content reaching players or the store page, dev-tool use exempt; Next Fest is one-time per game, demo must be live, game unreleased, registration ~7–8 weeks ahead; 2026 fests Feb/Jun/Oct, 2027 dates not yet published; Electron + `steamworks.js` is the web-game community's default wrapper path, Tauri trades Steamworks support and graphics for binary size.
- **Cross-wayfinder dependencies in force:** deck-archetypes 109 (3v3 pricing + canary) gates Drivers (16) and authored boss comps (28); deck-archetypes 108 (pipeline optimization) gates any nightly balance CI (fog). A request for 32 `startKit` tags will be filed there when ticket 08 rules the rule.
