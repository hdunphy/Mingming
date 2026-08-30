# Rootfall authored: the strangler under ROOT ROT (ticket 72)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [68](68-boss-redesign-drivers.md), [71](71-tidewrack-build.md) (shares the hook work), [70](70-first-ko-snowball.md)
- Phase: Vertical Slice

## Henry's authoring (2026-08-29 session)

**ROOTFALL (Nature gym) fight 3:** huldra_v2 (BARK_SHIELD_OS) + ratatoskr_v1 (GOSSIP_NODE) +
jormungandr_v2 (TOXIN_FANG_OS) — the strangler. Shield-poison (heartwood/thornguard/blightbloom),
party-wide 0-cost sustain with nettle chip, and a poison execute. Three distinct species,
2 Nature + 1 Water on the heuristic. Rejected, recorded: twin-huldra builds (species-clause look),
rat_v2 reuse (same OS at two gyms), and the kraken_v2 control-burst sketch (drops poison identity).

**Driver: ROOT ROT** — *"Whenever this side's card applies Poison, it applies 1 more."* ~+3-4
stacks/turn above printed; contagion doubles the inflated pile; visible on every application.

**Intended counter:** Fire (type) — noting fenrir_v1's missing-HP scaling converts poison pressure
into damage — plus the cleanse tech in ticket 69's toolbox. Cleanse landscape fact that motivated
it: `soothe` (0e, 1 stack) loses the race and `purify` is Light, off-EA.

## Build steps

1. `driver_root_rot` in hooks.json via the poison-application trigger. **Engine trap from the
   deck-archetypes handbook: `baseCost` on `onStatusApplied` hooks silently disables them** — do not
   set it; cover with a hook-wiring test. `liveness.ts` after the edit.
2. Rootfall's fight 3 becomes the authored trio; the LAST `boss_relic_*` team retires — after this
   ticket the relic firmware is dead code and can be deleted with its exemptions
   (`battleFactories`, `codex`, `firmwareRegistry` carve-outs).
3. Offer screen + final-elite carry, as 71.
4. Measure: `gauntlet:fight2 --gym gym_rootfall`, favourable + control, 60 each, death-Energized
   live. Note the 4-turn horizon works against poison — if ROOT ROT under-shows, the number to
   move is its +1 (to +2), in the ticket, Henry's call.
5. With all three gyms authored: re-measure Emberfall under death-Energized too, and report the
   three-gym table (per-fight + compound) that the HELD gauntlet-target ruling is waiting for.

## Done when

Gates green, Rootfall migrated, relic code deleted, telegraphed, three-gym table reported, HANDOFF
refreshed.

## Resolution

_(open)_
