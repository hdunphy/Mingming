# Ticket 213: Emoji still in engine data (the battle log's text prefixes and a dead per-status emoji table)

**Type:** decision first, then a small cleanup. **Status:** **OPENED 2026-10-09** (Henry, on item B3 of [206](206-open-decisions-2026-10-08.md): *"Open a new ticket"*). Nothing is built, and the option below is not yet ruled. **Blocked by:** Henry's pick of an option. Nothing else depends on it.

## Why

[Ticket 205](205-emoji-to-tabler.md) swapped every emoji the player sees in the interface for a Tabler icon and added a source scan that fails on any emoji left in the UI. It deliberately left the emoji that live in engine data, because the engine writes plain text and an icon cannot go inline in a string. Henry's earlier answer on 206 B3 was to leave them for now and give them a card of their own; this is that card.

## What is there (counted for 206 B3 on 2026-10-08; recount before building)

About 74 lines in `src/engine`:

| File | Lines |
|---|---|
| `StatusBehaviors` | 19 |
| `statusGlossary.ts` | 14 |
| `ActionExecutors` | 13 |
| `hooks.json` | 11 |
| `effectHandlers` | 10 |
| `battleReducer` | 7 |

They are mostly combat-log prefixes (a shield, a bolt, a heart) plus the stance moon and sun. `statusGlossary.ts` also holds one emoji per status that nothing in the UI reads, so that part is dead data.

## Options (lean first)

| Option | What changes | Cost |
|---|---|---|
| A. **Leave them** | Nothing. The log keeps its emoji | None; the "no emoji on screen" rule has a known exception in the battle log |
| B. **Delete the dead data and the prefixes** | Remove the unused per-status emoji in `statusGlossary.ts`; drop the prefixes from log lines so they read as plain words | Log lines lose their quick visual marker; saved logs and tests that match the text move |
| C. **Draw icons in the log's display code** | Keep the engine text plain, give each log line a kind, and let the log view draw a Tabler icon by kind | The most work; a log line needs a kind field and a map, like the 205 maps |

Lean: **B for the dead data only** (it costs nothing and nothing reads it), then **A or C** for the prefixes once Henry has seen the log in the new biome-order playtest. This is a decision for Henry, not an agent.

## Rows

| Row | What | State |
|---|---|---|
| 213a | Recount the engine-data emoji and list which are dead | **DONE 2026-10-09** (see *213a: the recount* below; nothing deleted): **77 lines in the engine source** (74 hold the character, 3 more write it as a `\u` escape), plus 4 in tests and 4 in the standalone `card-browser.html`. **Dead: 16.** The 14 `icon` lines in `statusGlossary.ts` (nothing reads them) and 2 log lines in executors that no card, hook, Draught or Totem uses (Taunt, Redirect target). **Live: 61** combat-log lines |
| 213b | Delete the dead per-status emoji in `statusGlossary.ts` (no behaviour change) | Not started. **Henry, 2026-10-09: not on its own**; it goes with the rest of 213 when he picks those rows |
| 213c | The prefixes: leave, remove, or draw (A, B or C) | Needs Henry's pick |

## 213a: the recount (2026-10-09, at `9eb2e95`)

**Method.** The character class is the one the 205c guard uses (`src/ui/theme/pictographs.ts`), so "emoji" means here what it means in the UI scan. A line counts once however many emoji it holds. From the repo root, in Git Bash:

```
# a literal emoji character
git grep -nP '[\x{1F000}-\x{1FAFF}\x{2300}-\x{23FF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}\x{21A9}\x{21AA}\x{FE0F}\x{200D}]' -- src/engine
# an emoji written as a \u escape (\x5C is the backslash)
git grep -nP '\x5Cu\{?(1F[0-9A-Fa-f]{3}|2[3-7][0-9A-Fa-f]{2}|2[Bb][0-9A-Fa-f]{2}|[Ff][Ee]0[Ff]|21[Aa][9Aa])' -- src/engine
```

**Result: 82 lines with the character and 3 with an escape.**

