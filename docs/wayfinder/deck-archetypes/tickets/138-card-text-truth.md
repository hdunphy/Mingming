# Ticket 138 — the card text does not always describe the card

**Type:** `wayfinder:task`
**Status:** CLOSED 2026-09-03
**Assignee:**
**Blocked by:** —
**Opened:** 2026-09-03, out of ticket 136 (Henry: *"the text discrepancies please log in another ticket"*)

---

## Why this is a balance ticket and not a copy-editing one

Every one of these was found by accident, while changing something else. Ticket 136 alone turned up
five, and one of them — Regen's glossary entry — had been wrong on **the timing, the amount, and
what a stack even is** for long enough that nobody could say when it broke:

> *"At end of turn, restores 5 HP per stack, then loses 1 stack."*

Regen ticks at the START of the turn (since ticket 126), heals a percentage rather than 5 HP, and
`stacks` are TURNS rather than intensity (ticket 34). Three facts, three errors, in one sentence
the player reads to decide whether to play the card.

That is the cost. **A player cannot make a decision the text does not support**, so wrong text is a
balance problem wearing a documentation costume — and worse, the whole roster is currently tuned
against what the ENGINE does, so a wrong description means the measured balance and the playable
balance are two different games. It is also how an agent gets misled: three separate passes in this
arc have reasoned from a card's printed text before checking its actions.

## Confirmed, with the data read

These were verified against the actual card data, not inferred.

### 1. `glass_cannon` — the recoil number is wrong and it is not close

```
description: "45 power. 20 recoil damage."
actions:     [ATTACK power 45 -> TARGET,
              ATTACK power 15 -> SELF, damageOverride: 300]
```

`damageOverride` bypasses the whole damage formula (`effectHandlers.ts:67`, `damage = damageOverride`),
so the printed `power: 15` on that action does nothing and **the card deals a flat 300 to its own
caster**. The text says 20. On the post-131c health scale that is a meaningful fraction of a frame,
and it is the single loudest item in this ticket: this is not a stale adjective, it is a card whose
drawback the player cannot see. **Decide which number is right before fixing the text** — if 300 is
the intent the description needs it, and if it is not, this is a ×10 that landed on the wrong line
and belongs in a balance commit, not a text one.

### 2. Three heals describe a percentage they do not compute

| card | description | actual |
|---|---|---|
| `crimson_draw` | "18 power. Heal 8.5% of your max HP." | `HEAL power 34` |
| `blood_rite` | "...otherwise heal 10% of your max HP." | `HEAL power 40` |
| `ember_mend` | "Heal 2.5% of your max HP." | `HEAL power 10` |

Card heals are power-based and go through `calculateHeal` (ticket 43 removed `healOverride`
deliberately, so a heal scales with the frame like every other power). A printed power is therefore
**not** a percentage of max HP — it only equals one on the exact frame somebody did the arithmetic
on. The text promises a ratio the card does not hold.

These three overlap the **flat-number DoT / Regen / heal / Bark Shield ticket** already queued
after 136 and should be resolved together: that ticket decides what the number IS, this one makes
sure the card says it. Do not fix the text here and then move the number there.

### 3. Two design comments that stopped being true under 136

- `mingmingRegistry.ts:289`, jormungandr_v2: *"attacks deal +2 per Poison stack on the target"*.
  It was +1 in the data before 136a and is +10 now. The comment has never matched anything.
- `mingmingRegistry.ts:645`, draugr_v1: *"a SLEEP turn on 2 energy ... and an AWAKE turn on 3"*.
  136d took draugr's base Energy to 3, so those turns are 3 and 4. The RHYTHM the comment describes
  is intact; its numbers are not.

## Checked and clean — do not re-derive

