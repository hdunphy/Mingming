# Handoff prompt — Debug & Testing Toolkit map

Paste everything below the line into a fresh agent session (Claude Code, Cowork, etc.) working in the Mingming repo. It is self-contained; the agent needs no other context.

---

You are working through a **wayfinder map**: a planning-and-build effort charted as decision tickets on disk. Repo: `C:\Users\hdunp\Documents\GameDev\Unity\GitHub\Mingming` (React 19 / TypeScript / Vite / Redux Toolkit roguelike deckbuilder; headless engine in `src/engine`, UI in `src/ui`; branch `complete-game-loop`).

The map lives at `docs/wayfinder/debug-toolkit/map.md`. Read it first — it holds the destination, standing notes, decisions so far, and the fog (Not yet specified / Out of scope). Tickets are files in `docs/wayfinder/debug-toolkit/tickets/`; deep research findings are in `docs/wayfinder/debug-toolkit/research/01-engine-readiness.md` — **read that file before resolving any design ticket**, it maps the whole engine (injection points, determinism gaps, save-system hazards) with file:line references.

## Session protocol — follow exactly

1. Load `map.md`. Do not bulk-read every ticket; open bodies on demand.
2. Choose **one** ticket. If I name one, use it. Otherwise pick from the frontier: tickets whose `Status` is `open`, whose `Blocked by` entries are all closed, and whose `Assignee` is blank.
3. **Claim it** before any work: write your session name into its `Assignee` field and save the file.
4. Resolve it according to its `Type`:
   - `wayfinder:grilling` — a decision to make **with me, the human**. Ask me questions one at a time (multiple-choice with a recommendation where possible). Never answer your own questions or assume my preferences; the ticket only resolves through my answers.
   - `wayfinder:prototype` — build a cheap, rough, concrete artifact for me to react to; iterate from my reactions; link the artifact from the ticket.
   - `wayfinder:task` — mechanical work with no decision; just do it and verify.
   - `wayfinder:research` — AFK investigation; write findings to `research/` and link them.
5. Record the outcome: fill the ticket's `## Resolution` section, set `Status: closed`.
6. Update the map: add a one-line gist to **Decisions so far** linking the ticket by name; graduate any fog the resolution made specifiable into new ticket files (create the files first, then wire `Blocked by` links); delete or amend tickets the decision invalidated; move anything ruled beyond the destination into **Out of scope** with its ticket closed.
7. **Stop after one ticket.** Do not roll into a second ticket in the same session.

## Repo rules (non-negotiable)

- Before shipping any code change: `npx vitest run` (all tests green), `npx tsc -b`, `npx vite build` — all clean.
- Never commit `package-lock.json`. Commit author: Henry Dunphy <hdunphy15@gmail.com>. Line endings are CRLF.
- Commit the map/ticket edits together with any code the ticket produced, one commit per ticket.
- If git fails with lock errors ("unable to unlink", `index.lock`): move the lock files into `_to_delete/git-locks/` and retry — never leave the commit undone.

## Effort context

Destination: a **dev-build-only debug toolkit**, built and working — hidden Debug tab (scenario launcher + save/run editor), mid-battle debug overlay (live state manipulation), JSON scenario files (composable, exportable from live battles, replayable), and a headless batch-sim/balance auditor reusing scenario definitions — all gated behind `import.meta.env.DEV` so production builds tree-shake it entirely. Done when one real bug and one real balance question have each been driven through the toolkit end to end. Execution is in-scope for this map (its Notes override wayfinder's plan-only default).

Frontier as of the last session (verify against ticket files — they are the source of truth): **Scenario schema v1** (02), **Debug gating architecture** (03), **Save/run editor verbs** (07), **Determinism groundwork** (09, a task — good pick if I'm not around to answer questions). Blocked behind them: launcher UI prototype (04), live-manipulation command set (05), battle snapshot export (06), batch sim & auditor design (08).

**2026-08-10 update:** the map's original destination was reached 2026-08-03 (see map.md).
New scope was added the same way as [ticket 24](tickets/24-save-slots.md) — tickets 25
(design) and 26 (instrumentation + build) for a richer "deck balance report v2" drill-down
tool. **Both are now CLOSED and the extension has no frontier.**

What ticket 26 leaves behind, for whoever picks this up next:

- **`npm run balance:deck`** writes `docs/balance/deck_report.json` + a self-contained
  `deck_report.html`. Flags: `--subjects`, `--suites`, `--control`, `--iterations`, `--out`.
- **Telemetry is opt-in (`BatchOptions.telemetry`) and `npm run balance` never sets it.** Keep
  it that way: the commit gate's runtime is a standing requirement and there is a test pinning
  the default.
- **Two per-card denominators, deliberately.** `deadRate` is per instance (comparable to the
  deck-level ratio); `playRate` is per hand entry. Collapsing them is the bug that made the
  first draft read 50% dead on every card.
- **`residualDamageShare` is an approximation** for DoT damage, nullable so "no DoT" and
  "measured zero" stay distinguishable. Never quote it as measured-exact.
- **`ARCHETYPE_SUMMARIES` in `deckReport.ts` is authored**, covers 12 subjects, and the
  generator warns rather than shipping a blank appendix for a subject with no entry.

Start by telling me which ticket you're claiming and why, then begin.
