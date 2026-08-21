# HANDOFF — steam-release map (keep this current every session)

**The line-ending sweep is fixed for good — `.gitattributes` normalizes everything and `_WARNING-line-endings.md` is gone (ticket 02). Stage explicit paths only. One writer in the tree at a time — Henry sequences agents; if the tree shows fresh engine/sim changes you did not make, STOP and ask.**

**Git on this mount, the short version.** It cannot `unlink`, which has three consequences worth knowing before you fight them: `git checkout` / branch switching **does not work** (in-place `git show HEAD:<path> > <path>` is the restore fallback); `.git/index.lock` and `.git/HEAD.lock` survive every command, so `mv .git/*.lock _to_delete/git-locks/` before each git call and ignore the `tmp_obj_*` warnings; and files are moved to `_to_delete/`, never deleted. `.github/workflows/*.yml` is additionally **write-protected against `device_commit_files`** — write those through `device_bash` instead. Long gates (`tsc -b`, `vitest run`, `npm run balance`) exceed the device VM's 45-second kill; tarball the tree to a cloud container and run them there. `git add --renormalize -u .` over the whole tree is one of the commands that silently dies at 45 s — chunk it 50 paths at a time.

*Last updated: 2026-08-21 (agent sessions: tickets 02, 03, 04, 26, then 06). **State: 55 tickets, 6 closed (01 gap audit, 02 repo hygiene, 03 CI gate, 04 error boundary, 26 wrapper research, 06 run data model). THE VERTICAL SLICE IS UNBLOCKED — 06 is ratified, so 07, 09, 10, 11, 12, 18, 19, 20 and 23 can all start, and 21 (leveling freeze) runs beside them. The critical path from here is 21 -> 08 -> 07 -> 23 -> 09 -> 10 -> 11/12 -> 18 -> 19; 08 (start-kit rule) is a Henry session and is the next thing on it. Also open: 05 release shape (Henry) and 55 lint burndown (agent). Suite green at 76 files / 927 tests; CI hard-gates typecheck/tests/build and blocks the Pages deploy; `npm run lint` is advisory at 510 pre-existing errors.** Branch `steam-release-prep`, cut from merged `main` after archetype-web (#7).*

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

### 2026-08-21 — Run data model (ticket 06) — **the Vertical Slice is unblocked**

- **`src/engine/runTypes.ts` is the ratified shape** (prototype, imported by nothing; ticket 23 lands it in `SaveSystem.ts`). 25 tests. The rule it encodes: *in `IRunState` = destroyed at run end and cannot inflate the next run; in `IRanchState` = someone has to justify why it can.* Ranch keeps only individuals, blueprint **counts**, codex, gyms/tier. `cardInventory`, `activeDeck` and `scrapCount` leave the permanent save entirely.
- **Henry's four rulings:** (1) a run **survives app close, one slot**; (2) ranch and run under **separate storage keys** — a corrupt run must never cost a blueprint; (3) **save v4 is a clean break, no v3 migration**; (4) **assembly costs a blueprint at the ranch, a blueprint + scrap at a mid-run workshop.**
- **Ruling 4 resolved a real contradiction between two binding docs** — `vision.md` says workshops cost scrap, `economy-session.md` says blueprints only. Now each is true of the place it described. Design consequence: **mid-run recruiting competes with the marketplace for scrap.** Ticket 14 owns the number.
- **Ruling 2's price is `reconcileLoadedState()`** — two independent writes can tear, so the cross-object laws moved out of the schema into an explicit load step with one law: **the run is always the disposable half; nothing is ever half-repaired.** This is also the **first enforcement anywhere of the no-duplicate-species law** (`teamComps.ts` calls it an open question; gap audit §5 confirms no code checked it).
- **Ruling 3 was safe because there is nothing to migrate.** Both this ticket and 23 claimed `playtest-results/` held v3 save fixtures — it does not. All 14 files there are **battle snapshots** on `scenarioIO`'s own `registryHash` versioning. The only v3 data in existence is in Henry's browser. Ticket 23 now **deletes** `migrateSave` and its callers rather than extending them, and must make a v3 blob read as *no save*, not as corruption — otherwise ticket 04's loader clings to it forever.
- **A live v3 bug found by the prototype's own tests:** `PlayerSaveSchema` uses `.catch([])` on `blueprints`, `relics`, `unlockedSectors`, `baseDecksGranted`. `.catch` swallows *malformed* input and lets the parse succeed — so one corrupt blueprint count would empty the player's permanent inventory and autosave would write that over the good save. Harmless when blueprints were an unspendable list; not harmless now they are currency. Use `.default()`. Flagged into ticket 23.
- **Next on the critical path: 08 (start-kit rule), a Henry session** — car-friendly. 21 (leveling freeze) is agent-runnable and can go in parallel right now.

### 2026-08-21 — Foundations session (tickets 02, 03, 04, 26)

- **The tree is trustworthy now.** Line endings normalized once and permanently (`.gitattributes` + `git add --renormalize`; the index was 339 CRLF / 340 LF / 11 mixed and is now 683 LF). `git status` is clean. Root artifacts untracked into `_to_delete/ticket-02-artifacts/` for Henry to delete; ~27 MB of them remain in **history**, which nobody has authorized rewriting. `dist/` 8.0 MB → **1.0 MB** (Kraken 7.37 MB → 95 KB).
- **The suite was always green.** 74 files / **902 tests**, ~46 s. The committed `test_output.txt` that said "4 failed" was a stale partial run and is now untracked. CI (`ci.yml`) hard-gates `npm ci` / `tsc -b` / `vitest run` / `build` on every push and PR, and `deploy.yml` calls it via `workflow_call`, so **a red test blocks the Pages deploy**.
- **Lint cannot be a gate yet: 510 pre-existing errors** (296 `no-explicit-any`, 154 `no-unused-vars`, 33 auto-fixable `prefer-const`, 18 react-hooks). Henry ruled it advisory; **new ticket 55** owns the burndown and flips it blocking. `scratch/` stays tracked but left eslint's surface.
- **A white screen is no longer a possible outcome.** Top-level `ErrorBoundary` with a "your save is safe" screen, return-to-ranch and copy-crash-report; `saveGame` restructured to explicit validate→serialize→write with a typed failure `kind`; a failed autosave now reaches the *player* via a banner instead of a `console.error` that a packaged build has no console for. First DOM-mounting tests in the repo (`createRoot` + `act` under a `// @vitest-environment jsdom` docblock) — copy that shape for future component tests.
- **Wrapper decided (pending Henry's ratification in 42): Electron + `steamworks.js`.** The deciding fact is not size, it is that **Tauri's Steam-overlay issue is closed as "not planned"** — the overlay hooks graphics-device init and Tauri hands rendering to the OS webview. A spike boots the real `dist/` unchanged (Electron 43 / Chromium 150; ~410 ms warm start; 249–314 MB packaged around a 1.0 MB game) and confirms **`base` must become `'./'`**. `localStorage` → file is only **6 production call sites**; use Steam Auto-Cloud, and **ticket 23 should introduce the storage-adapter seam** so ticket 42 does not edit the save layer twice. Full findings: `research/26-wrapper.md`.
- **Three things the tickets assumed that were not true**, all resolved with Henry rather than improvised: `git checkout --` cannot restore files on this mount; `npm run lint` cannot block CI today; and "reuse `debug/snapshotIO.ts`'s export shape" had to mean the shape, not the module (importing it would drag the DEV-only toolkit into every shipped bundle and fail `assert-no-debug`).

### 2026-08-21 — charting session

- **Audit headline:** the engine is a shipped game's engine; the game around it is not built. 3v3, persistence, the debug toolkit and the parity gate are real. There is no run object, no map, no marketplace/workshop/elite/event nodes, no Macros or Drivers (a 4-relic stub exists and is superseded), no onboarding, no settings, no packaging, no Steamworks. Leveling code is everywhere and must be frozen out (ticket 21). `vite.config.ts` `base: '/Mingming/'` blocks any desktop build (ticket 42). `Kraken.png` is 7.37 MB (ticket 02).
- **Henry's rulings today:** success = shipped + 10 reviews; PvP out of scope for the first release; art budget ≤ $500, art only, only if recoupable; SFX from owned packs (licence check in ticket 35).
- **Recommendation on the table:** Early Access (reasoning in map § Destination). Henry decides in ticket 05.
- **Steam facts verified 2026-08-21** (`research/02-steam-facts.md`): $100 Steam Direct fee per app, recouped after $1,000 revenue; generative-AI disclosure is mandatory for AI content reaching players or the store page, dev-tool use exempt; Next Fest is one-time per game, demo must be live, game unreleased, registration ~7–8 weeks ahead; 2026 fests Feb/Jun/Oct, 2027 dates not yet published; Electron + `steamworks.js` is the web-game community's default wrapper path, Tauri trades Steamworks support and graphics for binary size.
- **Cross-wayfinder dependencies in force:** deck-archetypes 109 (3v3 pricing + canary) gates Drivers (16) and authored boss comps (28); deck-archetypes 108 (pipeline optimization) gates any nightly balance CI (fog). A request for 32 `startKit` tags will be filed there when ticket 08 rules the rule.
