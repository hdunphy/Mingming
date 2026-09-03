# Ticket 137 — TacticalAI still prices Regen at 3% after the engine moved to 2%

**Type:** `wayfinder:task`
**Status:** open
**Assignee:**
**Blocked by:** —
**Opened:** 2026-09-03, out of ticket 136 (Henry: *"open the AI Regen ticket"*)

---

## The one-line version

Ticket 136b took Regen from 3% of max HP per turn to 2%. `TacticalAI.ts` has its own copy of that
number, it was not on 136's authorized list, and it was deliberately left alone — so **the AI now
believes Regen is worth 50% more than Regen actually pays.**

## Where it is

`src/engine/ai/TacticalAI.ts`, line 176, in the status evaluation:

```ts
case 'Regen':
    // 3% maxHp x stacks per tick, decrementing; healing past full is wasted,
    // so the total is capped at the holder's missing HP.
    // Ticket 34: flat 3%/turn for `s` turns - LINEAR in stacks, not triangular.
    return HP_POINTS * Math.min(0.03 * s * entity.maxHp, entity.maxHp - entity.currentHp);
```

The engine, `src/engine/StatusBehaviors.ts`:

```ts
const REGEN_PERCENT_PER_TURN = 0.02;   // was 0.03 until ticket 136b
```

The comment above the AI's line is stale in the same way and says 3% twice.

## Why it was not fixed in 136

Two reasons, both deliberate, both worth writing down before somebody "fixes" this without
reading them.

1. **136 was a ruled package with no authorized number knobs.** The instruction was explicit —
   *"Do not touch card power, cost, or any number not listed above"* — and this constant was not
   listed.
2. **More importantly: 136's 32 measured targets were produced with the AI at 3%.** The whole
   package was measured on a build where the engine paid 2% and the AI valued 3%. Changing this
   line changes what the AI chooses to play, so **it will move the grid**, and 136's numbers would
   no longer be reproducible from the shipped code. It had to be its own change with its own
   measurement, which is this ticket.

## What it actually costs, and why that is not obvious

Regen's engine value is the healing. The AI's value is what decides whether it *plays* a Regen
card at all, or holds one, or plays around an opponent's. The 50% error is therefore not "the AI
mis-scores a status by a bit" — it is a thumb on the scale in every hand containing a heal, and
the decks it lands on are not evenly spread. The Regen-heavy decks are **audhumbla** (her whole
GENESIS package is Regen-as-ammo — ticket 101 grants 2 Regen per heal and `drink_deep` cashes the
pile), **huldra_v1**, and anything drafting `drip_feed`.

Audhumbla is the one to watch: audhumbla_v1 is at 66.4 and audhumbla_v2 at 36.6 on the post-136
grid, so the pair is 30 points apart and one of them is out of band. If the overvaluation is
propping up the AI's willingness to build a Regen pile, correcting it moves them in opposite
directions, and it is worth knowing which before a deck pass is aimed at v2.

## The work

1. Change the constant to `0.02` and fix both stale comments.
2. **Derive it instead of transcribing it.** This is the second time this number has been copied
   by hand, and `0-BURN-PRICE-LAG` in HANDOFF is the same lesson already learned once: *"transcribing
   a corrected number fixes today and re-arms the trap; deriving it disarms the trap."* Export
   `REGEN_PERCENT_PER_TURN` from `StatusBehaviors.ts` and have the AI read it. Then add the test
   that makes it impossible to re-arm: run `RegenBehavior` on a large frame and assert the AI's
   valuation for 1 stack equals the healing the engine actually delivers, the way
   `burnPricing.test.ts` already does for Burn.
3. **Sweep for siblings.** The AI's eval has a hardcoded number for several statuses; Burn already
   reads the engine (`burnTotalPercent`), Regen does not. Check Poison, Dazed, Weakened,
   Strengthened, Energized, BarkShield and the duality pair against the engine's own constants and
   report which others are copies rather than reads. This is the real value of the ticket — the
   Regen line is one instance of a pattern, and finding the pattern is cheaper now than one
   status at a time.
4. **Re-measure the full grid** (`node scratch/rebaseline.mjs --iter 30 --outdir results/rebaseline-137`)
   and report the deltas against the post-136 numbers now in `deck_grid.json`. Expect movement on
   the Regen decks and near-zero elsewhere; if something unrelated moves, that is a finding.

## Accept

The AI reads the engine's constant rather than holding its own; a test fails if the two ever
disagree again; the sibling sweep is reported whether or not it finds anything; and the grid delta
is measured and written down rather than assumed to be small.
