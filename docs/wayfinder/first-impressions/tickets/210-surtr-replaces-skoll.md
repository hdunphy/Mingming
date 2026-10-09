# Ticket 210: Surtr replaces Sköll (rename, rework the Sköll-only names, new art later)

**Type:** rename and wording, the id rename was cut. **Status:** **OPENED 2026-10-09** (Henry: *"Add a new ticket for all of this please"*); **all five decisions ruled 2026-10-09** (below); nothing built yet, 210a and 210c are ready to build, 210b is cut, 210e (the art brief) is written.

## Why

Fire has two wolves: Fenrir and Sköll. The element trim colour is shared per element, so the only thing that tells two Fire creatures apart on screen is their silhouette. Henry's question and ruling:

> *"What are your thoughts on replacing skoll with surtr? With skoll we have two fire type wolves"*

Surtr is the fire giant who guards the border of Muspelheim and burns the world at Ragnarok. He is a different shape from a wolf, he already runs the Emberfall gym (the SURTALOGI Totem), and the card "Surtr's Fever" (`thermal_overload`) already exists. Most Sköll cards are generic Fire cards that read fine on a giant. A handful are about the sun or about wolves, and those are what this ticket changes.

Henry's answers to my list of Sköll-specific names:

> *"1. Rename treachery to something about waiting for ragnarok like Sentinel (how he stands guard at muspelheim). Or just Muspelheim Guard? What about Ragnarok are we already using that with fenrir? World Ender maybe? Apocalypse? Kindled Wrath isn't bad. Which do you prefer of the ones I mentioned? 2. Sure 3. Rename chase the sun to Surtalogi. Sun Devourer to Lævateinn. Pack Tactics? I forget what it does maybe leave it unless you have a better surtr name 4. Leave it 5. I'd prefer to rename it. Add a new ticket for all of this please"*

He first wanted the ids renamed too, then ruled on my recommendations and my questions (2026-10-09):

> *"1. Yes replace with sentinel 2. Use rampage 3. Surt's Fire for the card 4. A new AI glyph with a sword is fine 5. keep skoll in the code 6. Yes what I'm thinking so far is a fire elemental looking more like the Thor Ragnarok Surtr. One of his arms looks like his sword. This one should be a fire/dark pokemon. He should have the large horns standing tall looking down. Smoke drifting off of him. Id prefer elemental over humanoid giant I think"*

So the final shape is: the player sees Surtr everywhere, and the code keeps the id `skoll`.

## What changes (all data below was read from the repo on 2026-10-09)

| Today | Becomes | Notes |
|---|---|---|
| Species **Sköll** (`skoll`; moves "Sun Chaser Bite", "Solar Flare") | **Surtr** | Display name in `mingmingRegistry.ts`; the two move names are legacy labels and get a Surtr-flavoured rename in 210a |
| Instinct **Treachery** (`TREACHERY_KERNEL`, Sköll v1: an ally loses HP to an enemy, +1 Strength) | **Sentinel** (ruled) | `src/ui/labels/instinctNames.ts`; the hook id does not change (display-only) |
| Instinct **Sunscorch** (`EMBER_FUSE`, Sköll v2) | unchanged | Reads fine on Surtr |
| Card **Chase the Sun** (`chase_the_sun`, 2e Rare, 15 power four times) | **Surt's Fire** (ruled; "Surtalogi" stays the Emberfall Totem's name) | |
| Card **Sun Devourer** (`sun_devourer` + the + version) | **Lævateinn** | Also sits in Fenrir v1's pool (`speciesPools.ts` line 32), so Fenrir shows the new name too |
| Card **Pack Tactics** (`pack_tactics` + the + version, 2e Common, 23 power three times) | **Rampage** (ruled) | |
| Howl, Snarl and the other wolf-flavoured cards | unchanged (*"Leave it"*, as I read his 4) | |
| Text that names Sköll: `osGrammar.ts` (about eleven partner-hint lines), `patchText.ts` (Rune texts for skoll_v1 and v2), `hooks.json` (TREACHERY_KERNEL and EMBER_FUSE descriptions, EMBER_FUSE log line) | "Surtr" / "Sentinel" | Wording only |
| Id `skoll`, `skoll_v1`, `skoll_v2`, sfx and art filenames | **unchanged** (ruled: *"keep skoll in the code"*) | Code only; saves, fixtures, tests and file names are not touched |

