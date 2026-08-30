# Tidewrack authored: the zoo leader under TIDAL SURGE (ticket 71)

- Type: wayfinder:task
- Status: open
- Assignee: 
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

_(open)_
