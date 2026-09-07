# Ticket 142 — The route to the gym: rivals on the road, and a scout at the last exit

**Status:** approved direction by Henry 2026-09-05 ("let's try your idea"); Henry's alternative is
recorded in §5 and is NOT dead — it is the fallback if this does not fix the feel.
**Branch:** `legion/ai-perf`, one commit per lettered row, authored as Henry.

---

## 1. The complaint (Henry, playtest 2026-09-05)

> *"If I want to go Nature gym I would pick Fenrir first, then my goal is to recruit Rat. But then
> next is the Fire biome, so either I go in with a type disadvantage or I drop Rat and go back to
> 1v1 to try to recruit Sköll. Then in the Water biome I'd probably go in with Rat… Finally for the
> gym I need to swap to my full party. Maybe that's the route we want, but it doesn't really
> prepare you for the fight."*

Two mechanics produce that feel, and neither is the walk order:

1. **Recruits are tied to where you stand.** A blueprint is *the species you defeated*
   (`RewardSystem.ts`, ticket 12) and a node fields *the biome's own element*
   (`encounter.ts` `encounterSpeciesPool`). So on Rootfall (Nature → Fire → Water) the map dictates
   that the Nature bridge comes first and the second Fire body second, and the Nature recruit has to
   be carried through the Fire biome at a disadvantage — or benched.
2. **Nothing before gauntlet tier 1 looks like the gym.** The last biome is the element that beats
   you; the team you assembled for the leader is untested when the HP carry-over starts.

The walk order itself (Henry 2026-08-30: gym element first, then its counter, then that one's
counter — easy, neutral, hard) stays. It fixes a different problem (a run lost to the map's ordering)
and it just shipped.

## 2. What the comp grid says the team should be

Ticket 141's gym check: **fenrir_v1 + skoll_v1 + ratatoskr_v2** beats the three strongest Nature-gym
builds 75% over 120 battles. The counter to a Nature×2 + Water gym is Fire×2 + Nature. So on a
Rootfall run the player needs, from the road: **one more Fire body and one Nature body** — the
"path species" — and ideally a look at Nature×2 + Water before the leader.

---

## 3. 142a — Rivals: the path species walk the same road

**Rule.** Every gym offer carries a `pathElements` pair: the element that beats the gym, and the
gym's own element (Rootfall: Fire, Nature; Emberfall: Water, Fire; Tidewrack: Nature, Water).
In every biome, **one wild node in three fields a rival** — a party drawn from the path species
instead of the biome's species. Elites, alphas and the gym are untouched.

**Fiction.** Rivals are other trainers on the way to the same leader, fielding what beats it.
They read as a distinct node kind on the map (`rival`), so the player can route to or around them.

**What it does.** Blueprints drop from what you beat, so path-species blueprints are reachable in
every biome — the Fire pair can be assembled in biome 1 or biome 2, the Nature bridge in biome 2 or
3, in whichever order the hand wants. The biome still keeps its promise (two of three wilds are its
element; the elite exam is its element). And the player fights the mirror of their own plan a few
times before the gym, which is the practice the counter team needs.

**Implementation notes.**
- `IGymOffer` gains `pathElements: [counterOf(gym.element), gym.element]` — both derivable from
  `COUNTERED_BY` in `gyms.ts`, nothing rolled.
- `regionGraph.ts`: when filling a biome's middle layers, tag every third `wild` (deterministic from
  the biome's `SeedStream` fork, so a seed reproduces its map) as `rival`. Keep the wild's rung and
  kit fraction; only `encounterSpeciesPool` changes: a `rival` node unions `getSectorSpecies` over
  `run.pathElements` instead of `run.biomes[i].elements`. Do not read `elements[0]` anywhere —
  `IBiome.elements` is a 1-or-2 list by design.
- Rival parties are 1–3 bodies by the same rung table as wilds; a rival may field the gym's own
  species (that is the point — a Rootfall rival with huldra in it is a preview).
- Blueprint chance: same as `wild` (0.20 per body). No special drop — the road pays the same rate,
  it just pays in the species you want.
- Map screen: a distinct badge and the two path elements shown on hover. Tests: every biome of every
  offer has ≥ 1 rival; rival pools contain only path species; seed-stability.

## 4. 142b — The scout: biome 3's exit elite is a cut of the leader

**Rule.** The last biome's exit elite (the node before the gym) fields **two bodies of the gym
leader's comp**, at elite rung (0–31 uncapped, full kit fraction), with the biome's Driver as its
prize as today. Rootfall's scout is two of {kraken_v1, ratatoskr_v1, huldra_v1} — the ticket-140
grid's third-best comp is the gym as it would be built.

**What it does.** The player crosses the element that beats them, then meets the thing they built
for, once, at full HP, before the gauntlet starts charging attrition. If the team does not work, the
scout says so while there is still a workshop and a market behind you.

**Implementation notes.**
- `gyms.ts`: each `IGym` gains `leaderComp: [fw, fw, fw]` — placeholder trios until ticket 28's
  authored leaders land; use the ticket-140 round-2 top comps of the gym's element pair for now
  (Rootfall `kraken_v1+ratatoskr_v1+huldra_v1`, Emberfall `fenrir_v1+skoll_v1+jormungandr_v1`,
  Tidewrack `kraken_v1+jormungandr_v1+huldra_v2`).
- `regionGraph.ts` / `encounter.ts`: biome 2's exit (layer 4) is the gym itself
  (`finalBiomeExitKind: 'gym'`), so the scout is **biome 2's guaranteed elite**, placed in layer 3
  so it is the last fight before the gauntlet. Mark it `scout: true`; `encounterSpeciesPool` for a
  scout returns two of `gym.leaderComp` chosen by the biome seed.
- Gauntlet tier 1 (grunt, 1–2 bodies) stays as is. If playtest says scout + tier 1 is one preview
  too many, tier 1 is the one to fold, not the scout — the scout is the free look.

## 5. Henry's alternative — RECORDED, not rejected

> *"Nature Gym means: Fire starter vs Fire biome, you recruit Sköll; then go to Nature biome where
> you recruit Rat; finally you go to the Gym biome which is NNW encounters but weaker until you face
> the final gym."*

The walk becomes **[counter element, gym element, gym biome]** — a straight line to the team the
gym wants, the leader standing in its own element again (which Henry already said the current order
fails thematically), and a last biome that looks like the fight.

What it costs, so the fallback is chosen with eyes open: the run no longer sees the triangle
(Rootfall never visits Water; kraken and jormungandr are unrecruitable on that route; each gym is a
fixed four-species script); there is no biome that beats you, so the difficulty curve flattens; and a
weakened-NNW biome against the team built to beat NNW is a victory lap that duplicates gauntlet
tiers 1–2. If 142a/142b do not fix the feel, the version to build is **Water → Fire → Nature at
full strength → gym** (hard, neutral, prep, boss), which keeps one biome you can lose to.

## 6. Acceptance

Not a grid — a playtest. Henry runs Rootfall with a Fire starter and reports: could the Fire pair be
assembled by the end of biome 2 without benching anyone; did the scout tell him anything the
gauntlet then confirmed; did rivals read as a choice on the map. Plus the tests named in §3/§4 and
`regionGraph.test.ts` / `encounter.test.ts` extended for the two new node behaviours.
