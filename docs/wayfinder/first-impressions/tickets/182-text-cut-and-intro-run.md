# Ticket 182: The text cut, hide-when-empty, and the intro run

**Type:** UI copy, a little UI logic, and one new run mode. **Status:** BUILT 2026-10-02 (182a–d), on branch `first-impressions`, not pushed; see the Resolution at the bottom. Henry ruled every decision below on 2026-10-02. **Ticket 181 (playtest round 2) waits on this ticket and on ticket 183 (the UI rework).** Not blocked by 176 or 183: this ticket changes words, visibility and one run mode, not the look.

**Henry (2026-10-02), in his words:**

> *"For the tutorial I'm good with your conditions. Make the unlock everything a separate switch. The tutorial will mostly be for this round of playtesting, probably scrap it in the future or make it the 'demo' for early playtesters."*
>
> *"Decisions Yes to everything, except 182d needs the two buttons, skip intro and show advanced content. The playtest can wait on 182."*

**Where this comes from.** The Claude Doc "Mingming Tier 0 Cut List" (2026-10-01), and the Claude project doc "Tier 0 cut list + UI direction". The cut list walked the v0.3.5 build and found paragraphs of copy on every screen, tip panels with "Got it / Skip tips", and every system shown on the first run. Its rule:

> A first run meets four ideas: **monsters, cards, energy, and elements beating elements.** No screen opens with more than one sentence of copy.

**What changed from the cut list.** The cut list's 8-step unlock ladder (a `ranch.unlocks` set) is **replaced** by two simpler things that Henry ruled:

1. **The intro run is the gate.** A short, hand-built first run that only has the four ideas (182c).
2. **Hide when empty.** After the intro, a panel that has nothing in it is hidden, and it appears when it has something (182b). No "have you ever held one" flags.

Plus **two switches** (182d): **Skip intro** and **Show advanced content**.

---

## Decisions (all ruled yes, 2026-10-02)

| # | Decision | Ruling |
|---|---|---|
| R1 | First-run gate | The intro run (182c), plus hide-when-empty (182b). No unlock ladder, no `ranch.unlocks`. |
| R2 | Macros on the first run | None. The intro never drops or shows a macro. |
| R3 | Default firmware | **v1 for everyone.** The starter is built on its v1 firmware with no firmware modal. Later builds keep the choice, with v1 picked by default. |
| R4 | Element word on cards | Replaced by an **element icon**. |
| R5 | Pause menu | None. Volume, theme and Abandon run move to **Settings**. |
| R6 | Build label | Stays, **small, in a corner** (181a built it). |
| R7 | Stale rows in the cut list | The cut list predates 172. **The agent checks each row while building it** and skips any that are already done. No separate audit. |
| R8 | The intro's conditions | A separate mode **outside the tier ladder**; a **hand-built map of 6 nodes with one fork**; a **guaranteed recruit**; a **one-fight leader**; **no macros, patches or firmware choice**; default v1; tuned so new players **usually win**; **15–20 minutes**, measured. Offered on new saves; skippable. |
| R9 | The switches | **Two separate switches**: "Skip intro" and "Show advanced content". Both on the starter screen of a new save, and both in Settings. |
| R10 | The intro's future | Mainly for this playtest round. It may be **scrapped** later, or become the **demo** for early playtesters. So it is built to be removed cleanly (182c, "Keep it removable"). |

---

## How to work this ticket

