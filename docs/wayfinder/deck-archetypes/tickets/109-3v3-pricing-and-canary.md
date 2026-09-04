# 3v3 pricing check + comp canary (ticket 109): does the tuned game survive length and width?

- Type: wayfinder:research - REPORT-ONLY. No card, price, OS, or engine changes; alarming
  findings return to Henry. Authorized 2026-08-20 off the 3v3-optimisation review - this
  is the work that must precede any GA, and it replaces evolutionary search with designed
  probes while the imagination well is still full.
- Status: **open**. Branch archetype-web. Follows ticket 98 + the optimisation work.
- Instrument rules: SCREENING at AI_BEAM=8 + AI_LITE (the shipped opt-ins - set them per
  run, never globally); **anything you intend to report as a finding confirms at full,
  beamless lookahead** (the binding 108 rule). 0-AI-SIM-COUNTS applies to every counter.

## Part 1 - do the 1v1 prices survive 12-turn, 6-body games?

Run a fixed representative comp set (6 comps, mixed roles/elements) round-robin, full
battles, and measure against the 1v1 calibration:

1. **Game length distribution** (the 1v1 economy was tuned at ~5 turns; what is 3v3's
   median and tail?).
2. **Poison at length**: quadratic value over 12+ turns - share of total damage vs its 1v1
   share; does any Poison deck's presence dominate long games?
3. **Permanent Burn + detonation at length and width**: piles, detonations/game, share.
4. **Status piles at width**: re-run the status-pile census instrument inside 3v3 - board
   means vs the 1v1 census table (the scorer's constants encode the 1v1 numbers).
5. **The entity-count tag list, measured**: TREACHERY feed rate (predicted ~3x), riptide
   procs, side-wide effects (inferno/heat_wave) value, RANDOM_ENEMY dilution, reshuffle-
   triggered firmware in the ~27-card shared deck (valkyrie REBIRTH procs/game - predicted
   ~0). Report actual-vs-1v1 rate per tagged mechanic.
6. **Wasted energy per turn** (Henry's ruled 3v3 metric) under the shared-hand draw
   formula sum(cardDraw)-(N-1).

Deliverable: a **'prices that break at length or width' list**, ranked - each with the
measurement and which constant/mechanic it indicts. NO fixes.

## Part 2 - the designed comp canary (~30 stress comps)

Construct from the registry (document each comp's intent one line):
- **Max-STAB comps**: per element, the closest-to-mono team the roster allows (most
  elements have two species - 2+1 splash is fine; the point is STAB density under the
  shared-deck caster rule).
- **Role stacks** (archetype-web doc): triple zoo, triple control, triple ramp, triple
  burst, triple sustain - the 3-healer STALL comp is the headline: does any comp produce
  an unkillable game? (The infinite-game check - FTK's inverse.)
- **Tag-abuse comps**: TREACHERY host + ally-damage feeders; riptide vs a zoo comp;
  side-wide Burn stacking (inferno/heat_wave x detonation); energy-ramp stacking
  (GENESIS/capacitor/hoard in one comp); **the daemon+OS compounding jackpot** (SOLAR_
  OVERDRIVE host running core_overclock_daemon - the pool watch-item's mandated revisit,
  early).
- **Best-guess strongest**: 3-5 comps you would ladder with, stated before measuring.

Each canary comp plays a 6-comp reference panel (from Part 1) at screening fidelity, ~4
games per pairing both orders. Metrics: win rate vs panel, game length, FTK (hard 0),
stall/truncation count, wasted energy, the tagged-mechanic rates.

## Flags -> Henry (report, never fix)

Any 60-turn/undecided game. Any comp >90% vs the whole panel (confirmed beamless). Any
tagged mechanic running >2x its 1v1 rate. Any Part-1 price indictment. Plus your
best-guess-vs-measured surprise list - where your pre-registered strongest comps ranked.

## Deliverables

research/3v3-pricing-and-canary.md (findings ranked by decision-relevance, card appendix,
questions for Henry); **the canary comp set committed as a reusable suite file** (it
becomes a standing gate once the 3v3 game stabilizes); ONE commit.

## Mid-flight answers (Henry + designer, 2026-08-20 - for the confirm pass)

1. **SPECIES CLAUSE RULED: no duplicate species per team** (pragmatic grounds - one-line
   enforcement vs a tripled degeneracy surface; revisitable later as a challenge mode).
   Your one-member-per-species assumption stands; nothing re-runs. Scenario-only
   injection of tag extras: ratified.
2. **VERIFY before the report: SOLAR_OVERDRIVE's stack cap state post-ticket-103.** It
   shipped at max 5; if 103's cap-removal took it, Strengthened landing at 3.33x width
   makes your pre-registered comp 3 the likeliest degeneracy. One-line check, name the
   answer in the report.
3. **Zoo-inversion hypothesis to test in the beamless confirm:** the web's control-preys-
   on-zoo edge was NEVER BUILT (riptide died with ticket 72) - zoos scale with width,
   control's answers don't. Also note the screening tier under-reads reactive play, which
   inflates exactly this result - the confirm is decisive. If it holds, the designed fix
   direction is the missing predator as a DRIVER (riptide's per-turn-threshold design,
   party-wide, draftable) - do NOT nerf 1v1-healthy zoo decks. Report, don't fix.
4. Your ticket-98 self-correction (1.33x not 4-10x) and the Poison width-inversion are
   accepted as findings - the 'prices at length' fear was aimed at a game that doesn't
   exist; the real finding is WIDTH multiplying stack counts 2-4x against 1v1-measured
   constants. Rank that in the report's price-indictment list.
