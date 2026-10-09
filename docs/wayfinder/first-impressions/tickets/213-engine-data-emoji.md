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
| 213a | Recount the engine-data emoji and list which are dead | Not started |
| 213b | Delete the dead per-status emoji in `statusGlossary.ts` (no behaviour change) | Not started; needs Henry's pick |
| 213c | The prefixes: leave, remove, or draw (A, B or C) | Needs Henry's pick |

## Resolution

Open.
