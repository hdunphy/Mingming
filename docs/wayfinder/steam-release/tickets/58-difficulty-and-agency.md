# Difficulty and agency: the playtest verdict on the slice (ticket 58)

- Type: wayfinder:grilling
- Status: closed
- Assignee: wayfinder (Henry grilling session, 2026-08-22)
- Blocked by: [25](25-vs-playtest.md) (in spirit — this IS the first slice playtest's findings), [56](56-economy-numbers.md)
- Phase: Vertical Slice

## Question

Henry's first slice runs were "incredibly hard" and team/deck building "felt really bad": Fenrir starts died twice in the fire biome (2v2 vs Skoll — Rat focus-fired dead by turn 2, then 1v2 unwinnable); a Gullinbursti game that piled 21 Sharp over several turns felt earned, not broken. Battles are fun when balanced. What changes make team building and deck building fun, and the difficulty honest?

## Diagnosis (agreed before the rulings)

- **The run math forbids fair fights.** The corpus is tuned 50/50 symmetric; a run is ~10 fights + a 3-fight gauntlet; 0.5^13 ≈ 0.02% run wins. Roguelikes work because the player has STRUCTURAL edges. The slice shipped the opposite: biome-2 wilds had full tuned kit + OS + full-lookahead AI against a half-assembled player deck padded with dead generics.
- The first KO snowballs (energy pool lost, AI focus-fires the squishiest frame), and ratatoskr's startKit carried none of his engine (seed_bomb/echo were untagged), making him pure feed.
- Henry's five proposals were graded, not adopted wholesale: move-only enemies REJECTED (discards the corpus; control comes from the AI ladder instead); "OP reward cards" REJECTED (power creep by construction; the edge comes from Macros/Drivers/AI grade); the rest shaped into the rulings below.

## Resolution — RULED (Henry, 2026-08-22)

1. **Tuning target (the new standing gate): 95% wilds / 75% elites / 60% per gauntlet fight** at tier 1, measured by simming representative mid-run player decks against each biome's actual wild loadouts. Run-win lands ≈ 50% at tier 1 — the friendly first-release read; tiers 2–3 carry the challenge. This is a regression gate: any content or rule change re-runs it.
2. **Start deck = the MINI-ENGINE 6** (supersedes ticket 08's 5+3): **4 tagged kit cards — the signature payoff + its 3 enablers — plus 2 generics.** Recruits arrive identically (supersedes 3+1). Team-building alone = 18 cards; picks/buys reach 20–25 with removal trimming generics. The ratified tag table is below.
3. **Enemy ladder (supersedes the kit-fraction-by-depth rule): wilds = full tuned kit, NO OS, GREEDY AI; elites = kit + OS, LITE AI; gauntlet = kit + OS + Driver, full lookahead.** Difficulty is loadout + AI grade, never stats; tier 2 turns wild OSes on, tier 3 raises wild AI to lite. (OS value measures +7…+80 points — no-OS is a big, honest, species-uneven handicap; the sim gate in ruling 1 absorbs the unevenness.)
4. **Telegraphing: DEFERRED to phase 2.** Full intents require pre-committed enemy turns (a shown prediction would lie whenever the player's turn changes the board — parity law). Pre-commit is a real engine change (committed action queue, retarget-on-death rule, UI); re-test difficulty after rulings 1–3 land, then decide. → fog.
5. **Agency: picks go to a run COLLECTION; the deck is edited freely at run start, workshops, markets, and the pre-gauntlet screen; minimum deck 16; mid-run assemblies go to party or BENCH; party re-arranged at the same friendly nodes; a benched species' kit cards leave the deck but stay in the collection.** Not editable after every node — 4–6 edit points keep picks meaningful. ("Remove Rat for the fire biome" is now a workshop decision, not a death sentence.)

### Ratified mini-engine tags (replace ticket 09's table; `startKit` = these 4, arrival = them + 2 generics)

| deck | payoff | enablers |
|---|---|---|
| fenrir_v1 | ragnarok_edge | blood_rite, berserk_rush, battle_rhythm |
| fenrir_v2 | pyre_sacrifice | ignite, ignite, molten_core |
| skoll_v1 | sun_devourer | fury_strike, fury_strike, brute_force |
| skoll_v2 | overdrive | fury_strike, fury_strike, strength_burst |
| kraken_v1 | ink_stream | undertow, whirlpool_v2, pressure_point |
| kraken_v2 | hydro_blast | capacitor, capacitor, surge_protection |
| jormungandr_v1 | ink_stream | undertow, undertow, serpents_coil |
| jormungandr_v2 | contagion | corrosive_bolt, corrosive_bolt, toxic_surge |
| ratatoskr_v1 | seed_bomb_v2 | forage, forage, echo_chamber_v2 |
| ratatoskr_v2 | crippling_vine | pollen_cloud, pollen_cloud, nagging_bite |
| huldra_v1 | hexbloom | growth, iron_bark, thorn_tithe |
| huldra_v2 | blightbloom | sap_vigor, thornguard, thornguard |

Watch item, not a change: uncapped Sharp piles (21 stacks in the 2v1) felt fair at this pace; re-check under the new win-rate gate before touching it. Ticket 59 applies all of this; ticket 25's next round re-measures the felt difficulty.