1. **Read the whole row first.** Search for the quoted names; line numbers drift.
2. **Test first, run it on the parent, see it fail.** Put "fails on parent: yes" in the commit message. A row that only deletes copy can use a render test that asserts the copy is gone.
3. **Do not change anything a row does not list.** If a row seems to need something it does not name, stop and ask Henry. **No balance numbers change in this ticket**, except the intro's own leader team (182c).
4. **No new look.** Colours, fonts, the card frame and backgrounds belong to ticket 183. Where a row says "icon", use an existing glyph or emoji in the current style; 183 will redraw it.
5. **Small pieces.** One small module or component per idea, composed. No new god-component, and no `if (intro)` scattered across screens: see 182c.
6. **Gate:** `npm run gate` green before each commit. **Commits** authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`), no `Co-Authored-By`, last line `HANDOFF: <one sentence>`. **Do not push.** One commit per row (182a may be split per screen).
7. **Line endings:** CRLF in `docs/wayfinder`, LF in new `src` files.
8. **Report** in plain English at the end: what was cut per screen, which cut-list rows were stale and skipped, the intro's measurements (182c), and screenshots of the starter screen, the intro map and the first battle.

| Row | What | Depends on |
|---|---|---|
| 182a | The text cut, screen by screen, plus the copy-budget test | — |
| 182b | Hide when empty | — |
| 182c | The intro run | 182a (its screens use the cut copy) |
| 182d | The two switches: Skip intro, Show advanced content | 182b, 182c |

---

## 182a: The text cut

**Goal:** every screen opens with at most one sentence, and nothing on screen is a debug readout. Nothing here removes a system; it removes words.

For each row: **check it is still true in the current build** (R7). If it is already done, skip it and list it as stale in the report.

### Starter screen (`MainMenuView.tsx`)

| Today | Change |
|---|---|
| The title (the cut list saw "TERMINAL GAUNTLET") | The game's name, "Mingming". The drawn logo comes with 183. |
| The heading (now "CHOOSE YOUR FIRST MINGMING", per 172e) | "Choose your starter". |
| The blueprint paragraph ("You are granted its blueprint…") | Cut. The run summary teaches blueprints. |
| Per-monster description | One line of flavour, **8 words at most**. Draft the three lines and list them in the report for Henry. |
| The starter card / stats row | Leave as 172 built it (Henry ruled it on 2026-09-30). Stale row. |
| The `ALPHA v0.3.5 …` footer | Gone (181a replaced it with the build label). Make sure the build label is **small, in a corner** (R6). |
| Element border glow | **Not this ticket** (183 owns the look). |

### Ranch (`RanchScreen.tsx`, `RunStart.tsx`)

| Today | Change |
|---|---|
| Tip callouts ("BLUEPRINTS ARE WHAT YOU KEEP" + Got it / Skip tips) | Cut. See "Tips" below. |
| The Assembly paragraph ("Assembly costs one blueprint…") | Cut. |
| The starter's firmware modal ("Choose firmware for …") | Cut for the **starter**: it is built on its **v1** firmware silently (R3). Later builds keep the modal, with v1 selected by default. |
| The Roster paragraph ("Everything you have ever assembled lives here…") | Cut. |
| The Expedition's two paragraphs on gyms and rivals | One line: "Beat the gym leader at the end of the road." |
| "Standard — The game as it is." label | Cut. |
| Gym cards (route lists, RIVALS FIELD, field-effect text) | Keep the three cards. Show the gym's name, element and its three biome names. The field-effect text moves to a hover (title or tooltip) on the gym. |
| "Begin run — 1 member, 8 cards" | "Start run". |
| TYPE CHART dropdown | Keep, as a small icon button. |

### Map (`RunScreen.tsx`, `RegionMap.tsx`)

| Today | Change |
|---|---|
| Header line ("Biome 1/3 · The Drowned Shelf (Water) · layer 0 · Tier 0 · 0 fights · 20 scrap") | Biome name, and scrap with an icon. Nothing else. |
| Biome tab strip | Cut; the map panels already name the biomes. |
| "WATER · CURRENT" / "FIRE · AHEAD" panel labels | The biome name only. |
| Legend line ("Start, Wild") | Cut. Node icons keep their hover label. |
| "You are here: …" sentence | Cut. |
| Two bullet lines on rivals and fogged nodes | Cut. The rival node keeps its one-line hover (142c). |
| The "Travel" list of node buttons | **Screen-reader only** (visually hidden, still in the DOM and keyboard-reachable). Clicking the node is the visible way to travel. |
| The "Party" section below the fold | A row of party faces in a corner of the map, always visible, **no HP** (HP is restored every fight). Nothing on the map screen should need scrolling at 1280×800. |
| "Abandon run" at the top right | Moves to **Settings** (R5), shown only while a run is in progress, with the existing confirm step. |

### Battle (`BattleArena.tsx`, `BattleStage.tsx`, `CardHand.tsx`, `CardChassis.tsx`)

| Today | Change |
|---|---|
| Top-bar pills ("TURN 1 · YOUR MOVE · PLAYED 0") | A small turn badge in a corner. "Your move" is shown by the hand being playable, so its pill goes. The played count is covered in 182b. |
| "EMBERFALL · WILD" pill | Cut. |
| Volume slider and theme toggle in the battle header | Cut from the battle screen. Volume already lives in Settings (`AudioControls`); if the theme toggle still exists, move it to Settings too. |
| Monster plate: the "V1" chip | Cut (it is a balance label). |
| Monster plate: "2/2 EP" (`BattleStage.tsx`, `stage-plaque-value`) | Energy pips, no letters. If pips already exist next to it, just drop the text. |
| Draw pile "+N/turn" (`pile-formula` in `CardHand.tsx`) | Cut. The count stays, and the tooltip with the draw formula stays. |
| "NO CASTER — PRESS W / E / R" + ? button (`CardHand.tsx`) | Cut the text. Clicking a monster plate picks the caster (as today). **With one monster, it is picked automatically.** The W / E / R keys still work. |
| Card face: the element word in the footer | An **element icon** (R4), same colour as today. Water, Fire, Nature and None each get one. |
| Card face: the "ENEMY / SELF" target tag | An icon (one for an enemy target, one for self or ally). |
| Empty gradient arena | **Not this ticket** (183). |

### Shops, workshop, events, gym, run summary

| Today | Change |
|---|---|
| Any opening paragraph on `MarketplaceNode`, `WorkshopNode`, `EventNode`, `GauntletNode` | One sentence, then the controls. |
| The workshop's recruit wording | "Add a Mingming to your team." |
| The gym gate's free patch offer (`GauntletNode`) | "Pick a bonus", with no system name in the heading. The rewards stay as 166 ruled them. |
| Run summary (`RunSummary.tsx`) | Up to three large lines, led by what you kept (for example "You kept: Fenrir blueprint ×1"), and one "Back to ranch" button. Keep the existing run-log export and the 181c feedback button if they are there. |

### Tips (`engine/tips.ts`, `ui/components/Callout.tsx`)

- **The callout panel becomes a toast**: one line, no buttons, gone after a few seconds or on the next click. It still marks the tip seen (`seenTips`, once ever, on the ranch).
- **Battle tips: only two remain**, "Elements beat elements" (`battle:matchup`) and "End turn refills everyone" (`battle:endturn`). Keep their predicates. Retire `battle:energy`, `battle:play` and `battle:stab` from the order (leave the ids in `TipId` so old saves still parse; just stop showing them). Rewrite each body to one line.
- **Map and ranch tips** stay, as one-line toasts.
- "Skip tips" goes away with the buttons. Nothing replaces it: a toast does not need skipping.
- Update the header comment in `tips.ts` (rule 3 talks about the two buttons).

### The copy budget test

A new test, `copyBudget.test.tsx` (LF), that renders each main screen in a **new-player state** (one starter, nothing else held) and fails if:

- any `<p>` has more than **140 characters**, or
- a screen has more than **one** `<p>`.

Screens: the starter screen, the ranch (Expedition), the map, a first battle, the market, the workshop, an event, and the run summary. Use the existing render helpers (`renderToStaticMarkup`, as the other screen tests do). Hover text and screen-reader-only text do not count.

This test is what stops the paragraphs coming back.

---

## 182b: Hide when empty

**Rule:** a panel, slot or label that has nothing in it is **not drawn**. It appears the moment it has something. This replaces the cut list's unlock ladder. There are **no new save fields** in this row.

| Element | Hidden while |
|---|---|
| Macro rack on the battle screen | all three macro slots are empty |
| Macro slots on the map | all three macro slots are empty |
| Patch holders on a unit plate | that unit has no patch |
| Drivers strip (map and battle) | the run has no drivers |
| The played-count pill ("PLAYED 0") | no card in the deck scales with cards played (find how the card says so, e.g. `cardsPlayedScaling`) |
| Tier row, modifier chips and the "Standard" label (`RunStart.tsx`) | no tier above 0 is unlocked (`tierClears` is empty) |
| Party picker at run start | the roster has one Mingming |
| A ranch tab whose screen would be empty (e.g. Vault with no blueprints, Assembly with nothing to build) | that screen would be empty |

**Closed by default (not hidden):** the combat log drawer and the enemy-hand tab ("ENEMY DRAWS N"). Both still open with one click.

**Not hidden:** the macro shelf in the market and the patch bench. They have stock to sell, so they are not empty. (The intro hides them for its own reasons, 182c.)

**Show advanced content (182d)** turns every rule in this table off, so the screen looks as it does today (empty slots drawn, log and enemy hand still closed by default). Read it through one small hook, e.g. `useShowWhenEmpty()` or `useAdvancedContent()`, used by each element above. Do not read settings directly in each component.

**Tests:** for each row, one render with the thing empty (hidden) and one with it present (shown), and one with Show advanced content on (shown even when empty).

---

## 182c: The intro run

**What it is:** a short, real run that a new player plays first. It teaches the four ideas (monsters, cards, energy, elements) plus scrap, the card pick, the shop, and a recruit. It ends with a single leader fight. **Win or lose, it ends**, and the player lands at the ranch with the normal game open.

### The map (hand-built, one biome, 6 nodes)

It fits the current graph shape (5 layers, `RegionNodeSchema` layer 0–4) and today's map screen, so no schema or layout change is needed.

| Layer | Node(s) | What it teaches |
|---|---|---|
| 0 | Start | — |
| 1 | Wild fight, **1 enemy** | cards, energy, elements, the card pick |
| 2 | **"A stray Mingming"**: a guaranteed recruit, free | a second monster; picking the caster |
| 3 | **The fork:** a Market (card stall + upgrade bench) **and** a Wild fight (**2 enemies**), joined by an edge so the player can take one or both | spending scrap; a 2v2 |
| 4 | **The leader**: one 2v2 fight | the ending |

- **The biome** is the one whose element the starter's element **beats**: the biome element `B` where `COUNTERED_BY[B]` is the starter's element (`gyms.ts`; Fire > Nature > Water > Fire). Kraken (Water) plays in the Fire biome, Fenrir (Fire) in Nature, Ratatoskr (Nature) in Water. This is the "usually win" lever that changes no number.
- **The recruit** offers **the two starters the player did not pick** (Kraken, Fenrir, Ratatoskr), and the player picks one. It joins free: no scrap, and no blueprint is left over afterwards. Reuse `EventRecruitPick` and the 168d recruit flow; grant only the chosen species' blueprint at the moment it is built, so the vault ends where it started. The joined member is run-scoped like any recruit.
- **Fights** are rolled as today (`rollEncounter`) from the intro biome, at the shallowest depth. One card pick per fight (179). Scrap as today. Blueprint drops as today, so the run summary has something to show.
- **The market** shows only the card stall and the upgrade bench (no macro shelf, no patch bench, no junk removal).
- **The leader** is one fight, not the three-fight gauntlet. Two enemies, from the intro biome's species pool, at the shallowest kit depth, on v1 firmware, no driver. Pick the pair by hand from existing data and **do not add or change cards**. Tune only by choosing species and IVs, measured with the walker (below).
- **Not in the intro:** macros (no drops, no rack, no shelf, `fightBonusFor` pays nothing), patches, drivers, elites, ambushes, rivals, the scout, events other than the recruit, the firmware modal, tiers and modifiers, the combat log and the enemy-hand tab (hidden, not just closed).

### What the intro does not count as

The intro is outside the tier ladder. It does **not**:

- add to `runsCompleted` (so the first real run still gets the first-run blueprint bonus, ticket 59)
- record `gymsCleared`, `tierClears`, or any achievement
- unlock a tier

It **does** keep blueprints it dropped, update the Codex, and write a run log (with `mode: "intro"`) that Settings → Export run log includes.

### Keep it removable (R10)

Henry may scrap the intro later or turn it into the demo. So:

- All intro code lives in **one folder**, `src/engine/run/intro/` (map builder, leader team, rules), plus at most **one** UI entry point. Small modules: e.g. `introMap.ts`, `introLeader.ts`, `introRules.ts`.
- The rest of the game asks **one question**, through one function (e.g. `introRules(run)` returning what is allowed), never `if (run.mode === 'intro')` in each screen.
- The run carries `mode: 'normal' | 'intro'` (`RunStateSchema`, `.default('normal')`, add-only, the `seenTips` argument, no version bump).
- The report ends with "**How to remove the intro**": the folder, the entry point, the `mode` field and the switch, in a short list.

### When the intro is offered

- On a **new save**, after the player picks a starter, **if Skip intro is off** (182d), the intro starts straight away. There is no ranch visit first.
- The ranch saves `introDone: boolean` (`RanchStateSchema`, **`.default(true)`**: a save written before this field is a player who already plays the normal game). A new save is created with `false`. Ending the intro (win, lose or abandon) or skipping it sets it to `true`.
- A save with `introDone: true` never sees the intro again.

### Measure it

With the walker (`runWalker.ts`), the intro on **all three starters × 30 seeds**. Write `docs/balance/intro-run-182.md` (LF):

- **Leader win rate** per starter, and overall. **Target: the walker wins at least 75%** (a new player should usually win; the walker plays below a careful human). If it misses, change the leader pair or its IVs and measure again; report every pair you tried.
- **Fights per intro**, and **turns per fight** (mean and max).
- **Estimated minutes**: turns × a seconds-per-turn figure. Use 20 seconds per turn and say so; Henry times his own run in 181's Phase 1 for the real number.
- **Target length: 15–20 minutes.** If the estimate is far outside it, report it and suggest a change (add or remove the 2v2 fight); do not change the map yourself.

---

## 182d: The two switches

Two **separate** switches (R9). Both appear on the **starter screen of a new save**, and both in **Settings**.

| Switch | What it does | Stored where | Default |
|---|---|---|---|
| **Skip intro** | Picking a starter goes to the ranch instead of the intro. In Settings: shown only while `introDone` is false; turning it on sets `introDone` to true. | The ranch save (`introDone`), because it is about this save | Off on a new save |
| **Show advanced content** | Turns off every hide-when-empty rule in 182b, so everything is drawn as today. It does **not** skip the intro, and it does **not** add macros or patches to the intro. | `mingming_settings` (`ui/settings/settings.ts`), because it is about the person, like text size | Off |

- On the starter screen, the two switches sit **under** the three starters, small, one line each. They are not the first thing the player sees.
- Labels exactly: **"Skip intro"** and **"Show advanced content"**. One short hover line each: "Go straight to the full game." and "Show every panel, even when it is empty."
- **Tests:** each switch on its own, both together, and neither. Skip intro on → the starter leads to the ranch and `introDone` is true. Show advanced content on → the 182b elements render empty. Settings shows Skip intro only while the intro has not been done.

---

## Done when

- Every screen passes the copy budget test, and the stale cut-list rows are listed in the report.
- Empty panels are hidden, and appear when they have something; Show advanced content shows them all.
- A new save plays the intro (6 nodes, one recruit, one leader fight), and it does not count toward runs, gyms or tiers.
- The walker wins the intro at least 75% of the time, or the report says why not and what was tried.
- Skip intro and Show advanced content work separately, on the starter screen and in Settings.
- The report says how to remove the intro.

## Small calls made while writing this (confirmed by Henry, 2026-10-02)

1. **The intro biome** is the one the starter beats, and the recruit is one of the two starters you did not pick.
2. **Skip intro is saved per save; Show advanced content is saved per person** (it carries over to a new save slot).
3. **The walker's bar for the leader is 75%.**
4. **Existing saves count as intro done**, so Henry's own save never sees it (he can start a new slot to play it).

---

## Resolution

**Built 2026-10-02, one commit per row on `first-impressions` (not pushed).** 182a is the text cut (starter, ranch and run start, map, battle, market/workshop/event/gate/summary, tips, Abandon run moved to Settings, and the copy-budget test). 182b is hide-when-empty (`6c8d3dd` is the last of it). 182c is the intro run: engine `026904d`, ending and run log `0d62533`, screens `6f06fb9`, and the leader tuning and measurement. 182d is the two switches and the intro start, `52e9a76`.

**What the intro is.** `mode: 'intro'` on the run and `introDone` on the ranch (both add-only with defaults, so an old save is an ordinary one that has done the intro). A new save, with Skip intro off, goes from the starter pick straight into a hand-built seven-node map (the six first built, plus one more wild fight before the leader that cannot be skipped, added at Henry's request on 2026-10-02; the stray Mingming shares the first wild fight's layer so the map stays within the schema's five) in the biome the starter beats, with a stray Mingming (the two starters you did not pick, on v1, free) and a one-fight leader (two enemies). No macros, patches, firmware choice, sell panel, combat log or enemy-hand tab. It ends the same way won, lost or abandoned: `introDone` becomes true, and `runsCompleted`, `gymsCleared` and `tierClears` do not move. Its run log carries `mode: "intro"`. The summary says "Intro complete" and claims no gym or tier.

**Measured** (`docs/balance/intro-run-182.md`): with the extra wild fight the walker wins the leader **75 of the 81 times it reaches it (93%)**: Kraken 24/28, Fenrir 30/30, Ratatoskr 21/23. It clears 75 of 90 runs (Ratatoskr only 21 of 30, 70%, because its walks die to wild fights). Before the extra fight it was 87 of 90 (97%). The first pairs (Skoll + Fenrir, Huldra + Ratatoskr at IV 10, Jormungandr + Kraken) gave 40%, 100% and 0%; every pair tried is in that file. Tuning was species and IVs only; no card was touched.

**Starter flavour lines** (8 words at most, `starterFlavour.ts`): Kraken "Patient depths, sudden storms." Fenrir "Chained fury that bites back." Ratatoskr "Quick little squirrel, quicker gossip."

**Stale cut-list rows** (already true in the build, skipped): the starter card and stats row (172 built it, Henry ruled it on 2026-09-30) and the `ALPHA v0.3.5` footer (181a replaced it with the build label).

**How to remove the intro** (R10): delete `src/engine/run/intro/` and `src/ui/intro/`; make `introRules(run)` return `NORMAL_RULES` (or inline it at its callers, which only ask it questions); in `MainMenuView.tsx` make `choose` always `addBlueprint` and drop the "Skip intro" switch (`switches.ts`, `GameSwitches.tsx` and its Settings line); delete the intro tests and `introWalk*`/`runIntroWalk.ts`, and the `intro` option in `runWalker.ts`. The `mode` and `introDone` fields can stay: they default to an ordinary run and a finished intro, so they change nothing.

**Not done, and why.** Screenshots of the starter screen, the intro map and the first battle were not taken: the rendering tool was never working in this environment. The checks were run in parts here (eslint, `tsc -b`, the unit tests in shards, the balance tests one by one, and `vite build`, all green) rather than as one `npm run gate`, and the three intermediate 182c commits were not gate-run on their own; the combined tree was green before each.

**Decisions Henry owes.** (1) The intro is still shorter than the 15 to 20 minute target: four fights of roughly 3 turns each, about 4 to 5 minutes at 20 s a turn before reading time (it was 3 to 4 before the extra wild fight). Add more, or wait for his own timing in 181 Phase 1? (2) The Fire and Water leaders are two of the same species (Skoll twice, Jormungandr twice), because the stronger partner (Fenrir, Kraken) made the weakest starters lose; fine, or add a card or species later? (3) Screenshots: take them by hand when he next runs the game, or skip.
