# Ticket 183: Art direction and UI kit

**Type:** design, then UI. **Status:** RULED (Henry, 2026-10-02): direction **B, "Slant"**, built on the existing battle geometry, and all seven decisions answered (D1–D7 at the bottom). **Rows 183a–183e are buildable now, in order.** 183f and 183h wait on ticket 182 landing; 183g waits on 183a.  **Ticket 176 (map and town redesign) stays blocked until 183a–183c ship; then 176c and 176e are drawn in this kit** (see "What this does to ticket 176").

**Henry (2026-10-02), in his words:**

> *"I like my battle screen I think it just needs a color and shape facelift to match the new direction."*
>
> *"I like B although the cards are missing a lot of stuff from the current cards. We need element type icons for color blind players. I also like the damage previews on the card."*
>
> *"Energy is one of the most important symbols here and it doesn't read well. Would a number in a shape/icon read better? Also it should probably be on the top bar."*
>
> *"I think STAB should just be the element color being highlighted along with the border. A tooltip should tell you it means Same Type Attack Bonus."*

**Where this comes from.** Henry watched Indie Game Clinic's *The Hidden Cost of Vibe-coding Games* (2026-10-01) and asked whether Mingming's UI reads as AI-made. Walked on the v0.3.5 build: it does, strongly. Dark navy, Courier monospace, neon-glow bordered cards, pill tab nav, tip panels with Got it / Skip tips, a paragraph of copy on every screen, an SVG node graph for a map. Nothing on any screen could only belong to Mingming. The words were cut in **ticket 182**. This ticket is the look.

**References (all in the "Mingming Battle Screen — Pokémon direction" Design canvas, top row = direction B):**

