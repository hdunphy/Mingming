# Ticket 142 — The route to the gym: rivals on the road, and a scout at the last exit

**Status:** RE-RULED 2026-09-11 — build Henry's alternative (§7; 142d–h ready for Legion). History: approved direction by Henry 2026-09-05 ("let's try your idea"); Henry's alternative is
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


## 6. Playtest 2026-09-10 (Henry's run log `mingming_run_log.json`, Rootfall tier 0, lost at biome 3's first node)

The route itself ran: 14 fights, three rivals in biome 1 and three in biome 2, both elites beaten,
scrap never a constraint (80–110 banked most of the way). What the run surfaced is not the path;
it is what the player does *at the seam*, and it is the strongest note yet for 148:

- **Henry benched down to one body at every boundary, on purpose.** *"Losing a mingming in a fight
  puts you at a real disadvantage … the type disadvantage is hard to overcome so I dropped rat when
  I went to the fire biome and then dropped both fire mingmings when I went into water."* The
  boundary editor works exactly as ticket 61 §3 asked — and the rational move it enables is to
  enter every new biome 1v1 with the one on-type body, so the 3v3 the game is built around only
  happens for a few nodes after a workshop. The type triangle at biome scale makes two of the
  three bodies wrong for two of the three biomes. Energized (ticket 135) is not enough to keep an
  off-type body on the field; the recruit is either the coming biome's counter or it is benched.
- **Biome 3 opened with the biome-1 recruit alone (8 cards) against a wild jormungandr and died in
  one turn.** That fight is ticket 152 (the undertow pair loops); the one-body party is this
  ticket's problem.
- **"I still don't feel like I'm leveling up with my decks. I almost always send cards to the
  collection and search for 2–3 cards to add to the deck."** Deck size 8 → 17 → 8 → 17 → 8 across
  the run: every recruit adds five engine cards, every bench removes them, and the tuned deck is
  rebuilt from the same 2–3 picks each biome. This is ticket 77's finding (adding cards loses;
  deck size is the lever) *felt from the player's side* — the run has no progression axis that
  survives a boundary. Input to 148's design session, not to its P0–P3 arms.

**Verdict on 142's own question** (does the road to the gym feel better?): not answered — the run
did not reach a gym, and the seam dominated the feel. Henry's biome alternative (§5) stays live.
The design question 142 and 148 now share: *what makes an off-type body worth keeping through a
biome?* — candidates for the session: a boundary reflash that keeps the body but swaps its five
engine cards toward the coming biome; recruits offered at the workshop being the *next* biome's
counter, not this one's; a persistent per-body axis (blueprint / level) that a bench does not
reset, so the deck is not the only thing that "levels".


## 7. RULED 2026-09-11 — build Henry's alternative (§5), and the shop becomes static

Off the 2026-09-10 playtest (§6). Henry: *"Let's try my alternative route. It's fine if there are no
Water mingmings in there."* One commit per lettered row, authored as Henry.

- **142d — the route is [counter element, gym element, gym biome].** For Rootfall (Nature gym):
  Fire biome → Nature biome → gym biome. The gym biome fields the gym's species (NNW for Rootfall)
  at reduced strength until the gym itself. The Water biome is not on the Rootfall route and kraken
  / jormungandr are not recruitable on it — accepted (*"it's fine if there are no Water mingmings"*).
  142a's rivals and 142b's scout stay as built and re-key to the new order (the scout at the
  Nature biome's exit previews two of the gym comp; rivals field the path species of the biome
  they stand in). `pathAndScout.test` / `encounter.test` / `regionGraph.test` updated; the run
  walker (`scratch/t149_runmix.ts`) re-run so the fight count and width mix are on record.
