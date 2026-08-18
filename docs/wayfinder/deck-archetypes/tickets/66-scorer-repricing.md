# Scorer repricing (ticket 66): the census constants, and the scorer learns detonation

- Type: wayfinder:task - Henry-approved 2026-08-15 off research/status-pile-census.md.
  SCORER-ONLY: zero card, deck, OS, or engine-behavior changes. Sections 2-3 of the balance
  report must stay byte-identical; section 1.3 churn is EXPECTED and gets a ledger.
- Status: **closed** (2026-08-15)
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


---

## Resolution (2026-08-15) — shipped, ledger truthful, no card touched

Registry **unchanged at `1:b76809c9`** (scorer-only). Full write-up:
[research/scorer-repricing.md](../research/scorer-repricing.md).

**THE GATE: sections 2-3 are BYTE-IDENTICAL.** `balance_matchups.csv` matches HEAD's byte for
byte across all 67 rows, and all 11 §2-3 redlines are unchanged. Nothing about behaviour moved.

**Section 1.3: 38 -> 42.** Five cards on, one off, three moved and stayed under.

| card | cost | old | new | budget | status | why |
|---|---|---|---|---|---|---|
| Contagion | 2 | 1.4 | **20.4** | 6.5 | **ON** | doubles Poison (pile 6.57, quadratic curve) |
| Umbral Feast | 1 | 3.0 | **14.9** | 3.0 | **ON** | consumes Poison 3 -> 8 |
| Hexbloom | 2 | 6.3 | **16.5** | 6.5 | **ON** | WEAKENED_STACKS 3 -> 5 |
| Sun Devourer | 2 | 3.2 | **8.4** | 6.5 | **ON** | consumes Strengthened 3 -> 8 |
| Molten Core | 1 | 2.3 | **4.1** | 3.0 | **ON** | accumulated pile: 2+2 Burn is one pile of 4 |
| Avalanche | 2 | 2.7 | 6.3 | 6.5 | under | BARKSHIELD_STACKS 3 -> 7 |
| Heat Wave | 2 | 3.0 | 5.9 | 6.5 | under | doubles Burn (pile 2.27) |
| Rimebreaker | 2 | 7.5 | **2.5** | 6.5 | **OFF** | DISTINCT_STATUS 3 -> 1 |
| Wither Feast | 2 | -1.8 | -10.8 | 6.5 | under | consumes the TARGET's Poison - a cost |

**Two of the ticket's four predictions were wrong, and both are informative.** `wither_feast`
did NOT enter - it consumes the ENEMY's Poison, which the scorer books as a downside, so the
bigger constant pushed it further UNDER; the prediction had the sign backwards. `heat_wave` did
NOT enter either (5.9): it doubles Burn, the smallest board pile at 2.27. **`contagion` and
`heat_wave` were the pair this ticket split apart and the split is 20.4 against 5.9** - they
were never the same card. Unpredicted: **`hexbloom` at 16.5**, which is the census's clearest
vindication - the file's own comment hand-priced it at ~6.3, exactly what it scored while
WEAKENED_STACKS sat at 3.

**Changes:** consumed table Burn 1.5 / **Poison 8** / **Strengthened 8**, fallback 3;
**DISTINCT_STATUS 3 -> 1**; **WEAKENED_STACKS 3 -> 5**; **BARKSHIELD_STACKS 3 -> 7**; DAZED
stays 3 and the "~10" comment is DELETED; **MULTIPLY_STATUS reads the pile of the status it
multiplies** and prices doubling as `value(pile x factor) - value(pile)`; **repeated
applications within one card accumulate** (keyed by status AND target, so `priorPile` is 0 for
every single-application card - which is why only `molten_core` moved). Burn's own pricing was
NOT touched (0-BURN-PRICE-LAG stays closed).

**Test updated (one, listed as required):** `burnPricing.test.ts` -> "the roster cards land where
the census says they should" pinned `umbral_feast` at 3.0, the OLD Poison-consumed constant.
Updated to 14.9 with the reason inline. Its sibling assertion - `ash_communion` at 4.1, consuming
BURN at 1.5 - is unchanged, which proves the Burn-only scoping survived. No other test pinned a
repriced constant.

**Policy recorded verbatim per the ticket:** *Repricing does NOT trigger card changes in either
direction. Cards reading UNDER after honest constants stay untouched; cards entering the redline
ledger are documented as deliberate - the ledger got truthful, the cards did not change. If a
DECK underperforms later, the sanctioned buff lever is raising printed status counts,
enabler-first, AFTER this repricing settles.*

Gates: `tsc -b` clean, **820 passed / 61 files**, `vite build` clean, full `npm run balance`
with §2-3 byte-identical. No knobs - this ticket had no tuning surface.

Four questions returned (report §5); the load-bearing one is **`contagion` at 3x its budget**.
