# What an archetype could actually BE (ticket 87 - design diagnostic)

Henry: *"maybe these categories don't inherently make sense because we made it that bigger cards
deal more damage. If they didn't a 'ramp' deck would just play more smaller cards. So it does seem
a bit of an impasse... what could we do to make the deck archetypes more impactful? And what
criteria do we have for naming each deck? Burst doesn't really make sense either."*

The impasse is real and it has a number attached. Below: why the labels cannot stick today, the
measured shape of all 18 decks I profiled, six levers that would give archetypes something to be,
and a naming scheme where a deck's role is **computed from its own telemetry** instead of asserted.

---

## 1. Why the labels cannot stick: every deck has the same economy

| | value | decks |
|---|---|---|
| Energy per turn | **2** | 14 of 15 species (`ratatoskr` has 3) |
| Cards drawn per turn | **3** | 12 of 15 species (`hraesvelgr`, `hel`, `ratatoskr` draw 4) |

Nobody's resources grow, nobody's are starved. **There is no ramp in the game** - not because ramp
decks are weak, but because there is nothing to ramp *to*. And the card budget says what those
resources are worth (`docs/power_curve_spec.md`, rule `50 x Energy - 10`):

| cost | 0e | 1e | 2e | 3e | 4e |
|---|---|---|---|---|---|
| budget (power) | 10 | 40 | 90 | 140 | 190 |

So per turn, **2 Energy buys 90 power. Three cards played as 0-cost buy 30.** Energy is worth three
times what cards are worth, at the same table, by our own pricing rule.

That is the impasse in one line: **the deck built to spend cards is spending the cheap resource.**
Henry's instinct - that big cards dealing more is what stops ramp collapsing into "just play more
small cards" - is right in principle, but the premium is only **+12.5% at 2e, +16.7% at 3e,
+18.75% at 4e**, and no deck can reach 3e reliably on a 2-Energy frame anyway. Both halves of the
supposed trade-off are nearly inert: going wide is worth a third as much as going big, and going
big is worth 15% more than going small.

## 2. The measured shape of the roster

18 decks profiled (`scratch/shape.ts`), 120 games each against a spread of 11 opponents. Three
signatures: cards played per turn, damage curve slope (late turns / early turns), and the best
single turn as a share of a health bar - the spike.

| deck | role today | cards/turn | 0-cost share | slope | spike |
|---|---|---|---|---|---|
| `ratatoskr_v1` | CONTROL | **5.91** | 55% | 0.61 | 34.7% |
| `hel_v2` | BURST | 4.50 | 40% | **0.38** | **50.7%** |
| `ratatoskr_v2` | CONTROL | 4.21 | 44% | 0.86 | 26.3% |
| `hraesvelgr_v1` | ZOO | 3.80 | 25% | 0.50 | 43.2% |
| `sleipnir_v1` | ZOO | 3.57 | 42% | 1.16 | 40.0% |
| `jormungandr_v1` | ZOO | 3.51 | 44% | 0.46 | 42.4% |
| `sleipnir_v2` | BURST | 3.07 | 12% | 0.64 | 35.1% |
| `huldra_v1` | CONTROL | 2.70 | 44% | 0.50 | **18.0%** |
| `nidhoggr_v2` | BURST | 2.59 | 50% | 0.86 | 37.3% |
| `draugr_v1` | CONTROL | 2.44 | 27% | 0.66 | 42.1% |
| `nidhoggr_v1` | BURST | 2.39 | 40% | **1.23** | 28.9% |
| `kraken_v1` | CONTROL | 2.37 | 12% | 0.71 | 32.6% |
| `audhumbla_v1` | RAMP | 2.17 | 38% | 0.75 | 34.2% |
| `ymir_v1` | RAMP | 2.07 | 20% | 1.14 | 35.4% |
| `audhumbla_v2` | RAMP | 2.04 | 22% | 0.77 | 15.1% |
| `skoll_v1` | BURST | 1.93 | 11% | 1.09 | 40.3% |
| `fenrir_v1` | BURST | 1.80 | 11% | 1.12 | 32.6% |
| `kraken_v2` | RAMP | **1.75** | 25% | 1.13 | 40.2% |

Averaged by role today:

| role | cards/turn | slope | spike |
|---|---|---|---|
| ZOO | 3.63 | 0.71 | **41.9%** |
| CONTROL | **3.53** | 0.67 | 30.7% |
| BURST | 2.71 | 0.89 | **37.5%** |
| RAMP | 2.01 | 0.95 | 31.2% |

**Not one role's measured signature matches its name.**

- **ZOO is not meaningfully wider than CONTROL** (3.63 vs 3.53), and **the widest deck in the game
  is a CONTROL deck** - `ratatoskr_v1` at 5.91 cards a turn, 60% clear of anything else. Henry is
  right that it is a zoo deck; it is the *only* deck with zoo's resource profile (3 Energy, 4 cards,
  55% of the list free).
- **BURST spikes LESS than ZOO** (37.5% vs 41.9%). "Burst" today means *few big cards*, which is not
  the same thing as a big turn - `skoll_v1` plays 1.93 cards a turn and its best turn is 40.3%,
  while `jormungandr_v1` plays 3.51 and spikes 42.4%. The name describes the hand, not the outcome.
