# Ticket 152 — jormungandr_v1's two undertows draw each other: a base enemy deck that loops

> **CLOSED 2026-09-22 — Henry ruled the third answer: the deck keeps its shape, and the RUNG
> decides who meets it.** A WILD drops the extra copies of a pure cantrip; an ELITE and a GYM
> keep them. Both §3 card swaps were measured and both gutted the deck; the engine lever was
> measured too and declined. Numbers in `../../../../results/t152/FINDINGS.md`, §6 and §7.

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

## 7. Ruled and shipped (2026-09-22) — the rung decides, not the deck

Henry, given §6's table: *"leave it, but remove the double undertow cards from all wild encounters.
It should only be in elites and bosses."*

Neither card swap ships. Neither does the engine lever. The deck list is untouched — `jormungandr_v1`
still reads `undertow ×2` in `mingmingRegistry`, the balance corpus still measures the deck it has
always measured, and a player who drafts two `undertow` can still loop them, which is ticket 111's
law verbatim (*players may break decks*).

What changed is **who meets it**.

### The condition, and why it is not a list of card names

`IEnemyLoadout` gains `duplicateCantrips`: **false at a wild, true at an elite and a gauntlet**.
When false, the enemy side's assembled deck keeps only the FIRST copy of any **pure cantrip**:

  - **0 energy**, so casting it is free and a hand of them resolves in one turn;
  - **it draws**, so a copy can put its twin back in your hand;
  - **and it does nothing else**, so there is no price that stops the third repetition.

That third clause is the one doing the work. `forage` is 0-cost and it draws — and it also takes 15
power out of the caster, so looping it kills the looper. The brake is in the card. Excluding it by
that property rather than by name is the difference between a rule and a blocklist: a future cantrip
WITH a cost is fine without anyone remembering to think about it, and a future one without a cost is
caught without anyone remembering to add it.

**Two shipped lists are affected and they are the only two:** `jormungandr_v1` (`undertow` ×2, the
deck this ticket is about) and `sleipnir_v1` (`slipstream` ×2). `ratatoskr_v1` and `hel_v2` run
`forage` ×2 and keep both at every rung.

### On the SIDE's pile, not the member's

The enemy side shares one deck. Three `jormungandr_v1` put **six** `undertow` in one pile even
though no member ships more than two, and a per-member rule would have left three — enough to loop,
under a rule that claims to stop looping.

The first implementation made exactly that mistake, and the existing ticket-08 test caught it: it
compares the assembled pile card for card and in order, so it expected one `undertow` and got two.
The de-duplication moved to the assembled pile, and order is preserved with the first copy kept —
the deck is shuffled from a seeded stream, and a rule that reordered the list would change every
wild encounter's draw in the corpus rather than only the decks it removes a card from.

### Measured

Running `jormungandr_v1` on the 8-card list through the same 1,200-game probe as §6:

| | shipped | wild (de-duplicated) |
|---|---|---|
| turns with ≥6 undertow casts | 12.7% | **0.0%** |
| max undertow in one turn | 18 | **2** |
| `ink_stream` max triggered draws | 19 | **3** |
| turns dealing ≥75% of a health pool | 16.8% | **0.0%** |
| damage/turn p90 | 94.2% | 32.8% |

The loop is gone as completely as either card swap removed it. The difference is that **only the
wild pays for it** — the elite and the gym still field the deck the corpus is calibrated on.

### What moves and what cannot

§2–3 of the balance report **cannot** move: that corpus builds its decks from `getDeckForOS`
directly and never calls `rollEncounter`. §1.3 and §1.4 cannot move either — no card or firmware
changed.

The **run gate** does move, because it rolls its enemies through `rollEncounter`. That is the
measurement that should move: it is the one that simulates a player's run.

### Tests

The gym is untouched **structurally** rather than by a flag — `rollGauntletFight` is a sibling of
`rollEncounter` and builds its own pile. That is the kind of thing that stays true until someone
refactors the two together, so `gauntlet.test.ts` asserts a gauntlet fight still ships duplicates.
Wild-versus-elite, the side-level cap and the `forage` exclusion are asserted in `encounter.test.ts`
through `rollEncounter` rather than through the helper, because the claim is about what the PLAYER
meets — a rule that worked in the helper and was never wired to a node would pass a unit test and
ship the bug.

## 8. A brake on the card, measured (2026-09-23) — it does not work

Henry: *"what happens with jorm if we add recoil damage or self weaken to undertow"*. Six arms,
1,200 games each. Full table in `../../../../results/t152/BRAKE-FINDINGS.md`.

| | shipped | recoil 10 | recoil 15 | self-Weaken 1 | self-Weaken 2 |
|---|---|---|---|---|---|
| field win % | **69.6** | 59.5 | 50.7 | 48.2 | 26.2 |
| turns with ≥6 undertow casts | 12.7% | 8.3% | **4.8%** | 9.9% | 4.3% |
| max undertow in one turn | 18 | 16 | **14** | 14 | 8 |
| turns dealing ≥75% of a pool | 16.8% | 11.7% | **7.7%** | 9.9% | 2.9% |
| damage/turn MAX | **145.0%** | 149.1% | **146.5%** | 118.6% | 100.0% |
| self-damage/turn max | 0% | 32.5% | **40.4%** | — | — |

(The wild-rung rule and both §3 swaps give 0.0% and a max of 2.)

**No brake removes the loop.** At `recoil 15` — `forage`'s own number, the strongest arm that leaves
the card playable — he still loops six deep in one turn in twenty and fourteen deep at worst, and
one turn in thirteen still removes three quarters of a health pool. **The one-turn kill that opened
this ticket survives every recoil arm**: the worst turn is 145.0% of a pool shipped and 146.5% at
recoil 15.

**He pays gladly, and the number says how gladly**: at recoil 15 he spends up to **40.4% of his own
health pool in a single turn** to run the loop. A cost does not deter a loop whose payoff scales
with the loop — `ink_stream` reads cards drawn this turn and `serpents_coil` reads cards played this
turn, so every iteration pays for itself several times over. There is no recoil small enough to be
fair and large enough to stop it.

**This is why `forage` is different.** Its brake works because its draw feeds nothing in particular.
The brake is not doing the work there; the absence of a payoff is. Worth writing down, because
"`forage` has a brake, so give `undertow` one" is the obvious next idea and it is wrong.

**And a card change has collateral.** `undertow` is a pool card, also in `kraken_v1`'s tuned deck
and start kit (one copy, no loop) and in `jormungandr_v1`'s PLAYER start kit. kraken_v1 loses 11-13
points for a loop it cannot run: 47.3% shipped, 36.4% at recoil 10, 33.9% at recoil 15, 41.4% at
self-Weaken 1.

**Nothing shipped.** `programs.json` is byte-identical; the wild-rung rule from §7 remains the fix.

One measurement bug this found in the harness, fixed in the same commit: the first cut summed every
cast's damage, so a recoil arm scored its own recoil as damage DEALT and `recoil 10` read a 177.4%
worst turn against the shipped 145.0% — the brake appearing to make the card more dangerous.
`scratch/t152_gates.ts` splits self-facing casts into their own column now, which is also where the
40.4% figure comes from.
