# Ticket 207: Authored gym teams: the leader's locked team and deck, and its cards in fights 1 and 2 (design)

**Type:** design session with Henry, then a small engine change. Henry reviews every deck list before it reaches the registry. **Status:** **OPENED 2026-10-08** (Henry: *"we probably need to lock in the deck and mingming of each final boss them give some of those cards to flights 1 and 2. Add this as it's own ticket"*); **shape ruled 2026-10-08** (D1); **the three teams picked 2026-10-08**; **207a and 207b done 2026-10-08** (`d7a5a75`); follow-ups shipped through 2026-10-09 (`2f03045`, `5fdb093`, `097460f`, `9e96f78`); **merged with origin/first-impressions 2026-10-09** (`7778dec`, which brought in 202b's revive); 207c waits on 211a's bench. 211 picks the gym setting after this lands (211 D4). Split out of [211](211-gym-difficulty-and-biome-order.md).

## Why

The gym is meant to be a designed exam. Today only part of it is designed:

- **The leader's team (fight 3)** is authored by species and firmware only (`AUTHORED_BOSSES` in `src/engine/run/bosses.ts`): Emberfall fields fenrir_v2, skoll_v2, huldra_v1; Tidewrack fields jormungandr_v1, kraken_v2, skoll_v2; Rootfall fields huldra_v2, ratatoskr_v2, jormungandr_v2. Its IVs are fixed (`BOSS_IVS`, 20/20/20). Its **decks are not authored**: each member gets that firmware's tuned list from `getDeckForOS`, the same list a wild or elite of that species would hold. So any card change to a species' tuned deck changes the gym too, without anyone deciding that.
- **Fights 1 and 2** are rolled: species drawn from the run's biome pools, a random firmware, IVs rolled from 0–31, and the tuned deck for that firmware (`rollGauntletFight` and `buildEnemy` in `src/engine/run/gauntlet.ts`). Nothing in them points at the leader, so they do not prepare the player for fight 3.

## What this ticket does

Henry (2026-10-08): *"Add some of the leader cards so you get to see them before the fight. This means we need to add leader card for each instinct and then ensure that all three instincts show up at least once in fights one and two but don't let the party be exactly the same as the final 3rd fight. That should be the hardest because it has good synergy."*

1. **Lock in each leader's team:** species, Instinct and IVs per member (as today), plus **an authored deck list per member**, kept in the gym table rather than read from `getDeckForOS`. Changes to a species' normal tuned deck no longer move the gym. Henry reviews and signs off each list in a design session.
2. **A leader card for each Instinct.** Each of the leader's three members has a signature card, named in the gym table: three per gym, nine in all. They are cards that show the leader's plan.
3. **Fights 1 and 2 show all three.** Across the six enemies in fights 1 and 2, each of the leader's three Instincts appears at least once (that species, running that Instinct), and each of those enemies carries its Instinct's leader card. The other slots stay rolled from the pool as today, with rolled IVs.
4. **No preview of the whole team.** Neither fight 1 nor fight 2 fields the leader's exact trio. The leader's team is the only place the three play together, which is what makes fight 3 the hardest.
5. **Fight 3 is the hardest.** Checked on 211a's bench: per gym, the loss rate in fight 3 should be the highest of the three fights. If fight 1 or 2 out-kills the leader, that is a finding to report.
6. **Keep the scout and the telegraph honest.** The gym scout and the elites' Driver preview read the same table (ticket 28a: one gym comp table), so they show the locked team.

### The three teams (Henry, 2026-10-08)

Henry: *"Not sure yet let's pick the Mingmings first."* Each gym keeps its shape: two members of the gym's element plus one guest from the element the gym beats (ticket 28b), and its Totem.

| Gym | Plan | Members (Instinct) | What the decks build toward |
|---|---|---|---|
| **Emberfall** (Fire) | control | fenrir_v2, skoll_v2, **huldra_v2** (guest) | Huldra: Burn for damage and scaling, while building Sharp and Bark Shield. Fenrir and Sköll: control |
| **Tidewrack** (Water) | ramp | kraken_v2, **jormungandr_v2**, **fenrir_v1** (guest) | Early turns get Energized and stack Poison; Jörmungandr scales on the Poison; the late payoff is multi-hit cards for Fenrir and Jörmungandr |
| **Rootfall** (Nature) | zoo | **ratatoskr_v1**, **huldra_v1**, **kraken_v1** (guest) | Apply Dazed; the payoff is cards that scale on cards played |

Bold is a change from today's table (`AUTHORED_BOSSES` in `src/engine/run/bosses.ts`). Today: Emberfall fenrir_v2, skoll_v2, huldra_v1; Tidewrack jormungandr_v1, kraken_v2, skoll_v2; Rootfall huldra_v2, ratatoskr_v2, jormungandr_v2.

What the change does to the tables and tests (for 207b):
- No Instinct is fielded at two gyms any more. skoll_v2 was the one named duplicate (`pathAndScout.test.ts` pins it), so that pin goes.
- jormungandr_v1 leaves the gyms. Its redesign (203) no longer moves the gym.
- The gym biomes' elements do not change: each gym's members keep the same elements (`gymCompElementPlan`), so the approach biomes stay as they are.
- The Rootfall trio is the "Gossip Tide" zoo comp from 140 (ratatoskr_v1, huldra_v1, kraken_v1), which measured strongest of the three proposed comps in the 2026-09-03 round robin (81, on an older build). 207c's per-fight read is where to check that Rootfall is not now much harder than the other two.

**The leader cards:** which card per Instinct is chosen after the deck lists, in the same session. Henry (2026-10-08): *"Not sure yet."*

### How the slots are placed (proposal, for the engine row)

Six slots, three required Instincts. Draw which of fights 1 and 2 gets two of the required Instincts and which gets one (seeded), place them, then roll the remaining three slots from the pool as today. A fight never holds all three required Instincts (a rolled slot in the fight that already has two may not roll the third), so neither can match the leader's trio. A required species need not be in the run's biome pools; it is placed, not drawn. `drawSpecies`'s no-repeat-in-a-fight rule still holds.

## Open questions for the session

1. ~~**Swap or add**~~ Answered 2026-10-08: **case by case**, decided per leader card in the session.
2. **Which card per Instinct:** after the deck lists (*"Not sure yet let's pick the Mingmings first"*).
3. Do the leader's decks follow the same card-count rules as a player deck?

## 207a draft: deck lists and leader-card options (2026-10-08)

Henry: *"Can you generate the deck lists now. Also for the fire gym huldra isn't the only one attacking using burns. The zoo deck also will want something to scale on dazed. Generate the decks using in game cards and propose two special leader cards for each instinct so I can choose one."* Review page: https://claude.ai/artifact/SYvty7NsjXim27PxUMnmGF (Henry picks A or B per Instinct there).

Every deck card is from the v2 run pool (`v2RunPool`). Leader cards were scored with `calculatePowerscale` (run directly, not a port) against the ±15% band. No battles were simulated.

| Gym | Member | Deck (10) |
|---|---|---|
| Emberfall | fenrir_v2 | ignite ×2, ember_jab, snarl, slag_strike, molten_core, ember_ward, cinder_lance ×2, flashover |
| Emberfall | skoll_v2 | ember_jab ×2, scald, brand ×2, flare_burst, pack_tactics, inferno, heat_wave, thermal_overload |
| Emberfall | huldra_v2 | heartwood ×2, shell_share, iron_bark, molten_core ×2, inferno, cinder_armor, bark_lash, bark_smash |
| Tidewrack | kraken_v2 | tide_pool ×2, surge_protection, spreading_rot, capacitor, tidal_battery, contagion, boiling_surge, hydro_blast, tidal_wave |
| Tidewrack | jormungandr_v2 | poison_injection ×2, corrosive_leak, corrosive_bolt ×2, tide_pool, serpent_flurry ×2, venom_fang, contagion |
| Tidewrack | fenrir_v1 | war_pact, desperate_strike, fury_strike, flare_burst ×2, glass_cannon, ragnarok_edge, unbound_fang, pack_tactics ×2 |
| Rootfall | ratatoskr_v1 | acorn_toss ×2, heckle ×2, forage ×2, nagging_bite, hoofbeat, seed_bomb ×2 |
| Rootfall | huldra_v1 | tend ×2, pollen_cloud, bolster, thorn_whip, nagging_bite, verdant_ward, pile_on, slander ×2 |
| Rootfall | kraken_v1 | undertow ×2, blind_spot ×2, whirlpool ×2, pressure_point, deep_scan, serpents_coil, ink_cloud |

Leader-card options (A / B), score against band:
- fenrir_v2: **Muspel Brand** 1e (15 power, 1 Burn, +1 Burn if you hold Sharp; on curve) / **Smoke and Cinders** 1e (1 Burn and 1 Weakened to each enemy; −7% at 3v3)
- skoll_v2: **Ember Fangs** 1e (1 Burn, then 10 power twice; −3%) / **Chase the Sun** 2e (15 power ×4; −14%, scorer blind to Sunscorch)
- huldra_v2: **Smoldering Bark** 1e (6 Bark Shield, 1 Burn; +3%) / **Kindling Grove** 2e (20 power + 1 Burn to each enemy; −9% at 3v3)
- kraken_v2: **Floodgate** 2e (1 Poison to each enemy, gain 2 Energized; on curve at 3v3) / **Pressure Front** 2e (40 power, gain 1 Energized; +3%)
- jormungandr_v2: **Midgard Venom** 1e (1 Poison, gain 1 Energized; +17%) / **Coil and Strike** 2e (2 Poison, then 15 power ×3; −23%, scorer blind to Venomfang)
- fenrir_v1: **Unchained** 2e (15 power ×4; −14%) / **Gleipnir Breaks** 1e (15 power ×3, lose 5% max HP; +7%)
- ratatoskr_v1: **Rumor** 0e (3 power ×2, 1 Dazed; −8%) / **Up the Trunk** 1e (10 power per card you played, 1 Dazed; on curve)
- huldra_v1: **Bewitch** 0e (1 Dazed, gain 2 Sharp; −8%; the self-buff triggers Glamour) / **Hulder's Gaze** 1e (10 power +10 per Dazed; manual price)
- kraken_v1: **Ink Flood** 1e (draw 1, 2 Dazed; −7%) / **Deep Current** 2e (20 power per card you played, draw 1; −3%)

Findings raised with the draft: ROOT ROT (Poison) does nothing for the new Rootfall team and TIDAL SURGE (cards played) suits it better than Tidewrack's ramp; Burn skips type advantage, so Emberfall's Water counter gets no edge against most of its damage; the Rootfall trio was the strongest comp in the 2026-09-03 round robin.

### Henry's picks and comments (2026-10-08, review page v2)

Leader cards picked: fenrir_v2 **Flame Wave** (his own card, replacing both options: "1 burn plus damage to whole side"; drafted as 1e, 5 power to each enemy + 1 Burn to each, 3.1 of 3.0 at 3v3; a 2e/25-power version scores 7.5 of 7.0), skoll_v2 **Chase the Sun**, huldra_v2 **Smoldering Bark**, kraken_v2 **Pressure Front**, jormungandr_v2 **Coil and Strike**, fenrir_v1 **Gleipnir Breaks**, ratatoskr_v1 **Rumor**, huldra_v1 **Bewitch**, kraken_v1 **Deep Current**.

Comments applied to the draft:
- huldra_v2: *"Too many molten cores not enough bark shield"* → molten_core ×2 becomes ×1, shell_share ×1 becomes ×2.
- kraken_v1: *"Missing crushing depth here"* → crushing_depths in ink_cloud's slot (open: or on top, to 11).
- Totems: *"Switch the totems"* / *"Change to rootrot"* → Tidewrack takes ROOT ROT, Rootfall takes TIDAL SURGE.
- Emberfall: *"Change this totem to give more damage on overflow for burn"* → WAR FOOTING is replaced by a Totem that makes this side's Burn detonations deal more (proposed +5% of max HP, 14% → 19%). Engine: `onStatusApplied`'s context does not carry the detonation (`overflow` is on the ledger record and the event bus only), so the hook needs a `burnDetonated`-style condition or a new trigger.
- kraken_v2: *"We should change this to add poison instead of burn"* (Boiling Surge) → 55 power + 3 Poison scores 7.3 of 7.0, the same as today. Open: boiling_surge is the payoff of the player's kraken_v2 start kit (loaded by Scald's Burn), so change it for everyone or give the gym a new Poison card.

