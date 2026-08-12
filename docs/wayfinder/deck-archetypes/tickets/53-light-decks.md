# Light decks: valkyrie + audhumbla — the last element

- Type: wayfinder:task
- Status: **open** — specified and Henry-approved (2026-08-11), not yet implemented. The
  implementation prompt exists (Henry holds it); the implementing session flips this to
  closed and appends its Resolution.
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

*(appended by the implementing session)*
