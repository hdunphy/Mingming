# Ticket 192: Norse names for the Auras and Runes, and the Tattle token

**Type:** names only. **Status:** DONE 2026-10-03 (one commit, `25e9c5c`; see `## Resolution`). Henry's ruling: *"Accept all including the feedback token"*.

**Where this comes from.** After the 33 Instincts got Norse names (ticket 183i), Henry said *"Same pass needed on aura and runes"*. The proposal is in [`../research/183-aura-rune-names.md`](../research/183-aura-rune-names.md); he approved all of it, and asked for the Feedback token (the card Echo Chamber makes) to be renamed too. His pick for the token was **Tattle**, which suits Ratatoskr, the squirrel who carries gossip.

**What changes.** Only the word the player reads. Card ids, hook ids, patch ids, saves and registries keep their old names, so no save and no balance number moves.

| Kind | Old name | New name |
|---|---|---|
| Aura | Harden | Dwarf-Forged |
| Aura | Battery Pack | Mead Horn |
| Aura | Fertile Ground | Norns' Gift |
| Aura | Short Circuit | Wisdom's Price |
| Aura | Reactive Plating | Berserkergang |
| Aura | Scrubber | Eir's Remedy |
| Aura | Drip Feed | Idunn's Apples |
| Aura | Overclock Core | Well of Mimir |
| Aura | Short Fuse | Hoarder's Toll |
| Aura | Static Ward | Frigg's Oath |
| Aura | Core Overclock | Megingjord |
| Aura | Cinder Armor | Emberhide |
| Aura | Ember Ward | Brynhild's Ring |
| Aura | Feedback Loop | Huginn's Dive |
| Aura | Echo Chamber | Gjallarhorn |
| Aura | Thermal Overload | Surtr's Fever |
| Aura | Einherjar Standard, Riptide, Hoofbeat | kept |
| Rune | Amplifier, Repeater, Relay, Splitter, Overclock, Failsafe | Fehu, Jera, Mannaz, Gebo, Uruz, Algiz |
| Token | Feedback | Tattle |

An upgraded card keeps its plus (Megingjord+, Gjallarhorn+).

## Resolution

Built 2026-10-03 on branch `first-impressions` as one commit, `25e9c5c`, authored by Henry, not pushed.

**How it was built (and one change from the plan).** The plan said the Auras would be a UI-layer table with the data untouched, as the Instincts were. That does not work for cards: a card's `name` reaches the screen by many paths (hand, shop, reward, Codex, deck editor, tooltips), and swapping words in text is unsafe. So:
- the card `name` fields in `src/engine/data/programs.json` now say the Norse names (19 Auras, their "+" versions, and the token);
- a new table `NORSE_AURA_NAMES` in `src/ui/labels/instinctNames.ts` gives the same names to the hook entries in `hooks.json`, whose names stay in capitals (`ECHO_CHAMBER_DAEMON`) because the battle log and the playtest tools quote them. Harden's hooks are under the old id `DEFENSIVE_DAEMON`, which the table covers;
- the Rune names are set in `src/engine/data/patchRegistry.ts`;
- the Echo Chamber card text, its hook description and its two log lines say Tattle, and so does the counter hint ("two Tattle tokens").

**Tests.** `src/ui/labels/auraRuneNames.test.ts` pins all 19 Auras (and their "+"), the match between each card name and its hook name, the six Runes and the Tattle token, and fails if any card or hook text still says "Feedback token". 36 of its 50 checks fail on the parent. Six older tests that pinned old words were updated to the new ones.

**Checked on the Linux copy:** `tsc` clean, `eslint` clean on the changed folders, and these suites green: `src/ui` (components, screens, vfx, hooks, store, labels, counters, settings, utils, ai), `src/engine/data`, `patches`, `DaemonSystem`, `feedbackLoopDraw`, `src/debug/balance/runWalker`. **Not checked:** the whole `src/engine` suite and `src/debug` in one go (the Linux copy stalls on it; the full `npm run gate` on Henry's machine is the real check), and real play. `src/debug/playtest/night.test.ts` fails on the Linux copy because of Windows line endings in the copied brief; it does not touch names.

**For Henry.**
- Run `npm run gate` once (the engine suite above was not run in one go).
- The design record under `docs/wayfinder/deck-archetypes/collection-v2/` (`collection.json`, `registry.json`, `browser.html`, `upgrades.json`) and the card browser still show the old names. They are generated files, so regenerate them on your machine; `plusRegistry.test.ts` was changed to accept "Tattle token" against the record's "Feedback token" until you do.
- The playtest agents and the walker print card names from the registry, so their output now shows the Norse names too.
