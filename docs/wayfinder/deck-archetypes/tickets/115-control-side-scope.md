# Ticket 115 — six control cards target the side instead of a single enemy

**Status:** SHIPPED 2026-08-24. Henry's ruling: *"I think the side change for all non stun debuffs
is good"*, and on the pricing, *"go with a ship it and ignore the rule for now"*.
**Framing, per Henry:** this is not a scope rule or a card tag. *"it's not a rule we're just buffing
some cards to target the side instead of the single."* Six named cards changed one field each.

---

## The change

Six cards, `target: "Single"` → `"Side"`, descriptions updated to the phrasing the twelve existing
Side cards already use. **Nothing else moved** — no power, no cost, no stacks. 24 changed lines,
which is exactly six cards × two fields.

| card | cost | before | after |
|---|---|---|---|
| `ice_spear` | 1e | 22 power. Apply 1 Weakened. | 22 power **to side**. Apply 1 Weakened **to side**. |
| `killing_frost` | 1e | 13 power. Apply 2 Weakened and 2 Dazed. | 13 power **to side**. Apply 2 Weakened and 2 Dazed **to side**. |
| `numbing_gale` | 1e | 20 power. Apply 2 Dazed. | 20 power **to side**. Apply 2 Dazed **to side**. |
| `rimefrost` | 0e | Apply 1 Weakened and 1 Dazed. | Apply 1 Weakened and 1 Dazed **to side**. |
| `frost_bite` | 1e | 15 power. Apply 2 Burn. | 15 power **to side**. Apply 2 Burn **to side**. |
| `hexbloom` | 2e | Apply 2 Poison per stack of Weakened on the target. The Weakened remains. | Apply 2 Poison **to each enemy** per stack of Weakened **it carries**. The Weakened remains. |

`hexbloom` gets the long form deliberately: it scales off the *target's own* Weakened, so "to side"
alone would leave it ambiguous whose stacks are being counted.

**`glacial_slam` is deliberately NOT in this list.** Its Side form stuns all three attackers at once
and was worth ~+35 points on its own — a side-wide hard CC removes turns rather than shrinking them,
which is a categorically different card. It stays Single.

## What it buys (`scratch/sidescope.ts`, full tier, beam 8)

`panel-control` vs `panel-zoo`, control as the player side:

| arm | 3v3 |
|---|---|
| shipped | 10.0% |
| the four Weakened/Dazed cards side-scoped | 40.0% |
| **all six side-scoped (this change)** | **55.0%** |

Every other lever measured in this arc, for scale: doubling every debuff stack +10; control at 0-cost
debuff cards +20; control card power ×1.5 +25; **control at +50% HP +5.** Control was not losing for
want of HP or damage. It was losing because its answers reached one body in three.

**1v1 is untouched, and this time on the deck that actually holds the cards.** `draugr_v2` vs
`jormungandr_v1`, 60 games: 96.7% before, 98.3% after — inside noise, and inert by construction,
since a side-wide effect facing one body hits one body.

> **A correction worth keeping.** The first 1v1 rows for this change were taken at `CTL.slice(0, 1)`,
> which is `kraken_v1` — a deck that runs **zero** of these six cards. They came back bit-identical
> and were briefly reported as "the change costs 1v1 nothing, measured". They measured nothing at
> all. `scratch/sidescope.ts` now takes a `LEAD` env for exactly this reason, and its header says so.

## Why this ships OVER BAND, on purpose

The scorer multiplies any enemy-facing action by **×2.2** for Side scope, so all six land over their
cost band (`scratch/sidescopeprice.ts`):

| card | as printed | as Side |
|---|---|---|
| `ice_spear` 1e | 2.6 in band | 5.6 over |
| `killing_frost` 1e | 3.0 in band | 6.6 over |
| `numbing_gale` 1e | 3.0 in band | 6.6 over |
| `rimefrost` 0e | 0.9 in band | 1.9 over |
| `frost_bite` 1e | 3.3 *already over* | 7.3 over |
| `hexbloom` 2e | **16.5 already 2.5× over** | 36.3 over |

**Every way of paying for it was measured and every one defeats the purpose.** Power cuts do not
reach: on four of the six the status half carries the card, and `numbing_gale` only lands in band at
**0 power**. The Energy dial was measured directly — +1e on all six gives back 35 of the 45 points at
3v3 (55.0% → **20.0%**) *and* costs `draugr_v2` **−18.4 points at 1v1** (96.7% → 78.3%), because a
cost bump does not dodge the 1v1 bill, it moves it into tempo.

**The reason the band objects is a number that is wrong at the width where control is weakest.** The
scorer says these cards became 2.2× stronger. The measurement says they became **0% stronger at 1v1
and about 4.5× stronger at 3v3**. ×2.2 is a single constant standing in for a quantity that is
genuinely 1.0 at width 1 and 3.0 at width 3. The cards are not mispriced against what they do; the
multiplier cannot express what they do.

**Follow-up owed:** make the Side multiplier width-aware, or these six sit as permanent "over band"
entries that a future numeric pass will try to correct back. Not done here — it is a scorer change,
not a card change, and it wants its own ticket.

## Found in passing, NOT part of this change

- **`hexbloom` scores 16.5 against a 5.2–6.5 band as it ships today** — 2.5× over before anything in
  this ticket. It is the `Poison per stack of Weakened` scaler being priced at `ASSUMED_WEAKENED_STACKS
  = 5`. Wants its own ticket.
- **`frost_bite` is over band as printed too** (3.3 vs a 3.0 ceiling), more mildly.
- **Two of the three control decks run no answers at all.** `kraken_v1` has **zero** enemy-facing
  debuff cards; `huldra_v1` has one and it is Poison, with her Weakened coming from ALLURE_PROXY
  firmware rather than cards. All six cards in this ticket are `draugr_v2`'s. Henry has asked for OS
  arms on kraken and huldra before any deck-list change — that is the next piece of work.

## Gates

872/872 tests green. Only `src/engine/data/programs.json` changed.
