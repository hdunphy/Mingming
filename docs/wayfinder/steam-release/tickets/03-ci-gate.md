# CI gate: typecheck, tests, lint and build on every push (ticket 03)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [02](02-repo-hygiene.md)
- Phase: Foundations

## Deliverable

`.github/workflows/deploy.yml` only builds and deploys `main` to GitHub Pages; nothing runs the tests. Add a `ci.yml` that runs on every push and PR to any branch: `npm ci`, `npx tsc -b`, `npx vitest run`, `npm run lint`, `npm run build` (which already runs `scripts/assert-no-debug.mjs`). Keep `npm run balance` OUT of CI (11 minutes on 2 cores — see deck-archetypes ticket 108); the preview-parity suite (`src/ui/utils/previewParity.test.ts`) is part of `vitest run` and therefore becomes a standing gate for free.

Also: the committed `test_output.txt` ends in "4 failed" — establish whether the suite is green today and record the number of tests in the resolution.

## Done when

A red test blocks the GitHub Pages deploy, and the resolution records test count + wall-clock of the CI job.

## Resolution

_(open)_

