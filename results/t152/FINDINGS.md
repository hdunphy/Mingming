# Ticket 152 — the swap was tried, and it does not pass §4 gate 3

**Run 2026-09-22.** `scratch/t149_castprobe.ts --width 1 --owner jormungandr_v1 --iter 20`, all 30
opponents, 1,200 games per arm, beamless. Gates computed by `scratch/t152_gates.ts`.

## The baseline reproduces §2, which is what makes the rest trustworthy

| | §2 (census) | this run |
|---|---|---|
| turns with ≥6 undertow casts | 12% | **12.7%** |
| max undertow casts in one turn | 18 | **18** |
| `ink_stream` triggered draws at cast, mean | 3.0 | **3.03** |
| ...max | 19 | **19** |
| turns dealing ≥75% of a health pool | 16.5% | **16.8%** |
| damage per turn, p50 | 22% | **23.0%** |

## The four arms

|  | shipped | A: `poison_injection` | B: 2nd `blind_spot` | engine lever |
|---|---|---|---|---|
| **field win %** | **69.6** | **18.3** | **26.8** | **42.8** |
| turns with ≥6 undertow | 12.7% | 0.0% | 0.0% | 0.0% |
| max undertow in a turn | 18 | 2 | 2 | 4 |
| `ink_stream` max triggered draws | 19 | 3 | 3 | 5 |
| `ink_stream` mean draws | 3.03 | 0.87 | 0.90 | 1.65 |
| turns dealing ≥75% of a pool | 16.8% | 0.0% | 0.1% | 0.1% |
| damage/turn p90 | 94.2% | 32.1% | 36.6% | 40.8% |
| damage/turn max | 145.0% | 70.8% | 77.5% | 90.2% |

**Gate 1 (the loop is gone): all three fixes pass.** Zero turns with six or more undertow casts, and
`ink_stream` never reads more than the gate's ≤5 triggered draws.

**Gate 2 (the burst is a burst): all three pass.** ≥75%-of-a-pool turns fall from 16.8% to 0.0–0.1%
against the gate's "under 5%", and p90 damage to 32–41% against the gate's "under 60%".

**Gate 3 (the deck still works): both card swaps fail, and they fail by 43–51 points.**

## Gate 3 as written cannot be passed, and the peer table is why

§4 asks for the field to land within ±5 of the shipped baseline. The shipped baseline IS the loop:

| EA deck | field |
|---|---|
| ratatoskr_v1 | 64.2% |
| huldra_v1 | 56.3% |
| fenrir_v1 | 52.9% |
| jormungandr_v2 | 51.7% |
| skoll_v1 | 47.3% |
| kraken_v1 | 46.7% |
| **jormungandr_v1, shipped** | **69.6%** |

(600 games each, same harness.) He is the top of the EA roster and ~17 points above its median. The
loop is worth roughly that much and more: take it away with a card swap and he goes to 18–27%,
which is not "within ±5 of shipped" and is not near his peers either. **A fix that removes the loop
cannot hold a baseline the loop produced.** The gate is asking for two things that are the same
thing.

## The parked lever measured, because it changes what the choice is

§4: *"If neither passes 3, report — the next lever is the engine (extend the 111 guard to every copy
of the resolving card's id during a triggered draw)."*

Measured, **not shipped** — a patch applied in a working copy, run, and reverted (`deckLogic.ts` and
`resolutionEngine.ts` verified byte-identical afterwards by checksum). During a triggered draw, every
copy of the resolving card's `dataId` is held out of the reshuffle, not just the resolving instance.

It kills the loop as completely as the swaps do **and leaves a deck**: 42.8%, both undertows intact,
and `ink_stream` at the gate's ceiling of exactly 5 triggered draws. Still ~9 points under the peer
median, so it is not a free pass — but it is in the same game as his peers, where 18% is not.

`ink_stream` casts go UP under it (4,034 against 3,451) because the games last longer, which is the
shape of a deck that no longer wins or loses on turn two.

## What this costs, which is the part that is Henry's to weigh

The engine lever is a change to `drawCards`, so it reaches **every deck in the game, not just this
one** — any deck running two copies of a draw cantrip draws differently. It does not disturb the
PRNG stream (the discard is shuffled whole either way, exactly as ticket 111 arranged), but the
cards that come off the top change, so **the balance grid needs a re-baseline**.

It is also the fix that covers every future two-copy cantrip rather than one deck's symptom, which
is the argument §4 already made for it.

## Nothing was shipped

Neither arm meets §4's bar, so neither was committed. Per §4, this is the report.
