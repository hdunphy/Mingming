# Run data model: what a run IS in state, and save schema v4 (ticket 06)

- Type: wayfinder:prototype
- Status: closed
- Assignee: legion-02 (2026-08-21)
- Blocked by: [01](01-gap-audit.md)
- Phase: Vertical Slice

## Question

Today there is no run object — "run" is the whole save, and defeat calls `resetSave`. The rulings need a real `IRunState` next to the persistent ranch. Prototype the TypeScript types + zod schema (no UI) and walk Henry through them:

- **Persistent (ranch):** roster of assembled individuals with their stat rolls + active OS; blueprint inventory as COUNTS per species (consumable); codex (seen/played); unlocked tiers/gyms; settings. **No `cardInventory`, no `scrapCount`, no `level`/`experience`.**
- **Run-scoped (`IRunState`):** seed, chosen gym, the three biomes, region graph + node states + current node, party (ids into the roster, max 3, no duplicate species), the shared run deck (card instance ids), scrap, Macro slots (3), Drivers, run modifiers, tier, fight count/clock, gauntlet progress (HP carry-over, the `persistedStats` idea already in `IGauntletState`).
- Migration v3 → v4: what happens to existing saves (convert `cardInventory`/`activeDeck` away; `blueprints` from dedup'd list to counts; drop scrap).

Open sub-questions to settle WITH Henry: does an in-progress run survive app close (yes — Steam players expect it; then the run state lives in the save) and is there one run slot or several.

## Done when

`src/engine/runTypes.ts` + `RunStateSchema` exist with tests for the v3 → v4 migration, and Henry has ratified the shape. This ticket gates everything in the Vertical Slice.

## Resolution

Closed 2026-08-21. **`src/engine/runTypes.ts` + 25 tests, all green** (`runTypes.test.ts`). Suite 902 → 927; `tsc -b` clean, build clean, lint count unchanged at 510. Nothing imports the file — [ticket 23](23-save-v4.md) lands it in `SaveSystem.ts`.

The done-when's "tests for the v3 → v4 migration" is **void** — see ruling 3. Everything else is met.

### The line the model draws

If a field is in `IRunState` it is destroyed at run end and cannot inflate the next run; if it is in `IRanchState`, someone has to justify why it can. That is `economy-session.md`'s anti-mudflation argument expressed as a type rather than as discipline.

Ranch keeps exactly four things: assembled individuals (id, species, OS, three IVs — **no `level`, no `experience`**, per ticket 21), blueprint **counts**, the codex, and gyms/tier cleared. Everything else is run-scoped.

Biggest departures from v3: `cardInventory`, `activeDeck` and `scrapCount` leave the permanent save entirely; `blueprints` flips from an array deduplicated on `architectureId` — the exact opposite of a consumable — to counts per species; `unlockedSectors` is superseded by gyms/tiers and the four legacy relics by run-scoped Drivers.

Two design details worth keeping. **Node contents are never stored, only `kind`** — `exploration-map.md` rules "types visible, contents hidden", so what is inside a node is rolled from the run seed at entry; storing a pre-rolled encounter would be the easy version and it would leak through any save-file inspector. And **`visited` is a count, not a boolean**, because the graph explicitly allows farming ("room to FARM if you don't feel ready") and a cleared node has to be re-enterable without pretending it was never cleared. The payout falloff on re-entry is an economy question — flagged to [ticket 12](12-rewards-refit.md), not decided here.

### Henry's rulings, 2026-08-21

1. **An in-progress run survives closing the app; ONE run slot.** `run: IRunState | null`. All of a run's procedural content derives from one stored `seed` plus node state, so resume is cheap.
2. **Ranch and run live under SEPARATE STORAGE KEYS**, written independently. Blast radius then matches what is irreplaceable: a corrupt run costs a run, never an individual or a blueprint. What that costs is below.
3. **Save v4 is a CLEAN BREAK — no v3 → v4 migration.** Rationale and the delete-list are in [ticket 23](23-save-v4.md). The evidence that made it safe: **the repo contains no v3 save fixtures at all.** This ticket's own text (and 23's) claimed "existing playtest saves in `playtest-results/`" — they are not saves. All 14 files there are battle snapshots (`{"kind":"snapshot"}`) on `debug/scenarios/scenarioIO.ts`'s independent `registryHash` versioning. The only v3 data anywhere is in Henry's own browser.
4. **Assembly costs a blueprint at the ranch, and a blueprint PLUS scrap at a mid-run workshop.** This resolves a **direct contradiction between two binding docs**: `vision.md` (2026-08-19) says "route to a WORKSHOP node and spend SCRAP to assemble a blueprint into the team"; `economy-session.md` (2026-08-20) says "assembly (ranch AND workshop) costs blueprints only". The ruling makes each true of the place it was describing. **Consequence to design around: mid-run recruiting now competes with the marketplace for the same run currency** — growing the team vs sharpening the deck becomes a real route decision — while between runs a blueprint is always spendable, so a dead run's payout can never be stranded. The scrap number is **not** set here; [ticket 14](14-workshop-node.md) owns it and has been amended.

