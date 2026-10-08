# Ticket 206: Everything still waiting on Henry after the 2026-10-08 build session

**Type:** decisions only, no code. **Status:** **OPENED 2026-10-08** (Henry: "write the rest of the decisions in a new ticket"). One row per decision, each with the options and what it costs. Answer by number; each answer is then built or closed in the ticket named in the "Where" column. Nothing here blocks the code that is already merged.

**Where the session left the branch.** `first-impressions` holds everything built on 2026-10-07 and 2026-10-08: 202a, 202b, 202c, 202e, 202g, 202h, 202k, 188, 195e-2, 200b to 200e, 204. Not pushed. Full vitest run: 522 files, 6038 tests, green; `eslint .` is clean (the lint ignore landed in `9856707e`).

## A. Deferred or rejected by Henry on 2026-10-08

| # | Decision | Status | Where |
|---|---|---|---|
| A1 | **"Party 1 of 3" in the run header (202i).** Henry rejected the ticket: he wants to see all the changes first and may bring it in later, and does not want much copy. | **Deferred**, nothing built. Ticket 204 (the defeat line) mentions it as a companion; the line itself works without it. | 202i |
| A2 | **appId stays `com.hdunphy.mingming`.** | **Decided: no change** | 188 |
| A3 | **Revive floor stays 30%** (walker gym win rate 19.2% before, 30.8% after, over 120 paired gauntlets). | **Decided** | 202b |
| A4 | **Second run carries exactly what the game's save carries**; run 2 finds its gym by name. Limits 80 minutes and $10 a session. | **Decided** | 202c |
| A5 | **Hill polygons in the battle backdrop stay as code-drawn scenery.** | **Decided** | 200 |

## B. Open, small

| # | Decision | Options (lean first) | Where |
|---|---|---|---|
| B1 | **Screenshots of the finished icon swap** (battle with statuses at 12 px, map, town square, ranch, Codex, run summary, at 1280×800 and 1920×1080), so you can judge the status stroke weight (`STATUS_STROKE` in `src/ui/theme/kit/statusIconPaths.ts`, now 2). | After the emoji ticket is merged (lean) · now · skip and look in the game | 200f |
| B2 | **Invisible byte-order mark** at the start of the Norse-names commit subject (`f04a6062`). Harmless; fixing it rewrites that commit and every commit after it. | Leave it (lean) · rewrite before pushing | 195e-2 |
| B3 | **Emoji prefixes inside battle-log lines** held in `src/engine/data/lib/hooks.json` (shield, bolt, heart and others). The engine writes them as plain text, so a Tabler icon cannot go inline. Ticket 205 does not touch them. | Leave for now (lean) · drop the prefixes · draw icons in the log's display code | 205 follow-up |
| B4 | **Type chart: five of eight elements share the neutral dot** (Earth, Air, Ice, Light, Dark). They lost their emoji in the icon swap; the three-letter label stays beside each. | Accept (lean) · pick a Tabler mark per element | 200 follow-up |
| B5 | **Light Stance vs Sun Eater.** Henry thinks Sun Eater has to change. Not decided which thing is renamed: the Sun Devourer card, the Sun-Eater's Plunge card, or Sköll v2's Instinct Sunscorch. Light Stance keeps its sun icon. | Name the one to rename | new ticket once answered |
| B6 | **Which Instinct glyphs ship at 1.0.** 12 of 33 are drawn (ticket 199, AI-drawn, disclosed on Steam); the other 21 keep the gear icon. Henry also owes the Steam AI-content answer naming the glyphs. | 12 is fine (lean) · draw more first | 199 |

## C. Open, design (each needs a session with Henry, not an agent)

| # | Decision | What exists | Where |
|---|---|---|---|
| C1 | **The v1 starters that lose their opening fights.** Report: `research/202d-v1-starters.md`. Proposals P1 (every first-biome wild keeps the start kit minus its payoff: skoll_v1 63.7% to 98.3%, fenrir_v1 92.0% to 99.5%), P2 (jormungandr_v1: lower the wild enemy stat band 0-20 to 0-10 gives 76.5% to 86.5%, or Serpent's Coil 10 to 15 gives 98.8% but its field rate goes 74.3% to 99.7%), P3 (ratatoskr_v1: Seed Bomb 20 to 30 gives 75.0% to 83.8%), P4 (publish fight one and fight two per starter). Also huldra_v2's fight two reads 73.6%. | Read the report | 202d |
| C2 | **jormungandr_v1 redesign** (Henry: "a separate redesign"). Overlaps P2 above. | Ticket opened, not started | 203 |
| C3 | **The cards nobody takes** and **the shop sells upgrades, not cards.** Both wait for a night after 195b to 195d; that night now exists (2026-10-07 and later). | Written, not started | 196, 197 |
| C4 | **Gym prep screen mock** (party, runes, road ahead, two free picks, one Begin button). Mock only. | Not started | 201 |

## D. Measurements only Henry can start

| # | Task | Command or note | Where |
|---|---|---|---|
| D1 | **Naive vs primed brief night** (haiku and sonnet, every starter twice). The primed brief is written. | `npm run overnight -- --brief docs/playtest/agent-player-primed.md --date <date>-primed`, and the plain `npm run overnight` for the naive arm | 202f |
| D2 | **First two-run night: how long and how much.** Watch `driver.json` per session against the 80-minute and $10 limits. Worst case 24 sessions × 80 minutes = 32 hours a model. | Check the report totals and `driver.log` | 202c |

## E. Henry's chores, in order

1. `npm run decks`, then `python build.py` (the design record still shows the old card names from 195e-2).
2. `npm run gate`.
3. `git push origin first-impressions`.
4. Launch the renamed desktop build once (`npm run desktop:build -- --win`, run it from `desktop/release/`) and check three things: the installer, shortcut and window say Mingming Midgard Circuit; your runs and ranch show; the saves folder is still `AppData\Roaming\Mingming` with no new folder beside it.
5. Release blockers still open from before this session: 181c (the feedback button), 181d (the restricted itch.io deploy) and 181e (a version number; `package.json` still says 0.0.0).

## Resolution

Not started.
