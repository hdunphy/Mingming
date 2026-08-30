# Tidewrack authored: the zoo leader under TIDAL SURGE (ticket 71)

- Type: wayfinder:task
- Status: closed
- Assignee: legion-71
- Blocked by: [68](68-boss-redesign-drivers.md) (pattern + machinery), [70](70-first-ko-snowball.md) (death-Energized rule ships first so the measure includes it)
- Phase: Vertical Slice

## Henry's authoring (2026-08-29 session)

**TIDEWRACK (Water gym) fight 3:** jormungandr_v1 (OUROBOROS_LOOP) + kraken_v1 (ABYSSAL_INK_SYS) +
skoll_v2 (SOLAR_OVERDRIVE) — real tuned decks and OSes, per the 68 pattern. The zoo core (card-count
+ draw engines) with a Str-scaling Fire closer; skoll_v2 is the counter to the expected Nature
counter-team, and deliberately NOT ratatoskr (a Nature third would give the Nature player team
nothing to fear). Skoll fielding v1 at Emberfall and v2 here is intended (leaders build differently).

**Driver: TIDAL SURGE** — *"Every 10 cards this side plays, it deals 10 power to the enemy side."*
Proc-visible: the counter renders filling (e.g. SURGE 7/10). Boss side plays ~5-7 cards/turn, so it
fires every 1.5-2 turns; numbers tune in 5s after measurement. Rejected alternatives, recorded:
0e-cards-+1-power (invisible, ~+3-4 power/turn) and Energized-per-10-cards (signal-collides with the
death-Energized rule).

