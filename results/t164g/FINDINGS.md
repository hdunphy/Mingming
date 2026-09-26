# Ticket 164g — Blueprints and Recruits Properly Charged & Species-Gated

Measurement run on 120 runs (10 seeds × 12 EA starters) with `BlueprintLedger` tracking species-specific blueprints, market blueprints properly charged with `buyMarketBlueprint`, and workshop recruits charging `WORKSHOP_ASSEMBLY_SCRAP` (25 scrap).

## 1. Comparison: Free Recruits (t164f) vs Gated Recruits (t164g)

| Metric | Before 164g (Parent) | After 164g | Note |
|---|---|---|---|
| Total recruits | 59 (0.49 / run) | 52 (0.43 / run) | Down ~12% due to scrap cost & species availability |
| Market blueprint charge | 0 scrap (no-op) | 50 scrap (`buyMarketBlueprint`) | Slot recorded, revisit does not double-buy |
| Workshop recruit cost | 0 scrap | 25 scrap (`WORKSHOP_ASSEMBLY_SCRAP`) | Run checks affordability before assembling |
| Species constraint | Any blueprint -> any species | Species X blueprint -> Species X recruit only | Enforced by `BlueprintLedger` |
| Biome 0 deaths | 88 / 120 | 75 / 120 | Survivors bank scrap and recruit genuine teammates |
| Gym clears | 7 / 120 (5.8%) | 6 / 120 (5.0%) | 6 clears (Fenrir v1 x2, Fenrir v2 x1, Kraken v1 x1, Huldra v1 x1, Huldra v2 x1) |

## 2. Recruits Distribution

Because any blueprint no longer recruits arbitrary species:
- Recruits reflect dropped blueprints (`bundle.blueprints`) and bought market blueprints.
- Instead of exclusively partner species, players recruit what they have blueprints for, creating realistic team diversity.
