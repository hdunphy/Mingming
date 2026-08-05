# Scenario schema v1

- Type: wayfinder:grilling
- Status: closed
- Assignee: cowork-2026-08-03-opus5
- Blocked by: — ([Engine readiness audit](01-engine-readiness-audit.md) closed)

## Question

What exactly is a scenario, v1? The schema every other surface consumes — launcher composes it, export produces it, sims batch over it, regression tests replay it.

To decide:

- **Two kinds or one?** A *composed* scenario (battle-start setup: player units with species/level/IVs/OS, deck lists, enemy group with per-enemy level/IV/HP/moveset overrides, seed, `enemyMode`, relics, optional gauntlet context) vs a *snapshot* scenario (a full mid-battle `IBattleState`). Export naturally produces snapshots; the launcher naturally produces compositions; sims want compositions. Likely both under one envelope with a `kind` field — confirm.
- **Validation & versioning.** A zod `ScenarioSchema` mirroring `PlayerSaveSchema`'s approach (validate + migrate). What registry-drift protection: a schema `version` int, a registry hash, or both? (Audit gap #8: restored state resolves `dataId`/`activeOS`/hook IDs against module registries with no stamp today.)
- **Serialization policy** for the ~9 optional fields `JSON.stringify` drops (`activeOS`, `enemyMode`, `currentIntent`, …) — normalize on write, or tolerate on read (audit gap #9)?
- **Storage & naming.** Proposed `docs/scenarios/*.scenario.json` checked into the repo; naming convention for bug repros vs balance cases.

Useful facts: `SnapshotPattern.test.ts:17-51` (`createMockState`) is a hand-built full-state template; `SaveSystem.ts:58-70` is the zod precedent; `battleSlice.setBattleState` is the injection point.

## Resolution

Decided 2026-08-03 with Henry (session `cowork-2026-08-03-opus5`). Schema v1 is locked; the
implementation graduates as [Scenario schema & normalizer](10-scenario-schema-implementation.md)
and [Scenario materializer](11-scenario-materializer.md).

### 1. One envelope, two kinds

A single zod `ScenarioSchema`, discriminated on `kind`. Code lands under `src/debug/`
(exact sub-layout deferred to [Debug gating architecture](03-debug-gating-architecture.md),
which owns the `DebugRoot` shape).

```ts
{
  version: number,          // int >= 1; CURRENT_SCENARIO_VERSION = 1
  kind: 'composed' | 'snapshot',
  name: string,
  description?: string,
  tags?: string[],
  registryHash: string,     // see section 2
  createdAt?: string,       // ISO 8601, informational only — never compared
  setup?: ComposedSetup,    // present iff kind === 'composed'
  state?: IBattleState,     // present iff kind === 'snapshot', normalized per section 3
}
```

The launcher writes `composed`; live-battle export writes `snapshot`; batch sims accept both but
may only re-roll the seed on `composed`; the replay suite replays either. One file extension
(`.scenario.json`), one loader, one migration path.

`ComposedSetup` deliberately covers everything the audit found non-composable through the existing
creation path (gaps #1–#5 — seed, per-enemy level/IV/HP, enemy count, `enemyMode`, starting
statuses):

```ts
ComposedSetup = {
  seed: string,
  enemyMode: 'MOVES' | 'CARDS',   // explicit in files; no undefined-means-MOVES on disk
  player: {
    party: PartyMemberSetup[],    // max 3, mirrors PlayerSaveSchema's activeParty cap
    deck: string[],               // card dataIds, expanded to instances at build time
    relics: string[],
  },
  enemies: EnemySetup[],          // explicit list; never the procedural branch
  gauntlet?: GauntletContext | null,
}

PartyMemberSetup = {
  definitionId: string,
  level: int >= 1,
  attackIV / defenseIV / hpIV: int 0..31,   // same bounds as MingmingInstanceSchema
  activeOS?: string,
  currentHp?: int >= 0,                     // omitted = full
  statusEffects?: StatusEffectInstance[],
  moves?: IMove[],
}

EnemySetup = PartyMemberSetup & { maxHpOverride?: int >= 1, deck?: string[] }
```

**Shared-deck watch item.** v1 encodes the *shared* deck as `player.deck`. If the pending
shared-vs-per-mingming deck decision (tracked outside this map) flips, per-member decks move onto
`PartyMemberSetup.deck`, `CURRENT_SCENARIO_VERSION` bumps to 2, and `migrateScenario` lifts the v1
shared list onto each member. The envelope absorbs it; no consumer signature changes. This is the
answer to the map's open fog item on that decision.

### 2. Validation & versioning: version + registry hash, warn-not-block

`parse → migrateScenario → validate`, mirroring `SaveSystem.ts:58-94`. `CURRENT_SCENARIO_VERSION`
starts at 1.

`registryHash` is a content stamp of form `<algoVersion>:<8 hex>` — e.g. `1:9f3ac02b` — computed by
`computeRegistryHash()` as FNV-1a over a canonical string of sorted `id \0 JSON.stringify(def)`
pairs across the **data** registries: Mingming, Program, and firmware/OS. The `algoVersion` prefix
exists so changing *what* is hashed never silently compares apples to oranges.

**The hook registry is deliberately excluded** — it is lazily populated behind
`initFirmwareHooks()`'s `isInitialized` guard (`firmwareRegistry.ts:16,20`), so hashing it would be
timing-dependent. Consequence, recorded knowingly: a changed hook *implementation* will not be
caught by the stamp. Missing hook IDs still surface at resolve time.

On mismatch: a loud banner in the launcher and a `console.warn` in headless sims, **then load
anyway**. Rationale — the failure this guards against is a silent rebalance corrupting a replay
diff; hard-failing would invalidate the entire scenario library on every card tweak during active
content work.

### 3. Optional-field policy: one shared normalizer at write, read, and diff

`normalizeBattleState(state): IBattleState` is the single canonical-form function. Snapshot export
runs it before serializing, the loader runs it after parsing, and the replay assertion normalizes
both sides before comparing. It is the only exported entry point for producing a comparable state.

The ~9 fields split into two classes, because several have no meaningful default and filling them
would require a type change:

**Fill class** (canonical form = key *present*):

| Field | Default |
|---|---|
| `state.enemyMode` | `'MOVES'` |
| `state.lastStatusConsumed` | `0` |
| `state.elementPlays` | zero-filled for every member of the `Element` union |
| `entity.relicBonuses` | `{ draw: 0, energy: 0, attackMod: 1 }` |
| `entity.hooks` | `[]` |
| `entity.activeOS` | `GetMingmingData(definitionId).availableOS[0]` |
| `entity.currentIntent` | `null` (the type is `IMove \| null`, so null is legal) |
| `entity.playsThisTurn` | `0` |

**Strip class** (canonical form = key *absent*; absence is semantically real, not a missing
default): `entity.secondaryElement`, `entity.forcedTargetId`, `entity.nextProgramModifier`,
`entity.moves`.

Envelope fields excluded from every comparison: `createdAt`, `name`, `description`, `tags`. The
diff compares normalized `IBattleState` only, never the envelope.

**Follow-up flagged for [Determinism groundwork](09-determinism-groundwork.md):** `sessionId` is a
compared field and is currently `'battle_' + Date.now()` (`battleFactories.ts:297`). That line was
not on 09's checklist — it has been added there, or replay diffs fail on `sessionId` alone.

### 4. Storage & naming

- Data: `src/debug/scenarios/repro/<slug>.scenario.json` and
  `src/debug/scenarios/balance/<slug>.scenario.json`.
- Under `src/` so `import.meta.glob('./scenarios/**/*.scenario.json')` bundles them into the dev
  build and drops them from production — the same tree-shaking story as the rest of the toolkit —
  while vitest and node sims still read them off disk.
- Subdirectories carry the repro-vs-balance split, so no filename-prefix discipline to erode.
- `<slug>` is kebab-case and describes the *question*, not the fix: `taunt-ignores-forced-target`,
  `kraken-mirror-winrate`.

### Amended 2026-08-03 by [Battle snapshot export](06-battle-snapshot-export.md)

The `snapshot` kind gains an **optional** `tape` field carrying the dispatched-action sequence since
battle start. Optional means **no `CURRENT_SCENARIO_VERSION` bump** — v1 files without it still
validate, and `migrateScenario` stays a no-op. Everything else in this resolution stands.