- `B · Battle 3v3`, `B · Battle 2v2`, `B · Battle 1v1`: the battle screen in the kit, drawn on the real `stageGeometry.ts` numbers.
- `B · Kit and card anatomy`: the card at 2× with callouts, the plaque at 2×, colours, element marks, HP steps, chips.
- `B · Map (176e)`, `B · Town square (176c)`, `B · Town — inside the Shop (176c)`: ticket 176's screens in the kit (second row of the canvas).
- **In the repo, self-contained (fonts and placeholder art beside them, nothing fetched):** `docs/wayfinder/first-impressions/research/183-mocks/` — `183-battle-3v3/2v2/1v1.html`, `183-kit.html`, `183-map.html`, `183-town-square.html`, `183-town-shop.html`, each with a 1280×800 `.png` next to it, and a `README.md` saying what each shows and which row it serves. Open the `.html` in a browser for the real thing; the `.png` is the review copy.
- The second row of the canvas (chunky cream, "Forge") is superseded and kept for comparison only.
- **Monster art direction:** the commission brief to Champion Moab (vgen.co/ChampionMoab), updated by Henry 2026-10-02: an animal-based fakemon, an upright werewolf, carved rune-like glowing markings that say Fire, some armour, a chain (Fenrir bound), flames or a flame cannon only if they fit. Henry also drafted an upright-wolf picture with AI: **internal only, never sent to the artist, never shipped.** Its register is the brief for the UI: clean cel shading, hard dark outlines, saturated glow only on the markings and fire. The UI borrows the outline weight and the restraint, not softness.
- **Rule (Henry, 2026-10-02): no AI-generated picture is ever sent to an artist.** References for artists are human-made only. AI drafts stay internal.
- **UI reference research** (2026-10-01, Henry's other agent): one panel per monster, statuses as icon + count, element symbol + colour, effectiveness in words, one selection colour, corner layout. Taken. Charcoal/cyan/hexagons: not taken (written for the robot direction).

---

## The direction in one paragraph

Pokémon Sword and Shield's shell on Slay the Spire's screen. Panels are dark navy parallelograms with a light edge and an element-coloured slash on the side that faces the monster. Cards are white with a slanted element header. Type is a condensed italic. One selection colour, yellow, used for nothing else. Energy is one symbol everywhere: a number inside a yellow hexagon. Every element is said three ways, colour, symbol and word, so no information rides on colour alone. No gradients, no glows, no monospace, no paragraphs. The battle geometry (145a), the fan (ticket 155/167), the card's content (`CardFace`), the caster-match highlight and the enemy-hand panel all stay exactly what they are; only their colour, shape and type change.

---

## The kit

### Colour (`tokens.css` v2, mirrored in `runShell.ts`, pinned by `theme.test.ts`)

| Token | Value | Used for |
|---|---|---|
| `--panel` | `#1E2638` | plaques, chips, console, toasts, readout strip |
| `--panel-edge` | `#E8EEF5` | 2px light edge on every panel |
| `--panel-2` | `#2B3446` | status chips, draw-pile backs, empty slots |
| `--ink` | `#101521` | card frames (non-STAB), text on yellow |
| `--text` | `#FFFFFF` | text on panels |
| `--text-mute` | `#9AA6B8` | labels, "/max", "vs target" |
| `--select` | `#FFD500` | **the only selection colour**: selected card ring, active platform, caster cursor, lit clause, Super effective tag |
| `--energy` | `#FFD500` | the energy hexagon (same yellow on purpose: energy is the thing you select with) |
| `--el-fire` | `#F25C2A` | |
| `--el-water` | `#2F8FE0` | |
| `--el-nature` | `#4CB04A` | |
| `--el-none` | `#8E97A8` | neutral |
| `--hp` / `--hp-hi` | `#4CDA64` / `#A6F0B2` | HP bar above 50%, fill + 3px top band |
| `--hp-mid` / `--hp-mid-hi` | `#FFD500` / `#FFEB80` | 50% to 20% |
| `--hp-low` / `--hp-low-hi` | `#F2423B` / `#FF9C97` | under 20%, and the LETHAL chip |
| `--card-body` / `--card-text` / `--card-mute` | `#F4F6F9` / `#1A2130` / `#5E6A80` | |
| `--sky` / `--far` / `--near` / `--ground` / `--ground-2` | per biome, see 183b | the painted backdrop bands |

The earth/air/ice/light/dark tokens and every legacy alias in `tokens.css` (`--bg-dark`, `--glass-*`, `--accent-*`, `--glow-blur`, `--shadow-panel`) are deleted in 183a. Anything still reading them fails the build, which is the point: nothing on screen may be a glow, a glass panel or a 48px blurred shadow.

### Type

- **Display:** Barlow Condensed 800 italic, uppercase, 0.5px tracking. Names, numbers, buttons, labels, the cast caption.
- **Body:** Barlow 600. Rules text, toasts, descriptions.
- **Never:** Courier, Outfit, Inter, any monospace. `index.css` lines 11 and the three `'Courier New'` rules go.
- **Bundled, not fetched.** The desktop build is offline. Barlow and Barlow Condensed are SIL OFL; the woff2 files go in `public/fonts/` with `@font-face` in `tokens.css`. No Google Fonts link anywhere.
- Sizes: card name 14, rules text 11, plaque name 15, plaque HP 13, readout figure 15, End Turn 24, turn number 28, toast 14.

### Shape

- **Panel:** `clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)`, `--panel-edge` behind, `--panel` inset 2px. One CSS class, `.k-slant`, with `--k-cut` for the skew (8px panels, 5px badges, 3px chips, 2px pips).
- **Card:** 2px ink frame, body inset, header band clipped `polygon(0 0, 100% 0, 100% 78%, 0 100%)`.
- **Energy hexagon:** `polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)`, 22px tall on cards, 20px on plaques, number in display type.
- **Element mark:** an 18px white disc with the element's symbol drawn in the element colour (flame, drop, leaf; a dot for neutral). This is 182's R4 "element icon", so 182 and 183 ship the same component.
- **Element badge:** element-colour plate, symbol + word, white text. On plaques.
- **Platforms:** flat ellipses under sprites, `--ground-2`; the active ally's is `--select`.
- No border-radius over 4px anywhere, no box-shadow blur, no gradient except the art-slot hatch placeholder.

### The pieces

| Piece | Shape |
|---|---|
| **Plaque** (176px, outside its column as today) | name · element badge · firmware gear chip / HP bar + `cur/max` / energy hexagon `n/max` · status chips (icon ×N, rule on hover). Element slash on the sprite-facing edge. |
| **Card** (`CardFace`, 150×190 in the fan at scale 1) | header: element mark · name · **energy hexagon** / art slot / target tag / rules text with lit clause / readout strip (22px) or element bar. No type mark (D3). |
| **Readout strip** | the true figure big ("142", "+15"), "vs Huldra" small, chips right-aligned: SUPER ×1.5, RESIST ×0.5, ×N HITS, ABS n, LETHAL (red). Scan the figures along the hand to compare. |
| **STAB** | no tag. The frame turns the element colour (3px) and the header gets a 2px light inner edge. Hover: *"STAB: Same Type Attack Bonus. This card matches the caster's element: ×1.5 power."* (`STAB_BONUS = 1.5` in `combatUtils.ts`; read it, never type it.) |
| **Selected card** | yellow 4px ring, 10px lift. Means selected and nothing else. |
| **Top band** (44px, unchanged height) | turn hexagon-chip left · event toast centre (navy, white text) · biome sign right · **Settings** button far right (182 R5: no pause menu). Field-effect chips under it on the left. |
| **Enemy hand tab** (`.ehp`, right edge) | closed: one small element-coloured card back per card in the enemy's hand, so the hand's shape reads at a glance; open: the full text panel as today. |
| **Console** | navy tray with a `--panel-edge` top rule; macros as yellow chips (empty = dashed `--panel-2`); draw pile as stacked navy backs with a yellow count; discard with a count; End Turn yellow, 200×50, display 24. |
| **Target feedback** | while a card is lit, the hovered target shows a yellow cursor and the words "Super effective" / "Not very effective". Words, not colour. |
| **Toast** | navy bar, white body text, one sentence. Replaces every callout panel (182 did the words; 183 does the shape). |
| **Damage numbers** (146) | float in the casting card's element colour, display type, larger on a super-effective hit. |

### What does not change

- `stageGeometry.ts`: every number, the reveal lane, the plaque-outside rule, `useStageAnchors` (146 caches them). One addition in 183e.
- `fanGeometry.ts`: 140×176 reference card, −18 overlap, 8–12° angle, 18px lift, 10px selected lift, origin 50% 130%.
- `CardFace`'s content and order: pips → energy hexagon is the only content swap; everything else is the same data in new clothes.
- The caster-match highlight (`CardHand`): same rule, new paint.
- The enemy-hand panel's open state, the combat log drawer, the reveal, the unit readouts' tooltips.
- Nothing in `src/engine`.

---

## What this does to ticket 176

176 stays **blocked** until 183a, 183b and 183c are merged. Then:

- **176e (the map screen)** is drawn with the kit: navy node discs with a white symbol (fight, town, elite, gym, event, detour), roads on a painted biome backdrop at M6's 1.5× size. 183 ships the node icon set and the backdrop bands (183b) so 176e composes rather than invents. **Mock: `research/183-mocks/183-map.html`.**
- **176c step 3 (the town screen: square, rail, dock, tabs)** is built from `.k-slant` panels and the kit's buttons. The "Town Screen Prototypes" canvas stays the layout; the look is this ticket's. **Mocks: `research/183-mocks/183-town-square.html` and `183-town-shop.html`.**
- **176 M7's line "cards look the way they do in the game today (Henry didn't like a restyle)"** was ruled against the chunky cream pass, not against B. Decision **D2** below settles whether the stall tile, list row and hover card take B's card face. Until ruled, 176c builds against the B hand card only.
- A note is added to the top of 176 pointing here, and the "BLOCKED" status is lifted by Henry, not by the agent.

