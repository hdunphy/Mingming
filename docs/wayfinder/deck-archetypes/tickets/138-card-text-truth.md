# Ticket 138 — the card text does not always describe the card

**Type:** `wayfinder:task`
**Status:** open
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
