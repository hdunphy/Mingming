# The kraken diagnostic — she does not lose narrowly, she loses completely to half the roster

- Type: wayfinder:research — **REPORT-ONLY. No changes of any kind were made.**
- Ticket 65, authorized by Henry 2026-08-15. Read at registry `1:b76809c9`, branch `card-dev`.
- **1,800 real battles** (900 per deck: all 15 opponents × 30 seeds × both turn orders).
  Instrumentation samples outside `getBestAction` per `0-AI-SIM-COUNTS`.
- Template and quality bar: `fire-investigation.md`.

---

## 1. The answer, in one row

**Kraken's sub-window field number is not a broad shortfall. It is a wall.**

kraken_v1 reads **26.6%** and kraken_v2 **27.3%** — but the distribution is bimodal to the point
of being binary. v1 **wins 75–100% against four species and wins 0% against eight.**

That is not "relative decay." A deck that has decayed loses 45–55% fights. Kraken wins or she is
shut out, and she is shut out against **more than half the roster**.

---

## 2. Per-opponent field rows — the question that mattered

| opponent | kraken_v1 | kraken_v2 |
|---|---|---|
| fenrir | 100% | 98% |
| skoll | 98% | 78% |
| fafnir | 75% | 65% |
| gullinbursti | 53% | 52% |
| sleipnir | 37% | 38% |
| hraesvelgr | 22% | 32% |
| hel | 13% | 28% |
| jormungandr | 0% | 0% |
| ratatoskr | 0% | 7% |
| huldra | 0% | 0% |
| ymir | 0% | 0% |
| draugr | 0% | 2% |
| valkyrie | 0% | 7% |
| audhumbla | 0% | 0% |
| nidhoggr | 0% | 3% |

**Eight 0% matchups for v1.** Not 10%, not 5% — zero wins in 60 decided games each against
jormungandr, huldra, ymir, draugr, valkyrie, audhumbla, nidhoggr and ratatoskr.

v2 is marginally less binary (four hard zeros, four more at 2–7%) and buys it by trading away
the top: skoll 98% → 78%, fafnir 75% → 65%.

**The two decks have nearly the same field number and nearly the same shape.** Whatever this is,
it is a species-level problem, not an OS-level one — which is why the OS-by-OS questions below
all come back "working as designed, and it doesn't matter."

---

## 3. Damage rate is NOT the problem, and this is the finding that redirects the fix

| deck | damage/game | turns/game | **damage/turn** | field |
|---|---|---|---|---|
| jormungandr_v1 | 84.3 | 3.84 | **22.0** | ~84% |
| hel_v2 | 76.6 | 3.34 | **22.9** | ~78% |
| skoll_v1 | 72.2 | 4.44 | 16.3 | 47.7% |
| fenrir_v2 | 63.8 | 4.58 | 13.9 | ~49% |
| **kraken_v1** | **64.9** | 4.98 | **13.0** | **26.6%** |
| **kraken_v2** | **62.5** | 4.87 | **12.8** | **27.3%** |
| valkyrie_v2 | 74.2 | 5.73 | 12.9 | ~45% |
| audhumbla_v2 | 76.2 | 11.56 | 6.6 | ~40% |

**kraken_v1 at 13.0 damage/turn and valkyrie_v2 at 12.9 are the same deck by this instrument,
and their field numbers differ by 18 points.** Kraken is not out-damaged into her losses. She is
mid-pack on rate and bottom-of-roster on outcome.

Read together with §2 that points somewhere specific: **the eight zeros are not a damage
deficit, they are a matchup structure** — she cannot close against decks that outlast or outheal
her 58 HP frame, the lowest in the game, and she has no answer card for any of them.

---

## 4. Per-card attribution


**kraken_v1** — field **26.6%**, 900 games, 4.98 turns, 64.9 damage/game, FTK 0

