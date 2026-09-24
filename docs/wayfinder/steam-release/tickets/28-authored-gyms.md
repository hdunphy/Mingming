# Authored gym bosses: curated 3v3 teams with signature firmware per biome pair (ticket 28)

> **2026-09-24 — RE-SCOPED. The gyms ARE authored (`bosses.ts` AUTHORED_BOSSES: WAR FOOTING / TIDAL SURGE / ROOT ROT); the 1.5× warden frame, `boss_relic_*` and "signature firmware" are gone (a Driver now); deck-archetypes 109 is closed. DEFECT: `gyms.ts` GYM_REGISTRY.leaderComp (142b placeholders) disagrees with AUTHORED_BOSSES at every gym, and the scout previews leaderComp while the gauntlet fields AUTHORED_BOSSES — the free look shows a team the gym does not field. **28a (Legion): one table.** Henry ruled "bosses, but whichever trio has the better synergies (zoo / control / ramp)". Recommendation from the 158 partner tags and the 162c 3v3 read: Emberfall = fenrir_v2 + sköll_v2 + kraken_v2 (detonation, 80%); Tidewrack = jormungandr_v1 + kraken_v1 + ratatoskr_v1 (water-engine, 70%); Rootfall = huldra_v2 + ratatoskr_v2 + jormungandr_v2 (poison, 80%). Each keeps the gym's two own-element bodies plus one guest. Canary the three trios at 3 iterations (162c's n=10 is a smoke read) before locking, keep the authored OS/Driver lines, make the scout read the same table, and delete leaderComp. The remaining 28 work is names, flavour, icons.**

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [18](18-gauntlet-refit.md), [27](27-content-plan.md), deck-archetypes [109](../../deck-archetypes/tickets/109-3v3-pricing-and-canary.md)
- Phase: Content Complete

## Deliverable (sized by ticket 05: THREE leaders at EA launch, one per mono biome; Air's leader is the stretch)

Today's gym leader is `wardenPool[0]` at `maxHp × 1.5` with three generic moves. Author one boss per ruled gym (ticket 27): a named leader, a 3v3 team drawing one species per biome pair of that run (the team is assembled at run start from the three biomes, so "authored" means per-biome candidate lists + the leader's signature firmware), flavour text, a map icon. Difficulty by tier = meaner team + more elites + enemy Drivers, never bigger numbers. Every authored comp runs through `teamComps.ts` canary gates (FTK 0, no stalls) — the comps are designed by Henry with the deck-archetypes method; this ticket integrates, it does not design.

## Done when

All launch gyms authored, canary numbers recorded per boss comp, one session per 2–3 bosses.

## Resolution

_(open)_

