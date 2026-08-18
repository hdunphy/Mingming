# Balance-model bug fixes and curve corrections

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-07
- Commit: `5cbadd8`

## Question

fenrir_v1 sat at §2.3 = 0.00 after ticket 26 and resisted both knob rounds and every AI-eval
variant. Find out why.

## Resolution

It was never a balance problem. Three defects, then three pricing corrections.

### Engine / AI bugs

1. **Lifesteal cards attacked their own Mingming.** `TacticalAI` bucketed any card containing
   a `HEAL` action as ally-targeting, so `crimson_draw`, `blood_rite`, `leech_strike` and
   `drain_life` were played with `targetId === sourceId`. Traced live: `blood_rite` at 41% HP
   left the enemy at 46 -> 46 and the caster at 31 -> 32. This is why fenrir's "brake" read as
   3x undersized — it was not a weak brake, it was a self-attack. `crimson_draw` play rate
   **12% -> 79%**.
2. **The ticket-27 card-advantage term double-charged every play.** The search books a card's
   EFFECT in the leaf state and simultaneously books -1 card, so a play only beat ending the
   turn if it beat the *stock* value of the card it spent — a 7.5-point toll on a 75 HP frame.
   Every sub-4-damage card in the registry became worse than passing. Cards cast this turn now
   count as still held. Two pinned AI tests asserting `PLAY_PROGRAM` and getting `END_TURN` go
   green on this alone.
3. **Burn overflow** made one excess stack deal a full 3-stack turn instantly, bypassing
   defense — strictly better than the DoT it replaced. `molten_core`: a 1-energy card worth up
   to **18 damage (24% of a 75 HP pool)** while powerscale scored it 2.60 against a 3.00 cap.
   Repriced 0.08 -> **0.01** of maxHP per overflow stack (Henry's number).

### Curve corrections

Documented in full in `power_curve_spec.md` rev 3.4: mutually exclusive branches scored
`max()` not `sum()`; `damageOverride` priced as literal HP; stream statuses 15 -> 5 and
10 -> 3.5. 39 of 143 cards re-scored.

### Deck work

`fenrir_v1` rebuilt to 9 cards. **`desperate_strike` deleted** — 10 flat HP for +1
Strengthened, i.e. ~1.1 HP of extra damage across a whole game. Buffed variants (2 Strength /
5 self-damage, over its 0e cap) all measured *worse* than deleting it, because the status
under-delivers at any price. `battle_rhythm` became a 25-power Attack keeping its either/or
branch; it lands at 3.10 against a 3.00 cap and the +0.10 is accepted knowingly.

### Isolating the cause

Each fix measured alone. Targeting and the eval fix together left fenrir at 0.00 — they made
cards *playable* without changing the outcome. The Burn overflow reprice alone took it to
0.11 and the pace from 3.1 to 4.7 turns. Deck work carried the rest.

| | §2.3 | avgTurns | deadCards |
|---|---|---|---|
| ticket 26 state | 0.00 | 3.1 | 45.2% |
| + targeting fix | 0.00 | 3.1 | 45.2% |
| + eval double-charge fix | 0.00 | 3.1 | 41.0% |
| + Burn overflow 0.08 -> 0.01 | 0.11 | 4.7 | 32.1% |
| + drop `desperate_strike` x2 | 0.242 | 4.9 | 29.0% |
| + `battle_rhythm` 25 power | **0.394** | 4.8 | 27.1% |

All six tuned species land inside the 0.30-0.70 first-pass band for the first time.
hraesvelgr's standing v2 dead-card breach (0.527) closed to 4.0% on the AI fixes alone.
