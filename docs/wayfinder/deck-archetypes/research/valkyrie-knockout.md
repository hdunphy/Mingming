# valkyrie_v2 knockout study — the OS is the engine, and the cards are noise

- Type: wayfinder:research — **REPORT-ONLY.** No lever was applied. Every arm mutated the
  registry IN MEMORY, so no engine or data file was ever written to disk.
- Ticket: 60. Read at baseline registry **`1:66efb2d7`**, 2026-08-14.
- Instrument: field row against all 15 other species, 10 seeds × 2 turn orders (~300 decided
  games per arm). **Rank by delta, not by absolute — a 10-iteration read carries ±5** (`0-CENSUS`).
- Template and quality bar: `jormungandr-v1-attribution.md`.

---

## 1. The answer, in one row

| arm | deck | field | **Δ vs baseline** |
|---|---|---|---|
| **os_off** (REBIRTH payoff → 0) | 7 | **37.7%** | **−50.0** |
| baseline (as committed) | 7 | 87.7% | — |
| ko_ascension | 6 | 87.0% | −0.7 |
| ko_radiant_spark | 6 | 88.7% | +1.0 |
| ko_falling_star | 6 | 90.0% | +2.3 |
| ko_morning_light | 6 | 90.0% | +2.3 |
| glimmer restored | **8** | 90.3% | +2.6 |
| ko_starfall | 6 | 91.0% | +3.3 |

**REBIRTH_CYCLE_OS is worth 50 points. Every card in the deck is worth less than the noise band.**

Six of the seven non-OS arms land between 87.0 and 91.0 — a 4-point spread on an instrument with
±5 of sampling error. **No individual card is measurably load-bearing**, and four of the five
knockouts make her *stronger*.

FTK is **0 in every arm**, field and mirror both. Nothing to report early.

---

## 2. Both hypotheses on record are wrong

**The agent's (ticket-56 report §4): "the exhaust package thins 7→4, she reshuffles constantly,
REBIRTH pays."**

Half right and wrong where it matters. REBIRTH *is* the engine — but the exhaust package is not
what feeds it. Removing `falling_star` **raises** her 2.3 points and removing `ascension` moves her
0.7 down, both inside noise. And the mechanism runs backwards from the theory: **shuffles per turn
go UP when cards leave** (baseline 1.08 → 1.23 without `falling_star`, 1.29 without `ascension`),
because what drives cycling is deck SIZE, and every knockout shrinks the deck. The exhaust cards
are not the thinning engine; they are ordinary cards in a deck that is already small.

**The designer's: "`starfall` is priced against base draw 3 but plays against a real trigger count
of 5+ — a ~50-power 1e card appearing every turn."**

Measured, `starfall` deals **7.1 damage per cast at 3.11 casts per game — about 22 damage across a
whole battle.** Removing a copy is **the single largest positive delta in the study (+3.3)**. It is
not a mispriced bomb; on this deck it is the weakest card in the list and arguably a liability.
The serpents_coil analogy does not carry: `serpents_coil` scaled off cards PLAYED in a deck built
to play many; `starfall` scales off cards DRAWN in a deck whose draw is one `morning_light`.

---

## 3. What the OS is actually doing

| | baseline | os_off |
|---|---|---|
| field | 87.7% | **37.7%** |
| **v2-mirror length** | **4.96 turns** | **9.64 turns** |
| OS procs / game | 3.34 | 0 |

**The OS nearly halves game length.** At ~3.3 procs per game and 10 damage + 10 heal per proc,
that is ~33 unblockable damage and ~33 healing she does not have to spend a card on — on a frame
whose whole deck is seven cards. With it off she is a **healthy, in-window 37.7% deck**; with it on
she is the roster's #1.

**The once-per-turn cap is doing real work — it is not 8-INERT-CAP.**

| | baseline |
|---|---|
| shuffles per PLAYER turn (mean) | **1.08** |
| shuffle distribution | `0:81 · 1:83 · 2:72 · 3:15` |
| proc distribution | `0:89 · 1:162` — never above 1 |
| **turns where >1 shuffle happened but the OS fired once** | **87 of 251 (34.7%)** |

She reshuffles more than once on **35% of her turns**, and the cap eats every one of those. Without
it she would proc ~1.08 times a turn instead of 0.65 — **66% more OS output.** Firmware-cap fixes
are therefore *on* the table, not off it; the cap is already load-bearing.

---

## 4. The finding that matters most for the fix

**Restoring the 8th card is free — it makes her slightly STRONGER.**

The `glimmer` arm is the only ≥8-card configuration and it reads **90.3% (+2.6)**, with procs per
game essentially unchanged (3.34 → 3.22).

> **So the rulebook fix and the balance fix are independent problems.** Putting her back to 8 cards
> — which Henry has already required — will not cost her a single point. **Any 8-card restoration
> must be paired with an OS change, or she ships at ~90%.**

One more reading in the same direction: `morning_light` is the only card that measurably feeds the
engine — removing it drops shuffles/turn **1.08 → 0.78** and procs/game **3.34 → 2.77**, the largest
mechanical change of any knockout — and her field still goes **UP 2.3 points**. Even the card that
most feeds the OS does not earn its slot.

---

## 5. Candidate levers, with the measurement that supports each

**No lever was applied.** These are for Henry's session.

