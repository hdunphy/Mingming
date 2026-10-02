# First Impressions — Wayfinder Map

Label: `wayfinder:map` · Branch: `first-impressions` · Charted 2026-10-02 (split out of [deck-archetypes](../deck-archetypes/map.md))

**Tracker conventions (local-markdown, same as deck-archetypes):** tickets are files in [`tickets/`](tickets/). Each carries `Type`, `Status`, and what it is blocked by. **Ticket numbers are kept from deck-archetypes** (commit messages, reports and the Claude project docs all cite them); **new tickets here start at 185.** Resolutions go in the ticket's `## Resolution` section on close and are gisted under "Decisions so far".

## Destination

**Playtest round 2 goes out on a build whose first impression does not read as AI-made**, and its results are written up. That means: one sentence of copy per screen, a short intro run for new players, the direction-B "Slant" UI kit, on-screen words that fit the animal-inspired Pokémon direction, and the Fenrir test commission under way. **Done when** ticket 181's release procedure has run and `playtest-results/round-2-friends/summary.md` exists. After that: the map redesign (176), localization prep (175), and the "Long Road" modifier (176's follow-up).

Henry's frame (2026-10-01): *"The game currently looks like a generic Claude web app and is AI sloppy because of all the heavy text. I don't want a bad 1st impression."* One-line pitch: *"Slay the Spire dressed as Pokémon."*

## Tickets and order

| # | Ticket | State (2026-10-02) | Blocked by |
|---|---|---|---|
| 185 | [Strength nerf and reward weighting](tickets/185-strength-nerf-and-reward-weighting.md): Forage stops feeding fenrir_v1, TREACHERY needs real HP loss, Sun Devourer halved, Core Overclock to flat power, rewards remember and weight, the tier-unlocked line | Ruled 2026-10-02, all decisions answered; 185a–e buildable | 185f: 182 |
| 184 | [Playtest polish 3](tickets/184-playtest-polish-3.md): draw-pile viewer, Burn overflow text, counters, per-OS patch text | **Done** (184a–e, `53bcedc..85d5183`) | — |
| 182 | [Text cut, hide-when-empty, intro run, two switches](tickets/182-text-cut-and-intro-run.md) | Ruled, not started | — |
| 183 | [Art direction and UI kit](tickets/183-art-direction-and-ui-kit.md): direction B "Slant", rows 183a–h | Ruled (D1–D7), not started | 183f and 183h after 182 |
| 181 | [Playtest round 2 (SOP)](tickets/181-friends-playtest-1.md) | 181a, 181b built; 181c waits on Henry's Google Form | 182, 183, 181c |
| 176 | [Map redesign: towns and branching routes](tickets/176-map-redesign.md) | **Blocked** | 183a–c |
| 175 | [Localization prep](tickets/175-localization-prep.md) | Ruled, not started. **Comes after everything else here, especially the text cut** (Henry, 2026-10-02) | 182, 183h |
| 180 | [Agent playtester](tickets/180-agent-playtester.md) | Ruled (A1–A6), queued; **do not start until Henry says go** | Henry |

**The frontier:** build 182 → build 183a–e → 183f–h → 181c once the form exists → release (181) → 176 → 175. 180 whenever Henry says go. **185** (balance and rewards) runs alongside 182/183 — it shares no files with them except 185f's `RunSummary.tsx`, which waits for 182.

## Decisions so far

- **RULED 2026-10-02 — [185 Strength nerf and reward weighting](tickets/185-strength-nerf-and-reward-weighting.md)** (from the Rootfall/fenrir_v1 playtest): Forage is not an attack for UNBOUND_KERNEL; TREACHERY fires only "if an ally gets damaged by an enemy"; Sun Devourer halved now; Core Overclock nerfed to flat power (+1 per 2 Strength, +1 per Strength upgraded); rewards stop repeating the last two picks, weight toward the party's currencies, and boost payoffs when the deck has none for a currency (×2 synergy, ×3 missing payoff, to retune after play); Bark Shield goes on the HP bar (in 183). Standing: **the 1v1 grid no longer gates card changes, except at the start of a run.**
- **DONE 2026-10-02 — [184 Playtest polish 3](tickets/184-playtest-polish-3.md):** the draw pile opens like the discard, Burn overflow reads "OVERFLOW", firmware/Driver/daemon counters, and per-OS patch text in the game after Henry's two sets of patch rulings (184e: SPLITTER no longer pays the host twice). Report: the Claude project doc "ticket-184-outcome".

- **Direction ruled (2026-10-01/02):** moving away from the futuristic robot theme toward the nostalgic Pokémon feel, without crossing the "clone" line. UI: direction **B "Slant"** (183), Sword/Shield-style slanted navy panels on the existing battle geometry. The battle screen keeps its layout; it gets a colour-and-shape facelift.
- **The intro run is the first-run gate (182):** a separate, removable mode outside the tier ladder, a hand-built 6-node map, a free recruit, a one-fight leader, no macros/patches/firmware choice. Plus hide-when-empty instead of an unlock ladder. Two separate switches: **Skip intro** and **Show advanced content**. The intro is mainly for round 2; it may be scrapped later or become the demo for early playtesters.
- **On-screen words (183 D1, 183h):** firmware/OS → **Instinct**, reflash → **Retrain**, blueprint → **Trace**, assembly → **Summon**, workshop → **Den**, daemon → **Aura**, macro → **Draught**, patch → **Rune**, driver → **Totem**, scrap → **Amber**, program → **Card**, Mingming stays. Code, data ids and saves keep the old words. Built after 182.
- **The playtest waits on 182 and 183** (181 D4, D15 changed). The ask: the intro, then one full run if they enjoyed it. Deploys come from `main`: **merging to `main` publishes to GitHub Pages.**
- **No AI-generated picture is ever sent to an artist** (Henry, 2026-10-02). The Fenrir commission is the test piece only (one design, PNG + PSD, one sketch round); portraits and card-art crops come in a later booking if Henry likes the test.
- **A longer run is an opt-in "Long Road" modifier after 176**, not a tier (recorded at the end of 176).

## Cross-map

- **[deck-archetypes](../deck-archetypes/map.md)** keeps balance, decks and combat. Open there: 170d (walker fixes, waiting on Henry's pick) and 178 (deck search, parked).
- **[steam-release](../steam-release/map.md)** owns the roadmap and the store: its [32 art direction](../steam-release/tickets/32-art-direction.md), [33 species art](../steam-release/tickets/33-species-art.md) and [34 UI art pass](../steam-release/tickets/34-ui-art-pass.md) overlap 183. Decide here, record there.
- **Claude project docs** (Mingming-Balancing project): `claude/ticket-182-text-cut-and-intro-run.md`, `claude/ticket-183-art-direction-and-ui-kit.md`, `claude/map-design-176.md`, `claude/agent-playtester-180.md`, `claude/tier0-cut-list-and-ui-direction.md`. The per-screen cut list is the Claude Doc "Mingming Tier 0 Cut List"; the UI mock-ups are the Design canvas "Mingming Battle Screen — Pokémon direction".

## Notes

- Domain and repo rules are deck-archetypes' (see its map's Notes): React 19 / TypeScript / Vite / Redux Toolkit, headless engine in `src/engine`, **`npm run gate`** before every commit, commits authored as Henry Dunphy <hdunphy15@gmail.com> with no Co-Authored-By, **never push** (Henry pushes), CRLF in `docs/wayfinder`, LF in new `src` files, one commit per row.
- Henry prefers many small single-purpose modules and components, composed; no monoliths.
- Reports are plain English and end with the decisions Henry owes.
