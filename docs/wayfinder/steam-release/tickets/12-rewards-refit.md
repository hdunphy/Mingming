# Post-fight rewards refit: scrap, 1-of-3 card pick, consumable blueprint drops, no XP (ticket 12)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [06](06-run-data-model.md), [11](11-encounter-flow.md)
- Phase: Vertical Slice

## Deliverable

`engine/RewardSystem.ts` + `BattleReport.tsx` already do scrap + pick-1-of-3 + blueprint roll + XP. Refit: drop XP entirely; blueprints are consumable COUNTS (a species you already own can drop again — that is the re-roll grind); scrap amounts become run-economy numbers (Henry supplies — see Questions); the card pick draws from the **reward-pool source Henry rules** (pre-seeded open question — default to the designer's recommendation, the current party's species pools, behind a single function so the rule can change); picked cards go into the shared run deck. Gym-clear draft rounds move to ticket 18.

Drop-rate numbers to propose (Henry picks): blueprint 15–25% per defeated wild, 100% from alphas.

## Done when

A won fight pays scrap + one pick + possible blueprint; the blueprint persists to the ranch immediately (dead runs still pay forward). Tests updated.

## Resolution

_(open)_

