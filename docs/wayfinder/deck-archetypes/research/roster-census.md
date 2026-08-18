# Roster census — first-mover, field window, and the TOXIN_FANG A/B

- Type: wayfinder:research
- Read at registry `1:53ea4a83`, 2026-08-13, after ticket 55 amendment 1.
- **Report only.** Every table here is measurement authorised in the ticket-55 review; nothing
  in it was tuned.

---

## 1. First-mover census — the roster has never had one

Mirror, 100 seeds x 2 turn orders per species (200 decided games each). `firstMoverEdge` is the
suite's own metric: **positive means moving FIRST wins.**

| species | first-mover edge | mirror turns |
|---|---|---|
| **hraesvelgr** | **-33.0%** | 3.35 |
| huldra | -13.5% | 7.24 |
| jormungandr | -13.0% | 3.21 |
| draugr | -7.0% | 6.50 |
| sleipnir | -5.0% | 4.37 |
| ratatoskr | -4.0% | 4.72 |
| hel | -2.5% | 5.41 |
| kraken | 0.5% | 5.25 |
| ymir | 3.5% | 14.07 |
| nidhoggr | 5.0% | 4.53 |
| fenrir | 7.8% | 5.16 |
| valkyrie | 11.0% | 13.54 |
| gullinbursti | 12.5% | 10.05 |
| audhumbla | 12.5% | 13.45 |
| fafnir | 14.0% | 6.44 |
| **skoll** | **24.5%** | 3.73 |

**The instrument was worth building. Three readings:**

- **jormungandr is NOT the outlier.** At −13.0% it is fifth in magnitude. **`hraesvelgr` at −33.0%
  is two and a half times worse**, and has been sitting there unmeasured. `skoll` at **+24.5%** is
  the worst in the other direction.
- **The extremes cluster on the FAST mirrors.** The three shortest mirrors in the roster —
  jormungandr 3.21, hraesvelgr 3.35, skoll 3.73 — hold three of the five largest magnitudes. A
  short mirror gives turn order more leverage per turn, and nothing damps it.
- **The sign is a deck property, not a length property.** hraesvelgr and skoll have almost the
  same mirror length and opposite signs of similar size. Fast alone does not tell you who wins;
  it tells you the edge will be large.

No threshold exists for this metric. Offered as a candidate: **|edge| > 20% is a pace defect**,
which flags exactly `hraesvelgr` and `skoll` today.

---

## 2. Field census at 30 iterations — decision-grade

Every deck against all fifteen other species, **30 seeds x 2 turn orders per pairing (~900
decided games per deck)**, against the 10-iteration read taken during the ticket-55 floor
re-read.

| deck | 10-iter | **30-iter** | delta | window |
|---|---|---|---|---|
| `valkyrie_v2` | 89.3 | **88.3** | -1.0 | **ABOVE** |
| `jormungandr_v2` | 83.3 | **84.2** | +0.9 | **ABOVE** |
| `jormungandr_v1` | 83.0 | **84.0** | +1.0 | **ABOVE** |
| `ymir_v1` | 79.0 | **81.4** | +2.4 | **ABOVE** |
| `nidhoggr_v1` | 80.3 | **80.3** | +0.0 | **ABOVE** |
| `ymir_v2` | 84.3 | **78.9** | -5.4 | in |
| `hraesvelgr_v2` | 81.3 | **78.3** | -3.0 | in |
| `nidhoggr_v2` | 70.0 | **73.0** | +3.0 | in |
| `audhumbla_v1` | 63.0 | **61.4** | -1.6 | in |
| `huldra_v1` | 53.7 | **56.3** | +2.6 | in |
| `gullinbursti_v1` | 55.3 | **55.7** | +0.4 | in |
| `valkyrie_v1` | 50.0 | **51.2** | +1.2 | in |
| `draugr_v1` | 45.3 | **49.8** | +4.5 | in |
| `huldra_v2` | 42.7 | **47.2** | +4.5 | in |
| `gullinbursti_v2` | 41.3 | **44.8** | +3.5 | in |
| `sleipnir_v1` | 44.3 | **44.7** | +0.4 | in |
| `hraesvelgr_v1` | 44.0 | **44.4** | +0.4 | in |
| `ratatoskr_v2` | 47.0 | **42.7** | -4.3 | in |
| `sleipnir_v2` | 40.7 | **40.3** | -0.4 | in |
| `ratatoskr_v1` | 38.0 | **37.8** | -0.2 | in |
| `skoll_v1` | 36.7 | **36.9** | +0.2 | in |
| `fafnir_v2` | 33.0 | **36.4** | +3.4 | in |
| `fafnir_v1` | 30.7 | **32.0** | +1.3 | **below** |
| `draugr_v2` | 32.7 | **31.3** | -1.4 | **below** |
| `fenrir_v1` | 27.4 | **29.1** | +1.7 | **below** |
| `hel_v2` | 25.1 | **26.9** | +1.8 | **below** |
| `kraken_v1` | 26.0 | **26.8** | +0.8 | **below** |
| `hel_v1` | 29.7 | **26.7** | -3.0 | **below** |
| `fenrir_v2` | 27.0 | **25.7** | -1.3 | **below** |
| `kraken_v2` | 27.0 | **25.1** | -1.9 | **below** |
| `skoll_v2` | 25.8 | **24.2** | -1.6 | **below** |
| `audhumbla_v2` | 17.7 | **15.3** | -2.4 | **below** |

