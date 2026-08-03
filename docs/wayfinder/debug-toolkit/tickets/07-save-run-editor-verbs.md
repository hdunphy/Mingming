# Save/run editor verbs

- Type: wayfinder:grilling
- Status: closed
- Assignee:
- Blocked by: —

## Question

What can the save/run editor do, and how does it stay safe against the silent-autosave hazard?

To decide:

- **Verb list v1.** Candidates: grant scraps / blueprints / relics / cards; grant XP or set level on a roster mingming; set a mingming's `activeOS` ("unlock OS" has no flag — it's an `activeOS` write; "unlock species" = blueprint grant, per audit); unlock sectors; jump to an arbitrary gauntlet stage (**needs a new reducer** — `updateGauntlet` only increments, audit gap #20); wipe/replace the whole save (`loadSave` exists); "max everything" one-click preset.
- **Safety.** The store autosaves on every game-state change and a schema-invalid save fails *silently* (`store.ts:18-31`, audit gap #18). Rule: every editor mutation dry-runs `PlayerSaveSchema.parse()` before dispatch, and the editor surfaces validation errors loudly. Confirm, and decide whether edits go through existing `gameSlice` actions (preferred per audit) vs a wholesale `loadSave` round-trip.
- **Placement.** Panel inside the Debug tab; anything needed mid-battle stays out of scope here (that's the overlay's job).

## Resolution

Decided 2026-08-03 with Henry (session `cowork-2026-08-03-opus5`). Implementation graduates as
[Save reward actions](18-save-reward-actions.md) and [Save/run editor panel](19-save-run-editor-panel.md).

### 1. Mechanism — existing actions first, general-purpose actions for the gaps, mandatory dry-run

- Edits go through existing `gameSlice` actions wherever one exists, so they inherit the game's own
  logic and invariants (e.g. `addToRoster` also grants the species base deck, `gameSlice.ts:27-36`).
- Where none exists, add a **general-purpose** action — same pattern as
  [Live-manipulation command set](05-live-manipulation-command-set.md) (engine actions) and
  [Battle snapshot export](06-battle-snapshot-export.md) (the store tap). See section 2 for the
  stricter bar Henry set on which gaps qualify.
- **Every edit dry-runs `PlayerSaveSchema.parse()` on the prospective save before dispatch** and
  refuses loudly on failure. This is the whole safety story: `store.ts:20-31` autosaves on every
  game-state change and a schema-invalid save fails with nothing but a `console.error`
  (`store.ts:27`), so progress silently stops persisting and you find out on next reload. Validating
  after the fact would be racing that subscription — the bad state is already live.
- `loadSave` is reserved for wholesale wipe/replace (it accepts exactly what `loadGame` produces).

### 2. Verb list v1 — and the bar for touching production code

Henry's framing, which is stricter and better than the ticket's: **do not add debug code to the
production side at all.** A missing action only qualifies if it is a *genuine game capability* —
something a future card or relic would plausibly grant. The debug panel is then simply its first
consumer, driving it explicitly until the content that uses it exists.

Against that bar the three candidate gaps split cleanly:

| Gap | Verdict | Why |
|---|---|---|
| unlock sector | **In** | A real hole. `unlockedSectors` is written **once**, in `createDefaultSave`/`createStarterSave` (`gameTypes.ts:108,164`), and never again — nothing in the game can unlock a sector today. `SectorTerminal.tsx` only reads it. A "free sector unlock" relic slots straight in. |
| grant XP | **In**, via a dedicated action | See section 3 — this one needed care. |
| jump gauntlet stage | **Out** | No plausible game mechanic grants it. It would be debug-only code in a production slice, which is exactly what the bar forbids. Dropped from v1; audit gap #20 stays open and unfixed by design. |

**v1 verbs:** grant scraps (`addScrap`), blueprints (`addBlueprint`), relics (`addRelic`), cards
(`addCardsToInventory`); add to roster (`addToRoster`); set `activeOS` (`updateMingmingOS`); heal
party (`healParty`); **unlock sector** (new); **grant XP** (new); wipe/replace (`resetSave`,
`loadSave`).

**Not in v1:** jump gauntlet stage (above); a one-click "max everything" preset — a fully maxed save
is an unrepresentative test bed, and as a composite of many writes it is the likeliest thing to
construct an invalid save, which is the failure this ticket exists to prevent.

Naming accuracy, per the audit: "unlock species" is **grant blueprint** and "unlock OS" is **set
`activeOS`**. Neither is a flag — species availability derives from `blueprints`
(`gameTypes.ts:30-34`) and OS availability from the definition's static `availableOS`
(`types.ts:79`). The panel must not promise a concept the save cannot represent.

### 3. XP — a separate action, leaving the reward rule intact

`IRewardBundle` already carries `totalXP` (`gameTypes.ts:48`), but `applyRewardBundle` **deliberately
ignores it** (`gameSlice.ts:169-170`):

> NOTE: The reward bundle intentionally grants NO XP. Roster XP comes exclusively from the in-battle
> death-XP system, persisted via `syncPartyStats`.

That rule **stands**. XP is granted by a new, dedicated `grantExperience(mingmingId, amount)` action
that applies XP and runs the same level-up loop as the battle path — *not* by wiring `totalXP` into
the reward pipeline.

Reasoning recorded because it is a balance decision, not a plumbing one: `calculateDeathXp`
(`effectHandlers.ts:29-50`) was tuned deliberately to fix runaway leveling, so any XP source outside
that system can quietly undo the pacing. Keeping the grant on its own action means a future XP relic
is an explicit, reviewable choice rather than a side effect of a debug panel.

`totalXP` is left in place, still unused. Removing it was considered and rejected as churn outside
this ticket's scope.

### 4. Placement

A panel in the docked Debug tab, per [Debug gating architecture](03-debug-gating-architecture.md).
Nothing save-related goes in the floating overlay — mid-battle needs are the god tools' job.
