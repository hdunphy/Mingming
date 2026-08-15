# Skoll's deck pass — the wolf eats, the wolf hoards, and one gate did not close

- Type: wayfinder:research — implementation record for **ticket 64**. Shipped, with **one gate
  failing and both authorized knob rounds spent** (§5). Report-only sections are marked.
- Baseline: ticket 62's ship (`7a39275`, DET-C4-D14). Registry `1:8b7b0ae9` → **`1:998a835e`**.
- Instrument: field row vs all 15 other species, both turn orders, **30 iterations (900 decided
  games) on two independent seed bases** per the seed-base law.

---

## 1. The answer, in one row

**Both decks come off the floor and land mid-window. Both had been below it since ticket 13.**

| | before | after (base A / base B) | band |
|---|---|---|---|
| **skoll_v1 field** | 36.9% | **45.6% / 46.1%** | 0.35–0.80 ✅ |
| **skoll_v2 field** | 27.2% | **51.0% / 50.1%** | 0.35–0.80 ✅ |
| skoll_v1 control | — | **100% / 100%** | ≥0.60 ✅ |
| skoll_v2 control | 39.0% | **85.0% / 83.3%** | ≥0.60 ✅ |
| FTK | 0 | **0** everywhere | 0 ✅ |
| skoll_v1 dead | — | 30.2% / 30.6% | ≤0.35 ✅ |
| **skoll_v2 dead** | — | **36.9% / 38.2%** | ≤0.35 ❌ |
| mirror decided ≤30t | — | v1 100%, v2 93–97% | ≥60% ✅ |

**The one failure is skoll_v2's dead-card ratio, over by ~2.5 points on both seed bases.** §5 is
the finding; it is a curve problem no authorized knob reaches.

---

## 2. What shipped

**Part 1 — SOLAR_FLARE_OS retired, SOLAR_OVERDRIVE_OS in its place.**
*"Skoll's attacks deal +15% damage per stack of Strength she holds (max 5 stacks)."*

It lives in `CustomFirmware.ts`, not `hooks.json`, and the reason is the cap. The mechanism is
`core_overclock_daemon`'s exactly — an `onDamageCalculated` multiplier scaled by
`STRENGTH_STACKS` — and that part *is* expressible as data. **`HookFactory.resolveScaling` hard-caps
`STRENGTH_STACKS` at 8**, and this OS is specified at 5. A data hook would have read **+120% at
eight stacks where the design says +75% at five**, which is not cosmetic on a deck built to hoard
— `strength_burst` alone grants 5. Expressing it as data meant a new `scalingCap` field on the
hook schema, which per `8c2` means zod **and** the TS unions in two places each, for one
consumer. Hand-written firmware is the precedent for exactly this (hel_v2, ymir_v2).

**Pool watch-item, recorded not fixed** as the ticket directed: this OS and
`core_overclock_daemon` **COMPOUND** (`8-COMPOUND`). The daemon leaves skoll's deck but stays in
the registry, so a player build holding both gets `1.15ⁿ × 1.2ⁿ`.

**Part 2 — `sun_devourer`** (2e Fire Attack Rare): consume ALL the caster's Strengthened, deal
15 power per stack consumed. This needed one engine addition: **`STATUS_CONSUMED` did not exist
on ATTACK.** It was implemented for HEAL (`ash_communion`) and STATUS (`hexbloom`) only. Added
**power-side, not post-damage**, per the ticket-26 lesson — so it rides the divisor, STAB and
resistances rather than bypassing them, and zero stacks consumed means zero damage, making it a
payoff card and never an opener.

**Part 3 — both deck lists**, replacing the ticket-13 legacy shared lists. `adrenaline` (57.8%
dead) and `core_overclock_daemon` (42.5% dead) leave; both stay in the registry.

---

## 3. `sun_devourer` — static vs measured, the number the ticket asked for

Measured over 300 real games, 239 casts:

| | value |
|---|---|
| casts per game | 0.80 |
| **Strength consumed per cast** | **mean 7.91**, median 8, max 19 |
| **damage per cast** | **mean 32.67**, median 33, max 62 |
| casts that found zero stacks | **2 of 239** |

**The scorer reads it at 3.2 against a 6.5 budget; the card actually finds 7.91 stacks.** The
ticket flagged an under-read against TREACHERY's measured feed of 4.8 — the real figure is
**7.91, a 2.6× under-read**, because v1's whole list feeds the pile (`fury_strike` ×2,
`battle_rhythm`, `brute_force`) on top of TREACHERY's on-hit grants.

In delivered terms it is honest: **32.67 damage a cast against `fire_punch_v2`'s 10.5–13.5
vanilla benchmark** — roughly 2.5–3× a vanilla 1e card, at 2e. Per the ticket, its §1.3 row was
not chased in either direction; the sim gate decided it.

**Only 2 casts of 239 whiffed on an empty pile**, so the payoff-not-opener shape is working
rather than being dead weight.

---

## 4. Knob rounds — one worked, one backfired

