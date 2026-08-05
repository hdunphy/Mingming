# Archetype possibility-space catalog

- Type: wayfinder:research
- Status: open
- Assignee: —
- Blocked by: —

## Question

Before picking archetypes per species, enumerate **every deck archetype the engine lends itself to today** — a catalog Henry chooses from, so the 32 decks draw on the full option space rather than the first idea per species, and so the game offers a wide variety of gameplay.

Derive from the actual vocabulary, not aspiration: `ActionType`/`StatusType` (`src/engine/types.ts`), the executor registry (`ActionExecutors.ts`), scaling keys and conditionals (`HookFactory.ts`, `ConditionValidator.ts`), status behaviors incl. caps/decay/duality (`StatusBehaviors.ts`), hook triggers and counters, the existing 111-card pool as evidence of what's already carded, and the 32 firmware mechanics from [research/01-firmware-truth.md](../research/01-firmware-truth.md) as anchors.

Per archetype: a name, the core loop (what you do each turn and what pays it off), the engine mechanics it runs on, which OS/species/element could host it (including OSes it would bring to life), enabler density (how many existing cards support it vs. how many new cards it needs), 1v1-sim viability (or ally-dependence), and degeneracy risk (infinite-loop / stall potential — sleipnir_v2's token loop and the kraken/hel/audhumbla 400/400 mirror stalls show both failure modes are real). Group by family (aggro/burst, DoT, control/denial, ramp/economy, cycle/draw, defense/attrition, buff-scaling, team-support, high-risk...) and mark which archetypes are near-free (pool-ready) vs. new-card-heavy vs. blocked on engine work.

Findings land in [`../research/03-archetype-space.md`](../research/03-archetype-space.md); this catalog is the menu the [archetype identity template](04-archetype-identity-template.md) grilling picks from.
