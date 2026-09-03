# Ticket 139 — the description-vs-data sweep, as a test with an allowlist

**Type:** `wayfinder:task`
**Status:** open
**Assignee:**
**Blocked by:** —
**Opened:** 2026-09-03, out of ticket 138 (Henry: *"Open a new ticket for the false positives please"*)

---

## What this is

Ticket 138 found four real defects by comparing the numbers in a card's `description` to the
numbers in its `actions`. That comparison was a twenty-line throwaway script. This ticket makes it
a test, so the next defect fails a gate instead of waiting to be found by accident — which is how
every single one of 138's findings was found, including a Regen glossary line that was wrong on the
timing, the amount AND what a stack is, all in one sentence, for an unknown number of months.

**The allowlist is the deliverable, not the test.** The sweep raises 39 candidates across 226 cards
and only 4 are real. The other 35 are not noise to be filtered away — each one is a place where the
text and the data are related **by code rather than by equality**, and that relationship is
currently written down nowhere. Writing it down is the point; the passing test is the side effect.

## The 35, grouped by why they are not defects

Numbers below are from the 2026-09-03 sweep at commit `8b05f64`.

### A. The number lives in a hook, not in `actions` (14 cards)

Daemons and firmware-backed cards carry `actions: []` or a partial list, and their behaviour is a
hook. The description is describing the hook.

`harden_daemon` (1 Sharp), `core_overclock_daemon` (+20%/stack, max 8), `cinder_armor_daemon`
(1 Sharp), `feedback_loop_daemon` (7 power), `echo_chamber_v2` / `echo_chamber` (0-cost token),
`hoofbeat_daemon` (10 damage), `einherjar_standard` (+10%), `riptide` (8 power), `short_circuit`
(15 power), `reactive_plating` (1 Sharp, max 3), `scrubber` (1 Poison), `drip_feed` (1 Regen),
`thermal_overload` (25/50/5).

**Allowlist rule:** if the card has a registered hook, the hook's own numbers are in scope for the
comparison and the card's `actions` are not the whole story. Better than an exemption: extend the
sweep to read the card's hook data too, and only exempt what is hand-written in
`CustomFirmware.ts`.

### B. Removal cards print a magnitude, the data carries a signed delta (6 cards)

`soothe` ("Remove debuff by 1 stack" / `-1`), `purify` ("Remove 1 Poison, 1 Burn, 2 Weakened and 2
Dazed" / `-1`,`-2`), `baseline_purge` (`-2`), `shrug_off` (`-1`), `slag_shed` (`-2`), `vent`
(`-3`), `deathless_slumber` (`-2`).

**Allowlist rule:** compare on absolute value for `STATUS` actions with negative `stacks`. This is
a real rule about how the game talks, not an exception — "remove 2" is how a card says `-2`, always.

### C. The per-stack rate is a constant in engine code (7 cards)

The card prints the rate; the rate lives in `ActionExecutors.ts` or a status behaviour, and the
action carries only the base.

`spike_launch` and `cinder_lance` ("+5 power per Sharp stack" — `SHARP_STACKS` resolves as
`power + 5 * stacks`), `ragnarok_edge`, `last_rites`, `bloodlust` ("+0.7 / +0.35 power per 1% max
HP missing" — `MISSING_HP` with `scalingPower`), `discharge` ("1 Burn per 2 removed" — the action
says `0.5`, which is the same statement inverted), `zealots_edge` ("permanently gains +10 power",
which is state the card accumulates rather than a printed action).

**Allowlist rule:** these are the ones worth an explicit named entry each, because a change to the
constant in code silently falsifies the card text — this is exactly the shape of ticket 137's
Regen bug, one level down. Ideally the test resolves the constant from the engine and compares,
rather than exempting.

### D. Conditional branches — both numbers are real, one is in a conditional action (5 cards)

`molten_core` ("4 Burn if host has Sharp, otherwise 2" — `2` unconditional plus `2` under
`self_sharp`, so both readings are correct), `blood_rite`, `berserk_rush`, `battle_rhythm`,
`equilibrium` (all print a `50%` HP threshold that lives in a `HEALTH_THRESHOLD` conditional, not
in a numeric field).

**Allowlist rule:** read `conditionals` as a number source. The `50` is in the data, just not where
the sweep looked.

### E. Descriptive zeroes and card-limit words (3 cards)

`hoarders_cache` ("every 0-cost card"), `sleipnir_v2` / `ratatoskr_v2`-style "0-cost" references —
the `0` names a cost the card reads, not a quantity it applies.

**Allowlist rule:** ignore a number when it is immediately followed by `-cost` / `-Energy`.

## The firmware side is already clean — do not re-derive

The same sweep over all 32 firmware `description` fields in `hooks.json`, compared against the
numbers in each firmware's own hook data, found **no confirmed mismatch**. Every candidate it
raised was a legitimate elsewhere: `kraken_v2`'s "30% more" is `multiplier: 1.3`, `draugr_v2`'s
"20% less" is `multiplier: 0.8`, `gullinbursti_v1`'s "3 additional power" is `powerBonus: 3`, and
`skoll_v2` / `ymir_v2` / `hel_v2` carry `hooks: []` because they are hand-written in
`CustomFirmware.ts`. The two firmware descriptions that WERE wrong are the two ticket 136a fixed.

## Also in scope: the status glossary

`statusGlossary.ts` is what a player reads for Burn, Poison, Regen, Dazed, Weakened, Strengthened,
BarkShield, Energized and the duality pair. Its Regen entry was wrong on three counts at once and
no test caught it. Pin each entry against the engine constant it describes, the way
`burnPricing.test.ts` already pins Burn's price by RUNNING `BurnBehavior` — a derived assertion
rather than a transcribed one.

## Accept

A test walks every card and every firmware, compares description numbers to data numbers, and
fails on a mismatch. Every exemption is a named entry with a one-line reason, and the C-group
entries resolve their constant from the engine rather than hard-coding it. The glossary is pinned.
The four defects ticket 138 found would all have failed this test.
