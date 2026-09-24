# Drivers: the 8 ruled party-wide passives (proc-visible) (ticket 16)

- Type: wayfinder:task
- Status: closed
- Assignee: 16-drivers (2026-09-11)
- Blocked by: [06](06-run-data-model.md), deck-archetypes [109](../../deck-archetypes/tickets/109-3v3-pricing-and-canary.md)
- Phase: Vertical Slice

## Deliverable

Implement the 8 ruled Drivers as party-wide hooks (a weaker OS for the whole party): Third Strike, Static Field (zoo-compounding flag), Antivenom, Overkill Recovery, First Blood, Element Drivers (one per element), Bulwark Reflex, Deep Cache. Law: PROC-VISIBLE — every Driver names a trigger moment and the UI flashes it when it procs; no invisible flat-% passives. Storage: `drivers` on `IRunState`, applied at battle creation the way `relics` are today in `battleFactories.ts:117-140` — then DELETE the 4-relic stub (`relicRegistry.ts`, `RelicTerminal.tsx`): Drivers supersede relics. Never call them relics.

**Blocked by deck-archetypes 109:** every Driver goes through the OS/daemon compounding canary before shipping; this ticket may implement behind a flag while 109 is open but cannot close until the check is run and numbers are recorded.

## Done when

8 Drivers implemented with proc VFX/SFX + tooltip, canary numbers recorded, relic code removed, tests green.

## Resolution

**Closed 2026-09-11.** All eight Drivers ship as `driver_*` entries in `lib/hooks.json`, every one
proven live by playing a card through `battleReducer` and reading what changed, every one PROC-VISIBLE
through a new `DRIVER_PROC` battle event that flashes the top-bar chip and floats the Driver's name off
the member it fired on. The four stat relics, `RelicRegistry`, `GetRelic`, `IRelic`, `relicBonuses`,
`buffer_cache`'s death-prevent branch, the 1.1x `attackMod`, `IRewardBundle.relicChoices`, the
gym-clear "choose one sector relic" pick and the ranch's relic grid are all GONE; `IBattleState.activeRelics`
is `activeDrivers`. Suite **176 files / 2,359 tests**, `tsc -b`, eslint 0, `vite build` +
assert-no-debug green. The compounding canary ran (below) and nothing degenerate came out of it.

### The numbers were Henry's, taken 2026-09-11, and two of them moved from the proposal

