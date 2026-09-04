# Why ZOO is bad, and who could join it (ticket 86 - diagnostic)

Henry, off the state-of-the-roster report: *"Point number 2 is most concerning. Any ideas how we
can address that? Are there any burst candidates that can move to zoo archetype? Why is zoo so bad.
Can we do a deep dive."*

**The short answer: ZOO's premise is false in this engine.** Playing more cards does not deal more
damage, because per-card damage falls in proportion to how cheap the cards are - so a deck that
plays three cards a turn and a deck that plays one and a half deal **the same damage per turn**.
ZOO pays a real price for volume (draw dependency, hand size, deck cycling, no spike) and the
damage formula gives it nothing back.

That is fixable with one dial, and the fix is measured: raising the per-card conversion rate on
each ZOO deck's payoff card moved all three of them, by **+14.9, +9.1 and +34.3 points**.

---

## 1. What ZOO is supposed to be, and what it measures

Per `research/archetype-web.md`: **ZOO/VELOCITY preys on RAMP/SUSTAIN** at a licensed 65-80% in
neutral cells, and is preyed on by CONTROL at 20-35%.

| deck | field | vs RAMP (neutral) | vs CONTROL (neutral) |
|---|---|---|---|
| `jormungandr_v1` | 49.6% | **39.4%** | 43.3% |
| `hraesvelgr_v1` | 43.5% | **33.6%** | 53.3% |
| `sleipnir_v1` | 36.8% | **30.5%** | 23.3% |

The prey leg is not weak, it is **inverted** - and by a lot.

## 2. The three ZOO decks are the 12th, 14th and 15th best at ZOO's own job

Ranking every deck by the thing that defines the role - beating RAMP in neutral cells:

| rank | deck | role | 0-cost share | vs RAMP |
|---|---|---|---|---|
| 1 | `huldra_v1` | CONTROL | 44% | 76.1% |
| 2 | `gullinbursti_v1` | BURST | 10% | 76.1% |
| 3 | `jormungandr_v2` | BURST | 25% | 73.6% |
| 4 | `gullinbursti_v2` | BURST | 20% | 61.9% |
| 5 | `nidhoggr_v1` | BURST | 40% | 60.2% |
| 6 | `nidhoggr_v2` | BURST | **50%** | 58.0% |
| 7 | `hel_v1` | BURST | 45% | 53.7% |
| ... | | | | |
| **12** | **`jormungandr_v1`** | **ZOO** | 44% | **39.4%** |
| **14** | **`hraesvelgr_v1`** | **ZOO** | 25% | **33.6%** |
| **15** | **`sleipnir_v1`** | **ZOO** | 42% | **30.5%** |

**Eleven decks prey on RAMP harder than the best ZOO deck does.** The label is not describing
anything the decks do.

## 3. Why: throughput is flat across the whole roster

`calculateDamage` divides by a global pace constant of 45 (ticket 23) after scaling by power. Cheap
cards have low power, so they deal proportionally low damage - there is no volume bonus anywhere in
the formula. Measured, cards per turn x damage per card:

| deck | role | cards/turn | damage/card | **damage/turn** |
|---|---|---|---|---|
| `sleipnir_v2` | BURST | 2.31 | 6.5 | **15.1** |
| `fenrir_v1` | BURST | 1.51 | 8.7 | **13.1** |
| `jormungandr_v1` | ZOO | 2.81 | 4.6 | **13.1** |
| `sleipnir_v1` | ZOO | 2.93 | 4.4 | **12.9** |
| `kraken_v2` | RAMP | 1.45 | 8.7 | **12.5** |
| `hraesvelgr_v1` | ZOO | 2.92 | 3.9 | **11.4** |

**Everybody deals 11-15 damage a turn.** `sleipnir_v1` plays nearly twice as many cards as
`fenrir_v1` for four percent less damage. The volume is real - the ZOO decks genuinely play 2.8-2.9
cards a turn against a roster norm around 1.5 - and it converts to nothing.

Worse, the volume is not free. A zoo deck needs draw to sustain it, empties its hand, cycles its
deck, and has **no ceiling**: its payoffs land for a median **7-11% of a health bar**
(`tempest` 7%, `serpents_coil` 8%, `ink_stream` 11%, `stampede` 11%) where a burst deck's land for
25-41%. A deck with no spike cannot close a game it is not already winning, which is exactly what
losing to a sustain deck looks like.

## 4. The pricing mistake, precisely

