# ZOO deep dive (ticket 86)

- Type: wayfinder:research - Henry-directed, 2026-08-18. **Report only, nothing shipped.**
- Status: **closed** (2026-08-18). Branch `archetype-web`.

Henry, off ticket 85's finding 2: *"Point number 2 is most concerning. Any ideas how we can address
that? Are there any burst candidates that can move to zoo archetype? Why is zoo so bad. Can we do a
deep dive."*

Report: [research/zoo-deep-dive.md](../research/zoo-deep-dive.md).

## The answer

**ZOO's premise is false in this engine.** `calculateDamage` divides by a global pace constant of
45 after scaling by power, so cheap cards deal proportionally low damage and there is no volume
bonus anywhere in the formula. Measured, cards/turn x damage/card:

| deck | role | cards/turn | dmg/card | dmg/turn |
|---|---|---|---|---|
| `sleipnir_v2` | BURST | 2.31 | 6.5 | 15.1 |
| `fenrir_v1` | BURST | 1.51 | 8.7 | 13.1 |
| `jormungandr_v1` | ZOO | 2.81 | 4.6 | 13.1 |
| `sleipnir_v1` | ZOO | 2.93 | 4.4 | 12.9 |
| `hraesvelgr_v1` | ZOO | 2.92 | 3.9 | 11.4 |

**Everyone deals 11-15 damage a turn.** `sleipnir_v1` plays nearly twice the cards of `fenrir_v1`
for 4% less damage - and pays for the volume in draw dependency, hand size, deck cycling and no
spike (ZOO payoffs land for a median 7-11% of a health bar against 25-41% for burst).

**The pricing mistake, precisely:** `serpents_coil` 10 power per card played, `stampede` 11,
`carrion_swoop` 11 - about **30 power at three cards**, which is exactly a 1-Energy card's budget.
A card that requires you to have spent the whole turn assembling its condition pays what an
unconditional card pays. **There is no premium for the setup, and the setup IS the archetype.**

## Measured fix - one dial, all three decks

| deck | change | before | after |
|---|---|---|---|
| `sleipnir_v1` | `stampede` 11 -> 16 per card played | 34.5% | **68.8%** |
| `jormungandr_v1` | `serpents_coil` 10 -> 15 per card played | 49.6% | **64.5%** |
| `hraesvelgr_v1` | `carrion_swoop` 11 -> 16 per card discarded | 41.6% | **50.7%** |

Diagnostic dials, not ship values - +5 per card is far too much for sleipnir. No new mechanic, no
cap, no deck-list change, no touching the pace divisor: the machinery is already right and already
uncapped (ticket 74), it is just priced as if the volume were free.

## Two hypotheses measured and thrown away

- **"Chip damage cannot break regenerating defences."** Correlation between damage-per-card and win
  rate vs the six sustain decks is **negative** (r = -0.44, n=26). `huldra_v1` deals **1.1 damage
  per card** and beats the sustain cluster **76.1%**.
- **"`sleipnir_v1` overfeeds the Strengthened cap."** She applies **19.94 stacks a game** into a
  payoff capped at 8 and a bonus capped at +25% - the TREACHERY waste signature exactly. But
  halving the grant **cost 12.8 points** (34.5 -> 21.7) and doubling it **gained 12.0** (-> 46.5).
  The stacks are consumed as fast as they arrive; **her engine is undersupplied, not overflowing.**

## BURST candidates for ZOO

Ranked by ZOO's own job - beating RAMP in neutral cells - **the three ZOO decks come 12th, 14th and
15th.** Eleven decks prey on RAMP harder than the best of them.

- **By behaviour:** `gullinbursti_v1` 76.1%, `jormungandr_v2` 73.6%, `gullinbursti_v2` 61.9%,
  `nidhoggr_v1` 60.2%, `nidhoggr_v2` 58.0%.
- **By structure** (0-cost share): `nidhoggr_v2` **50%**, `hel_v1` 45%, `nidhoggr_v1` 40%,
  `hel_v2` 40% - against the ZOO decks' 44 / 42 / 25%. The widest deck in the game is
  `ratatoskr_v1` at **55%**, a CONTROL deck whose OS reads *"0-cost programs heal all allies"*.
- **On both: `nidhoggr_v1` and `nidhoggr_v2`**, `hel_v1` a step behind. Catch: they are the 4th and
  5th strongest decks, so moving them makes ZOO instantly the strongest role.

## Recommendation

1. **Ship a conversion-premium pass** on the three ZOO decks first - one number each, tuned down
   from section 6's dials (probably +2 to +3, not +5). That is what makes the role real.
2. **Then reconsider the labels.** Reclassifying `nidhoggr` now would fix the chart while the decks
   built as zoo still lose to RAMP: the failure is mechanical, not clerical.
3. **Even out the role counts.** BURST 13 against ZOO 3 means the ZOO column of the role matrix is
   three decks' worth of noise. Whatever else changes, aim nearer 8/8/8/8.
