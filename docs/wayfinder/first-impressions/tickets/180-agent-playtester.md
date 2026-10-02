# Ticket 180: An agent playtester — the game as text, played by an AI overnight

**Type:** tooling (playtest and bug finding). **Status:** 180a–180f BUILT and committed on `first-impressions` (2026-10-02). **180g (the pilot) is not started: it spends real tokens and needs Henry's go.** Decisions A1–A6 were ruled yes (the recommended defaults). See *Progress* below and [HANDOFF-180.md](HANDOFF-180.md).

**Henry (2026-10-01):**

> *"I could have low token usage agent run games overnight to collect feedback as if it were playtesting mostly on bugs and balance. This would be easier than the automated Walker that we have since the Walker seems to be too dumb to make correct decisions and would be better for balance than me as you can keep track of why you made decisions, whereas sometimes a human will just make a gut pick without understanding why they picked it that way."*

**The idea.** A small command-line tool turns a run into text. It prints what the player would see on the current screen, plus a numbered list of every legal move. It then applies the move the player picks. An AI agent plays a run through it, giving a one-line reason for every choice. Before every card play, it also writes down what it expects the card to do. The tool compares that prediction with what actually happened and logs every mismatch as a **surprise**. A surprise is either a bug or wording that misled the player, and both are worth finding.

**Not the screen.** Driving the real UI with screenshots costs millions of tokens and hours per run; this tool is text only. UI bugs stay with Henry's playtests.

**Not a replacement for the walker or the simulations.** A night gives dozens of runs, not thousands, so it is for bugs, wording and reasoned balance notes. Win rates still come from the walker (170), the sims, and deck search (178).

---

## Decisions (recommended defaults first)

- **A1. What drives the agent:**
  - **Default:** a headless Claude Code session per run, whose only allowed command is this tool. It uses Henry's existing setup and needs no API code in the repo.
  - **Alternative:** a small Node loop calling the API with a fresh prompt per decision. This is cheaper per decision, but it needs an API key and billing.
  - The pilot (180g) measures A1's real cost and decides whether to switch.
- **A2. Who plays the fights, by mode** (the tool supports all three):
  - `run`: the agent makes every run choice (route, card picks, shop, upgrades, recruits, events), and the game's own battle AI plays the fights for the player. About 50–80 decisions a run.
  - `turn`: like `run`, but the agent also plays fights, sending one whole turn as a list of moves. About 150–250 calls.
  - `card`: the agent sends every card play on its own. About 500–700 calls.
  - **Nightly default:** `run` mode for most runs, plus one `card`-mode run a night aimed at surprises.
- **A3. Which model:** the pilot plays the same seed with a small, fast model and a stronger one, then compares cost against decision quality. The nightly default is the small model, if its reasons hold up.
- **A4. The agent plays only from what the tool shows.** It may not read `src/`, data JSON, tickets or balance docs. A player knows only what the game tells them, and a misleading card text is something we want it to fall for.
- **A5. Runs per night:** 10 by default, re-sized after the pilot from the measured time and tokens per run.
- **A6. Where results go:** raw sessions and logs go to `results/playtest/<date>/` (not committed). The morning report goes to `docs/playtest/agent-runs/<date>.md` (committed, LF).

---

## How to work this ticket

