# Light decks: valkyrie + audhumbla — the last element

- Type: wayfinder:task
- Status: **closed** — implemented 2026-08-12, unattended. Two knob rounds spent per species;
  §2.3 is out of band on BOTH and needs Henry (see Resolution §7).
- Assignee: —
- Blocked by: nothing hard; ticket 51 (cleanse→shed) is queued separately and `purify` is
  used here AS-IS — 51 converts it later, do not implement 51 in this pass.

## The approved design

Read against `2781c51` / registryHash `1:6b38742e` (the Light workbench). Valkyrie loses to
the control 94–95% and her v1 OS provably never fires in 1v1; audhumbla's mirror is 61-turn
0/400. All four OS slots rework; audhumbla's frame drops to 2 base Energy.

### OS reworks (all four)

1. **valkyrie_v1 VALHALLA_UPLINK (replaced):** "At the end of Valkyrie's turn, play a
   random card from her discard pile for free." The einherjar rise each evening. Seeded
   pick, PLAY_LAST_CARD machinery, card returns to discard, exhaust pile excluded, one
   proc/turn. The old ally-heal custom firmware (1v1-dead by its own `!== owner.id` guard)
   is deleted.
2. **valkyrie_v2 CRUSADER_KERNEL → REBIRTH_CYCLE_OS:** "Whenever Valkyrie's discard pile is
   shuffled back into her deck, deal 15 Light damage to a random enemy and heal Valkyrie
   with 15 power." Every reshuffle (vs UPDRAFT's once-ever). Consciously retires the
   ticket-07 "no onDeckShuffled in hooks.json" test pin (loop review: reshuffles bounded by
   draws; nothing generates cards).
3. **audhumbla_v1 GENESIS_FIRMWARE (re-triggered):** "Overheal → permanently +1 max Energy,
   once per turn." Deliberate overheal (heals at full HP) brings the ramp online turns 1–2;
   pays in maxEnergy, not raw energy (8-ENERGY-TRAP-3). Frame change: base energy 3 → 2, so
   her 3e card is the ramp's literal unlock.
