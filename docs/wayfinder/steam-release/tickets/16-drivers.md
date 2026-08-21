# Drivers: the 8 ruled party-wide passives (proc-visible) (ticket 16)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [06](06-run-data-model.md), deck-archetypes [109](../../deck-archetypes/tickets/109-3v3-pricing-and-canary.md)
- Phase: Vertical Slice

## Deliverable

Implement the 8 ruled Drivers as party-wide hooks (a weaker OS for the whole party): Third Strike, Static Field (zoo-compounding flag), Antivenom, Overkill Recovery, First Blood, Element Drivers (one per element), Bulwark Reflex, Deep Cache. Law: PROC-VISIBLE — every Driver names a trigger moment and the UI flashes it when it procs; no invisible flat-% passives. Storage: `drivers` on `IRunState`, applied at battle creation the way `relics` are today in `battleFactories.ts:117-140` — then DELETE the 4-relic stub (`relicRegistry.ts`, `RelicTerminal.tsx`): Drivers supersede relics. Never call them relics.

**Blocked by deck-archetypes 109:** every Driver goes through the OS/daemon compounding canary before shipping; this ticket may implement behind a flag while 109 is open but cannot close until the check is run and numbers are recorded.

## Done when

8 Drivers implemented with proc VFX/SFX + tooltip, canary numbers recorded, relic code removed, tests green.

## Resolution

_(open)_

