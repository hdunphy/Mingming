# Rootfall authored: the strangler under ROOT ROT (ticket 72)

- Type: wayfinder:task
- Status: closed
- Assignee: legion-72
- Blocked by: [68](68-boss-redesign-drivers.md), [71](71-tidewrack-build.md) (shares the hook work), [70](70-first-ko-snowball.md)
- Phase: Vertical Slice

## Henry's authoring (2026-08-29 session)

**ROOTFALL (Nature gym) fight 3:** huldra_v2 (BARK_SHIELD_OS) + ratatoskr_v1 (GOSSIP_NODE) +
jormungandr_v2 (TOXIN_FANG_OS) — the strangler. Shield-poison (heartwood/thornguard/blightbloom),
party-wide 0-cost sustain with nettle chip, and a poison execute. Three distinct species,
2 Nature + 1 Water on the heuristic. Rejected, recorded: twin-huldra builds (species-clause look),
rat_v2 reuse (same OS at two gyms), and the kraken_v2 control-burst sketch (drops poison identity).

**Driver: ROOT ROT** — *"Whenever this side's card applies Poison, it applies 1 more."* ~+3-4
stacks/turn above printed; contagion doubles the inflated pile; visible on every application.

**Intended counter:** Fire (type) — noting fenrir_v1's missing-HP scaling converts poison pressure
into damage — plus the cleanse tech in ticket 69's toolbox. Cleanse landscape fact that motivated
it: `soothe` (0e, 1 stack) loses the race and `purify` is Light, off-EA.

## Build steps

1. `driver_root_rot` in hooks.json via the poison-application trigger. **Engine trap from the
   deck-archetypes handbook: `baseCost` on `onStatusApplied` hooks silently disables them** — do not
   set it; cover with a hook-wiring test. `liveness.ts` after the edit.
2. Rootfall's fight 3 becomes the authored trio; the LAST `boss_relic_*` team retires — after this
   ticket the relic firmware is dead code and can be deleted with its exemptions
   (`battleFactories`, `codex`, `firmwareRegistry` carve-outs).
3. Offer screen + final-elite carry, as 71.
4. Measure: `gauntlet:fight2 --gym gym_rootfall`, favourable + control, 60 each, death-Energized
   live. Note the 4-turn horizon works against poison — if ROOT ROT under-shows, the number to
   move is its +1 (to +2), in the ticket, Henry's call.
5. With all three gyms authored: re-measure Emberfall under death-Energized too, and report the
   three-gym table (per-fight + compound) that the HELD gauntlet-target ruling is waiting for.

## Done when

Gates green, Rootfall migrated, relic code deleted, telegraphed, three-gym table reported, HANDOFF
refreshed.

## Resolution

**CLOSED 2026-08-30 (LEGION).** Rootfall is authored under ROOT ROT, the relic firmware is deleted,
and **all three gyms now field authored trios**. The three-gym measurement is handed to Henry — see
the last section.

### 1. ROOT ROT, and the two traps it is built around

`driver_root_rot`, one hook on `onStatusApplied`, guarded on `statusApplied: Poison` and
`source: SELF`.

**TRAP 1 — `baseCost`, the one the ticket names.** Not set, and a test asserts it is absent on both
the declaration and the built hook. A `baseCost` here silently disables the hook: no error, no
schema complaint, and a boss that does nothing reads as a boss that is weak.

**TRAP 2 — the hook re-entering itself, which the ticket does not name and which is worse.**
`onStatusApplied` is dispatched from `effectHandlers`' single status-application path, so a hook
that *applies a status* on that trigger re-enters it. There is no hang — `resolutionEngine` caps
synchronous nesting at 12 — but that is a cap, not a design. Unguarded, *"applies 1 more"* would
have applied about **twelve** more and sprayed `CRITICAL_EVENT_OVERFLOW` warnings while doing it,
and the fight would have read as wildly overtuned rather than as broken.

