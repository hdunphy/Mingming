# Scenario launcher UI prototype

- Type: wayfinder:prototype
- Status: open
- Assignee:
- Blocked by: [Scenario schema & normalizer](10-scenario-schema-implementation.md), [Debug gating scaffold](12-debug-gating-scaffold.md) ([Scenario schema v1](02-scenario-schema.md), [Debug gating architecture](03-debug-gating-architecture.md) closed)

Note: a prototype can stub the Launch button, but a launch that actually produces a battle also needs [Scenario materializer](11-scenario-materializer.md).

## Question

What does the launcher look and feel like? Build a cheap, rough Debug-tab panel to react to before committing the real build: pickers for 1–3 player mingmings (species / level / IVs / OS), deck assignment (existing saved decks, base decks, or ad-hoc card lists), enemy group with per-enemy overrides, seed field (blank = random, shown after roll), `enemyMode` toggle, gauntlet-context toggle — plus load-scenario-from-file and save-composition-to-file, then a Launch button that drives `setBattleState` (or the chosen dispatch surface).

Resolve by reacting to the prototype: layout, which knobs matter vs clutter, what defaults ("mirror my current save party" as a one-click preset?), and what v1 cuts. Links the prototype branch/artifact as an asset.
