# Ticket 203: Redesign jormungandr_v1's opening (the Ouroboros starter)

**Type:** deck redesign, in a deck-pass session with Henry. **Status:** **OPENED 2026-10-07** (Henry: *"Jorm add a ticket to redesign"*, and *"A separate redesign"*); not started. Split out of [202d](202-night-2026-10-06-rulings.md).

**Why.** jormungandr_v1 loses its first fight more than any other starter. On the agent nights, seed 7 (jormungandr_v1, Water first biome) lost **fight one** to a wild Kraken on 2026-10-05 (haiku and sonnet), 2026-10-06 and 2026-10-07; seed 19 lost fight one or two. The run gate says it is the deck, not the seed:

| jormungandr_v1, bare 8-card start deck, 1v1 | Wins |
|---|---|
| Wild, first biome (its own element: Kraken or Jormungandr) | **29.7%** (Henry's rule: 85%) |
| Wild vs Kraken / vs Huldra / vs Fenrir | 3 of 23 / 2 of 28 / 22 of 22 |
| Elite, first biome | **0.0%** |
| Every other starter, wild at home | 71–100% |

Run gate, cells `wild:biome0` and `elite:biome0`, 1,440 samples (120 per starter per cell), 2026-10-07.

**The kit today** (`startKits.jormungandr_v1`, plus three Tackles): Undertow (0e, draw 1, **you gain 1 Weakened**), Blind Spot (0e, 6 power, 1 Dazed), Serpent's Coil (1e, 10 power per card played this turn, the payoff), Riptide Run (1e, 20 power, refund 1 Energy on the 3rd+ card), Surge Protection (1e, 25 power, refund if an effect drew). Instinct OUROBOROS_LOOP: the 5th Water card a turn draws 1. Jormungandr: HP 110, attack 75, 2 Energy.

**Henry's notes (2026-10-07):**

> *"Serpent's coil had to be nerfed in the past. The undertow card is really what makes it scale like crazy. In my last playtest, I almost lost the gym because of a 700 damage serpent's coil. Maybe we add a forage to the starting kit? I think ideally the starter kit is undertow, serpent's coil, blind spot, riptide run, surge protection or something along those lines. Could also try buffing some of those cards."*

The kit he names is the kit it has today. So the problem is the deck's numbers early and its ceiling late: the same Coil that does about 20 on turn one does 700 once Undertow chains.

**Already measured (run gate as above, wild / elite at home; enemy Jormungandrs carry the same card changes):**

| Arm | Wild, home | Elite, home |
|---|---|---|
| Today | 29.7% | 0.0% |
| Forage in for Blind Spot (Henry's idea; Forage added to the deck) | 18.9% | 0.0% |
| Blind Spot 10, Riptide Run 25, Surge Protection 30 (all three buffed) | 40.5% | 6.8% |
| Serpent's Coil 15 a card (instead of 10) | 54.1% | 4.5% |
| Blind Spot out, a second Serpent's Coil in (two payoffs) | 48.6% | 11.4% |
| Blind Spot out, a second Undertow in | 0.0% | 0.0% |
| Undertow out, Poison Injection in | 29.7% | 4.5% |

None reaches 85%. Two readings: a second Undertow makes it worse (Undertow Weakens its own caster, and a solo Jormungandr is that caster), and Forage's self-damage is worse than Blind Spot's 6 power. Damage per turn is the gap: the biggest flat hit in the kit is 25, off attack 75 (Kraken has 100).

## How to work this ticket

1. **A deck-pass session** (the `mingming-deck-pass` skill): Henry sketches and the session costs and measures each sketch as a single row on the run gate (`--cells wild:biome0,elite:biome0 --iterations 1440 --verbose`, read per starter, at home). Nothing reaches the registry without his say (standing rule).
2. **The target:** wild at home at least 85% (2026-09-25 ruling), without bringing back the 700-damage Coil late. So every row also reports one late-game read: Serpent's Coil's biggest hit on a full Undertow turn in a 3v3 gauntlet cell.
3. **Directions to sketch from** (none ruled): a floor on Serpent's Coil (a base plus per-card, so turn one is not about 20) traded against a lower per-card rate; a real 1e hitter in the deck and the kit; Undertow's self-Weakened softened or moved; OUROBOROS_LOOP reachable by a solo body (the 5th Water card needs three 0e plays at 2 Energy). The rules that apply: numbers move in 5s, no caps (find a condition), one payoff per start kit (157-r1(b)).

## Decisions for Henry

1. Which direction (or sketch) to measure first.

## Resolution

Not started.
