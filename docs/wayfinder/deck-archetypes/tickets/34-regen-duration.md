# Regen: stacks are duration, not intensity

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-08
- Blocked by: [33-huldra-decks](33-huldra-decks.md) (closed - this resolves its open breach)

## Question

Ticket 33 shipped huldra with §2.3 at 0.790, breaching from the high side, and handed back because
every authorised knob was exhausted. Investigating why produced a chain of wrong answers before the
right one, and the right one turned out to be a mechanic that never matched its design intent.

## How the diagnosis went wrong twice

Worth recording, because each step looked conclusive:

1. **Ticket 33 blamed ALLURE_PROXY's free Weakened.** Measured: only **3.5 Weakened** standing on
   the enemy. The OS is a bit player. Wrong.
2. **Then it looked like Sharp.** `iron_bark` x2 -> 0.790, x1 -> 0.060, x0 -> 0.000, and v1 sat at
   **15.5 Sharp**, pinned at the 25% cap all game. But cutting the stacks per play 3 -> 2 -> 1 moved
   §2.3 by 0.790 -> 0.780 -> **0.770**. Also wrong - the card's Sharp was not what mattered.
3. **It was the Regen riding on the same card.** Every variant *without* 2 Regen measured
   **0.000**: 3 Sharp, 3 Strength, 5 Strength, 3 Strength + a 10-power attack. Every variant *with*
   it won 74-86%.

**The lesson: when one card decides a matchup, isolate every clause on it before naming a cause.**
Two of its three clauses were red herrings.

## Henry's correction

Regen was meant to be a **flat 3% of maxHP per turn, with `stacks` as DURATION** - 3 stacks = 3% a
turn for three turns. The engine multiplied by stacks instead, so one application was worth
`1.5·N(N+1)` percent of a pool, and because the decay is a flat 1/turn it was the only uncapped heal
in the game. Fifteen stacks healed **45% of a health pool every turn**.

That made it a step function rather than a curve: 2 Regen per play accumulates forever, 1 per play
exactly cancels the decay and never accumulates. Hence 0.790 / 0.010 / 0.000 with nothing between,
and hence no tuning seat anywhere - not in the card, not in copy count, not in the decay rate (2/turn
and 3/turn both measured 0.000).

## Resolution

Three sites, all of which modelled the old shape:

- **`StatusBehaviors.ts`** - heal is now `floor(maxHp * 0.03)`, flat, with stacks as remaining turns.
- **`TacticalAI.ts`** - the eval mirrored the triangular shape; now linear in stacks.
- **`powerscale.ts`** - `regenPower()` was `3·S(S+1)`, wrong twice: Poison's triangular shape applied
  to a status that no longer has one, *and* damage's 3-power-per-1%-maxHP rate instead of heal's 4.
  Now **`12 · stacks`**. Poison's formula is unchanged and remains correct - the two look alike and
  are not.

| | §2.3 | mirror turns | decided | deadCards |
|---|---|---|---|---|
| huldra before | 0.790 ✗ | 20.6 | 368/400 | 0.2% |
| **huldra after** | **0.660** ✓ | **15.3** | **385/400** | **0.6%** |

## Full gate — all eight tuned species

| species | element | §2.3 | osTurns | mirror | decided | dead | ftk |
|---|---|---|---|---|---|---|---|
| kraken | Water | 0.540 | 5.5 | 5.1 | 400/400 | 10.1% | 0 |
| jormungandr | Water | 0.390 | 7.7 | 6.4 | 400/400 | 10.0% | 0 |
| sleipnir | Air | 0.330 | 4.2 | 4.5 | 400/400 | 16.6% | 0 |
| hraesvelgr | Air | 0.310 | 3.2 | 3.2 | 400/400 | 4.5% | 0 |
| fenrir | Fire | 0.394 | 4.8 | 5.2 | 381/400 | 27.1% | 0 |
| sköll | Fire | 0.640 | 3.8 | 3.7 | 400/400 | 32.3% | 0 |
| ratatoskr | Nature | 0.590 | 5.9 | 4.7 | 400/400 | 3.8% | 0 |
| huldra | Nature | 0.660 | 12.9 | 15.3 | 385/400 | 0.6% | 0 |

**Every tuned species passes every first-pass band, FTK 0 across all of them.** The tuned mirror mean
is **6.0 turns** — inside the 5-6 target for the first time. Water, Air, Fire and Nature are all
complete at 16/32 decks.

Huldra still trips the auditor's strict ±15% `osMaxGap` at 0.660 (0.01 outside 0.35-0.65). Per
HANDOFF that assertion is for the final tuning pass and is not the working bar.

## Reported, not fixed

- **`iron_bark` 3.10 vs a 3.0 band** — the one new redline, from the corrected Regen price. Accepted
  under the band-is-a-target ruling.
- **`overgrowth` 3.60 vs a 3.0 band** — was a corrected 7.20 before this change. In no deck; re-check
  before it enters one.
- **Two enemy intents grant Regen** (`kraken_regen` 2 stacks, `audhumbla_milk` 1) and are weaker in
  real play now. They run in MOVES mode, so they do not appear in these CARDS-mode numbers.
- **huldra_v1 is still a one-card deck.** `iron_bark` x1 measures 0.030 and x0 measures 0.000 even
  after this fix — the cliff is smaller but the deck's damage is still two `thorn_tithe` and one
  `hexbloom`. A real payoff is a future design call, not a knob.
