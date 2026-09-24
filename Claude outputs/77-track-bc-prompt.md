# Ticket 77, Tracks B + C — the player side in the graded arm (implementation prompt)

**Branch:** `steam-prep-september`. **Ticket:** `docs/wayfinder/steam-release/tickets/77-player-progression-arms.md`
(read it whole first, then `research/77-player-side-arms.md`, then HANDOFF). **Type:** harness build + arms,
**report-only**. Henry rules after. Author on every commit: `Henry Dunphy <hdunphy15@gmail.com>`. One commit per
track. Never `package-lock.json`. CRLF for engine `.ts` + `docs/wayfinder`; LF for tests, `src/debug`, json.

## Context in one paragraph

Track A (2026-09-02) showed that at the 18-card run-start deck every added card lowers the gauntlet win rate, so
"more cards" is not progression. Track B measures the two ruled run systems that add power **without a card slot** —
Macros and player Drivers — in the same graded arm; Track C measures three **shape** alternatives to ROOT ROT
(Henry's rule: no caps, no "once per turn"; a nerf changes the trigger geometry). Ticket 16 has since shipped all
eight player Drivers as `driver_*` in `hooks.json` on `applyDrivers`, with `playerDrivers.test.ts` proving each
fires, and ticket 17 stamps them as elite stakes — so B2 needs **no new Driver**, only a harness flag. The canary
(`npm run balance:drivers`) is a 1v1 rate census; it is NOT this ticket's instrument. This ticket grades the
**gauntlet compound** (67 R5), bare arm (75 R2), Rally live, `--matchup favourable`, paired seeds.

## Conditions, identical for every arm

`npm run balance:run-gate -- --bands gauntlet --gym <gym> --matchup favourable --iterations 60 --out <file>`
plus the arm flag. **Re-take the bare row the same day on the same tree** for each gym before any arm; do not reuse
research/76 or /77 rows. Long runs go on Henry's machine with `--out` (Node block-buffers stdout; the container
reclaims idle processes). Every cell line prints what Track A added: payoff casts/fight, dead-card %, deck size,
both damage rates — plus, new here, **macros fired/fight** and **Driver procs/fight**.

## Track B1 — macros (build, then two arms × two gyms)

**Build** `src/debug/balance/macroPolicy.ts`. The screen fires a macro as a `PLAY_PROGRAM`-shaped action with no
card/hand/energy (`battleReducer.ts:42`, `canFireMacro`, `runSlice.consumeMacro`). The harness policy dispatches
the same action and is deliberately a **floor** on a human:

1. Before each player action: if any held damage macro's previewed damage (`computeDamagePreview`) is **lethal** on
   any enemy, fire it at that enemy.
2. On **turn 1 of the boss fight** (fight 3), fire every unfired macro: `surge` at the lowest-HP enemy, `cripple`
   at the highest-attack enemy, `mend` on the lowest-%HP ally.
3. At the start of any turn an ally is under 40% HP, fire `mend` on them if held.

Slots reset per gauntlet (three per run, not per fight — read `IRunState` macros; if the run model holds them
per-run, the policy holds them per-run). Flag: `--macros surge3 | mixed` → B1a = 3× `surge`, B1b = `surge` +
`cripple` + `mend`. Report macros fired per fight and *which* rule fired them.

