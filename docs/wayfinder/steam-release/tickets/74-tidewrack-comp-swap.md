# Tidewrack re-authored: kraken_v2 replaces kraken_v1, and the thorn_tithe printing (ticket 74)

- Type: wayfinder:task
- Status: closed
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

**CLOSED 2026-08-31 (Henry: *"74 is done. Lets close it and open a new ticket"*).** All five build
steps done, gates green, numbers in
[research/73-the-tidewrack-nerf-arms.md](../research/73-the-tidewrack-nerf-arms.md) §7.

### What the swap bought

`gym_tidewrack` fields `jormungandr_v1 + kraken_v2 + skoll_v2`. The boss fight goes **30.0% ->
75.0%** against `tidewrack_playtest_v1`, and it is now the **best** of its three fights rather than
the worst. Ruling 1's expected side effect shows up in the clock rather than merely being asserted:
fights run **7.9-8.4 turns** against the old composition's 5.8, which is TIDAL SURGE charging off a
narrower base exactly as predicted.

That 30.0 -> 75.0 pair is **not** a paired comparison — composition, n (30 -> 60) and the toolbox all
differ. The toolbox confound runs *against* the swap (research/69 measured it making Tidewrack worse,
favourable 26.7% -> 16.7%), so the composition accounts for the whole move and then some.

### What it did NOT buy, which is why ticket 75 exists

**The gauntlet still fails, and the failure MOVED.** `rollGauntletFight` consults `authoredBossFor`
for the **boss slot only** — fights 1 and 2 are rolled from the region species pool at every gym, so
this ticket could never have touched two of the three fights it is graded on. At n=60 with the
toolbox, graded on the compound per 67 R5:

| arm | fight 1 | fight 2 | boss | compound | vs 60 +/- 5 |
| --- | --- | --- | --- | --- | --- |
| favourable (the arm 60% grades) | 61.7% | 66.7% | 68.3% | **28.1%** | FAIL -31.9pt |
| `tidewrack_playtest_v1`, toolbox | 70.0% | 73.3% | 75.0% | **38.5%** | FAIL -21.5pt |
| Emberfall, calibrated (67 R5) | 83.3% | 90.0% | 80.0% | 60.0% | PASS |

Tidewrack's lead-in fights sit **13-22 points under Emberfall's**. Three fights at ~72% multiply to
38%, not to 72%. **The old 30% boss was masking a gauntlet-wide shortfall rather than being it** —
a finding this ticket produced rather than a failure of it. Handed to
[ticket 75](75-tidewrack-rolled-fights.md).

### thorn_tithe, printed

The transfer landed with the swap; the reprice arm reported and Henry ruled the number:
*"thorn_tithe should be 30 with 3 weakened to the enemy"*. **The card is 1 energy, 30 power, 3
Weakened on the TARGET** — and the shipped printing is the one that was measured (75.0%, p = 1.00
paired against 40 power, i.e. free). `huldra_v1`'s own `thorn_tithe` -> `hexbloom` combo can finally
fire, which was the printing error the report's §4 table identified.

Against the curve, for the record: `50 x E - 10` puts a 1-energy attack at 40, and `hamstring` — the
precedent for this effect — is 1 energy, 20 power, 2 Weakened on the target. At 30/3 the card sits
between them rather than strictly above both, which is what the reprice was for.

### Knobs retired

`boss-cantrips`, `boss-cantrips-<N>`, `ink-power-<N>`, `thorn-target` and `thorn-power-<N>` are all
**deleted** from `experimentalTweaks.ts`, each with a `validateTweaks` case that throws naming the
ruling that retired it. There are now **no live knobs**. The threading seam is kept deliberately —
see that file's header for why a retired flag must throw rather than silently no-op.