| card | plays/game | damage/play | share of damage |
|---|---|---|---|
| `ink_stream` | 3.38 | 9.1 | 47.3% |
| `surge_protection` | 1.69 | 10.5 | 27.3% |
| `pressure_point` | 1.99 | 5.6 | 17.0% |
| `water_slap` | 1.98 | 1.4 | 4.3% |
| `whirlpool_v2` | 1.69 | 1.5 | 4.0% |

**kraken_v2** — field **27.3%**, 900 games, 4.87 turns, 62.5 damage/game, FTK 0

| card | plays/game | damage/play | share of damage |
|---|---|---|---|
| `hydro_blast` | 0.75 | 31.4 | 37.6% |
| `surge_protection` | 2.06 | 10.4 | 34.2% |
| `maelstrom` | 0.48 | 27.1 | 21.0% |
| `water_slap` | 3.32 | 1.4 | 7.2% |
| `capacitor` | 2.05 | 0.0 | 0.0% |

**The internal spread is the striking part.** Kraken's chip cards deliver **1.4 to 5.6 damage a
play** while her two payoff cards deliver **27–31**. `water_slap` at 1.4 and `whirlpool_v2` at
1.5 are, in delivered terms, not attacks — they are draw and tempo filler that happens to carry
a damage number.

v2 is a two-card deck by damage share: `hydro_blast` (37.6%) and `surge_protection` (34.2%) are
**72% of everything she does**, with `maelstrom` adding 21%. v1 is more evenly spread —
`ink_stream` 47.3%, `surge_protection` 27.3%, `pressure_point` 17.0%.

`capacitor` delivers **0.0 damage across 1,842 plays**, exactly as designed (it is a 2e Energy
skill) — but it is 2 Energy and ~2 plays a game on a 2-Energy frame, which is a whole turn spent
not attacking, twice.

---

## 5. TIDAL_CRUSH — firing correctly, delivering 8%

| | measured |
|---|---|
| procs per game | **1.23** |
| bonus damage per game | **5.02 HP** |
| share of kraken_v2's 62.5 damage/game | **8.0%** |

The OS works and the gate is right: it fires on 3e+ Water cards, which is `hydro_blast` and
`maelstrom`, and it fires on essentially every cast of them. **But the 15% multiplier on two
cards in a 4.87-turn game is 5 HP.** Turning it off entirely would cost kraken_v2 about 8% of
her output and nothing about §2 would change.

**ABYSSAL_INK** (v1) applies **2.12 Dazed a game**. Also working; also not the problem.

---

## 6. `surge_protection` post-rework — carrying on cast rate, not on damage

| | kraken_v1 | kraken_v2 |
|---|---|---|
| casts per game | 1.69 | 2.06 |
| damage per cast | **10.5** | **10.4** |
| refund uptake | **1,518 / 1,518 = 100%** | **1,853 / 1,853 = 100%** |

**The refund fires on every single cast in 3,371 casts.** The "if you drew a card this turn"
condition is not a condition on this species — kraken draws 3 and both decks are built around
drawing more. It is a 2-Energy card that costs 1 net Energy, always.

**But 40 printed power delivers 10.4 damage.** It was ticket 55's accidental kraken fix and it
is still her second-biggest damage source purely on volume, not on efficiency.

---

## 7. Detonation non-interaction — confirmed, from the record

Kraken applies no Burn. **Ticket 62's own 8-DIFF is the evidence and it is exact: 57 of 67 rows
were bit-identical across the detonation ship, and every kraken row was among them.** The ten
that moved were the four Burn species and the control aggregates derived from them.

No re-measurement was needed and none was done — asking the question again at 30 iterations
would produce a noisier answer than the byte-identity already on file.

---

## 8. Game-length context — kraken's pace is exactly normal

Roster mirror lengths, shortest to longest:

