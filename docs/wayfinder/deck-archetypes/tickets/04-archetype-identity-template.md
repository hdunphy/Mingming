# Archetype identity template & pilot species

- Type: wayfinder:grilling
- Status: open
- Assignee: —
- Blocked by: [01-firmware-truth-and-enabler-audit](01-firmware-truth-and-enabler-audit.md) (closed), [08-archetype-possibility-space](08-archetype-possibility-space.md), [09-os-design-review](09-os-design-review.md) (closed). Note: decks for the three rework slots (valkyrie_v2, nidhoggr_v2, draugr_v2) additionally wait on [11-os-rework-specs](11-os-rework-specs.md) — pick a pilot species outside that trio.

## Question

Before 32 decks get designed, lock the template every one of them fills in, and prove it on a pilot. Grill with the enabler matrix from the audit on the table:

- **The spec per deck:** name/fantasy, the firmware mechanic it turns on, minimum enabler count (how many cards must feed the hook for it to be an archetype rather than a coincidence — e.g. sleipnir_v1 currently has 5 of 10 cards feeding MOMENTUM_DRIVE; is 5/10 the bar?), curve budget distribution (how many 0e/1e/2e/3e cards — today's decks are almost all 0–2e; do per-OS decks reach for 3e payoffs like kraken_v2 demands?), deck size (stay at 10?), duplicate policy (current decks run 2–3 copies).
- **Differentiation bar:** the two decks of one species share an element and (mostly) a card pool — what must differ for them to *feel* like two archetypes? The [archetype possibility-space catalog](08-archetype-possibility-space.md) is the menu to pick from; NorseExpansion's shapes survive only via the audit's keep/adapt/reject list. Decks are built for firmware as it stands **after** the [OS design review](09-os-design-review.md)'s verdicts.
- **Rating pass on the four "maybe solid" decks:** Henry named fenrir, kraken, maybe ratatoskr, maybe fafnir as solid — pin down which of their existing decks becomes which OS's deck, and what the *other* OS of each gets.
- **Pilot species:** pick one species to run end-to-end (design → price → `npm run balance` → registry) before fanning out. Candidates with reasons: sleipnir (both hooks live, FTK problem to fix on the way — highest signal), kraken (starter, 100% gap, dead v2 hook, mirror-stall member), or gullinbursti (100% gap, both hooks live but underfed).

Resolution graduates the per-element deck-design fog into tickets.
