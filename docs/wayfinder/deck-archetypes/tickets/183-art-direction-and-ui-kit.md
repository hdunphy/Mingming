# Ticket 183: Art direction and UI kit

**Type:** design, then UI. **Status:** DIRECTION RULED (Henry, 2026-10-02): direction **B, "Slant"**, built on the existing battle geometry. Rows 183a–183e are buildable in order. 183f–183h wait on the decisions at the bottom. **Ticket 176 (map and town redesign) stays blocked until 183a–183c ship; then 176c and 176e are drawn in this kit** (see "What this does to ticket 176").

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
- The second row of the canvas (chunky cream, "Forge") is superseded and kept for comparison only.
- **Monster art direction:** the upright-wolf Fenrir reference Henry is sending to Champion Moab (vgen.co/ChampionMoab). AI-drafted, internal only, never shipped. Its register is the brief for the UI: clean cel shading, hard dark outlines, saturated glow only on the power lines and fire. The UI borrows the outline weight and the restraint, not softness.
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
| **Card** (`CardFace`, 150×190 in the fan at scale 1) | header: element mark · name · **energy hexagon** / art slot / target tag / rules text with lit clause / readout strip (22px) or element bar / type mark faint bottom-right |
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

- **176e (the map screen)** is drawn with the kit: navy node discs with a white symbol (fight, town, elite, gym, event, detour), element-coloured route lines on a painted biome backdrop at M6's 1.5× size. 183 ships the node icon set and the backdrop bands (183b) so 176e composes rather than invents.
- **176c step 3 (the town screen: square, rail, dock, tabs)** is built from `.k-slant` panels and the kit's buttons. The "Town Screen Prototypes" canvas stays the layout; the look is this ticket's.
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
5. **Screenshots are the review.** Every row ends with a Playwright capture at 1280×800 and 1920×1080 into `docs/wayfinder/deck-archetypes/research/183-screens/<row>/`, committed with the row. Henry reviews pictures, not diffs.
6. **Gate:** `npm run gate` green before each commit. Commits authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`), no Co-Authored-By, last line `HANDOFF: <one sentence>`. One commit per row. **Do not push.**
7. **Report** in plain English, ending with the decisions Henry owes.

| Row | What | Blocked by |
|---|---|---|
| 183a | Tokens v2, fonts bundled, the seven kit components, the no-hex test | — |
| 183b | The battle stage: backdrop bands per biome, platforms, plaques, top band, enemy-hand tab | 183a |
| 183c | The card: `CardFace` in B, readout strip, STAB frame + tooltip, energy hexagon | 183a |
| 183d | The console: macros, piles, End Turn, toasts | 183a |
| 183e | Rows centred by party size | 183b, D5 |
| 183f | Ranch, starter, settings, run summary in the kit | 183a, 182 |
| 183g | Node icon set and map/town components for 176 | 183a, D2 |
| 183h | The naming pass | D1 |

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
   - `StatusChip({ status, count })`: icon ×N, uses the existing `StatusBadge` tooltip.
   - `SlantPanel({ cut, slash?: 'left' | 'right', element? })`: the panel with its optional element slash.
   - `ReadoutStrip({ preview, element })`: the 22px strip, built from `HandCardPreviewFace`.
5. The no-hex test (rule 3) and a `tokens.test.ts` that every `--el-*` has a mark glyph in `ElementMark`.

## 183b: The battle stage

**Files:** `BattleStage.tsx`, `UnitReadouts.tsx`, `MingmingUnit.tsx` (plaque path only), `BattleTopBar.tsx`, `EnemyHandPanel.tsx`, `index.css` (`.ehp`, stage rules), `BattleArena.tsx` (the backdrop mount only).

1. **Backdrop:** a `BiomeBackdrop` component drawing five flat bands (sky, far hills, near hills, ground, ground-2) from the biome's token set. Three sets: Water (Drowned Shelf blues), Fire (Slagfields ochres), Nature (Verdant Sprawl greens). Flat polygons, no gradient. The console tray sits under it at `CONSOLE_H`.
2. **Platforms:** an ellipse under every sprite box, 170×40 at scale 1, `--ground-2` at 75%; the active ally's turns `--select` with a `--ground-2` inner ellipse; the caster cursor is a yellow triangle 18px above the sprite.
3. **Plaques:** rebuild the plaque path of `MingmingUnit` on `SlantPanel` with `ElementBadge`, `HpBar`, `EnergyHex`, `StatusChip` and the existing `FirmwareChip`. Same 176px, same `PLAQUE_DY`, same tooltips, same test ids. Slash on the sprite-facing edge.
4. **Top band:** turn in a small slant panel ("Turn" + number), the event line as a toast, the biome sign, the Settings button (182 R5). The volume slider and theme toggle leave the battle screen (182 R5).
5. **Enemy hand tab:** when closed, render one 18×24 element-coloured back per card in the enemy's hand inside the 34px tab. `enemyShiftFor` is unchanged.
6. **Target feedback:** the `hud-target-flag` becomes a yellow cursor plus the words "Super effective" / "Not very effective" / "Can't target" from the existing verdict.
7. **Tests:** plaque renders every field for a 3v3 entity; tab shows N backs for N cards; backdrop picks the biome's set; `stageGeometry.test.ts` untouched.

## 183c: The card

**Files:** `screens/CardChassis.tsx` (`CardFace`, `TypeMark`, `ElementMark` call sites), `components/HandCardFace.tsx`, `components/CardHand.tsx` (paint only), `index.css` (`.rs-*` rules), `CardPeek.tsx`.

1. `CardFace` order becomes: header (`ElementMark` · name · `EnergyHex`) → art slot → target tag → description (lit clauses in `--select`) → `ReadoutStrip` or 5px element bar → faint `TypeMark` bottom-right. The energy pips component is retired from the card.
2. **STAB:** `CardHand` already knows the caster match; it sets `data-stab` on the card, and the stylesheet turns the frame the element colour and adds the header's inner edge. The card's `title` reads the STAB sentence with `STAB_BONUS` formatted (`×1.5`).
3. **Selected:** yellow ring via `data-selected`, the existing lift.
4. `CardPeek` (the hover card) takes the same face at its larger size. The stall tile and list row wait for D2.
5. **Tests:** a fire card with a fire caster has the STAB frame and the tooltip; a non-match has the ink frame; the readout shows the figure, the vs-name and every chip the preview carries; `fanGeometry.test.ts` untouched.

## 183d: The console and toasts

**Files:** `MacroRack.tsx` + `.css`, `CardHand.tsx` (piles), `BattleArena.tsx` (End Turn, toast mount), `Callout.tsx` + `.css`.

1. Macros: yellow chips, 92×32, display type; empty slot dashed `--panel-2`.
2. Draw pile: three stacked navy backs with a `--panel-edge` frame and a yellow count; discard: a dashed slot with a count.
3. End Turn: 200×50 yellow slant button, display 24. The 172 nudge (flash + light the playable card) keeps its behaviour and takes the yellow ring.
4. `Callout` renders as the toast shape: navy bar, one sentence, no buttons; the "Got it / Skip tips" controls move to Settings as one "Show tips" switch (182 cut the copy; this moves the control).

## 183e: Rows centred by party size (D5)

**Files:** `stageGeometry.ts`, `stageGeometry.test.ts`, `BattleStage.tsx`.

1. `rowY(index, partySize)` = `62 + (3 − partySize) × 85 + index × 170`. `spriteRect` and `plaqueRect` take `partySize`; the stage passes the larger of the two sides at battle start and never changes it mid-battle, so §3's stability holds and 146's anchors stay valid.
2. Tests: at 1280×800, 3v3 is pixel-identical to today; 1v1 puts both units on the middle row (y = 232); 2v2 at 147 and 317; a death does not move a row.

## 183f: The other screens

After 182's text cut lands. `RanchScreen`, `RunStart`, `SettingsScreen`, `RunSummary`, the starter picker: `SlantPanel` tabs and buttons, the kit's type, the three starters as cards built from `CardFace` with the monster's three stats where the rules text goes (172's ruling). No new layout; this is paint. Screenshots per screen.

## 183g: Map and town pieces for 176

Ships the pieces 176 composes: `NodeIcon` (fight, town, elite, gym, event, detour, start; white symbol on a navy disc, element ring when the fight's element is known), `RouteLine` (element-coloured, 4px, flat), `BiomeBackdrop` reused at map scale, `TownButton` (the four buildings). 176e and 176c then build on these.

## 183h: The naming pass (D1)

Rename UI labels only, per D1's table once ruled: a `labels.ts` map from internal id to on-screen word, used by every component that prints one. Data ids, save schemas and the registry do not change.

---

## Art commissions

- **Monster art (Moab, steam-release ticket 33):** the brief is updated to the upright-wolf reference and the animal-inspired direction. Deliverables per species: a battle sprite that reads in a 150×120 box (drawn at 2×, 300×240, with headroom for the 190px cap), facing right (allies) with the enemy mirror done by the UI, on transparent; a square portrait for party faces and the map; a card-art crop at 134×36 ratio (3.7:1) for the hand card's art slot, or a wider band the UI crops.
- **Before Moab accepts (Henry, 2026-10-02: the request isn't accepted yet):** update the Milanote brief now, while the quote can still change. Today it still describes the robot direction ("Fakemon 'Robotic' Style" column, "Steel/Fire type", "the body is armored metal plating, not fur", a dark neon battle screenshot) and asks only for one 2000×2000 PNG and a PSD. Add the portrait and card-art crop listed above to the deliverables (keep 2000×2000 as the drawing size, and add "must read at 150×120 on screen"). Henry decides fur-with-accents or metal plating first. Replace the battle screenshot once 183b ships; until then the caption says the backdrop becomes bright flat bands, not dark. **No AI image goes to the artist** (Henry's standing rule), including the upright-wolf draft.
- **Biome backdrops:** optional. The kit's flat bands ship first; painted backdrops in the same three palettes can replace them per biome later without touching layout.
- **UI art:** none required. The kit is CSS. If a drawn panel frame is wanted later, the `SlantPanel` component is the one place it plugs in.

---

## Decisions Henry owes

| # | Decision | Default if unanswered |
|---|---|---|
| D1 | **Naming. Ruled in principle (Henry, 2026-10-02): yes, rename the on-screen words; code, data ids and saves keep theirs. Henry still picks the words, per row of the table under this one.** The robot layer: firmware / OS / kernel / reflash / blueprint / macro / patch / daemon / assembly / Mingming. Which words stay, which get an on-screen label from `labels.ts`? Proposed: keep *Mingming, blueprint, macro, patch*; show *firmware* as **Trait**, *reflash* as **Retrain**, *assembly* as **Hatch**, *daemon* as **Companion**; kernel/OS names stay as the trait's proper name. | No rename; 183h does not run. |
| D2 | **How far the card face goes.** 176 M7 said cards look as today, ruled against the cream pass. Does B's card face also become the stall tile (`rs-card`), the list row (`rs-row`) and the hover card? | Hand card and hover card only. |
| D3 | **Type mark.** Keep the faint ▲ ✦ ◆ ● bottom-right, or delete it? Nothing in the engine reads the category on the card face. | Keep, faint. |
| D4 | **Fonts.** Barlow Condensed + Barlow (OFL, bundled). Yes, or name another condensed face. | Barlow. |
| D5 | **Rows centred by party size** (183e). A geometry change; 1v1 and 2v2 stop hugging the top of the stage. | Build it. |
| D6 | **The enemy-hand tab's coloured backs.** In, or leave the tab blank as today. | In. |
| D7 | **Screenshot sizes.** 1280×800 and 1920×1080, or add Steam Deck 1280×800 at 16:10 only. | Both listed. |

### D1: words to pick (two drafts side by side)

The left column is this ticket's proposal; the right is a second draft from the 182 session (2026-10-02). Henry picks one per row, or writes his own. Do it **after 182** lands, since the text cut removes most of the sentences these words sit in. Wait for the Fenrir brief's fur-or-metal answer too (see "Art commissions"): if the monsters stay metal-plated, more of the tech words can stay.

| In code | Draft A (this ticket) | Draft B (182 session) | Notes |
|---|---|---|---|
| firmware / OS | **Trait** | **Instinct** | the per-monster build choice; kernel/OS proper names stay as the trait's name |
| reflash | **Retrain** | **Retrain** | both drafts agree |
| assembly / workshop | **Hatch** | **Den** | where a monster joins |
| daemon | **Companion** | — | |
| blueprint | keep | **Trace** or **Bond** | what you keep to recruit again; avoid "Egg" (too close to Pokémon) |
| macro | keep | **Draught** | the single-use consumable (Spire's potion) |
| patch | keep | **Rune** | carved and attached to one monster |
| driver | — | **Totem** or **Boon** | the party-wide passive from elites |
| scrap | — | **Amber** | the currency; Norse trade goods |
| program | — | **Card** | probably already "card" on most screens |
| Mingming | keep | keep | |