`jormungandr 3.2 · hraesvelgr 3.2 · skoll 3.6 · sleipnir 4.5 · nidhoggr 4.5 · ratatoskr 4.6 ·
fenrir 5.1 · **kraken 5.2** · hel 5.4 · draugr 6.3 · fafnir 6.5 · huldra 7.3 · gullinbursti 10.1
· audhumbla 13.1 · valkyrie 13.6 · ymir 14.1`

**Roster median 5.28; kraken 5.2.** She is the median deck for pace, and her control-gauntlet
games (7.28 / 6.95 turns) sit just above the 6.66 gauntlet mean — consistent with a deck that
grinds the control down slowly and wins, which she does.

Her archetype fits rev-3.1 pacing. Nothing here indicts the clock.

---

## 9. Recommendation: design session, not a knob — and the numbers that say so

**A knob cannot fix eight 0% matchups.**

Every dial available to kraken moves her damage output, and §3 shows damage rate is not what
separates her from a 45% deck. Concretely: TIDAL_CRUSH is worth 5.02 HP/game (§5), so doubling
it to 30% buys ~5 HP a game — against opponents she currently beats 0% of the time in 60 games.
The same argument applies to `surge_protection`'s power and to the OS caps.

**What the measurements point at instead:**

1. **She has no answer card for sustain or for long games.** The eight zeros are the roster's
   healers, wallers and outlasters. Her deck is eight cards of damage and draw.
2. **58 HP is the lowest frame in the game** and both decks spend Energy on non-damage
   (`capacitor` twice a game, `whirlpool_v2` at 1.5 damage).
3. **Her chip damage does not exist** (§4). Cards priced as attacks deliver 1.4–5.6.

That is a deck-contents question, and per `AIM FLOOR PASSES UPWARD` it is also the natural place
to ask what kraken should do about the top of the field.

---

## 10. Questions for Henry

1. **Is the bimodal shape acceptable as identity** — a deck that dominates aggro and loses to
   everything slow — or is the design goal to flatten it? That decision changes everything about
   the pass.
2. **Eight 0% matchups in 60 decided games each.** Worth confirming none of them is a mechanical
   lockout (an interaction that makes the game unwinnable rather than merely unfavourable)
   before designing — that would be a defect, not balance, and this diagnostic did not test for it.
3. **`capacitor` costs 2 Energy on a 2-Energy frame and deals nothing**, twice a game. Is the
   ramp earning its slot in a 4.87-turn game?
4. **`surge_protection`'s refund fires 100% of the time on this species** (§6). It is
   conditionless in practice — intended, or is the condition meant to bite somewhere?

---

## 11. Card appendix

| card | cost | element | category | rarity | text |
|---|---|---|---|---|---|
| `whirlpool_v2` | 1e | Water | Attack | Common | 8 power. Draw a card. |
| `pressure_point` | 1e | Water | Attack | Common | 22 power. If Dazed, draw 1. |
| `ink_stream` | 1e | Water | Attack | Uncommon | Deal 12 power per card drawn. |
| `surge_protection` | 2e | Water | Attack | Uncommon | 40 power. If you drew a card this turn, refund 1 Energy. |
| `water_slap` | 0e | None | Attack | Common | 12 power, no STAB. |
| `maelstrom` | 3e | Water | Attack | Rare | Heavy Water damage, apply 1 Dazed. |
| `hydro_blast` | 3e | Water | Attack | Rare | 105 power. |
| `capacitor` | 2e | None | Skill | Uncommon | Gain 2 Energy next turn. |

**kraken_v1** — `whirlpool_v2` ×2, `pressure_point` ×2, `ink_stream` ×2, `surge_protection`, `water_slap`
**kraken_v2** — `maelstrom`, `hydro_blast`, `capacitor` ×2, `surge_protection` ×2, `water_slap` ×2

**ABYSSAL_INK_SYS (v1)** — *"Whenever Kraken's side draws a card outside the draw phase, apply 1 Dazed to a random enemy."*
**TIDAL_CRUSH_OS (v2)** — *"Water cards that cost 3 or more Energy deal 15% more damage."*
