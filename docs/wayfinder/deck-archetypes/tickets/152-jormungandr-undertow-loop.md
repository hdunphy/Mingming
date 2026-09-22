# Ticket 152 — jormungandr_v1's two undertows draw each other: a base enemy deck that loops

> **MEASURED 2026-09-22 — NOTHING SHIPPED. Both arms pass §4 gates 1 and 2 and fail gate 3 by
> 43–51 field points; the parked engine lever passes all three. Henry's call.**
> Numbers in `../../../../results/t152/FINDINGS.md` and §6 below.

**Type:** balance (card swap in one base deck). **Status:** RULED by Henry 2026-09-11 — *"let's try
with a card swap first, another 0e Water card, maybe apply a status"*. Card swap only; no engine
change in this ticket.
**Branch:** current working branch, one commit per lettered row, authored as Henry.
**Law:** ticket 111 — *players may break decks; base enemy decks may not loop.*
**Evidence:** Henry's run log 2026-09-10 (`mingming_run_log.json`, fight 14: a wild jormungandr
killed a full-health Nature recruit in one turn — *"he ink streamed me and played like 4
undertows"*) and the ticket-149 census log `results/t149_consume/w1_jormungandr_v1.jsonl` (1,200
games, jormungandr_v1 as the player vs the 30-opponent set, beamless).

---

## 1. The mechanism

jormungandr_v1's list is nine cards: `undertow` ×2 (0e, draw a card), `corrosive_leak` (0e, +1
Energized), `blind_spot`, `surge_protection`, `serpents_coil` ×2 (10 power × cards played this
turn), `ink_stream` ×2 (33 power × cards drawn by effects this turn), and OUROBOROS_LOOP draws on
the fifth Water card. Ticket 111's guard (`deckLogic.ts` L31–65) holds the *resolving instance*
out of a reshuffle so a card cannot draw itself. It does not stop two copies drawing each other:
undertow A draws B; B's draw reshuffles a discard that contains A; A is drawn and played; repeat.
On a nine-card deck the pile cycles inside one turn and every pass feeds both scalers.

## 2. Measured (census log, 3,313 jormungandr turns)

| | |
|---|---|
| undertow casts in one turn | 0–2 in 79% of turns; **≥6 in 12%**; max 18 |
| triggered draws `ink_stream` reads at cast | mean 3.0 (scorer constant 1.25); max 19 |
| `ink_stream` damage per cast | mean 22% of the target's pool; p90 50%; max 90% |
| damage per turn | p50 22%; **p90 87%**; max 103% |
| turns dealing ≥75% of a health pool | **16.5%** — against every species in the roster |
| turn-1 damage | mean 22%, max 70% (the burst needs one reshuffle, so it starts turn 2) |

The wild enemy AI runs beam 8 (ticket 144 §2), which finds the line more reliably than the
beamless census did. The scorer has `ink_stream` at 4.1 (+37%) because it assumes 1.25 draws.

## 3. The swap — two arms, Henry picks from the field

Replace **one** `undertow` so the pair cannot ping-pong. The replacement must be 0e and Water (it
keeps `serpents_coil`'s card count and OUROBOROS's fifth-Water trigger honest, and keeps the deck's
tempo). The 0e Water cards in the pool that are not draws: `poison_injection` (apply 1 Poison),
`blind_spot` (6 power, 1 Dazed — already one copy), `scald` (1 Burn, self Dazed — Fire flavour, no).

