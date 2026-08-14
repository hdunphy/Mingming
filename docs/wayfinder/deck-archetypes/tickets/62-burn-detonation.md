# Burn detonation rework (ticket 62): the overflow finally pays — Henry's original design, with the self-limiter it was missing

- Type: wayfinder:task — Henry-approved design (2026-08-14, off ticket 58's Fire
  investigation). This ticket IS the implementation brief; implementing session flips it
  closed and appends its Resolution.
- Status: **open**
- Assignee: —
- Blocked by: run AFTER ticket 61 (one worker per tree; 61 re-baselines first).
- DEEP-PHASE POLICY binds. Branch card-dev; author `Henry Dunphy <hdunphy15@gmail.com>`;
  line-ending law; locks → `_to_delete/git-locks/`.

## Context

Ticket 58 measured: 32.1% of ALL Burn applied roster-wide is wasted at the 3-stack cap,
and `BURN_OVERFLOW_PERCENT = 0.01` floors to zero on every current frame — 0 damage paid
on 54,767 requested stacks. The mechanic's history is in the BurnBehavior comment block:
overflow originally paid 0.08 (full max-tier rate) PER EXCESS STACK with the target
staying at cap, which let decks farm a capped target forever — measured as ~half of
fenrir_v2's output, turn-3 games. It was floored to zero instead of redesigned. Henry's
redesign restores the burst WITH the self-limiter the old version lacked: **detonation
resets the pile, so detonation rate is bounded by application rate ÷ 3, not by every
excess cast.**

## Part 1 — the mechanic (`src/engine/StatusBehaviors.ts`, `BurnBehavior.onApply`)

New rule, replacing the current overflow branch:

- `total = currentStacks + incomingStacks`. **While `total > 3`: one DETONATION fires and
  `total -= 3`.** Remaining `total` is the new stack count.
  - 3 existing + 1 incoming = 4 → one detonation, 1 stack remains.
  - 3 + 4 = 7 → TWO detonations, 1 remains. 3 + 3 = 6 → one detonation, 3 remain (6−3=3,
    not >3 — exactly-divisible stays at cap).
  - Single-stack appliers (`ignite`) therefore detonate at most every 3rd cast into a hot
    target — the rebuild rhythm is the balance mechanism; do not special-case them.
- **Each detonation deals `floor(maxHp × D)` immediate damage to the BURNED entity** —
  %-denominated (level-proof by construction, same as the tick), bypasses defense like
  the old burst did. `D` is the sweep value (Part 2); implement as one constant
  `BURN_DETONATION_PERCENT`.
- **SYMMETRIC (Henry's ruling): self-applied Burn detonates on yourself.** No
  source-dependent branch — the burned entity takes the detonation, full stop.
  `pyre_sacrifice` becomes a managed bomb; `ash_communion` becomes its release valve
  (eats stacks pre-detonation) WITHOUT any text change — do not touch ash_communion,
  its scorer price, or any card this ticket.
- Tick tiers, 1-stack/turn decay, and the cap of 3: **UNTOUCHED.**
- Log per detonation: `  🔥 {target} — Burn overload! Detonation deals {n} damage`.
- Rewrite the BURN_OVERFLOW_PERCENT comment block: keep the 0.08 history, add the
  rev-note that detonation-with-carry is the redesign and why the reset bounds it.
- `docs/power_curve_spec.md`: append the Burn detonation rev note to the Burn passage
  (match the file's endings).

## Part 2 — the sweep, then ship one value

Arms: **D ∈ {0.04, 0.06, 0.08}** (all pre-approved; anything else → STOP). In-memory per
arm, ticket-60 style. Instrument per arm: field rows for **fenrir_v2, skoll_v2,
hraesvelgr_v2, draugr_v2** (every Burn applier), detonations/game per deck,
self-detonation damage taken (fenrir_v2 — the symmetric rule's cost, report it
explicitly), mirror turns, **FTK (hard 0 in every arm)**.

**Shipping rule:** pick the D that moves skoll_v2 and fenrir_v2 furthest INTO 0.35–0.80
subject to: hraesvelgr_v2 ≤ 0.80 and FTK 0. Confirm the shipped arm at 30 iterations
(`0-DECISION-GRADE`). Predicted shapes (guides, not gates): skoll_v2 +2-3 detonations/game
≈ +12-14 HP; fenrir_v2 is the volatile one (53.8% waste becomes fuel, molten_core's 64%
waste becomes its function). **If fenrir_v2 overshoots the window at every D, or no D
satisfies the rule → STOP with the table; that is Henry's session, not a knob.**
draugr_v2 (0% waste, 2-stack applications) should not move beyond noise — if it does,
report why before committing.

## Part 3 — gates, docs, commit

Unit tests (LF): detonation count math (4 / 6 / 7-stack cases above), carry correctness,
symmetric self-burn, log lines, and the old zero-overflow tests updated. `npx tsc -b` ·
`npx vitest run` (suite AFTER last edit) · `npx vite build` · scoped runs:
`BALANCE_ONLY=fenrir`, `=skoll`, `=hraesvelgr` (all bands: control ≥0.60, dead ≤0.35 both
sides, mirror ≥60% ≤30 turns, FTK 0; §2.3 diagnostic-only). Full `npm run balance`;
8-DIFF the table — Burn touches four species, everything else stays inside noise; the
control applies no Burn, so control rows must NOT move. ONE commit: engine + tests +
spec note + report + ticket Resolution + map line + HANDOFF refresh (include: floor-list
membership is now decided at 150 iterations — the fenrir_v1 seed-spread finding). Message:
`Burn detonation (ticket 62): overflow pays again - D% maxHp per cap-crossing with modulo carry, symmetric self-burn; the 32% waste becomes the payoff`

## Deliverable

Commit hash, the three-arm sweep table (all four Burn decks × all metrics), shipped D
with 30-iteration confirm, fenrir_v2's self-detonation cost, all gate numbers,
deviations — or findings if STOPPED.