An automated pass compared every number in every firmware `description` in `hooks.json` against the
numbers in that firmware's own hook data, and **found no confirmed mismatch**. The candidates it
raised were all cases where the number legitimately lives elsewhere — `kraken_v2`'s "30% more" is
`multiplier: 1.3`, `draugr_v2`'s "20% less" is `multiplier: 0.8`, `gullinbursti_v1`'s "3 additional
power" is `powerBonus: 3`, and `skoll_v2` / `ymir_v2` carry `hooks: []` because they are hand-written
in `CustomFirmware.ts`. The two firmware descriptions that WERE wrong are the two 136a already
fixed (TOXIN_FANG_OS's "+1 damage per Poison stack" → "+10"), so as of today the firmware text is
believed correct.

The same pass over the 226 cards in `programs.json` raised 39 candidates and the four above are
what survived reading them. The other 35 are structural false positives — daemons whose behaviour
lives in hooks rather than actions, removal cards where the description says "remove 2" and the
action reads `-2`, and scaling cards whose per-stack rate is a constant in `ActionExecutors.ts`
(`SHARP_STACKS` is `power + 5 * stacks`, so `spike_launch`'s "+5 power per Sharp stack" is correct).

## The work

1. Fix the four confirmed items above, coordinating the three heals with the flat-number ticket.
2. **Build the check as a test, not a one-off script.** The sweep that found these is twenty lines
   of Python; a test that walks `programs.json` and `hooks.json`, compares description numbers to
   data numbers, and fails on a mismatch is the same twenty lines pointed at the future. It needs
   an explicit allowlist for the 35 structural cases — and writing that allowlist is the point,
   because each entry is a place where the text and the data are related by code rather than by
   equality, and that relationship is exactly what nobody currently writes down.
3. Extend it to the statuses. `statusGlossary.ts` is what a player reads for Burn, Poison, Regen,
   Dazed, Weakened, Strengthened, BarkShield, Energized and the duality pair, and its Regen entry
   was wrong on three counts at once with no test to catch it. Pin each entry against the engine
   constant it describes.

## Accept

The four confirmed items are fixed or explicitly ruled on; a test fails when a description number
and its data disagree; the allowlist documents every legitimate exception; and the status glossary
is pinned to the engine rather than to somebody's memory of it.

---

# Resolution — CLOSED 2026-09-03

Henry ruled on the four confirmed items directly: *"Rework glass cannon to use power. Ignore
these, they are being reworked elsewhere. Please update the stale comments."*

## 1. `glass_cannon`'s recoil is power now, and the flat 300 is gone

```
before:  { ATTACK power 45 -> TARGET }
         { ATTACK power 15 -> SELF, damageOverride: 300 }     <- power 15 was dead data
after:   { ATTACK power 45 -> TARGET }
         { ATTACK power 80 -> SELF }
description: "45 power. 20 recoil damage."  ->  "45 power. 80 power recoil to yourself."
```

**Where 80 came from, and why it is not a tuning choice.** Two independent routes agree on it.

- `powerscale.ts` has ALWAYS priced this card by converting the override to power:
  `(damageOverride / ASSUMED_MAX_HP) * 100 * POWER_PER_PERCENT_MAXHP` = `(300 / 1125) * 100 * 3`
  = **80**. So 80 is the number the balance ledger has been charging for this card since the
  conversion was written, and the card's §1.3 score is unchanged by this ticket.
- The damage formula agrees. Measured on a real skoll frame: the flat 300 is 25.3% of her max HP,
  and a power-80 self-hit at 0 Strength delivers 281–301, i.e. **24–25%**. Same card, same cost.

**What the flat number was hiding.** `damageOverride` short-circuits `handleAttack` before
`calculateDamage` (`effectHandlers.ts:67`), so the recoil ignored the caster's defense, STAB, type
effectiveness, the duality POWER term and every `onDamageCalculated` hook. A drawback that does not
care about your own stats is hidden math on the player's side of the ledger.

**And it was never 20 in the first place — it was 20 before ticket 131c.** `desperate_strike` and
`dark_pact` both carry `damageOverride: 150` under a description reading *"Deal 10 damage to
self"*, and 150 = 10 × HP_MULTIPLIER × NUMBER_SCALE = 10 × 15. glass_cannon's 300 is 20 × 15 by
the same arithmetic. So 131c scaled the override data and left all three descriptions on the old
scale. **The other two are untouched here** — this ticket's ruling named glass_cannon — and they
are the same bug in the same shape, waiting.

### What it costs, measured

Full grid, 1v1 beamless, seed base `grid`, 30 iterations (`results/rebaseline-138/`), against the
promoted post-136 numbers:

| | before | after |
|---|---|---|
| skoll_v2 (the only deck running the card) | 49.60 | **43.69** (−5.91) |
| every other deck | — | under ±0.6, largest +0.57 (jormungandr_v2) |
| roster mean / sd | 49.9 / 14.9 | 49.8 / 15.0 |
| in band (35–80) | 26/32 | **26/32**, same six decks out |

29 of 960 cells moved 5+ points — against 472 for the whole 136 package — so the change is as
contained as a single-card change should be. **skoll_v2 stays in band.** Biggest single cell:
skoll_v2 vs jormungandr_v2, −17.2.

### The interaction worth knowing about, recorded rather than fixed

A power-based self-hit now runs the full pipeline, and skoll_v2 is the deck built to hoard
Strength. Both halves of her Strength pile therefore apply to her own recoil: the duality POWER
term adds to it, and `SOLAR_OVERDRIVE_OS` (+15% per stack, **uncapped** since ticket 103)
multiplies it. Measured on one skoll frame:

| Strength held | power-80 self-hit | % of max HP |
|---|---|---|
| 0 | 281 | 24.3% |
| 1 | 381 | 32.2% |
| 3 | 442 | 38.8% |
| 5 | 609 | 52.1% |
| 8 | 726 | 61.3% |

Under the old flat override it was 25% at every stack count. So the card is now genuinely a glass
cannon — it gets more dangerous to its owner exactly as her engine spins up — which reads as the
card's intent, and the −5.9 field cost says the AI is already declining to play it into a big pile
rather than killing itself. **Not tuned, because it was not in the ruling and because the grid says
it does not need it.** If Henry wants the recoil to ignore offensive buffs, that is a new engine
concept (a self-facing damage flag), not a number.

## 2. The three percentage heals — MOVED, not fixed

`crimson_draw`, `blood_rite` and `ember_mend` print a percentage of max HP over a power-based heal.
Henry: *"Ignore these, they are being reworked elsewhere."* They belong to the flat-number
DoT / Regen / heal / Bark Shield ticket, which decides what the number IS; fixing the text here
would have to be undone there. **No change made.**

## 3. The two stale comments — fixed

- `mingmingRegistry.ts`, jormungandr_v2: *"attacks deal +2 per Poison stack on the target"* →
  **+10**, which is what 136a shipped. The comment had never matched the data in either direction.
- `mingmingRegistry.ts`, draugr_v1: the sleep rhythm read *"a SLEEP turn on 2 energy ... and an
  AWAKE turn on 3"*. 136d took the frame to 3 Energy, so those turns are 3 and 4. The rhythm is
  unchanged and the comment now says so, including the part that stopped being true: the wake still
  banks a point, it is just no longer what makes `barrow_king` castable.

## What this ticket asked for and did NOT get

The ticket's items 2 and 3 — **build the sweep as a test with an allowlist, and pin the status
glossary to the engine constants** — were not built. The ruling was on the findings, not on the
guard. That is the item worth re-opening, because everything above was found by accident while
changing something else, and the sweep is the only part of this ticket that stops the next one
being found the same way. The 35 structural false positives are catalogued above, which is most of
the work of writing the allowlist.

Also still open by omission: `desperate_strike` and `dark_pact` carry the identical
`damageOverride`-vs-description defect and were left alone.
