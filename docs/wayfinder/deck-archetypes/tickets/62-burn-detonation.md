# Burn detonation rework (ticket 62): the overflow finally pays — Henry's original design, with the self-limiter it was missing

- Type: wayfinder:task — Henry-approved design (2026-08-14, off ticket 58's Fire
  investigation). This ticket IS the implementation brief; implementing session flips it
  closed and appends its Resolution.
- Status: **open — grid delivered 2026-08-14, awaiting Henry's direction pick**
- Assignee: implementation agent (grid)
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

## Amendment 1 (Henry, 2026-08-14): the FULL GRID before any direction ships

Henry's call, superseding Part 2's shipping rule: **measure every candidate configuration,
then he picks.** Nothing ships from this ticket. Part 1's mechanic description stands as the
DETONATE shape's spec; this amendment adds the competing shape and two new dimensions.
Symmetric self-burn (Henry's Part-1 ruling) applies in EVERY arm.

### The grid — 21 arms

Dimensions:
- **Shape S:** DETONATE (modulo carry per Part 1) vs VENT (stacks hold at cap; each excess
  stack pays D% maxHp immediately - the historical 0.08 design, now measured on equal terms
  rather than pre-judged).
- **Cap C:** 3 (current) / 4 / 5. Henry's concern: cap 3 may make overflow too easy to
  trigger. Higher caps use SPREAD tick tiers that keep the 8% + 5%-shred top tier identical
  and lengthen the climb (damagePercent / defShredPercent):
  - C=4: 1.5/0 · 3/1 · 5/2.5 · 8/5
  - C=5: 1.5/0 · 2.5/0.5 · 4/1.5 · 6/3 · 8/5
- **Overflow value D:** {4, 6, 8}% maxHp.

Arms: S x C x D = 18, plus TWO tick arms at the reference point (DETONATE, C=3, D=6) with
max-tier moved: tick-low 1.5/3/6 and tick-high 2/4.5/10 (Henry's per-turn-% knob, isolated),
plus the live baseline re-measured on the same instrument = **21**.

### Implementation for the grid

Refactor BurnBehavior to read shape/cap/D/tiers from named constants (one config object).
**Committed defaults reproduce today's live behavior EXACTLY** (cap 3, vent at 0.01 flooring
to zero, current tiers) - vitest must prove identity, and one scoped BALANCE_ONLY=fenrir run
must match current numbers within noise before any arm runs. Arms mutate the config in
memory, ticket-60 style.

### Instrument per arm

Field rows (10-iter) for fenrir_v2, skoll_v2, hraesvelgr_v2; detonation-or-vent events/game
and HP delivered by them; wasted-stack % (should collapse to ~0 in DETONATE arms); fenrir_v2
self-detonation HP taken; mirror turns fenrir + skoll; **FTK (0 hard, every arm)**.
draugr_v2 (2-stack applications, 0% waste today) runs in three sentinel arms only
(DETONATE C=3 D=8, VENT C=3 D=8, DETONATE C=5 D=4) to confirm it never moves - if it does,
that is a finding. ~25k games total: note the wall-clock, run overnight if needed.

### Deliverable (replaces Part 2/3 shipping + gates)

REPORT-ONLY then **STOP**: `research/burn-grid.md` (CRLF) - the 21-arm table ranked by how
far skoll_v2+fenrir_v2 move toward the window with hraesvelgr_v2's ceiling distance and FTK
alongside; a per-dimension reading (what shape does, what cap does, what D does, tick
sensitivity); Henry's questions section. ONE commit: refactor (behavior-identical) + report
+ ticket status note. The direction pick and the ship are Henry's session; a second
amendment will carry them.


---

## Grid delivered (2026-08-14) — STOPPED as specified, nothing shipped

Full write-up: [research/burn-grid.md](../research/burn-grid.md). All 21 arms measured at 10
iterations (300 decided games per deck per arm); seven leaders re-read at 30 (900). Registry
`1:8b7b0ae9`.

**The STOP condition is met: no configuration satisfies the constraint set.** At 30 iterations
the closest is `VENT-C4-D8` — fenrir_v2 **79.2%**, skoll_v2 **38.7%**, hraesvelgr_v2 **80.1%** —
which clears both Fire decks and misses hraesvelgr's ceiling by 0.1. Direction is Henry's.

What the grid settled:

- **The waste is fixable.** `unpaid stacks` goes **40.4% → 0.0%** at every D in every arm — the
  moment the overflow value rounds above zero, ticket 58's thrown-away Burn becomes damage. That
  question is closed regardless of which direction is picked.
- **Shape is the dominant dimension and it is worth ~44 field points** (VENT 78.3% vs DETONATE
  34.6% at the same C3/D8). **DETONATE has a second effect that was not in the design rationale:
  it SPENDS the pile, so the pile lives at the bottom of the tier table** — fenrir_v2's tick falls
  24.3 → 19.8 HP/game. It is not "Burn plus a burst"; it is a trade of DoT for burst.
- **Every cap-3 DETONATE arm puts skoll_v2 BELOW its live baseline** (15.7-18.7 vs 27.0), because
  skoll's Burn is mostly tick and detonation eats the ticks.
- **Burn is not skoll_v2's lever.** Across 21 arms she spans 15.1-39.0% and beats her 27.0%
  baseline in only six, all of them arms that simultaneously send fenrir_v2 to 66-82%. Confirms
  ticket 58's 18%-of-damage reading with a 21-point spread behind it.
- **fenrir_v2 is entirely steerable**: 27.6% → 79.2% on one dimension. ~6 field points per
  percentage point of D on the VENT-C4 line.
- **Cap is the only dimension that lowers hraesvelgr_v2** (cap 4: 74.0-78.7; cap 3: 79.3-82.0).
  She is at 79.7% live — at the ceiling before this ticket touches anything.
- **Tick sensitivity, isolated:** ±2pp on the max tier is worth −7.1 / +1.4 to fenrir_v2 and
  −1.6 / +5.6 to skoll_v2. Asymmetric, and it points the same way as the shape reading:
  **skoll wants tick, fenrir wants burst.**
- **Symmetric self-burn is free**: the most expensive arm charges fenrir_v2 **0.95 HP/game**; at
  cap 4 it is 0.4-0.6, at cap 5 effectively zero. Not a balance cost anywhere in the grid.
- **draugr_v2 sentinel held**: **0 overflow events in all four sentinel arms**, field 31.7-34.7
  against a 33.0 baseline. Prediction exact.
- **FTK: one, in `DET-C3-D4`** (skoll_v2, 1 of 300) — the lowest-payout arm in the set, so read
  as a fast-kill seed rather than a mechanic. Recorded, not dismissed; that arm needs a re-read
  before it could be trusted, and it is not a candidate.
- **`0-DECISION-GRADE` again: the ranking inverted between grades.** At 10 iterations
  `VENT-C4-D6` was the ONLY arm satisfying all three constraints (70.6 / 36.0 / 75.3); at 30 its
  skoll reads 33.4 and it fails, while `VENT-C4-D8` — out of bounds at 10 — becomes the leader.

**Committed: the refactor only, behaviour-identical.** `BURN_CONFIG` (shape / cap / overflow
percent / tiers) with the live values; both shapes implemented; `TacticalAI` reads the live tier
table so an arm cannot be judged against a stale one; `burnMechanic.test.ts` (15 tests) pins the
identity first and the shapes second. Scoped `BALANCE_ONLY=fenrir` reproduces the committed
numbers **exactly, not within noise**. Suite 792/60 green, `tsc -b` and `vite build` clean.

Five questions returned for Henry in the report's §10 — the load-bearing one being **which
constraint gives**, since the grid contains no arm that satisfies all three.
