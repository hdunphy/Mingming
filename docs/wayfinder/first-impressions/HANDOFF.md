# HANDOFF — first-impressions map (keep this current every session)

*Last updated: 2026-10-02, after building ticket 182.*

## Where things stand

- **Branch `first-impressions`**, started from `main` after PR #13 merged `playtest-polish`. The two 184d commits that came after the merge were carried over (`5857fef`, `ef954a6`). `playtest-polish` is finished; don't commit to it.
- **184 is done** (184a–e, finished 2026-10-02 on this branch).
- **182 is built** (182a–d on this branch, not pushed; see its Resolution). **Stopped for Henry's report.** Next is **183a–e** (stop after 183c), then 183f–h, then 181c. Do not start 183 until Henry says go.
- **181** (playtest round 2) is the goal. It waits on 182, 183 and 181c (the "Tell Henry how it went" button, which needs Henry's Google Form first).
- **176** is blocked until 183a–c ship. **175** comes after everything else. **180** waits for Henry's go.

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

0. The 182 report's three calls: the intro is about 3 to 4 minutes (target 15 to 20, add a fight or a third leader enemy?); the Fire and Water leaders are two of one species; screenshots by hand or skip.
1. 181c: make the Google Form and its pre-filled link (181 §1.3a).
2. When to start 180 (the agent playtester).
3. On the other map: 170d, which walker fixes to build from 170c's ranked list.

## Traps on this machine

- **Git cannot unlink its own lock and temp files** through the agent's shell. After every git command, move `.git/*.lock`, `.git/objects/maintenance.lock`, `.git/next-index-*.lock` and `.git/objects/*/tmp_obj_*` into `_to_delete/git-locks/` (gitignored). `_to_delete/unlock.sh` does all of it. Leave a lock alone if it is less than a minute old: another agent may be committing.
- **Switching branches can leave files behind**, for the same reason: files the target branch doesn't have stay as untracked files, and files it changes may keep their old content while `git status` looks clean. After a switch, compare against the branch tip (`git diff --stat HEAD`, and `git cat-file --filters HEAD:<path>` to rewrite a stale file in place) before building.
- **Stage explicit paths only** (`git commit -- <paths>`). More than one agent shares this working tree.
- **Merging to `main` publishes the game** to GitHub Pages (the deploy runs on every push to `main`).
- Local git thinks the repo's default branch is `steam-release-prep`. Check a pull request's base branch before merging.

## Process

- Test first, see it fail on the parent ("fails on parent: yes" in the message), `npm run gate` green, one commit per row, last line `HANDOFF: <one sentence>`, authored as Henry, no Co-Authored-By, **no push**.
- When a ticket closes: its top status line, its `## Resolution`, and a line under "Decisions so far" in [map.md](map.md).