### The bimodality claim was partly a sampling artifact

| | 10-iteration | **30-iteration** |
|---|---|---|
| inside 0.35–0.80 | 13 | **17** |
| above 0.80 | 6 | **5** |
| below 0.35 | 13 | **10** |

**Mean |delta| between the two reads is 1.92 points; max is 5.4** (`ymir_v2`). So the review's
+-4-5 noise estimate is right at the tail and conservative on the average — and the earlier
"13 of 32" reading understated the healthy middle by four decks. **17 of 32 sit inside the
window, not 13.**

Still above: `valkyrie_v2` 88.3, `jormungandr_v2` 84.2, `jormungandr_v1` 84.0, `ymir_v1` 81.4,
`nidhoggr_v1` 80.3.
Still below: `audhumbla_v2` 15.3, `skoll_v2` 24.2, `kraken_v2` 25.1, `fenrir_v2` 25.7, `hel_v1`
26.7, `kraken_v1` 26.8, `hel_v2` 26.9, `fenrir_v1` 29.1, `draugr_v2` 31.3, `fafnir_v1` 32.0.

**jormungandr_v1 reads 84.0 with decision-grade data**, against 83.0 at 10 iterations — four
points over the ceiling rather than three. Inside the noise band the review cited, but it moved
away from the ceiling, not toward it.

---

## 3. TOXIN_FANG A/B — both authorised knobs, measured, not picked

`jormungandr_v2` only. Field is the 10-iteration round robin; `contagion` figures come from
`npm run balance:deck` at 60 iterations.

| `bonus` | field | vs control | **`contagion` dead** | contagion plays | v2 game length | damage/turn |
|---|---|---|---|---|---|---|
| **1** | **61.3%** | 100% | **0.439** | 157 | 4.18 | 14.64 |
| **2** *(shipped)* | 83.3% | 100% | 0.619 | 96 | 3.71 | 19.19 |
| **3** | 88.7% | 100% | 0.731 | 67 | 3.34 | 22.83 |

**Monotonic on every column, and the mechanism is the opposite of the one proposed.** The
hypothesis on record was that raising the bonus makes the Poison pile worth more, so doubling it
becomes worth a card. Measured, the causal chain runs the other way: **`bonus` sets game LENGTH,
and game length sets whether a hold-and-double card is ever worth casting.** At `bonus: 3` the
deck ends games in 3.34 turns and `contagion` is 73% dead; at `bonus: 1` it takes 4.18 turns and
`contagion` is 44% dead with **63% more casts**.

**`bonus: 1` closes both of v2's open items at once** — field **61.3%, squarely inside the
window** (from 83.3%, over the ceiling), and `contagion`'s dead rate nearly halved. It does not
reach the 0.35 bar, and it costs 24% of the deck's damage per turn.

**Not applied.** `TOXIN_FANG bonus 2->1` is on ticket 55's pre-authorised list and both of v2's
knob rounds are unspent, so this is a one-line change on the designer's word.
