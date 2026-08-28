# valkyrie_v2 knockout study (ticket 60): name the engine before anyone picks a knob

- Type: wayfinder:research — **REPORT-ONLY.** Every arm's edit is TEMPORARY and reverted
  before commit; the only committed artifacts are the research file and this ticket's
  status flip. `git status` must show NO engine/data changes at commit time.
- Status: **closed** — study run 2026-08-14, `research/valkyrie-knockout.md`. **Both
  hypotheses on record are wrong; the OS is the engine (50 of her 88 points) and no card is
  measurably load-bearing.** No lever applied; four questions returned for Henry's session.
- Assignee: —
- Blocked by: none technically; if sharing the tree with the ticket-57 agent, run AFTER 57
  (one worker per tree — today's HEAD.lock collisions were real contention).
- Quality bar and template: `research/jormungandr-v1-attribution.md` (the study that found
  "velocity, not damage").

## Why

valkyrie_v2 sits at **84.7% field (roster #1)** with both ticket-56 knob rounds spent (one
was a no-op — see `0-STALE-FROM-NUMBERS`) and a 7-card deck Henry has rejected on sight
("we don't want a 7 card deck" — the rulebook floor is 8, and the final fix will restore
her to ≥8). Two competing engine hypotheses are on record, NEITHER measured:

- **Agent's (ticket-56 report §4):** the exhaust package — deck thins 7→4, reshuffles
  constantly, REBIRTH pays. But REBIRTH is capped once per turn (~10 dmg + 10 heal/turn
  bounded), which caps how much of 84.7 it can explain.
- **Designer's:** `starfall` priced against base draw 3 (~30 power, on the 1e curve) but
  playing against a REAL trigger count of 5+ in the thinned deck with `morning_light` —
  a ~50-power 1e card appearing every turn. The serpents_coil lesson verbatim.

The fix design (Henry's session) needs to know which it is, and how much each card
contributes. Measure; do not tune.

## Arms — ONE temporary change per sim, revert between arms

Baseline registry `1:66efb2d7`; valkyrie_v2 = falling_star ×2, morning_light, starfall ×2,
ascension, radiant_spark; REBIRTH_CYCLE 10/10 once per turn.

1. **Baseline** as committed (fresh measurement, same instrument as all arms).
2-7. **Remove one card per arm** (for ×2 cards remove ONE copy): falling_star, morning_light,
   starfall, ascension, radiant_spark — 5 knockout arms (6 cards, two are duplicates).
8. **OS-off**: REBIRTH payoff both halves → 0 (temporary hooks edit; restore byte-exact
   after — diff the file).
9. **Glimmer restored** (8-card deck, the pre-56 list minus nothing else) — this is the
   "undo the trim" reference AND the only ≥8-card arm, so it doubles as the floor reading
   for whatever 8-card fix follows.

## Instrument, per arm

Field row (all 15 opponents, 10 iterations — note ±5 noise; rank by delta, don't read
absolutes), and from the battle logs: **reshuffles per turn** (distribution, not just mean),
**starfall damage per cast + casts/game**, morning_light casts/game, **OS procs/game and
what fraction of turns the once-per-turn cap actually binds** (8-INERT-CAP — if procs/turn
never exceeds 1, the cap is decoration and firmware-cap fixes are off the table),
mirror turns, FTK count. **Any FTK > 0 in any arm → report immediately, finish the study.**

## Deliverable

`research/valkyrie-knockout.md` (CRLF): per-arm delta table ranked by |field delta|,
the engine named with the measurement that names it, candidate levers WITH their measured
support (levers are candidates for Henry — no lever is applied), a "questions for Henry"
list, and the card appendix (in-game text of every card mentioned). ONE commit: research
file + this ticket flipped closed. Author `Henry Dunphy <hdunphy15@gmail.com>`; CRLF for
docs/wayfinder; locks → `_to_delete/git-locks/`.

---

## Result — [research/valkyrie-knockout.md](../research/valkyrie-knockout.md)

Eight arms at baseline registry `1:66efb2d7`. **Every arm mutated the registry in memory**, so no
engine or data file was written; the commit is the research file and this status flip only.

| arm | deck | field | **delta** |
|---|---|---|---|
| **os_off** (REBIRTH payoff to 0) | 7 | **37.7%** | **-50.0** |
| baseline | 7 | 87.7% | - |
| ko_ascension | 6 | 87.0% | -0.7 |
| ko_radiant_spark | 6 | 88.7% | +1.0 |
| ko_falling_star | 6 | 90.0% | +2.3 |
| ko_morning_light | 6 | 90.0% | +2.3 |
| glimmer restored | **8** | 90.3% | +2.6 |
| ko_starfall | 6 | 91.0% | +3.3 |

**FTK 0 in every arm.** The once-per-turn guard held in all eight (the proc distribution never
exceeds 1 anywhere).

**Neither hypothesis survives.** The exhaust package is not the thinning engine - shuffles/turn go
UP when cards leave, because deck SIZE drives cycling and every knockout shrinks it. And `starfall`
measures **7.1 damage per cast at 3.11 casts/game**; removing a copy is the study's **largest gain**.

**The cap is load-bearing, not decoration:** she reshuffles more than once on **34.7% of her turns**
and the guard eats every one. Without it she would proc 66% more often.

**The finding that shapes the fix: restoring the 8th card is free.** The `glimmer` arm - the only
8-card-or-more configuration - reads **90.3%, +2.6**, with procs/game essentially unchanged. **The
rulebook fix and the balance fix are independent; an 8-card restoration must be paired with an OS
change or she ships at ~90%.**

Levers with measured support, none applied: **REBIRTH payoff** (the only lever with a measured
endpoint - 37.7% at zero) and a **trigger throttle** (UPDRAFT precedent). **Deck size and any single
card are NOT levers** - measured across seven arms, all inside +-3.3 on a +-5 instrument. Four
questions returned for Henry in section 6 of the research file.
