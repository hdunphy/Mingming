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
   **Strengthened 5** (TREACHERY measured 4.8 - pre-seeded for sun_devourer, ticket 64).
   Fallback for absent statuses stays 3.
2. **DISTINCT_STATUS: 3 -> 1** (measured 0.70 unconditional - the only zeros-counted number).
3. **WEAKENED_STACKS 3 -> 5** (5.04) - **BARKSHIELD_STACKS 3 -> 7** (7.70) - DAZED stays 3
   (3.62) and the "~10 Dazed" comment is DELETED as measurably wrong.
4. **MULTIPLY_STATUS reads the pile of the status it multiplies** (per-status board means:
   Burn 2.27, Poison 6.57, Sharp 7.61, Strengthened 5.90, Weakened 5.04, Dazed 3.62,
   BarkShield 7.70; others per the census table) - heat_wave and contagion stop sharing a
   constant.
5. **Burn pricing modernized** (ticket-62 loose end): price applications against the CAP-4
   spread tier table (1.5/3/5/8) not the old 3-tier, plus detonation expected value - derive
   P(cap-crossing per applied stack) from the census Burn board distribution (mean 2.27,
   max 4), EV = P x 0.14 x representative maxHp; document the derivation in the comment.

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
