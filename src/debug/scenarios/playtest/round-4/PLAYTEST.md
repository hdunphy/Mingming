# Playtest round 4 - bounded mints, milk, and the first 3v3 hands

Eleven files across eight questions (S1, S5, S8 each have two parts), about 90-110 minutes total.
If short on time, **S1, S2, S5 are the must-plays** per the pack - they're the three verdicts
nothing else can give.

**Build check:** tickets 101 (audhumbla rebuild), 103 (generation bounds), 104 (preview parity),
105 (hel death order), 106 (ymir status econ), and 107 (draugr second lever) are all confirmed
shipped as of this pack. **96 (fenrir threshold) is still open** - nothing in this round depends
on it. Every scenario here was built fresh from the current registry, so decks/OS text should
already match your build if you've pulled recently.

---

## Setup, once

1. `npm run dev`, open the app.
2. **Ctrl+Shift+D** toggles the debug toolkit. Pick the **Scenario Launcher** panel.
3. **Load** -> choose a file from `src/debug/scenarios/playtest/round-4/`.
4. Check the destination-slot warning above Launch, then **Launch**.
5. Play it out.
6. **Before the killing blow lands - while the battle is still on screen - press Ctrl+Shift+E.**
   Move the exported files into `playtest-results/round-4/` and tell me.

**Note per game (30 seconds, right after):** deck | opponent | fun 1-5 | the ONE decision that
mattered most | the moment you felt railroaded (if any) | **any preview number that didn't match
what happened** (ticket 104 shipped - previews should be TRUE now; every mismatch is a bug
report, not a shrug).

---

## S1 - sleipnir on the leash, the 103 verdict (2 games)

| | you | opponent |
|---|---|---|
| **S1a** | `fenrir_v1` | `sleipnir_v1` |
| **S1b** | `sleipnir_v1` | control* |

\* opponent not named in the pack for S1b - uses control as a neutral baseline, same call as
round 3's S2b.

Round 3's S2 found the runaway; 103 bounded the mint instead of capping the pile. Game A: find
the turn you felt it tip last time - does a tip point still exist? Game B, from his own seat: is
the bounded mint still a ramp fantasy, or does it feel gutted? Note the biggest Strength pile you
reached and whether getting there took decisions or just turns.

## S2 - audhumbla drinks the milk, the 101 verdict

| | you | opponent |
|---|---|---|
| **S2** | `audhumbla_v2` (rebuilt) | `gullinbursti_v1` |

Same matchup as round 3's S4 - that was your "before" baseline. The rebuild is live: her OS
grants Regen on heals, `morning_dew` stacks it, `drink_deep` cashes the pile at 15/stack. Was the
hold-or-cash moment a decision or the obvious play? Did the moments you imagined in round 3
actually show up where you predicted? This is the ship/iterate call on the whole rebuild.

## S3 - ymir favorite regression (needs 106)

| | you | opponent |
|---|---|---|
| **S3** | `ymir_v2` | control |

`bracing_cold` moved from 1e/15 power/3 Strengthened to 2e/15 power/9 Strengthened. Is the engine
you loved intact? Does the build turn feel chosen now, or still mandatory?

## S4 - hel at the edge (needs 105)

| | you | opponent |
|---|---|---|
| **S4** | `hel_v2` | control* |

\* opponent not named in the pack - uses control as a baseline.

Push the health-spend to the brink deliberately - the greedy line you'd normally flinch from.
Death ordering is fixed; anything that still surprises you gets snapshotted.

## S5 - burn never forgives (2 games)

| | you | opponent | seat |
|---|---|---|---|
| **S5a** | `hraesvelgr_v2` | `audhumbla_v1` | applier |
| **S5b** | `fenrir_v1` | `skoll_v2` | receiving |

Burn no longer decays - every stack forever, cap 4, detonation at the cap. Applier seat: does
permanence make it a real clock, and is holding at 3 vs pushing through an actual choice?
Receiving seat: oppressive-fun (a countdown you play against) or oppressive-bad (a tax you
ignore)?

## S6 - draugr's wish, granted? (needs 107)

| | you | opponent |
|---|---|---|
| **S6** | `draugr_v2` | `huldra_v1`* |

\* "huldra" had no OS suffix in the pack - uses `huldra_v1` per round-1/round-3 precedent.

Ticket 107 shipped `rimebreaker`'s rework (25 power/distinct debuff -> 20 power/distinct status,
buffs included) but held the Poison-rider half of the fix (measured 50+ points too strong). Find
the turn you lost agency last time - is it gone? Does the shipped lever match your round-3 wish,
or graft on something adjacent?

## S7 - sharp vs dazed, the cancel war

| | you | opponent |
|---|---|---|
| **S7** | `gullinbursti_v1`* | `kraken_v1` |

\* the pack said "pick a Sharp deck... or the reverse" with no fixed pilot - uses
`gullinbursti_v1` because `stone_fist` is the roster's clearest self-feeding Sharp engine.

Does the stack war feel like a fight (reads, timing, bluffed sheds), or a coin flip decided by
deck construction before turn 1? Did casting a shed ever feel like the best card in your hand?

## S8 - first 3v3 hands (2 games, needs a playable 3v3 build)

| | you | opponent |
|---|---|---|
| **S8a** | panel-zoo (jormungandr_v1 + sleipnir_v1 + hraesvelgr_v1) | panel-control (kraken_v1 + huldra_v1 + draugr_v2) |
| **S8b** | panel-control | panel-zoo |

This is ticket 109's measured 100%-vs-control-panel pairing, played by hand instead of simmed.
Team decks share ONE hand across the party (STAB applies by whoever casts) - that's the
mechanic itself under test, not a side note. Game A: does piloting zoo feel overwhelming-strong,
or does the AI just defend width badly? Game B, from the control seat: what did your hands WISH
for against width - write it verbatim, it's input to the riptide-as-a-Driver design.

---

## What to write down

- **fun** (1-5)
- **the ONE decision** that mattered most
- **the moment you felt railroaded**, if any
- **any preview number that didn't match what happened** (104 shipped - report every mismatch)

## If something breaks

**Ctrl+Shift+E** immediately, keep the file - it's the same format as these scenarios, so I can
re-launch the exact state.

## What tonight decides

S1 is the verdict on generation bounds - fantasy intact or gutted decides whether 103 ships
as-is or gets a second pass. S2 ships or iterates the audhumbla rebuild. S3/S4 are regression
gates on your favorites. S5 rules whether permanent Burn keeps decay-0 or gets revisited. S7
feeds the removal-economy read. S8's Game B wish seeds the zoo-fix direction (Driver, not nerf).
