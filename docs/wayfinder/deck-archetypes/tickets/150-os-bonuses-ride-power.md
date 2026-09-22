# Ticket 150 — Two OS bonuses ride the power, not the HP; and hel_v2's dead hook goes

> **2026-09-22 — 150a and 150b SHIPPED. 150c MEASURED, NOT SHIPPED: §3's `bonus: 3` fails its
> own ±5 gate by −10.7 field points; `bonus: 4` passes at +1.8, and §2's own table already
> gives 3.9 for the un-STAB'd case. One word from Henry.** Numbers in
> `../../../../results/t150c/FINDINGS.md` and §6 below. 150d/150e not started — 150d is
> gullinbursti, a post-EA mingming (HANDOFF, EA SCOPE).

**Type:** engine + data. **Status:** RULED by Henry 2026-09-09 off the ticket-149 firmware census
(`research/firmware-power-census.md`): *"Toxin_fang and Kinetic_RAM should be fixed. Change
toxin_fang to use power … Kinetic_ram should also be +2.5 power per stack, that's what the
description says"*; *"[lifeblood] — delete it if that's the case."*
**Branch:** current working branch, one commit per lettered row, authored as Henry.
**Relates to:** 55 (TOXIN_FANG), 52 (KINETIC_RAM), 57 (hel_v2 rework), 131c (the ×10 that turned
1 HP into 10 HP), 26 (the law: *a bonus that rides the power is the only kind `powerscale` can
price, and the only kind that behaves the same at every level*).

---

## 1. The finding

`TOXIN_FANG_OS` (`jorm_v2_toxin_fang`) and `KINETIC_RAM_OS` (`gullin_v2_ram`) are the only two
payoffs in the registry that add **flat HP after the damage divisor** — `onDamageCalculated` with
`bonus: 10` / `bonus: 2.5` and a stack scaling (`HookFactory.ts` L63: `newDamage += bonus ×
scaleFactor`). Every other number in the game is power, which goes in before `attack/defense`, the
`/45` pace divisor, STAB and type effectiveness (`combatUtils.ts` `calculateDamage` step 1, where
the duality statuses already ride the power). Consequences the census measured:

- **TOXIN_FANG delivers ×3.93 on the attack it rides** — +94 HP on a 32 HP hit at the measured 9.4
  Poison stacks, 40% of a health pool a game. Before 131c it was `bonus: 1` on a 112-HP frame; 131c
  multiplied it to 10 with the number scale, so the *relative* size is unchanged since ticket 55 —
  but it is a size the pace dial and the frame cannot move, and `powerscale` cannot see.
- **KINETIC_RAM's description says "+2.5 power per stack"; the hook adds 2.5 HP per stack**, which
  at 13 Sharp is +33 HP on a 21 HP hit (×2.53), 23 procs and 63% of a pool a game. Description and
  data disagree — this is exactly ticket 138's class of defect.
- **`hel_v2_lifeblood`** (`hooks.json` L1117–1124) is an `onHealCalculated` hook with
  `multiplier: 1.0` — a no-op left over from before ticket 57 rebuilt hel_v2 as UNDERWORLD_GATEWAY
  (which lives in `CustomFirmware.ts` and works: the census measured the toll at exactly 5% per
  Energy). Nothing references the hook id outside `hooks.json` and four scratch scripts.

## 2. The conversion (so the fix is not a stealth buff or nerf)

