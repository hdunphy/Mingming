# Tidewrack re-authored: kraken_v2 replaces kraken_v1, and the thorn_tithe printing (ticket 74)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [71](71-tidewrack-build.md) (context), research/73-the-tidewrack-nerf-arms.md (the six arms)
- Phase: Vertical Slice

## Henry's rulings (2026-08-31, on the six nerf arms)

Henry's diagnosis, verbatim in substance: *"the water boss hits too hard at ~44 dmg/turn while the
other bosses sit at 30 and 25... at least kraken_v1 doesn't feel op. I think it's when they're
combined with jorm."* The arms agree: the lever is the draw-cantrip MULTIPLIER (arm B +63.3pt), not
printed power (arm C +13.3, ns), and no undertow dose lands in band (30/60/63/93 across 0-3 cuts —
a step function nobody should tune a boss on at n=30).

1. **THE FIX IS A COMP SWAP, not a card nerf: Tidewrack's trio becomes
   `jormungandr_v1 + kraken_v2 + skoll_v2`.** Kraken_v1's draw engine stacked on jormungandr_v1's
   is what produced the doubled flow; kraken_v2 (TIDAL_CRUSH burst) removes the multiplier while
   every deck stays a REAL tuned deck (the 68 authoring law holds — no boss-only card edits).
   Expected side effect, intended: TIDAL SURGE fires slower (kraken_v2 plays fewer, costlier
   cards) — that is part of the nerf, not a bug.
2. **`ink_stream` stays at 33. Question CLOSED.** Arm C measured one-sided: printed power is a weak
   lever on this fight, and any cut also hits the player's own kraken_v1/jorm_v1.
3. **`thorn_tithe`: the 3 Weakened moves SELF -> TARGET** — the printed self-debuff defeats
   huldra_v1's own hexbloom combo and reads as a printing error, per the report's SS4 table.
   **Commit the transfer; then run the power reprice (40 -> 25-30) as a measured arm** — the fixed
   card sits strictly above hamstring on both halves, so the reprice is expected to land; Henry
   rules on the arm's number before it prints. Description text updates with each change
   (printed-numbers law).

## Build steps

1. Swap the authored trio for `gym_tidewrack` (registry/gauntlet authoring, ticket 71's pattern);
   update ticket 71's record with a pointer here. No hooks.json changes.
2. Measure the swapped fight at **n=60**: the `tidewrack_playtest_v1` handbuilt arm AND the
   standard favourable arm, Bereavement Rally live, toolbox purchasable. Target guide ~84.3%
   per fight; the verdict that matters is the GAUNTLET COMPOUND (67 R5).
3. `thorn_tithe` transfer: SELF -> TARGET in programs.json, description rewritten to the real
   numbers; then the 40 -> 25-30 reprice arm (report numbers to Henry, do NOT print the reprice
   without his word).
4. Delete or retire the `experimentalTweaks.ts` knobs this ruling obsoletes (boss-cantrips*,
   ink-power*) so a future session cannot mistake them for live levers; thorn-target graduates
   into the printing.
5. Gates as standing; report as SS-next of the 73 research doc.

## Done when

Swapped trio measured at n=60 both arms, thorn_tithe transfer printed + reprice arm reported,
obsolete tweak knobs removed, ticket 71 cross-referenced, HANDOFF State refreshed.

## Resolution

_(open)_
