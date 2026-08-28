# Boss redesign: enemy-side Drivers, hand-authored gym trios, the telegraph (ticket 68)

- Type: wayfinder:task (rulings recorded; build steps below are agent work)
- Status: closed
- Assignee: LEGION
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

**Built and measured 2026-08-28 (LEGION). Steps 1-7 all done; nothing tuned.** The ticket's two
design-shaped clauses are flagged below rather than decided.

### What shipped

| step | where |
|---|---|
| 1. Enemy-side Driver machinery | `engine/data/driverRegistry.ts` (new), `IBattleSetup.enemyDrivers`, `IRunEncounter.enemyDrivers`, `buildBattleSetup` |
| 2. `turnAtLeast` hook condition | `HookCondition`, `HookSchema`, `ConditionValidator` |
| 3. WAR FOOTING | `lib/hooks.json` `driver_war_footing` — two hooks, the second gated on `turnAtLeast: 4` |
| 4. Emberfall's authored trio | `engine/run/bosses.ts` (new), consumed by `gauntlet.rollGauntletFight` |
| 5. Offer-screen telegraph | `gauntlet.gymSignatures` + `ui/screens/RunStart.tsx` |
| 6. Final elite carries the Driver | `encounter.gymDriverForNode` |
| 7. The re-measure | research doc §13 |

**One function, two sides.** `driverRegistry.applyDrivers` is what `createBattleState` now calls for
BOTH `setup.drivers` and `setup.enemyDrivers`, so a Driver that works on one side works on the other
by construction — which is what ticket 16 will want when elites start dropping them. The three
Milestone 8.4 stat effects moved into it verbatim; the player's Drivers are unchanged.

**A Driver attaches hook ids to `IBattleEntity.hooks` and never touches `activeOS`.** That single
choice is the whole of ruling 2: a boss member keeps UNBOUND_KERNEL and gains WAR FOOTING on top,
where a relic used to overwrite the firmware and leave the deck resolving through a documented
fallback. An authored boss's deck now needs no fallback at all — it is the species' real tuned list.

`boss_relic_*` is NOT deleted. Ruling 6 keeps Tidewrack and Rootfall exactly as ticket 18 built them,
so both shapes are live and both are pinned by tests.

### The numbers (research §13)

| arm | result | vs the 0/60 it replaces |
|---|---|---|
| Emberfall boss, **PREPARED** | 48/60 — **80.0%** (CI 68.2-88.2) | **+80.0pt** |
| Emberfall boss, **CONTROL** | 39/60 — **65.0%** (CI 52.4-75.8) | +65.0pt |
| all three gyms, prepared (unpinned) | 14/60 — **23.3%** | +23.3pt — and ≈ the 26.7% one-gym-in-three predicts |
| Emberfall fight 1 / fight 2, prepared | 83.3% / 90.0% | (were 68.3 / 81.7, blind, un-authored) |

**The wall is gone and the fight overshot.** Against a 60% target the control arm passes at 65.0% and
the prepared arm — the one Q3 grades — is 15 points high. The three fights now read 83.3 / 90.0 /
80.0 where they read 68.3 / 81.7 / 3.3, so the cliff became a gauntlet; compounded that is 60.0%, and
an upper bound, because the harness fights each from full HP.

**FOR HENRY, R2's successor question:** 80.0% prepared is a number, not a verdict. The unturned
levers are `BOSS_IVS` (ruling 7 explicitly asks for it to be re-checked against the new Driver, and
that re-check has NOT been run), WAR FOOTING's numbers, the authored composition, and the 60% target
itself — which was set against a boss nobody had designed.

**Also for Henry: WAR FOOTING's escalation barely fires.** The fight averages 4.1 turns and the
clause starts at turn 4, so in most battles the Driver is worth 1 Strengthened a round and *"from
turn 4 on, 2"* is decoration. Built, tested and live; just not part of the measured difficulty.

### Two readings this ticket had to make, both isolated to one function

1. **"The region's FINAL elite - the one guarding the gauntlet approach" has no such node.**
   `REGION_PARAMS` makes each biome's exit an elite EXCEPT the last, whose exit is the gym itself, so
   the final biome's elites are middle nodes rolled from the weighted pool — there may be two, one or
   none. Implemented as **the elites in the gym's own biome** (`encounter.gymDriverForNode`), because
   they are literally the fights standing between the player and the gauntlet and they serve the
   stated purpose — meet the rule before the boss does. The runner-up reading was *biome 1's exit*,
   which is guaranteed and unavoidable but a whole biome away. **Cost of the choice:** a graph can
   roll a final biome with no elite at all, and that run gets the offer-screen half of the telegraph
   only. Flipping to the other reading is that one function and nothing else.
2. **`--boss-relics off` now follows the Driver.** The §12 flag meant "the boss without its signature
   passive", and ticket 68 moved where an authored gym keeps that passive. Left pointing only at
   `boss_relic_*` it would have silently measured the boss WITH its signature and reported it as
   without. The flag's question is unchanged; only its reach is.

### What was NOT done, deliberately

- **No tuning of any kind.** `BOSS_IVS`, the AI grade, the elite rung, the wild rung: untouched.
- **Tidewrack and Rootfall** keep ticket 18's boss (ruling 6).
- **The elite DROP wiring** is ticket 16's and is explicitly out of scope (ruling 4 / step 6).
- **The elite band was not re-measured** under the new final-elite Driver — one cell,
  `elite:biome2 --gym gym_emberfall`, ~15 min at 100 iterations.

### Report to the design agent

[research/68-what-the-boss-redesign-asks-of-the-cards.md](../research/68-what-the-boss-redesign-asks-of-the-cards.md)
— written for the deck-archetypes map, because **the Q2 anti-boss card brief was aimed at a fight
that no longer exists**. It carries the redesign, the numbers, which rows of Q2's counter-lever table
are now dead (and which are alive at two gyms until their own sessions), the two constraints the new
fight imposes (WAR FOOTING is worth 3-5 stacks at a 4.1-turn fight length; anti-boss cards have to be
good on the turn they are drawn), and one finding worth the rest of the document: **the only launch
species that can cancel WAR FOOTING with Weakened is ratatoskr, and ratatoskr is on the boss's side.**
A player who brings the counter-team the type chart tells them to bring has no access to the
mechanical answer to the fight's central rule.

### Gates

`tsc -b`, `eslint .` (0), `vite build`, `assert-no-debug`, and `liveness.ts` (STATIC findings: none —
the sweep now covers `DRIVER_IDS` as well as the OSes, so the next authored gym's Driver is checked
without anyone remembering to). Suite **1825 green across 130 files** (1790 -> 1825).

No assertion was weakened. The tests that pinned ticket 18's boss were **repointed at Tidewrack**,
where that shape is still the truth, and the authored shape got its own block: `gauntlet.test.ts`
(the trio, its own OSes, its real deck, one Driver, fights 1-2 still rolled, the other gyms
undisturbed), `driverRegistry.test.ts` (the clock condition through the zod parse, and WAR FOOTING
playing real turns — 1, 2, 3 then 5 stacks, side-scoped), `hookWiring.test.ts` (the Driver survives
`createBattleState` additively), `encounter.test.ts` (the final-elite rule, and that it changes
nothing else about the rung), `RanchScreen.test.tsx` (the telegraph, both gym shapes, and that no id
leaks as a label).
