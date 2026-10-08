# Ticket 200: Swap every code-drawn icon for Tabler Icons

**Type:** UI, art sourcing. **Status:** opened 2026-10-05; **every pick ruled by Henry 2026-10-06; 200a (the picture sheets) done; 200b and 200c BUILT 2026-10-08; 200d and 200e BUILT 2026-10-08 (two swap commits, then the licence); 200f (screenshots) is next.** `@tabler/icons` 3.49.0 is installed (200b), `TablerGlyph` exists (200c), and every screen now draws Tabler (200d). **Blocked by:** nothing.

**Henry (2026-10-05), in his words:**

> *"Yes lets go with Tabler. Skull for poison. Arrows for weakened and str. Stunned should be something else, I think we want to use bolt for energy. Energized should be: recharging. Others are good."* Stunned: **ban**. Follow-up the same day: *"shield up for sharp? Helmet is good for elite. eye is okay for ambush"*: Sharp **shield-up**, elite **helmet**, ambush **eye** (ruled).

**Why.** Every icon in the game today is SVG path data that a coding agent typed in (tickets 34, 182a, 183a, 183b, 183g). Ticket 199 already ruled that agent-drawn glyphs count as AI-generated art, and the standing rule is **no AI-generated art ships**. Steam's AI disclosure form (updated January 2026) asks about AI-generated content "consumed by players" and exempts AI dev tools; agent-drawn icons are a grey area under that wording. Swapping to a human-drawn set closes it. **[Tabler Icons](https://tabler.io/icons)** (MIT, by Paweł Kuna, 5,184 outline icons) uses the same drawing rules as `icons.ts` — 24 grid, stroke only, round caps and joins, `currentColor` — so the Slant kit does not change, only where the shapes come from.

---

## The final mapping (every row ruled; Henry, 2026-10-05 and 2026-10-06)

Rows Henry did not comment on were accepted as proposed on the first sheet. **Do not change a pick.** If a Tabler name turns out to be missing, stop and report; do not draw a replacement (see *How to work*). Every name below was checked against `@tabler/icons` 3.49.0 on 2026-10-06. The three picture sheets show each one: `research/200-icons/sheet.html`, `alternatives.html`, `trace-burn-ambush.html` (PNGs `sheet-N.png`, `alt-N.png` beside them).

### Statuses (`kit/statusIconPaths.ts`)

| Status | Tabler outline icon | Note |
|---|---|---|
| Burn | `flame` | **Chip colour moves** from `#ff6633` to `#ff8a30` so it is not the Fire element's orange (`#f25c2a`). See 200d. |
| Poison | `skull` | |
| Asleep | `zzz` | |
| Weakened | `arrow-big-down` | |
| Strengthened | `arrow-big-up` | |
| Dazed | `spiral` | |
| Sharp | `shield-up` | |
| Stunned | `ban` | |
| Regen | `heart-plus` | |
| Energized | `recharging` | |
| StableOS | `eye` | The game already says **Alert** (`labels.ts`); the type and the key stay `StableOS`. Ambush is also `eye`; Henry: keep both (Alert is a battle chip, Ambush a map node). |
| BarkShield | `wood` | |
| DarkStance | `moon` | |
| LightStance | `sun` | |

### `icons.ts` (`PATHS`; `IconName` stays a closed union)

