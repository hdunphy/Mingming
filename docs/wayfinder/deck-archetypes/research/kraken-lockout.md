# The kraken lockout check — nothing is unwinnable, and the deficit is net, not offense

- Type: wayfinder:research — **REPORT-ONLY.** No card, deck, OS or engine change. Probe arms
  mutated the registry in memory only.
- Ticket 67 + **Amendment 1** (Henry, 2026-08-16: decompose the type-advantage confound first).
  Read at registry `1:b76809c9`, branch `card-dev`.
- **~3,700 real battles**: 960 for the autopsy (8 zeros × 30 seeds × 2 orders × 2 decks), 1,280
  for the pool probes, 1,440 for the type decomposition across five decks.
- Sampling outside `getBestAction` per `0-AI-SIM-COUNTS`.

> **CORRECTION (ticket 68, 2026-08-16).** Section 5's causal chain is WRONG, though its outcome and recommendation stand. The refund did not fire because `cardsDrawnThisTurn` counts the draw-phase refill - that chain is real but **never reached**. The card carried an inline `"type": "BASE"` beside its constraint id, and `inflateConstraint` spreads the inline object LAST, so the draw check was overwritten by an energy check against cost 0. Separately, the reducer never passed `state` to the validator, so it hit the `if (!state) return true` fail-safe. Either alone made the refund unconditional. The 8.8-9.6% "zero-draw turns" measured below describe a counter nothing was reading. See [triggered-draw-fix.md](triggered-draw-fix.md).

---

## 0. Question 0 first — the type decomposition, and it changes the question

### 0a. The type chart, from the engine

`ElementalMatrix` (combatUtils.ts:33) is **asymmetric with no resistance**: advantage is ×1.5,
and a bad matchup is simply the absence of a bonus. Kraken is **Water** — advantaged into
**Fire and Earth**; **Nature and Ice** are advantaged into her.

| bucket | opponents | ticket-65 win rate |
|---|---|---|
| **ADVANTAGED** (kraken ×1.5) | fenrir, skoll *(Fire)*, fafnir, gullinbursti *(Earth)* | 100 / 98 / 75 / 53% |
| **NEUTRAL** | jormungandr *(Water)*, hraesvelgr, sleipnir *(Air)*, valkyrie, audhumbla *(Light)*, hel, nidhoggr *(Dark)* | 0 / 22 / 37 / 0 / 0 / 13 / 0% |
| **DISADVANTAGED** (they ×1.5) | ratatoskr, huldra *(Nature)*, ymir, draugr *(Ice)* | 0 / 0 / 0 / 0% |

**Henry's challenge is confirmed at the structural level, and it is stark: her four wins are
exactly her four type-advantaged matchups, and every disadvantaged matchup is a zero.**

### 0b–c. Damage by bucket, and normalized

| deck | bucket | games | win% | damage/turn | **normalized** damage/turn | type lift |
|---|---|---|---|---|---|---|
| kraken_v1 | ADVANTAGED | 64 | 82.8% | 16.32 | **11.01** | 48.2% |
| kraken_v1 | NEUTRAL | 112 | 7.1% | 12.70 | **12.70** | 0.0% |
| kraken_v1 | DISADVANTAGED | 64 | 0.0% | 9.88 | **9.88** | 0.0% |
| kraken_v1 | ALL | 240 | 25.4% | 12.97 | **11.53** | 12.4% |
| kraken_v2 | ADVANTAGED | 64 | 68.8% | 15.45 | **10.54** | 46.6% |
| kraken_v2 | NEUTRAL | 112 | 12.5% | 12.65 | **12.65** | 0.0% |
| kraken_v2 | DISADVANTAGED | 64 | 1.6% | 9.19 | **9.19** | 0.0% |
| kraken_v2 | ALL | 240 | 24.6% | 12.55 | **11.22** | 11.9% |
| valkyrie_v2 | ADVANTAGED | 32 | 84.4% | 21.07 | **14.05** | 50.0% |
| valkyrie_v2 | NEUTRAL | 208 | 61.5% | 12.51 | **12.51** | 0.0% |
| valkyrie_v2 | ALL | 240 | 64.6% | 13.26 | **12.64** | 4.8% |
| skoll_v1 | ADVANTAGED | 64 | 78.1% | 16.83 | **11.36** | 48.2% |
| skoll_v1 | NEUTRAL | 112 | 50.0% | 17.11 | **17.11** | 0.0% |
| skoll_v1 | DISADVANTAGED | 64 | 1.6% | 11.29 | **11.29** | 0.0% |
| skoll_v1 | ALL | 240 | 44.6% | 15.87 | **14.20** | 11.7% |
| hel_v2 | ADVANTAGED | 32 | 93.8% | 31.12 | **21.84** | 42.5% |
| hel_v2 | NEUTRAL | 208 | 78.9% | 21.91 | **21.77** | 0.6% |
| hel_v2 | ALL | 240 | 80.9% | 22.99 | **21.78** | 5.6% |

