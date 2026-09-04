# Repo hygiene: line-ending sweep, stray artifacts, the 7 MB Kraken (ticket 02)

- Type: wayfinder:task
- Status: closed
- Assignee: legion-02 (2026-08-21)
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

Closed 2026-08-21. `git status` clean, `npm run build` green, **`dist/` 8.0 MB → 1.0 MB**.

### 1. Line endings — the sweep was real, and so was its cause

`git diff --numstat | awk '$1!=$2'` printed nothing, and the stronger check `git diff --ignore-cr-at-eol --numstat` was **also empty**: all **159** modified files differed by CR-at-EOL alone, zero content change. Confirmed byte-wise on `src/main.tsx` (blob `import … 'react'\n`, worktree `…'react'\r\n`).

The ticket's step-1 restore could not run as written, for two reasons:

- **`git checkout --` is unavailable on this mount.** Every one of the 159 paths failed with `error: unable to unlink old '<path>': Operation not permitted` — the desktop VM's mount forbids `unlink`, and git's checkout removes before it writes. (In-place truncate-and-rewrite via `git show HEAD:<path> > <path>` *does* work, and was verified on `src/main.tsx`; it is the fallback if a future ticket needs a real checkout here.)
- **There was no consistent baseline to restore to.** The index was already mixed: **339 blobs stored CRLF, 340 LF, 11 mixed** (`git ls-files --eol`). Restoring the 159 would have left that split intact and the sweep would have regenerated on the next sync-layer touch.

**Henry's ruling (2026-08-21): normalize once.** New `.gitattributes` — `* text=auto eol=crlf`, explicit `binary` for image/audio/font/archive extensions, `*.sh text eol=lf` — landed together with `git add --renormalize`. Index census after: **683 `i/lf`, 3 `i/-text` (the three PNGs), 4 `i/none` (empty files), zero CRLF, zero mixed**. Because the clean filter now strips CR on the way in, a working-tree file is byte-identical to its blob whether it holds LF or CRLF, so an ending flip can no longer register as a diff in either direction. `_WARNING-line-endings.md` untracked and moved out.

Mechanical note for future sessions: `git add --renormalize -u .` over the whole tree **silently does nothing** here (it exceeds the device VM's 45-second kill and leaves the index untouched — no error surfaces). Chunk it: `git ls-files --eol | awk -F'\t' '$1 ~ /i\/(crlf|mixed)/ {print $NF}'`, `split -l 50`, then `tr '\n' '\0' | xargs -0 git add --renormalize --` per chunk — **~1 s per 50 files**. Move `.git/index.lock` to `_to_delete/git-locks/` before every git call; the mount cannot unlink it and git will not recreate over it.

### 2. Root artifacts — untracked, not deleted

The device cannot delete files, so each was `git rm --cached`'d, added to `.gitignore`, and moved to `_to_delete/ticket-02-artifacts/` for Henry to delete: `test_results.txt` (18 MB), `test_output.txt`, `tsc_err.txt`, `tsc_errors.log` (was already untracked), `debug_reducer.txt`, `_repo_head.tgz` (8.8 MB), `migrateCount.mjs`, `replaceStatus.mjs`, `update_factory.js`, `update_factory_v2.js`, `_WARNING-line-endings.md`. **These blobs remain in history** — the ticket did not authorize a history rewrite, and ~27 MB of dead objects is not worth a force-push across two other active branches. Flag it in ticket 42 if desktop packaging ever needs a clean clone.

`_scratch_balance/`, `_transfer6/` and `dist/` were already gitignored and untracked — nothing to do.

**`scratch/` stays tracked** (Henry, 2026-08-21). Nothing imports it — the only references are six *provenance comments* naming the measurement scripts that produced live constants (`scratch/drinkcensus.ts` behind `Regen: 10` in `powerscale.ts:554`, `scratch/anystatuscensus.ts` behind the 2.01 card-aim mean at `:542`, `scratch/drawcount.ts` at `:581`, `scratch/cacheproof.ts` in `cellCache.ts:25`, `scratch/weak.ts` in `CustomFirmware.ts:171`, `scratch/team109.ts` in `statusCensus.ts:55`). Untracking would leave those comments pointing at nothing. Its 76 eslint errors are handled in [ticket 03](03-ci-gate.md) by an ignore rule, not by deletion.

### 3. Kraken.png — 7.37 MB → 95 KB

Source was **2816 × 1536 RGBA**, alpha fully opaque (extrema 255/255 — as are Fenrir and Ratatoskr, so the white ground is the existing convention, not a regression). Display box is `clamp(180px, 16vw, 260px)` (`.stage-sprite-frame`, `index.css:2333`), so 512 px is 2× the largest render.

Re-exported to **512 × 279, RGB, pngquant `--quality=70-95 --speed 1` → 97,565 bytes (95 KB)**, comfortably under the 200 KB bar and in the peer band (Fenrir 71 KB, Ratatoskr 41 KB). A/B'd at display size: indistinguishable. Measured alternatives, for the record: 640 px 143 KB, 512 px PIL median-cut 256-colour 105 KB, 512 px unquantized RGB 235 KB.

### 4. `index.html`

`<link rel="icon" type="image/svg+xml" href="/vite.svg" />` removed. `public/vite.svg` is left on disk — the real icon replaces it in [ticket 42](42-desktop-packaging.md).

### Gates (sandbox container, 2 cores — comparable to Henry's device VM, not his real machine)

| Gate | Result | Wall |
|---|---|---|
| `npx tsc -b` | pass | 11 s |
| `npx vitest run` | **pass — 69 files, 868 tests** | 39 s |
| `npm run lint` | **fail — 586 errors, 2 warnings** (pre-existing; see [ticket 03](03-ci-gate.md)) | 19 s |
| `npm run build` | pass, `assert-no-debug` OK, 7 files in `dist/` | 4 s |

`du -sh dist/` — **8.0 M → 1.0 M**. Asset breakdown after: `index-*.js` 771 KB (gzip 223 KB), Kraken 96 KB, `index-*.css` 44 KB, Fenrir 72 KB, Ratatoskr 40 KB.
