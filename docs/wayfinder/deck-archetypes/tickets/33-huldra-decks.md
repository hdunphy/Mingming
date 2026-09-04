# Huldra decks + STATUS_CONSUMED conversion

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-07
- Blocked by: [32-ratatoskr-decks](32-ratatoskr-decks.md) (closed)

## Question

Huldra finishes Nature. Her two OSes are the catalog's **N2 Buff-Mirror Hex** (ALLURE_PROXY mirrors
1 Weakened onto a random enemy whenever she applies a status to her own side) and **H1 Shield Wall**
(BARK_SHIELD_OS grants 50% of maxHP as a decaying shield once per battle). Both are flagged
stall-generating, and her mirror ran **54.6 turns with 151/400 decided** — so both decks are built
on a Poison clock, which is %maxHP and grinds *through* a shield rather than around it.

## Resolution

### Engine

- **`STATUS_CONSUMED` scaling on STATUS actions.** The consume half already existed; the scaling
  read was **HEAL-only**. Threading it was clean: the `consume` branch returns early, so a consume
  action can never read its own multiplier — which is exactly what guarantees the two actions
  resolve in the authored order. Added a guard so a scaled apply that resolves to zero cannot
  create a 0-stack status instance. `ash_reclamation` and `umbral_feast` unaffected.
- **`BARKSHIELD_DECAY_RETAINED` extracted** — verified a pure refactor (757/757 before and after,
  and the file restores byte-identical after the sweep).

### Cards

Six new. Every score matched the design exactly:

| card | expected | measured |
|---|---|---|
| `thorn_tithe` | 3.1 / 3.0 | **3.10** (+0.1 accepted) |
| `hexbloom` | floor; hand-priced 6.3 @ 6 stacks | **2.20** static |
| `sap_vigor` | 1.0 / 1.0 | **1.00** |
| `heartwood` | 2.5 / 3.0 | **2.50** |
| `thornguard` | 3.3 / 3.0 | **3.30** (+0.3 accepted) |
| `blightbloom` | 6.5 / 6.5 | **6.50** |

### Gate

| | §2.3 | mirror turns | mirror decided | deadCards v1/v2 | ftk |
|---|---|---|---|---|---|
| huldra before | 0.410 | **54.6** ✗ | **151/400 = 38%** ✗ | 16.1% / 16.1% | 0 |
| **huldra after** | **0.790** ✗ | **20.6** ✓ | **368/400 = 92%** ✓ | **0.0% / 0.2%** ✓ | **0** |
| ratatoskr re-gate | 0.590 | 4.7 | 400/400 | 1.2% / 3.8% | 0 |

**The two bands this pass existed to fix are fixed** — the mirror fell 54.6 → 20.6 turns and decided
games went 38% → 92%, with dead cards collapsing to near zero. Ratatoskr is bit-identical after the
shared engine changes.

## The design expectation reversed — this is the finding

§6 warned that huldra_v1 is team-leaning, allowed to be the weakest deck in the roster, and that if
its §2.3 landed **below 0.30** I should report rather than knob it.

**It landed at 0.790 — v1 is the *strongest* deck, not the weakest.** It breaches the band from the
opposite side.

The cause is that ALLURE_PROXY generates Weakened **for free** and `hexbloom` cashes the pile at a
quadratic rate. Measured: **6.8 Weakened consumed per cast** (peak on the enemy 10.8), against the 6
the card was priced at. Poison is priced `1.5·S(S+1)`, so 6.8 consumed hand-prices to **7.96 against
a 6.5 band** — 23% over, genuinely off-curve rather than band noise.

`hexbloom` reads 0.0 damage per play in the harness. That is the known DoT-attribution limit
(HANDOFF): Poison ticks at end of turn, so no card is credited for it.

## Knob rounds — one used, reverted

**Knob 1, `hexbloom` half conversion.** The named fallback, and it **failed instructively**:

| | §2.3 | mirror turns | mirror decided |
|---|---|---|---|
| full conversion | 0.790 | **20.6** | **368/400** |
| half conversion | 0.740 | **47.7** | **176/400** |

It barely touched the win-rate skew and **collapsed the mirror back to where the pass started**.
`hexbloom` was never the imbalance — it was the *clock*. Gutting it removed the Poison pressure
resolving the stall while leaving the skew untouched, because the skew comes from the OS generating
Weakened for free. Reverted, engine support removed with it.

**No second round was spent, deliberately.** Every remaining authorised lever is unusable:

- **knob 3** `thornguard` Poison is already at its maximum (3); lowering weakens v2, wrong direction.
- **knob 4** `blightbloom` Poison 5 → 6 scores **8.3 against a 6.5 band** — §7 forbids a knob that
  pushes a card over budget.
- **knob 6** `thorn_tithe` 40 → 35 is in range but its stated trigger is the mirror turn band, which
  passes. Using it to move §2.3 would be off-label — and §6 is explicit that Henry wants to *see*
  where v1 sits, not have it forced.

**This is a §8 hand-back:** closing §2.3 needs a decision that is not in §2, §3, §4 or §7. The
enabler is ALLURE_PROXY's free Weakened, not any card in the deck.

## `BARKSHIELD_DECAY_RETAINED` sweep — nothing landed

| retained/turn | §2.3 | mirror turns | mirror decided | deadCards v1/v2 |
|---|---|---|---|---|
| **0.8** (shipped) | 0.790 | 20.6 | 368/400 | 0.0% / 0.2% |
| 0.9 | 0.740 | 20.6 | 368/400 | 0.0% / 0.2% |
| 0.95 | 0.740 | 20.6 | 368/400 | 0.0% / 0.2% |

**Answering Henry's question: no, 20%/turn is not too fast.** Slowing decay four-fold moves §2.3 by
five points and the mirror not at all. Decay is not the binding constraint — incoming damage is; the
enemy chips the pool faster than it evaporates. Left at 0.8. Worth re-testing at the Earth/Ice
passes, where `glacier_wall`, `stone_bark`, `spiked_carapace` and `shield_shards` all inherit it.

## Reported, not fixed

- **`thorn_tithe`'s self-Weakened is load-bearing, not a drawback.** ALLURE_PROXY's `when` is
  `{source: SELF, target: ALLY}` with no positive-status filter, and ALLY includes self — so a
  self-debuff mirrors a Weakened onto the enemy. **Do not "fix" the missing buff filter.**
- `soothe` scores **−0.80 against a 1.0 cap**: the scorer takes `Math.abs(stacks)` before the
  debuff-on-self sign flip, so removing a debuff is priced as applying one. HANDOFF open item.
- **Cleanse feeds draugr_v1.** `soothe` fires `onStatusRemoved`, which grants an enemy draugr_v1
  +3 Strengthened. Harmless while draugr is a placeholder; worth a line for the Ice pass.