Where it shows up in play: the Emberfall gym uses `skoll_v2` with Chase the Sun as its leader card and Pack Tactics in its deck; the Fire intro leaders are two `skoll_v1` at IV 0. Both show the new names automatically, with no data change.

## Rows

| Row | What | Status |
|---|---|---|
| **210a** | **The on-screen swap, ids untouched.** Species display name Surtr; Instinct Treachery to Sentinel; cards Chase the Sun to Surt's Fire, Sun Devourer to Lævateinn and Pack Tactics to Rampage, each with its + version; the legacy move names; and every line of wording that says Sköll or Treachery (list in the table above). Pinned tests that assert the old strings move with it (`instinctNames.test.ts` and any card-name tests). Fight outcomes must be bit-identical: this row changes no number. | Ready to build |
| **210b** | **Cut (ruled 2026-10-09).** Species `skoll`, builds `skoll_v1` / `skoll_v2`, the sfx file names and the card ids all stay, so there is no alias layer, no save risk and no churn in the 35 `src/debug` fixtures, the 38 scratch scripts or the 79 test files. If it is ever wanted it needs an alias layer like `PROGRAM_ALIASES` first (`SaveSystem.ts` has no migration). | **Cut** |
| **210c** | **Replace the Treachery glyph with a sword.** An upright sword planted point-down (Surtr's guard post). Henry OK'd a new AI-drawn glyph (*"A new AI glyph with a sword is fine"*). It replaces Treachery's knife rather than adding a thirteenth, so the count stays at the twelve in ticket 199 and the same Steam disclosure covers it. The file keeps its id name (`TREACHERY_KERNEL.svg`, in `src/ui/assets/instinct-glyphs/`); same 24 x 24 grid, one colour, angular rune-style strokes; `instinctGlyphs.test.ts` must still pass. | Ready to build |
| **210d** | **Placeholder art and audio stay.** `Skoll.svg` and `cry_skoll.mp3` / `os_skoll_TREACHERY_KERNEL.mp3` keep playing until the Surtr art exists; nothing in 210a to 210c depends on new files. The retired `os_skoll_SOLAR_OVERDRIVE.mp3` is left alone. | Nothing to build |
| **210e** | **Art brief for Moab.** Written 2026-10-09 as a doc, "Surtr art brief for Moab": a fire elemental (not a humanoid giant) of black rock and magma in the Thor Ragnarok Surtr mould, Fire/dark in feel, one arm is the sword, tall swept horns standing over a head that looks down, smoke drifting off, with the delivery list and the terms to confirm. The commission itself (price, rights, no-AI promise, posting timing) is Henry's. | Done; Henry sends it |

## Decisions (all ruled 2026-10-09)

| # | Question | Ruling |
|---|---|---|
| D1 | Treachery's new name | **Sentinel.** It matches the effect (it reacts when an ally is hit), is one short word like the other Instinct names, and avoids Fenrir's Muspel Wall and Ragnarok Edge. |
| D2 | Pack Tactics | **Rampage.** |
| D3 | "Surtalogi" is already the Emberfall Totem (`SURTALOGI` in the driver registry, `hooks.json`, `tiers.json`, `surtalogi.test.ts`) | The card is **Surt's Fire**; the Totem keeps its name, so a rule and a card never share one. |
| D4 | A new Instinct glyph | **Yes**, a sword, AI-drawn like the other twelve and covered by the same disclosure. |
| D5 | The id rename | **No.** Keep `skoll` in the code; only the display changes. |

## Not in this ticket

- New Surtr art (210e is only the brief).
- New moves, numbers or balance changes: names only.
- Hati, or any second wolf.
- Any change to the Surtr's Fever card or the SURTALOGI Totem rules (they no longer share a name).
- Renaming any id (ruled out: the code keeps `skoll`), or any save change.
- Pushing.
