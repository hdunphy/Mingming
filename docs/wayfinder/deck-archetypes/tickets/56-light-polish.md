# Light polish (deep pass #2): NOURISH power-unit fix + valkyrie_v2 trim

- Type: wayfinder:task
- Status: **open** — Henry-approved design (2026-08-12); this ticket IS the implementation
  brief. Implementing session flips to closed and appends its Resolution.
- Assignee: —
- Blocked by: ticket 55 landing (shares the balance baseline). Read HANDOFF's DEEP-PHASE
  POLICY first. Branch card-dev; author Henry Dunphy <hdunphy15@gmail.com>; line-ending law
  per HANDOFF; locks → _to_delete/git-locks/.

## Gates for this and all deep-phase tickets (Henry, final numbers)

**Field window 0.35–0.80 · deck ≥0.60 vs the frozen control** · dead ≤0.35 both sides ·
FTK 0 · mirror ≥60% decided ≤30 turns · §2.3 recorded, diagnostic-only.

## Part 1 — NOURISH_ROUTINE unit fix (audhumbla_v2, Henry-approved shape)

The current implementation converts a % of HP-healed; on an 86-HP frame the card-text power
converts 4.5× smaller than printed and two cards floor to zero (the ticket-53 findings).
Replace with PRINTED-POWER denomination: **"50% of the printed heal power of every heal
Audhumbla casts is dealt as Light damage to a random enemy"** — i.e. damage_power =
0.50 × heal action's power, floored to a minimum of 1 damage, converted through the normal
damage pipeline. sacred_spring (90 heal power) → 45 power strike (~13 HP); pale_mercy (14)
→ 7 power (~2). One dial, works at both ends. Update the OS description text accordingly.
Knob: 50% → 40 or 60 (5s).

## Part 2 — valkyrie_v2 trim (field ~94%, roster #1) — SEQUENCED, one change per sim

1. Round 1: REBIRTH_CYCLE_OS payoff **15 → 10** (both halves: damage and heal). Re-gate.
2. Round 2 (ONLY if still >0.80 field): remove `glimmer` from valkyrie_v2's list (deck to
   7). Re-gate. Anything further → STOP with findings.

## Part 3 — rarity marks (Henry's >0.7-over policy; values unchanged)

`dawn_of_creation` (10.9/10.5) → rarity stays Rare (verify); any rebuilt-deck card >0.7
over its band after these changes → set Rare and report. `benediction` (3.1/3.0) and
`falling_star` (3.6/3.0, post-knob) are ≤0.7 over: keep, note.

## Part 4 — gates, docs, commit

tsc / vitest / build; scoped BALANCE_ONLY=audhumbla and =valkyrie; gates above — audhumbla_v2
off 24% field and valkyrie_v2 inside 0.35–0.80 are the headline checks; then full
`npm run balance` (diff the whole matchup table per 8-DIFF). Flip this ticket closed with
Resolution (numbers, rounds); map line; HANDOFF queue refresh (item 2 done). ONE commit.
Deliverable: commit hash, all gate numbers vs bands, rounds used, deviations — or findings.
