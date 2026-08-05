# Mingming Power Curve Spec (rev 2 — locked 2026-08-05)

Everything below was decided in the grilling sessions on Aug 4–5. Nothing is implemented yet.

## The unit

All costs are in **power**. Conversions (level-proof by design):

- 1 energy = 40 power
- 1% of target maxHP as damage = 3 power
- 1% of maxHP as healing or shield = 2 power

## Engine changes required

1. **calculateDamage** — remove the flat `+2`, change divisor `/50` → `/35` (keeps a 1e-40 dealing the same ~7–10 damage at L10, so pacing is preserved), add `Math.max(1, damage)` so nothing ever hits 0. *Why: the +2 was paid per hit, making small/multi hits secretly stronger, and its value shrank with level — card economics drifted as units leveled.*
2. **calculateHeal** — replace with `maxHp × power / 200` (1 power heals 0.5% maxHP). Drop attack scaling and the flat +2. *Why: healing was ~18× damage per power point (natures_touch healed 47 HP at L10 for 1 energy).* LightStance ×1.5 stays on top.
3. **Burn** — decays 1 stack/turn (was permanent). Keeps tiers 2/5/12% maxHP + def shred + overflow burst.
4. **Regen** — heals 3% maxHP per stack per turn (was flat 5 HP).
5. **BarkShield** — shield is % of maxHP (was flat points). Same 20%/turn decay.
6. Data: **reprogram** 1e → 2e; **feedback_loop** daemon 10 → ~7 power per draw.

## Damage curve

| cost | budget (power) |
|---|---|
| 0e | 10 |
| 1e | 40 |
| 2e | 90 |
| 3e | 150 |
| 4e | 190 |

Rule: **50 × energy − 10**. With the +2 gone this is a true +12.5% premium for a 2e card over two 1e cards, identical at every level.

- **Multi-hit:** no surcharge — N hits price at total printed power (thistle_barrage 10×4 = 40 = fair 1e).
- **Side AOE:** budget = 2.2 × power (cyclone 25 → 40; tidal_wave ~65–70).
- **Combining:** sum of parts ≤ budget. Conditional effects ×0.7. Example: 2e with 60 damage has 30 power of rider room.

## Status prices (per stack unless noted)

| effect | price (power) | notes |
|---|---|---|
| Strengthened / Dazed | 15 | 2%/stack, 25% cap; offense stream |
| Weakened / Sharp | 10 | 2%/stack, 25% cap; defense stream |
| Burn 1 / 2 / 3 | 6 / 21 / 60 | decaying, tiers 2/5/12%; overflow = 36/excess stack |
| Poison (S stacks) | 1.5·S·(S+1) | 9 / 18 / 30 / 45 / 63 at S=2–6 |
| Stunned | 55 | one denied enemy turn |
| Asleep | 45 | sets 3, breaks on damage |
| Regen (S stacks) | ~3·S·(S+1) | 3% maxHP/stack/turn decaying |
| Shield | 2 per 1% maxHP | 1e shield card = 20% maxHP |
| Energized | 35 | +1 energy next turn |
| Energy (immediate) | 40 | |
| Draw | 15 / 10 / 5 | 1st / 2nd / 3rd+ on one card |

Pure-status stacks per cost (%-statuses): 1e = 2–3 offensive or 4 defensive; 2e = 6/9; 3e = 10/12 (12 = the whole cap → redline).

## Daemons

Budget = **per-turn value × 4** (break-even by turn 4; skip in routs, profit turn 5+; targets Henry's 75–85% play rate — verify against balance_report.json average turn counts after implementation).

- harden (1e, Sharp/turn = 10 → 40): exactly on curve
- fertile_ground (2e, draw/turn = 15 → 60): buff
- feedback_loop (2e): nerf to ~7 power/draw
- echo_chamber / cinder_armor (2e): slightly under, archetype-dependent — fine
- battery_pack (4e, 40/turn → 160/190): fine (uncastable without ramp)
- fenrir_v1 (3e, doubles Strengthened): manual watch

## Exotics — verdicts

- heat_wave (2e): fair after Burn rework
- contagion (3e): slightly under — consider "double + 1"
- toxic_surge (1e): fair scaler (free tick doesn't decrement — known quirk)
- scavenge_data (1e tutor ≈ 25): → 0e or add a rider
- purify, aegis (1e): fair
- nightfall_edge / dawns_respite: SHIFT_STANCE ≈ 15 enabler; stance multipliers balanced later in an Equinox pass
- reprogram: → 2e, replay-anything kept; sims watch the 3e-replay combo

## Content pass shopping list

Rescale ~36 %-status appliers to the 2%/stack world (mostly 1→2–3 stacks). Buff: ignite, corrosive_bolt (→P4–5), cyclone (→40), tidal_wave (→65–70), fertile_ground, contagion, scavenge_data, entangle (redesign). Nerf/move: flash_freeze (→2e or self-downside), capacitor (E2 = 70 on a 40 budget), feedback_loop, reprogram (→2e). Heal cards re-numbered for the % world (natures_touch 15→40 etc.). Vanilla attacks to 40/90/150.

## Known engine facts recorded on the way

- Base energy is 2 (only ratatoskr/audhumbla have 3); 3e+ cards are ramp payoffs.
- Poison's `getScaledStacks` (attack × power scaling) is dead code — the STATUS pipeline never passes `power`. Delete or implement deliberately.
- powerscale.ts bugs to fix in the rewrite: `action.target: 'TARGET'` shadows `card.target: 'Side'` (all AOE scored single-target); BarkShield falls through to 2.0/stack (glacier_wall scores 27). Exotic action types must flag "manual review", not score 0.
- Pacing at the locked numbers: rout 2–3 turns, even 3–4, hard 7, boss 11–13 (targets: 3 and 10–12). Enemy HP is the pacing knob, not the curve.