**Intended counter** (for the gate's record): Nature — the only launch element with Weakened, which
is maximally efficient against many small hits; plus the ticket-69 toolbox (riptide et al).

## Build steps

1. **Hook capability: cumulative side-level cards-played counter with a threshold trigger** (the
   per-turn CARDS_PLAYED scaling is not it). Same size of addition as WAR FOOTING's turn condition.
2. `driver_tidal_surge` in hooks.json (never `boss_relic_*`); `liveness.ts` after the edit.
3. Tidewrack's gauntlet fight 3 becomes the authored trio; her old relic team retires. Rootfall is
   ticket 72 — do not touch it here.
4. Offer screen states TIDAL SURGE on the Tidewrack offer; her region's final elite runs it
   unmodified; elite DROP wiring still waits on ticket 16.
5. Measure (report-only): `gauntlet:fight2 --gym gym_tidewrack`, favourable + control, 60 each,
   WITH the death-Energized rule live. Report into the 67 research doc's running sections.

## Done when

Gates green, Tidewrack migrated, telegraphed, measured, HANDOFF State refreshed.

## Resolution

**CLOSED 2026-08-30 (LEGION).** Tidewrack is authored, telegraphed, and carries TIDAL SURGE. The
measurement is handed to Henry to run — see "Measurement, outstanding" below.

### 1. The new hook capability: a SIDE counter scope

The ticket asks for *"a cumulative side-level cards-played counter with a threshold trigger"*. The
counter machinery already existed (`COUNTER` actions, `counter`/`counters` conditions); what did not
was a **scope that means "this party"**. Both existing scopes are wrong here, and wrong in ways that
read as tuning rather than as bugs:

- **`OWNER`** (`key:entityId`) gives each of the three members a private count, so a 10-card Driver
  fires at about 30 cards — "the surge feels weak";
- **`GLOBAL`** (the raw key) shares the count with the *opponent*, so the player's own cards charge
  the boss's Driver — "the surge fires at strange times".

So `CounterScope` gains **`'SIDE'`**, resolving to `key@PLAYER` / `key@ENEMY`.

**It is a separate function (`resolveSideCounterKey`) rather than a third branch of
`resolveCounterKey`, deliberately.** A side cannot be derived from an entity — `IBattleEntity` has
no side field, by design; which party an entity is in is a fact about the *state*. Folding SIDE into
the existing function would mean an optional `state` parameter that silently degrades to an
owner-scoped key when a caller forgets it, which is precisely the failure mode `HookSchema`'s
comments keep warning about. A separate function with a **required** state parameter makes the
compiler ask.

Both call sites — the write (`HookFactory`) and the read (`ConditionValidator`) — branch on it, and
a test asserts they resolve to the *same* key, because if they ever disagreed the counter would
climb forever and the threshold would never fire.

`HookSchema` gained `'SIDE'` in all three scope enums. Omitting that would have had zod **reject**
the hook, not strip it — the noisier of the two failure modes, for once.

### 2. TIDAL SURGE

`driver_tidal_surge` in `hooks.json`, two hooks on `onActionEnd` (which fires once per program, not
once per action — a multi-hit card counts as one card):

- `driver_tidal_surge_count`, priority **91** — `COUNTER ADD 1`, scope SIDE.
- `driver_tidal_surge_fire`, priority **90** — `when counter GTE 10` → `ATTACK ENEMIES power 10
  Water`, `COUNTER RESET`, `LOG`.

**The priorities are load-bearing**: count must run before fire or the tenth card is counted after
the check and the surge lands one card late, every time. A test pins the ordering rather than the
numbers.

### THE BUG THIS ALMOST SHIPPED WITH, AND WHAT CAUGHT IT

Written without `"target"` on the COUNTER actions, the Driver **looked completely healthy**: the
hooks registered, the schema validated, `getHook(...)` returned functions, the ATTACK landed and the
LOG printed. Every structural test passed.

The counter never moved. `HookFactory.executeActions` skips any non-`LOG` action whose target does
not resolve, and a `COUNTER` with no `target` resolves to nothing — silently, with no warning and no
schema complaint. Every other COUNTER action in `hooks.json` carries `"target": "SELF"`; this one
did not, so TIDAL SURGE would have dealt its damage on the first card played and never again.

**It was caught by an end-to-end probe, not by the eleven structural tests.** Worse, the first
version of the end-to-end test asserted only that *player HP fell* — and it PASSED, because another
hook on the same trigger was doing the damage. The assertion that actually found it was on the
counter. `liveness.ts` does not cover this: it sweeps OS firmware, not Drivers.

A regression test now asserts every COUNTER action in the Driver carries a target.

### 3-4. The trio, the telegraph, the carry

`AUTHORED_BOSSES.gym_tidewrack` = jormungandr_v1 + kraken_v1 + skoll_v2 under TIDAL SURGE, per
Henry's authoring. The telegraph and the final-elite carry both read the authored table
(`gauntlet.gymSignatures` → `describeDriver`, and `encounter.gymDriverForNode`), so **authoring the
gym wired both with no new code** — asserted rather than assumed, including that elites *outside*
the gym's own biome correctly get nothing.

### The fallout: nine tests used Tidewrack as their "un-authored gym"

Authoring the second gym broke nine tests across five files, all the same shape — they needed a gym
that still fields the formula boss and Tidewrack was it. Repointed to **`gym_rootfall`**, the last
one left. **Ticket 72 authors Rootfall, at which point there is no un-authored gym and these tests
are deleted with the relic firmware rather than repointed a third time.**

One did not repoint: `RunScreen`'s *"shows the next opponent as TYPES"* read the run's **biome**
elements, which only equalled the opponent list because every gym used to roll one species per
biome. An authored gym fields a fixed trio, so Tidewrack's Nature biome now contributes nobody. It
asks `gauntletOpponentElements` what the fight will actually field — which keeps the test about the
visibility rule and makes it correct at both kinds of gym.

### Measurement, OUTSTANDING — and why it is not in this commit

The ticket asks for `gauntlet:fight2 --gym gym_tidewrack`, favourable + control, 60 each, with the
Bereavement Rally live. **That is roughly 80 minutes and it cannot run here**: this agent's cloud
container reclaims background processes during idle gaps, and it has already killed two long runs
(the ticket-68 re-measure at 26/60, and a snowball run at pair 5 of 30). It runs on Henry's machine:

```
npm run balance:run-gate -- --bands gauntlet --gym gym_tidewrack --matchup favourable --iterations 60
npm run balance:run-gate -- --bands gauntlet --gym gym_tidewrack --matchup control    --iterations 60
```

Ticket 72 needs the same for Rootfall and a re-measure of Emberfall, and reports the three-gym table
together — so running all six arms in one sitting is the efficient order.

### Gates

`tsc --noEmit -p tsconfig.app.json` clean, `eslint .` at 0, `liveness.ts` re-run after the hooks.json
edit (all firmware LIVE), full suite green.