**Type lift is ~48% in her advantaged bucket** — 16.32 raw against 11.01 normalized — which is
what an all-Water deck against a Fire frame looks like. Every deck shows the same ~42–50% lift
in its advantaged cell, so the instrument is behaving.

**Ticket 65's 13.0 damage/turn aggregate was confounded, exactly as Henry suspected.** The
honest cells are **12.70 neutral** and **9.88 disadvantaged**, against 16.32 advantaged.

**And her win rate was confounded far more than her damage was.** Ticket 65 reported 26.6%;
her **neutral-bucket win rate is 7.1%** (v1) and **12.5%** (v2). Her real fair-fight number is
roughly a third of the headline.

### 0d. The clean cell

**jormungandr is Water — a same-element 0% with no type excuse in either direction.** Read
against his 84% field it is less damning than it looks; everyone loses to jormungandr. But it
is a zero that type cannot explain.

---

## 1. The verdict that decides the design session

Henry's decision rule asked whether kraken's normalized/neutral rate is bottom-tier
(→ underpowered) or mid-pack (→ missing tools). **The measurement says neither, and the reason
is the more useful answer.**

| deck | frame HP | damage/turn | damage taken/turn | **net/turn** | turns of HP | **win%** |
|---|---|---|---|---|---|---|
| **kraken_v1** | 72 | 12.72 | 14.21 | **-1.49** | 5.1 | **10.7%** |
| **kraken_v2** | 73 | 12.59 | 14.57 | **-1.98** | 5.0 | **16.1%** |
| valkyrie_v2 | 82 | 12.51 | 12.53 | **-0.01** | 6.5 | **64.4%** |
| skoll_v1 | 76 | 16.84 | 16.39 | **+0.45** | 4.6 | **46.4%** |
| hel_v2 | 80 | 21.99 | 26.41 | **-4.43** | 3.0 | **75.5%** |

**Kraken deals the same damage per turn as valkyrie_v2 in neutral matchups — 12.72 against
12.51 — and wins 10.7% where valkyrie wins 64.4%.**

Her offense is not bottom-tier. It is *level with a 64%-winning deck*. What separates them is
the other side of the ledger: **she takes 14.21 a turn where valkyrie takes 12.53, on a frame
that is 12% smaller.** Valkyrie's net is −0.01 a turn; kraken's is **−1.49**. Valkyrie has 6.5
turns of HP against incoming; kraken has 5.1.

**hel_v2 is the control that proves the point.** She takes the most damage in the roster —
26.41 a turn, three turns of life — and wins 75.5%, because she deals 21.99. The game pays for
*rate*. Kraken has no edge on either side of the rate.

### The verdict, written explicitly as the amendment requires

**Both stories are partially true, and the split is: Henry is right about the confound, ticket
65 is right that rate is not the whole story, and neither named the actual deficit.**

- **Henry's confound: CONFIRMED and larger than suspected.** Her wins are type artifacts; her
  fair-fight win rate is 7–16%, not 26.6%.
- **Henry's "underpowered" conclusion: DIRECTIONALLY RIGHT, WRONGLY LOCATED.** She is not
  behind on damage output — she matches valkyrie. She is behind on **net**, and the deficit is
  **−1.49 a turn**, of which offense contributes ~0.2 and defence ~1.3.
- **Ticket 65's "missing tools": SURVIVES ONLY FOR THE SUSTAIN SUBSET** (ymir, audhumbla,
  valkyrie), and §4 shows existing pool tools do not reach even those.