1. **Read the whole row first.** Search for the quoted names; line numbers drift.
2. **Test first, run it on the parent, see it fail.** Put "fails on parent: yes" in the commit message.
3. **No game code changes.** Everything goes in `src/debug/playtest/`. The tool calls the same reducers and engine functions the screens and the walker call (`runSlice` actions, `rollEncounter`, `rollDropTable`, `battleReducer`, `getBestAction`, `buildScenarioState`). If a row seems to need an engine change, stop and ask Henry.
4. **Small single-purpose modules** (Henry's standing preference):
   - one module per screen, each a renderer plus a legal-moves function
   - one for the session
   - one each for expectations, invariants and the report
   - a thin CLI

   No module over about 300 lines, and no god object.
5. **Gate:** `npm run gate` green before each commit. **Commits** authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`), no `Co-Authored-By`, last line `HANDOFF: <one sentence>`. **Do not push.**
6. **Report** in plain English at the end, with 180g's numbers.

**Dependencies:**

- **180d** needs **177a** (`legalActions`, battle moves in their own module). Build 177a first if it hasn't landed; it's a pure refactor.
- **176 (the map and towns)** may land before or after this ticket. The map screen must list moves from the current node's `edges` and its `visited` state, never assume the old 5-layer shape, and handle a `town` node if one exists. Whichever ticket lands second adds the other's screens.

| Row | What |
|---|---|
| 180a | The session (a seed plus a move log, replayed), the CLI, and the map, reward and auto-fight screens |
| 180b | Market, workshop, upgrades and patches |
| 180c | Events, the gauntlet, the biome boundary and the loadout editor |
| 180d | Battles played by the agent (`turn` and `card` modes) |
| 180e | Expectations, surprises and invariant checks |
| 180f | The player brief, the nightly runner and the morning report |
| 180g | The pilot: one seed, two models, measured |

## Progress (2026-10-02)

| Row | Commit | Notes |
|---|---|---|
| 180a | `f081a09` | session, CLI, map, reward and auto-fight screens |
| 180b | `ef390fb` | market, workshop, upgrades and patches |
| 180c | `18e1dbb` | events, gauntlet, biome boundary, loadout editor, engine-error path |
| 180d | `2bf88fd` | battles played by the agent (`turn` and `card` modes), turn cap, decision budget |
| 180e | `4001f52` | `--expect` predictions, surprises, invariant checks, `replay --to` |
| 180f | `a20a47e` | player brief, `playtest:night`, `playtest:report`, `plan` command |
| 180g | not started | needs Henry's go (it spends real tokens) |

Each row was test-first, with the new tests shown failing on the parent commit, and the full gate green before the commit.

**Where the rows differ from the text above:**

- **The results folder is a flag.** The repo's vite config empties `process.env` for everything vite-node runs, so an environment variable cannot be read. Every command takes `--results <folder>`; the nightly script tells each agent which folder to use.
- **The decision budget counts calls, not moves.** A `moves` list is one decision. Past the budget the run ends as `abandoned` with outcome `budget`. Default 400; `new --budget N` sets another.
- **Over the turn cap is a draw,** recorded as a defeat flagged `truncated`. The cap (60) is a copy of the walker's `WALK_MAX_TURNS`, which is private there; a test reads the walker's source and fails if they drift apart.
- **`stabilizeIds`** renames the engine's random UUIDs (statuses, generated cards) to `tok_<n>`, so a replay is exact. Without it two replays of one session differ.
- **`card` mode takes one move per call.** A `moves` list of more than one is refused there.
- **`--expect`:** `hits` counts hits on enemies only; `status` and `self` are compared whole (a status change the agent did not list is a miss). An unknown key is refused.
- **The invariants** found in the tool are named: run-schema, duplicate-card-id, hp-range, energy-negative, card-vanished, turn-cap, soft-lock, engine-error, move-refused, fight-truncated, screen-error. A check that throws is itself logged as `screen-error`.
- **Nothing pins on-screen wording.** Text is printed from the game's own modules; the brief and the tests carry none of it.

**Things that looked like game bugs (not fixed: rule 3) are now ticket 186.** After a second look two of the first list were not bugs (the wild-enemy firmware id is a deliberate marker in the balance tool, and `legalPlays` listing plays the reducer may refuse is documented behaviour). The engine crash on seed `ps2` could not be reproduced again. What is left: random ids in the battle engine (186a), map nodes with identical names (186c), card text that leaves out what the firmware adds (186d), and damage credited to `SYSTEM` (186e).

**Running it:** [docs/playtest/run-tonight.md](../../../playtest/run-tonight.md) is the checklist for the first real night. After 180f the driver command was tightened (`--tools Bash`, `--permission-mode dontAsk`, `--max-budget-usd`), because read-only tools like Read and Grep need no permission in a headless run, so allowing one command was not enough to keep the agent out of `src/` (A4).

**Henry owes:** the go for 180g and the pilot starter; whether the A1 driver flags stand (they are unverified until the pilot); the nightly default model and when to start the nightly runs; the rulings on ticket 186; and whether `hits` and `status` mean what he wants. Details in [HANDOFF-180.md](HANDOFF-180.md).

---

## 180a: The session, the CLI, and the first screens

1. **A session is a seed plus a move log,** saved as `results/playtest/<session>/session.json`: `{ seed, starter, gymIndex, mode, tier, modifiers, moves: [...] }`.
   - Every command rebuilds the state by **replaying** the log from the seed: a fresh store, `createRun`, then every move in order.
   - Add `results/playtest/` to `.gitignore` (other folders under `results/` are committed, so ignore only this one).
   - The engine is deterministic, so a replay is exact. That also means any session file is a perfect bug reproduction.
   - **Test:** replaying a 30-move session twice gives identical state hashes.
2. **The CLI** (`src/debug/playtest/cli.ts`, script `npm run playtest -- <command>`):
   - `new --session s1 --seed ps1 --starter <species> --gym 0 --mode run|turn|card` starts a session.
   - `state --session s1` prints the current screen and its numbered legal moves.
   - `move --session s1 <n> --why "<one sentence>" [--expect '<json>']` applies one move.
   - `moves --session s1 <n,n,n> --why "..."` applies several moves (one battle turn in `turn` mode).
   - `card --session s1 <name>` prints one card's full text.
   - `note --session s1 "<text>"` records a free-form balance or wording note.
   - `--why` is **required** on every move; a missing reason is refused with a message.
3. **Rendering is compact text, not JSON** (`--json` gives JSON for scripts).
   - Every screen starts with one status line: biome, scrap, party with HP, deck size, macros, tier.
   - Then it shows what the screen offers, then the numbered moves.
   - Card text is printed exactly as the game builds it (the same description builders the UI uses), never paraphrased.
   - Target size: **under about 1,000 tokens** for a run screen. Measure it in a test with a rough characters-divided-by-4 count on fixtures.
4. **Screens in this row:**
   - **Map:** the current node and each node you can step to, with its kind as the game shows it (respecting fog and reveals). Moves: one per reachable node.
   - **Fight (`run` mode):** entering a fight node plays the fight with the game's own AI on **both sides**, exactly as the walker's `fight()` does. The screen then shows the outcome: won or lost, turns, HP left per member, and the five biggest hits from `damageLedger` totals.
   - **Rewards:** scrap and blueprints as paid. Card picks show each option's full text; moves are pick option 1–3, send to the collection, or skip. Macro or patch picks are shown the same way.
5. **Tests:**
   - a new session's first screen is the map, with the scripted first fight as the only move
   - a fight resolves and shows rewards
   - a pick lands in the deck
   - an illegal move number is refused without changing the session

## 180b: Market, workshop, upgrades and patches

1. **Market:**
   - the shelf as the game rolls it (171b's frozen team, refresh price, SOLD state, off-pool tag)
   - the blueprint offer, macros with the rack, patches, sell list, junk removal, the upgrade bench and its allowance
   - one move per affordable purchase, a refresh move, sell moves, upgrade moves, and **leave**
   - unaffordable items are shown with "N short" and get no move
2. **Workshop:** blueprints held, assembly (species, each firmware and its 5-card engine, price), reflash per member, party and bench swaps, the upgrade bench, and **leave**.
3. **Upgrades** show the card now and after (`+` text) and the price.
4. **Reuse the screens' own helpers** for prices, allowances and eligibility (`marketplace.ts`, `workshop.ts`, `UPGRADES_PER_VISIT`, `PatchBench`'s offer logic, `workshop.ts`'s recruit and reflash helpers). Never recompute a rule here.
5. **Tests:**
   - each move type changes the run exactly as the matching reducer does
   - a third upgrade at a two-upgrade bench has no move
   - buying a blueprint then recruiting works within one visit

## 180c: Events, the gauntlet, the boundary and the loadout

1. **Events:** the event text and its playable choices (`playableChoices`), each with its outcome line as the game shows it. The follow-up screens (card picks, trades, Ambush Bait fights) use 180a and 180b's screens.
2. **The gauntlet:**
   - the gate (its free upgrade and patch benches)
   - then each fight, with HP carried over and the repair between fights (173)
   - in `run` mode the AI plays it; in `turn` or `card` mode the agent does (180d)
3. **The biome boundary offer (ticket 61) and the loadout editor:**
   - move a card between deck and collection
   - bench or swap a member
   - the deck floor rule is enforced by the same helpers the editor uses
4. **Tests:** a full `run`-mode session on a fixed seed reaches the end of the run without an unhandled screen. Assert there is no "unknown screen" path.

## 180d: Battles played by the agent

1. **The battle screen:**
   - **Each side:** name, species, firmware, HP and max, shield, energy, statuses with stacks, and the enemy's intent if the game shows it.
   - **Your hand:** each card with its cost and full text, plus your draw and discard pile counts and your macro rack.
   - **Moves:** `legalActions` (177a) for the player side, each written as **"play <card> (cost) from <caster> → <target>"**, plus macro moves and END TURN.
2. **The enemy side** plays with the encounter's own AI tier and beam, exactly as `runOne` sets them.
3. **`turn` mode** takes a list of moves for the turn and stops at the first illegal one, reporting it. **`card` mode** takes one move per call.
4. **A turn cap** (60, the walker's `WALK_MAX_TURNS`; export it rather than copying the number) and a **decision budget** (default 400 per run) end a session cleanly, with outcome `budget`.
5. **Tests:**
   - a scripted fixture battle played move by move through the CLI ends in the same state as the same moves applied with `battleReducer` directly
   - END TURN hands the turn to the enemy AI and back

## 180e: Expectations, surprises and invariants

1. **`--expect`** on a card or macro move is a small JSON prediction:
   - `{"hits": 2, "kills": ["e1"], "status": {"e1": {"Dazed": 2}}, "self": {"Strength": 1}, "draw": 1, "energy": -2}`
   - every key is optional
   - damage amounts are **not** predicted (the agent can't see the stats, and that's fine)
2. **What actually happened** is computed from the state before and after the move, plus that action's `damageLedger`:
   - hits per target and kills
   - status stacks gained or lost per entity
   - cards drawn, energy spent or gained
   - cards created or exhausted
3. **A surprise** is any key where prediction and result differ. It is logged with:
   - the card's printed text
   - the prediction, the result, and the session and move index
   - a one-line replay command
4. **Invariants**, checked after **every** move, in every mode. Each failure is logged as an **invariant failure**, which is a likely bug:
   - the run state passes `RunStateSchema`
   - HP is between 0 and max; energy is never negative
   - no card instance id appears twice
   - the cards in deck + hand + discard + exhausted only change through a logged effect
   - the battle ends within the turn cap
   - the screen always offers at least one legal move (no soft-locks)
   - any exception thrown by the engine
5. **Tests:**
   - a hand-made wrong prediction is logged as a surprise and a right one is not
   - a fixture state with a duplicated instance id raises the invariant failure

## 180f: The player brief, the nightly runner and the morning report

1. **`docs/playtest/agent-player.md`** — the brief the agent gets. It covers:
   - **The goal:** win the run while playing like a thoughtful new player. Read every card and option.
   - **How to call the tool,** and the rule that it may use nothing else (A4).
   - **What to write:**
     - one short sentence for every `--why`
     - an `--expect` on every card play in `card` mode
     - a `note` whenever something feels too strong, too weak, confusing, or unrewarding, and why
   - **Keeping its own context small:** don't re-print screens it doesn't need, and keep a running 3-line plan instead of re-reading history.
2. **`scripts/playtest-night.mjs`** (a Node script, like the others in `scripts/`, run with `npm run playtest:night` on Henry's Windows PC):
   - runs A5's N sessions one after another
   - seeds `pt<date>:<i>`, starters rotating through the 12 EA starters, gyms rotating
   - modes per A2
   - each session started per A1, with a wall-clock limit per session
   - it records each session's tokens and time when the driver reports them
3. **`npm run playtest:report -- <date>`** writes `docs/playtest/agent-runs/<date>.md` in plain English:
   - **Top of the page:**
     - invariant failures, grouped, each with its replay command
     - surprises grouped by card, sorted by how often they happened, each with the card text and a typical prediction and result
   - **Runs:** one line each (starter, gym, outcome, fights, biome reached, deck size at the end, scrap at the end, tokens, minutes).
   - **The agent's notes,** grouped by card, Mingming, screen or event, with counts.
   - **Decision patterns:**
     - cards most often picked and most often skipped, with the agent's most common reasons
     - shop items never bought
     - upgrades taken
   - **Kept short.** Every list is capped at its top 10, and the full logs stay in `results/`.
4. **Tests:** the report builds from a fixture night of two short sessions, and every section is present.

## 180g: The pilot

1. Play **one seed** (a starter of Henry's choosing, gym 0, tier 0) **four times:**
   - `run` mode with the small model and with the stronger model
   - `card` mode with the small model and with the stronger model
2. **Measure:** tokens, minutes, decisions, outcome, surprises and invariant failures per run. Write `docs/playtest/agent-pilot-180.md` (LF) with those numbers and:
   - **The decision sample:** 10 decisions from each run with the agent's reasons, picked at random by seed. Henry judges whether they read like a thoughtful player.
   - **Surprises:** every surprise, sorted into bug, misleading text, or agent error.
   - **Recommendation:** the A1, A2, A3 and A5 settings for the nightly runs, from the numbers.
3. **Do not schedule the nightly runs.** Henry rules on the pilot first.

---

## Done when

- A whole run can be played through `npm run playtest`, in all three modes, from any seed, and every session replays exactly.
- Card plays carry predictions, mismatches are logged as surprises, and invariants are checked after every move.
- The nightly runner and the morning report work on a fixture night.
- The pilot report gives real tokens and minutes per run and a recommendation, and Henry has ruled on it.
