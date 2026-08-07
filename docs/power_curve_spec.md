# Mingming Power Curve Spec (rev 3 — corrected after code review, 2026-08-05)

Everything below was decided in the grilling sessions on Aug 4–5, then checked against the real
engine code and card registry on Aug 5 — two numbers didn't survive contact with the data (3e
budget, heal/shield price) and got corrected below. Nothing is implemented yet as of this revision;
implementation follows immediately after.

## The unit

All costs are in **power**. Conversions (level-proof by design):

- 1 energy = 40 power
- 1% of target maxHP as damage = 3 power
- 1% of maxHP as healing or shield = 4 power (rev 2 had this at 2 power — cheaper than damage per
  %HP, which was backwards: a fixed power budget should buy *less* %HP from healing than from
  damage, since healing doesn't advance the win condition the way damage does. Corrected so heal is
  now the more expensive of the two per %.)

## Engine changes required

1. **calculateDamage** — remove the flat `+2`, change divisor `/50` → `/35` (keeps a 1e-40 dealing the same ~7–10 damage at L10, so pacing is preserved). **Superseded by rev 3.1 — the divisor is now `/45`; see the amendment at the end of this file.** Damage floor stays at **0** (the existing `Math.max(0, damage)`): attacks *can* deal nothing — a tanky Mingming with Sharp stacks shrugging off hits is a feature, not a bug. *Why the +2 goes: it was paid per hit, making small/multi hits secretly stronger, and its value shrank with level — card economics drifted as units leveled.*
2. **calculateHeal** — replace with `maxHp × power / 400` (1 power heals 0.25% maxHP, matching the corrected 4-power-per-1% price above). Drop attack scaling and the flat +2. *Why: healing was ~18× damage per power point (natures_touch healed 47 HP at L10 for 1 energy).* LightStance ×1.5 stays on top.
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
| 3e | 140 |
| 4e | 190 |

Rule: **50 × energy − 10** (rev 2 had 3e at 150, which the rule itself doesn't produce — 50×3−10=140.
Every other point already matched the rule; 150 was the typo, not the rule). With the +2 gone, this
is a super-linear premium that grows with cost — a 2e card is worth +12.5% over two 1e cards, a 3e
card +16.7% over three 1e cards, a 4e card +18.75% over four 1e cards — identical at every level.

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
| Shield | 4 per 1% maxHP | 1e shield card = 10% maxHP |
| Energized | 35 | +1 energy next turn |
| Energy (immediate) | 40 | |
| Draw | 15 / 10 / 5 | 1st / 2nd / 3rd+ on one card |

Pure-status stacks per cost (%-statuses): 1e = 2–3 offensive or 4 defensive; 2e = 6/9; 3e = 10/12 (12 = the whole cap → redline).

**Cap mechanism, decided:** the 25% cap clamps the *damage multiplier*, not the raw stack count —
`pct = min(0.25, stacks × 0.02)`. Stacks themselves are stored and keep accumulating without limit,
so cards that read stack count directly (fenrir_v1's Strengthened-doubler, anything with a
`STATUS_COUNT` scaling) still have something real to scale off of past the point where the damage
effect itself has capped out. Capping the raw stack count instead was rejected: 25%/2% = 12.5,
which doesn't even land on a whole stack, and it would flatten those stack-reading synergies right
when they'd otherwise start to matter.

