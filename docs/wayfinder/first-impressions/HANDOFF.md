# HANDOFF — first-impressions map (keep this current every session)

*Last updated: 2026-10-04, after the gate passed at `2caa83e` and `npm run overnight` landed.*

## Where things stand

- **GATE STATUS (2026-10-04): `npm run gate` passed at `2caa83e`, which is `origin/first-impressions`.** Henry ran it and pushed. Everything through that commit is pushed and gated, including 193 and its follow-ups (the real combat log's `Kraken (foe)`, the playtester's `plain()` words), 185, 183, 189, 190, 192 and 176: ignore the "not pushed" and "run `npm run gate`" lines below for work at or before `2caa83e`. After it: `d12f515` (`npm run overnight`, a Node script with its own test; this commit has not been through the gate yet) and docs commits. Run `npm run gate` again before the next push.
- **195 in progress** (2026-10-05, the fixes from the overnight night; ticket in `tickets/195-overnight-night-fixes.md`). Built so far, one commit per row on this branch, not pushed: 195a (Bark Smash 6 to 5 a point, Bark Smash+ 10 to 8; Huldra's opening-fight read is 98% before and after, because Bark Smash is not in her start kit), 195l (the night's session limit is 35 minutes in both scripts), 195j (the night prompt names the results folder with forward slashes, so Git Bash cannot eat the backslashes; a missing session now says where it looked and to check --results), 195k (each starter plays the gym its element beats; **nights before and after 195k are not comparable on win rate**, because the matchups changed), 195b (the first Trace a save gains says "Summon it in the Den.", once per save, on the fight's Trace list, the Wild Tracks pick, a shop Trace and the gym payout; new ranch field `traceHintShown`, default false, no version bump), 195c (the run's status line says "Traces N" in the game and `traces N` in the tool, from one `tracesHeld` count that the Den tile reads too), 195d (the Den's Summon option says "+5 cards to your deck", card names on hover; the bench button says its cards go to the collection; the tool's Den says the same). Henry's machine: delete the two stray `resultsplaytest2026-10-0*-haiku/` folders at the repo root. Run `npm run gate` once before pushing; the Linux copy cannot run `vite build`.
- **Branch `first-impressions`**, started from `main` after PR #13 merged `playtest-polish`. The two 184d commits that came after the merge were carried over (`5857fef`, `ef954a6`). `playtest-polish` is finished; don't commit to it.
- **184 is done** (184a–e, finished 2026-10-02 on this branch).
- **193 is built** (2026-10-04). 193a–f and 193h–k are committed on this branch, one commit per row (`9782d4c`, `5ca0c60`, `146308c`, `046b685`, `e4ec4bf`, `ca9cefd`, `1d301c6`, `75f60a4`, `51400cf`, `713b9c5`), not pushed (give Henry `git push origin first-impressions`). The engine change is small (a card-less zap is not an attack, so a Driver's hook cannot crash on it); the rest is the playtester tool plus the run forecast in the game. `tsc`, `eslint src` and the whole vitest suite are green on a Linux copy except `runWalker.scrap` 174d (red on the parent too); `npm run gate` could not run there. **Henry still has to:** run `npm run gate`, run Night A and Night B (commands in the ticket's Resolution), and rule on a primed brief from their reports. See the ticket's `## Resolution`. **Follow-ups the same day:** the real combat log names a mirror foe `Kraken (foe)` (`237faa8`), the playtester prints the game's `plain()` words (`a7f3264`; revert it for an A/B on the old words), and `npm run overnight` runs both nights in one command (`d12f515`; it replaced `scripts/overnight.sh`, which did not start under PowerShell because `bash` there is WSL with no distro).
- **185 is done** (2026-10-04). 185a–f (the Strength engine nerf, rewards that know your deck, the tier-unlocked line) are built and committed on this branch (`1a33f6f`, `f699f7a`, `be5c9ae`, `8a31148`, `12c3338`, `0bc056d`), plus Henry's rulings on the findings (`78727d7`, `0c7add2`), not pushed (give Henry `git push origin first-impressions`). `tsc`, `eslint src` and the whole vitest suite are green on a Linux copy except `runWalker.scrap` 174d, which fails the same way on the parent; `vite build` and `npm run gate` could not run there, so run `npm run gate` once. **Henry ruled the knock-ons too** (Adrenaline and Hamstring stay contact cards, Gullinbursti's lost priming is fine, Hexbloom+ stays a Status). **Henry still has to:** regenerate the design record's page and registry (`npm run decks`, then `python build.py`).
- **182 is done and closed** (182a–d on this branch, last commit `507a824`, not pushed; see its Resolution). Then 183, below.
- **183 is done and closed** (2026-10-03). 183a–h and Henry's review follow-ups were gated green on this branch (`936ae5f`); **183i** (the 33 Norse Instinct names, Henry: "accept all") is committed as `22bdff8`, UI only. Not pushed (give Henry `git push origin first-impressions`). `tsc`, `eslint src/ui` and the `src/ui` and `src/App` tests are green on a Linux copy for 183i; run `npm run gate` once locally. See its `## Resolution`. Next is 181c.
- **189 work for tonight is complete** (2026-10-03). 189a-e ("Hits land when they land", UI only) are built and committed on this branch (`c7b9732`, `3ecee26`, `412a991`, `43986c7`, `b9090cf`), not pushed. Nothing under `src/engine` changed. The tests, `tsc` and `eslint src/ui` are green on a Linux copy; `npm run gate` itself and the `sfxSamples` audio check could not run there, so run `npm run gate` once locally. **190 can start.** The enemy's turn is now slower on purpose (each enemy card hovers 1 s before it attacks); speed tiers are 190's job.
- **190 work for tonight is complete** (2026-10-03). 190a-g (the five battle speeds, the new attacks, impacts, status landings and big-hit extras, UI only) are built and committed on this branch (`12fd7b6`, `974a757`, `984a309`, `c9ea81f`, `0b4719e`, `4d42c7d`, `df0e105`, plus the test repair `204d9bb`), not pushed (give Henry `git push origin first-impressions`). Nothing under `src/engine` changed. The tests, `tsc` and `eslint src/ui` are green on a Linux copy; `npm run gate` could not run there, so run it once locally, and nobody has looked at the effects in a real browser yet. 190h stays parked. See its `## Resolution`.
- **192 is done** (2026-10-03): the Auras and Runes show their Norse names and the Feedback token is Tattle (`25e9c5c`, not pushed; see `tickets/192-aura-and-rune-names.md`). **Henry still has to:** run `npm run gate` (the whole engine suite was not run in one go) and regenerate the `collection-v2` design record on his machine, which still shows the old names.
- **176 work for tonight is complete** (2026-10-03). 176a-f (towns joined by branching one-way routes) are built and committed on this branch (`21136ad` for 176a-c together, `59f2906`, `90717f0`, `fab718e`), not pushed (give Henry `git push origin first-impressions`). `tsc`, `eslint src` and the `src/ui`, `src/debug/playtest` and `src/engine/run` tests are green on a Linux copy; `npm run gate`, `vite build` and four slow tests (ghostWalk's three gauntlet tests and `runWalker.scrap`) could not run there, so run `npm run gate` once locally. **Henry still has to look at the map in the desktop app** (the look is his call). The measured run is 11.6 fights before the gym (with the start-node fight) against a target of 8 to 10; Henry said to keep it for now. **New 2026-10-03 (Henry's ruling): a new run opens straight into the start node's fight** (`openingFight.ts`); see `docs/balance/map-176.md`. See the ticket's `## Resolution`.
- **181** (playtest round 2) is the goal. It waits on 181c–e (the "Tell Henry how it went" button; the Google Form exists and its pre-filled link template is in 181c, so nothing waits on Henry) and on Henry's look at the 176 map (Henry: 176 is in the playtest build). 182 and 183 are done.
- **176 is built** (see above). **175** comes after everything else. **180** waits for Henry's go.

