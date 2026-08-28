# Neutral utility cards reach the market: the off-pool slot gets a curated list (ticket 69)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [57](57-apply-56.md) (applied economy), context: [68](68-boss-redesign-drivers.md) + research/68 SS6
- Phase: Vertical Slice

## Why this exists

Research/68 SS6: WAR FOOTING's mechanical answer is Weakened; every launch applier is Nature, so the
type-recommended Water counter-team cannot answer the Emberfall Driver. Henry ruled (67 round-4) the
texture INTENDED — race with Water or answer with Nature — plus a hedge: the answer must be
*purchasable* by any party, without changing any species pool.

`hamstring` (None-element, 1e, 20 power, 2 Weakened, Common — verify against `programs.json` before
building) sits in no launch deck, and ticket 56/57's species-pool stock rule means no party is ever
offered it. Ticket 63's ruled market design already shows ONE off-pool stock slot per visit; today
that slot has no defined draw list.

## Deliverable

The market's off-pool slot draws from a small curated neutral-utility list. Seed list is Henry's to
extend; the ruled seed entry is `hamstring`. Pricing per ticket 56/57 norms (None-element cards are
priced ~+20% by the standing law, and the printed-power description law applies unchanged). A test
pins the slot's draw list so a future card pass cannot silently empty it.

## Done when

Any party can be offered `hamstring` at a marketplace visit; the draw list is pinned by test; gates
green (`tsc -b`, vitest, build, lint 0). Optional, report-only: one prepared Emberfall arm with
hamstring purchased, to size what the hedge is worth.

## Resolution

_(open)_