Open before 207b: Flame Wave's cost, the new Totem's number and name, Crushing Depths swap-or-add, Boiling Surge global-or-new, and the add-not-swap default for fights 1 and 2.

### Final rulings (2026-10-08) and what shipped in 207b

Henry: *"1. Flame wave is good 2. 5% is good 3. Instead of ink cloud 4. New card and add 4 poison then fill with damage 5. Yes 6. Rename tidal surge and rootrot to something Norse and in the correct element"*.

- **Flame Wave** as drafted (1e, 5 power to the enemy side, 1 Burn to each).
- **SURTALOGI** (Emberfall, new): whenever this side makes an enemy's Burn detonate, the blast deals 5% more of its max HP (14% → 19%). Engine: `HookCondition.statusDetonated`, read off `HookContext.statusDetonations`, which `effectHandlers` sets at the `onStatusApplied` dispatch when the application crossed the cap; hook `ATTACK` actions may now carry `percentMaxHp` (the target's max HP). WAR FOOTING stays defined; no gym fields it.
- **Crushing Depths** in Ink Cloud's slot (kraken_v1).
- **Eitr Surge** (new, 2e Water: 40 power, 4 Poison; 7.0 of 7.0) in the gym Kraken's deck in place of Boiling Surge, which the player's kraken_v2 keeps unchanged.
- Leader cards are **added** to the usual deck in fights 1 and 2.
- Totems moved and renamed (ids keep their names, ticket 183's rule): Tidewrack fields `driver_root_rot`, shown as **ÉLIVÁGAR** (the venom rivers; Water); Rootfall fields `driver_tidal_surge`, shown as **YGGDRASIL'S WRATH**, its blast now Nature. `tiers.json`'s leader-Driver table follows.

Shipped in `d7a5a75`: `bosses.ts` (members with `deck` and `leaderCard`, `leaderDeckFor`, `leaderMemberFor`), `gymLeaderPlacement.ts` (one fight gets two leader Instincts, the other one, drawn once per gym visit from the node seed), `gauntlet.ts` (the leader's authored deck; placed leaders with their card; rolled bodies never run a leader Instinct), ten new cards in `programs.json` (all outside the run pool, so no reward, shop or codex shows them), the Totems in `hooks.json`. Tests: `gymLeaderPlacement.test.ts` (12 seeds × 3 gyms: each leader Instinct once across fights 1–2 with its card, never the trio; decks of 10 with no card more than twice; leader cards outside the pool and codex; the tier table agrees), `surtalogi.test.ts` (fires only on a detonation, adds exactly 5%, never for the other side's detonations), and the gym pins updated. Re-pinned on purpose: `aiDeterminism` fights 11, 12, 14, 15, 17, 18. The harness's counter-answer tables swapped Tidewrack and Rootfall with their teams; Emberfall's (hamstring, discharge, reactive_plating) were picked against WAR FOOTING and are open for Henry. Not changed: the scout still fields the leader's bodies on their tuned decks.

Run in the VM: every `src/engine` and `src/debug` test except ghostWalk's four-tier gauntlet block and `overnight.test.ts`, the label and store tests, `tsc`, eslint on the changed files. Henry's `npm run gate` is the full check.

### Follow-up rulings (2026-10-08, later) — `2f03045`

Henry: *"These leader cards can appear and are all rare cards. 1. Keep the names 2. Yes pick new ones and if we don't add something to remove burn and a new aura to get energized if a burn overflows 3. No keep the decks"*.

- **Leader cards are Rare pool cards.** Each joins its own Instinct's species pool (a seventh card), so a party running that Instinct can be offered it; they count in the codex. Eitr Surge is findable too (Henry, 2026-10-09: *"All cards need to be findable like eitr surge"*): it joined kraken_v2's pool. Every card ticket 207 printed is now in the run pool.
- **Totem names kept:** SURTALOGI, ÉLIVÁGAR, YGGDRASIL'S WRATH.
- **Emberfall's answers:** nothing in the pool removed Burn, so two neutral cards were printed for the shop's guaranteed slot: **Quench** (0e neutral Skill, aimed at an ally: remove 2 Burn and 2 Poison) and **Sindri's Forge** (2e neutral Aura: whenever a Burn detonates on one of your Mingmings, it gains 1 Energized). Numbers as Henry set them later the same day (`5fdb093`): *"Just 1 energized"*, and Quench *"0e and be 2 burn and 2 poison off. Otherwise it doesn't have a lot of utility"*. The harness answer list is Quench, Sindri's Forge, Hamstring; the two-card selective list is Quench and Sindri's Forge. Tests in `emberfallAnswers.test.ts` count the stacks.
- **The scout keeps the species' usual decks.**
- Re-pinned on purpose: ghostWalk's four default walks and draftPolicy's two (the pools changed the offers). After the 2026-10-09 merge, draftPolicy's kraken_v1 walk moved again (to `6ff0949311533343`) because 202b's revive changes how its gauntlet plays out; `norseFlavourNames.test.ts` now lists the renamed Totems. runWalker's determinism walk moved to seed `t40:determinism:b` because the old seed now reached the gauntlet (2 min 17 s a walk on the VM). Note: ghostWalk's default-walk block now takes ~115 s on the VM (was ~15 s) because its kraken_v1 walks reach the gauntlet; the gate still passes.

## Rows

| Row | What | State |
|---|---|---|
| 207a | Design session: the three teams (**picked 2026-10-08**), their deck lists (drafted against Henry's plan per gym, then he reviews), and the nine leader cards | **Done 2026-10-08**: teams, decks, leader cards and Totems ruled (below) |
| 207b | Engine: authored decks and leader cards in the gym table; fights 1 and 2 place the three leader Instincts (each at least once, never the full trio in one fight) with their leader cards; scout and Driver preview read the table; tests pin each gym's team, deck and placement rule | **Shipped 2026-10-08** (`d7a5a75`) |
| 207c | Measure on 211a's bench: the base arm, and the loss rate per fight (fight 3 should be the highest) | After 207b and 211a |

## Interplay with 211

211 picks the gym's setting (IVs, heal, revive) on the bench. This ticket changes the teams that setting is applied to, so (Henry, 211 D4) 211's arms run after this lands.

## Decisions for Henry

1. ~~**D1, fights 1 and 2:**~~ Answered 2026-10-08: a leader card for each Instinct; all three Instincts appear at least once in fights 1 and 2; neither fight is the leader's exact trio; the rest stays rolled.
2. ~~**D2, swap or add:**~~ Answered 2026-10-08: case by case.
3. ~~**D3, the teams:**~~ Answered 2026-10-08: the table above.
4. ~~**D4, the deck lists:**~~ Answered 2026-10-08: reviewed on the page, with his comments applied (Huldra v2's Bark Shield, Crushing Depths, Eitr Surge).
5. ~~**D5, the leader cards:**~~ Answered 2026-10-08: the nine picked above (Flame Wave his own).
6. ~~**D6, Emberfall's counter answers:**~~ Answered 2026-10-08/09: Quench and Sindri's Forge, printed as neutral pool cards.

## Resolution

Open for 207c only: measure the new gyms on 211a's bench (base arm, loss rate per fight; fight 3 should be the highest). Every design decision is answered. 207c and 211c share the same bench run.
