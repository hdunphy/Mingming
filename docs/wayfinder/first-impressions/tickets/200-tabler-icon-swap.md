# Ticket 200: Swap every code-drawn icon for Tabler Icons

**Type:** UI, art sourcing. **Status:** opened 2026-10-05, ruled by Henry, not started. **Blocked by:** nothing (do it after 194 lands so the files are settled).

**Henry (2026-10-05), in his words:**

> *"Yes lets go with Tabler. Skull for poison. Arrows for weakened and str. Stunned should be something else, I think we want to use bolt for energy. Energized should be: recharging. Others are good."* Stunned: **ban**. Follow-up the same day: *"shield up for sharp? Helmet is good for elite. eye is okay for ambush"*: Sharp **shield-up**, elite **helmet**, ambush **eye** (ruled).

**Why.** Every icon in the game today is SVG path data that a coding agent typed in (tickets 34, 182a, 183a, 183b, 183g). Ticket 199 already ruled that agent-drawn glyphs count as AI-generated art, and the standing rule is **no AI-generated art ships**. Steam's AI disclosure form (updated January 2026) asks about AI-generated content "consumed by players" and exempts AI dev tools; agent-drawn icons are a grey area under that wording. Swapping to a human-drawn set closes it. **[Tabler Icons](https://tabler.io/icons)** (MIT, by Paweł Kuna, 5,184 outline icons) uses the same drawing rules as `icons.ts` — 24 grid, stroke only, round caps and joins, `currentColor` — so the Slant kit does not change, only where the shapes come from.

---

## The ruled mapping (statuses — Henry's picks, do not change)

| Status | Tabler outline icon |
|---|---|
| Burn | `flame` |
| Poison | `skull` |
| Asleep | `zzz` |
| Weakened | `arrow-big-down` |
| Strengthened | `arrow-big-up` |
| Dazed | `spiral` |
| Sharp | `shield-up` |
| Stunned | `ban` |
| Regen | `heart-plus` |
| Energized | `recharging` |
| StableOS | `diamond` |
| BarkShield | `wood` |
| DarkStance | `moon` |
| LightStance | `sun` |

**Energy is `bolt`** (the `energy` icon in `icons.ts`). The bolt means energy and nothing else from here on. `EnergyHex` (the number in the yellow hexagon) is unchanged.

## The proposed mapping (everything else — Henry rules on the picture sheet in 200a)

Every name below exists in `@tabler/icons` 3.49.0 (checked). Where two things would share a shape, it is called out.

| Where | Key | Proposed | Note |
|---|---|---|---|
| `icons.ts` nav | ranch | `home` | |
| | debug | `bug` | |
| | expedition | `map` | |
| | roster | `users` | |
| | assembly | `flask` | |
| | vault | `vault` | |
| | codex | `book` | |
| `icons.ts` node kinds | wild | `sword` | |
| | rival | `swords` | |
| | elite | `helmet` | **ruled**; avoids sharing `skull` with Poison |
| | alpha | `crown` | |
| | ambush | `eye` | **ruled**; `alert-circle` was considered and dropped: it reads as UI chrome and is a circle-with-a-mark like `event`'s `help-circle` |
| | marketplace | `shopping-cart` | |
| | workshop | `tool` | |
| | town | `building-cottage` | |
| | event | `help-circle` | |
| | start | `flag` | |
| | gym | `building-bank` | columns and a pediment, as today |
| `icons.ts` chrome | sound-on / sound-off | `volume` / `volume-off` | |
| | search, settings, check, trophy, door | same names | |
| | warning | `alert-triangle` | |
| | skull | `skull` | |
| | swap | `arrows-exchange` | |
| | scrap | `hexagons` | |
| | blueprint | `file-code` | Tabler has no `blueprint` |
| `icons.ts` stats | attack | `sword` | |
| | defense | `shield` | Sharp is `shield-up`, so the plain shield stays the stat |
| | hp | `heart` | |
| | energy | `bolt` | **ruled** |
| | firmware | `cpu` | |
| `icons.ts` card faces | el-fire / el-water / el-nature | `flame` / `droplet` / `leaf` | |
| | el-none | `circle-off` | |
| | target-enemy | `crosshair` | |
| | target-self | `user` | |
| `map/nodeGlyphs.ts` | start / fight / rival / event | `flag` / `sword` / `swords` / `help-circle` | match `icons.ts` |
| | elite / gym / detour / town | `star` / `crown` / `route` / `building-cottage` | |
| `map/townBuildings.ts` | shop / upgrades / den / loadout | `shopping-cart` / `arrow-bar-to-up` / `building-arch` / `cards` | |
| `kit/elementGlyphs.ts` | fire / water / nature / neutral | **filled** `flame` / `droplet` / `leaf` / `point` in the element colour, with the matching **outline** icon drawn over it in `--ink` | keeps today's "filled with an ink outline" look; all four filled variants exist |
| `cardIcons.ts` emoji | element icons on the Codex and the type chart | `ElementMark` | the last emoji on screen go; `getCategoryIcon` likewise if anything still renders it |

