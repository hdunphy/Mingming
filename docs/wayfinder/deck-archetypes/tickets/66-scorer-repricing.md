# Scorer repricing (ticket 66): the census constants, and the scorer learns detonation

- Type: wayfinder:task - Henry-approved 2026-08-15 off research/status-pile-census.md.
  SCORER-ONLY: zero card, deck, OS, or engine-behavior changes. Sections 2-3 of the balance
  report must stay byte-identical; section 1.3 churn is EXPECTED and gets a ledger.
- Status: **open**
- Assignee: -
- Blocked by: run when the tree is free.

## Changes (powerscale.ts; every constant cites research/status-pile-census.md)

1. ASSUMED_CONSUMED_STACKS: Burn 1.5 (stays, confirmed), **Poison 8** (measured 11.47 mean /
   umbral median 3 - priced at the conservative end of the 8-12 band, tail documented),
   **Strengthened 8** (Henry 2026-08-15, superseding the pre-seeded 5: ticket 64's ship measured 7.91 mean / 8 median consumed in the real deck - the whole list feeds the pile, not just TREACHERY's 4.8. sun_devourer's static rises toward honest; expect it on the ledger, card unchanged per policy).
   Fallback for absent statuses stays 3.
2. **DISTINCT_STATUS: 3 -> 1** (measured 0.70 unconditional - the only zeros-counted number).
3. **WEAKENED_STACKS 3 -> 5** (5.04) - **BARKSHIELD_STACKS 3 -> 7** (7.70) - DAZED stays 3
   (3.62) and the "~10 Dazed" comment is DELETED as measurably wrong.
4. **MULTIPLY_STATUS reads the pile of the status it multiplies** (per-status board means:
   Burn 2.27, Poison 6.57, Sharp 7.61, Strengthened 5.90, Weakened 5.04, Dazed 3.62,
   BarkShield 7.70; others per the census table) - heat_wave and contagion stop sharing a
   constant.
5. ~~Burn pricing modernized~~ **ALREADY SHIPPED** (0-BURN-PRICE-LAG closed 2026-08-15 -
   the scorer derives Burn prices from the engine; do NOT touch that path). Instead:
   **fix the molten_core pile mis-model** the repricing surfaced - the scorer prices its
   2+2 application as two independent 2-stack rungs (27) where the engine builds a pile of
   4 (52.5 on the non-linear table). Model sequential applications within one action
   against the ACCUMULATED pile. Expect molten_core to read ~1.9 OVER afterward - that is
   the honest number and per the policy below the CARD does not change.
6. Note: ASSUMED_CONSUMED_STACKS already exists ({ Burn: 1.5 }, fallback 3) - items 1-4
   EXTEND the shipped structure, they do not rebuild it. Fractional-stack law applies
   (interpolate, never index - see the burnPower NaN lesson).

## Policy (Henry, 2026-08-15 - record verbatim in the Resolution)

Repricing does NOT trigger card changes in either direction: cards reading UNDER after
honest constants stay untouched; cards entering the redline ledger (expect wither_feast,
umbral_feast, contagion, heat_wave) are documented as deliberate - the ledger got truthful,
the cards did not change. If a DECK underperforms later, the sanctioned buff lever is
raising printed status counts, enabler-first, AFTER this repricing settles.

## Gates

tsc / vitest (scorer tests updated only where they pin old constants - list each) / build.
Full npm run balance: **sections 2-3 byte-identical to HEAD's report** (any battle-number
movement means you changed behavior, not pricing - STOP); section 1.3 diff presented as a
ledger table (card | old score | new score | on/off list | why). ONE commit: scorer +
report + ticket Resolution + HANDOFF refresh. No knobs - this ticket has no tuning surface.

## Deliverable

Commit hash, the 1.3 ledger, confirmation of 2-3 byte-identity, deviations - or findings
if STOPPED.
