# Ticket 199: The Instinct glyphs (12 for 1.0)

**Type:** 12 glyphs, then a small wiring pass. **Status:** opened 2026-10-05; **re-ruled 2026-10-06 (below)**. Split out of [194j](194-henry-playtest-2026-10-04.md) step 2. Glyphs drawn; **wiring built 2026-10-06 (see Resolution); waiting on Henry to look at the chips in game.**

**Henry (2026-10-05, first ruling, superseded):** *"Add a new ticket 198 for me to generate these myself. They count as AI Generated art I think."* (Numbered 199 at his next instruction: *"increment those tickets by one."*)

**Why.** 194j ruled a glyph per Instinct so a player can tell at a glance which Instinct a Mingming runs (*"Maybe a glyph that players will learn"*). Step 1 of 194j was a glyph sheet that Claude drew as code (`results/194j/glyph-sheet.html`, `glyphs.json`). That is AI-generated art, and the standing rule from 190 is **no AI-generated art ships**. That sheet (`results/194j/`) is **not used and does not ship**; it was replaced on 2026-10-06 by the 12 reworked glyphs below. Henry first tried to draw the glyphs himself (on 2026-10-05), then ruled to use the AI-drawn ones with disclosure.

**Re-ruled 2026-10-06 (Henry).** He tried drawing them by hand (Aseprite sketches, then Inkscape) and could not match the quality, and decided: *"I think we just use them."* The 12 glyphs for the 1.0 release are **AI-generated art drawn by Claude and shipped, with the AI use disclosed on the Steam page.** This is a deliberate exception to the 190 rule *"No AI-generated sprite sheet ever ships"* (which was about sprite sheets). Only the 12 glyphs below are covered; nothing else in 190's rule changes.

**Chore for Henry:** answer Steam's AI-content disclosure (the store page survey) when setting up the page, and name the Instinct glyphs in it. Check Valve's current form wording; it covers AI-generated content that players see.

**Where the glyphs are:** a reference sheet (artifact "Instinct Glyph References") and `instinct-glyph-references-svg.tgz`, 12 SVGs on a 24 x 24 grid, one colour (`currentColor`), angular rune-style strokes (straight lines, 45 degree angles, mitred corners). Reworked at Henry's request: **Unbound** is a chain of three links with the centre link broken (no line through the middle); **Treachery** is a knife pointing diagonally with a drop of blood off the tip; **Venomfang**'s drop sits under one fang, not centred.

**The 12 for 1.0** are the first six species' Instincts (fenrir, skoll, kraken, jormungandr, ratatoskr, huldra). The other 21 keep the generic `firmware` icon until later (see *Open question*).

---

## The 33 Instincts (the 12 for 1.0 are marked)

**33 glyphs, one per Instinct**, the same 33 as `NORSE_INSTINCT_NAMES` in `src/ui/labels/instinctNames.ts`. The key is the registry id; the name is what the player reads.

| Species | Instinct id | Shown name |
|---|---|---|
| fenrir_v1 | UNBOUND_KERNEL (1.0) | Unbound |
| fenrir_v2 | CINDER_WALL_OS (1.0) | Muspel Wall |
| kraken_v1 | ABYSSAL_INK_SYS (1.0) | Abyssal Ink |
| kraken_v2 | TIDAL_CRUSH_OS (1.0) | Tidal Crush |
| fafnir_v1 | HOARD_PROTOCOL | Dragon's Hoard |
| fafnir_v2 | CORRUPTED_GOLD_OS | Andvari's Curse |
| skoll_v1 | TREACHERY_KERNEL (1.0) | Treachery |
| skoll_v2 | EMBER_FUSE (1.0) | Sunscorch |
| jormungandr_v1 | OUROBOROS_LOOP (1.0) | Midgard Coil |
| jormungandr_v2 | TOXIN_FANG_OS (1.0) | Venomfang |
| gullinbursti_v1 | UNSTOPPABLE_MASS | Golden Bristles |
| gullinbursti_v2 | KINETIC_RAM_OS | Tuskrush |
| hraesvelgr_v1 | GALE_FORCE_OS | Eagle's Gust |
| hraesvelgr_v2 | UPDRAFT_KERNEL | Stormrise |
| sleipnir_v1 | MOMENTUM_DRIVE | Eightfold Stride |
| sleipnir_v2 | WAR_STEED_OS | Odin's Charge |
| ratatoskr_v1 | GOSSIP_NODE (1.0) | Branch Gossip |
| ratatoskr_v2 | INSTIGATOR_OS (1.0) | Tale-Bearer |
| huldra_v1 | ALLURE_PROXY (1.0) | Glamour |
| huldra_v2 | BARK_SHIELD_OS (1.0) | Elderwood Ward |
| ymir_v1 | GLACIER_HEART_SYS | Rimeheart |
| ymir_v2 | GLACIAL_PACE_OS | Jötun Patience |
| draugr_v1 | PERMAFROST_WAKE | Restless Dead |
| draugr_v2 | GRAVE_CHILL_OS | Barrow Chill |
| valkyrie_v1 | VALHALLA_UPLINK | Valhalla's Call |
| valkyrie_v2 | REBIRTH_CYCLE_OS | Folkvangr Dawn |
| audhumbla_v1 | GENESIS_FIRMWARE | Ginnungagap |
| audhumbla_v2 | PRIMORDIAL_MILK | Elder Milk |
| control_v1 | NULL_FIRMWARE | Unmarked |
| hel_v1 | TWILIGHT_CADENCE | Twin Faces |
| hel_v2 | UNDERWORLD_GATEWAY | Helgrind |
| nidhoggr_v1 | ROOT_CORRUPTION | Rootgnaw |
| nidhoggr_v2 | BLOOD_SCENT_OS | Carrion Hunger |

