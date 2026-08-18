# Archetype identity template & pilot species

- Type: wayfinder:grilling
- Status: closed
- Assignee: wayfinder (Claude session, 2026-08-05, voice-mode grilling)
- Blocked by: [01-firmware-truth-and-enabler-audit](01-firmware-truth-and-enabler-audit.md) (closed), [08-archetype-possibility-space](08-archetype-possibility-space.md) (closed), [09-os-design-review](09-os-design-review.md) (closed); rework-slot firmware via [11](11-os-rework-specs.md)/[12](12-os-rework-implementation.md) (closed).

## Question

Before 32 decks get designed, lock the template every one of them fills in, and prove it on a pilot: deck spec (size, dupes, enabler minimum, curve distribution), differentiation bar, existing-deck assignments for the "maybe solid" four, and the pilot species pick.

## Resolution

Grilled with Henry 2026-08-05 (voice-mode session). The deck rulebook:

**1. Deck size — 8–12 cards, case by case.** 8 is the baseline sweet spot per mingming (from Henry's experience with the shared party deck); species wanting variety may run up to 12, exceptionally 15. **Base decks cap at 2 copies of any card**; player-built decks are free to strategize past that. *Engine consequence:* `MIN_DECK_SIZE` drops 10 → 8 (`gameTypes.ts`, `createStarterSave` pad loop, `SectorTerminal` deploy validation, `baseDecks.test.ts` exactly-10 invariant) — lands in [ticket 13](13-per-os-deck-data-model.md).

**2. Card-pool architecture — three tiers (Henry's uniqueness philosophy).** No cross-element reskins: every card in the pool is unique in role — never a Fire add-Sharp and a Water add-Sharp, never two 40-damage vanillas in different colors. Vanilla just-damage cards exist but are minimized. The tiers:

- **Neutral ('None') tier** — basic buffs (Sharp, Strengthened, etc.) and some plain attacks move to element-'None' cards shared by everyone. Deliberate side effect Henry wants: **this nerfs STAB** ('None' cards get no STAB bonus, so fewer elemental generics means less free ×1.5 damage).
- **Element-shared tier** — cards unique to one element, used by both of its species' decks.
- **OS-specific tier** — **30–50% of each deck** (≈3–4 cards of an 8-card deck) exists to turn that firmware on. This *is* the enabler minimum.

**3. Curve — one 3-cost payoff card where the OS wants it** (kraken_v2's 3e Water attack is the archetype case); otherwise decks stay cheap.

**4. Differentiation bar** — satisfied by the standing payoff-uniqueness principle (09) + the 30–50% OS-specific share: two decks sharing an element differ in their OS tier and payoff, never merely in stats.

**5. Existing-deck assignments:** fenrir's current burn deck → **fenrir_v2 CINDER_WALL**; kraken's current draw/daze deck → **kraken_v1 ABYSSAL_INK**; ratatoskr's current support deck → **ratatoskr_v1 GOSSIP_NODE** (penciled); each species' other slot gets a fresh build. **fafnir's assignment is decided in the Earth deck pass** together with the deferred fafnir/gullinbursti split.

**6. Pilot species: KRAKEN.** The thorough test of the whole pipeline: v1 keeps (and re-sizes) a known-good deck, v2 needs a fresh build including an authored 3e Water payoff, and kraken is both a 100%-OS-gap redline and an eternal-stall mirror — the pilot must move real numbers, not just ship data. Graduated as [ticket 14](14-kraken-pilot-decks.md), blocked by the data-model implementation ([ticket 13](13-per-os-deck-data-model.md)).

Fog graduated: the data-model implementation is now [ticket 13](13-per-os-deck-data-model.md); the per-element deck passes remain fog until the kraken pilot validates this template.
