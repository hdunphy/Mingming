# Macros + Drivers - vertical-slice design (Henry + designer, 2026-08-20 car session)

Names RULED: MACROS (3 slots, single-use, fired free on your turn) and DRIVERS
(party-wide passives, elite drops, weaker than an OS).

## RULED (Henry, 2026-08-20): both designer counter-proposals ACCEPTED - macros at FULL 1e-card value (rares 1.5x), Revive ships as a rare Macro, and power-dies-at-the-surface is formal UI law. Original framing below for the record.

## (resolved) disagreements as originally posed

1. **Macro pricing.** Henry's gut: ~2/3 of a 1e card. Designer pushback: scarcity+timing
   is the real price - weaker-than-a-card consumables go unused (the ash_communion 70%-
   dead lesson). Counter-proposal: FULL 1e-card value, rares to 1.5x; shrink later if
   playtest shows dominance. Start where the system is alive.
2. **Revive = a rare MACRO** (designer proposal): same slots, same in-a-pinch verb, no
   separate gauntlet item system. Hunt a Revive macro before the gym.

## Rulings embedded

- **Driver law: PROC-VISIBLE, not merely small.** Flat percents rejected as INVISIBLE
  (the 2%-status disease), not as too powerful; extra-energy rejected as genuinely OP
  (Energized x3). Every driver names a trigger moment the player watches.
- **Power stays internal, dies at the surface** (proposed UI ruling): with leveling
  removed, power->damage is deterministic; previews show true damage everywhere, power
  remains the pricing currency. Formalize alongside ticket 104's parity work.

## Vertical-slice MACROS (10)

Surge (damage ~30 power) - Mend (heal ~30 power) - Venom Shot (3 Poison) - Kindle
(2 Burn) - Rally (3 Strengthened) - Cripple (3 Weakened) - Salve (3 Regen) - RARES:
Free Exec (next card costs 0) - Echo (replay your last card) - Cache Pull (draw 2) -
Recharge (+1 energy) - [Revive, if merged per disagreement 2].

## Vertical-slice DRIVERS (8, all proc-visible; ALL go through the OS/daemon compounding
check - ticket-109 family - before shipping)

Henry's three: **Third Strike** (every 3rd party attack deals bonus damage) - **Static
Field** (small damage per card played; FLAGGED for zoo compounding) - **Antivenom**
(party Poison decays 1 extra/turn). Designer's five: **Overkill Recovery** (enemy faints
-> party heals) - **First Blood** (each member's first attack per turn +power) -
**Element Drivers** (one per element: that element's cards +power - the mono-team payoff,
ties into the team-building axes) - **Bulwark Reflex** (member drops below 50% -> gains
BarkShield, once per fight) - **Deep Cache** (first bonus draw each turn -> small effect).