## What this does to ticket 182

182 is not blocked by 183. Where they touch: 182 R4's element icon **is** 183's element mark (one component, `ElementMark`, built in 183a and used by 182); 182 R5 means 183's top-band button is Settings; 182 R6's build label stays, in `--text-mute` display type at 10px, bottom-left of the ranch. 182's toasts get 183's shape in 183d.

---

## How to work this ticket

1. **Read the whole row first.** Search for quoted names; line numbers drift.
2. **No geometry changes except 183e.** `stageGeometry.test.ts` and `fanGeometry.test.ts` stay green and unedited through 183a–183d.
3. **Tokens only.** No hex literal in a screen stylesheet or a component after 183a; a test greps for `#[0-9a-f]{6}` outside `tokens.css` and `runShell.ts` and fails on any hit.
4. **One component per piece, small.** `EnergyHex`, `ElementMark`, `ElementBadge`, `HpBar`, `StatusChip`, `SlantPanel`, `ReadoutStrip`. Compose them; do not grow `MingmingUnit.tsx` (526 lines) or `BattleArena.tsx` (1,360 lines).
5. **Screenshots are the review.** Every row ends with a Playwright capture at 1280×800 and 1920×1080 into `docs/wayfinder/first-impressions/research/183-screens/<row>/`, committed with the row. Henry reviews pictures, not diffs.
6. **Gate:** `npm run gate` green before each commit. Commits authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`), no Co-Authored-By, last line `HANDOFF: <one sentence>`. One commit per row. **Do not push.**
7. **Report** in plain English, ending with the decisions Henry owes.

| Row | What | Blocked by |
|---|---|---|
| 183a | Tokens v2, fonts bundled, the seven kit components, the no-hex test | — |
| 183b | The battle stage: backdrop bands per biome, platforms, plaques, top band, enemy-hand tab | 183a |
| 183c | The card: `CardFace` in B, readout strip, STAB frame + tooltip, energy hexagon | 183a |
| 183d | The console: macros, piles, End Turn, toasts | 183a |
| 183e | Rows centred by party size | 183b |
| 183f | Ranch, starter, settings, run summary in the kit | 183a, 182 |
| 183g | Node icon set and map/town components for 176 | 183a |
| 183h | The naming pass | 182 (the text cut) |

---

## 183a: Tokens, fonts, components

**Files:** `src/ui/theme/tokens.css`, `src/ui/theme/theme.test.ts`, `src/ui/screens/runShell.ts`, `src/index.css`, `public/fonts/`, new `src/ui/theme/kit/` (one file per component).

1. Replace the token block with the Colour table above. Delete the legacy aliases and the five unused element tokens. `runShell.ts`'s `ELEMENT_COLOR` takes the four new values; `theme.test.ts` keeps asserting the mirror.
2. Add `public/fonts/BarlowCondensed-ExtraBoldItalic.woff2`, `Barlow-SemiBold.woff2`, `Barlow-Bold.woff2` and the OFL licence file; `@font-face` in `tokens.css`; `--font-display` and `--font-body` tokens. Remove `'Outfit'`, `'Inter'` and every `'Courier New'` from `index.css`.
3. `.k-slant` utility with `--k-cut`, and `.k-hex`.
4. Components, each a single-purpose function component with a 10-line test:
   - `EnergyHex({ n, max?, size })`: the hexagon with the number, `title="Energy n/max"`.
   - `ElementMark({ element, size })`: white disc, symbol in element colour, `aria-label` = element.
   - `ElementBadge({ element, label? })`: plate with symbol and optional word.
   - `HpBar({ cur, max, width })`: track + fill + 3px band, colour step at 50% and 20% of max.
   - `HpBar` also takes `shield?: number` (HP points): Bark Shield drawn as a brown band (`--shield`, the existing `#b58d4c` Bark Shield colour) laid over the bar from the right end of the fill, with the shield's HP as a small number on it. Hover: the existing Bark Shield glossary text. See *Bark Shield on the HP bar* below.
   - `StatusChip({ status, count })`: icon ×N, uses the existing `StatusBadge` tooltip.
   - `SlantPanel({ cut, slash?: 'left' | 'right', element? })`: the panel with its optional element slash.
   - `ReadoutStrip({ preview, element })`: the 22px strip, built from `HandCardPreviewFace`.