- **RAMP is flat** (slope 0.95). It does not ramp. The most back-loaded deck on the roster is
  `nidhoggr_v1` at 1.23x - a BURST deck - and the whole roster fits in a 0.38-1.23 band.
- The one deck whose label is honest is `hel_v2`: slope 0.38 and a 50.7% spike is a genuine
  all-in-early deck.

## 3. Six levers that would give archetypes something to be

Each is a number that already exists, or one new small mechanic. Ordered by leverage per unit of
work.

**1. Vary the resource line per species.** `energy: 2` and `cardDraw: 3` are currently constants
wearing the costume of stats. `ratatoskr` is the natural experiment: 3 Energy and 4 cards produce
**5.91 cards a turn**, 60% more than any other deck, from the same card pool. Spread these - Energy
1-3, draw 2-5 - and the archetypes fall out of the frames instead of being asserted on top of them.

**2. Let Energy GROW, for the decks that are meant to ramp.** Nothing in the game increases max
Energy over time. A ramp species that starts at 1 and reaches 4 by turn four is weak early and
frightening late - which is what makes ramp a strategy rather than a label, and what gives fast
decks something to race.

**3. Steepen the big-card premium.** `50 x Energy - 10` gives +12.5% at 2e. If spending 3 Energy at
once were worth ~30% more than spending 1+1+1, "get to the big spell" would be a real plan. Rule
change, one line, re-prices the whole pool - so it is a big swing, but it is *the* number behind
Henry's impasse.

**4. Raise what a CARD is worth, for the decks built on cards.** Either lift the 0e budget (10 is a
third of a card-slot's fair value on a 3-draw turn) or keep pricing it through payoffs, which is
what ticket 86 measured: `stampede` 11 -> 16 power per card played moved `sleipnir_v1` 34.5 -> 68.8.
The payoff route is safer - it prices width only for the decks that actually assemble it.

**5. Give CONTROL a denial axis instead of a damage axis.** `huldra_v1` deals **1.1 damage per card**
and still beats the sustain cluster **76%** - denial demonstrably works, it is just not systematised.
Energy denial, card denial and tempo taxes are all unbuilt; every "control" deck today is a damage
deck with a slower clock.

**6. Make TIME legible to cards.** There is no turn-indexed effect anywhere in the pool. Cards that
cost less after turn 4, or hit hardest on turns 1-2, would create the early/late axis the wheel
needs - and would be measurable immediately with `scratch/shape.ts`.

## 4. Naming criteria: compute the role, do not assert it

The current four names are intent. Here are four *measurements* with thresholds, all of which the
existing instruments already produce. A deck carries every tag it earns - they are not exclusive,
because a real deck is usually two things.

| tag | means | test | earns it today |
|---|---|---|---|
| **WIDE** | spends cards, not Energy | >= 3.5 cards/turn | `ratatoskr_v1`, `hel_v2`, `ratatoskr_v2`, `hraesvelgr_v1`, `sleipnir_v1`, `jormungandr_v1` |
| **TALL** | a real spike turn | best turn >= 40% of a health bar | `hel_v2`, `hraesvelgr_v1`, `jormungandr_v1`, `draugr_v1`, `skoll_v1`, `kraken_v2`, `sleipnir_v1` |
| **FAST** | front-loaded | slope <= 0.70 | `hel_v2`, `jormungandr_v1`, `huldra_v1`, `hraesvelgr_v1`, `ratatoskr_v1`, `sleipnir_v2`, `draugr_v1` |
| **LATE** | back-loaded | slope >= 1.10 | `nidhoggr_v1`, `sleipnir_v1`, `ymir_v1`, `kraken_v2`, `fenrir_v1`, `skoll_v1` |
| **DENIAL** | lowers the opponent's damage per turn | >= 15% reduction vs the control deck | not yet measured - one instrument away |

Read that way the roster already tells the truth about itself: `hel_v2` is WIDE+TALL+FAST (an
all-in), `nidhoggr_v1` is LATE (a grinder), `huldra_v1` is FAST but has no spike at all - which is
the profile of a denial deck that wins by subtraction.

**The renames I would argue for:** BURST -> **TALL** (it should mean the turn, not the hand), ZOO ->
**WIDE**, RAMP -> **LATE**, CONTROL -> **DENIAL**. Each one then has a test attached, and a deck
that fails its test is a bug rather than a matter of taste.

## 5. The honest recommendation

The wheel cannot be fixed by relabelling because **the axes it turns on do not exist yet**. In
order:

1. **Ship ticket 86's conversion premium** - it is measured, it is one number per deck, and it makes
   the card resource worth something for the decks built on it.
2. **Spread the resource line** (lever 1). Cheapest structural change with the largest effect, and
   `ratatoskr` already proves it works.
3. **Then decide whether ramp should exist** (lever 2) - that is a game-design decision, not a
   balance one, and everything about whether ZOO/RAMP/CONTROL can ever be a cycle depends on it.
4. **Adopt the computed tags** (section 4) as the vocabulary, so the next pass can say "this deck
   fails its own tag" with a number.
