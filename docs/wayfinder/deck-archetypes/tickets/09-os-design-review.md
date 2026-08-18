# OS design review & rework decisions

- Type: wayfinder:grilling
- Status: closed
- Assignee: wayfinder (Claude session, 2026-08-05)
- Blocked by: —

## Question

All 32 firmware variants were designed over a year ago (with help from an older AI model), before the rev-3 power curve, the balance suite, and most of the current engine existed. Review every one with Henry against three tests — power level, fit with the game being built, practical viability — and decide keep / tweak / rework per OS. Includes the behavior-intent items inherited from [ticket 07](07-firmware-defect-fixes.md).

## Resolution

Grilled with Henry 2026-08-05 against the [firmware truth table](../research/01-firmware-truth.md), the [archetype catalog](../research/03-archetype-space.md), and the post-07 balance baseline (registry `1:e4a7f49f`). Full verdict table:

**KEEP as-is (20):** fenrir_v1, kraken_v2, fafnir_v1, fafnir_v2, skoll_v1, skoll_v2, jormungandr_v1, gullinbursti_v1, gullinbursti_v2, hraesvelgr_v2, sleipnir_v1, sleipnir_v2, ratatoskr_v1, huldra_v1, ymir_v1, audhumbla_v1, audhumbla_v2, hel_v1, hel_v2, nidhoggr_v1. Their open issues (dead-in-deck, under-fed) are deck/enabler work already scoped, not OS design.

**KEEP with an enabler commitment (3):**

- **valkyrie_v1 VALHALLA_UPLINK** — kept deliberately as the *team* OS. Needs ~3–4 new Light ally-buff cards; measured only via [team scenarios](05-team-battle-os-variance-design.md).
- **hraesvelgr_v1 GALE_FORCE** — Henry likes the discard archetype: **commit to the discard card package** (~4–5 Air cards, "Hurricane Force" shape). He rejects "Air = only discard decks" and, correcting the catalog's overlap framing, sees no OS-level overlap with sleipnir (right — the overlap was in today's near-identical card lists, not the mechanics).
- **draugr_v1 PERMAFROST_WAKE** — **commit to the Ice sleep package** (~2–3 cards, self-sleep with payoff). Drop the unimplemented "or is revived" description text.

**TWEAK (6)** — decided behavior changes, implemented as [OS tweak pass](10-os-tweak-pass.md):

- **jormungandr_v2** — heal fires at **own** turn end only (2 HP/round as described, was 4).
- **kraken_v1** — ink procs on **own side's** effect-draws only (was: any side's).
- **fenrir_v2** — **keep** the self-burn→Sharp synergy as a real deckbuilding axis; fix the description ("to an enemy" → any Burn he applies). Note: `all_in` (4 Str + 2 Burn + 2 Sharp for 1e ≈ 92 power on a 40 budget) needs repricing in the deck pass.
- **ratatoskr_v2** — daze **enemy targets only**; self-target 0-costs stop backfiring.
- **huldra_v2** — shield **locked at 50% maxHP** (the ticket-07 placeholder is now the decided value; no code change).
- **ymir_v2** — Ice bonus softened **+50% → +35%** now, rather than waiting for decks (2e Ice: 90→121.5 power instead of 135-vs-a-140-3e-budget).

**REWORK (3)** — specs to be designed in [OS rework specs](11-os-rework-specs.md):

- **valkyrie_v2** — EINHERJAR_RALLY comes **out of the pair**, replaced by a new **solo-oriented** effect. EINHERJAR is shelved-but-remembered: find it a future home (another species, relic, boss...) when one appears.
- **nidhoggr_v2 FALLEN_FEAST** — full rework; keep the corpse-eater fantasy but 1v1-live.
- **draugr_v2 GRAVE_CHILL** — same "debuffed attackers falter" fantasy, rebuilt to work **against intent (MOVES) enemies** — today it fires in 0% of real-game encounters. Draugr's deck must also supply 2 debuff types.

**Design principles Henry set during the review (now in the map's Notes):**

1. **Team/solo is a deliberate axis** — the game should host OSes that promote multi-party play *and* OSes that excel solo, but **no species should carry two team-dependent OSes** (the valkyrie test: one team + one solo per species is healthy).
2. **Archetype uniqueness at the payoff level** — mingmings may *share enabler cards* (e.g. a discard package used by two species, even cross-element; a second discard OS elsewhere is welcome if a rework needs one), but **no two mingmings run the exact same archetype** — payoffs must differ (ramp vs control, etc.).

**Power watch-items carried to the deck pass** (confounded numbers, re-measure once per-OS decks exist): kraken v2-100% and gullinbursti v2-100% (dead/underfed opposing hook), sleipnir 99% (real signal, post-FTK-fix), hraesvelgr 90% (v1 blank until discard cards), jormungandr 86% / ratatoskr 68% / fenrir 66.7% (should move with the tweaks), ymir 88% (should move with +35%), hel/audhumbla stalls (deck problem).
