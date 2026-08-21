# The resource line is not a knob, it is the budget (ticket 88)

Henry: *"I worry it's a big undertaking and a complete rework and we almost throw away all of our
balancing... is there another direction we could try around the margins? Also is this simpler than
I'm thinking so we just tinker with the two stats, draw rates and energy?"*

Both halves answered by measurement. **Mechanically it is exactly as simple as you think - two
integers in the registry, no card changes, no OS changes. Consequentially it is the opposite of
marginal: these are the most powerful numbers in the game.**

## 1. What one point is worth

Field win rate, 31 opponents, 15 iterations, one knob at a time.

| deck | change | field | delta |
|---|---|---|---|
| `jormungandr_v1` | draw 3 -> **4** | 49.6 -> **94.0%** | **+44.4** |
| `sleipnir_v1` | draw 3 -> **4** | 36.8 -> **76.4%** | **+39.6** |
| `ratatoskr_v1` | draw 4 -> **5** | 42.8 -> **68.3%** | **+25.5** |
| `huldra_v1` | draw 3 -> **4** | 56.5 -> **78.0%** | **+21.5** |
| `ymir_v1` | draw 3 -> **5** | 68.4 -> **85.9%** | +17.5 |
| `fenrir_v1` | draw 3 -> **5** | 38.9 -> **45.3%** | +6.4 |
| `fenrir_v1` | Energy 2 -> **3** | 38.9 -> **73.7%** | **+34.8** |
| `ymir_v1` | Energy 2 -> **3** | 68.4 -> **95.8%** | **+27.4** |
| `fenrir_v1` | Energy 2 -> **1** | 38.9 -> **1.2%** | **-37.7** |

For scale: **tickets 79-84 moved decks by 5 to 15 points each**, and those were considered large.
A single point of card draw is worth **two to four times** the biggest nerf we have ever shipped.

**This is why the archetypes are indistinguishable.** The only axis that moves outcomes is the one
where all 32 decks sit on the same value. It is not that the roles are badly designed - it is that
nothing has ever been allowed to differ along the axis that decides games.

## 2. Draw is self-limiting; Energy is not

Draw only pays a deck that can afford to play what it draws:

| deck | 0-cost share of the list | draw response |
|---|---|---|
| `jormungandr_v1` | 44% | **+44.4** (one card) |
| `sleipnir_v1` | 42% | **+39.6** (one card) |
| `huldra_v1` | 44% | **+21.5** (one card) |
| `ymir_v1` | 20% | +17.5 (**two** cards) |
| `fenrir_v1` | 11% | +6.4 (**two** cards) |

A card you cannot afford to cast is worth nothing, so **a draw-based axis cannot accidentally buff
the big-card decks.** It defines "wide" by construction. Energy has no such property: it is worth
+27 to +35 to everyone, because every deck is Energy-starved and none is card-starved.

**Energy is a power dial. Draw is a shape dial.** Which is why, of the two, only draw belongs in an
archetype conversation.

## 3. Static Energy is not ramp - it is speed

Adding Energy makes a deck **front-loaded**, not late-game:

| deck | slope (late/early damage) | spike (best turn) |
|---|---|---|
| `ymir_v1` live | 1.14 | 35.4% |
| `ymir_v1` +1 Energy | **0.80** | **52.0%** |
| `fenrir_v1` live | 1.12 | 32.6% |
| `fenrir_v1` +1 Energy | **0.84** | 39.5% |

More Energy means the hand empties sooner and the game ends sooner (`fenrir_v1`'s average game 4.4
-> 4.0 turns). **A ramp archetype needs Energy that GROWS, not Energy that is high** - and the game
already has exactly one deck that does this: `hraesvelgr_v2`'s UPDRAFT_KERNEL, the only deck on the
roster spending more than 2 Energy a turn (2.64). That is the proof the growth lever works *and*
that it can live in firmware, per deck, opt-in, without touching anybody else's stat block.

## 4. The non-rework direction: trade, do not add

The way to get identity without spending power is to **pay for the resource out of the cards**.
Measured, on `sleipnir_v1` (the ZOO deck, 36.8% baseline):

| arm | field | cards/turn | spike |
|---|---|---|---|
| live | 36.8% | 3.57 | 40.0% |
| draw 4 | **76.4%** | 3.30 | - |
| **draw 4 + `stampede` 11 -> 7 power per card** | **60.2%** | **4.1** | 42.7% |

Cutting her payoff rate by 36% gave back 16 of the 40 points. So the trade is real but **the
exchange rate is steep - one card of draw costs more than one card's worth of power**, and paying
for it takes two or three cards, not one. The shape does change: she plays 4.1 cards a turn against
3.57, on the same Energy.

**That is the whole proposal in one sentence: wide decks get more cards and weaker cards; big decks
get fewer cards and stronger ones - at net-zero field win rate.** The balancing is not thrown away,
because net power is held constant and the 8-DIFF proves which rows moved.

## 5. The margins, ranked by cost

Directions that change nothing structural:

1. **Payoff premiums** (ticket 86) - already measured, one number per deck, deck-local.
2. **Retag the roster with computed tags** (ticket 87) - vocabulary only, zero gameplay change,
   makes every future pass say "this deck fails its own tag" with a number.
3. **Turn-indexed cards** - two or three new cards that read *"after turn 4"* or *"on turns 1-2"*.
   Additive; nothing existing changes; creates the early/late axis the wheel needs.
4. **Denial cards for control** - `huldra_v1` deals 1.1 damage a card and beats the sustain cluster
   76%, so subtraction already wins; there is simply no Energy or card denial in the pool.
5. **Growth-of-Energy in firmware**, for one or two decks only, on the UPDRAFT_KERNEL precedent.

## 6. The smallest experiment that would settle it

**One deck, one ticket.** `sleipnir_v1` is the designated ZOO deck, sits at 36.8% and needs help
anyway. Give her **draw 4**, then pay it back in card power until she lands ~45%. If she ends up
playing four-plus cards a turn at a normal win rate, the axis is real and the recipe generalises to
the other wide decks. If she just feels like the same deck with more shuffling, the whole idea is
dead for the cost of one ticket.

**And do it after playtesting, not before.** Everything above is a ranking, not a verdict: the sim
can tell you a deck plays 4.1 cards a turn instead of 3.6, but only playing it can tell you whether
that reads as a different deck. This is precisely the axis where a sim is weakest and a human is
strongest.
