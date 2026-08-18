# Light polish (deep pass #2): NOURISH power-unit fix + valkyrie_v2 trim

- Type: wayfinder:task
- Status: **closed** — implemented 2026-08-13. Part 1 landed and is the headline. **Part 2
  round 1 was already in place before this ticket opened** (see Resolution §2), and
  valkyrie_v2 is still over the field ceiling after round 2 — STOPPED there with findings.
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

---

## Resolution

*Implemented 2026-08-13 on `d180f21`. Registry `1:53ea4a83` → **`1:66efb2d7`**. 773/773 tests,
`npx tsc -b`, `npx vite build`, full `npm run balance` clean. Redlines **47 → 47** (composition
changed — see §5). This run also re-baselines ticket 55's knob round 1, per that task's sequencing.*

### 1. Part 1 — NOURISH_ROUTINE, printed-power denomination. **The headline check passes.**

**`audhumbla_v2` field 24.3% → 40.0%, inside the 0.35–0.80 window**, and its control matchup
shortened from **23.6 to 14.1 turns**. It is off the bottom of the roster.

**It needed an engine change the ticket did not anticipate, and that change IS the diagnosis.**
`HealExecutor` resolves `calculateHeal` itself and emits an `HP` mutation with `isHeal: true`, so
**every card heal reaches the choke point as a `flatHeal` with its printed power already
discarded.** The number on the card was not available to any hook. That is the real reason the OS
could only ever be denominated in HP — not a design choice, a plumbing limit. Fixed by carrying
`healPower` through the mutation (`HealExecutor` → `applyMutations` → `handleHealEffect`), recorded
as `last_heal_power`, read by a new **`HEAL_POWER`** scaling. Added to both TS unions and **both**
zod enums (8c2).

The hook is now an **`ATTACK`** rather than a raw `HP` mutation, so it runs through the normal
damage pipeline as specified:
`{ type: ATTACK, target: RANDOM_ENEMY, element: Light, power: 0.5, scaling: HEAL_POWER }`.

**The min-1 floor needed no machinery — it is satisfied by the frames.** Measured over 10 battles:
**287 NOURISH procs, ZERO of them zero-damage, min 1 / median 2 / max 9.** No new schema surface
was added for a floor that never binds. *One correction to the ticket's arithmetic:* `sacred_spring`
(90 power → 45 power strike) was estimated at ~13 HP; on audhumbla's real frame (attack 29 vs a
39-defense control) it lands at **~9**. The shape is right, the constant is optimistic.

**A semantic that is now pinned:** an ENGINE heal (firmware `percentMaxHP`, Regen) has no printed
power and does **not** convert. The OS reads *"every heal she CASTS"*. Before this change the HP
denomination could not tell the two apart.

### 2. Part 2 — valkyrie_v2 trim. **Round 1 was already in place; round 2 was not enough.**

> **DEVIATION, reported not improvised: the ticket's round 1 is a no-op.** It specifies
> `REBIRTH_CYCLE_OS` payoff **15 → 10** — but that exact change was **ticket 53's knob round 1**
> and has been live since. The value was already 10 (description included) when this ticket opened.
> Nothing was changed for round 1, and no round was consumed by it.

With round 1's target state already live and the field at **89.3% (>0.80)**, round 2's stated
condition was objectively met, so it was applied: **`glimmer` removed, valkyrie_v2 to 7 cards.**

| | before | after round 2 |
|---|---|---|
| **field** | 89.3% | **84.7%** |
| vs control | 100% | **100%** |
| control-matchup turns | 4.4 | 4.6 |
| dead cards | 17.7% | 17.7% |

**Still over the 0.80 ceiling by 4.7 points. STOPPED per the ticket** — "anything further → STOP
with findings". No third change made.

**One thing did close on the way:** `os:valkyrie` §2.3 moved **0.170 → 0.380, inside the band, and
its redline is gone.** Trimming the deck narrowed the gap to v1 that ticket 53 could not close with
two knob rounds.

### 3. Gates

| gate | aud_v1 | **aud_v2** | valk_v1 | **valk_v2** | bar |
|---|---|---|---|---|---|
| **field** | 63.0% | **40.0%** | 50.0% | **84.7%** | 0.35–0.80 — **valk_v2 OVER** |
| **vs control** | 100% | **100%** | 100% | **100%** | ≥0.60 ✓ |
| control-matchup turns | 7.6 | 14.1 | 8.8 | 4.6 | |
| dead cards, subject | 8.9% | **1.7%** | 6.4% | 17.7% | ≤0.35 ✓ |
| dead cards, control | 6.2% | 6.2% | 12.0% | 12.0% | ≤0.35 ✓ |
| FTK | 0/200 | 0/200 | 0/200 | 0/200 | 0 ✓ |
| mirror | 400/400, 13.1t | | 400/400, 13.6t | | ≥60%, ≤30t ✓ |
| §2.3 | **1.000** | | **0.380** *(redline closed)* | | diagnostic only |
| liveness (hooks.json edited) | zero static findings, **32/32 LIVE** | | | | ✓ |

**`os:audhumbla` stays at 1.000** — v1 beats v2 100/100 head-to-head even though v2 gained 16 field
points. That is the hard-counter shape the deep-phase policy explicitly permits; **recorded, not
tuned.**

### 4. Part 3 — rarity marks. No card qualifies.

`dawn_of_creation` **verified still `Rare`** (10.9 / 10.5, +0.4). Nothing in either rebuilt deck is
more than 0.7 over band, so **no rarity changed**:

| card | deck | score / band | over |
|---|---|---|---|
| `dawn_of_creation` | audhumbla_v1 | 10.9 / 10.5 | +0.4 — keep, already Rare |
| `benediction` | valkyrie_v1 | 3.1 / 3.0 | +0.1 — keep, noted |
| `falling_star` | valkyrie_v2 | 3.6 / 3.0 | +0.6 — keep, noted |

audhumbla_v2 has **no** over-band card.

### 5. Blast radius (§9, 8-DIFF over the whole table)

Redlines **47 → 47**, card redlines unchanged (0 closed, 0 added), cards 213. **The count is flat
but the composition moved:** `os:valkyrie` **closed**, `os:jormungandr` **re-opened at 0.44** — the
latter is the intended consequence of ticket 55's knob round 1 deliberately weakening v2, and §2.3
is diagnostic-only.

| row moved beyond noise | before → after |
|---|---|
| `gauntlet:control-vs-audhumbla:audhumbla_v2` | **23.6 → 14.1 turns** (win 0.000 both) |
| `os:audhumbla` | 11.0 → 15.1 turns (1.000 both) |
| `os:jormungandr` | 0.630 → **0.940** *(ticket 55 knob, re-baselined here)* |
| `os:valkyrie` | 0.170 → **0.380** *(redline closed)* |

Four rows, all attributable. Nothing else in the roster moved.

### 6. Left open

1. **`valkyrie_v2` at 84.7% field** — 4.7 over, both authorised rounds exhausted (one of them a
   no-op). Roster #1 by field. Needs a design call.
2. **`os:audhumbla` 1.000** — hard counter, permitted, but it is the widest §2.3 on the roster.
3. **`os:jormungandr` 0.44** re-opened by design.
4. The ticket's **round-1 assumption was stale by one knob**; worth checking live values against a
   ticket's stated "from" numbers before sequencing rounds.
