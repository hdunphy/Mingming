# The draw-four experiment: it dies for Sleipnir, and it points at Huldra

- Type: wayfinder:research. **Ticket 100.** Branch `archetype-web`.
- **Report only. Nothing shipped.** The ticket allowed for exactly this: *"If she feels the same,
  the idea dies for the cost of one ticket."*
- **It also turned up an infinite loop in a shipped deck** — section 5, and it is the most important
  thing in this document.

---

## 0. The short version

Give Sleipnir a fourth card of draw and she doesn't get **wider**, she gets **stronger**. The draw
point is worth **+34.6 field points and +0.36 cards per turn.** Paying it back in card power doesn't
work: I cut five of her cards to a fraction of their printed values — `stampede` from 11 power to 1
— and she was *still* nine points above where she started.

The reason generalises, and it's the useful part: **draw only buys width for a deck whose constraint
is hand size.** Sleipnir's constraint is Energy and her mint engine. She already throws away 17% of
the cards she draws.

The deck the recipe actually fits is **`huldra_v1`** — 3.9% dead cards, and at draw 4 she goes from
playing 4+ cards on **0% of turns to 38%**.

---

## 1. The ticket's premise is stale

It describes `sleipnir_v1` as *"36.8% field, 20 points behind her sibling."* After ticket 103 she is
at **57.7%** on the grid and **ahead** of `sleipnir_v2` (56.4). The "land ~45%" target doesn't apply
any more.

The live question is the one underneath it, which is still worth answering: **does draw-4-paid-in-
power make her a wider deck without making her a stronger one?**

---

## 2. What a draw point actually buys her

| | field | dead cards | cards/turn | 4+ cards on |
|---|---|---|---|---|
| **draw 3 (live)** | **55.6%** | 17.3% | **3.40** | **47% of turns** |
| draw 4, uncut | 90.2% | 19.9% | 3.76 | 60% of turns |

**+34.6 points of win rate for +0.36 cards per turn.** Her blowout matchups go 1 → 14.

And note the baseline: **she already plays 3.40 cards a turn and already hits four-plus on 47% of
turns.** The ticket's success condition — *"plays 4+ cards a turn"* — is close to met at draw 3.
There isn't much width left to buy.

---

## 3. The payback doesn't work

Ticket 88 measured the exchange at ~2–3 cards of power per draw point. That was at her old baseline.
Post-103 it is much worse, because `stampede` scales on cards played and her Strengthened ramp
compounds with card volume — so the draw point is worth *more* now and the power cut is worth *less*.

| cut | field | cards/turn |
|---|---|---|
| none | 90.2% | 3.76 |
| `stampede` 11 → 7 | 82.1% | 3.82 |
| `stampede` → 5 | 79.4% | 3.88 |
| `stampede` → 5, `zephyr_strike` 15 → 10 | 78.5% | 3.90 |
| `stampede` → 4, `zephyr_strike` → 8, `water_slap` 12 → 8 | 75.2% | 3.87 |
| `stampede` → 2, `zephyr_strike` → 5, `water_slap` → 5, `adrenaline` 18 → 8 | 66.9% | 3.88 |
| `stampede` → 1, `zephyr_strike` → 3, `water_slap` → 3, `adrenaline` → 5, `momentum_crash` 8 → 4 | **64.6%** | **4.14** |

The last row is five cards gutted — `stampede` at **1 power** is not a card — and she is *still* nine
points above her 55.6% baseline. Only there does she reach 4.14 cards a turn.

**There is no net-neutral point that leaves her a deck.**

One more cost worth naming: `cardDraw` is a **species** stat, so `sleipnir_v2` rides along —
56.3% → 74.1% uncut, and she isn't the subject of the experiment at all.

---

## 4. Where the recipe does fit

The diagnostic is **dead cards**: a deck that plays everything it draws is hand-limited, and drawing
more makes it wider. A deck that already bins a fifth of its hand is limited by something else, and
drawing more just improves its selection.

| deck | dead cards | draw | reading |
|---|---|---|---|
| `huldra_v1` | **3.9%** | 3 | **hand-starved — the candidate** |
| `jormungandr_v1` | 8.4% | 3 | hand-starved |
| `huldra_v2` | 9.6% | 3 | hand-starved |
| `valkyrie_v2` | 10.6% | 3 | hand-starved |
| `valkyrie_v1` | 12.9% | 3 | hand-starved |
| `sleipnir_v1` | 17.3% | 3 | middling — and it shows |
| `kraken_v2` | 31.9% | 3 | flooded |
| `fenrir_v1` | 34.1% | 3 | flooded |
| `hraesvelgr_v2` | 44.4% | 4 | flooded, at draw 4 already |
| `ymir_v2` | 62.2% | 3 | flooded by design (one card a turn) |

And `huldra_v1` confirms it:

| | field | dead | cards/turn | 4+ cards on |
|---|---|---|---|---|
| draw 3 (live) | 62.9% | 4.3% | 2.49 | **0% of turns** |
| draw 4 | 80.0% | 5.6% | **3.04** | **38% of turns** |

She goes from **never** playing four cards to doing it on more than a third of turns, and her dead
cards barely move — she plays what she draws. That is a width change. Sleipnir's 47% → 60% is not.

The draw point is still worth +17 points to her, so the payback problem remains — but it's a payback
against a real width gain instead of against nothing.

**Recommendation: retarget the ticket-88 recipe at `huldra_v1`.** She is the deck it was describing.

---

## 5. An infinite loop in `valkyrie_v2` — found by accident, and it should be fixed

My cards-per-turn walker reported `valkyrie_v2` at **45 cards a turn**. I assumed my instrument was
broken, added a max-per-turn readout to prove it, and got **3,942 cards in a single turn** — the
walker's 4,000-step guard.

It isn't the instrument. Repro, deterministic:

```
valkyrie_v2 vs huldra_v1, seed 761868416
stuck at turn 8, side PLAYER, hand 5, drawpile 0, discard 0, energy 0
glimmer x3949
```

**`glimmer` draws itself, forever.** It costs 0 Energy and its whole text is "Draw a card."
`handlePlayProgram` moves the played card to the discard *before* its actions resolve, so when
glimmer's DRAW finds an empty drawpile, the reshuffle picks up the single card in the discard —
**glimmer** — and draws it straight back into hand. Zero energy spent, board unchanged, repeat.

It's the "cheap-shifter cantrip loop" already on the HANDOFF's infinite-loop watch list. The balance
sim doesn't surface it because `runPairedBatch` has its own step guard and just ends the game, so it
shows up as an ordinary result — which is why it has survived.

A human hits this as a turn that never ends.

Two candidate fixes, both outside this ticket's scope:

1. **Move the played card to the discard AFTER its actions resolve** (it currently goes before).
   This is the actual defect — a card should not be able to draw itself. Blast radius: `PLAY_LAST_CARD`
   and anything else that reads the discard mid-resolution.
2. **Exclude the currently-resolving card from a mid-resolution reshuffle.** Narrower, and it fixes
   the whole class rather than this card.

I'd want this as its own ticket with a repro test, not bolted onto a report-only one.

---

## 6. What I'd want to know

Nothing was shipped, so there's nothing to playtest. The two open questions are yours:

- **Do you want the recipe retried on `huldra_v1`?** She's the deck ticket 88 was actually
  describing, and the width gain is real there.
- **The `glimmer` loop needs a ticket.** It's a correctness bug in a shipped deck, it's
  deterministically reproducible, and it's the same class as the ticket-105 findings.
