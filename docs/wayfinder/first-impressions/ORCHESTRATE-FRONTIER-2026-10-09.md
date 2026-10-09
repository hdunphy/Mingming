# Orchestrator prompt: the frontier tickets that need no ruling from Henry (written 2026-10-09)

Paste everything below the line into a fresh agent. It is written to be read cold.

---

You are the orchestrator for one batch of small tickets in the Mingming repo (`C:\Users\hdunp\Documents\GameDev\Unity\GitHub\Mingming-Balancing`, branch `first-impressions`, HEAD `8677809` or later). Mingming: Midgard Circuit is a React 19 / TypeScript / Vite / Redux Toolkit deckbuilder with a headless engine in `src/engine`. Henry Dunphy owns it and decides every design question. You may spawn sub-agents. Your job is to get the tasks below built, tested and committed, and then report to Henry. Do not make any decision that is his.

## The rules (read first, they are not optional)

**Repo law.** Several agents work in this same working tree at the same time. Treat every change you did not make as someone else's live work.
- Never run `git push`. Henry pushes. Finish with the exact commands for him.
- Commits are authored as `Henry Dunphy <hdunphy15@gmail.com>` (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`) with **no Co-Authored-By and no other AI attribution lines**.
- Before writing a file, check it still matches what you read (`git hash-object <file>`; if it changed, someone else is on it, so re-read and re-apply your change on top). Never write back an older copy.
- Edit in place (Edit tool, small read-modify-write scripts). Never rebuild a whole file from memory. After a big edit compare the line count with `git show HEAD:<path> | wc -l` and explain any big drop.
- One commit per ticket row, made as soon as the row is done. Stage explicit paths only (`git add -- <your files>`); never `git add -A`, `git add .`, `git add -u` or `git commit -a`. Run `git diff --cached --name-only` before every commit and check it lists only your files.
- Never run `git reset --hard`, `checkout`, `restore`, `stash`, `clean`, `--amend`, rebase or force. Do not switch branches in this tree. If you want isolated worktrees for parallel work, ask Henry first.
- If a file you need keeps changing under you or has conflict markers, stop and tell Henry rather than racing it.
- Never commit `build.py`, `browser.html` or `registry.json` (Henry regenerates them). Do not touch the design record (`collection-v2`).
- Line endings: CRLF in `docs/wayfinder`; LF in `src`, tests, JSON and scratch files. A file rewritten by a script keeps the endings it had.
- Run `tsc -b`, `eslint` and the vitest files that cover what you changed. The full `npm run gate` is long; Henry runs it before pushing. Say plainly which checks you ran and which you did not.
- Small single-purpose modules, composed (Henry's standing preference). No monoliths.
- Test first when the row says so: put "fails on parent: yes" in the commit message when you saw the test fail first.

**Standing rulings (do not reopen).** No arbitrary caps; no hidden maths; no "turn X" hooks. Tuning values move in steps of 5 (never 13 or 14). No AI-generated picture ever ships or is sent to an artist. The 1v1 grid no longer gates card changes. If a task seems to conflict with a standing ruling, say so plainly instead of quietly working around it.

**What is on hold. Do not start any of these.** Henry said "wait" on 2026-10-09:
- Ticket 208 (his Ratatoskr v1 playtest notes: Hamstring removed, new starter frames, Swallow Brine rename, the frame recorder).
- Ticket 210 (Surtr replaces Sköll: renames and a sword glyph).
- Ticket 211 (the gym's difficulty and the biome order), including its gym bench, and ticket 207's row 207c, which waits on that bench.
- Ticket 212 (what the 2026-10-08 agent nights found).
- The design sessions and the two nights in ticket 206 (the v1 starters, jormungandr_v1, the cards nobody takes and the shop, the gym prep mock, the naive-vs-primed night, the two-run night), the measurement rows 196b and 197a steps 2 and 3, and ticket 213's rows that need Henry's pick. He wants to play the new biome order first, because it changes which cards and shops a run meets.
- Ticket 175 (localization, comes after everything else), ticket 180 (agent playtester, no-go), the Steam tickets, and the pending art commissions.

If a task below turns out to need one of these, stop and report; do not improvise.

## The work (six tasks; the order matters where it says so)

Read each ticket file fully before touching code. Ticket files are in `docs/wayfinder/first-impressions/tickets/`.

### Task 0: check the merged tree is green (first, alone)
HEAD includes a 2026-10-09 merge, and the full gate has not been re-run on it. Run `tsc -b`, `eslint .`, `npm run icons -- --check`, and as much of vitest as your environment allows (the slow ones are `ghostWalk`, `overnight` and the run walkers; if you cannot run them, say so). Report failures; fix only what is plainly a merge slip (a stale string, a mis-pinned test), with its own commit. Anything that looks like a design or balance change goes in your report, not in a commit.

### Task 1: ticket 181c, 181e, 181d (the release rows; one agent, in this order, because all three touch `.github/workflows/deploy.yml` and `vite.config.ts`)
Ticket: `181-friends-playtest-1.md`. All fifteen of its decisions are ruled; the three build rows are unbuilt (`package.json` still says 0.0.0 and the workflow still publishes to GitHub Pages).
- **181c** the "Tell Henry how it went" button (`src/ui/feedback/feedbackLink.ts`, the run summary and Settings, the form template with the five field ids, the env var passed from `deploy.yml`). The ticket gives the file names, URL template and tests.
- **181e** the version number (`package.json` version 0.4.0 for this round, `__GAME_VERSION__` build constant, the label `PLAYTEST 2 · v0.4.0 · <commit>`, the publish steps run only if tag `v<version>` does not exist, `npm version minor --no-git-tag-version` written into `HANDOFF.md`).
- **181d** the restricted itch.io deploy (relative base in `vite.config.ts`, `scripts/assert-relative-base.mjs` added to `npm run build`, `deploy.yml` renamed "Deploy to itch.io" with `workflow_dispatch`, butler push, fails loudly if the target is still `CHANGE-ME` or the secret is missing).
Hard limits: **do not merge to `main` and do not trigger a deploy.** Workflow files cannot be tested here, so check that they parse as YAML and say that they are untested. The itch page, the `BUTLER_API_KEY` secret and the real target are Henry's own steps (the ticket's section 3); list what he still has to do at the end of your report. Do not invent the itch target.

### Task 2: tickets 196a and 197a step 1 (report tooling only; one agent)
Tickets: `196-unused-cards.md` (row 196a) and `197-shop-buys-vs-upgrades.md` (row 197a, step 1 only).
- **196a:** `writeReport` also writes a per-card CSV (offered, taken, stored, passed, on a shelf, bought, upgraded, element, kind, cost, and the main-element share), counts a shop Draught as a buy (check the verb in `shelfTallies`; say so in the commit if it differs), and `npm run playtest:report -- --cards <date> <date> ...` merges nights into one table. Files are under `src/debug/playtest/report/`. LF endings.
- **197a step 1:** add the Amber columns (earned, and spent on cards, upgrades, Draughts, Traces and Runes, plus Amber left at the end) to the morning report. Additions only; existing output must not change.
This is plumbing. It changes no card, no price and no game behaviour. Do not run the measurement rows.

### Task 3: a picture sheet of icon alternatives (ticket 205's follow-up; one agent, no game code)
Henry asked for alternatives to two icons he is unhappy with or has not judged (items B7 and B10 in `206-open-decisions-2026-10-08.md`):
- **The type chart button.** It currently draws Tabler `dna` (`src/ui/components/typeChartIcons.ts`), which reads as a crosshair at 16 to 20 px, and Henry does not want DNA. Show candidates: `chart-radar`, `arrows-exchange`, `swords`, `layout-grid`, `target-arrow`, `triangle`, `dna-2` and the current `dna`, each at 12, 16 and 20 px on the panel and card backgrounds, with what each says in one line.
- **The card tooltip icons**, which draw at 9 to 11 px and which Henry has not commented on. Show the real tooltip icons at their current size beside the same icons at 12 and 14 px, and with the filled variant where Tabler has one, so he can see whether size or weight is the fix. `InlineIcon` already takes a size.
Build it the way ticket 205 built its sheet (`research/205-emoji/sheet.html` and the PNG pages), in `research/205-emoji/` or a sibling folder, using the installed `@tabler/icons`. **Do not change any game file.** The result is a sheet for Henry to point at; if he picks, the change is one word in `typeChartIcons.ts` plus `npm run icons`.

### Task 4: write down what is already decided (docs only; one agent)
- Copy Henry's 2026-10-09 answers B1 to B10 into `206-open-decisions-2026-10-08.md` (they are on the Wayfinder Open Items page, https://claude.ai/artifact/2jFR2MYhDy8Mz5otXrnmfz, and not yet in the repo). Quote that page as the source in the ticket, and keep B5 and B7 marked "not settled" where the page says so (B5 is also overtaken by ticket 210, which is on hold: note it, do not resolve it).
- Add a 2026-10-09 bullet to `HANDOFF.md`: the merge, the renumbering (211 and 212 are this branch's tickets, formerly 206/209 and 205/208), what is ruled but not built (208, 210), the on-hold list above, and ticket 213.
- Ticket 213 (`213-engine-data-emoji.md`), row 213a only: recount the emoji lines in `src/engine` and list which are dead data. Report the numbers; do not delete anything.
CRLF in all of these.

### Task 5: close out (last, alone)
Run `git status`, make sure nothing of yours is left uncommitted, and run `git log --oneline` for your commits. Do not edit the Wayfinder map or the Open Items page unless a task above changed a ticket's state; if one did, update that ticket's row in `map.md` (CRLF, in place, one commit) and tell Henry the artifact page needs a refresh.

## How to run it
Tasks 1, 2, 3 and 4 touch different files (Task 1: `deploy.yml`, `vite.config.ts`, `package.json`, feedback and version UI; Task 2: `src/debug/playtest/report`; Task 3: `research/`; Task 4: docs) so they can run in parallel in this tree, each agent staging only its own paths. Task 0 goes first and Task 5 goes last. If two agents need the same file, serialize them and say so. Give every sub-agent this prompt's rules block verbatim plus its own task text, and tell it to report back what it changed, what it checked, and what it could not check. Verify a sub-agent's claim by reading its diff before you repeat it.

## What your final report to Henry must look like
Henry reads every report cold. He does not read tickets and does not have them memorised.
- Plain, simple English. Short sentences. Explain a mechanic before using its jargon.
- Never a bare ticket number. First mention: say what the ticket is about, e.g. "ticket 181 (the playtest release rows: feedback button, itch.io deploy, version number)".
- First mention of a deck or Instinct: say its archetype inline (what the Instinct does and what the deck is trying to do).
- Every card you mention gets an entry in a "Card appendix" at the end of the body: name, id, cost, element, in-game text, current power or stack numbers. (This batch should mention almost none.)
- Every number says which measurement produced it. No gut-feel labels.
- Say which checks you ran and which you did not. Do not call something done unless it was run.
- End with a numbered list headed "Decisions needed from you" (one decision per item, with the options and their numbers), or a numbered "Next steps" list if nothing is needed. Nothing long after it.
- Finish with the exact `git push` command for him, and the list of his own steps for the itch release (the page, the secret, the target).
