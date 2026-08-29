# Prototype: the workshop screen (ticket 65)

- Type: wayfinder:prototype
- Status: closed
- Assignee: wayfinder (Henry prototype session)
- Blocked by: —  (spec: [61's AMENDED SPEC](61-apply-60.md) §3 + [56](56-economy-numbers.md) ruling 2)
- Phase: Vertical Slice

## Question

The workshop's verbs: ASSEMBLE a blueprint into party or bench (1 blueprint + 25 scrap; stats roll at assembly — the roll reveal is a moment worth staging, SynthesisLab's "BASE DECK ACQUIRED" sequence is the precedent), REFLASH a member's OS (1 blueprint + 15 scrap; shows both OS options with their decks' 5-card engines), and open the deck/roster editor (ticket 62). Mock for Henry: blueprint inventory presentation (counts per species — the consumable read must be obvious), the assembly ceremony (roll reveal, engine cards fanning into the collection/deck), reflash comparison view, and the fiction (assembly bay in the firmware world). Open for Henry: does assembly land the new member's engine cards straight into the ACTIVE DECK or the COLLECTION (spec implies deck via base-contribution floor — confirm); bench-vs-party choice at assembly time.

## Deliverable

1–2 HTML mockups with the ceremony sketched (static frames ok, one animated if cheap); Henry reacts; chosen flow linked here.

## Resolution

Closed 2026-08-26. Mockups in [research/65-workshop-proto/](../research/65-workshop-proto/).

**CHOSEN: Option I — the BAY, one screen** ([workshop_I_bay.html](../research/65-workshop-proto/workshop_I_bay.html); K, the 3-step wizard, rejected — more clicks for the same verbs). Build spec:

- **Left: BLUEPRINT RACK** — species chips with consumable counts ("blueprints ×2"), zero-count species greyed; hint text carries the re-roll fiction (extra copies re-roll stats via re-assembly at the ranch).
- **Center: the ASSEMBLY STAGE** — selected species silhouette, **the stat-roll reveal** (three stat boxes; animated in build: chassis prints, rolls spin up — the SynthesisLab "BASE DECK ACQUIRED" sequence is the precedent), the species' two OS options chosen AT assembly, and the **5-card engine that will enter the deck** listed explicitly. Cost chips: 1 × BLUEPRINT + 25 ⛁. Two commit buttons: **ASSEMBLE → PARTY** (asks who to bench when full) and **ASSEMBLE → BENCH**.
- **RULED (Henry): an assembled member's 5-card engine goes STRAIGHT TO THE ACTIVE DECK** when it enters the party (bench assembly parks the engine in the collection until the member is swapped in) — consistent with the purchase ruling and the 8/13/18 floor.
- **Right: PARTY/BENCH panel** (chips with OS + energy), species-clause note, the floor pill, and the **REFLASH entry**.
- **REFLASH = the shared comparison screen** ([workshop_J_reflash.html](../research/65-workshop-proto/workshop_J_reflash.html)): current OS + its in-deck engine vs offered OS + the engine that replaces it, side by side; **old engine cards → run collection, new engine → deck** (floor unchanged, 5 for 5); cost 1 × species blueprint + 15 ⛁.
- Top bar: scrap, EDIT LOADOUT (the ticket-62 F editor), LEAVE. Duplicate rule (×N badges) applies throughout.

## Reveal clarification (Henry, 2026-08-26)

The stage's VIT/PWR/DEF numbers depict the POST-assembly ceremony, not a preview. Stats show ?? until the blueprint is spent (planRecruit ruling: the roll is never previewed). Confirmed against Legion's ticket-61 implementation.