**Threading guard:** add the `--macros` case to `optionsThreading.test.ts` (the `--toolbox` lesson — a flag that
prints in the banner but is not passed at `measureCell`'s `sampleFight` call measured the bare arm for 90 minutes).
Also assert the policy fires at least once in a fixed-seed fight (a zero-fire run reports VOID, not null).

**Arms:** B1a, B1b at **Rootfall and Emberfall**, n=60.

## Track B2 — player Drivers (flag only, then three arms × two gyms)

**Build:** `--player-driver <id>` on `balance:run-gate`, setting `run.drivers = [id]` before `battleSetup`
(`battleSetup.ts:91` already copies `run.drivers` onto the player side). Validate the id against `DRIVER_IDS`;
unknown id throws (no silent no-op). `optionsThreading.test.ts` case. Banner prints the Driver's text.

**Arms** (Henry's three hypotheses, one Driver each), Rootfall and Emberfall, n=60:

- `driver_antivenom` — the slot-free Rootfall counter. Compare against research/76's `scrubber`-the-card arm
  (p = 1.00, free): if the Driver moves the boss cell where the card did not, "counters must not be cards" is
  measured.
- `driver_tenth_strike` — the generic, lean-agnostic edge.
- `driver_element_<party lean>` — resolve from the favourable arm's lean (`driver_element_fire` at Rootfall,
  `driver_element_water` at Emberfall). This is the arm that asks whether type preparation can pay in the
  **rolled** lead-in fights, where 76 arm 3 showed it does not.

Optional if time allows, same cells: `driver_bulwark_reflex` (ticket 70's Q2a) and `driver_static_field` (the one
the canary flagged for compounding).

## Track C — ROOT ROT reshaped (knob, then three arms, boss cell only)

**Build:** a new knob *shape* in `experimentalTweaks.ts` — a **Driver hook substitution**, not a registry card
swap: `--tweak root-rot-c1|c2|c3` replaces `driver_root_rot`'s hooks for the run (validate + throw on unknown;
banner under NOT-A-BASELINE; `optionsThreading.test.ts` case — a new knob shape earns its own threading test).
Each candidate stays proc-visible (`proc: true`) and uncapped:

- **C1 Creeping Rot** — `onTurnEnd`, source SELF: every Poisoned enemy gains 1 Poison. (Per turn per body, not
  per application.)
- **C2 Spreading Rot** — `onStatusApplied` Poison, source SELF: **a different enemy** than the target gains 1
  Poison (needs a "random enemy other than context target" target — check `RANDOM_ENEMY` semantics; if no
  such target exists, say so and STOP rather than approximating).
- **C3 Festering** — `onDamageDealt` (or the nearest post-hit trigger) where the target has Poison, source SELF:
  target gains 1 Poison. Fires on attacks, not on Poison cards.

Keep ROOT ROT's SIDE-scoped re-entry guard on any candidate that applies Poison inside an `onStatusApplied`
hook (HANDOFF: an unguarded status-applying hook re-enters ~12 deep).

**Arms:** Rootfall **boss cell only**, `--cells` the boss, n=60, against the day's bare (was 56.7) and
`--boss-relics off` (was 83.3). A candidate succeeds if it lands **between** the two and the log shows it firing
every turn. Report procs/fight for each.

## Gates before any arm runs

`npx tsc -b`, `npx vitest run`, `eslint .` at 0, `npx vite build`. The three new `optionsThreading` cases must
FAIL if the flag is declared but not threaded (prove it once by commenting the threading out).

## STOP and report — do not work around

- Any card, Driver number, OS, deck list or `programs.json`/`hooks.json` printing change beyond the C1–C3
  substitution (which lives in the knob, never in the shipped `driver_root_rot`).
- C2's target cannot be expressed with existing hook targets.
- A macro fires from the policy on a state where `canFireMacro` would refuse it on screen.
- A bare re-take differs from research/77's Rootfall bare row (that row came back byte-identical last time; a
  difference means the tree moved under you — report which commit).
- Any arm VOID (zero procs / zero macro fires across n=60).

## Deliverable

`research/77-player-side-arms.md` gains a **TRACK B / TRACK C** section in the Track A format: the day's bare
rows, every arm with per-fight %, compound, McNemar vs bare (discordant pairs both ways), damage rates, payoff
casts, macros fired or procs per fight. Then the section Henry's session opens on:

1. Slot-free vs slot-cost: B1/B2 deltas beside Track A's (+3 cards = −9 to −31).
2. Antivenom-Driver vs scrubber-card at Rootfall's boss cell, paired.
3. Which of C1–C3 lands between 56.7 and 83.3, and its proc rate.
4. What you would put in front of Henry — three lines, numbers only, no lever moved.

Update the ticket (`## TRACK B + C REPORTED — <date>`), the map's 77 decision line, and HANDOFF's lead
paragraph. Commit hash, gate numbers, tree at start (`git rev-parse HEAD`), deviations. Report-only: **no
lever moves before Henry's session.**
