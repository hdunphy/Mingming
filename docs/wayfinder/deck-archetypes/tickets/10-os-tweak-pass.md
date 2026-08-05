# OS tweak pass (implements the 09 verdicts)

- Type: wayfinder:task
- Status: open
- Assignee: —
- Blocked by: —

## Question

Implement the six TWEAK verdicts from the [OS design review](09-os-design-review.md), run all gates, and commit the new balance baseline. Exact edit points:

- **jormungandr_v2** (`hooks.json`, `jorm_v2_heal`) — add `"when": { "source": "SELF" }` so the heal fires only at the owner's own turn end (the fafnir_v1 pattern). Description already matches the fixed behavior.
- **kraken_v1** (`hooks.json`, `kraken_v1_hook`) — add `"source": "ALLY"` to the `when` (own side including Kraken; `ALLY` includes self per `ConditionValidator`). Keep `isNaturalDraw: false`.
- **fenrir_v2** (`hooks.json`) — description only: "Whenever Fenrir applies the Burn status **to any unit, including himself**, he gains a stack of Sharp." Behavior unchanged (decided synergy).
- **ratatoskr_v2** (`hooks.json`, `ratatoskr_v2_hook`) — add `"target": "OPPONENT"` to the `when` so self/ally-target 0-costs no longer daze Ratatoskr.
- **huldra_v2** — no code change; `HULDRA_V2_SHIELD_PERCENT = 50` is now the decided value, remove the "placeholder" wording in the comment.
- **ymir_v2** (`CustomFirmware.ts`, `ymir_v2_glacial`) — multiplier 1.5 → **1.35**; update the description ("50%" → "35%") and the `OSGapClosures.test.ts` Item 9 assertion that currently expects ×1.5.

Then: `npx vitest run` (update any assertion pinning old behavior — check `hookWiring.test.ts` for kraken_v1/ratatoskr_v2 fixtures), `npx tsc -b`, `npx vite build`, `npm run balance`; commit the regenerated `docs/balance/` artifacts with the code, and record the redline diff here as the post-tweak baseline. Expected movement: fenrir (16.7% gap, was just over cap), ratatoskr (18%), jormungandr (36%), ymir (38%) should all shrink; anything that *grows* is a finding.

Done when: all six tweaks merged green, the diff table is written into this ticket's resolution, and the map's baseline note points at the new registry hash.
