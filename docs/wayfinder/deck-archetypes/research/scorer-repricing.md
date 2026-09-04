# The scorer repricing — the ledger got truthful and not one card moved

- Type: wayfinder:research — implementation record for **ticket 66**. **SCORER-ONLY.** Zero
  card, deck, OS or engine-behaviour changes.
- Registry **unchanged at `1:b76809c9`**. Branch `card-dev`.
- Every constant here cites [status-pile-census.md](status-pile-census.md) — 3,840 real battles.

---

## 1. The gate that matters: sections 2–3 are byte-identical

**`balance_matchups.csv` is byte-identical to HEAD's.** All 67 matchup rows, all 11 §2–3
redlines, unchanged. That is the ticket's stop condition — any battle-number movement would
have meant behaviour changed rather than pricing — and it holds exactly.

**Section 1.3: 38 → 42 redlines.** Five cards on, one off. That churn was expected and is the
point of the ticket.

---

## 2. The ledger

| card | cost | old | **new** | budget | status | why |
|---|---|---|---|---|---|---|
| **Contagion** | 2 | 1.4 | **20.4** | 6.5 | **ON** | doubles **Poison**, whose measured pile is 6.57 and whose value curve is quadratic — priced as `poison(13.1) − poison(6.6)` instead of a shared flat constant |
| **Umbral Feast** | 1 | 3.0 | **14.9** | 3.0 | **ON** | consumes **Poison**: 3 → 8 |
| **Hexbloom** | 2 | 6.3 | **16.5** | 6.5 | **ON** | `WEAKENED_STACKS` 3 → 5 |
| **Sun Devourer** | 2 | 3.2 | **8.4** | 6.5 | **ON** | consumes **Strengthened**: 3 → 8 (ticket 64 measured 7.91) |
| **Molten Core** | 1 | 2.3 | **4.1** | 3.0 | **ON** | accumulated-pile model — its 2+2 Burn is one pile of 4, not two rungs of 2 |
| Avalanche | 2 | 2.7 | 6.3 | 6.5 | under | `BARKSHIELD_STACKS` 3 → 7 |
| Heat Wave | 2 | 3.0 | 5.9 | 6.5 | under | doubles **Burn**, measured pile 2.27 — the cheap half of the split |
| **Rimebreaker** | 2 | 7.5 | **2.5** | 6.5 | **OFF** | `DISTINCT_STATUS` 3 → 1 (measured 0.70, unconditional) |
| Wither Feast | 2 | −1.8 | −10.8 | 6.5 | under | consumes the TARGET's Poison — a downside, so 8 makes it more negative |

**Nine cards moved. Every other card in the roster is unchanged.**

**Two deviations from the ticket's predictions**, both worth recording:

- **`wither_feast` did NOT enter the ledger** — the ticket expected it to. It consumes the
  *enemy's* Poison, which the scorer books as a cost, so raising the constant pushed it further
  *under* rather than over. The prediction had the sign backwards.
- **`heat_wave` did NOT enter either** (5.9 against 6.5). It doubles Burn, and Burn's measured
  pile is the smallest on the board at 2.27. **`contagion` and `heat_wave` were the pair this
  ticket split apart, and the split is 20.4 against 5.9** — they were never the same card.
- **`hexbloom` entered and was not predicted**, and it is the clearest vindication of the census:
  `powerscale.ts`'s own comment had hand-priced it at ~6.3 against a 6.5 band, which is exactly
  what it scored while `WEAKENED_STACKS` sat at 3. At the measured 5 it reads 16.5.

**Per Henry's policy, recorded verbatim:** *repricing does NOT trigger card changes in either
direction. Cards reading UNDER after honest constants stay untouched; cards entering the redline
ledger are documented as deliberate — the ledger got truthful, the cards did not change. If a
DECK underperforms later, the sanctioned buff lever is raising printed status counts,
enabler-first, AFTER this repricing settles.*

---

## 3. What changed in the scorer

**Consumed-pile assumptions** (`ASSUMED_CONSUMED_STACKS`): Burn **1.5** (unchanged, confirmed at
1.50), Poison **8**, Strengthened **8**. Fallback stays 3.

Poison is deliberately at the **conservative end** of its 8–12 band: the mean is 11.47 but
`umbral_feast`'s median is 3 against a mean of 7.58 — a long right tail, not a typical big pile
— and pricing a tail as if it were the norm is how the old constants went wrong in the first
place.

**Board-pile assumptions:** `DISTINCT_STATUS` **3 → 1** (measured 0.70, the only census number
counted *unconditionally*, zeros included — so it alone needs no floor caveat).
`WEAKENED_STACKS` **3 → 5** (5.04). `BARKSHIELD_STACKS` **3 → 7** (7.70). **`DAZED_STACKS` stays
at 3** — it is the one assumption the census vindicated at 3.62 — and ticket 32's "~10" note is
**deleted** rather than carried forward, because it was hand-derived and is measurably wrong.

**`MULTIPLY_STATUS` now reads the pile of the status it multiplies**, and prices doubling as a
*difference*: `value(pile × factor) − value(pile)`. The old model used one shared constant and
one shared per-stack rate, so a card doubling Burn and a card doubling Poison scored identically
despite piles of 2.27 and 6.57 and value curves that are non-linear in opposite directions —
Burn's flattens at its cap, Poison's is quadratic.

**Repeated applications within one card now accumulate.** A second application of the same
status to the same target is priced against the pile the first one built, not from zero.
`molten_core`'s 2 + 2 Burn is one pile of 4 (52.5) rather than two rungs of 2 (27). Keyed by
status *and* target, so 2 Burn onto each of two entities remains two independent piles — and
`priorPile` is 0 for every single-application card, which is why only `molten_core` moved.

**Burn's own pricing was not touched** — `0-BURN-PRICE-LAG` closed on 2026-08-15 and the scorer
derives those numbers from the engine.

---

## 4. Tests

One test failed and was updated rather than deleted, which the ticket asked to be listed:

- `burnPricing.test.ts` → *"the roster cards land where the census says they should"* pinned
  `umbral_feast` at **3.0**, the old Poison-consumed constant. Updated to **14.9** with the
  reason inline. Its sibling assertion — `ash_communion` at 4.1, consuming **Burn** at 1.5 — is
  unchanged, which is the whole point of that block: it proves the Burn-only scoping survived.

No other test pinned a repriced constant. `tsc -b` clean, **820 passed / 61 files**,
`vite build` clean.

---

## 5. Questions for Henry

1. **`contagion` at 20.4 against a 6.5 band is the largest overage in the game** — 3× its
   budget. The policy says the card does not change, and it has not. But it is worth knowing
   that the honest price of "double a Poison pile" at the measured 6.57 is roughly a 3-energy
   card's entire budget.
2. **`hexbloom` at 16.5** is in the same family and was hand-priced at 6.3 in a comment that is
   now four years of assumptions old. Worth a look when the Poison decks come round?
3. **Poison sits at the conservative end of its band** (§3). If `wither_feast`/`umbral_feast`
   ever get a design pass, the mean-vs-median split is the number to re-read.
4. **`sun_devourer` at 8.4** is honest now and 1.9 over budget on a card ticket 64 shipped four
   hours ago. Its sim gates all passed, so this is the ledger disagreeing with the sim — which is
   exactly the case the policy was written for, but flagging it since the card is new.