The conversion cards are all uncapped per-event scalers, which is right (ticket 74, Henry's call):

| card | deck | rate | at 3 cards |
|---|---|---|---|
| `serpents_coil` | jormungandr_v1 | 10 power per card played | 30 power |
| `stampede` | sleipnir_v1 | 11 power per card played | 33 power |
| `carrion_swoop` | hraesvelgr_v1 | 11 power per card discarded | 33 power |

A 1-Energy card's budget is 3.0, which is about **30 power**. So a card that requires you to have
already spent your whole turn assembling the condition pays **exactly what an unconditional
1-Energy card pays**. There is no premium for the setup - and the setup IS the archetype.

## 5. Two hypotheses I tested and had to throw away

Recorded because both are intuitive and both are wrong.

**(a) "Chip damage cannot break regenerating defences."** The correlation between a deck's
damage-per-card and its win rate against the six sustain decks is **negative** (Pearson r = -0.44,
n=26). Decks under 5.0 damage/card average 41.9% against sustain; decks above average 35.3%.
`huldra_v1` deals **1.1 damage per card** and beats the sustain cluster **76.1%**. Small hits are
not the problem.

**(b) "`sleipnir_v1`'s OS overfeeds the Strengthened cap."** She applies **19.94 stacks a game**
into a payoff capped at 8 stacks (`STRENGTH_STACK_CAP`) and a damage bonus capped at +25%, which
looks exactly like the `TREACHERY` waste pathology. It is not: halving the grant **cost her 12.8
points** and doubling it **gained 12.0**.

| arm | field |
|---|---|
| MOMENTUM_DRIVE grants 1 | 21.7% |
| grants 2 (live) | 34.5% |
| grants 3 | 42.9% |
| grants 4 | 46.5% |

The stacks are consumed as fast as they arrive, so the cap never binds. **Her engine is
undersupplied, not overflowing** - the opposite of the diagnosis the roster's history would predict.

## 6. The fix, measured on all three decks

One dial: raise what a card is worth when the volume is assembled.

| deck | change | before | after |
|---|---|---|---|
| `sleipnir_v1` | `stampede` 11 -> 16 power per card played | 34.5% | **68.8%** |
| `jormungandr_v1` | `serpents_coil` 10 -> 15 power per card played | 49.6% | **64.5%** |
| `hraesvelgr_v1` | `carrion_swoop` 11 -> 16 power per card discarded | 41.6% | **50.7%** |

Every one moves, and `sleipnir_v1` overshoots massively - +34 points from one number - which tells
you how leveraged these scalers are. **These are diagnostic dials, not ship values**; +5 per card is
plainly too much for sleipnir and about right for hraesvelgr. A tuning pass would land them
individually, probably +2 to +3.

Note what this does NOT require: no new mechanic, no cap, no deck-list change, and no touching the
pace divisor. The archetype's machinery is already correct and already uncapped - it is priced as
though assembling the condition were free.

## 7. Which BURST decks could move to ZOO

Two independent signatures, and the honest answer differs depending which you trust.

**By behaviour** (already preys on RAMP): `gullinbursti_v1` 76.1%, `jormungandr_v2` 73.6%,
`gullinbursti_v2` 61.9%, `nidhoggr_v1` 60.2%, `nidhoggr_v2` 58.0%.

**By structure** (share of the deck costing 0 Energy - the velocity signature):
`nidhoggr_v2` **50%**, `hel_v1` 45%, `nidhoggr_v1` 40%, `hel_v2` 40%. For comparison the ZOO decks
are 44 / 42 / 25%, and `ratatoskr_v1` - a CONTROL deck whose OS reads *"0-cost programs heal all
allies"* - is the widest deck in the game at **55%**.

**On both signatures: `nidhoggr_v1` and `nidhoggr_v2`**, with `hel_v1` a step behind. They are
40-50% zero-cost and they already beat RAMP at 58-60%, which is just under the licensed prey band.

The catch: they are the **4th and 5th strongest decks on the roster** (67.3% and 66.7%). Moving
them makes ZOO instantly the strongest role and BURST/ZOO 11/5 instead of 13/3.

## 8. Recommendation

**Fix the mechanism first, then decide the labels.** Reclassifying `nidhoggr` into ZOO would make
the wheel's chart look better while the three decks that were built as zoo still lose to RAMP - the
wheel's failure is mechanical, not clerical.

1. **Ship a conversion-premium pass** on the three ZOO decks (section 6 dials, tuned down). That is
   what makes the role real, and it is one number per deck.
2. **Then reconsider the roster split.** If ZOO still needs bodies, `nidhoggr_v1`/`v2` are the
   decks whose structure and behaviour already fit, and `ratatoskr_v1` is worth a look on structure
   alone. That is a design call - it changes what those decks are *for*, not just what they are
   called.
3. **The wheel needs even role sizes to be measurable at all.** BURST 13 against ZOO 3 means the
   ZOO column of the role matrix is three decks' worth of noise. Whatever else changes, the counts
   should end up nearer 8/8/8/8.
