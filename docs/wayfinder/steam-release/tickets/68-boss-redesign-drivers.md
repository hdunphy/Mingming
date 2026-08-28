# Boss redesign: enemy-side Drivers, hand-authored gym trios, the telegraph (ticket 68)

- Type: wayfinder:task (rulings recorded; build steps below are agent work)
- Status: open
- Assignee: 
- Blocked by: [67](67-enemy-ladder-and-bands.md) (context: SS12 isolation numbers), ticket [16](16-drivers.md) for the DROP wiring only
- Phase: Vertical Slice

## Why this exists

SS12 of [research/67-gate-validity-and-the-power-ceiling.md](../research/67-gate-validity-and-the-power-ceiling.md)
isolated the gym-boss wall: halving `BOSS_IVS` buys **1.7pt**, switching the `boss_relic_*` hooks
off buys **58.3pt**. The relic stack was the wall. Independently, Henry reviewed the relic system
in session on 2026-08-27/28 - it had never been through him - and redesigned the boss fight from
first principles. This ticket records the rulings and carries the build.

## Henry's rulings (2026-08-27/28 session - supersede ticket 18's boss firmware design)

1. **`boss_relic_*` is RETIRED as a concept and a naming.** Enemy passives are **DRIVERS** - the
   same concept and the same side-level machinery as the player's Drivers (macros-and-drivers.md),
   never "relics", never "protocols". Ticket 60's gauntlet rung *"kit + OS + Driver"* is now
   literal. The standing naming law extends: neither side's Drivers are ever called relics.
2. **Boss teams are hand-authored per gym, not formula-drawn.** Each leader fields a trio of real
   species running their REAL tuned decks and tuned OSes (members keep their OSes; the Driver is
   additive, not an OS replacement). One enemy-side Driver per fight, side-scoped.
3. **Composition guide** (authoring heuristic, not a formula): two decks of the leader's own
   element plus one member countering the player's expected counter-team ("counter to the
   counter" - in the EA cycle that third element is the leader's prey element).
4. **Telegraph, both ways.** The gym-offer screen states the leader's Driver (name + rule text) at
   run start, before the party is chosen. The region's FINAL elite - the one guarding the
   gauntlet approach - RUNS the gym's Driver, unmodified (Claude's default; Henry may still weaken
   it). Elites DROP a random player Driver (dep: ticket 16) - the preview and the prize are
   deliberately decoupled. Enemy signature Drivers never enter the player pool.
5. **EMBERFALL (Fire gym) is authored:** fenrir_v1 (UNBOUND_KERNEL) + skoll_v1 (TREACHERY_KERNEL) +
   ratatoskr_v2 (INSTIGATOR). Driver: **WAR FOOTING** - *"At the end of this side's turn, every
   member gains 1 Strengthened. From turn 4 on, 2."* (escalating aura; Str is +1 power/stack,
   uncapped, in the live status economy). Intended counter, for the sim gate's record:
   control-leaning 2 Water + 1 Fire. Design note: skoll_v1 punishes wide chip (zoo feeds it) -
   deliberate; the first fight in the game that pushes back on the dominant zoo comp.
6. **Tidewrack and Rootfall: NOT yet authored** - next design session. Until then those two gyms
   keep the ticket-18 boss team and relic firmware AS BUILT, so exactly one gym migrates per
   session and diffs stay readable.
7. Standing constraints re-affirmed: boss AI grade stays full lookahead (67 R2); `BOSS_IVS` stays
   an authored knob (SS12 says it is nearly inert against the old relics; re-check against the new
   Driver); the gauntlet end-to-end target stays deferred (67 R3) until the rebuilt Emberfall is
   measured.

## Build steps (agent - no design decisions inside)

1. **Enemy-side Driver machinery.** `createBattleState`/`battleFactories` applies `setup.drivers`
   to the player side only; mirror the same side-level list for the enemy side (an
   `enemyDrivers` field on the setup, same registration path). No new passive system - reuse what
   the player side has.
2. **Hook capability: turn-number condition** (e.g. `when: { turnAtLeast: N }`) - needed for WAR
   FOOTING's escalation; add via `HookFactory` in the existing pattern and cover with a hook-wiring
   test. Run `liveness.ts` after every hooks.json edit (standing policy).
3. **WAR_FOOTING** as a hooks.json Driver entry (id `driver_war_footing`; NOT `boss_relic_*`):
   onTurnEnd, side-scoped, +1 Strengthened to ALLIES, +2 when turn >= 4.
4. **Emberfall's gauntlet fight 3** becomes the authored trio of ruling 5 for `gym_emberfall`
   (fixed `BOSS_IVS` unchanged); fights 1-2 unchanged. Tidewrack/Rootfall untouched (ruling 6).
5. **Offer screen** (ticket 10's gym-offer): show the leader's Driver name + rule text on the
   Emberfall offer; the other two offers show their existing relic text unchanged until authored.
6. **Final elite carries the region Driver** for the Emberfall region (encounter/elite wiring);
   drop wiring waits on ticket 16 and is OUT of this ticket.
7. **Measure, report-only:** rebuilt Emberfall `gauntlet:fight2` at `--matchup favourable` and
   `control`, 60 iterations each; plus prepared fights 0-1 if compute allows (~2h). Report as SS13
   of the 67 research doc, same format as SS10/SS12. No tuning; `BOSS_IVS` and AI tiers untouched.

## Done when

Machinery + WAR FOOTING in with tests green (`tsc -b`, vitest, build, lint at 0), Emberfall
migrated behind the rulings above, offer screen telegraphs it, SS13 numbers reported, HANDOFF State
refreshed. Tidewrack/Rootfall authoring sessions are NOT this ticket.

## Resolution

_(open)_