Measured per-stack delivered value, converted at the census benchmark (`baseline_strike`: 30 power
= 5.82% of a target's pool with no STAB → 1 power ≈ 0.19%; with STAB ≈ 0.25%):

| OS | today (flat HP, post-divisor) | delivered per stack | equivalent power per stack |
|---|---|---|---|
| TOXIN_FANG | +10 HP | 0.75% of frame | **~3 power** (2.9 STAB'd, 3.9 not) |
| KINETIC_RAM | +2.5 HP | 0.21% of frame | **~1 power** (0.8 STAB'd, 1.1 not) |

So **TOXIN_FANG at +3 power per stack is the same OS it is today**, just honest. **KINETIC_RAM as
printed (+2.5 power) is ~2.5× what it delivers today**; +1 power per stack is what ships now.
gullinbursti_v2 sits at ~40 on the roster (136 round one took her 27 → 40), so the buff may be
welcome — but it is a buff, and it gets an arm, not an assumption.

## 3. Rows

- **150a — delete `hel_v2_lifeblood`.** `hooks.json` hel_v2 → `"hooks": []` (control_v1 is the
  precedent for an empty array). Drop the id from `scratch/offenders.ts`, `shape.ts`, `cells.ts`,
  `t149_oscensus_report.ts` if they enumerate it. Tests green; the hookWiring tests for the two
  UNDERWORLD hooks are untouched. No balance change (the hook did nothing).
- **150b — an `onPowerCalculated` modifier trigger.** `HookFactory.createHook` accepts it alongside
  `onDamageCalculated` (same `multiplier`/`bonus`/`scaling` shape); `Hooks.ts` gets
  `applyPowerModifiers(power, context)` mirroring `applyDamageModifiers`; `calculateDamage` calls it
  on `power` *before* `statusPower` is added and `effectivePower` is floored at zero (step 1), once
  per hit like today. `HookContext` carries `target` so `TARGET_POISON_STACKS` keeps resolving.
  Unit test: a hook with `bonus: 3, scaling: TARGET_POISON_STACKS` on a 30-power attack against 4
  Poison deals exactly what a 42-power attack deals.
- **150c — TOXIN_FANG → power.** `jorm_v2_toxin_fang`: `trigger: onPowerCalculated, bonus: 3`;
  description *"his attacks deal +3 power per Poison stack on the target"*. `descriptionData.test`
  updated. **Gate:** jormungandr_v2 1v1 field (currently ~62) within ±5 of baseline over the
  standard 30-opponent run; the census probe re-run shows the OS still delivering ~40% of a pool a
  game. If it lands outside ±5, report — do not tune.
- **150d — KINETIC_RAM → power, two arms.** `gullin_v2_ram`: `trigger: onPowerCalculated`, arm A
  `bonus: 1` (equivalence), arm B `bonus: 2.5` (as printed). Field both on gullinbursti_v2 1v1 (30
  opponents × 40) and on the ticket-140 panel with her in `zoo`'s slot. **Henry picks** the arm from
  the numbers; the description then says whichever number ships (*"+1 power"* or *"+2.5 power"*).
  Arm A is the default if he does not rule.
- **150e — the law, written down.** `HookFactory.ts` comment on `bonus`: flat post-divisor HP is
  reserved for recoil/toll prices (ticket 26 §"recoil is a price"); a *payoff* bonus uses
  `onPowerCalculated`. `descriptionData.test` gains an assertion that no `onDamageCalculated` hook
  with a `bonus` has a description containing "power".

Tests: `npx vitest run`, `npx tsc -b`, `npm run balance` §2–3 byte-identical through 150a–b;
§1.3 unchanged (the scorer does not price OS hooks). Fields in the write-back.

## 4. Not in this ticket

Pricing OS hooks in `powerscale` (that is ticket 149's hook formula). GOSSIP_NODE's 54 procs a
game (a design question for the 149 session). The other modifier OSes (SOLAR_OVERDRIVE ×2.0,
GLACIAL_PACE ×1.25, TIDAL_CRUSH ×1.3, GRAVE_CHILL ×0.8) are multipliers, which already scale with
everything — they are fine as they are.

## 6. Write-back (2026-09-22)

### 150a — shipped

`hel_v2_lifeblood` deleted: an `onHealCalculated` hook with `multiplier: 1.0` that multiplied
healing by one, measured by 149b at 0 procs across 8.30 offers. `hooks.json` hel_v2 → `"hooks":
[]`, control_v1's precedent. No balance change.

The three scratch scripts that drove it through a `heal` knob were already null-safe, so with the
hook gone the knob would have parsed and silently done nothing — worse than absent. Replaced by a
comment. `powerscale`'s two 149c-7 entries and its `instrumentBlind` special case went with it.

Visible effect, and it is an improvement: §1.4 read *"hel_v2 0.0%, UNDER BAND"* — the report
asserting that UNDERWORLD_GATEWAY delivers nothing — and now reads UNMEASURED / code-driven, which
is true. The gateway is in `CustomFirmware`, where a hook-walking scorer cannot see it.

### 150b — shipped

`onPowerCalculated`, the power-side twin of `onDamageCalculated`. Fires at step 1 of
`calculateDamage`, on the raw power, beside `statusPower` — where the duality statuses have ridden
since ticket 95 for the same reason.

`applyPowerModifiers` copies `applyDamageModifiers`' hook collection, dedupe-by-id and priority
sort, and deliberately does NOT copy its closing status scan (that scan is the PERCENT shape's job;
under the POWER shape those four are already inside `statusPower`, and repeating it would pay them
twice). It also does not floor at zero — `calculateDamage` floors `power + statusPower`, and
flooring twice would quietly make the hook unable to subtract.

§3's test is there, asserted against a second call to `calculateDamage` rather than a literal, plus
the half it did not ask for: the hooked attack must also be MORE than an unhooked 30-power one, or
a hook that did nothing would pass whenever 30 and 42 floored to the same damage.

**No shipped hook uses the trigger yet**, so §2–3 of the balance report cannot move.

### 150c — measured, not shipped

1,200 games per arm, all 30 opponents, beamless. Baseline measured in the same harness rather than
taken from §3's "~62", which is ticket 143's 3v3 grid number and not comparable.

| `jorm_v2_toxin_fang` | field | vs baseline |
|---|---|---|
| **shipped** (`onDamageCalculated`, `bonus: 10` flat HP) | **53.2%** | — |
| §3's arm: `onPowerCalculated`, `bonus: 3` | 42.5% | **−10.7** |
| `bonus: 4` | **55.0%** | **+1.8** |
| `bonus: 5` | 66.6% | +13.4 |
| `bonus: 6` | 74.9% | +21.7 |

§3's gate is ±5. **+3 fails it by more than twice over.**

**§2 already contained the answer.** Its conversion row reads *"~3 power (2.9 STAB'd, 3.9 not)"*
and the sentence under it takes the STAB'd end. TOXIN_FANG fires on every attack Jörmungandr makes
against the whole 30-opponent field, and most of those are not type-advantaged — so **3.9** is the
figure that describes what the OS does over a field run. Rounded: 4, which is what the field
measures at +1.8.

**The dial is sharp.** One point of `bonus` is worth roughly eleven field points. There is no
comfortable middle: +3 is a serious nerf, +5 a serious buff, and the only value that leaves the OS
where it is happens to be an integer. That steepness is itself an argument for the move — at
`bonus: 10` flat HP the same sharpness exists but sits AFTER the pace divisor, the attack/defense
ratio and type effectiveness, where none of the game's dials can reach it.

Per §3 (*"If it lands outside ±5, report — do not tune"*) nothing was committed; `hooks.json` is
byte-identical to the 150a state. **`bonus: 4` or `bonus: 3` — one word.**

Shipping with either: `powerscale`'s firmware scorer (149c-7) prices a `bonus` hook as flat HP, and
once TOXIN_FANG's bonus is power that conversion has to read the trigger rather than assume the
unit. Not a design decision, but it is not free either.

### 150d / 150e — not started

150d is KINETIC_RAM on gullinbursti_v2, an **Earth** mingming. Henry's 2026-09-22 scope ruling puts
Earth outside the EA cut (HANDOFF, "EA SCOPE"), so it waits. 150e's law-comment and
`descriptionData` assertion belong with whichever of 150c/150d lands first.
