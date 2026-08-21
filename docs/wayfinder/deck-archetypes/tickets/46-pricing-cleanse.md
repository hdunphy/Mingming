# Cleanse is worth 10 power, measured — and the honest number was 13–17

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-09
- Blocked by: [45-control-is-the-floor](45-control-is-the-floor.md) (closed)

## Question

Ticket 45 shipped `baseline_purge` with a hand-priced cleanse half and left this open:

> `baseline_purge` scores 3.00 against a 6.5 band with `manualReview: ["CLEANSE"]`. CLEANSE is one of
> three genuinely unpriced actions, so a cleanse card cannot sit exactly at band the way the other
> five control cards do.

Henry's call: *"can we price cleanse? I think we should be able to figure out the average statuses
that are applied per match or maybe per turn and figure out how much it would be removing but
lowball it a little bit."*

That is the right shape for the question. A cleanse is worth **what it removes**, and what it
removes is measurable — we already have the status→power formulas in `powerscale.ts` and a simulator
that plays the whole roster against itself.

## Method

A throwaway harness sampled the debuff load **on the acting unit at every side-turn**, across all 90
pairings of the ten tuned species — **4,922 samples over 540 games**. Each sample priced the acting
unit's debuff stack with `powerscale`'s own status formulas, so the answer is in the same units the
budget bands are in. The harness was deleted after the measurement; it is a measuring instrument,
not a test.

| statistic | raw | poison-horizon-capped |
|---|---|---|
| turns carrying at least one debuff | **63.3%** | — |
| median **when loaded** | **15.0** | — |
| p25 / p75 when loaded | 7.0 / 38.5 | — |
| trimmed mean (top 5% dropped) | 16.9 | **13.4** |
| raw mean | 51.8 | — |
| max | 6678.5 | — |

**Ignore the raw mean and the max.** Both are dominated by nidhoggr's poison piles, because
`powerscale`'s `poisonPower` is still the *uncapped* triangular sum — ticket 40's horizon cap was
applied to the AI evaluation only. A 13-stack pile prices as if every future tick is collected,
which is why one tail sample reads 6678. The median and the trimmed mean are the numbers that
describe the cards.

**Checked and deliberately not changed:** the poison horizon cap does not bind below 5 stacks, and
no card in the registry applies 5 or more in a single action. So `poisonPower` is correct over the
range cards actually occupy, and aligning it with the AI's capped version would move no card score.
Noted here rather than fixed, so the next person does not re-derive it.

## The price

Central estimate **13–17 power**. Shipping **`CLEANSE_POWER = 10`**.

The discount is not timidity, it is two facts the sampler cannot see:

1. **A cleanse does nothing on the 36.7% of turns with no debuff.** The measurement conditions on
   being loaded; the card does not get to.
2. **It has to be in hand at the moment it is worth something.** Every other action on the curve
   pays out whenever it is played. A cleanse's value is a spike that has to be met.

Under-pricing a defensive utility action is also the safer direction of error: it makes cleanse
cards read slightly *under* band, which is a card that looks a little weak rather than a hoser that
slipped through the budget.

## Change

`src/debug/balance/powerscale.ts` only.

```ts
const CLEANSE_POWER = 10;
...
} else if (action.type === 'CLEANSE') {
    actionScore = CLEANSE_POWER / 10.0;
} else if (MANUAL_REVIEW_TYPES.has(action.type)) {
```

`'CLEANSE'` removed from `MANUAL_REVIEW_TYPES`. No engine, registry, or card data changed — this is
a scorer change, so **no simulated behaviour moves.**

## Re-scores

Two cards in the registry contain a CLEANSE action:

| card | cost | before | after | band |
|---|---|---|---|---|
| `purify` | 1e | 0.00 *(manual review)* | **0.90** | 2.4–3.0 |
| `baseline_purge` | 2e | 3.00 *(attack half only)* | **3.90** | 5.2–6.5 |

Both still read under band, which is the expected consequence of lowballing. `purify` at 0.90 on a
2.4 floor is the more interesting one — a bare 1e cleanse with no rider is, on this pricing, a weak
card. That is a design finding, not a scorer bug: it says a cleanse wants to be stapled to something,
which is exactly the shape `baseline_purge` has.

`soothe` is unaffected — it scores −0.80 and always did. It does not use CLEANSE at all; it applies
`Weakened -1` and `Dazed -1`, and the negative-stack path signs the score the wrong way. **Separate
known bug, not this ticket's.**

## Gate

Full committed run, redlines **45 → 45**, nothing added or removed; matchup table diffed row by row
and identical, as it must be for a scorer-only change. `tsc --noEmit` clean, 766/766 tests.

## Left open

- **`soothe` scores negative.** Removing a debuff by stacks scores as *applying* it. Small, real, and
  it will bite any future "shed one stack" card.
- **`poisonPower` is uncapped in the scorer** while the AI's evaluation is capped. Provably a no-op
  at current card values; a latent divergence the moment a card applies 5+ stacks in one action.
- **SEARCH, PLAY_LAST_CARD and TRIGGER_STATUS still score a silent 0**, and MULTIPLY_STATUS scores a
  heuristic off `ASSUMED_STATUS_COUNT` while *also* flagging for manual review — an estimate, not a
  measurement. CLEANSE is the first of that set to get a measured number; the same harness shape —
  simulate the roster, sample the thing the action acts on, price it in powerscale’s own units, then
  lowball — prices the rest of them.
