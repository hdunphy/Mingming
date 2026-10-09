# Ticket 208: What the 2026-10-08 agent nights found: a summon bug, the primed brief as default, an isolated driver, the summon fee, and the screens that confused the agent

*Opened as 205; renumbered 208 on 2026-10-09 because the other branch's [205](205-emoji-to-tabler.md) was written in parallel. Commit messages before that date say 205.*

**Type:** one game bug, three night-script changes, screen text in the game and the tool, a list of reported problems to check, one measurement night. **Status:** **RULED 2026-10-08** (Henry, on the review page "Primed Brief Night 10-08"); not started.

**Where it comes from.** Two Haiku nights on 2026-10-08, 36 sessions each, on the 2026-10-04 seeds at `89e10fd`: the plain brief (`docs/playtest/agent-player.md`) and the primed brief (`docs/playtest/agent-player-primed.md`, 202f). Review: the project doc `claude/overnight-2026-10-08-review.md` and the page https://claude.ai/artifact/7wBjgWjnJDCf28r6r9cc4i. The headline: wins went 0 (10-07) → 6 (plain) → 12 (primed). Every win had a full team of three. The primed agent made 36 of its 54 summons in the first biome, against 2 of 32 on the plain night. The gym difficulty question that came out of the same review is its own design ticket, [209](209-gym-difficulty-and-biome-order.md).

**Henry's rulings (2026-10-08):**

> *1. Add a new ticket to address everything found today including the bug 2. Yes default to include but leave option to ignore to test new player comprehension 3. If it will improve it then sure 4. Sure … 6. That's an arbitrary target one that feels right when I play test. As long as the agent knows how to use the load out and drops cards it doesn't want then I'm fine.*

---

## How to work this ticket