**What a glyph has to do** (from 194j):

- Hint at what the Instinct does, so it can be learned.
- The two Instincts of one species look clearly different at chip size.
- Single colour, so the chip can tint it by element.
- Readable at chip size (about 16 to 20 px) and at tooltip size.

**Open question (Henry):** the chip and tooltip show a glyph for the 12, and the generic `firmware` icon for the other 21 Instincts until they are drawn. If that mismatch is not acceptable at 1.0, the options are to draw the other 21 the same way, or to wire the glyph only where all of a species has one.

## What the wiring pass does (194j step 2, after the art exists)

Small single-purpose pieces, as Henry prefers: one map, one loader, one component.

- `instinctGlyphs.ts`: a map from Instinct id to its glyph file, beside `instinctNames.ts`.
- A glyph component that draws a glyph from that map and tints it.
- `FirmwareChip` draws the owner's Instinct glyph instead of the generic `firmware` icon.
- The tooltip header shows the glyph beside the Norse name and **drops the `v1.0` / `v2.0` text** (194f left it for this row).
- Anywhere else an Instinct is named (retrain, summon, codex) shows the same glyph, so players learn it.

**Build order:** the 12 SVGs go in one folder named by Instinct id; wire with the generic `firmware` icon as the fallback for any Instinct without a file, so the other 21 can arrive later one at a time.

**Tests.** Each of the 12 has a glyph file and no two Instincts share one; an Instinct with no file falls back to the generic icon. The chip renders the owner's glyph (or the fallback while a file is missing); the tooltip has no `v1.0` / `v2.0`.

## Done when

The 12 glyphs are in the repo, the chip and tooltip show them, no `v1.0` / `v2.0` text is left, Henry has looked at the chips in game, and the Steam AI disclosure is on his list.

---

## Resolution (2026-10-06)

Built on `first-impressions`, UI only (nothing under `src/engine` changed), not pushed.

**What a player sees now.**

- The 12 glyphs are in the repo, in `src/ui/assets/instinct-glyphs/`, one SVG per Instinct, named by its registry id (`UNBOUND_KERNEL.svg` and so on).
- The firmware chip on a unit's plaque draws its Instinct's glyph instead of the generic gear. It takes the chip's colour, so it tints like the rest of the chip.
- The chip's tooltip header is now glyph, then the Norse name. The `v1.0` / `v2.0` text is gone.
- The same glyph shows beside the Instinct's name on the Codex rows, the summon and retrain screens (Den and the firmware terminal), the town's Instinct rows, the ranch cards and the recruit event.
- The other 21 Instincts have no file yet and keep the generic gear. To give one a glyph, drop `<REGISTRY_ID>.svg` in the folder; nothing else changes.

**The pieces** (small and single-purpose, as Henry prefers): `src/ui/labels/instinctGlyphs.ts` (the map, beside `instinctNames.ts`; reads the folder at build time and inlines the shapes), `src/ui/components/InstinctGlyph.tsx` (draws one glyph, or the gear when there is no file), and the small edits to the chip, the tooltip and the screens above.

**Tests** (written first, red before the code): the folder holds exactly the 12 for 1.0 and each is a real Instinct; no two share a picture; every glyph is single-colour; an Instinct with no file falls back to the gear; the chip draws the owner's glyph for all 12; the tooltip has the glyph and no `v1.0` / `v2.0`.

**Checked:** `tsc -b`, `eslint src/ui`, `vite build` (the glyph files bundle) and the `src/ui` and `src/App` suites are green on a Linux copy (the two suites that read `steam/` and `public/`, `steamInputTemplate` and `sfxSamples`, need those folders and were not run there). Run `npm run gate` once locally.

**Not verified:** I saw no screenshots. The glyph size and spacing on each screen (16 px on the chip, 14 to 20 px beside names) are my picks; look at them in game. The Unbound glyph's two end links are drawn slightly past the 24 grid edge, so the chip leaves its overflow visible.

**Left alone on purpose:** places that print an Instinct's name inside a sentence or a plain string and have no room for a picture: the card hand's source label, the "already on the field" partner line, and the reflash and rune event option lines. Say if you want them done too.

**For Henry:**

1. Look at the chips in a fight and at the summon screen, and say if any size or gap is off.
2. Answer Steam's AI-content survey when you set up the page, and name the Instinct glyphs in it.
3. Rule on the open question: for 1.0, is a glyph on 12 Instincts and the gear on the other 21 acceptable, or should the other 21 be drawn too (or the glyph shown only where a whole species has one)?
