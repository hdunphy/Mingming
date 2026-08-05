# Team-battle OS-variance scenario design

- Type: wayfinder:grilling
- Status: open
- Assignee: —
- Blocked by: [01-firmware-truth-and-enabler-audit](01-firmware-truth-and-enabler-audit.md) (closed), [09-os-design-review](09-os-design-review.md) (its verdict on the 1v1-dead trio decides what this ticket must measure)

## Question

Henry chose team-battle scenarios (not hook redesign) for firmware that is structurally dead in 1v1. The [audit](01-firmware-truth-and-enabler-audit.md) pinned the definitive list at **three**: valkyrie_v1 (code excludes self from VALHALLA_UPLINK), valkyrie_v2 (`ALIVE_ALLIES` = 0 → ×1.0), nidhoggr_v2 (the only usable faint ends a 1v1). skoll_v1, huldra_v1 and audhumbla_v2 turned out to work in 1v1 (`ALLY` includes self) and don't need this. Two conditional cases ride along: draugr_v2 needs `enemyMode: 'CARDS'` plus a debuff-stacking opponent, and huldra_v2 is testable only from the enemy side until its turn-guard bug is fixed ([defect fixes](07-firmware-defect-fixes.md)).

Design the scenario shape:

- **Team size** — 2v2 or 3v3? The engine supports multi-unit sides and `runBatch` takes composed setups; cost is sim time (§2.3 currently runs 16 species × 50 seeds × 2 orientations).
- **Teammate composition** — the teammates' own species/decks bias the result. A fixed neutral pair (same for every measured species) keeps comparisons clean but "neutral" is exactly the trap this map is escaping; mirror teammates change what the hook sees (valkyrie_v2 with valkyrie allies vs. mixed allies). What's the least-confounded design, and does the teammate pair get pinned in `balanceScenarios.ts` with the same everything-pinned discipline the 1v1 suite uses? Note: nidhoggr_v2 feeds on *any* faint — teammates who die fast are enablers, which cuts against "neutral" teammates.
- **Metrics & thresholds** — does the 15% gap cap transfer to team results? What's decided-vs-stalled in a team battle? How do team results merge into `balance_report.json` without becoming incomparable noise next to the 1v1 table?
- **Which species run which shape** — only the 1v1-dead three, or every species in both shapes (1v1 gaps and team gaps as separate columns)?
- **Multi-unit deck plumbing** — team scenarios with per-OS decks are the one consumer that genuinely needs the scenario schema v2 migration (`player.deck` → `PartyMemberSetup.deck`, bounded in [the data-model audit](../research/02-data-model.md) §5); decide whether that lands with this ticket's implementation or before it.

Done when: the scenario spec is written and the implementation ticket can graduate from fog.
