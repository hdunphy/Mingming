# Type advantage: soft and asymmetric

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-08
- Blocked by: [34-regen-duration](34-regen-duration.md) (closed)

## Question

A round robin of all 16 tuned decks (3,360 games, 120 pairings) showed cross-element matchups
running **0% to 100%** — type advantage was not a tilt, it was a switch. Henry: 4x seems like a lot;
halve it, or make it non-bidirectional so being strong against someone does not also make them
useless against you.

## What the sweep found

STAB cancels in the ratio, so the 4x was entirely the reciprocal `2.0 / 0.5` pair. Both proposals
were measured, at 1,440 games each:

| adv / dis | ratio | cross-element spread | avg deviation |
|---|---|---|---|
| 2.0 / 0.5 (old) | 4.00x | 0% – 100% | 42.2 |
| halve the deviation, 1.5 / 0.75 | 2.00x | 0% – 100% | 28.8 |
| asymmetric only, 2.0 / 1.0 | 2.00x | 1% – 99% | 38.0 |
| **soft + asymmetric, 1.5 / 1.0** | **1.50x** | 5% – 95% | 30.2 |
| 1.25 / 0.8 | 1.56x | 2% – 98% | 28.3 |
| 1.15 / 0.9 | 1.28x | 5% – 95% | 27.7 |
| 1.10 / 1.0 | 1.10x | 10% – 90% | 26.6 |
| 1.05 / 1.0 | 1.05x | 11% – 89% | 27.4 |

**Halving both sides beat removing resistance alone** (28.8 vs 38.0) — asymmetry on its own leaves
the attacker at a full 2x. But the headline finding is that **no value fixes it**: a 5% edge still
produced 89/11.

**Pace is not the amplifier either.** Holding the old matrix and lengthening games:

| divisor | turns | spread | deviation |
|---|---|---|---|
| 45 (current) | 4.4 | 0% – 100% | 42.2 |
| 70 | 6.4 | 1% – 99% | 44.3 |
| 100 | 8.6 | 2% – 98% | 41.6 |

Doubling game length changes nothing, and trends slightly *worse* — more turns means less variance,
so a persistent edge converts more reliably.

**The diagnosis: a persistent multiplicative damage modifier is a win condition, not matchup
flavour.** It applies to every attack all game. Shrinking it only makes the same outcome arrive more
slowly. Fixing it properly means changing the mechanism's shape, not its size.

## Resolution — Henry chose soft + asymmetric

Advantage **1.5x** (was 2.0); resistance **removed** (was 0.5). Chosen for feel rather than for
parity: type advantage still has to encourage versatility and multiple decks for gyms and bosses, and
having your damage halved felt bad in a way that doing extra damage does not.

| | before | after |
|---|---|---|
| advantaged attacker, with STAB | 1.5 x 2.0 = 3.00 | 1.5 x 1.5 = 2.25 |
| disadvantaged reply, with STAB | 1.5 x 0.5 = 0.75 | 1.5 x 1.0 = 1.50 |
| **swing between sides** | **4.00x** | **1.50x** |

### One implementation detail that matters

**Resisted pairs are absent from the matrix, not written as `1.0`.** `getModifierBreakdown`
multiplies any *defined* secondary-element entry by `SECONDARY_MITIGATION` (0.75), so an explicit
`1.0` would silently become a **25% penalty** on a matchup meant to be neutral. Absence means "no
interaction".

Consequence: mitigation can now only scale a real advantage (1.5 x 0.75 = 1.125), so `effectiveness`
is never below 1 and **the "Not very effective..." log is unreachable** via the elemental path. The
line is left in `effectHandlers.ts` for a future matrix that reintroduces resistance; a test pins the
current behaviour so its removal has to be deliberate.

## Measured effect

Cross-element average deviation **42.2 -> 31.3**.

| element | before | after | change |
|---|---|---|---|
| Fire | 68% | 44% | -25 |
| Nature | 62% | 53% | -8 |
| Water | 34% | 30% | -4 |
| **Air** | **36%** | **72%** | **+36** |

**Air was the accidental victim of a one-way rule.** It was resisted *by* Fire while Fire had no
advantage over Air — it lost for nothing. Several pairs had that shape (`Air->Earth`,
`Water->Earth`, `Earth->Earth` self-resist). Removing resistance fixed a real asymmetry, not just
the magnitude. Nature -> Water remains the most lopsided pair at 96/4, now one-way.

Twelve tests across five files pinned the old 2.0/0.5 and were updated — including two rewritten to
assert the *new* design (no resistance, and the unreachable log) rather than the old numbers.

## Gate

All eight tuned species **unchanged** and passing every band, mirror mean 6.0 turns, FTK 0, 757/757
tests. That is the correct blast radius: §2.3 and the mirror are same-species, so the matrix never
applied to them. Registry hash is unchanged for the same reason.

Archetype gauntlet (the one cross-element suite): kraken control 41.1% -> **39.8%** over 1,500 games,
with average turns 6.3 -> 7.3. `TURN_COUNT mirror:fafnir` resolved (33.2 turns, an untuned
placeholder that fell under the 30-turn redline).

## Left open

- **Nature -> Water at 96/4** is the most extreme remaining pair. One-way now, but still decisive.
- **If cross-element ever needs to be competitive**, the shape options are: non-persistent
  (first hit each turn / once per battle), **additive** (+N flat rather than xN — self-limiting and
  non-compounding), paying out in energy or draw instead of damage, or rubber-banding the resisted
  side. Do not shave 1.5 again; the data says that path does not lead anywhere.
- Every number here is AI-vs-AI, where neither side chooses its matchup. A player picking a lead into
  a known gym is a different game, and type being decisive may read as reward-for-a-read rather than
  a coin flip at deck select.
