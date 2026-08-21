# Huldra's payoff: a rate, not a hoard dump

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-09
- Blocked by: [40-poison-eval-horizon](40-poison-eval-horizon.md) (closed)

## Question

Ticket 40 fixed the Poison eval and huldra_v1 fell from 0.660 to **0.030**. Her old number had been
propped up by the AI over-valuing the Poison pile `hexbloom` creates; with the pile priced honestly
she read for what HANDOFF has called her since ticket 34 — a one-card deck with no real payoff.

## Two attempts that failed, and why they were the wrong shape

Henry asked for both to be measured rather than argued.

| attempt | §2.3 | the card itself |
|---|---|---|
| baseline | 0.030 | — |
| **A** — `witherstrike`, 2e, 5 power per stack of Weakened on the target | **0.000** | played 0.74/game for **2.3 damage** |
| **B** — `heartrot`, 2e, flat 65 power | **0.050** | played 2.05/game for 8.2 damage — her best card, still not enough |

**A failed because `hexbloom` eats its input.** Weakened peaks at 9.1 on the enemy, but hexbloom
consumed all of it — 6.4 stacks a cast, 1.36 casts a game. Two payoffs competing for one resource;
whichever fires first starves the other.

**B failed for the reason that turned out to matter: her damage is capped by her own enabler.**
`thorn_tithe` puts **3 Weakened on Huldra herself**, deliberately — ALLURE_PROXY has no
positive-status filter and `ALLY` includes self, so self-debuffing is how she generates the mirror.
Weakened is a *source-side* modifier, so she runs permanently at or near the −25% outgoing-damage
floor. And huldra_v2 is a **mitigation deck** (BarkShield plus `thornguard`'s Sharp). A 65-power card
lands for 8.2. **Printing power feeds a shield while she swings at three-quarters strength.**

Poison ignores both: it is %maxHP damage-over-time, so neither her Weakened nor their Sharp touches it.

## The fix — Henry's, and the half that matters is the half I would not have picked

Henry proposed two changes to `hexbloom`: stop consuming the Weakened, and/or multiply the
conversion beyond 1:1. Both were swept:

| hexbloom | §2.3 | score vs 6.5 band |
|---|---|---|
| consume, ×1 *(baseline)* | 0.030 | in band |
| consume, ×3 | 0.440 | **13.90** ✗ |
| consume, ×5 | 0.830 | — |
| no-consume, ×1 | 0.090 | 1.80 |
| **no-consume, ×2 — shipping** | **0.470** | **6.30** ✓ |
| no-consume, ×3 | 0.710 | — |

**Not consuming is what makes it price honestly.** Multiplying while still consuming reaches the win
rate but blows the card to 13.90 — it would have been the worst card redline in the registry, worse
than `entangle`. The reason is structural: a consume card's value scales with **how long you saved
up**, so the budget has no ceiling. Not consuming makes it a **rate** she re-casts off a standing
pile, which caps the per-cast value at the pile's size — so ×2 is enough, and ×2 is on curve.

New engine, ten lines: `WEAKENED_STACKS` scaling on STATUS actions multiplies `stacks` by the
target's current Weakened **without spending it**. The distinction from `STATUS_CONSUMED` is the
whole point and is commented as such.

## Gate

Full committed run, registry `1:351f623a`. **Redlines 46 -> 45** — `OS_GAP os:huldra` **cleared**,
nothing added. 765/765 tests, `tsc -b` and `vite build` clean.

| metric | before | after | band |
|---|---|---|---|
| os:huldra §2.3 | 0.030 | **0.470** (gap 0.03) | 0.30–0.70 ✓, clears strict ±15% too |
| mirror:huldra decided | 383/400 | 383/400 | ≥60% ✓ |
| mirror:huldra turns | 11.27 | 11.65 | ≤30 ✓ |
| dead cards, both sides | | 0.010 / 0.030 | ≤0.35 ✓ |
| ftk | 0 | 0 | 0 ✓ |

**Every other tuned matchup is byte-identical.** `hexbloom` appears in no other deck and
`WEAKENED_STACKS` is new, so the blast radius is exactly one species — which is what a card change
should look like.

## Left open

- **huldra_v1 is still described in the registry as "DELIBERATELY the weakest deck in the roster and
  team-leaning".** That comment predates this pass and is now questionable — she measures 0.470 in a
  1v1. Worth deciding whether she is still meant to be the team-leaning deck, or whether ticket 33's
  intent has been overtaken.
- `witherstrike` and `heartrot` were **not** added to the registry. Neither is worth keeping: A is
  structurally `slander` with a different status, and B is a vanilla body.
- **The consume-vs-read distinction generalises.** Any future "cash in a pile" card has an unbounded
  budget by construction; reading a standing resource does not. Worth a line in the curve spec if a
  second one is ever printed.
