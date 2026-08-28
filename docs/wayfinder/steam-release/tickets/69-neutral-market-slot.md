# Neutral utility cards reach the market: the off-pool slot gets a curated list (ticket 69)

- Type: wayfinder:task
- Status: closed
- Assignee: LEGION
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

**CLOSED 2026-08-28 (LEGION).** `MARKET_NEUTRAL_UTILITY` in `engine/run/marketplace.ts`; the
off-pool slot draws from it; pinned by five tests in `marketplace.test.ts`. Gates green
(`tsc -b`, eslint 0, **1842** vitest across 132 files, build, assert-no-debug).

### The premise was right; the wording was one word off, and the correction is the interesting part

The ticket says the off-pool slot *"has no defined draw list"*. It had one — **the set complement:
everything `isRewardable` that the party's pool does not contain.** For a solo party that is **207
cards**, so any particular card was a **0.48% draw per visit and 1.4% across a run's three markets.**

So the hedge was not blocked, it was *diluted*. That is a better description of what needed fixing
and it is why the fix is a narrower source rather than a new mechanism.

### The list, and why each entry is in it

Four entries, ordered, each satisfying three mechanical conditions asserted by test — the list is
derived, not tasted:

| card | cost | what it is |
|---|---|---|
| **`hamstring`** | 1e | 20 power, 2 Weakened. The ruled seed entry (67 R4.3) — the answer to an escalating Strengthened aura |
| `adrenaline` | 1e | 18 power, 2 Strengthened. The other side of the same duality |
| `squirrel_away` | 1e | Draw 2. Card flow, which several launch decks have no source of |
| `harden_daemon` | 1e | Daemon: gain 1 Sharp. The only neutral permanent |

Conditions: **element `None`** (neutral utility, at home in any deck, STAB nowhere); **in no LAUNCH
species' deck** (the set an EA party's pool can never contain — which is the whole point); **real
content, not a token**.

**`hamstring` at 1-in-4 a visit is ~58% across a run's three markets**, against 1.4% before.
Purchasable by any party, which is what R4.3 asked for — not guaranteed, which it did not.

### Verified against the registry, as the ticket asked

`hamstring` is exactly as briefed: `element: "None"`, `baseCost: 1`, 20 power + 2 Weakened, Common.
One note for the record: its `category` is `"Skill"` despite dealing damage. Nothing here depends on
that and it was not touched.

### A live bug this closed on the way: the FLOOR DECK WAS ON SALE

The old complement contained `baseline_jab`, `baseline_scuff`, `baseline_strike`, `baseline_snare`,
`baseline_slam` and `baseline_purge` — the **control species' deck**, which `mingmingRegistry`
describes in its own words as *"the worst deck in the game"* and which exists as the balance corpus's
reference floor. `control` is not in `PLAYABLE_SPECIES`, so its six cards fell straight through the
"not in the party's pool" filter and onto the shelf at roughly **3% a visit**.

Nobody had a reason to look at what the slot contained until a specific card needed to be in it.
There is now a test that fails if a calibration card reaches a shelf.

### TWO THINGS FOR HENRY — one is a cost, one is a line in the brief that does not exist

**1. This trades away the slot's shipped purpose, and the ticket does not mention it.** The
wild-card slot was built for anti-monotony: its own doc comment says it *"stops a mono-species party
from seeing the same twelve cards all run"* and gives *"three guaranteed strangers across a run"* —
which matters because a solo party's pool is **5 cards**. Narrowing 207 to 4 means a solo run now
sees three of these four rather than three of two hundred.

Built as ruled, because the ruling is explicit and newer. But it is a real loss, and the fix if it is
missed is the one the ticket already anticipates: **the list is yours to extend**, and every entry
added restores breadth *and* stays reachable, which the complement never was. The alternative shape,
if you would rather keep both properties, is a second slot — one neutral, one stranger — which is
`MARKET_WILDCARD_SLOTS` plus one draw and is a stock-size decision, i.e. yours.

**2. There is no ~+20% None-element pricing law.** The Deliverable cites one. `cardPrice` reads
`baseCost` and nothing else, and **ticket 56 ruled that deliberately**: *"a 2-energy Common and a
2-energy Rare both cost 35... That is a design statement, not a simplification"*, because rarity is a
drop-rate weight and the power curve prices power in energy. Adding a neutral premium would charge
twice on an axis ticket 56 removed, so **nothing was changed** — `hamstring` prices at the 1e rung,
**25 scrap**, like every other 1e card. A test pins that. If you do want neutrals to cost more, it is
a ticket-56 amendment rather than a line in this one.

### Not done: the optional report-only arm

*"One prepared Emberfall arm with hamstring purchased, to size what the hedge is worth"* — skipped,
deliberately. The run gate's prepared arm does not shop (§12 and §13 both record that as a standing
limitation), so measuring this needs a new flag to inject a card into the sampled deck — new gate
machinery inside a ticket scoped as small and decision-free. It is about 35 minutes plus a 30-minute
arm. Worth doing when the gauntlet target exists (67 R4.1 holds it until all three gyms are rebuilt),
because that is when a number about the hedge has something to be measured against.