| Group | Key | Tabler | Note |
|---|---|---|---|
| nav | ranch | `home-heart` | **ruled**; Town stays a cottage, so the two no longer match |
| | debug | `bug` | |
| | expedition | `map` | |
| | roster | `paw` | **ruled**; also the town square's Loadout button and the market face |
| | assembly (reads **Summon**) | `sparkles-2` | **ruled** |
| | vault | `vault` | it is a safe now; the old icon was a gem |
| | codex | `book` | |
| node kinds | wild | `sword` | **ruled**; same shape as the attack stat, never on the same screen |
| | rival | `swords` | check it at 16px on the map: the old comment says crossed blades read as a "close" button |
| | elite | `star` | **ruled** (the helmet is gone) |
| | alpha | `crown` | |
| | ambush | `eye` | |
| | marketplace (the town square's **Shop**) | `building-store` | **ruled** |
| | workshop (the town square's **Den**) | `campfire` | **ruled**; Tabler has no cave. The old Den glyph in `townBuildings.ts` was a hand-typed dome |
| | town | `building-cottage` | |
| | event | `help-circle` | |
| | start | `flag` | |
| | gym | `building-bank` | |
| chrome | sound-on / sound-off | `volume` / `volume-off` | |
| | search, settings, check, trophy, door | same names | |
| | warning | `alert-triangle` | |
| | skull | `grave-2` | **ruled**; the only use is the run summary's lost line (`RunSummary.tsx`), so rename the key to `grave` rather than leave a `skull` that draws a tombstone. Poison keeps `skull` |
| | swap | `arrows-exchange` | |
| | scrap (reads **Amber**) | `hexagons` | **ruled** |
| | blueprint (reads **Trace**) | **layered**: `hexagon` with `lambda` inside | **ruled**; see *The layered glyphs* |
| stats | attack | `sword` | **ruled** |
| | defense | `shield` | |
| | hp | `heart` | |
| | energy | `bolt` | **ruled**; the bolt means energy and nothing else. `EnergyHex` (the number in the yellow hexagon) is unchanged |
| | firmware (reads **Instinct**) | `cpu` | |
| card faces | el-fire / el-water / el-nature | `flame` / `droplet` / `leaf` | |
| | el-none | `circle-off` | |
| | target-enemy | `crosshair` | |
| | target-self | `user` | |

### The map and the town square: one set, not two

**Ruled: the map's separate glyph set goes.** The live map (`RegionMap.tsx`) already draws its nodes from `icons.ts`. `components/map/nodeGlyphs.ts` is a second set (an "R" for rival, an X for fight) used only by `NodeIcon`, the design screen sheet (`src/debug/screenSheet/MapPieces.tsx`) and `map.test.tsx`; no player sees it. In 200d, `NodeIcon` draws the `icons.ts` icon for its kind and the glyph data in `nodeGlyphs.ts` is deleted:

| `NodeIconKind` | `IconName` |
|---|---|
| start / fight / rival / event | start / wild / rival / event |
| elite / gym / detour / town | elite / gym / alpha / town |

Keep `NODE_WORD`, `NODE_SIZE` and `iconKindFor` if anything still uses them; delete only what the swap makes dead.

**The town square has two icon paths too.** `TownSquare.tsx` has `BUILDING_ICON = { shop: 'marketplace', upgrades: 'attack', workshop: 'workshop', loadout: 'roster' }` (icons.ts keys), and `TownButton.tsx` draws `TOWN_BUILDINGS[].glyph` from `townBuildings.ts`. Find out which one the live screen uses (`TownShell.tsx`, `TownSquare.tsx`, `townText.ts` all import something), keep one, delete the other, and report which. The four buttons end up as **Shop `building-store`, Upgrades `arrow-bar-to-up`** (proposed, not objected to; the live code uses the attack sword, so say so in the report), **Den `campfire`, Loadout `paw`**.

### Element marks (`kit/elementGlyphs.ts`)

**Filled** `flame` / `droplet` / `leaf` / `point` in the element colour (fire / water / nature / neutral), with the matching **outline** icon drawn over it in `--ink`, on the white disc. This keeps today's "filled with an ink outline" look. All four filled variants exist. **Ruled: no emoji.** The Codex and the type chart (`cardIcons.ts`'s `getElementIcon`, used by `TypeChart.tsx` and `CodexScreen.tsx`) switch to `ElementMark`; `getCategoryIcon` goes too if nothing renders it.

### The layered glyphs

Tabler has no hexagon lambda, so **Trace is two Tabler icons layered**, which is also how the element marks work. Spec, as drawn on `trace-burn-ambush.html`:

- Outer layer: `hexagon` (outline, full size).
- Inner layer: `lambda`, centred, scaled to **0.56** (`transform="translate(5.28 5.28) scale(0.56)"` on the 24 grid), with the inner stroke set to **3** so it lands near the outer weight after scaling.

Henry chose the hexagon knowing it sits close to Amber's `hexagons` (his call; do not substitute). The renderer (200c) takes a list of layers, each with its nodes, fill, stroke and transform, so the element marks and Trace use the same code. Nothing is hand-drawn: both layers are Tabler's own nodes. Today **no component renders the `blueprint` icon** (`git grep` 2026-10-07 finds it only in `icons.ts` and `labels.ts`), so map it and test it; do not add a Trace icon to any screen unless Henry asks.

## Rows

| Row | What | Blocked by |
|---|---|---|
| 200a | **DONE 2026-10-06.** The picture sheets: `research/200-icons/sheet.html` (today's icon beside the proposal, 16/20/24px on `--panel` and `--card-body`, 7 PNG pages), `alternatives.html` (13 decisions, Henry's notes) and `trace-burn-ambush.html`. Henry ruled every pick from them. | — |
| 200b | **BUILT 2026-10-08 (fb410df2).** **The source.** `npm install --save-dev --save-exact @tabler/icons@3.49.0`. A Node script (`scripts/tabler-icons.mjs`, `npm run icons`; it must run under PowerShell and Git Bash, so plain Node, no shell) reads `tabler-nodes-outline.json` and `tabler-nodes-filled.json` from the package and writes **only the icons in the mapping above** into a generated, committed `src/ui/theme/tabler.generated.ts` (`name -> nodes`, outline and filled kept apart). `npm run icons -- --check` fails if the file is stale. The desktop build is offline: nothing is fetched at runtime, and no icon font. Commit `package.json` and `package-lock.json` with this row only, and touch nothing else in them. | — |
| 200c | **BUILT 2026-10-08 (201afb43), no visible change.** **The renderer.** Tabler icons are `path`, `circle`, `rect`, `line` and `ellipse` elements, not one path string. One small shared component, `TablerGlyph` (layers in, `<svg>` out: each layer has nodes, fill, stroke, optional transform; default `stroke-width` 1.7, round caps and joins, `currentColor`), that `Icon.tsx`, `StatusIcon.tsx`, `ElementMark`, `NodeIcon` and `TownButton` (and `BiomeSign` if it draws one) compose. **Do not grow any of them.** Test first: layered glyph renders both layers; a node list renders the same elements Tabler ships. | 200b |
| 200d | **BUILT 2026-10-08 (two commits), visible change on every icon.** Report: the live town square is `TownSquare.tsx` (its Upgrades button drew the attack sword before); `TownButton` is design-sheet only; both now read `components/map/townIcons.ts`. `nodeGlyphs.ts` became `nodeKinds.ts` (no glyph data). `castSequence.test.ts` pinned Burn's RGB and moved with it. The `layers` prop from 200c is gone: components draw from their own name maps. **The swap.** `PATHS`, `STATUS_ICON_PATHS`, `ELEMENT_GLYPHS` and the town square's icons become name maps into the generated file (one small file per map). `IconName` stays a closed union (rename `skull` to `grave`; keep every other key). Make the changes in *The final mapping*: `NodeIcon` follows `icons.ts` and `nodeGlyphs.ts`'s glyph data is deleted; one town-square icon path; element marks filled + outline; `getElementIcon` emoji gone from the Codex and the type chart; **Burn's chip colour `#ff6633` -> `#ff8a30` in `src/engine/data/statusGlossary.ts` (`STATUS_COLORS.Burn`, line 123; a colour string, no engine behaviour; check no test or doc pins the old value)**. The sweep tests (`Icon.test.tsx`, `StatusIcon.test.tsx`, `ElementMark.test.tsx`, `tokens.test.ts`, `map.test.tsx`) keep passing and gain one check: every mapped Tabler name is present in the generated file. **Delete the hand-typed path data entirely; nothing agent-drawn is left behind.** Then run a sweep for anything else drawn in code (`git grep -n -E "<path d=|<polygon|<polyline|d=\"M" -- src/ui`) and **list what it finds in the report instead of skipping it** (for example `EnergyHex`, route lines, biome signs); anything that is a picture a player sees is a question for Henry, not a silent keep. Status chips draw at 12px: use stroke **2** there (Tabler's own weight; today's 2.5 turns shield-up, wood and spiral to mud at 12px); keep each other surface's current weight; one constant per surface, not per icon. | 200c |
| 200e | **BUILT 2026-10-08.** `public/licenses/tabler-icons-MIT.txt` added and `OFL-Barlow.txt` moved beside it (nothing referenced the old path). The game has no credits or licences screen, so no line was added. **The licence.** Tabler's MIT `LICENSE` (in the package) ships with the game: `public/licenses/tabler-icons-MIT.txt`, next to Barlow's OFL (move `public/fonts/OFL-Barlow.txt` beside it only if nothing references its current path). If the game has a credits or licences screen, add one line: "Icons: Tabler Icons (MIT), Paweł Kuna". | 200d |
| 200f | **Screenshots.** Battle 3v3 (statuses at 12px are the thing to look at), the map, the town square, the ranch, the Codex and the run summary at 1280×800 and 1920×1080 into `research/200-icons/after/`. Henry reviews the status stroke weight from these. | 200d |

## How to work this ticket

1. **Read the whole ticket first.** Search for quoted names; line numbers drift.
2. **No new drawing.** If an icon is missing or a pick fails, stop and report; never draw or edit a path by hand. That is the point of the ticket.
3. **Small pieces** (Henry's standing preference): generated data, one renderer, one small name-map file per screen, composed. No file over ~150 lines added.
4. **Tokens only** (`noHex.test.ts`). Colours come from the kit, never from the SVG.
5. **Test first**, see it fail on the parent ("fails on parent: yes" in the commit message), `npm run gate` green before each commit. The Linux copy cannot run `vite build`; Henry runs the gate once locally before pushing.
6. **Report** in plain English, ending with the decisions Henry owes.

### Other agents are working in this repo at the same time

As of 2026-10-07 the recent commits (ticket 202's night rulings, "playtest fixes") show other work going on in `src/engine/**`, `src/ui/labels/**`, `map.md` and `HANDOFF.md`, and more than one agent can be in this folder at once. This ticket must not collide with them.

- **Branch `first-impressions`. Never switch branches, never push, merge or rebase.** Henry pushes.
- **Before you start and before every commit:** `git status` and `git log -5`. Edit only files in the list below. If a file you need has uncommitted changes you did not make, **stop and tell Henry**; do not edit around them.
- **Stage and commit by explicit path only** (`git commit -- <paths>`). **Never** `git add -A`, `git add .`, `git commit -a`, `git checkout -- .`, `git restore .`, `git reset`, `git stash`, `git clean`, or a repo-wide `eslint --fix` or formatter. Never revert or "fix" another agent's change.
- **One commit per row**, authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`), **no Co-Authored-By**, last line `HANDOFF: <one sentence>`.
- **Shared files:** `package.json` and `package-lock.json` only in 200b (the devDependency and the `icons` script, nothing else). `.gitignore` not at all. In `map.md` and `HANDOFF.md`, change only the 200 lines, and re-read the file immediately before editing, because the other agent edits them too.
- **Git locks:** this machine cannot unlink its own lock files. After a git command, move `.git/*.lock` (and `.git/next-index-*.lock`, `.git/objects/maintenance.lock`) into `_to_delete/git-locks/`, **unless the lock is under a minute old**: another agent may be mid-commit. If `git commit` fails with "Operation not permitted", see *Traps on this machine* in `HANDOFF.md`.
- **If `npm run gate` fails only in files you did not touch,** wait a few minutes and run it again; if it stays red for 20 minutes, stop and tell Henry. Do not commit on a red gate.
- Untracked `.claude/` in the repo root is not yours; leave it.

**Files this ticket owns:** `src/ui/theme/icons.ts`, `Icon.tsx`, `Icon.test.tsx`; `src/ui/theme/kit/` (`StatusIcon.tsx`, `statusIconPaths.ts`, `ElementMark.tsx`, `ElementBadge.tsx`, `elementGlyphs.ts` and their tests, `tokens.test.ts`); `src/ui/components/map/` (`NodeIcon.tsx`, `nodeGlyphs.ts`, `TownButton.tsx`, `townBuildings.ts`, `map.test.tsx`); `src/ui/components/topbar/BiomeSign.tsx`; `src/ui/components/cardIcons.ts` and its two users (`TypeChart.tsx`, `CodexScreen.tsx`); `src/ui/screens/town/` (`TownSquare.tsx`, `TownShell.tsx`, `townText.ts`); `src/ui/screens/RunSummary.tsx` (the `skull` -> `grave` key only); `src/debug/screenSheet/MapPieces.tsx`; new `scripts/tabler-icons.mjs`, `src/ui/theme/tabler.generated.ts`, `public/licenses/`; `research/200-icons/`; the 200 lines of `map.md` and `HANDOFF.md`; and one line, `STATUS_COLORS.Burn`, in `src/engine/data/statusGlossary.ts`. Screens that only call `<Icon name=...>` (ranch, market, run, gauntlet and the rest) need **no** edit because `IconName` stays.

## Not in this ticket

- The Instinct glyphs (ticket 199: AI-drawn and disclosed on Steam, Henry's call).
- The battle VFX (ticket 198). They are procedural code too; whether they fall under the same rule is Henry's call, not this ticket's.
- The Steam AI disclosure answer itself. After this ticket, list what else players see that an agent wrote (card text, names, VFX) before filling in the form.

## Henry's notes on the 200a sheet (2026-10-06, handwritten): how each was answered

Alternatives for each note are on `research/200-icons/alternatives.html` (`alt-1.png` to `alt-4.png`) and `trace-burn-ambush.html` (`alt-5.png`). **All of it is now ruled and folded into *The final mapping* above.**

- **Alert.** StableOS already reads "Alert" in the game (`labels.ts`); only its icon (`diamond`) is open. Options on the sheet.
- **Light Stance vs Sun Eater.** A name, not an icon, so outside this ticket. Henry thinks Sun Eater changes (Sun Devourer? Sköll's Instinct?). Which thing is meant (the Sun Devourer card, Sun-Eater's Plunge, or Sköll v2's Instinct Sunscorch) is a question for Henry; it goes in its own ticket once answered. Light Stance keeps `sun`.
- **Roster** (reads as people), **Summon** (ranch section, wants a magic feel), **Den** (the town square's `workshop` button; Tabler has no cave), **Shop** (tent), **Ranch** (same as Town; change Ranch), **Wild vs attack** (both `sword`; they never share a screen), **Elite** (helmet looks out of place; chess knight or star?), **chrome skull** (same as Poison; tombstone?), **Trace** (more runic; Tabler has no runes), **Burn vs Fire** (both `flame`): alternatives for each on the sheet. **Amber** options added by me because a hexagon Trace would sit next to the `hexagons` Amber.
- **Map and Town sets (page 5 of the first sheet).** Henry: should they be the same? Yes. The live map (`RegionMap`) draws from `icons.ts`; `nodeGlyphs.ts` and `NodeIcon` are used only by the design screen sheet (`debug/screenSheet/MapPieces.tsx`) and a test. **Plan for 200d:** delete `nodeGlyphs.ts`'s separate set and point the screen sheet at `icons.ts`, so one kind of node has one icon. The `townBuildings.ts` glyphs (Shop, Upgrades, Den, Loadout) are live and are swapped.
- **Ruled: use element marks, not emoji** (Codex and type chart move to `ElementMark` in 200d).

**Outside this ticket, still Henry's to answer:** "Light Stance conflicts with Sun Eater; I think Sun Eater has to change." Which thing is renamed (the Sun Devourer card, the Sun-Eater's Plunge card, or Sköll v2's Instinct Sunscorch) is not decided; it becomes its own ticket once he says. Light Stance keeps `sun`.
