# Ticket 206: Everything still waiting on Henry after the 2026-10-08 build session

**Type:** decisions only, no code. **Status:** **CLOSED 2026-10-09** (Henry: chores 1 to 5 done; every row left is owned by another ticket, see *Closed* below). Opened 2026-10-08 (Henry: "write the rest of the decisions in a new ticket"). One row per decision, each with the options and what it costs. Answer by number; each answer is then built or closed in the ticket named in the "Where" column. Nothing here blocks the code that is already merged.

**Where the session left the branch.** `first-impressions` holds everything built on 2026-10-07 and 2026-10-08: 202a, 202b, 202c, 202e, 202g, 202h, 202j, 202k, 188, 195e-2, 200b to 200e, 204 and 205. Not pushed. On the merged tree `tsc -b`, `eslint .` and `npm run icons -- --check` are clean and vitest passes (532 files, 6138 tests). `vite build` ran green on each agent branch but not on the merge.

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
| B3 | **Emoji still in engine data**, about 74 lines in `src/engine` (StatusBehaviors 19, statusGlossary 14, ActionExecutors 13, hooks.json 11, effectHandlers 10, battleReducer 7): mostly combat-log prefixes (shield, bolt, heart), plus the stance moon and sun. `statusGlossary.ts` also holds an emoji per status that nothing in the UI reads (dead data). The engine writes these as plain text, so a Tabler icon cannot go inline. | Leave for now (lean) · drop the prefixes and the dead data · draw icons in the log's display code | 205 follow-up |
| B4 | **Type chart: five of eight elements share the neutral dot** (Earth, Air, Ice, Light, Dark). They lost their emoji in the icon swap; the three-letter label stays beside each. | Accept (lean) · pick a Tabler mark per element | 200 follow-up |
| B5 | **Light Stance vs Sun Eater.** Henry thinks Sun Eater has to change. Not decided which thing is renamed: the Sun Devourer card, the Sun-Eater's Plunge card, or Sköll v2's Instinct Sunscorch. Light Stance keeps its sun icon. | Name the one to rename | new ticket once answered |
| B6 | **Which Instinct glyphs ship at 1.0.** 12 of 33 are drawn (ticket 199, AI-drawn, disclosed on Steam); the other 21 keep the gear icon. Henry also owes the Steam AI-content answer naming the glyphs. | 12 is fine (lean) · draw more first | 199 |
| B7 | **Type chart button icon.** `dna` reads as a crosshair at 16 to 20 px; Tabler's `dna-2` (vertical helix) reads clearly as DNA. | `dna-2` (lean; one word in `typeChartIcons.ts`, plus the name in `names.json` and `npm run icons`) · keep `dna` | 205 |
| B8 | **Type chart footer (the same-element bonus).** The bolt means energy only, so the footer uses `circle-plus`. | Keep (lean) · sparkles · chevrons-up · rosette | 205 |
| B9 | **Five effect-line picks that were not on the default list:** `multiplier-2x` (multiply status), `arrow-back-up` (return), `stopwatch` (trigger status), `repeat` (replay last card), `arrow-ramp-right` (redirect target). The plain "replays: none yet" arrow on the hand card face (`HandCardFace.tsx`) was left as text. | Accept (lean) · rule per pick on the 205 sheet · also change the card-face arrow | 205 |
| B10 | **Look at the new screens once in the running game:** the gym badges under the gym node on the map at 1280 wide (T12, 202j), and the card tooltip icons, which draw at only 9 to 11 px (T13, 205). `InlineIcon` takes a size if the tooltip icons read too small. | Your look | 202j, 205 |

**Henry's answers to B1 to B10 (2026-10-09).** Source: the Wayfinder Open Items page (<https://claude.ai/artifact/2jFR2MYhDy8Mz5otXrnmfz>, the 206 card, snapshot at `d861b76`), which held them before this file did. Where Henry ruled again in chat later the same day, the newer ruling is given too and marked *Henry in chat, 2026-10-09*.

