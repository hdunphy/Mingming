# hel_v2 Gateway rework (deep pass #3): throttled blood, %-denominated

- Type: wayfinder:task
- Status: **open** — Henry-approved design (2026-08-12); this ticket IS the implementation
  brief. Implementing session flips to closed and appends its Resolution.
- Assignee: —
- Blocked by: ticket 56 (baseline ordering). DEEP-PHASE POLICY binds. Branch card-dev;
  author Henry Dunphy <hdunphy15@gmail.com>; line-ending law; locks → _to_delete/git-locks/.

## Context

hel_v2 (UNDERWORLD_GATEWAY blood-mage): 28% field, the only deck the control beats
outright, 30% dead cards, the roster's only FTKs. Diagnosis on record: HP-casting today is
a COUNTDOWN, not a risk trade — HP never refills, the deck's only heal is ~3 HP vs ~12/cast,
so optimal play is to barely use the OS (the AI correctly discovered this); and the health
bar's depth (~90+) vs energy's 2 makes the unthrottled alpha strike the FTK engine. Design
decision (Henry): keep the risk fantasy, throttle the blood, denominate everything in
%maxHp so it is level-proof (flat HP drifts with level — the rev-3 statuses precedent).

## Part 1 — UNDERWORLD_GATEWAY replacement text (approved)

**"Hel's Dark spells cost 5% of her max HP per Energy of their printed cost instead of
Energy. She can spend at most 20% of her max HP this way each turn."**

Implementation: cost = ceil(maxHp × 0.05) × printedEnergyCost paid as HP at cast (through
the existing HP-payment path); a per-turn spent-% counter (guard-key pattern) blocks casts
that would exceed 20% — blocked casts are simply unaffordable (grey out / AI skips via the
cost check; remember HANDOFF 8d: cost hooks must run in BOTH getEffectiveCardCost consumers
AND the reducer). Remove/replace any escalating-toll remnant (8c3). Floor: a cast always
costs at least 1 HP.

## Part 2 — deck: UNTOUCHED this ticket

The Dark drain suite (leech_strike, drain_life) is the pre-identified recoup engine IF the
gate says the throttled deck still cannot sustain — that is a list change and returns to
Henry with the findings. Do not swap cards.

## Part 3 — gates (deep-phase, Henry's final numbers), knobs, docs

Field 0.35–0.80 · ≥0.60 vs control · dead ≤0.35 both sides · **FTK 0 is the headline** ·
mirror ≥60% ≤30 turns. The binds-check: report mean %maxHp spent per turn — if it never
approaches 20%, the cap is decoration (8-INERT-CAP) and that is a finding, not a pass.
**Knobs (max 2 rounds, one change per sim):** cap 20% → 25 or → 15; cost 5% → 4 (wait —
numbers move in 5s; use cap first, cost only if cap rounds exhaust, 5% → 10 is the nerf
direction). Both OS halves' SHAPE is design-frozen. tsc / vitest / build; scoped
BALANCE_ONLY=hel; full npm run balance when in band; ticket Resolution + map line + HANDOFF
refresh (queue item 3 done). ONE commit. Deliverable: hash, gate numbers, %-spent
distribution, rounds, deviations — or findings.