## Two agents in parallel (from 2026-10-02): same folder, same branch, careful

Two agents work at once **in this one folder, on branch `first-impressions`** (Henry chose no separate worktree). That works only if both follow these rules.

| | Agent A: the screens | Agent B: the agent playtester |
|---|---|---|
| Tickets | 182 → 183a–e → 183f–h → 181c | 180 only |
| Owns | everything under `src/` **except** `src/debug/playtest/`; this map, this HANDOFF, every ticket except 180 | `src/debug/playtest/`, `scripts/playtest-*.mjs`, `docs/playtest/`, ticket 180, `HANDOFF-180.md` |
| Shared files | must not touch `package.json` scripts or `.gitignore` | may add only its own `playtest*` script lines to `package.json` and its `results/` line to `.gitignore` |

- **Never switch branches, and never run anything that touches the whole working tree:** no `git checkout -- .`, `git restore .`, `git reset`, `git stash`, `git clean`, `git add -A` / `git add .` / `git commit -a`, and no repo-wide `eslint --fix` or formatter.
- **Stage and commit your own files by explicit path only** (`git commit -- <paths>`). Before committing, `git status` and check that every path you commit is yours.
- **Never edit, revert or "fix" a file the other agent owns,** even if it breaks your build. B never changes game code (ticket 180, rule 3); a bug B finds goes in its report.
- **The gate runs on the whole tree, including the other agent's unfinished work.** If `npm run gate` fails only in the other agent's files, wait a few minutes and run it again. If it stays red for more than about 20 minutes, stop and tell Henry. Don't commit on a red gate.
- **Keep work-in-progress short.** Finish a row and commit it rather than leaving half-done edits sitting in shared files for hours.
- **B never edits this HANDOFF or `map.md`.** Its progress goes in ticket 180 and `HANDOFF-180.md`.
- **B's tests must not pin on-screen wording:** 182 rewrites the copy and 183h renames the words.
- **Locks:** never move a git lock file that is less than a minute old; it may be the other agent's commit in progress.
- **Neither agent pushes, merges or rebases.** Henry pushes.