**The actionable number for the session: closing −1.49 a turn.** Matching valkyrie's net needs
about **+12% damage rate** or the equivalent in damage taken. That is one number, and it is
small — which is consistent with a deck that is one notch off everywhere rather than broken
anywhere.

---

## 2. Per-matchup verdicts — nothing is a structural lockout

The ticket's criterion: dragged under ~40% regularly = power gap; never under ~80% = structural.

| opponent | type bucket | v1 W/60 | v2 W/60 | v1 mean-min opp HP | v1 BEST | v2 BEST | opp sustain/turn | verdict |
|---|---|---|---|---|---|---|---|---|
| ratatoskr | DISADV (Nature) | 1 | 5 | 37.0% | 0.0% | 0.0% | 3.73 | **POWER-GAP** |
| valkyrie | NEUTRAL (Light) | 0 | 4 | 39.1% | 9.9% | 0.0% | 6.49 | **POWER-GAP** |
| nidhoggr | NEUTRAL (Dark) | 0 | 2 | 41.3% | 17.0% | 0.0% | 0.00 | **POWER-GAP** |
| jormungandr | NEUTRAL (Water) | 0 | 0 | 41.4% | 9.1% | 18.2% | 0.00 | **POWER-GAP** |
| huldra | DISADV (Nature) | 0 | 2 | 45.8% | 22.8% | 0.0% | 1.93 | **POWER-GAP** |
| draugr | DISADV (Ice) | 0 | 1 | 55.3% | 25.3% | 0.0% | 3.39 | **POWER-GAP** |
| audhumbla | NEUTRAL (Light) | 0 | 0 | 58.9% | 17.6% | 15.1% | 7.36 | **POWER-GAP** |
| ymir | DISADV (Ice) | 0 | 0 | 72.8% | 58.7% | 30.4% | 7.75 | **CLOSEST TO STRUCTURAL** |

**Seven of the eight zeros have been dragged below 26% of max HP, and five of eight have been
taken to 0.0% — kraken has killed them.** kraken_v2 won at least one game against five of the
eight during this sample. **There is no structural lockout in the set.**

**ymir is the closest thing to one and still is not one**: mean minimum 72.8%, but a best case
of 30.4% for v2. She is a power gap with the largest margin — 7.75 sustain a turn against the
5.80 damage a turn kraken manages into her, the worst offensive cell in the whole study.

**Sustain is not the common cause.** Four of the eight zeros have effectively none:
jormungandr **0.00**, nidhoggr **0.00**, huldra 1.93, draugr 3.39. Those are lost on raw race,
not on healing.

---

## 3. Loss autopsy

**She is out-damaged in every single zero matchup**, without exception:

| | damage dealt/turn | damage taken/turn |
|---|---|---|
| best zero (ratatoskr) | 15.70 | 19.51 |
| worst zero (ymir) | 5.80 | 16.96 |

Games last 3.4–7.3 turns. **She is out-raced, not out-scaled** — the two longest zeros
(valkyrie 7.33, huldra 6.50) are also where she comes closest, which is the opposite of the
"loses long games" story.

**Energy spent on cards that deal no damage: kraken_v1 0.0%, kraken_v2 36.8%.** Every v1 card
carries an attack; v2 spends **more than a third of its energy on `capacitor`**, on a
2-Energy frame, in a 4.9-turn game.

---

## 4. Pool probes — none of them work

Three arms per deck against the eight zeros, in memory only.

| arm | jorm | huldra | ymir | draugr | valkyrie | audhumbla | nidhoggr | ratatoskr | **total win%** |
|---|---|---|---|---|---|---|---|---|---|
| kraken_v1 `baseline` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0.0%** |
| kraken_v1 `poison` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0.0%** |
| kraken_v1 `energy` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0.0%** |
| kraken_v1 `both` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0.0%** |
| kraken_v2 `baseline` | 0 | 0 | 0 | 0 | 2 | 0 | 1 | 1 | **2.5%** |
| kraken_v2 `poison` | 0 | 1 | 0 | 0 | 3 | 0 | 0 | 1 | **3.1%** |
| kraken_v2 `energy` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0.0%** |
| kraken_v2 `both` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0.0%** |

