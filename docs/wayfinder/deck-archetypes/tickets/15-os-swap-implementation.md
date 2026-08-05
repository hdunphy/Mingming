# OS-swap implementation: pick-2 grant, blueprint cost, terminal rework

- Type: wayfinder:task
- Status: open
- Assignee: —
- Blocked by: [03-os-swap-deck-rules](03-os-swap-deck-rules.md) (closed — rules are final there)

## Question

Implement the [OS-swap rules](03-os-swap-deck-rules.md):

1. **Cost & gate** — swap requires and **spends** 1 blueprint (`blueprintsCollected`, per the member) + 25 scrap. `FirmwareTerminal.tsx` reads `availableOS` instead of hardcoding `_v1/_v2`, shows both costs, disables when either is missing.
2. **Pick-2 grant** — on first swap to an OS whose kit was never granted: present that OS's starting deck (via `getDeckForOS`) and let the player pick `OS_SWAP_PICK_COUNT = 2` cards into `cardInventory` (tunable constant, playtest may raise). Repeat swaps grant nothing.
3. **Grant keying** — `baseDecksGranted` moves from species ids to **species+OS keys** (e.g. `kraken:kraken_v1`); `migrateSave` step reinterprets an existing species id as "granted for the OS the member currently runs" (the rule the [data-model audit](../research/02-data-model.md) pre-approved); `PlayerSaveSchema` updated. Compile-time grant (`addToRoster`) writes the compiled OS's key.
4. **Reducer** — one `swapOS` action replacing the bare `updateMingmingOS` for player-facing swaps: validates costs, spends blueprint + scrap, sets `activeOS`, applies the pick grant. Dry-run `PlayerSaveSchema.parse()` before dispatch per the standing autosave rule.
5. **Tests + gates** — reducer tests (cost spending, once-per-OS pick, migration), full gates; `npm run balance` untouched by construction (sims don't swap) — verify identical.

Out of scope here: enemy firmware/per-OS enemy decks (ruled out of the map — see Out of scope; CARDS mode stays alive via the balance suite).
