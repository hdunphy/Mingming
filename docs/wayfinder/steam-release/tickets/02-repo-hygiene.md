# Repo hygiene: line-ending sweep, stray artifacts, the 7 MB Kraken (ticket 02)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: —
- Phase: Foundations

## Deliverable

Clean the working tree so every later ticket starts from a trustworthy `git status`.

1. Follow `_WARNING-line-endings.md` verbatim: `git diff --numstat | awk '$1!=$2'` must print nothing unexpected, then restore the ~160 phantom files with `git checkout --`. Delete the warning file when clean. Consider a `.gitattributes` (`* text=auto eol=crlf` for docs, or the team's choice) so the sweep cannot recur.
2. Remove or gitignore root-level artifacts that are not source: `test_results.txt` (18 MB), `test_output.txt`, `tsc_err.txt`, `tsc_errors.log`, `debug_reducer.txt`, `_repo_head.tgz`, `migrateCount.mjs`, `replaceStatus.mjs`, `update_factory*.js`, `_scratch_balance/`, `_transfer6/`, `dist/` if tracked. Keep `scratch/` only if something imports from it.
3. `src/assets/battleArt/mingming/Kraken.png` is 7.37 MB and ships in `dist/` — re-export at ≤200 KB (the other PNGs are 41–71 KB).
4. `index.html` still links `/vite.svg`; drop it for now (the real icon lands in ticket 42).

## Done when

`git status` is clean on `steam-release-prep`, `npm run build` passes, and `du -sh dist/` is reported in the resolution.

## Resolution

_(open)_

