# healOverride is gone, and the scorer finally understands "consume"

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-09
- Blocked by: [42-control-deck](42-control-deck.md) (closed)

## Question

Three pricing defects were recorded across tickets 39 and 42 and left for their own pass. Henry's
call on the first: **remove `healOverride` outright** — a flat heal never scales, so it is
overpowered on a low-level frame and negligible on a high-level one.

## 1. `healOverride` is removed from the data model

It was the `damageOverride` bug ticket 28 fixed for ATTACK, never applied to HEAL: `powerscale.ts`
priced the field as **curve power** while the engine treated it as **literal HP**, so every card
using it was mispriced, and none of them scaled with level.

Seven cards converted to power-based heals, each calibrated to sit at or just under its band:

| card | was | now | score / band |
|---|---|---|---|
| `healing_mist` | Heal 5 HP | Heal with 15 power | 1.00 / 1.0 |
| `healing_light` | Heal 20 HP | Heal with 45 power | 3.00 / 3.0 |
| `rejuvenation` | Draw, heal 10 HP | Draw, heal with 25 power | 3.00 / 3.0 |
| `natures_touch` | Heal side 15 HP | Heal side with 15 power | 2.50 / 3.0 |
| `dawns_respite` | Heal 10 HP + stance | Heal with 25 power + stance | 3.00 / 3.0 |
| `drain_life` | 22 power, heal 15 HP | 22 power, heal with 60 power | 6.30 / 6.5 |
| `ash_reclamation` | Heal 10 HP per stack | Heal with 30 power per stack | 2.10 / 3.0 |

**Two firmware heals had the same problem** and are now `percentMaxHP`, following ticket 32's
GOSSIP_NODE precedent: `RECURSION_DAEMON` 5 flat HP → **5%**, and `jormungandr_v2` 2 flat HP →
**2.5%**. At the balance frame those are within a fraction of a HP of what they were, so this is a
scaling fix rather than a buff — but jormungandr is the weakest deck in the roster and its OS heal
was quietly shrinking every time the level scaled.

**The field is gone from the card-facing type entirely**, along with its `HookSchema` entry, so it
cannot come back by accident. The engine-internal flat-HP path survives under an honest name —
`flatHeal` — because `applyMutations` needs it for hook and mutation heals (a `percentMaxHP` OS
heal resolves through it). Card data has no route to it.

## 2. The scorer never applied `STATUS_CONSUMED` to a heal

Ticket 33 taught the scorer that `STATUS_CONSUMED` multiplies a **STATUS** action and never told it
the same applies to a **HEAL**, so a card healing "per stack consumed" was priced as if it consumed
exactly one. `umbral_feast` **0.10 → 2.60**; `ash_reclamation` was priced as a single small heal.

## 3. The scorer had no idea what `consume` meant

A `consume: true` action fell through to the ordinary apply path, so **eating Poison off an enemy
was scored as giving them Poison** — it *added* to the card's score. Now a consume prices at
`ASSUMED_STATUS_COUNT` stacks and its score is **negated**, which lands the right sign in all four
cases once the existing buff/debuff flips have run: cleansing a debuff off yourself is a gain,
eating a debuff you placed on the enemy is a loss.

Same family as the `soothe` sign error (HANDOFF 14), which is still open and still unrelated to
`consume`.

## 4. A partial run can no longer overwrite the committed report

Ticket 17's write-guard covers `BALANCE_ONLY` scoped runs. It does **not** cover running a single
suite file, which is not scoped — so `npx vitest run --config vitest.balance.config.ts <one file>`
fell straight through and overwrote `docs/balance/` with whatever that one suite reported. It cost a
corrupted baseline during ticket 42 (17 matchups instead of 48) before it was noticed. Now: if any
expected suite did not report, the run prints what is missing and leaves `docs/balance/` alone.

## Gate

Full committed run, registry `1:cb7f0ab5`. **Redlines 45 → 45.** 766/766 tests, `tsc -b` and
`vite build` clean.

- **Gained `CARD_OVER_BUDGET ash_communion`** — 2e, **9.70 against a 6.5 band**. It is in
  **fenrir_v2**, a tuned deck. Its behaviour has not changed at all; only our ability to see it
  has, because it heals 30 power *per stack consumed* and the scorer was pricing one stack.
  **Deliberately not re-priced here**: this ticket fixes the auditor, and re-costing a live card in
  a tuned deck is a balance decision that deserves its own measurement.
- **Cleared `TURN_COUNT mirror:valkyrie`** — a real improvement, not bookkeeping. Both valkyrie
  decks run `healing_light`, which stopped being a flat 20 HP, and the mirror now finishes.

## Left open

- **`ash_communion` at 9.70/6.5 in fenrir_v2.** Wants a fenrir polish pass.
- **`soothe` scores −0.80** — removing a debuff via negative stacks still takes `Math.abs()` before
  the sign flip. Untouched here; it is a different code path from `consume`.
- **`wither_feast` now scores −1.80** (was 0.30). The consume is correctly negative and the
  `TRIGGER_STATUS` payoff is still unpriced, so the number is honest and still meaningless — the
  card is hand-priced by design.
- Henry wants a **standardised balance report**; recorded as needing a grill/prototyping session
  rather than a guessed format.