5. The no-hex test (rule 3) and a `tokens.test.ts` that every `--el-*` has a mark glyph in `ElementMark`.

## 183b: The battle stage

**Files:** `BattleStage.tsx`, `UnitReadouts.tsx`, `MingmingUnit.tsx` (plaque path only), `BattleTopBar.tsx`, `EnemyHandPanel.tsx`, `index.css` (`.ehp`, stage rules), `BattleArena.tsx` (the backdrop mount only).

1. **Backdrop:** a `BiomeBackdrop` component drawing five flat bands (sky, far hills, near hills, ground, ground-2) from the biome's token set. Three sets: Water (Drowned Shelf blues), Fire (Slagfields ochres), Nature (Verdant Sprawl greens). Flat polygons, no gradient. The console tray sits under it at `CONSOLE_H`.
2. **Platforms:** an ellipse under every sprite box, 170×40 at scale 1, `--ground-2` at 75%; the active ally's turns `--select` with a `--ground-2` inner ellipse; the caster cursor is a yellow triangle 18px above the sprite.
3. **Plaques:** rebuild the plaque path of `MingmingUnit` on `SlantPanel` with `ElementBadge`, `HpBar`, `EnergyHex`, `StatusChip` and the existing `FirmwareChip`. Same 176px, same `PLAQUE_DY`, same tooltips, same test ids. Slash on the sprite-facing edge.
   - **Bark Shield is on the HP bar, not in the status row** (Henry, 2026-10-02). The plaque passes `shield = floor(BarkShield stacks × maxHp ÷ 100)` (stacks are percent of max HP, `StatusBehaviors.ts`) to `HpBar` and leaves `BarkShield` out of its `StatusChip`s. Enemies get the same.
