# HANDOFF — first-impressions map (keep this current every session)

*Last updated: 2026-10-02, at the split from deck-archetypes.*

## Where things stand

- **Branch `first-impressions`**, started from `main` after PR #13 merged `playtest-polish`. The two 184d commits that came after the merge were carried over (`5857fef`, `ef954a6`). `playtest-polish` is finished; don't commit to it.
- **184 is done** (184a–e, finished 2026-10-02 on this branch).
- **182 is next to build.** It is fully ruled and has no blockers. Then **183a–e**, then 183f–h (183f and 183h after 182 lands).
- **181** (playtest round 2) is the goal. It waits on 182, 183 and 181c (the "Tell Henry how it went" button, which needs Henry's Google Form first).
- **176** is blocked until 183a–c ship. **175** comes after everything else. **180** waits for Henry's go.

## Two agents in parallel (from 2026-10-02)

Two agents work at once, **each in its own git worktree on its own branch**, so neither can switch the other's branch, stage the other's files or run the gate against the other's half-done code.

| | Agent A: the screens | Agent B: the agent playtester |
|---|---|---|
| Folder | `Mingming-Balancing` (this one) | `Mingming-Balancing-180` (a git worktree) |
| Branch | `first-impressions` | `agent-playtester` (made from `first-impressions`) |
| Tickets | 182 → 183a–e → 183f–h → 181c | 180 only |
| Owns | everything under `src/` **except** `src/debug/playtest/`; this map, this HANDOFF, every ticket except 180 | `src/debug/playtest/`, `scripts/playtest-*.mjs`, `docs/playtest/`, ticket 180, `HANDOFF-180.md` |
| Shared files | must not touch `package.json` scripts or `.gitignore` | may add only its own `playtest*` script lines to `package.json` and its `results/` line to `.gitignore` |

- **B never changes game code** (ticket 180's rule 3). A bug B finds goes in its report, for A or Henry to fix.
- **B never edits this HANDOFF or `map.md`.** Its progress goes in ticket 180 and `HANDOFF-180.md`.
- **B's tests must not pin on-screen wording**: 182 rewrites the copy and 183h renames the words. B prints whatever the game's own modules print.
- **Neither agent merges, rebases, switches branch or pushes.** Henry merges `agent-playtester` into `first-impressions` (`git merge --no-ff agent-playtester`) only while A is stopped at a ticket checkpoint, then pushes.
- **Locks:** both worktrees share one `.git`. Never park a lock younger than a minute; it may be the other agent's.

## What Henry owes

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