The Driver guards itself with a **SIDE-scoped re-entry flag** (ticket 71's scope, reused): set
before the nested application, cleared after, so the nested copy's `when` fails. Measured
end-to-end: applying 3 Poison yields **4**, one log line, the flag back at 0, and **zero** overflow
warnings. A test covers 1→2 and 5→6 as well, because the rule is *per application*, not per stack.

### 2. The trio, and the relics deleted

`AUTHORED_BOSSES.gym_rootfall` = huldra_v2 + ratatoskr_v1 + jormungandr_v2 under ROOT ROT.

With no gym left on the formula boss, the relic system is **deleted**, not deprecated:
`boss_relic_fire|water|ice` out of `hooks.json`; `BOSS_RELIC_IDS`, `BOSS_RELIC_BY_ELEMENT` and
`bossFirmwareFor` out of `gauntlet.ts` along with the rolled-firmware branch and `gymSignatures`'
second shape; the `boss_relic_*` carve-outs out of `battleFactories` and `firmwareRegistry`.

**The deletion rests on an invariant, so the invariant is now a test.** Without the formula branch,
a gym with no authored boss would field a team with no firmware and no Driver — a quietly *empty*
boss rather than a crash. `gauntlet.test.ts` asserts every entry in `GYM_REGISTRY` has an authored
trio, a `driver_*` Driver and a printable telegraph, and that no `boss_relic_*` resolves any more. A
fourth gym added without authoring fails there, loudly.

### A live defect the deletion exposed in ticket 67's isolation lever

`runGate`'s `relics: 'off'` arm did two things: drop the signature passive **and** swap the boss's
`boss_relic_*` id for the species' `availableOS[0]`. That second half was correct while a boss wore
a relic instead of real firmware. With authored gyms it had quietly become **harmful**: it would
replace an authored `skoll_v2` with `skoll_v1` — changing the boss's **deck** inside an arm whose
entire purpose is to change exactly one thing.

The swap is removed; the arm is now precisely *"the boss without its Driver"*, with firmware, deck,
stats and seed identical to the baseline, and a test asserts each of those. **The flag keeps the
name `--boss-relics off`** because research run-lines quote it.

### The fallout, and where it ends

Authoring the last gym broke sixteen tests across eight files over the two tickets — all of them
needed "a gym that still fields the formula boss". Ticket 68 pointed them at Tidewrack; ticket 71
moved them to Rootfall; this ticket **deletes** them, because the set they were following is now
empty. Where a real claim survived the shape change it was rewritten rather than dropped:

- `hookWiring`'s whole `boss relic OSes` block — deleted, with a comment recording why a test that
  follows a shrinking set to zero is finished.
- `gauntlet`'s *"one species per biome"* → *"fields the gym's authored trio"*; *"does not disturb
  what the OTHER gyms roll"* → each of the three gyms fields its own trio and its own Driver.
- `battleFactories`' *"signature firmware intact"* → the firmware handed over is still there and is
  real, registered firmware that is **not** a relic.
- `RanchScreen`'s *"still prints the un-authored leaders' relic text"* → all three leaders print
  their Driver, and no relic name appears anywhere.
- `encounter`'s *"gives nothing at an un-authored gym"* → **inverted**: every gym carries its Driver
  to the elites guarding its gauntlet.

### 5. THE THREE-GYM TABLE — OUTSTANDING, and it is Henry's to run

The table the HELD gauntlet-target ruling is waiting for needs **six arms of 60**, all with the
Bereavement Rally live: Tidewrack (ticket 71), Rootfall, and **Emberfall re-measured** — its
80.0%/65.0% predate both the balance merge and the Rally, so it is the stalest of the three.

That is roughly four hours, and **it cannot run in this agent's container**, which reclaims
background processes during idle gaps and has already killed three long runs. On Henry's machine:

```
npm run balance:run-gate -- --bands gauntlet --gym gym_emberfall --matchup favourable --iterations 60
npm run balance:run-gate -- --bands gauntlet --gym gym_emberfall --matchup control    --iterations 60
npm run balance:run-gate -- --bands gauntlet --gym gym_tidewrack --matchup favourable --iterations 60
npm run balance:run-gate -- --bands gauntlet --gym gym_tidewrack --matchup control    --iterations 60
npm run balance:run-gate -- --bands gauntlet --gym gym_rootfall  --matchup favourable --iterations 60
npm run balance:run-gate -- --bands gauntlet --gym gym_rootfall  --matchup control    --iterations 60
```

**Read ROOT ROT's number against the ticket's own warning:** the 4-turn horizon works against
poison, so if it under-shows, the number to move is its **+1 → +2**, and that is Henry's call in
this ticket rather than a tuning pass.

### 5b. PART OF THE TABLE IS IN (Henry asked for it directly, 2026-08-30)

> *"can you run tests against the new bosses with a prepared player. make sure the deck has counters
> and also try to match the 2-1 type advantage so bring two nature and a water vs the water boss."*

Run at **n = 30 on the boss cell only** rather than the six full arms of 60 above — sized to
separate the three bosses from each other, not to grade any one of them. Full write-up:
[research/72-the-three-gym-prepared-table.md](../research/72-the-three-gym-prepared-table.md); raw
output in [research/72-runs/](../research/72-runs/).

| boss | prepared | 95% CI | avg turns | vs the 60% target |
| --- | --- | --- | --- | --- |
| Emberfall (Fire) | **83.3%** (25/30) | 66.4 – 92.7 | 4.1 | +23.3pt |
| Rootfall (Nature) | **76.7%** (23/30) | 59.1 – 88.2 | 5.2 | +16.7pt |
| **Tidewrack** (Water) | **23.3%** (7/30) | 11.8 – 40.9 | 3.4 | **−36.7pt** |

**Tidewrack's interval overlaps neither of the others**, so the separation is solid even though each
figure is provisional. Three findings, in order of how much they change what to do next:

1. **TIDAL SURGE IS NOT THE REASON.** `--boss-relics off` gives 26.7% against the Driver's 23.3% —
   paired, **exactly one discordant pair in thirty battles, McNemar p = 1.000**. It is not broken:
   instrumented, the boss side plays 12–27 cards, so the 10-card threshold trips once or twice a
   fight. It just pays 10 power into a fight the boss is already winning by ~240. **Do not tune the
   Driver believing it is the wall** — and note that lowering Tidewrack's damage makes the Driver a
   *larger* share of the fight, not a smaller one.
2. **The wall is raw damage rate.** Boss damage per turn: **Tidewrack 55.8**, Emberfall 32.3,
   Rootfall 27.6 — 1.7× and 2.0×. A party pool is ~240 and Tidewrack deletes it in two to three
   turns; in the losses the player gets 12–21 cards played against 28–37 in the wins. Un-separated
   suspects: **`kraken_v1`'s +20 at 3v3** (balance-merge t116) and **`skoll_v2`'s Strength scaling**,
   which lands 1.5× into two of the player's three bodies by design.
3. **The counter-pick may be a TRAP here.** Control (2 Water + 1) beats prepared (2 Nature + 1 Water)
   **40.0% to 23.3%**, paired 7 flips to 2, McNemar **p = 0.180** — underpowered, not null, and the
   same 7:2 shape ticket 70's arms had before they turned out real. If it holds, the type-advantaged
   team is *worse* than the neutral one against this gym. **`--iterations 90` on both arms settles
   it**, and it is the one number here worth the battles before Henry rules.

Also confirmed, and it is what makes the arm the right arm: **the prepared lineup is exactly the 2-1
Henry specified** for all three bosses, with the single filler always the answer to the boss's odd
member. That is a coincidence of the arm's roster arithmetic and ruling 3's boss heuristic, and is
now pinned as a test. Emberfall's 83.3% is statistically indistinguishable from ticket 68's 80.0%,
so **that number survived the merge and the Rally unchanged.**

**STILL OUTSTANDING:** the six control/favourable arms of **60 over the full gauntlet band** (all
three fights, not just the boss), which is the population the HELD gauntlet-target ruling was
specified against. `--out <file>` now exists on `balance:run-gate` so an hours-long run cannot be
lost to a closed terminal.

### Gates

`tsc --noEmit -p tsconfig.app.json` clean, `eslint .` at 0, `liveness.ts` re-run after the hooks.json
edits (all firmware LIVE), full suite **142 files / 2015 tests green**.