4. **Top band:** turn in a small slant panel ("Turn" + number), the event line as a toast, the biome sign, the Settings button (182 R5). The volume slider and theme toggle leave the battle screen (182 R5).
5. **Enemy hand tab:** when closed, render one 18×24 element-coloured back per card in the enemy's hand inside the 34px tab. `enemyShiftFor` is unchanged.
6. **Target feedback:** the `hud-target-flag` becomes a yellow cursor plus the words "Super effective" / "Not very effective" / "Can't target" from the existing verdict.
7. **Tests:** plaque renders every field for a 3v3 entity; a body with Bark Shield shows the band with its HP and no Bark Shield chip; tab shows N backs for N cards; backdrop picks the biome's set; `stageGeometry.test.ts` untouched.

## 183c: The card

**Files:** `screens/CardChassis.tsx` (`CardFace`, `TypeMark`, `ElementMark` call sites), `components/HandCardFace.tsx`, `components/CardHand.tsx` (paint only), `index.css` (`.rs-*` rules), `CardPeek.tsx`.

1. `CardFace` order becomes: header (`ElementMark` · name · `EnergyHex`) → art slot → target tag → description (lit clauses in `--select`) → `ReadoutStrip` or 5px element bar. **The type mark is deleted (D3, ruled):** `TypeMark` and the `banner` field leave `CardFace`; `bannerFor` stays in `runShell.ts` only if something other than the card face reads it, else it goes too. The energy pips component is retired from the card.
2. **STAB:** `CardHand` already knows the caster match; it sets `data-stab` on the card, and the stylesheet turns the frame the element colour and adds the header's inner edge. The card's `title` reads the STAB sentence with `STAB_BONUS` formatted (`×1.5`).
3. **Selected:** yellow ring via `data-selected`, the existing lift.
4. **Everywhere the full card is shown takes this face (D2, ruled):** `CardPeek` (the hover card), the stall tile (`rs-card`), the reward pick, the upgrade preview (now → upgraded, side by side), the deck and discard viewers, the codex, and 176c's town tabs. The compact list row (`rs-row`) is not a full card and keeps its row shape, restyled to the kit's type and colours only.
5. **Tests:** a fire card with a fire caster has the STAB frame and the tooltip; a non-match has the ink frame; the readout shows the figure, the vs-name and every chip the preview carries; `fanGeometry.test.ts` untouched.

## 183d: The console and toasts

**Files:** `MacroRack.tsx` + `.css`, `CardHand.tsx` (piles), `BattleArena.tsx` (End Turn, toast mount), `Callout.tsx` + `.css`.

