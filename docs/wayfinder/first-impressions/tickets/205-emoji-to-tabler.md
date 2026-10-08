# Ticket 205: Emoji and symbol characters on screen become Tabler icons

**Type:** UI, art sourcing (follow-up to [ticket 200](200-tabler-icon-swap.md)). **Status:** **BUILT 2026-10-08** (205a the picture sheet, 205b the swap, 205c the guard). **Blocked by:** nothing. Henry's decision on the engine-data log emoji (see *Not in this ticket*) is open and does not block this.

**Henry (2026-10-08), answering the 200d report's sweep of leftovers:** *"yes take care of the emoji's"*. The standing rules: no AI-generated art ships; the 2026-10-05 ruling "no emoji" for the Codex and the type chart (done in 200d) now extends to every other player-visible emoji. The hill polygons in `BiomeBackdrop` stay (Henry: keep). Do not redesign.

**Why.** Ticket 200 replaced every code-drawn icon, but emoji and symbol characters were still on screen: the card effect lines in the hand, the enemy intent icons, the type chart's DNA button and footer, the TERMINATED mark, warning and tick marks, and the Codex stars. An emoji is a font glyph the player's machine chooses (a different picture on Windows, macOS and Linux, and none at all on some) and it ignores `color`. Tabler icons drawn inline at text size fix both, and they are human-drawn (MIT).

## The final map (every symbol, the Tabler icon, where)

Every pick is one name in one small map file. A pick Henry dislikes is a one-word change plus `npm run icons`. The picture sheet is `research/205-emoji/sheet.html` (PNG pages `sheet-1.png` to `sheet-4.png`).

| Old symbol | Tabler name | Meaning | Where (map file) |
|---|---|---|---|
| sword emoji | `sword` | attack, recoil | card effect lines `ATTACK`; enemy intent Attack |
| green heart | `heart` | heal | `HEAL` |
| four-point star (bullet) | `point` | apply a status | `STATUS` |
| two four-point stars | `multiplier-2x` | doubles a status | `MULTIPLY_STATUS` |
| heavy x | `x` | clears a status | `CLEANSE` |
| bolt | `bolt` | energy and nothing else | `ENERGY`, `MAX_ENERGY` |
| playing card | `cards` | draw | `DRAW` |
| wastebasket | `trash` | discard | `DISCARD`, `FORCE_DISCARD` |
| flame | `flame` | exhaust | `EXHAUST` |
| left hook arrow | `arrow-back-up` | return from discard | `RETURN` |
| magnifier | `search` | search the deck | `SEARCH` |
| sparkles | `sparkles` | adds a card | `GENERATE_CARD` |
| stopwatch | `stopwatch` | a status ticks now | `TRIGGER_STATUS` |
| clockwise arrow | `repeat` | replay the last card | `PLAY_LAST_CARD` |
| shield | `shield` | taunt; enemy intent Defend; the absorbed float | `TAUNT`; intent; `useBattleVfx` |
| up arrow | `arrow-up` | strengthens the next card | `BUFF_NEXT_PROGRAM` |
| right hook arrow | `arrow-ramp-right` | redirects the attack | `REDIRECT_TARGET` |
| half moon | `contrast` | shifts stance | `SHIFT_STANCE` |
| recycle | `recycle` | revive | `REVIVE` |
| warning sign | `alert-triangle` | Requirements; the save-health banner | `CardHand`; `SaveHealthBanner` |
| tick | `check` | a conditional is met; a legal target; COPIED | `CardHand`; `MingmingUnit`; `ErrorBoundary` |
| potion | `flask` | enemy intent Debuff | `MingmingUnit` |
| glowing star | `star` | enemy intent, anything else | `MingmingUnit` |
| skull | `grave-2` | TERMINATED (the skull stays Poison's) | `UnitFxLayer` |
| DNA | `dna` | the type chart button | `TypeChart` |
| bolt (STAB footer) | `circle-plus` | the STAB bonus; **not the bolt, because the bolt means energy only** | `TypeChart` |
| filled star / empty star | `star` filled / `star` outline | Codex milestone reached / not reached | `CodexScreen` |

## Rows

| Row | What |
|---|---|
| 205a | **BUILT 2026-10-08.** The picture sheet: every distinct symbol beside its proposed Tabler icon at 12, 16 and 20 px on `--panel` and `--card-body`, with the file and the meaning (`research/205-emoji/`). |
| 205b | **BUILT 2026-10-08.** The swap: `InlineIcon` (a Tabler glyph at text size, colour `currentColor`), one small name map per surface, the names added to `scripts/tabler-icons.names.json` and generated with `npm run icons`. |
| 205c | **BUILT 2026-10-08.** The guard: a source scan that fails on any emoji or pictographic character in `src/ui` (the allow-list names only the Instinct glyph folder and the punctuation set), and the "in-battle phase two" exemption in `Icon.test.tsx` is gone. |

## Not in this ticket

- The emoji prefixes inside battle-log lines held in engine data (`src/engine/data/lib/hooks.json`, a few engine strings): the engine writes them into the combat log and ticket 195e-2 reworded them for words. Moving them is a separate decision for Henry.
- The Instinct glyph pictures (ticket 199).
- The `BiomeBackdrop` hills and the drag-targeting line (Henry: keep).
- Plain text arrows and shapes used as typography (right and left arrows, small triangles, double arrows); they are not emoji.