---

## Rows

| Row | What | Blocked by |
|---|---|---|
| 200a | **Picture sheet first.** One HTML page, old icon beside proposed Tabler icon for every row above, at 16, 20 and 24px on `--panel` and on `--card-body`, plus a 1280×800 PNG. Into `docs/wayfinder/first-impressions/research/200-icons/`. **Stop and report; Henry rules the proposed rows before 200b.** | — |
| 200b | **The source.** Add `@tabler/icons` pinned at `3.49.0` as a devDependency. A script (`scripts/tabler-icons.mjs`, `npm run icons`) reads `tabler-nodes-outline.json` / `tabler-nodes-filled.json` and writes **only the icons we use** into a generated, committed `src/ui/theme/tabler.generated.ts`. The desktop build is offline: nothing is fetched at runtime, and no icon font. | 200a |
| 200c | **The renderer.** Tabler icons are `path`, `circle`, `rect` and `line` elements, not one path string, so `Icon.tsx`, `StatusIcon.tsx`, `ElementMark`, `NodeIcon`, `TownButton` and `BiomeSign` render a node list. One small shared component (`TablerGlyph`: nodes in, `<svg>` out, `stroke-width` 1.7 to keep today's weight) that each of them composes; do not grow any of them. | 200b |
| 200d | **The swap.** `PATHS`, `STATUS_ICON_PATHS`, `NODE_GLYPHS`, `TOWN_BUILDINGS[].glyph`, `ELEMENT_GLYPHS` become name maps into the generated file. `IconName` stays a closed union; the existing sweep tests (`Icon.test.tsx`, `StatusIcon.test.tsx`, `tokens.test.ts`) keep passing and gain one check: every mapped Tabler name is present in the generated file. Delete the hand-typed path data entirely; nothing agent-drawn is left behind. Replace the `cardIcons.ts` emoji. | 200c |
| 200e | **The licence.** Tabler's MIT `LICENSE` ships with the game: `public/licenses/tabler-icons-MIT.txt`, next to Barlow's OFL (move `public/fonts/OFL-Barlow.txt` beside it only if nothing references its current path). If the game has a credits or licences screen, add one line: "Icons: Tabler Icons (MIT), Paweł Kuna". | 200d |
| 200f | **Screenshots.** Battle 3v3, the map, the town square, the ranch, the Codex at 1280×800 and 1920×1080 into `research/200-icons/after/`. | 200d |

## How to work this ticket

1. **Read the whole ticket first.** Search for quoted names; line numbers drift.
2. **No new drawing.** If an icon is missing or Henry rejects a pick, choose another Tabler icon and show it; never draw or edit a path by hand. That is the point of the ticket.
3. **Small pieces.** Generated data, one renderer, name maps per screen. No file over ~150 lines added.
4. **Tokens only** (`noHex.test.ts`). Colours come from the kit, never from the SVG.
5. **Gate:** `npm run gate` green before each commit. Commits authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`), no Co-Authored-By, last line `HANDOFF: <one sentence>`. One commit per row. **Do not push.**
6. **Report** in plain English, ending with the decisions Henry owes.

## Not in this ticket

- The Instinct glyphs (ticket 199, Henry draws them).
- The battle VFX (ticket 198). They are procedural code too; whether they fall under the same rule is Henry's call, not this ticket's.
- The Steam AI disclosure answer itself. After this ticket, list what else players see that an agent wrote (card text, names, VFX) before filling in the form.
