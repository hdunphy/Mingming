# CI gate: typecheck, tests, lint and build on every push (ticket 03)

- Type: wayfinder:task
- Status: closed
- Assignee: legion-02 (2026-08-21)
- Blocked by: [02](02-repo-hygiene.md)
- Phase: Foundations

## Deliverable

`.github/workflows/deploy.yml` only builds and deploys `main` to GitHub Pages; nothing runs the tests. Add a `ci.yml` that runs on every push and PR to any branch: `npm ci`, `npx tsc -b`, `npx vitest run`, `npm run lint`, `npm run build` (which already runs `scripts/assert-no-debug.mjs`). Keep `npm run balance` OUT of CI (11 minutes on 2 cores — see deck-archetypes ticket 108); the preview-parity suite (`src/ui/utils/previewParity.test.ts`) is part of `vitest run` and therefore becomes a standing gate for free.

Also: the committed `test_output.txt` ends in "4 failed" — establish whether the suite is green today and record the number of tests in the resolution.

## Done when

A red test blocks the GitHub Pages deploy, and the resolution records test count + wall-clock of the CI job.

## Resolution

Closed 2026-08-21. `.github/workflows/ci.yml` added, `deploy.yml` rewired to call it.

### Is the suite green?

**Yes — 69 test files, 868 tests, 0 failures, 39 s** (`npx vitest run`, sandbox container, 2 cores). The committed `test_output.txt` ending in "4 failed | 1 passed" was a **stale partial run**, not the suite's state; ticket 02 untracked the file so nobody reads it as truth again. `src/ui/utils/previewParity.test.ts` (3 tests) is in that count, so preview-vs-actual parity is now a standing gate exactly as the ticket intended.

### Baseline for every gate

Measured on a 2-core sandbox container — comparable to Henry's device VM, **not** his real machine, and GitHub's `ubuntu-latest` runners are faster than both.

| Gate | Result | Wall |
|---|---|---|
| `npm ci` | pass | ~35 s cold, cached by `setup-node` after the first run |
| `npx tsc -b` | pass | 11 s |
| `npx vitest run` | **pass — 69 files / 868 tests** | 39 s |
| `npm run lint` | **fail — 510 errors, 2 warnings** | 17 s |
| `npm run build` | pass, `assert-no-debug` OK, 7 files in `dist/` (1.0 MB) | 4 s |

Expected CI job wall-clock: **~2 min** on a warm npm cache.

### The one ticket assumption that did not hold: lint

The ticket assumed `npm run lint` could join the blocking set. It cannot — the tree failed it with **586 errors / 2 warnings** before this ticket and **510 / 2** after `scratch/` moved into eslint's `globalIgnores` (ticket 02's ruling: `scratch/` stays tracked for its provenance comments, but its 76 throwaway-harness errors do not belong on the CI surface). Breakdown: `no-explicit-any` 296, `no-unused-vars` 154, `prefer-const` 33 (all auto-fixable), `react-hooks/*` 18, `no-case-declarations` 3. By area: `src/engine` 398, `src/ui` 81, `src/debug` 30, `scripts` 2, `App.tsx` 1.

Options put to Henry with those numbers; **his ruling: lint runs non-blocking now, and the burndown gets its own ticket** — [55 Lint burndown](55-lint-burndown.md), which owns the 510 and flips `continue-on-error` off when it closes. The rejected alternative worth recording: downgrading `no-explicit-any` + `no-unused-vars` to warnings would have left 62 blocking errors (33 auto-fixable) and a hard lint gate from day one, at the cost of two rules going permanently soft.

Everything else in the gate is **hard-blocking from the first push**.

### How a red test blocks the deploy

`ci.yml` carries three triggers: `push` (with `branches-ignore: [main]`), `pull_request` (all branches), and **`workflow_call`**. `deploy.yml` now opens with a `ci` job that is `uses: ./.github/workflows/ci.yml`, and `build_site` declares `needs: ci`. So a push to `main` runs the whole gate first and only publishes to Pages if it passes; the gate lives in exactly one file, so the deploy path and the branch path can never drift. `branches-ignore: [main]` exists so a push to `main` does not run every gate twice.

`deploy.yml`'s `npm install` also became `npm ci`, so the artifact that ships is built from the same lockfile the gate just tested.

Also added: `concurrency: cancel-in-progress` per branch (a force-push mid-run cancels the run it superseded), `timeout-minutes: 20`, `permissions: contents: read`, and a `$GITHUB_STEP_SUMMARY` line that names ticket 55 whenever lint is red, so the advisory step cannot quietly become invisible.

`npm run balance` is **not** in CI, as instructed — 11 min on 2 cores. It stays manual until deck-archetypes ticket 108 optimizes the pipeline (map § fog, "Nightly long-balance run in CI").

### Verification

`actionlint` v1.7.12 clean on both workflow files (exit 0); both parse as valid YAML with the expected job graph (`ci` → `build_site` → `deploy`). The gate sequence itself was executed end-to-end in the sandbox from a fresh `npm ci` — the numbers in the table above are that run, not estimates. What could **not** be verified from here is a real GitHub run: the reusable-workflow call and the Pages permissions inheritance are exercised the first time Henry pushes `steam-release-prep`. If the `ci` job errors with a permissions complaint, add `pages: write` / `id-token: write` to the `permissions:` block on the `ci` job in `deploy.yml`.
