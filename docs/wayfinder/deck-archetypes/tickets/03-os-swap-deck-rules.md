# OS-swap deck rules

- Type: wayfinder:grilling
- Status: open
- Assignee: —
- Blocked by: [02-per-os-deck-data-model-audit](02-per-os-deck-data-model-audit.md)

## Question

Once starting decks are per-OS, what happens to a player's deck when they swap firmware mid-run? This is the game-design decision the data model has to serve, and it gates all implementation fog. The option space to grill (with the audit's facts about where decks/drafted cards actually live):

- **Deck follows OS wholesale** — swap firmware, swap to that OS's deck. What happens to drafted cards: kept, dropped, or re-draftable?
- **Base-10 swaps, drafted cards persist** — the 10 starting cards trade out for the other OS's 10; everything earned in the run stays.
- **OS locked at recruit** — choosing firmware is a recruit-time identity decision; no mid-run swap (does `FirmwareTerminal` change role?).
- **Swap allowed, deck untouched** — cheapest, but recreates the exact mismatch this map exists to kill (a v1-built deck running under v2).

Also decide: does the *enemy* side (wardens, wild encounters) use per-OS decks, and does the player pick an OS at recruit or get a default?

Numbers to bring: how often OS swapping actually matters today (any telemetry/dev-experience), and per option a worked example — e.g. sleipnir recruited under v1 (five 0-cost cards feeding MOMENTUM_DRIVE), swapped to v2 mid-run: what deck is the player holding under each rule?
