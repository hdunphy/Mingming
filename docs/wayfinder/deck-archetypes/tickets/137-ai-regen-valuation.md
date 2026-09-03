# Ticket 137 — TacticalAI still prices Regen at 3% after the engine moved to 2%

**Type:** `wayfinder:task`
**Status:** CLOSED 2026-09-03
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

---

# Resolution — CLOSED 2026-09-03

## The sweep, which is the finding

All ten statuses the eval prices, checked against the engine:

| status | eval | engine | verdict |
|---|---|---|---|
| Regen | `0.03` hardcoded | `REGEN_PERCENT_PER_TURN = 0.02` | **copy, and wrong** |
| BarkShield | `0.8` hardcoded | `BARKSHIELD_DECAY_RETAINED = 0.8` | **copy, currently agreeing** |
| Poison | `0.01` hardcoded | bare `/ 100` in `PoisonBehavior` | **both magic, agreeing; no named constant either side** |
| Burn | reads `BURN_CONFIG.tiers` | — | read (ticket 62) |
| Strengthened / Weakened / Sharp / Dazed | read `STATUS_MODEL.powerPerStack` | — | read (ticket 102) |
| LightStance / DarkStance | read `STANCE_BONUS` | — | read (ticket 78) |
| Energized / Stunned / Asleep | eval-local heuristics | no counterpart | not copies |

**Two copies and one shared magic number, and the pattern is the point: every status that got its
own ticket ended up reading the engine, and the three nobody had cause to revisit stayed
transcribed.** Regen is the one that went wrong, but it went wrong by the ordinary route — a
correct number, copied, and then only one copy moved.

## What shipped (`735c77a`)

`StatusBehaviors` exports three constants and `TacticalAI` imports them: `REGEN_PERCENT_PER_TURN`
(hoisted out of the method body it was declared in, which is why nothing could read it),
`POISON_PERCENT_PER_STACK` (naming the `/ 100` on both sides) and `BARKSHIELD_DECAY_RETAINED`
(already named, now exported).

**Only Regen's value moves.** Poison and BarkShield are numeric no-ops — the same number, read
instead of copied — which is what makes the grid below interpretable: every point of movement is
Regen.

`src/engine/ai/aiStatusPricing.test.ts` is the guard, seven tests, none of which transcribe an
expected value. They run the behaviour on a 100,000 HP frame so nothing floors, measure what the
engine delivers, and require the eval's price to equal it. Two of them are not about the constants
and earn their place separately: one pins that a big Poison pile is still bounded by ticket 40's
horizon rather than its full decay sum, and one pins that Regen is never priced above the HP its
holder can actually receive.

## The grid — the prediction held exactly

`results/rebaseline-137/`, promoted. Against the round-two numbers:

|  | mean | sd | in band |
|---|---|---|---|
| round two | 49.9 | 12.0 | 26/32 |
| **ticket 137** | **49.9** | **11.5** | **27/32** |

Two decks moved 2+ points. **Both are Regen decks, and nothing else was.**

| deck | round two | 137 | delta |
|---|---|---|---|
| **audhumbla_v2** | 28.51 | **43.65** | **+15.14 — and out of band into band** |
| huldra_v1 | 58.59 | 55.87 | −2.72 |

The other 30 decks moved a mean of 0.5 points, max 1.6. The ticket predicted "movement on the Regen
decks and near-zero elsewhere; if something unrelated moves, that is a finding" — nothing unrelated
moved.

### Why audhumbla_v2 gained by having Regen valued LOWER

Stated as the reading, not as a measurement — the cast counts were not collected.

Her GENESIS package is **Regen-as-ammo**: the OS grants Regen on every heal and `drink_deep`
CONSUMES the pile at 15 power per stack. An eval that over-values holding a resource will hoard it
rather than cash it, and that is not a hypothesis about this engine — it is exactly what ticket 40
measured on Poison, where an over-valued pile made the AI score holding `wither_feast` ~200 points
above cashing it and it went **unplayed in 100 games out of 100 while reaching hand in all 100**.
A 50% over-valuation of Regen is the same thumb on the same scale, and audhumbla_v2 is the deck
whose payoff is spending it.

If that reading matters to a future decision, the cheap confirmation is `drink_deep`'s casts per
game before and after — one probe, not a grid.

## Sequencing note, honoured

The ticket required 136h–136n to land first, because round two's targets were measured with the AI
still at 3%. They did (`0b7504b`..`45e2451`), and this grid is measured on top of them.

## Left open by this ticket

`ENERGY_TURN_FRACTION`, `TURN_DAMAGE_FRACTION` and `STATUS_HORIZON_TURNS` are eval-local heuristics
with no engine counterpart to read — they are the search's model of a turn, not a transcription of
a mechanic, and nothing here touches them. Whether 0.20 of a health pool is still a turn's
throughput after two arcs of deck work is a separate measurement, and a live one: every duality
status, both stances, Stunned and Asleep are all priced through it.
