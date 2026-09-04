# The toolbox printings — ticket 69, ruled by Henry 2026-08-30 (reconciled with the tree)

Supersedes ticket 69's "direction, not printings" caveat. Two entries shipped before this document
landed (Legion, `86b7b8c`) — **their shipped numbers stand as the printings of record**; the knob
ranges below govern the measurement rounds. All cards element None (+~20% no-STAB pricing law),
descriptions print their numbers, <=2 copies, none create cards on any trigger (loop audit).

## Shipped already (do not re-print)

- **`riptide`** — 2e · Daemon · *"Daemon: whenever an enemy plays a card, deal 8 power to it."*
  Knobs: 5-10 power. (The wayfinder spec said 4 flat damage to the caster; the shipped 8-power
  form is the record. Real trigger rate vs Tidewrack 5-7/turn — price against that.)
- **`short_circuit`** — 2e · Daemon · *"Daemon: whenever an enemy draws a card outside its draw
  phase, deal 15 power to it."* Knobs: 10-20 power. Inverse of feedback_loop; ~2-4 triggers/turn
  vs Tidewrack.

## To implement (five cards)

1. **`reactive_plating`** — 2e · Daemon · Uncommon.
   *"Daemon: When an ally takes damage from an enemy attack, it gains 1 Sharp. Max 3 Sharp granted
   per turn."* Cap is TEAM-WIDE per turn (ruled). Trigger: onPostDamage + per-turn counter guard.
   Hand-priced (daemons score 0.0 in powerscale — say so in the report). Knob: cap 3->5.
2. **`discharge`** — 1e · Skill · Uncommon. **(Renamed from the spec's "Overheat" — the id
   `overheat` already exists as a 3e Fire attack; name collision found 2026-08-30.)**
   *"Remove up to 4 Strengthened from the target. Apply 1 Burn per 2 removed."*
   Engine: enemy-buff-removal action (generalize soothe's removal to enemy targeting). Burn cap 3
   self-limits. Knobs: removal cap 2-6; rate 2:1 -> 1:1.
3. **`scrubber`** — 2e · Daemon · Uncommon.
   *"Daemon: At the end of your turn, remove 1 Poison from each ally."* (Ruled: 1 per ally —
   half-rate vs ROOT ROT; the gym survives its counter.) Knob to 2 ONLY with Henry's word.
4. **`vent`** — 0e · Skill · Common. *"Remove 3 Poison from an ally."* Knobs: 2-4.
5. **`drip_feed`** — 2e · Daemon · Uncommon.
   *"Daemon: At the end of your turn, each poisoned ally gains 1 Regen."* (Ruled: Regen stacks,
   not a flat heal.)

## Acquisition

Neutral market slot draw list = hamstring + riptide + short_circuit + the five above + existing
neutral stock (adrenaline, squirrel_away, harden_daemon stay). Ticket 69's pin test covers every
id. Enemies never draw from this list.

## Standing context rulings (recorded here, landed on ticket 67 the same day)

- **The 60% target grades the GAUNTLET COMPOUND** (Henry, in the ticket-72 report exchange);
  ~84% per fight is a guide, not a gate; `bandVerdict` for the gauntlet grades `gauntletCompound()`
  — Legion's proposed verdict change is RATIFIED; historical per-fight FAILs are re-read, not
  re-run.
- No Tidewrack verdict is final until the five remaining cards exist and are purchasable, and the
  firmware-pairing harness fix (all-v1/all-v2 index bug) is in.

## Gates

`tsc -b`, vitest, build, lint 0; liveness.ts after hooks.json edits; loop audit on all daemons;
pin test updated; report real per-card trigger rates; max two knob rounds per the standing
template.