`macros-and-drivers.md` ruled the eight by SHAPE only. The proposal table was put to Henry and he
adjusted it in three places: **THIRD STRIKE is every 10th attack, not every 3rd** (*"third strike is too
often, it should be like every 10 attacks"* — the ruled name stays and now disagrees with its number;
renaming is his call, flagged not done); **STATIC FIELD is 2 power per card, not 8** (*"I worry 8 is too
much, let's try 2 power per card"*); **FIRST BLOOD is the PARTY's first attack card each turn, not each
member's** (*"the first attack card (entire party) does 1.2x"*). DEEP CACHE's un-ruled "small effect" was
put as four options and ruled **the drawer gains 1 Strengthened**. The gym-clear relic pick was ruled
**removed** (Drivers are ticket 17's elite stakes).

| Driver | proc moment | shipped |
|---|---|---|
| FIRST BLOOD | the first ATTACK card this side plays each turn | 1.2x (SIDE counter, reset at turn start) |
| THIRD STRIKE | every 10th ATTACK card this side plays | 1.5x (SIDE counter, reset on the payoff) |
| STATIC FIELD | every card this side plays | 2 power, `None`, to a random enemy — the seeded stream, byte-identical on a rerun |
| ANTIVENOM | end of this side's turn, each poisoned member | −1 Poison (Poison ticks at turn START since 126, so this is the whole end-of-turn difference) |
| OVERKILL RECOVERY | an enemy faints | each living member heals 8% max HP, one proc per member |
| <ELEMENT> DRIVER ×8 | an attack card of that element | 1.1x. `None` has no Driver |
| BULWARK REFLEX | a member drops below 50%, once per fight PER MEMBER | +15 Bark Shield (15% max HP) |
| DEEP CACHE | this side's first bonus (non-natural) draw each turn | the drawer gains 1 Strengthened |

**On "2 power".** Henry's aside — *"we scaled everything by 10 so 8 power is probably 20 damage"* — was
checked against `calculateDamage` rather than either of our memories: `floor(8 × power × atk/def) × 10 / 45`,
so at parity **8 power ≈ 14 damage and 2 power ≈ 3**. The HANDOFF's older claim that *"anything under ~8
power floors to nothing"* predates ticket 131c's `NUMBER_SCALE` and is stale; STATIC FIELD at 2 power is
small, not inert (31 procs a battle, below).

### How a Driver is built, and how it announces itself

A Driver is a `hooks.json` entry whose id starts with `driver_`; `applyDrivers` attaches its hook ids to
every member's `hooks` — ticket 68's machinery, unchanged, and the reason the whole build needed no
engine change beyond one event. Every payoff hook carries **`proc: true`** (declared in `HookSchema` —
HANDOFF 8c2, zod strips what it does not know) and `HookFactory.announceProc` emits
**`DRIVER_PROC { driverId, hookId, ownerId, fromPlayer }`** when such a hook passes its `when`. The event
carries the DRIVER, not just the hook, because `firmwareRegistry` now tells `createHook` which `driver_*`
entry a hook belongs to. Never inside the AI's search (`isSimulating`), and the bus is already muted under a
preview. UI: `BattleTopBar` re-keys the chip on each proc (a re-mount restarts the CSS animation; a class
toggle within one commit does not), `useBattleVfx` floats the name in the chip's violet, `driverProc` is a
two-note SFX. **The row now reads `battleState.activeDrivers`, not `run.drivers`** — the same list, but the
battle's copy is the one fighting and the only one a debug scenario has, which until 17 lands is the only
place a Driver can be tried (the launcher's RELICS pills are DRIVERS pills now, all fifteen).

### Every Driver was proven live, because three of this repo's Drivers were not

`src/engine/data/playerDrivers.test.ts`: sixteen probes, each a 3v3 with a chosen shared pile, the bare
arm and the driven arm on the same seed, a card played through the reducer, and the difference read off
HP / statuses / counters / the bus. First Blood boosts exactly the first attack and not the second, and a
second member's first attack is not a second First Blood; Third Strike boosts exactly the tenth and resets;
Static Field zaps on an attack AND a skill; the ICE DRIVER boosts `frost_jab` and leaves `radiant_spark`
alone; Overkill heals all three on a kill and NOT on an own faint; Antivenom takes one more than the tick;
Bulwark shields once per member and not the enemy; Deep Cache fires on the first triggered draw and never
the natural one. Plus `BattleTopBar.proc.test.tsx` (jsdom, ticket-58 harness): an event in, the chip
flashes, a second event flashes again, an ENEMY-side proc does not.

**One finding pinned rather than fixed: a hook-originated ATTACK runs under the triggering card's
`context.program`** (`AttackExecutor`: `program || { element }`). So STATIC FIELD's zap reads as "an Ice
attack card" to the ICE DRIVER's modifier and to FIRST BLOOD's, which boost the zap and proc a second time
on it. At 2 power that is at most a point of damage; the visible cost is a second float when both are held.
The semantics predate this ticket (riptide inherits the OPPONENT's card the same way), so it is a test
comment and this line, not a change. **Henry: is that compounding wanted?** If not, the modifier hooks need
a way to tell card damage from hook damage, which is an engine seam this ticket does not own.

### The compounding canary — `npm run balance:drivers`

New harness `src/debug/balance/driverCanary.ts` + `runDriverCanary.ts`: each `REFERENCE_PANEL` comp holds
the Driver against the next comp in panel order (six distinct matchups), paired by seed and turn order
against a bare arm measured once, with `DRIVER_PROC` counted per battle. The Element Drivers run as one
arm — each comp holds the Driver of its FIRST member's element. `--full` is the thirty-pair round-robin,
`--out` appends per line, `--iterations`, `--beam`, `--arms`. **Screening fidelity (`AI_LITE=1 --beam 8`),
n=12 per arm, two shards, 120 battles, ~20 min on a 2-core cloud box.** The bare arm came back
BYTE-IDENTICAL across the two shards (58.3%, same sweeps), which is the determinism check.

| arm | n | win% | flips +/− | procs/battle | silent | turns | ftk | stall | sweeps |
|---|---|---|---|---|---|---|---|---|---|
| bare (no Driver) | 12 | 58.3% | – | 0 | – | 6.7 | 0 | 0 | control, ramp, mixed-b |
| FIRST BLOOD | 12 | 66.7% | 1/0 | 5.75 | 0 | 6.4 | 0 | 0 | control, ramp, mixed-a, mixed-b |
| THIRD STRIKE | 12 | 58.3% | 1/1 | 2.08 | 0 | 6.8 | 0 | 0 | control, mixed-a, mixed-b |
| STATIC FIELD | 12 | 58.3% | 0/0 | 31.17 | 0 | 6.0 | 0 | 0 | control, ramp, mixed-b |
| ANTIVENOM | 12 | 58.3% | 0/0 | 1.17 | 7 | 6.7 | 0 | 0 | control, ramp, mixed-b |
| OVERKILL RECOVERY | 12 | 66.7% | 1/0 | 5.00 | 2 | 6.3 | 0 | 0 | control, ramp, mixed-a, mixed-b |
| BULWARK REFLEX | 12 | 66.7% | 1/0 | 1.75 | 2 | 5.6 | 0 | 0 | control, ramp, mixed-a, mixed-b |
| DEEP CACHE | 12 | 58.3% | 0/0 | 2.17 | 4 | 6.7 | 0 | 0 | control, ramp, mixed-b |
| ELEMENT DRIVER (each comp its own) | 12 | 58.3% | 0/0 | 10.42 | 0 | 6.5 | 0 | 0 | control, ramp, mixed-b |

Raw runs: `research/16-canary-runs/` (`shardA.txt`, `shardB.txt`, and `static.txt` — a per-battle re-run
of the STATIC FIELD arm that reproduced its 31.17 exactly).

**Read.** No FTK, no stall, no arm silent (every Driver fires — the VOID check the merge report taught),
no comp swept that the bare arm did not already sweep except `panel-mixed-a`, which FIRST BLOOD, OVERKILL
RECOVERY and BULWARK REFLEX each flip from a loss to a win **in the same battle** (1:0 flips each; at n=12
that is "leaning", never significant). THIRD STRIKE's 1:1 is churn. **The rates are the finding:** FIRST
BLOOD fires once a turn as designed (5.75 ≈ turns); THIRD STRIKE ~2 a battle (~20 attacks); STATIC FIELD
**31 a battle** — one per card the party plays, which under the ring's comps is 4.5-6 cards a turn, and
**the zoo flag did not bear out as written** — per turn, STATIC FIELD fired 4.4x under `panel-zoo`, 4.6x under
`panel-ramp`, 5.1x under `panel-mixed-b`, 5.5x under `panel-mixed-a`, 6.0x under `panel-burst` and **6.4x
under `panel-control`** (51 and 44 procs in 7- and 9-turn fights): the comp that compounds it is the DRAW
engine (kraken_v1's cantrips), not the wide one, and at ~3 damage a zap it changed no outcome (0/0 flips); the ELEMENT DRIVER ~10 (a third of the party's cards are the leader's
element); OVERKILL 5.0 (kills × survivors); BULWARK 1.75 (of 3 members cross 50% once); DEEP CACHE 2.2
(turns with an engine draw); ANTIVENOM 1.2 and silent in 7 of 12 — nobody was poisoned, which is the
matchup, not the Driver. **Nothing here asks for a knob.** Findings confirm at full, beamless lookahead
on Henry's machine: `npm run balance:drivers -- --full --iterations 3 --out canary-drivers.txt` (~9 hours
at full fidelity; `AI_LITE=1 ... --beam 8` for the screening tier at a third of that).

### Amendment 2026-09-12 (Henry, on reading the resolution)

1. **THIRD STRIKE is TENTH STRIKE** — id `driver_tenth_strike`, counter `tenth_strike`. The name says the number.
2. **STATIC FIELD is 6 power per card, not 2** (*"it should be felt, just not overpowered and an automatic
   win condition"* — he asked for 2-3x; 3x taken, ~10-11 damage a zap at parity, ~31 zaps a battle ≈ 14%
   of a 3v3 pool over a fight). Screening re-run of that arm: **30.4 procs/battle, 0/0 flips, no new sweep, mean turns 6.0 vs the bare 6.7** (`research/16-canary-runs/static6.txt`, which also re-measures TENTH STRIKE under its new id: 2.08 procs, 1/1, identical to before). Felt as pace, not as outcome, at this n.
3. The hook-inheritance finding above was explained and is **left as is** pending his call; it is not a
   bug in the Driver, it is how the engine attributes a hook's attack to the card that triggered it.
4. The full-fidelity canary he started before this amendment measures STATIC FIELD at 2 power and
   THIRD STRIKE by its old id; the other six arms are unaffected.

### Also

- `--boss-relics off` is **`--boss-driver off`** (`BossOverride.driver`); the old spelling still parses so
  tickets 67-72's recorded run lines paste. `ComposedSetup.player.relics` is **`player.drivers`**; a
  legacy `relics` key in a scenario file is lifted by a zod preprocess, so no fixture changed and the
  checked-in repro that names `heatsink` loads, warns and skips.
- `RelicTerminal.tsx` named in the deliverable did not exist any more; the relic pick lived in
  `BattleReport`/`BattleArena` and that is what came out. `onContinue` lost its middle argument.
- The description-data gate (ticket 139) caught the first draft's `1.5x`/`1.2x`/`50%` copy; the shipped
  text prints percentages ("50% more damage") and `onHpThresholdCrossed` resolves the 50% in the extractor.
- Unblocked: **17 (elite nodes — the drop)**, 40, and the snowball's Q2a. Ticket 70's *"renames wait for
  16"*: THIRD STRIKE's name-vs-number is the one rename this ticket surfaces.
