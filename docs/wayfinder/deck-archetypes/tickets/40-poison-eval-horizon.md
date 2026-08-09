# Poison was priced above a health bar

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-09
- Blocked by: [38-mutual-kill-eval](38-mutual-kill-eval.md) (closed)

## Question

Ticket 39's Níðhöggr pass built `wither_feast`, the detonate that converts a held Poison pile into
immediate damage. It measured **0 casts in 100 games** while reaching hand in **100 of 100**. The
gate was not the cause — peak Poison on the enemy averaged **18.5** against a `minStacks` floor of 6.

## The defect

```ts
case 'Poison':
    // 1% maxHp x stacks per tick, decrementing => total future damage
    // = maxHp/100 x S(S+1)/2
    return -HP_POINTS * entity.maxHp * 0.01 * (s * (s + 1) / 2);
```

The triangular sum is the correct *total* for decaying poison — **but only if the battle lasts S more
turns**, and it does not. Battles run 5–6 turns. At 18 stacks on an 87 HP frame the sum is **171% of
maxHp**: the eval priced a poison pile above the opponent's entire health bar, and the opponent dies
long before collecting it.

Two consequences, and the second is the one that surfaced it:

1. **Every poison deck over-valued holding.** A pile is worth strictly more than it can ever deliver.
2. **Under ROOT_CORRUPTION the shape is not merely optimistic, it is WRONG.** nidhoggr_v1's OS stops
   poison decaying at 2+ stacks, so corrupted poison is **linear in turns**, not triangular. At 18
   stacks the eval valued holding at **297 points** against **94** for cashing three ticks — so the
   AI declined, correctly by its own model, every single time.

The true value of holding 18 stacks for 3 turns is also 94. **The design was right; the eval was
modelling a shape the OS had deleted.** Same failure family as ticket 34's Regen, where the engine
and the eval disagreed about whether stacks were duration or intensity.

## The fix

Cap the sum at the same horizon every other future-scaling status is already valued over:

```ts
return -HP_POINTS * entity.maxHp * 0.01 * Math.min(s * (s + 1) / 2, s * STATUS_HORIZON_TURNS);
```

Below 4 stacks the triangular term still binds and nothing changes. Above it, the cap does.

**A gentler cap does not exist.** For a detonate to be worth cashing, three ticks now must beat
holding — `3S > H × S` — so the horizon must be **below 3**. Any value at or above 3 leaves
`wither_feast` dead. The horizon that unblocks the detonate is the same one that re-prices the
piles; they are one number, not two.

Measured on the ticket-39 decks: `wither_feast` went **0 casts / 100 games -> 7**, cashing at an
average **18.4 stacks for 38.0 damage a play** — the largest single number in that deck.

## Measured effect

Full committed run, registry `1:d7238b5d` (unchanged — no data moved). 765/765 tests.
**Redlines 45 -> 46** (card 32 -> 32, matchup 13 -> 14).

| matchup | before | after | |
|---|---|---|---|
| **os:huldra** | 0.660 | **0.030** | **out of band** |
| os:ratatoskr | 0.610 | 0.330 | in band |
| os:jormungandr | 0.390 | 0.310 | in band |
| mirror:huldra | 15.30 turns | 11.27 | faster |
| os:hel | 0.508 | 0.508 | (turns 2.66 -> 2.64) |
| kraken, fenrir, sköll, sleipnir, hraesvelgr | | **byte-identical** | |

New redlines are two strict-±15% `OS_GAP` entries (jormungandr, ratatoskr), which HANDOFF instructs
us to ignore at first pass. `MIRROR_SIDE_BIAS mirror:nidhoggr` cleared. `os:nidhoggr` 0.000 -> 0.500
is noise: both sides still run the placeholder deck and stall at 60 turns.

### huldra is the casualty, and her old number was the artifact

huldra_v1 wins by converting her mirrored Weakened pile into Poison with `hexbloom`. The uncapped
eval priced that pile as near-decisive, so the AI built toward it. Capped, the deck reads for what
HANDOFF has said since ticket 34: **"huldra_v1 is still a one-card deck… it needs a real payoff,
which is a design call and not a knob."** 0.660 was propped up by the bug; 0.030 is the honest
measurement of a deck that has not been finished. Henry's call: ship the fix, re-tune her.

## Left open

- **huldra_v1 needs a real payoff** — her own ticket, and a design call rather than a knob.
- **Burn may have the same shape problem.** `burnTotalPercent(s)` sums the tiered ticks over the
  decay, with no horizon cap. Not measured here; nothing in flight depends on it.
- The cap uses `STATUS_HORIZON_TURNS = 2.5`, shared with Strengthened/Weakened. If pace ever moves
  again (ticket 23/25 territory), this constant is now load-bearing in one more place.