- **142e — the marketplace stock is static per run.** Today `marketplace.ts` re-rolls the stock on
  every visit (*"stock re-rolls per visit"*, L16). Henry: *"make it static per run so whenever you
  come back it has the same stock, which doesn't get replenished — once you buy the card it's gone
  from the shop."* Stock (cards, macros, and the blueprint slot below) is rolled once per
  marketplace node from `nodeSeed(run seed, node id)` with visit count removed from the key; a
  bought item leaves a gap; re-entry shows the same remaining stock. The no-farm rule in the
  file's header is satisfied by construction (nothing replenishes).
- **142f — refresh for scrap.** *"You can pay scrap to refresh it."* One button, **50 scrap**,
  re-rolls the entire stock — cards, macros and the blueprint slot — from the next visit-count key.
  Replaces today's 10-scrap card reroll. Henry: *"we might need to go higher"* — the number is a
  constant with a comment, and the run walker reports scrap-at-gym so it can be retuned.
- **142g — blueprints in the shop.** *"Add blueprints to the shop, but they should be expensive
  and only offer 1 random option."* One slot, one random blueprint from the species the run can
  recruit on this route, **50 scrap**. Bought → gone until a refresh. Blueprint economy per the
  steam-release ruling in HANDOFF (blueprints are consumable; assembly rolls stats).
- **142h — write-back.** A run walked end to end on the new route with the log attached; scrap
  banked at each marketplace visit before and after; the §6 questions re-asked of Henry on his
  next playtest.

Gates: 142d — every route still reaches a gym in 11–13 fights (the ticket-149 walker measured 11.7
on the old order); the scout still previews the gym comp; no unreachable species on the *other*
gyms' routes (each gym's route visits its counter and its own element — check all three). 142e/f/g
— `marketplace.test` covers static stock, gap-on-buy, refresh re-roll, blueprint slot pricing, and
that a refresh cannot be bought with less than 50.

## 8. CORRECTION 2026-09-12 — the route was never about withholding

Henry, reading 142g back:

> *"We aren't intentionally withholding blueprints. The stall can sell a kraken blueprint, it just
> felt bad trying to prepare for a NNW deck by going through an entire water biome when you want to
> focus on your fire team. You should be able to get water mingmings — maybe you want to try a
> certain deck archetype and take the type disadvantage, or maybe it's an achievement to beat a
> grass boss with water mingmings. It's not about limiting, it was about avoiding having to drop
> your fire starters to get through the biome then last minute switch back to FFN party."*

**This corrects §7's 142d bullet, and a claim I built on it.** That bullet reads *"kraken /
jormungandr are not recruitable on it — accepted"*, and 142g took it as a design goal: the shop's
blueprint pool was restricted to the route's own elements so an off-route body could not be bought.
That inverted the ruling. The complaint 142d answers is being FORCED to walk a biome you have no
team for; the shop is the opposite of that problem, because it is how an off-route body is reached
**without** the detour. Restricting it turned a fix for a routing annoyance into a content lock.

So: the blueprint pool is the whole Early Access roster (`blueprintPool()`), and the route's
element gap is a fact about where you WALK, not about what you can own. What §7's bullet should
have said is that the route no longer forces a detour — not that it closes a door.

Two more clarifications from the same message, both already true and now pinned by tests rather
than left to luck:

- **Duplicates are buyable.** *"You should be able to purchase duplicate cards that you already
  own. What we don't want is the shop has unlimited stock. It should work like Slay the Spire where
  you have a single stock of each item."* `isOfferSold` keys on the offer's minted INSTANCE, not on
  its card id, so holding three Tackles greys out nothing; `drawDistinct` puts each id on the wall
  at most once, which is the single stock. A future "don't offer what they already have" filter
  would satisfy the second half and break the first, so both are asserted together.
- **Each shop is its own shelf, and it persists.** *"If I go into shop at biome 1 and buy tackle,
  the shop in biome 2 is different, but if I were to return to biome 1 shop the same cards would be
  there except the tackle that I bought."* That is 142e's per-node seed plus the instance-keyed
  gap, and it is now walked end to end in one test rather than asserted a piece at a time — the
  three claims only mean anything together.
