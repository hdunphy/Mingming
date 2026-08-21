# Gap audit: what the codebase already covers (ticket 01)

- Type: wayfinder:research
- Status: closed
- Assignee: wayfinder (charting session)
- Blocked by: —
- Phase: Foundations

## Question

What does the current build (post archetype-web merge) already provide for each of the vision's workstreams, and where are the gaps? Run structure, ranch, economy, persistence, 3v3 game-side, onboarding, shipping/packaging, art, audio, content counts, quality.

## Resolution

Resolved in the charting session (2026-08-21). Full findings: [research/01-gap-audit.md](../research/01-gap-audit.md). Headlines:

- **Strong:** headless engine (216 cards, 16 species, 33 OS, 773 tests, seeded PRNG), 3v3 engine + UI already real (parties, shared deck, per-entity energy, `sourceId` casting), persistence (zod schema v3 + migrations + slots), the debug toolkit, preview-parity gate.
- **Partial:** gauntlet (procedural stand-ins, no authored bosses), rewards (pick-1-of-3 exists but XP/level-scaled), ranch (assembly + reflash exist but cost SCRAP and roll IVs 0–31), relics (4-item stub — superseded by Drivers), art (13 tiny SVG placeholders + 3 PNG, one 7 MB), audio (20 procedural SFX, no music).
- **Missing outright:** any run object / region graph / node map, marketplace, workshop node, events, elites, Macros, Drivers, difficulty tiers, codex, onboarding, settings screen, fullscreen/resolution handling, gamepad, error boundaries, desktop wrapper, Steamworks, CI test gate, app icon.
- **Contradictions to retire:** leveling is still everywhere (`level`, `experience`, XP bar, `avgPlayerLevel` scaling, `levelUp` SFX); `docs/roadmap.md` and `docs/tech_bible.md` are stale (Zustand mandate, Electron as a one-liner); `vite.config.ts` `base: '/Mingming/'` blocks any non-Pages build.