1. **Read the whole row first.** Search for the quoted names, because line numbers drift.
2. **Test first.** Run the test on the parent, see it fail, and put "fails on parent: yes" in the commit message.
3. **One commit per row,** with the gate green first. Stage explicit paths only and don't push. Commits are authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com'`), with no Co-Authored-By trailer.
4. **Small single-purpose modules, composed** (Henry's standing preference).
5. **Order:** 208a first (it loses a player's Trace). Then 208b and 208c, which the next night needs. Then 208d and 208e. 208f is a checklist that can run beside them. 208g is the night that measures the rest.

| Row | What | Kind | State |
|---|---|---|---|
| 208a | **A second same-species summon in one Den visit does nothing** but spends the Trace | Game bug | Ruled |
| 208b | **The primed brief is the default;** `--naive` runs the plain one to test new-player comprehension; the primed brief also covers the loadout and the status words | Night script + brief | Ruled |
| 208c | **The driver runs without Henry's plugins and connectors** | Night script | Ruled ("if it will improve it then sure") |
| 208d | **The summon fee is shown where Traces are sold** | Screen text, game and tool | Ruled |
| 208e | **Five wording fixes** the agent tripped on | Screen text, game and tool | Ruled ("everything found today") |
| 208f | **Ten reported problems to check, then fix or close** | Checklist | Ruled ("everything found today") |
| 208g | **One primed night** on the isolated driver, after 208a–208e | Measurement night | Ruled |

---

## 208a: A second same-species summon in one Den visit does nothing

1. **What was seen.** In four runs (10-08 plain r12; primed r18, r27, r30), the agent summoned two Mingmings of the same species in one Den visit. The second time the screen said "Summoned Fenrir on Muspel Wall." and the Trace count dropped by one. But no Amber was charged, no cards were added and the Mingming never joined the party.
2. **Reproduced.** Replaying 10-08 primed r27 with `npm run playtest -- replay --results results/playtest/2026-10-08-primed-haiku --session r27 --to 11`, then `--to 12`:
   - After move 11 (the first Fenrir): party 2/3, deck 15, amber 40, traces 1.
   - After move 12 (the second Fenrir): party 2/3, deck 15, amber 40, traces 0.
3. **Cause (read, not yet proven by a test).** `planRecruit` (`src/engine/run/workshop.ts`) seeds the recruit's cards from `recruit-deck:${speciesId}` at the node, so a second recruit of the same species at the same town mints the same card instance ids. `recruitIntoParty` (`src/ui/store/runSlice.ts`) refuses cards whose instance ids the deck already holds, and returns the run unchanged. By then `assembleMingming` has already spent the Trace and put the member on the ranch roster. The tool's `assembly.ts` mirrors the game's `WorkshopNode`, so players hit this too. Duplicate species are legal (standing ruling).
4. **Fix.** Two parts, each a small change:
   - Make the recruit deck's seed unique per recruit, for example by including the new member's id, so two recruits never mint the same card ids.
   - Make the summon all-or-nothing: if the run refuses the recruit, the ranch half does not happen, so no Trace is lost silently. Either check first or roll back, whichever is the smaller change.
   - Recruits onto the bench (`recruitToBench`) get the same check.
5. **Tests.** Two Fenrirs summoned into the party in one Den visit: both join, 50 Amber is charged, 10 cards are added, and all card instance ids are unique. The same for the bench. If a recruit is refused for any reason, the Trace count is unchanged.
6. **Note.** Saved sessions that hit this will replay differently from that move on (the second summon now works). Say so in the commit.

## 208b: The primed brief is the default, and `--naive` runs the plain one

1. **Henry:** *"Yes default to include but leave option to ignore to test new player comprehension."*
2. **The change.**
   - `npm run overnight` and `npm run playtest:night` use `docs/playtest/agent-player-primed.md` by default.
   - A new flag, `--naive`, uses `docs/playtest/agent-player.md` instead. `--brief <path>` still overrides both.
   - The morning report's first line names the brief it ran with, so a night can't be misread.
   - `docs/playtest/run-tonight.md` and the scripts' usage headers say the same.
3. **Two additions to the primed brief's "What you already know".** Keep them as short as the existing lines. Both come from the Discord how-to-play post a tester reads.
   - **The loadout.** "Your deck is shared and grows with every pick and summon. In a town, Edit the loadout to send cards you don't want to the collection (down to the deck's floor) or bring them back." Henry, on decks reaching the gym at 25 to 29 cards: *"As long as the agent knows how to use the load out and drops cards it doesn't want then I'm fine."*
   - **The status words.** One line each for Burn, Poison, Regen, Strengthened / Weakened, Sharp / Dazed, Energized and Bark Shield, taken from the post's dictionary. Add that "power" is a card's base number, before element, STAB and stats. The 10-08 notes asked about Energized (6), Weakened and Dazed (3), and "power" against the damage dealt (6).
4. **Tests.**
   - `parseNightArgs([])` and `parseOvernightArgs([])` give the primed brief; with `--naive` they give the plain one.
   - The primed brief is still the naive one plus one section (the 202f test keeps passing).
   - The report names the brief.

## 208c: The driver runs without Henry's plugins and connectors

1. **What was seen.** Every driver session on 10-08 started with Henry's own Claude Code setup. Its `init` line in `driver.log` lists:
   - 10 plugins: mingming-scope (which reported "Mingming rules on"), repo-law, mingming-report-shaper, stats-bar, agent-orchestrator, mattpocock-skills, unity and three built-ins.
   - 6 MCP servers: unity-editor-mcp, Claude Docs, Gmail, Google Calendar, Google Drive and the agent orchestrator.
   - That makes 63 tools where the brief allows one (`Bash`). 10-08 primed r12 called `mcp__agent-orchestrator__board`.
   - Both nights had the same setup, so the plain-vs-primed comparison stands. But the agent should not be able to reach email or the orchestrator, the plugins' rules may leak repo knowledge into a "naive" agent, and every turn carries 62 tool descriptions it can't use.
2. **The change.** Start the driver with no MCP servers and no user plugins. Find the exact flags on the installed Claude Code (2.1.293), from `claude --help` and the headless docs: likely `--strict-mcp-config` with an empty `--mcp-config`, plus a setting source or config directory that loads no user plugins. Add them to `driverCommand` in `scripts/playtest-night.mjs`.
3. **Done when:**
   - A real one-session night (`npm run playtest:night -- --runs 1 --date <d>-iso`) leaves a `driver.log` whose `init` line lists `tools: ["Bash"]`, no `mcp_servers` and no user plugins.
   - The report states the tokens per session against 10-08's, so Henry sees what it saved.
4. **Tests.** `driverCommand` carries the isolation flags. The existing A4 assertions (Bash only, the allow list, `dontAsk`) stay.

## 208d: The summon fee is shown where Traces are sold

1. **What was seen.** 14 notes on the plain night came from agents that bought or held a Trace, spent their Amber in the shop, and found the 25-Amber summon fee only inside the Den (10-08 plain r05, r10, r14, r21, r22, r24, r30, r33, r35, r36). For example: *"it showed 'Fenrir [SOLD]' with no mention that summoning it costs another 25 amber"* (r10).
2. **The line.** Wherever a Trace is offered for Amber, its line adds the fee: "Huldra Trace [50 Amber] · summoning it costs 25 more at a Den".
   - In the game, that is the shop's Trace tile.
   - In the tool, that is the market screen's "TRACE (one body, spend it in a Den)" block.
   - Read the fee from `WORKSHOP_ASSEMBLY_SCRAP` through `shopPrice` (so Tight Budget raises it too), never typed in.
3. **Tests.** With a Trace on the shelf, the game's shop and the tool's market screen both show the fee at the value `shopPrice(run, WORKSHOP_ASSEMBLY_SCRAP)` returns, with and without Tight Budget.

## 208e: Five wording fixes

1. **A spent event says "The relay is dark. Nothing here now." for every event,** not only the Relay Tower. Seen after Toll, Overclock Rig and Trader (10-08 plain r11, r23; primed r23, r28). It is hard-coded in `src/ui/screens/EventNode.tsx` and `src/debug/playtest/screens/eventScreen.ts`, and "relay" is also left over from the old robot vocabulary. Replace it with **"Nothing more here."** (Henry, 2026-10-08: *"Sure"*).
2. **"HP full" in the header next to a fight result showing a member at 0** (22 notes, both nights). The header is right: HP is restored after every fight outside the gym. The fight result's "HP left: …" line should say so: "HP left at the end of the fight (restored before the next one): …". This applies in the tool, and on the game's result screen if it has the same line.
3. **Mirror fights: both sides share a name** (13 notes). For example: *"'Fenrir on Fenrir' in the biggest-hits list is hard to read when both sides share a name"* (10-08 plain r13). Every enemy name in the tool's fight report carries "(foe)" in every line, including the biggest-hits list. The game's combat log already colours sides; check that it marks the enemy in mirror fights the same way.
4. **Elite "stakes" are never explained** (15 notes). FIRST BLOOD, ANTIVENOM, TENTH STRIKE and the rest show as names on the map. The map line shows the Totem's one-line rule beside its name: the game's node hover and the tool's map screen, read from `describeDriver`.
5. **Internal words on the tool's screens.** "floor" (the deck minimum), "engine" (a body's five cards) and "[off-pool]" (a card outside the run's pool) appear with no explanation (10-08 plain r02, r08, r25; primed r33). Either say it plainly ("the deck can't go below 8 cards"; "its five cards") or drop the word.

Tests: one per item, on the text each screen prints.

## 208f: Ten reported problems to check, then fix or close

Each comes from the 10-08 notes and none has been reproduced yet. Reproduce from the replay named, then either fix it in its own commit or close the line here with what was found.

| # | Reported | Where to look first |
|---|---|---|
| 1 | The Relay Tower's Survey says "This biome is surveyed" and shows no list of enemies (13 notes) | plain r09, primed r18 |
| 2 | Revive, Mend and Salve are never offered between gym fights (12 notes) | plain r06, primed r17; may be the same as 202b, so check that first |
| 3 | The header's deck count lags after Corrupted Data is added or removed (7 notes) | plain r23, r35 |
| 4 | A Totem is awarded but appears on no screen | plain r02, r09; primed r21, r24 |
| 5 | Totem text ends in ".." | plain r08, r18; primed r04 |
| 6 | The Rune bench offers a Rune again after it is fitted, and lists one twice | plain r08, r32; primed r04, r25 |
| 7 | Tackle+ shows "15 power" without the "x3" the base line carries, and upgrading an "x3" line upgrades one copy without saying so | plain r06, r21; primed r17, r29, r30 |
| 8 | Max HP changes between fights with no visible cause | plain r15, primed r25. Probably the harness's per-fight stat jitter (195h); if so, print the plain max instead |
| 9 | The Trace count jumps (1 to 6 at the gym gate, 7 to 12 with nothing summoned) | plain r11, primed r26. Probably the gym's 5-Trace payout plus a gate reward; if so, the screen should say where they came from |
| 10 | Amber shown while choosing a paid event option (Data Broker) or an elite reward is the pre-payment value | plain r10, r31; primed r21 |

## 208g: One primed night on the isolated driver

After 208a–208e: `npm run overnight -- --models haiku --starter all --runs 36 --card-runs 1 --date <d>`. That is the primed brief by default, on the 10-04 seeds and the isolated driver. Compare it with 10-08 primed:

- wins and full teams;
- tokens per session (208c);
- Den use and summons in the first biome;
- deck size at the gym (208b's loadout line);
- the same-species summon now working (208a).

---

## Rulings (2026-10-08, Henry, on the review page)

- Fix the summon bug, with everything else found today, in one ticket (this one).
- The primed brief is the default; the plain one stays behind a flag for comprehension tests (208b).
- Isolate the driver "if it will improve it" (208c).
- Show the summon fee where Traces are sold (208d).
- The 20–25 deck target is "arbitrary … as long as the agent knows how to use the load out and drops cards it doesn't want" (208b §3).
- The gym's difficulty and the biome order are a separate design ticket (209).

## Decisions for Henry

1. ~~**D1, the spent-event line (208e §1).**~~ Answered 2026-10-08: "Nothing more here."

None open.

## Resolution

Not started.
