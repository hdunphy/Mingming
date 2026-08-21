# Performance pass: AI turn time, motion cost, bundle size on Deck-class hardware (ticket 39)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [22](22-3v3-game-side.md), [33](33-species-art.md)
- Phase: Content Complete

## Deliverable

`TacticalAI.ts` (alpha-beta lookahead) is the per-turn cost and 3v3 widens it (deck-archetypes 3v3-optimisation got sims 52 s → 13 s with self-card dedup and `AI_BEAM=8` — confirm the GAME uses the same settings). Measure enemy-turn latency at 3v3 on a 2-core/low-end profile (Chrome CPU throttling 4×) — target < 1.0 s p95, and move the AI to a Web Worker if it exceeds it. framer-motion is imported in 16 of 24 components: profile a full fight for dropped frames. Bundle: report `dist/` size after ticket 02/33.

## Done when

Numbers recorded before/after; enemy turn p95 and frame-time p95 at 3v3 under the targets.

## Resolution

_(open)_

