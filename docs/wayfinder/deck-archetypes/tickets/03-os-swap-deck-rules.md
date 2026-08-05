# OS-swap deck rules

- Type: wayfinder:grilling
- Status: closed
- Assignee: wayfinder (Claude session, 2026-08-05, voice-mode grilling)
- Blocked by: [02-per-os-deck-data-model-audit](02-per-os-deck-data-model-audit.md) (closed)

## Question

Once starting decks are per-OS, what happens to a player's deck when they swap firmware mid-run? Card grant rules, swap cost/gating, and whether the enemy side uses per-OS decks.

## Resolution

Grilled with Henry 2026-08-05 (voice-mode). Three rules:

**1. Swap card grant — "B with a taste of the kit."** You fully own only the kit of the OS you compiled with. On your **first** swap to another OS you **pick 2 of its 8 starting cards** into your collection — once ever per OS per species; repeat swaps grant nothing. Rationale: the collection is one shared pool and player decks aren't element-locked, so a full-kit grant would be a ~50-scrap round trip to mine any species' best card (e.g. maelstrom for an unrelated build); the capped pick stops the mining while still bootstrapping the new playstyle. The pick count ships as a **tunable constant** (`OS_SWAP_PICK_COUNT = 2`) — playtesting may raise it to 3–4 with zero code work. The deck itself is never auto-edited; the player rebuilds (suggest-fill is already active-OS-aware from [ticket 13](13-per-os-deck-data-model.md)).

**2. Swap cost — 1 blueprint (SPENT) + 25 scrap, hub-only.** `blueprintsCollected` stops being a dead affordance ("for OS swapping", checked nowhere) and becomes the gate it was named for: blueprints stay a meaningful pickup all game.

**3. Enemies stay on MOVES/intents — a standing design decision, door deliberately open.** The cards→intents transition was a deliberate readability choice (Slay-the-Spire-style telegraphs). But Henry wants the CARDS enemy mode **kept alive in the codebase** — "there's something nice about playing against an opponent with cards," and it may be needed for multiplayer someday. It is naturally exercised daily: the entire balance suite runs enemies in CARDS mode, so it cannot rot. Enemy firmware + per-OS enemy decks are **ruled out of this map** as a future effort (recorded in Out of scope).

Implementation graduates as [OS-swap implementation](15-os-swap-implementation.md): FirmwareTerminal reads `availableOS` (drops the `_v1/_v2` hardcode), requires + spends blueprint/scrap, pick-2 UI, species+OS grant keying with a save migration.
