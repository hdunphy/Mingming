# Rootfall: find the hole before ruling the lever (ticket 76)

- Type: wayfinder:grilling (measurement first — the arms below run before Henry's session)
- Status: closed
- Assignee: 
- Blocked by: nothing — CLOSED, outstanding work moved to [77](77-player-progression-arms.md)
- Phase: Vertical Slice

## Why this exists

Ticket 75 step 1: **Rootfall is the worst gym — 27.7% bare compound against the 60 target** —
and it has never had a numbers session. Its previous "~7.6pt under" predated the toolbox, the
firmware-pairing fix, the draw-scoping fix and the biome walk-order inversion. Both opening
hypotheses died: it is not "Nature is weak" (the fire-leaning party does WORSE there than the
nature-leaning one) and Tidewrack was never the outlier.

## The arms (agent, report-only — all n=60, bare arm, Rally live, current tree, paired seeds)

1. **Per-fight split** — where do runs die: fights 1/2 (rolled) vs fight 3 (the authored trio)?
2. **ROOT ROT off** — the Driver isolation (the 68-era relic isolation, re-taken for this gym).
3. **Party-lean bracket** — nature-lean, fire-lean, and mixed parties, since the type ordering
   (water >> nature > fire at this gym) is itself a finding needing a where.
4. **One comp-swap candidate** — the trio is huldra_v2 + rat_v1 + jorm_v2; measure ONE alternate
   (proposal: rat_v1 -> ratatoskr_v2, trading the sustain body for tempo — Henry may substitute a
   different candidate at the session; this arm exists so the session starts with a comp datum the
   way Tidewrack's did).
5. **Selective-shopping toolbox line** (from 75 ruling 1a) for this gym: cleanse tech only.

## Then: Henry's session

Rule the lever with the five arms on the table — comp, Driver number (ROOT ROT's +1), authored
IVs, or accept-and-watch. No lever moves before the session; no card printings move at all without
their own arm (75 ruling 1b pattern).

## Done when

Five arms reported in the 75/76 research doc, Henry's session held, the ruled lever applied and
re-measured at n=60, gauntlet compound within 60±5 or the residual explicitly accepted.

## ARMS REPORTED — 2026-09-01, awaiting Henry's session

All five arms run, plus ticket 75's ruling-1a/1b diagnosis at two gyms. Full write-up:
[research/76-rootfall-diagnosed.md](../research/76-rootfall-diagnosed.md). **No lever moved.**

**Arm 2 is the finding: ROOT ROT is worth +26.6pt on its own.** The boss fight goes 56.7% ->
**83.3%** with the Driver removed, same seeds and same trio — 17 fights flipped to the player, 1
against, **p = 0.00014**. Largest single-lever effect measured across tickets 71-76. For contrast
TIDAL SURGE measured INERT under the same isolation, so the two Drivers are not in the same weight
class and nobody had checked.

**But one lever does not close this gym.** Even a free boss fight leaves the compound at roughly
0.733 x 0.667 x 0.833 = **40.7%** against 60. Rootfall is soft at all three fights (73.3 / 66.7 /
56.7), not boss-shaped the way Tidewrack was.

**Arm 4 (comp) is a clean null**: `rat_v1 -> rat_v2` is 56.7% -> 55.0%, 11 discordant each way,
**p = 1.00**. The session opens knowing composition is not the lever here — the opposite of 74.

**Arm 3 (lean bracket)**: water-lean beats the type-correct fire-lean party by 10pt of compound
(37.8% vs 27.7%) while bringing the WRONG element, and the whole gain is in the rolled fights; at the
boss they are identical at 56.7%. That is [ticket 73's triangle](73-launch-type-triangle.md) in the
gauntlet — type advantage works where the enemy is authored, raw deck strength wins where the pool is
mixed. p = 0.098; wants n=120 before ruling.

**Arms 1 and 5** are in the doc: the per-fight split, and cleanse-only shopping (20.5%).

**The toolbox diagnosis (75 ruling 1a/1b) is HALF an answer, and the honest half.** Per-card arms at
two gyms give opposite shapes: at Rootfall every card is individually FREE (p ~ 1.00 each) and the
basket costs 17pt; at Emberfall each card costs 9-12pt alone and two cost the full 19. **So there is
something to reprice at Emberfall and nothing to reprice at Rootfall**, and one ruling covering both
would be wrong at one of them. No mechanism is asserted: "bad printings" fails at Rootfall, "buys too
many" fails at Emberfall, and energy cost fails too (Emberfall's loss is carried by its two 1-energy
cards). Seven arms in, that is where the data stops.

## Resolution

**CLOSED 2026-09-01 (Henry: *"If that closes ticket 76 then close it and move all work to ticket
77"*).** The five arms are delivered and reported —
[research/76-rootfall-diagnosed.md](../research/76-rootfall-diagnosed.md), commit `7e418cf`. The
session, the lever and the re-measure are NOT done here; they moved to
[ticket 77](77-player-progression-arms.md), which reframes them.

### Why 77 supersedes rather than continues this ticket

77's opening finding is that **every lever measured across tickets 67-76 was boss-side, and that was
not a choice**: the bare arm fields a run-start player (18-card deck, `run.drivers` empty, no macros
because no AI policy exists to fire one) against a fully-built boss (tuned kit, OS, Driver, 20/20/20
IVs, full lookahead). This ticket asked "why is Rootfall's boss too strong" when the available
question was "why is a run-start player losing to a finished one". Its answers stand; its framing does
not, and the same is true of 71-75.

### What moved, and where

| open item | now owned by |
| --- | --- |
| ROOT ROT (+26.6pt at the boss, p = 0.00014) | **77 Track C** — reshaped, three candidates, no caps |
| Henry's session on the lever | **77's session** |
| Re-measure to 60 +/- 5 | **77's Done when** |
| The soft rolled lead-ins (76 arm 3) | **[ticket 73](73-launch-type-triangle.md)** — 77 explicitly holds it there with the launch triangle |
| The toolbox mechanism, undetermined at two gyms | **77 Track A3**, the dilution control |

### What this ticket established, which stands

1. **ROOT ROT is worth +26.6pt on its own** (56.7% -> 83.3% at the boss, 17 flips to the player
   against 1, p = 0.00014) — the largest single-lever effect across 71-76, against TIDAL SURGE
   measuring INERT under the same isolation.
2. **One lever does not close Rootfall.** A free boss still leaves the compound at ~40.7%.
3. **The comp is a clean null** (`rat_v1 -> rat_v2`, p = 1.00). Tidewrack's answer does not transfer.
4. **The toolbox per-card curves differ by gym** — free-alone-and-expensive-together at Rootfall,
   9-12pt each at Emberfall — so no single reprice ruling could be right at both. Ruling 1b did its
   job: there was nothing to reprice at one of the two gyms and the arms said so.
5. **Water-lean beats type-correct fire-lean by 10pt of compound**, entirely in the rolled fights,
   tying exactly at the authored boss. Held for ticket 73.