| # | Answer | State | Where |
|---|---|---|---|
| B1 | The status icons looked fine; the 2026-10-08 battle screenshots at 1280×800 and 1920×1080 agree. | **Settled** | 200f (can close on Henry's say) |
| B2 | Leave the byte-order mark. | **Settled** | 195e-2 |
| B3 | The engine-data emoji go on a card of their own. | **Settled**: that card is [ticket 213](213-engine-data-emoji.md), opened 2026-10-09 | 213 |
| B4 | Leave the neutral dot (those elements are not shipping yet). | **Settled** | 200 |
| B5 | Rename nothing; the icons stay as they are, so Light Stance keeps its sun icon. | **Not settled.** Overtaken by [ticket 210](210-surtr-replaces-skoll.md), which renames the Sun Devourer card to Lævateinn, against the recorded "rename nothing". 210 is on hold (Henry, 2026-10-09: "wait"), so this stays open until he confirms that 210 is what he wants | 210 |
| B6 | Stay at the 12 Instinct glyphs. | **Settled** | 199 |
| B7 | The page: **not settled**; he does not want DNA for the type chart button, so the icon is looked at again in 205 (the picture sheet is `research/205-icon-alternatives/`). **Henry in chat, 2026-10-09:** Tabler `table`. | **Settled** (Henry in chat, 2026-10-09). **Built and merged 2026-10-09** (`48e37a4`, merged in `5907646`) | 205 |
| B8 | `circle-plus` stays for the same-element footer. | **Settled** | 205 |
| B9 | The five effect-line picks are good. | **Settled** | 205 |
| B10 | The page: the gym badges look good; the card tooltip icons (9 to 11 px) were not mentioned. **Henry in chat, 2026-10-09:** the tooltip icons go to 14 px (`size="1.25em"`, so they still follow the Text size setting) with thicker lines (stroke 2), and no filled variants (dropped because 8 of the 19 effect icons and 8 of the 14 status icons have no filled Tabler version). | **Settled** (Henry in chat, 2026-10-09). **Built and merged 2026-10-09** (14 px `f20ab9c`, stroke 2 `5417f97`, merged in `5907646`), then a tooltip polish followed (`fi/t8-tooltip-polish`: the glossary status icon sits on its line and follows Text size, `e623fa3`; the Requirements triangle, the met tick and the glossary icon are 14 px, `4343630`) | 202j, 205 |

## C. Open, design (each needs a session with Henry, not an agent)

| # | Decision | What exists | Where |
|---|---|---|---|
| C1 | **The v1 starters that lose their opening fights.** Report: `research/202d-v1-starters.md`. Proposals P1 (every first-biome wild keeps the start kit minus its payoff: skoll_v1 63.7% to 98.3%, fenrir_v1 92.0% to 99.5%), P2 (jormungandr_v1: lower the wild enemy stat band 0-20 to 0-10 gives 76.5% to 86.5%, or Serpent's Coil 10 to 15 gives 98.8% but its field rate goes 74.3% to 99.7%), P3 (ratatoskr_v1: Seed Bomb 20 to 30 gives 75.0% to 83.8%), P4 (publish fight one and fight two per starter). Also huldra_v2's fight two reads 73.6%. | Read the report. **2026-10-09:** Henry's Ratatoskr v1 note ("seed bomb feels like it should hit harder. 10 cards only did 500 damage. Maybe thats his stats") is evidence for P3; the formula gives 389 to 533 for ten cards at his attack, and a frame raise (ticket 208b) multiplies with P3, so decide them together. See [208c](208-rat-v1-playtest-notes-2026-10-08.md) | 202d, 208 |
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

**2026-10-09:** section B is answered (see *Henry's answers to B1 to B10* under B); only B5 is not settled, because ticket 210 overtook it and 210 is on hold. C and D are still open, and Henry has said to leave them until he has played the new biome order (ticket 211).

## Note, 2026-10-09: the creature pictures in the build

*Henry in chat, 2026-10-09.* No B row covers art, so it is recorded here. Of the four creature pictures in the build (`src/assets/battleArt/mingming/`), **`Fenrir.png` is Henry's own, not AI-made, and stays.** `Fenrir_old.png` (the first sketch), `Kraken.png` and `Ratatoskr.png` are removed from the game on branch `fi/t7-drop-fenrir-old`, under the standing ruling that no AI-generated picture ships. **Built and merged 2026-10-09:** `aec207f` and `62d3c86` (merged in `3811d64`). Henry then also had the 183 mocks' AI pictures (`art/fenrir.png`, the old robot wolf, `art/kraken.png`, `art/ratatoskr.png`) and the three battle renders that showed them deleted (`40bfb5e`, `b672346`).

## Closed, 2026-10-09

**Chores E1 to E5 are done** (Henry, 2026-10-09; checked against the repo the same day). E1: the design record shows the new names (`registry.json` holds Urðarbrunnr; regenerated 2026-10-09). E2: Henry ran `npm run gate` and it passed. E3: pushed; `first-impressions` and `origin/first-impressions` are both at `d633df5`. E4: Henry launched the renamed desktop build and his saves work; `desktop/package.json` names the product and shortcut Mingming Midgard Circuit, and `appId` stays (A2). E5: 181c, 181d and 181e are built and merged (`package.json` says 0.4.0); what is left of the release is Henry's own itch steps, which live in ticket 181, not here.

**Nothing in this ticket is open any more.** Every row that was still waiting moved to the ticket that owns it:

| Row | Where it lives now |
|---|---|
| A1 "Party 1 of 3" | [202](202-night-2026-10-06-rulings.md) row 202i, deferred by Henry |
| B1 status-icon look | settled; 200f can close on Henry's say, in [200](200-tabler-icon-swap.md) |
| B5 Light Stance vs Sun Eater | [210](210-surtr-replaces-skoll.md): Henry's "rename nothing" meets 210's Sun Devourer to Lævateinn; he confirms or reverses it when he takes 210 off hold |
| C1 the v1 starters | [202](202-night-2026-10-06-rulings.md) row 202d (`research/202d-v1-starters.md`) and [208c](208-rat-v1-playtest-notes-2026-10-08.md) (Seed Bomb, parked) |
| C2 jormungandr_v1 | [203](203-jormungandr-v1-redesign.md) |
| C3 the cards nobody takes, the shop | [196](196-unused-cards.md), [197](197-shop-buys-vs-upgrades.md) |
| C4 gym prep mock | [201](201-gym-prep-mock.md) |
| D1 naive vs primed night | [202](202-night-2026-10-06-rulings.md) row 202f |
| D2 first two-run night | [202](202-night-2026-10-06-rulings.md) row 202c |

C and D stay on hold until Henry has played the new biome order (ticket 211, D5).
