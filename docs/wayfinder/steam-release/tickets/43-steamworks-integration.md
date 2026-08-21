# Steamworks integration: init, overlay, achievements, Steam Cloud (ticket 43)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [41](41-steamworks-account.md), [42](42-desktop-packaging.md), [44](44-achievements-design.md)
- Phase: Steam

## Deliverable

Wire `steamworks.js` (or the ratified binding): `steam_appid.txt` for dev, init on launch with a no-Steam fallback (the game must still run without Steam for the web/dev builds), overlay verified (wrapper flags), achievements from ticket 44's list via a small `achievements.ts` that listens to the same event stream the codex uses, stats if needed, Steam Cloud via Auto-Cloud on the save directory (no code) or the Cloud API (code) — choose the simpler that survives the slot layout. Document the Steamworks dashboard settings in `steam/README.md`.

## Done when

An achievement unlocks in a Steam dev build, the overlay opens, and a save round-trips through Steam Cloud on two machines.

## Resolution

_(open)_

