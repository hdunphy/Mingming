# Mirror stalemates: several archetypes never resolve

- Type: wayfinder:task
- Status: open
- Assignee: —
- Blocked by: —

## Question

`npm run balance` (run 2026-08-05, registry `1:1cba1e2c`, after the
[power_curve_spec.md rev 3](../../../power_curve_spec.md) rework — commit `8088eec`) shows 7
species breaching §2.2's 30-turn stall redline in the Mirror Test, and three of them are not
merely slow, they **never finish**:

| species | avg turns | draws |
|---|---|---|
| kraken | 61.0 | 400/400 |
| hel | 61.0 | 400/400 |
| audhumbla | 61.0 | 400/400 |
| gullinbursti | 60.6 | 368/400 |
| ymir | 57.7 | 372/400 |
| nidhoggr | 54.1 | 323/400 |
| draugr | 43.0 | 260/400 |

**This is not a new problem introduced by rev 3.** The [balance auditor & report
ticket](../../debug-toolkit/tickets/21-balance-auditor-report.md)'s original 2026-08-03 run
(pre-rev-3) already recorded 7 `TURN_COUNT` redlines against the same 30-turn threshold. The
count is identical; whether it's the *same seven species* or a reshuffled set has not been
checked — that's the first item below. draugr's stall was already called out by name in
`runBatch.test.ts` as a known, accepted stalemate before this rework started.

What's new and needs an answer either way: kraken, hel, and audhumbla are pinned at exactly
400/400 draws — not "usually stalls," but "cannot resolve, ever, under 100 seeds × 2 turn
orders." That's a stronger claim than "too slow" and is worth confirming isn't a genuine
deadlock (e.g. two Regen/BarkShield-heavy kits where nothing can out-damage the healing per
turn — the same shape of bug the 25% cap fixed for the Weakened×Sharp mirror, just on the
heal/shield side instead of the damage-multiplier side).

Checklist:

- Diff this run's 7 stalling species against the pre-rev-3 list (re-run on the parent commit of
  `8088eec` if the old species-level list wasn't recorded anywhere more specific than the count).
  Confirms whether rev 3 changed *which* archetypes stall or only left the count coincidentally
  the same.
- For kraken, hel, and audhumbla specifically: pull one seeded mirror log each and check whether
  net HP is trending to zero slowly (a pacing problem — just needs bigger numbers) or oscillating
  /flat (a real deadlock — a formula problem, most likely heal-vs-damage-per-turn math).
- Decide whether the fix is per-kit (nerf whatever status/heal combo these three share) or
  systemic (e.g. Regen's 3%/stack/turn or BarkShield's recompute-from-current-maxHp behavior
  is generically too strong against the new, lower damage-per-turn baseline).
- Re-run `npm run balance` after any change and confirm the draw rate actually drops, not just
  that average turns ticks down (a kit that resolves at turn 58 instead of 61 still reads as
  "never" to a player).

Done when: no species holds a 100% mirror-draw rate, and the remaining stall list (if any) is a
documented, deliberate decision rather than an unexamined byproduct.