Confirms the "offense costs more than defense" split (15 vs 10) stays as designed. Note for the
record: since both streams share the same 2%/stack rate and the same 25% cap, defense-stream stacks
(Weakened/Sharp) still reach that cap for less energy than offense-stream (Strengthened/Dazed) — about
3.1e worth of power fully caps a defense stat vs. 4.7e for offense. That's fine: the cap is what
prevents the old mirror-deadlock regardless of price, so the price differential is purely a
deck-building-economy choice, not a safety mechanism.

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
- powerscale.ts bugs, confirmed against real card data, fixed in the rewrite: `action.target: 'TARGET'` (meaning "aimed at the opposing side") shadows `card.target: 'Side'/'All'` (meaning how much of that side) — every AOE card (`cyclone`, `tidal_wave_v2`, `entangle`, `heat_wave`) was scored as single-target. Fix separates the two axes: `action.target === 'SELF'` still means self (glass_cannon's recoil sub-action correctly flips negative), anything else defers to `card.target` for the count multiplier. Separately, `MULTIPLY_STATUS`/`CLEANSE`/`SEARCH`/`PLAY_LAST_CARD`/`TRIGGER_STATUS` all fall through the action-type branch scoring **0** today — that's `contagion`, `purify`, `scavenge_data`, `reprogram`, half of `toxic_surge`. `SHIFT_STANCE` and `MULTIPLY_STATUS` get real heuristic scores in the rewrite (using this doc's own ≈15-power stance value and a doubled-stack-count estimate, respectively); `CLEANSE`/`SEARCH`/`PLAY_LAST_CARD`/`TRIGGER_STATUS` get an explicit `manualReview` flag instead of a silent 0, since pricing them generically isn't honest (their value depends on board state a static formula can't see) — matches why `purify`/`aegis`/`scavenge_data`'s verdicts above were already hand-judged rather than formula-derived.
- Pacing at the locked numbers: rout 2–3 turns, even 3–4, hard 7, boss 11–13 (targets: 3 and 10–12). Enemy HP is the pacing knob, not the curve.

## rev 3.1 — pace amendment (ticket 23, 2026-08-06)

**`calculateDamage` divisor `/35` → `/45`.** One constant. No card price changes.

rev 3 chose `/35` to *preserve* the pace the old `/50 + 2` formula produced. Preserving it
was the mistake: at that pace a single full turn removed **60–70% of a health pool**, so
even matchups resolved in **3–4.5 turns**. That is not enough turns for a game to happen in.
Anything that wins by building — poison attrition, momentum stacking, a discard windmill —
was dead on arrival, because the game ended before its second payoff ever landed. The deck
passes kept discovering this one archetype at a time.

A/B simulation across the registry showed slowing damage ~22–30% moves even matchups to
**~5.5–6.5 turns** while element- and level-advantage routs still close in **~3**, and FTK
stays at 0 — a first-turn kill now needs a perfect setup rather than an ordinary curve-out.
`/45` is that ~22% slowdown.

**Card budgets and prices are unchanged, and that is not an oversight.** A global divisor
scales every card by the same factor, so it moves *absolute* pace only; the rev-3 budget
bands, the 1e = 40 power unit, and every relative card economics decision survive it intact.
The one thing a longer game does change is the *value* of slow-build archetypes relative to
burst ones — which is the entire point of the amendment, and shows up as jormungandr's §2.3
swinging toward its attrition variant.

## rev 3.2 — curve re-price (ticket 24, 2026-08-07)

**Damage curve `50E−10` → `10 / 35 / 75 / 120`.** Budget bands move with it:
`BUDGET_BANDS` 1.0 / 4.0 / 9.0 / 14.0 → **1.0 / 3.5 / 7.5 / 12.0**.

rev 3.1 slowed the game by dividing damage globally. This does the other half: the curve
itself was calibrated to ~3-turn games. Measured at the balance frame, damage ≈ 0.30 ×
power and a health pool ≈ 79 HP ≈ 263 power, so a deck spending both its Energy on 1e
damage removed 80 power ≈ 31% of a pool per turn. Sleipnir landed exactly there (28.6%,
3.17 turns). 10/35/75/120 measures at **5.3 turns average across the tuned species, minimum
3.7, FTK 0** — the 5–6 target with a 3–4 floor.

**The power UNIT is unchanged and the per-status prices are deliberately NOT rescaled.**
A point of power still buys the same fraction of a health pool: cards carry less power, so
they deal proportionally less damage, and the "1% maxHP = 3 power" conversion still holds.
Only the *budget* per Energy moved. Rescaling the status prices as well would have
double-counted the change.

### Two findings from the A/B, both worth keeping

**1. An exponential curve is incompatible with a turn-count floor.** `5+10E²`
(5/15/45/95) and `5+10E^1.5` (5/15/33/57) were both measured. Every v1 deck in the
registry lost **0/100**, and mirrors ran 10–19 turns. The shape cuts 1e by 62% while
cutting 3e by only 32%, so cheap decks collapse and expensive decks win everything — the
*ramp* deck becomes the fastest deck, which is backwards from a minimum turn count. This is
structural to the shape, not the constants; do not revisit without changing the Energy
ceiling.

**2. A global curve change under ~20% is invisible to status cards.** Status is quantised
in whole stacks: at a 0.875 ratio, `corrosive_bolt`'s 4 Poison stacks round straight back
to 4. Across the whole registry only **5 status stacks** changed. Attack cards take the
full cut, status cards take none, so any small curve cut systematically favours status
decks — jormungandr's §2.3 fell 0.33 → 0.04 on the re-price alone, and the smallest
available stack step (4→3, a 25% cut against the curve's 12.5%) only recovered it to 0.11.
Status decks must be re-gated by hand after any curve move, and buffing the attack side is
usually the finer instrument.
