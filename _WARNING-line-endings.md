# WARNING - do not `git add -A` from the repo root (2026-08-20)

The working tree has a LINE-ENDING SWEEP: ~160 tracked files (README, workflows, docs/Epic*,
debug_reducer.txt, TacticalAI.ts among them) show modified with insertions==deletions on
every file - pure ending conversion, ZERO content change. Likely cause: the desktop sync
layer rewrote the tree (see _incoming_bf.tgz/_repo_head.tgz artifacts). The git index is
currently lock-blocked so `git checkout --` cannot restore them.

## For the implementation agent (Legion) - cleanup, ~1 minute once your git ops work:

1. Verify nothing real is in the sweep: `git diff --numstat | awk '$1!=$2'` should print
   NOTHING outside files you knowingly edited.
2. Restore: `git diff --numstat | awk '$1==$2 {print $3}' | xargs git checkout --`
3. Confirm `git status` shows only your intended changes + docs/wayfinder work.
4. Until then: stage ONLY explicit paths you edited - never `git add -A` from root
   (docs/wayfinder adds by this session are safe - those files are current-content).
5. Delete this file when clean.
