# Ticket 199: The Instinct glyphs, made by Henry

**Type:** art task for Henry (33 glyphs), then a small wiring pass. **Status:** opened 2026-10-05. Split out of [194j](194-henry-playtest-2026-10-04.md) step 2. Not started.

**Henry (2026-10-05):** *"Add a new ticket 198 for me to generate these myself. They count as AI Generated art I think."* (Numbered 199 at his next instruction: *"increment those tickets by one."*)

**Why.** 194j ruled a glyph per Instinct so a player can tell at a glance which Instinct a Mingming runs (*"Maybe a glyph that players will learn"*). Step 1 of 194j was a glyph sheet that Claude drew as code (`results/194j/glyph-sheet.html`, `glyphs.json`). That is AI-generated art, and the standing rule from 190 is **no AI-generated art ships**. So those glyphs are **not wired and do not ship**. Henry draws the real ones.

---

## What Henry makes

**33 glyphs, one per Instinct**, the same 33 as `NORSE_INSTINCT_NAMES` in `src/ui/labels/instinctNames.ts`. The key is the registry id; the name is what the player reads.

| Species | Instinct id | Shown name |
|---|---|---|
| fenrir_v1 | UNBOUND_KERNEL | Unbound |
| fenrir_v2 | CINDER_WALL_OS | Muspel Wall |
| kraken_v1 | ABYSSAL_INK_SYS | Abyssal Ink |
| kraken_v2 | TIDAL_CRUSH_OS | Tidal Crush |
| fafnir_v1 | HOARD_PROTOCOL | Dragon's Hoard |
| fafnir_v2 | CORRUPTED_GOLD_OS | Andvari's Curse |
| skoll_v1 | TREACHERY_KERNEL | Treachery |
| skoll_v2 | EMBER_FUSE | Sunscorch |
| jormungandr_v1 | OUROBOROS_LOOP | Midgard Coil |
| jormungandr_v2 | TOXIN_FANG_OS | Venomfang |
| gullinbursti_v1 | UNSTOPPABLE_MASS | Golden Bristles |
| gullinbursti_v2 | KINETIC_RAM_OS | Tuskrush |
| hraesvelgr_v1 | GALE_FORCE_OS | Eagle's Gust |
| hraesvelgr_v2 | UPDRAFT_KERNEL | Stormrise |
| sleipnir_v1 | MOMENTUM_DRIVE | Eightfold Stride |
| sleipnir_v2 | WAR_STEED_OS | Odin's Charge |
| ratatoskr_v1 | GOSSIP_NODE | Branch Gossip |
| ratatoskr_v2 | INSTIGATOR_OS | Tale-Bearer |
| huldra_v1 | ALLURE_PROXY | Glamour |
| huldra_v2 | BARK_SHIELD_OS | Elderwood Ward |
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

**What a glyph has to do** (carried over from 194j):

- Hint at what the Instinct does (a shield for Elderwood Ward, a coil for Midgard Coil), so it can be learned.
- The two Instincts of one species must look **clearly different at chip size**.
- **Single colour**, so the chip can tint it by element.
- Readable at chip size (about 16 to 20 px) and at tooltip size.

**Suggested file shape (Henry may change it):** one SVG per Instinct, named by the registry id (`UNBOUND_KERNEL.svg`), 24 x 24 view box, `fill="currentColor"` or `stroke="currentColor"` with no other colours, dropped into one folder. Henry picks the folder.

The Claude-drawn sheet can be used as a **checklist of ideas only** (what each one should hint at). Nothing from it is copied, and `results/194j/` stays out of the build. Henry decides whether to delete it.

## What the wiring pass does (194j step 2, after the art exists)

Small single-purpose pieces, as Henry prefers: one map, one loader, one component.

- `instinctGlyphs.ts`: a map from Instinct id to its glyph file, beside `instinctNames.ts`.
- A glyph component that draws a glyph from that map and tints it.
- `FirmwareChip` draws the owner's Instinct glyph instead of the generic `firmware` icon.
- The tooltip header shows the glyph beside the Norse name and **drops the `v1.0` / `v2.0` text** (194f left it for this row).
- Anywhere else an Instinct is named (retrain, summon, codex) shows the same glyph, so players learn it.

**Build order suggestion:** wire first, with the generic `firmware` icon as the fallback for any Instinct that has no file yet. Then Henry's art can arrive a few files at a time and show up as each lands.

**Tests.** Every Instinct id in `instinctNames.ts` has a glyph file once all 33 exist, and no two Instincts share one. The chip renders the owner's glyph (or the fallback while a file is missing); the tooltip has no `v1.0` / `v2.0`.

## Done when

All 33 glyphs are in the repo, the chip and tooltip show them, no `v1.0` / `v2.0` text is left, and Henry has looked at the chips in game.
