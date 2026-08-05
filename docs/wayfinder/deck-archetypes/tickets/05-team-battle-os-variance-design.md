# Team-battle OS-variance scenario design

- Type: wayfinder:grilling
- Status: open
- Assignee: —
- Blocked by: [01-firmware-truth-and-enabler-audit](01-firmware-truth-and-enabler-audit.md)

## Question

Henry chose team-battle scenarios (not hook redesign) for firmware that is structurally dead in 1v1 — skoll_v1 (ally takes damage), valkyrie_v2 (+10% per other ally), nidhoggr_v2 (on-faint, when the faint would end a 1v1), plus whatever else the audit confirms. Design the scenario shape:

- **Team size** — 2v2 or 3v3? The engine supports multi-unit sides and `runBatch` takes composed setups; cost is sim time (§2.3 currently runs 16 species × 50 seeds × 2 orientations).
- **Teammate composition** — the teammates' own species/decks bias the result. A fixed neutral pair (same for every measured species) keeps comparisons clean but "neutral" is exactly the trap this map is escaping; mirror teammates (measured species × N) changes what the hook sees (valkyrie_v2 with valkyrie allies vs. mixed allies). What's the least-confounded design, and does the teammate pair get pinned in `balanceScenarios.ts` with the same everything-pinned discipline the 1v1 suite uses?
- **Metrics & thresholds** — does the 15% gap cap transfer to team results? What's decided-vs-stalled in a team battle (one side wiped)? How do team results merge into `balance_report.json` without becoming incomparable noise next to the 1v1 table?
- **Which species run which shape** — only the 1v1-dead list, or every species in both shapes (1v1 gaps and team gaps as separate columns)?

Done when the scenario spec is written and the implementation ticket can graduate from fog.