1. Macros: yellow chips, 92×32, display type; empty slot dashed `--panel-2`.
2. Draw pile: three stacked navy backs with a `--panel-edge` frame and a yellow count; discard: a dashed slot with a count.
3. End Turn: 200×50 yellow slant button, display 24. The 172 nudge (flash + light the playable card) keeps its behaviour and takes the yellow ring.
4. `Callout` renders as the toast shape: navy bar, one sentence, no buttons; the "Got it / Skip tips" controls move to Settings as one "Show tips" switch (182 cut the copy; this moves the control).

## 183e: Rows centred by party size (D5, ruled: build it)

**Files:** `stageGeometry.ts`, `stageGeometry.test.ts`, `BattleStage.tsx`.

1. `rowY(index, partySize)` = `62 + (3 − partySize) × 85 + index × 170`. `spriteRect` and `plaqueRect` take `partySize`; the stage passes the larger of the two sides at battle start and never changes it mid-battle, so §3's stability holds and 146's anchors stay valid.
2. Tests: at 1280×800, 3v3 is pixel-identical to today; 1v1 puts both units on the middle row (y = 232); 2v2 at 147 and 317; a death does not move a row.

## 183f: The other screens

After 182's text cut lands. `RanchScreen`, `RunStart`, `SettingsScreen`, `RunSummary`, the starter picker: `SlantPanel` tabs and buttons, the kit's type, the three starters as cards built from `CardFace` with the monster's three stats where the rules text goes (172's ruling). No new layout; this is paint. Screenshots per screen.

## 183g: Map and town pieces for 176

**Reference:** `research/183-mocks/183-map.html`, `183-town-square.html`, `183-town-shop.html` (and their `.png`). They draw 176e's layout (16 columns at 144px, 110px rows, 30px node radius, biome panels, roads, gold path, faded passed nodes, dashed detour with "+1 fight", route labels) and 176c's M7 layout (square with four building buttons; rail 212 / main / dock 236) in the kit, with 183h's words. Where a mock and 176's text disagree on layout, 176 wins; on look, the mock wins.