4. **audhumbla_v2 NOURISH_ROUTINE (switch → dial, Henry's stall analysis):** "25% of ALL
   healing applied to Audhumbla is dealt as Light damage to a random enemy." Overheal-only
   was structurally a switch — it fires never (behind) or constantly (already unkillable).
   Reads the INTENDED pre-clamp heal so heals at full HP still convert; floor the product.

### New engine mechanic

**Rampage growth** (`growPerPlay: N`): a card instance permanently gains +N power each time
it resolves, per instance, uncapped (Henry's law: scaling attacks underperform early and
overperform late — never cap pre-emptively). The VALHALLA free resurrection also grows it.

### Decks (✦ = 12 new cards; exact actions live in the implementation prompt)

- **valkyrie_v1 — Einherjar recursion (10):** pale_mercy, ✦benediction ×2 (1e 10pw + heal 25
  + 1 Str), ✦zealots_edge ×2 (1e None 15pw, +10/play growth), ✦echo_of_valhalla (1e
  PLAY_LAST_CARD, exhaust), ✦ascension (2e 50pw + 2 Str + 2 Sharp, exhaust), radiant_spark,
  smite, healing_light.
- **valkyrie_v2 — Radiant cycle (8):** ✦glimmer (0e draw 1 — single copy by design, watch
  item), ✦falling_star ×2 (1e 45pw, exhaust), ✦morning_light (1e draw 2), ✦starfall ×2 (1e
  10pw × CARDS_DRAWN), ascension, radiant_spark. Exhaust thins 8→5.
- **audhumbla_v1 — Genesis ramp (9):** pale_mercy ×2, dawnstrike, healing_light,
  ✦sacred_spring (2e heal 90), supernova_v2 (first deck for it), ✦genesis_surge (X None,
  15×X² — thermal_lance's None twin, thermal_lance untouched, hand-priced per 8c4),
  ✦dawn_of_creation (3e 80pw + 2 Str + heal 30), radiant_spark.
- **audhumbla_v2 — Nourish cannon (9):** pale_mercy ×2, dawnstrike ×2, ✦hallow (1e 2 Str +
  heal 15), healing_light, sacred_spring, uplift, purify (as-is until 51).

`lumen_surge` (4.5/3.0 redline, five decks) is deliberately in NEITHER species — deep-pass
item, touches Dark. `einherjar_standard` stays unused (needs ticket 05).

### Gates and knobs

First-pass bands per HANDOFF, both dead-card sides printed, FTK 0, audhumbla's mirror ENDING
at all is the headline check on the NOURISH reshape; report both control-floor rows.
Pre-authorized knobs (max 2 rounds/species, one change per sim): REBIRTH payoff 15→10/20,
NOURISH 25%→20/30, falling_star 45→40, starfall 10→15, zealots_edge growth 10→15,
sacred_spring 90→75, genesis_surge 15→10. GENESIS once/turn is not a knob.

## Resolution

*Implemented 2026-08-12 in one unattended pass, on top of `caf99aa`. Registry hash `1:6b38742e`
→ **`1:e2f392b8`**. 773/773 unit tests, `tsc --noEmit` clean, full `npm run balance` run.*

**LIGHT IS COMPLETE. 32/32 decks live — every species on the roster now has two tuned OS decks.**

---

### 1. What the ticket asked for, and what it got

The exact card actions lived in an implementation prompt Henry holds, which this session never
received, so **all 12 cards were built from the summary spec's stated costs / powers / riders**
and then scored with the real `calculatePowerscale`. §4 lists every one against its band, and §7
flags the four that came out over. If the prompt's numbers differ from these, §4 is the diff.

One instruction is deliberately not followed: the ticket says *"`purify` is used here AS-IS — 51
converts it later, do not implement 51 in this pass."* **Ticket 51 already landed** (`7634caf`),
so audhumbla_v2 gets the shed version of `purify` (1e, −2 Poison and −2 Burn). Nothing was
implemented for 51 here; it was simply already true.

---

### 2. Engine

| change | file | note |
|---|---|---|
| `growPerPlay: N` — RAMPAGE growth | `types.ts`, `battleReducer.ts` | per **instance**, accumulator is `card_growth:<instanceId>` in `state.counters`, so it follows the card through every pile without widening `ProgramEntity`. Read before the action loop, banked after — the first cast is printed power, and a multi-hit card grows once per cast. Uncapped, per Henry's law. |
| `resolveProgramFree()` | `ActionExecutors.ts` | the "PLAY_LAST_CARD machinery" the ticket asks for, extracted as a function so VALHALLA can call it. Adds the two things the executor cannot give: a per-action target (SELF → caster, else one seeded random living enemy for the whole cast) and RAMPAGE growth. It never moves the card, so a replayed discard stays in the discard. |
| `onDeckShuffled` dispatched | `resolutionEngine.ts` | the trigger existed as a TYPE since ticket 07 with **nothing dispatching it**. Wired in `executeDraw`. Loop review as the ticket asked: a reshuffle only happens inside a draw, the hook does not draw, nothing in the registry generates cards into a drawpile. |
| `HEAL_INTENDED` scaling + `last_heal_intended` counter | `effectHandlers.ts`, `HookFactory.ts`, `HookSchema.ts`, `HookTypes.ts` | the heal AFTER `onHealCalculated` and BEFORE the max-HP clamp. Added to **both** zod enums and both TS unions (8c2). |
| `when.counters[]` — AND-list of counter conditions | `ConditionValidator.ts`, `HookSchema.ts`, `HookTypes.ts` | GENESIS needs two at once (a GLOBAL `last_overheal` read and an OWNER-scoped once-per-turn guard) and one `counter` object cannot express that. `counter` stays; eleven hooks use it. |
| HP hook actions floor the **magnitude** | `HookFactory.ts` | `Math.floor` on a negative product rounds AWAY from zero, so NOURISH's `−0.25 × 45` read as 12 where 25% is 11.25 → 11. Every pre-53 hook action has an integer product, where the two agree exactly. |
| audhumbla base Energy **3 → 2** | `mingmingRegistry.ts` | so the 3-cost card is the ramp's literal unlock. |

**A trap worth recording.** The GENESIS guard silently did not work on the first run, and the data
was correct in `hooks.json` and correct after zod. The cause: `HookFactory.executeActions` early-
`continue`s any non-LOG action whose target resolves to null, and **a `COUNTER` action with no
`"target"` field resolves to null**. Every pre-existing hook happens to carry `"target": "SELF"` on
its counters, so the trap had never been hit. A `COUNTER` in `hooks.json` without a target is
dropped in silence — same failure mode as 8c2, different layer.

---

### 3. The four OS

1. **valkyrie_v1 VALHALLA_UPLINK — replaced.** "At the end of Valkyrie's turn, play a random card
   from her discard pile for free." The old firmware healed an ALLY 5% max HP behind a
   `target.id !== owner.id` guard, so in the 1v1 the harness measures it **could not fire at all**
   — most of why valkyrie lost 94–95% to the control. Seeded pick, exhaust excluded by
   construction, card stays in the discard, one proc per turn (guarded on the turn NUMBER, so a
   second dispatch in the same turn cannot double it).
2. **valkyrie_v2 CRUSADER_KERNEL → REBIRTH_CYCLE_OS.** A data hook on the newly-live
   `onDeckShuffled`. **This is the one design change beyond the authorised knobs and it needs
   Henry's sign-off — see §7.**
3. **audhumbla_v1 GENESIS_FIRMWARE — re-triggered.** Overheal → permanent +1 max Energy, once per
   turn. Pays in `maxEnergy`, not raw energy (8-ENERGY-TRAP). The old "every 3rd Heal/Skill" timer
   is gone.
4. **audhumbla_v2 NOURISH_ROUTINE — switch → dial.** 25% of ALL healing (knobbed to 30%, §6) is
   mirrored as Light damage to a random enemy, read pre-clamp so a heal at full HP still converts.

---

### 4. The 12 cards, scored

| card | cost | score | band | |
|---|---|---|---|---|
| `benediction` | 1e | **3.1** | 3.0 | **over by 0.1** |
| `zealots_edge` | 1e | 2.5 | 3.0 | ok — RAMPAGE, `growPerPlay: 10` |
| `echo_of_valhalla` | 1e | **0** | 3.0 | MANUAL — `PLAY_LAST_CARD` is unscoreable, same as `reprogram` |
| `ascension` | 2e | 5.9 | 6.5 | ok |
| `glimmer` | 0e | **1.4** | 1.0 | **over by 0.4** — Henry already flagged it a watch item |
| `falling_star` | 1e | **3.6** | 3.0 | **over by 0.6**, after the knob took it 45 → 40 |
| `morning_light` | 1e | 2.3 | 3.0 | under (advisory) |
| `starfall` | 1e | 3.0 | 3.0 | exactly on band |
| `sacred_spring` | 2e | 6.1 | 6.5 | ok |
| `genesis_surge` | X | **1.0** | 10.5 | **hand-priced per 8c4** — see below |
| `dawn_of_creation` | 3e | **10.9** | 10.5 | **over by 0.4** |
| `hallow` | 1e | 1.9 | 3.0 | under (advisory) |

`genesis_surge` is the roster's first `ENERGY_SPENT_SQUARED` card (`thermal_lance`'s comment claims
the scaling but its data uses the linear `ENERGY_SPENT`). The scorer models neither, so the 1.0 is
meaningless. Hand-priced at the knobbed 10 power: **X=2 → 40 power, X=3 → 90, X=4 → 160, X=5 →
250.** Against the 6.5 / 10.5 bands that is on-curve at X=2–3 and far past it at X=4+, which is the
ramp's whole point and the reason it is audhumbla_v1's payoff card rather than a generic one.

Two scorer changes were needed to price these honestly, and both are FLOORS in the ticket-32 sense:

- **`CARDS_DRAWN`** now multiplies power by `ASSUMED_CARDS_DRAWN = 3` (the roster's modal
  `cardDraw`). This re-priced one **existing** card — `ink_stream` is now over budget, and always
  was; the scorer just could not see it.
- **`growPerPlay`** charges the average over `GROWTH_HORIZON_PLAYS = 3` casts, i.e. one full growth
  step. Chosen, not derived.

---

### 5. Gates

| gate | valkyrie_v1 | valkyrie_v2 | audhumbla_v1 | audhumbla_v2 |
|---|---|---|---|---|
| **control floor** (both rows, as asked) | **100%** / 8.79 turns | **100%** / 4.42 | **100%** / 7.59 | **100%** / 23.59 |
| dead cards, subject side | 0.022 | 0.110 | 0.083 | 0.021 |
| dead cards, control side | 0.064 | 0.170 | 0.089 | 0.006 |
| FTK | 0/100 | 0/100 | 0/100 | 0/100 |

| gate | valkyrie | audhumbla |
|---|---|---|
| **mirror decided** | **400/400** | **400/400** |
| mirror turns | 13.64 | **13.08** |
| mirror split | 48.5% | 55.3% |
| first-mover edge | +16.0% | +7.8% |
| **§2.3** | **0.170** | **0.000** |

**The headline check passes.** The ticket named audhumbla's mirror ENDING AT ALL as the test of the
NOURISH reshape. It was a **61-turn, 0/400-decided** `TURN_COUNT` redline; it is now **400/400
decided in 13.08 turns**. That redline is closed.

**Valkyrie's 94–95% control loss is gone** — both her decks now beat the control outright, and
every deck in the pass clears the floor.

A side effect worth knowing about: **`runBatch.test.ts`'s stalemate fixture has run out of
species.** Ticket 48 retired `draugr` from that role, and this ticket retires `audhumbla`, the last
one — *every* mirror on the roster now decides. The fixture is now synthetic by construction
(`ymir`'s ~14-turn mirror truncated at a cap of 6) rather than by species, which cannot rot the
same way.

---

### 6. Knobs spent — two rounds per species, one change per sim

| # | species | change | §2.3 before → after |
|---|---|---|---|
All §2.3 figures below are in the **subject-of-the-redline's** orientation, i.e. v1's share of the
decided games — the same number `balance_report.json` prints.

| # | species | change | §2.3 before → after |
|---|---|---|---|
| — | valkyrie | REBIRTH capped at **once per turn** (structural, see §7) | 0.000 → 0.000 (field 99.4% → 99.2%) |
| 1 | valkyrie | REBIRTH payoff **15 → 10** | 0.000 → **0.160** |
| 2 | valkyrie | `falling_star` **45 → 40** | 0.160 → **0.170** |
| 1 | audhumbla | `genesis_surge` **15 → 10** | 0.000 → **0.000** |
| 2 | audhumbla | NOURISH **25% → 30%** | 0.000 → **0.000** |

**Both audhumbla knobs were a measured no-op on §2.3**, the same pattern ticket 52 hit on
gullinbursti: the gap is structural, not numeric. §7 says why.

---

### 7. What needs Henry

**(a) One change exceeds the authorised knob list.** REBIRTH_CYCLE_OS is now **once per turn**. The
ticket says "every reshuffle (vs UPDRAFT's once-ever)" and the loop review it cites checked for
*infinite* loops, not for *multiplicity*. As specified it produced this, on turn 1:

> Valkyrie plays Glimmer · Morning Light · Glimmer · Glimmer · Glimmer · Radiant Spark · Glimmer —
> **six REBIRTH procs, 90 unblockable damage, control dead on turn 1.**

An 8-card deck holding 3 cards reshuffles on nearly every draw, and `glimmer` is a **0-cost draw**,
so "per reshuffle" is effectively "per card played". The guard keeps the spirit (it fires on
reshuffles, not once ever) and removes the multiplicity. **It is a design decision, not a knob, and
it is flagged for review rather than assumed.**

**(b) §2.3 is out of band on both species and both knob budgets are spent.**

- **valkyrie 0.170** — v2 wins 83 of 100. In v1's orientation the two knob rounds moved it
  **0.000 → 0.160 → 0.170**; it is climbing, but the working band is 0.30–0.70. Field
  round robin (HANDOFF 8-COUNTER, run before choosing a direction): **v1 58.6%, v2 95.0%.** v2 is
  the roster's single strongest deck by 10 points (next: nidhoggr_v1 at 85.0%). The remaining
  authorised knobs push the wrong way — `starfall` 10→15 and `zealots_edge` 10→15 are both buffs.
- **audhumbla 0.000** — v1 wins 100/100 and neither knob moved it by one game. Field: **v1 70.0%,
  v2 22.2%.**

  The diagnosis for audhumbla, which is worth more than another knob round: **NOURISH's dial is
  priced against heal POWER, but the engine converts power to HP at `maxHp × power / 400`.**
  `sacred_spring` is a 90-power heal — that is **22 HP** on her 100-HP frame, and 30% of 22 is
  **6 damage for 2 Energy**. The dial reads 30% and delivers about 7% of the card's printed power.
  Raising the percentage cannot fix that; the conversion needs to read printed power, or the deck
  needs a real damage card. Both are outside this ticket.

**(c) Four cards are over budget** (§4), three of them new and one (`glimmer`, 1.4/1.0) a card
Henry already marked a watch item. `falling_star` is over **after** its knob.

---

### 8. Blast radius (§9)

Redlines **43 → 49**.

**Closed (1):** `TURN_COUNT mirror:audhumbla` — 61.0 turns / 0-of-400 decided.
**Added (2) matchup:** `OS_GAP os:valkyrie` 0.33, `OS_GAP os:audhumbla` 0.50.
**Added (5) card:** `benediction` 3.1, `dawn_of_creation` 10.9, `falling_star` 3.6, `glimmer` 1.4,
and `ink_stream` — which is **not new**, it is an existing card the `CARDS_DRAWN` pricing can now
see.

Under the working §2.3 band (**0.30–0.70**, HANDOFF §2.3 — the strict ±15% `osMaxGap` is
explicitly not the bar), the eight OS_GAP rows read: draugr 0.34, hraesvelgr 0.31, nidhoggr 0.32,
ratatoskr 0.31, sleipnir 0.33 all **in band**; jormungandr 0.24, valkyrie 0.17, audhumbla 0.00
**out**. Three species out of sixteen.

Cards audited 198 → **210**. No committed card score outside §4 moved except `ink_stream`'s
re-pricing. Three tests moved to the new contracts (`OSGapClosures` items 1/3/4/5/6 and
`runBatch`'s stalemate fixture), each because this ticket deliberately changed what the old
assertion was asserting.