| File (under `src/engine`) | Character | Escape | Total | What they are |
|---|---|---|---|---|
| `StatusBehaviors.ts` | 19 | 0 | 19 | Log prefixes: Burn, Poison, Asleep, Regen, Bark Shield, "wore off" |
| `actions/ActionExecutors.ts` | 13 | 1 | 14 | Log prefixes, and the stance moon and sun (line 1345) |
| `data/statusGlossary.ts` | 14 | 0 | 14 | The `icon` field, one per status |
| `data/lib/hooks.json` | 11 | 0 | 11 | `LOG` texts: three Aura cards (`reactive_plating` and its +, `scrubber`, `drip_feed`) and seven Totems |
| `effectHandlers.ts` | 10 | 0 | 10 | Log prefixes |
| `battleReducer.ts` | 7 | 2 | 9 | Log prefixes |
| **Engine source** | **74** | **3** | **77** | |
| `data/card-browser.html` | 4 | 0 | 4 | A standalone dev page (element and category icons) |
| `NewArchetypes.test.ts`, `StanceSystem.test.ts` | 4 | 0 | 4 | Tests that match log text (the Poison and replay prefixes, the moon and sun) |
| **All of `src/engine`** | **82** | **3** | **85** | |

The 2026-10-08 count (about 74) was the character count of the engine source and matches it exactly; the 3 escaped lines were not in it.

**Dead (16 lines in the engine source, plus the dev page):**

1. **`statusGlossary.ts`, the `icon` field: 14 lines**, one per status, the stance moon and sun included. Nothing reads it. Every consumer of the glossary (`git grep -n statusGlossary -- src`: `CardHand`, `CardKeywordChips`, `cardKeywords`, `StatusBadges`, `StatusTooltip`, `CodexScreen`, `HpBar`, the playtest tool's `sideLines`) reads only `.name` and `.description`. `git grep -n "\.icon\b" -- src` outside tests finds only `tab.icon` (`App.tsx`), `f.icon` (`UnitFxLayer.tsx`), `s.icon` (`RanchScreen.tsx`) and `headline.icon` (`RunSummary.tsx`), none of them a glossary entry. The one other mention is the type cast at `CodexScreen.tsx:303`, which declares `icon` and never reads it. The icon on screen comes from `StatusIcon` (Tabler, 200d). This is what 213b would delete.
2. **Two log lines in executors no data reaches: `ActionExecutors.ts:1189` (Taunt) and `:1280` (Redirect target).** Both executors are registered, but no card, hook, Draught or Totem uses the action: `git grep -nE "['\"](TAUNT|REDIRECT_TARGET)['\"]" -- src ':!src/engine/data/archive'` finds only the type in `types.ts`, the registry, the card-text switch in `cardEffectText.ts` (and its test) and the balance tool's list in `powerscale.ts`. This is code rather than data: the lines go live again if a card ever uses one of these actions.
3. **Not engine data: `card-browser.html`, 4 lines.** A standalone page (`77e9e95`, 2026-09-10) that nothing loads: `git grep -n card-browser` outside the file finds nothing.

**Live: the other 61 engine lines.** They are battle-log text. The battle screen's combat log (`CombatLog.tsx`, from `state.battle.battle.logs`) and the exported run log (`runLogMiddleware.ts`) show them, and the `hooks.json` texts reach the log through `HookFactory.ts:267`. Every `hooks.json` entry with an emoji belongs to a card or Totem in play (`programs.json`, `speciesPools.ts`, `driverRegistry.ts`). Not checked: whether every branch inside a live executor can be reached. The 4 test lines would move with any change to the prefixes (213c).

## Resolution

Open.

**Henry, 2026-10-09:** the 16 dead lines 213a found (the 14 `icon` lines in `statusGlossary.ts` and the Taunt and Redirect target log lines) are **not deleted on their own**. They go together with the rest of ticket 213 when he picks its rows (213b, 213c), so the lean above's "B for the dead data only" first step is not taken.