| lever | measured support | note |
|---|---|---|
| **REBIRTH payoff (10/10 → lower)** | **os_off = 37.7% vs 87.7%** — the payoff spans a 50-point range | The only lever with a measured full-range endpoint. A payoff cut is a near-continuous dial between those two numbers; halving it plausibly lands mid-60s, but that is an interpolation, not a measurement. |
| **Trigger throttle** (once per N turns, or first-reshuffle-only à la UPDRAFT_KERNEL) | 3.34 procs/game over ~5-turn games; cap already binds 34.7% of turns | Changes the shape rather than the size. UPDRAFT precedent exists in the registry. |
| **Deck size** | **NOT a lever.** 6 / 7 / 8 cards read 87.0–91.0 | Measured across seven arms. Do not spend a round here. |
| **Any single card** | **NOT a lever.** Every knockout inside ±3.3 | Including both hypothesised culprits. |
| Tighten the once-per-turn cap | already binds 34.7% of turns | Only direction left is "not every turn", i.e. the trigger throttle above. |

---

## 6. Questions for Henry

1. **Payoff dial or trigger throttle?** The payoff is the only lever with a measured endpoint; the
   throttle is the one that preserves the reshuffle fantasy. They are not equivalent — a payoff cut
   keeps her rewarded every turn for less, a throttle keeps the reward and makes it rarer.
2. **The 8th card is a flavour choice, not a balance one.** The study says any card slots in at no
   measurable cost. Is `glimmer` back, or does she get something new?
3. **Is `starfall` worth keeping at all?** 7.1 damage per cast, 3.11 casts per game, and removing a
   copy is the study's biggest gain. It is the clearest deletion candidate in her list.
4. **Is "the OS is 50 of her 88 points" the intended identity?** With REBIRTH off she is a normal
   in-window deck. If the cards are meant to carry more of her, that is a deck rebuild, not a knob.

---

## 7. Card appendix

| card | cost | element | category | rarity | in-game text |
|---|---|---|---|---|---|
| `falling_star` | 1e | Light | Attack | Uncommon | 40 power. Exhaust. |
| `morning_light` | 1e | Light | Skill | Common | Draw 2 cards. |
| `starfall` | 1e | Light | Attack | Uncommon | 10 power for each card drawn this turn. |
| `ascension` | 2e | Light | Attack | Rare | 50 power. Gain 2 Strengthened and 2 Sharp. Exhaust. |
| `radiant_spark` | 0e | Light | Attack | Common | 10 power. |
| `glimmer` | 0e | Light | Skill | Common | Draw a card. |

**REBIRTH_CYCLE_OS:** *"Whenever Valkyrie's discard pile is shuffled back into her deck, deal 10
Light damage to a random enemy and heal Valkyrie with 10 power. Once per turn."*

---

## 8. Full instrument table

| arm | deck | field | Δ | FTK | mirror turns | procs/game | shuffles/turn | cap bound | starfall dmg/cast | starfall casts/game | morning_light casts/game |
|---|---|---|---|---|---|---|---|---|---|---|---|
| baseline | 7 | 87.7 | — | 0 | 4.96 | 3.34 | 1.08 | 87/251 | 7.1 | 3.11 | 2.00 |
| ko_falling_star | 6 | 90.0 | +2.3 | 0 | 5.21 | 3.67 | 1.23 | 100/247 | 7.4 | 3.36 | 2.36 |
| ko_morning_light | 6 | 90.0 | +2.3 | 0 | 5.13 | 2.77 | 0.78 | 50/249 | 5.2 | 4.50 | 0.00 |
| ko_starfall | 6 | 91.0 | +3.3 | 0 | 4.65 | 3.45 | 1.24 | 109/238 | 7.7 | 2.34 | 2.25 |
| ko_ascension | 6 | 87.0 | −0.7 | 0 | 4.41 | 3.70 | 1.29 | 110/248 | 6.6 | 3.94 | 2.53 |
| ko_radiant_spark | 6 | 88.7 | +1.0 | 0 | 5.11 | 3.77 | 1.02 | 75/257 | 5.7 | 3.84 | 0.97 |
| **os_off** | 7 | **37.7** | **−50.0** | 0 | **9.64** | 0.00 | 1.22 | 0/324 | 6.8 | 4.66 | 2.34 |
| glimmer | 8 | 90.3 | +2.6 | 0 | 4.61 | 3.22 | 1.00 | 69/233 | 8.2 | 3.05 | 1.98 |

Shuffle and proc distributions per arm:

| arm | shuffles/turn | OS procs/turn |
|---|---|---|
| baseline | `0:81 · 1:83 · 2:72 · 3:15` | `0:89 · 1:162` |
| ko_falling_star | `0:67 · 1:80 · 2:77 · 3:23` | `0:70 · 1:177` |
| ko_morning_light | `0:106 · 1:93 · 2:50` | `0:128 · 1:121` |
| ko_starfall | `0:72 · 1:57 · 2:88 · 3:21` | `0:74 · 1:164` |
| ko_ascension | `0:66 · 1:72 · 2:83 · 3:27` | `0:66 · 1:182` |
| ko_radiant_spark | `0:71 · 1:111 · 2:75` | `0:73 · 1:184` |
| os_off | `0:98 · 1:85 · 2:112 · 3:29` | `0:324` |
| glimmer | `0:72 · 1:92 · 2:65 · 3:4` | `0:80 · 1:153` |

**The proc column never exceeds 1 in any arm** — the once-per-turn guard holds everywhere.
