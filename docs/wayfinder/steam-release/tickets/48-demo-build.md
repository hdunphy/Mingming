# Demo build: a capped run for Next Fest and the store page (ticket 48)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [42](42-desktop-packaging.md), [43](43-steamworks-integration.md), [25](25-vs-playtest.md)
- Phase: Steam

## Deliverable

A separate Steam demo app (free, its own App ID — created under the main app in Steamworks) built from the same codebase behind a `DEMO` flag: one gym offer, tier 1 only, a subset of species as starters, the full run loop, codex and ranch persistence limited to the demo, a "Wishlist the full game" end card. Demo saves must not break the full game's save. Keep the demo updated from `main` so Next Fest feedback hits current balance.

## Done when

Demo app live (Coming Soon or released as demo), a full demo run takes 35–45 minutes, CI builds it alongside the main app.

## Resolution

_(open)_

