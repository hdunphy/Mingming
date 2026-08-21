# Ranch-minimal: roster, blueprint-only assembly and reflash, species clause, no XP (ticket 20)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [06](06-run-data-model.md), [21](21-leveling-freeze.md), [23](23-save-v4.md)
- Phase: Vertical Slice

## Deliverable

Bring the existing ranch screens in line with the rulings: `SynthesisLab` assembly costs ONE blueprint (delete the flat `compileCost = 100` scrap), shows the blueprint COUNT per species and explains re-assembly as the re-roll; `FirmwareTerminal` reflash costs one blueprint (delete `OS_SWAP_SCRAP_COST`); `RosterTerminal` drops the XP bar and shows the individual's stat roll; party selection enforces **no duplicate species** (the 3v3 species clause — missing in code today, only documented in `teamComps.ts`); the deck builder (`DeckTerminal`) is removed from the ranch — cards are run-scoped, the team is the deck (keep it reachable as a debug/codex viewer if useful). Tab shell: Ranch replaces Hub/Terminal/Deck/Lab/Relics.

## Done when

The ranch has no scrap, no XP, no deck builder, and no duplicate species in a party; tests updated.

## Resolution

_(open)_