## What Henry owes

0. Nothing open from 182. (Not blocking: the Fire and Water leaders are two of one species; Ratatoskr clears the intro 70% of the time. His own intro timing comes from 181 Phase 1.)
1. ~~181c: make the Google Form and its pre-filled link (181 §1.3a).~~ **Done 2026-10-02**: the form exists (`https://forms.gle/XSnrVrcADbyTkruA9`) and 181c has its pre-filled link template. Nothing for Henry here.
2. When to start 180 (the agent playtester).
3. On the other map: 170d, which walker fixes to build from 170c's ranked list.
4. Retune the reward multipliers (×2, ×3) after play.
5. Run the two playtest nights for 193 (haiku, then sonnet, on the 2026-10-04 seeds; commands in [193's Resolution](tickets/193-playtest-nights-findings.md)), and rule on a primed brief from their reports. Reword the forecast sentence if he wants.

## Traps on this machine

- **Git cannot unlink its own lock and temp files** through the agent's shell. After every git command, move `.git/*.lock`, `.git/objects/maintenance.lock`, `.git/next-index-*.lock` and `.git/objects/*/tmp_obj_*` into `_to_delete/git-locks/` (gitignored). `_to_delete/unlock.sh` does all of it. Leave a lock alone if it is less than a minute old: another agent may be committing.
- **Switching branches can leave files behind**, for the same reason: files the target branch doesn't have stay as untracked files, and files it changes may keep their old content while `git status` looks clean. After a switch, compare against the branch tip (`git diff --stat HEAD`, and `git cat-file --filters HEAD:<path>` to rewrite a stale file in place) before building.
- **Git cannot rename over an existing file here either**, so `git update-ref`, `git commit` and index writes fail with "Operation not permitted" and leave a `.lock`. 185 built its commits with plumbing (a private `GIT_INDEX_FILE`, `git hash-object -w --path=<file>`, `commit-tree`), wrote the branch ref and `.git/index` in place (`cat new > file`), and parked the leftovers in `_to_delete/git-locks/`.
- **Stage explicit paths only** (`git commit -- <paths>`). More than one agent shares this working tree.
- **Merging to `main` publishes the game** to GitHub Pages (the deploy runs on every push to `main`).
- Local git thinks the repo's default branch is `steam-release-prep`. Check a pull request's base branch before merging.

## Process

- Test first, see it fail on the parent ("fails on parent: yes" in the message), `npm run gate` green, one commit per row, last line `HANDOFF: <one sentence>`, authored as Henry, no Co-Authored-By, **no push**.
- When a ticket closes: its top status line, its `## Resolution`, and a line under "Decisions so far" in [map.md](map.md).

- **183 status (2026-10-03): DONE** (183a–i). See the line above and the ticket's Resolution.
- **189 status (2026-10-03): DONE.** See the line above.
- **190 status (2026-10-03): DONE** (190a-g; 190h parked). See the line above and the ticket's Resolution.
- **185 status (2026-10-04): DONE** (185a–f). See the line above and the ticket's Resolution.
- **193 status (2026-10-04): BUILT** (193a–f, h–k; 193g is rulings only). The two follow-up nights are Henry's. See the line above and the ticket's Resolution.