Ships the pieces 176 composes: `NodeIcon` (fight, town, elite, gym, event, detour, start; white symbol on a navy disc, element ring when the fight's element is known), `RouteLine` (element-coloured, 4px, flat), `BiomeBackdrop` reused at map scale, `TownButton` (the four buildings). 176e and 176c then build on these.

## 183h: The naming pass (D1)

Rename UI labels only, per D1's ruled list: a `labels.ts` map from internal id to on-screen word, used by every component that prints one. Data ids, save schemas, the registry, test ids and the walker's output do not change. Build it **after 182** lands (the text cut removes most of the sentences these words sit in), and grep `src/ui` for every old word (firmware, OS, reflash, blueprint, assemble/assembly, workshop, daemon, macro, patch, driver, scrap, program) so none survives on screen; a test renders every screen and fails on any of them. Tips (`engine/tips.ts`) and the codex glossary are UI text and are renamed too.

| In code | On screen (ruled) |
|---|---|
| firmware / OS | **Instinct** (kernel/OS proper names stay as the instinct's name) |
| reflash | **Retrain** |
| blueprint | **Trace** |
| assembly | **Summon** |
| workshop (map node) | **Den** |
| daemon | **Aura** |
| macro | **Draught** |
| patch | **Rune** |
| driver | **Totem** |
| scrap | **Amber** |
| program | **Card** |
| Mingming | **Mingming** |

---

## Art commissions

- **Monster art (Moab, steam-release ticket 33):** the brief is updated to the animal-inspired direction (Henry, 2026-10-02; no AI images in it). Deliverables per species: a battle sprite that reads in a 150×120 box (drawn at 2×, 300×240, with headroom for the 190px cap), facing right (allies) with the enemy mirror done by the UI, on transparent; a square portrait for party faces and the map; a card-art crop at 134×36 ratio (3.7:1) for the hand card's art slot, or a wider band the UI crops.
- **Fenrir test piece only, for now (Henry, 2026-10-02).** The brief asks for one design (2000×2000 PNG, layered PSD, one sketch round) and nothing more. The portrait and card-art crop above are **not** asked for yet; they come in a later booking if Henry likes the test and wants the UI art. "Steel/Fire type" in the brief means *looks like a Steel/Fire Pokémon*; in the game Fenrir is Fire. The battle screenshot in the brief is a placeholder layout of direction B (plain shapes in the monster slots, no AI art). **No AI image goes to the artist** (Henry's standing rule).
- **Biome backdrops:** optional. The kit's flat bands ship first; painted backdrops in the same three palettes can replace them per biome later without touching layout.
- **UI art:** none required. The kit is CSS. If a drawn panel frame is wanted later, the `SlantPanel` component is the one place it plugs in.

---

### Bark Shield on the HP bar (added 2026-10-02, from the Rootfall playtest)

> *"barksheild should be a brown bar over the health bar. It doesn't read well as a status icon."* — Henry's playtest notes, 2026-10-02. Confirmed for this ticket the same day ("Yes, add that to the UI rework ticket"), from the review that also produced ticket 185.

Built in 183a (`HpBar`'s `shield` prop) and 183b (the plaque passes it and drops the chip). Like Slay the Spire's Block, the shield is read off the bar it protects. The status row keeps every other status.

## Decisions (all ruled by Henry, 2026-10-02)

| # | Decision | Ruling |
|---|---|---|
| D1 | **Naming.** Rename the on-screen words; code, data ids and saves keep theirs. | **Yes.** The words: *Instinct, Retrain, Den, Aura, Trace, Draught, Rune, Totem, Amber, Card, Mingming* (the ruled column of the table below). *Assembly* → **Summon** (ruled separately, same day). |
| D2 | **How far the card face goes.** 176 M7 said cards look as today, ruled against the cream pass. | **Everywhere the full card is shown:** hand, hover card, stall tile, reward pick, upgrade preview, deck/discard viewers, codex, town tabs. 176 M7's line is superseded for the look; its layout stands. |
| D3 | **Type mark** (▲ ✦ ◆ ●). | **Delete it.** |
| D4 | **Fonts.** Barlow Condensed + Barlow (OFL, bundled). | **Yes.** |
| D5 | **Rows centred by party size** (183e). | **Yes, build it.** |
| D6 | **The enemy-hand tab's coloured backs.** | **In.** |
| D7 | **Screenshot sizes.** | **Both:** 1280×800 and 1920×1080. |

### D1: the words (ruled 2026-10-02; the right column is what ships)

The left column was this ticket's proposal; the middle a second draft from the 182 session; Henry picked from the recommended column and swapped *Bond* for *Trace*. The right column is what ships. Build it **after 182** lands, since the text cut removes most of the sentences these words sit in.

| In code | Draft A (this ticket) | Draft B (182 session) | **Ruled (ships)** | Notes |
|---|---|---|---|---|
| firmware / OS | **Trait** | **Instinct** | **Instinct** | the per-monster build choice; kernel/OS proper names stay as the instinct's name. "Trait" is clear but generic; "Instinct" fits an animal |
| reflash | **Retrain** | **Retrain** | **Retrain** | both drafts agree |
| blueprint | keep | **Trace** or **Bond** | **Trace** | what you keep to recruit again; Henry chose Trace over Bond |
| assembly | **Hatch** | — | **Summon** | spending a Trace to bring a monster in |
| workshop (map node) | — | **Den** | **Den** | the place where you Summon |
| daemon | **Companion** | — | **Aura** | a card that stays in play; "Companion" sounds like a creature |
| macro | keep | **Draught** | **Draught** | the single-use consumable (Spire's potion) |
| patch | keep | **Rune** | **Rune** | carved and attached to one monster; matches the brief's rune markings |
| driver | — | **Totem** or **Boon** | **Totem** | the party-wide passive from elites |
| scrap | — | **Amber** | **Amber** | the currency; Norse trade goods |
| program | — | **Card** | **Card** | probably already "card" on most screens |
| Mingming | keep | keep | **keep** | |
