# The resource line is not a knob, it is the budget (ticket 88)

- Type: wayfinder:research - Henry-directed, 2026-08-18. **Report only, nothing shipped.**
- Status: **closed** (2026-08-18). Branch `archetype-web`.

Henry, on ticket 87's proposal: *"I worry it's a big undertaking and a complete rework and we almost
throw away all of our balancing... is there another direction we could try around the margins? Also
is this simpler than I'm thinking so we just tinker with the two stats?"*

Report: [research/resource-line.md](../research/resource-line.md).

## Answer

**Mechanically it is exactly that simple - two integers, no card or OS changes. Consequentially it
is the most powerful thing in the game.** One point of card draw: `jormungandr_v1` **+44.4**,
`sleipnir_v1` **+39.6**, `ratatoskr_v1` **+25.5**, `huldra_v1` **+21.5** field points. One point of
Energy: `fenrir_v1` **+34.8**, `ymir_v1` **+27.4**; taking one away drops `fenrir_v1` to **1.2%**.
Tickets 79-84 moved decks by 5-15 points and those were the big passes.

**That is also the diagnosis:** the only axis that moves outcomes is the one where all 32 decks sit
on the same value.

## Two properties that decide how to use it

- **Draw is self-limiting.** It pays in proportion to a deck's cheap cards: 44% 0-cost -> +44.4,
  42% -> +39.6, 20% -> +17.5 (for TWO cards), 11% -> +6.4 (for two). A card you cannot cast is worth
  nothing, so **a draw axis cannot accidentally buff the big-card decks** - it defines "wide" by
  construction. Energy has no such property (+27 to +35 for everyone).
- **Static Energy is speed, not ramp.** +1 Energy makes a deck FRONT-loaded (`ymir_v1` slope 1.14 ->
  0.80, spike 35.4 -> 52.0%; games shorten). **Ramp needs Energy that GROWS** - and
  `hraesvelgr_v2`'s UPDRAFT_KERNEL already does exactly that, in firmware, per deck, without
  touching anyone's stat block. It is the only deck spending more than 2 Energy a turn (2.64).

## The non-rework direction: trade, do not add

Pay for the resource out of the cards. `sleipnir_v1`: live 36.8% at 3.57 cards/turn; draw 4 = 76.4%;
**draw 4 with `stampede` cut 11 -> 7 power per card = 60.2% at 4.1 cards/turn.** The cut gave back
16 of the 40 points, so the exchange rate is steep - it takes two or three cards to pay for one card
of draw. **Wide decks get more cards and weaker cards; big decks get fewer and stronger - at
net-zero field rate.** Nothing is thrown away because net power is held constant.

## Recommended next step

**One deck, one ticket:** `sleipnir_v1` (the designated ZOO deck, 36.8%, needs help anyway) at draw
4, paid back in card power until she lands ~45%. If she plays 4+ cards a turn at a normal win rate,
the recipe generalises; if she feels like the same deck, the idea dies for the cost of one ticket.
**After playtesting, not before** - the sim can rank this axis but only play can judge it.

Cheaper margins that change nothing structural: ticket 86's payoff premiums; ticket 87's computed
tags (vocabulary only); two or three turn-indexed cards; denial cards for control (`huldra_v1` deals
1.1 damage a card and still beats the sustain cluster 76%).