**Not one arm moves a single zero off zero for kraken_v1.** For v2 the poison arm nudges total
win rate 2.5% → 3.1% and the energy arms make it **worse, to 0.0%**.

The mean-minimum-opponent-HP column tells the same story from the other side: the energy arm
(swapping `capacitor` out for attacks) *raises* v2's mean-min from 53.4% to 64.5% against
audhumbla and 44.0% to 48.7% against nidhoggr — she gets **further** from a kill, because the
ramp she loses was buying her the 3-energy payoff turns.

**Conclusion for the design session: the existing pool does not contain kraken's answer.** This
was the cheap fix and it is measurably not available.

---

## 5. `surge_protection`'s condition — it is *nearly* conditionless, and the "nearly" is real

The chain, cited:

1. `programs.json` — the ENERGY refund carries `conditionals: [{ id: "card_drawn_check" }]`.
2. `constraints.json:42` — `card_drawn_check` = `{ type: "CARDS_DRAWN", target: "SELF", value: 1 }`.
3. `ConditionValidator.ts:199` — `if (state.cardsDrawnThisTurn < constraint.value) return false;`
4. `resolutionEngine.ts:531` — `executeDraw` increments `cardsDrawnThisTurn` by the count drawn.
   **The `isNatural` flag is passed but never consulted for this counter** — it only routes hooks.
5. `battleReducer.ts:943` — the draw phase calls `executeDraw(..., true)`, hitting the same counter.

**So the draw-phase draw satisfies the condition for every species.** Ticket 65's 100% uptake
over 3,371 casts is explained.

**But it is not literally inert, and this is the nuance worth having.** `cardsToDraw` is clamped
by `HAND_SIZE_LIMIT - hand.length` (battleReducer.ts:942), so a turn beginning with a full hand
draws nothing and the counter stays 0. Measured across this study: **8.8% of kraken_v1's plays
and 9.6% of kraken_v2's happen on a turn where `cardsDrawnThisTurn` is 0.** The AI simply never
chooses to cast `surge_protection` on those turns.

**Verdict: it belongs to the dropped-condition family in effect but not by construction** — it
is a net-1e 40-power attack on ~91% of turns for any species, and a true 2e one on the rest.

---

## 6. Questions for Henry

1. **The deficit is −1.49 net damage a turn** (§1). Is the fix offensive (raise rate ~12%) or
   defensive (raise the frame / add mitigation)? The roster says the game pays for rate —
   hel_v2 takes the most damage in the game and wins the most.
2. **Her four wins are her four type-advantaged matchups** (§0a). Is "Water beats Fire and
   Earth, loses to everything else" acceptable identity, or is the target a deck that wins some
   neutral matchups on merit?
3. **`capacitor` is 36.8% of v2's energy and 0% of its damage** (§3), yet removing it made her
   *worse* (§4). It is buying the 3-energy payoff turns. Does v2 want a cheaper ramp rather
   than none?
4. **`surge_protection`'s condition fires ~91% of the time for everyone** (§5). Leave it as
   flavour, or does the dropped-condition family want a sweep?
5. **ymir is the one matchup worth a targeted answer** (§2) — 5.80 damage/turn into 7.75
   sustain is the only cell where the arithmetic genuinely does not close.

---

## 7. Card appendix

| card | cost | element | text |
|---|---|---|---|
| `whirlpool_v2` | 1e | Water | 8 power. Draw a card. |
| `pressure_point` | 1e | Water | 22 power. If Dazed, draw 1. |
| `ink_stream` | 1e | Water | Deal 12 power per card drawn. |
| `surge_protection` | 2e | Water | 40 power. If you drew a card this turn, refund 1 Energy. |
| `water_slap` | 0e | None | 12 power, no STAB. |
| `maelstrom` | 3e | Water | Heavy Water damage, apply 1 Dazed. |
| `hydro_blast` | 3e | Water | 105 power. |
| `capacitor` | 2e | None | Gain 2 Energy next turn. |

**Probe cards (diagnostic only, not proposals):** `corrosive_bolt` 1e Water — 3 Poison;
`venom_fang` 1e Water — 25 power.