**Round 1 (v2): `strength_burst` ×2 → ×1 + `fury_strike`.** The 2-copy list read **40.5% dead**;
four 2-cost cards on a 2-Energy frame in a 3.5-turn game is a curve problem and the second copy
is the one that rots.

| | field | control | dead | turns |
|---|---|---|---|---|
| as authored | 43.9% | 81.7% | **40.5%** | 3.48 |
| **after round 1** | **51.0%** | **85.0%** | **36.9%** | 3.50 |

**Round 2 (v2): OS 15% → 10%. It failed in both directions and was reverted.**

| | field | control | dead | turns |
|---|---|---|---|---|
| round 1 (15%) | 51.0% | 85.0% | 36.9% | 3.50 |
| **round 2 (10%)** | **38.3%** | **65.0%** | **37.6%** | 3.63 |

The hypothesis was that a weaker OS lengthens games and lets more cards be played. **Games barely
moved (3.50 → 3.63 turns) and the dead rate went UP.** It cost 12.7 field points and 20 control
points to learn that. Reverted to 15%, and the reason is recorded in the constant's comment so
nobody re-runs it.

---

## 5. The finding: skoll_v2's dead-card gate cannot be closed with an authorized knob

**36.9% and 38.2% on two seed bases against a 0.35 gate.** Not noise, not fixable from here.

The mechanism is the curve, not the power. v2 holds **three 2-cost cards** (`strength_burst`,
`overdrive` ×2) on a **2-Energy frame** in a **3.5-turn game**. She draws 3 a turn and can spend
2; a 2-cost card is her whole turn, and the deck offers three of them plus a 1-cost
(`glass_cannon`) competing for the same energy. Round 1 removed one such card and moved the
number 3.6 points. There is one more to remove and no authorized knob that removes it.

Both remaining authorized knobs are **power** dials (OS %, OS cap) and round 2 demonstrated that
power dials do not move this number — they change how hard she hits, not how many cards she can
afford to play.

**The fix is one card swap, and it is a design call:** drop an `overdrive` copy for a 1e or 0e
Fire attack. Predicted effect by analogy with round 1: dead ≈ 33–34%, field down ~3–5 points to
the mid-40s, still comfortably in band.

I have not made that change. Both authorized rounds are spent and the ticket says anything else
stops.

---

## 6. First-mover re-read (the diagnostic flag)

Ticket 58 flagged skoll at **+24.5%**, over the |20%| diagnostic threshold.

| deck | base A | base B |
|---|---|---|
| skoll_v1 | +18.3% | +3.3% |
| skoll_v2 | −7.1% | −12.1% |

**The flag clears on every reading.** Note the 15-point spread between v1's two bases — the
self-mirror first-mover figure is a noisy instrument at 30 iterations, and no single reading of
it should be treated as a number.

---

## 7. Gates and the 8-DIFF

`liveness.ts` after the `hooks.json` edit: **zero static findings; skoll_v2 LIVE** (2,267
observable effects). `tsc -b` clean · **820 passed / 61 files** (suite re-run after the last
content edit) · `vite build` clean.

**8-DIFF: 7 rows of 67 moved; 60 bit-identical.**

| row | before | after | Δ |
|---|---|---|---|
| `os:skoll` | 54.0% | 20.0% | −34.0 |
| `gauntlet:control-vs-skoll:skoll_v2` | 48.0% | **18.2%** | −29.8 |
| `gauntlet:control-vs-skoll:skoll_v1` | 20.0% | **0.0%** | −20.0 |
| `gauntlet:control-overall:slot2` | 5.1% | 3.2% | −1.9 |
| `mirror:skoll` | 50.7% | 49.0% | −1.7 |
| `gauntlet:control-overall` / `:slot1` | — | — | −1.6 / −1.2 |

**fenrir, hraesvelgr and draugr did not move by any amount** — the ticket's requirement, and the
check that the Burn work and this pass are independent. The three `control-overall` rows are
aggregates over skoll's matchups, not the control moving.

New §2.3 redline: **`os:skoll` at 0.30** (v2 beats v1 80%). Diagnostic-only under deep-phase
policy. Redlines 48 → 49; §1.3 unchanged at 38 — `sun_devourer` scores 3.2 against 6.5 and adds
no row.

---

## 8. Questions for Henry

1. **The dead-card gate (§5).** Drop an `overdrive` copy for a 1e/0e Fire attack? That is the
   one change that reaches it, and it is outside the authorized knob list.
2. **`sun_devourer` reads 3.2 and delivers 32.67 damage a cast** (§3). Ticket 66's repricing
   pre-seeds `Strengthened: 5` for exactly this — but the measurement says **7.91**. Worth
   revising that constant before 66 ships?
3. **`os:skoll` 0.30 with v2 at 80%** — texture, or does v1 want a look? Both decks are in
   window and both beat the control, so the ratatoskr precedent applies.
4. **The OS/daemon compound** (§2) is now live in the pool. Do firmware and daemons stack by
   design?