- **Arm A — `poison_injection`** (Henry's ask: a status). One Poison a cast is a small tax that
  the deck's own `corrosive_leak` already teaches; it is the serpent's card.
- **Arm B — second `blind_spot`.** Keeps the deck's damage-per-card profile closest to shipped.

Both arms: `["undertow", "<swap>", "blind_spot", "corrosive_leak", "surge_protection",
"serpents_coil", "serpents_coil", "ink_stream", "ink_stream"]`.

## 4. Gates

Measured with `scratch/t149_castprobe.ts --owner jormungandr_v1` (it already logs undertow casts,
`nonNaturalDrawn` at `ink_stream` casts and per-turn damage) against the shipped list as baseline:

1. **The loop is gone:** turns with ≥6 undertow casts → 0; `ink_stream` max triggered draws ≤ 5
   (two undertows' worth plus OUROBOROS, no cycling).
2. **The burst is a burst, not the plan:** turns dealing ≥75% of a pool from 16.5% to **under 5%**;
   p90 damage per turn under 60%.
3. **The deck still works:** jormungandr_v1 1v1 field within **±5** of the shipped baseline (the
   same run gives it; ticket 143 last had him at 62 on the 3v3 grid as the Sun Devourer body); the
   140 §8 panel cells he is in (`ink_loop`, `fire_pair`) within ±10.
4. `descriptionData.test`, `npx vitest run`, `npm run balance` §2–3 diff read and attached.

If both arms pass 1–2 and only one passes 3, ship that one. If neither passes 3, report — the next
lever is the engine (extend the 111 guard to every copy of the resolving card's id during a
triggered draw), which is the fix that covers every future two-copy cantrip and is parked here
until the swap has been tried.

## 5. Not in this ticket

The scorer's `CARDS_DRAWN_TRIGGERED` constant (ticket 149c prices it with a floor/ceiling; the
ceiling column is what would have flagged this). Player-side undertow pairs — players may loop.

## 6. Write-back (2026-09-22) — the swap was tried

1,200 games per arm, all 30 opponents, beamless, `scratch/t149_castprobe.ts` with the gates
computed by `scratch/t152_gates.ts`. **The baseline reproduces §2 to within a decimal** — 12.7%
of turns with ≥6 undertow casts against §2's 12%, max 18, `ink_stream` mean 3.03 and max 19,
16.8% of turns dealing ≥75% of a pool — which is what makes the rest of the table worth reading.

|  | shipped | A: `poison_injection` | B: 2nd `blind_spot` | engine lever |
|---|---|---|---|---|
| **field win %** | **69.6** | **18.3** | **26.8** | **42.8** |
| turns with ≥6 undertow | 12.7% | 0.0% | 0.0% | 0.0% |
| `ink_stream` max triggered draws | 19 | 3 | 3 | 5 |
| turns dealing ≥75% of a pool | 16.8% | 0.0% | 0.1% | 0.1% |
| damage/turn p90 | 94.2% | 32.1% | 36.6% | 40.8% |

**Gates 1 and 2 pass on all three fixes**, and not narrowly: the loop disappears and the
≥75%-of-a-pool turn falls from one in six to one in a thousand.

**Gate 3 fails on both card swaps, by 43–51 points — and it is unsatisfiable as written.** The
shipped baseline IS the loop. Against the rest of the EA roster in the same harness — ratatoskr_v1
64.2, huldra_v1 56.3, fenrir_v1 52.9, jormungandr_v2 51.7, skoll_v1 47.3, kraken_v1 46.7 —
jormungandr_v1 ships at **69.6%**, the top of the roster and ~17 points above its median. A fix that
removes the loop cannot hold a number the loop produced; "within ±5 of shipped" and "the loop is
gone" are asking for opposite things.

### The parked lever, measured and not shipped

§4's fallback says the next lever is the engine guard. It was applied in a working copy, run, and
reverted — `deckLogic.ts` and `resolutionEngine.ts` verified byte-identical afterwards by checksum.
During a triggered draw, every copy of the resolving card's `dataId` is held out of the reshuffle
rather than only the resolving instance.

It kills the loop as completely as the swaps and **leaves a deck**: 42.8%, both undertows intact,
`ink_stream` at the gate's ceiling of exactly 5. Still ~9 points under the peer median, so not a
free pass — but in the same game as his peers, where 18% is not. `ink_stream` casts go UP (4,034
against 3,451) because the games last longer, which is the shape of a deck that no longer wins or
loses on turn two.

**What it costs:** `drawCards` is shared, so it reaches every deck running two copies of a draw
cantrip, not just this one. The PRNG stream is undisturbed (the discard is shuffled whole either
way, exactly as ticket 111 arranged) but the cards off the top change, so **the grid needs a
re-baseline**. Against that: it is the fix that covers every future two-copy cantrip rather than one
deck's symptom, which is the argument §4 already made for it.

### Decision needed

1. **Ship the engine lever** and pay for a re-baseline; or
2. **Ship a swap and compensate** jormungandr_v1 back toward ~52% with something that is not a draw
   cantrip — new design, and §5 currently forbids it in this ticket; or
3. **Leave it** — the law in §0 says base enemy decks may not loop, so this is the option that
   needs a reason.