### Two keys, and the reconciliation that pays for them

One blob made "the run and the ranch agree about who is in your party" free. Two keys make it something that can tear — the process dies between two `setItem` calls and the run claims three members while the ranch knows two. So `reconcileLoadedState(rawRanch, rawRun)` is now an explicit, pure, tested step, carrying one law:

> **The run is always the disposable half.** Anything that cannot be reconciled discards the run and keeps the ranch. There is deliberately **no repair** — a run whose party is wrong is a run whose deck, scrap and node state are all suspect, and half-repairing it produces a subtler bug than discarding it.

| Situation | Result |
|---|---|
| ranch fails to parse | no state at all (a run without a roster is meaningless) |
| run fails to parse | ranch intact, `discarded: 'run-schema-invalid'` |
| party names a member the ranch has never heard of | ranch intact, `discarded: 'party-references-missing-member'` |
| party has two of the same species | ranch intact, `discarded: 'party-has-duplicate-species'` |

**This is the first place the no-duplicate-species law is enforced anywhere.** It is a standing law (map § Notes), `debug/balance/teamComps.ts` records it as an open question, and gap audit §5 confirms no game code checks it. It could not have been a schema refinement under either storage shape — it needs the roster to resolve `partyIds` — which is likely why it went unenforced this long.

### A bug the prototype's own tests caught, that ships in v3 today

The first draft copied v3's habit of `.catch([])` on optional save fields. The test written to prove blueprint counts work failed instead: **`.catch` replaces malformed input with the fallback and lets the parse SUCCEED**, so one corrupt count would have silently reset the player's entire permanent inventory to empty — and autosave would then write that emptiness over the good save on the very next state change.

Switched to `.default()`, which fills a **missing** field but fails on a **malformed** one. A failed parse is the outcome we want: ticket 04's `loadGame` treats it as corruption and the last good save survives. Losing a session beats silently voiding the only persistent currency in the game.

**v3 has this exact pattern live right now** — `PlayerSaveSchema` uses `.catch([])` on `blueprints`, `relics`, `unlockedSectors` and `baseDecksGranted`. Harmless when blueprints were a list nobody could spend; not harmless once they are currency. Flagged into ticket 23 rather than fixed from a prototype ticket.

### What this unblocks, and what it amended

Gates the whole Vertical Slice: **07, 09, 10, 11, 12, 18, 19, 20 and 23 can now start.** Amended by this ticket: [23](23-save-v4.md) (two keys, no migration, the delete-list, `.catch` → `.default`) and [14](14-workshop-node.md) (blueprint + scrap, and it owns the number).

Deliberately left open, each with an owner: node re-entry payout falloff → [12](12-rewards-refit.md); the revive's shape → deferred to playtesting by `economy-session.md`, and `IGauntletProgress.downedMemberIds` supports either candidate shape; reward-pool source (`economy-session.md`'s last open item) → does not change these types, since pools derive from `partyIds`; whether a party member can ever leave mid-run → `IRunCard.ownerId` is carried as write-only bookkeeping so the answer stays cheap either way.

