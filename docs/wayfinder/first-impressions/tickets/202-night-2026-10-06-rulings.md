# Ticket 202: What the 2026-10-06 overnight night found: the Den tag line, a revive between gym fights, two runs an agent, the v1 starters, and the night's defaults

**Type:** new on-screen text, one gauntlet rule change, two night-script changes, one investigation, one measurement night. **Status:** **RULED 2026-10-07** (Henry, on the review doc "Overnight Playtest Review 2026-10-06"); not started. Written 2026-10-07 from the night of 2026-10-06 (24 haiku sessions, every starter twice, the first night after [195](195-overnight-night-fixes.md)). Sibling of 195, which it follows the same way 195 followed [193](193-playtest-nights-findings.md).

**Where it comes from.** The review's headline: **the night is working (24 of 24 finished, every 195 row that can be checked from the results checks out), and the wall is the same one.** Every solo run that reached the gym died in fight 1 within two turns (r08, r17, r18, r23); all six party runs cleared fight 1, three won and three lost the boss by attrition. Across the four reported nights, 98 solo runs have won 0 and 16 party runs have won 7. The brief says nothing about the party, the Den or the gauntlet; the screens alone got 8 of 24 runs to summon (10-05 haiku: 0 of 36), and the four solo gym runs died holding 18 Traces and 185 amber between them. Henry's rulings, numbered as the review's decisions:

> *1. Does --brief already exist? If not can we add it. Is the human player going to need more instruction or is Haiku not smart enough to figure it out. Maybe we try sonnet? 2. Regardless of 1 we add a small tag line to the den like you said: N traces held — summon here. 3. Add a revive between fights. Should we change up the gauntlet? … I think it's good for the first run to be hard. Maybe we make each agent perform 2 runs? The second time they can try to use what they learned. 4. Add a ticket to investigate. 5. Sure. 6. Leave it for now but make a note. 7. What command should I be using? Can we just make that the default?*

**Not part of this ticket:** the per-stack scaling cards (decision 6). 15 of the night's 21 killing blows, and every hit over 1,000 on either side, came from a card that multiplies a stack: Sap Strength per Weakened (6,581 over a 29-turn wild fight, r09), Ragnarok Edge per 1% missing HP (1,061, r14), Crushing Depths per Dazed (938 against a full party at the first elite, r06), and the player's Cinder Lance+ per Sharp (4,118 in one hit, r02), Crushing Depths+ (2,395, r10), Ink Stream+ (1,188, r05). Henry: *"Leave it for now but make a note."* The note is this paragraph; when it becomes a ticket, r09 is the case to start from (Ratatoskr v1 healing against a Huldra stacking Weakened for 29 turns, a stall the tool should also cap or flag). Bark Smash, nerfed in 195a, killed once this night (387) against 5 of 45 defeats on 10-05.

---

## How to work this ticket

1. **Read the whole row first.** Search for the quoted names; line numbers drift.
2. **Test first, run it on the parent, see it fail.** Put "fails on parent: yes" in the commit message.
3. **One commit per row,** gate green first. Stage explicit paths only and don't push (`HANDOFF.md`, "Two agents in parallel"). Commits are authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com'`), with no Co-Authored-By trailer.
4. **Small single-purpose modules, composed** (Henry's standing preference). Each fix is one new small module or one changed function, not an addition to a large file.
5. **202b changes a rule.** Report the walker's gauntlet numbers before and after, the way 195a reported Huldra's opening-fight read.
6. **Order:** 202e and 202g first (they are small and the next night needs them), then 202a, 202b, 202c; 202d is an investigation that can run beside them; 202f is the night that measures 202a–c and needs them built.

| Row | What | Kind | State |
|---|---|---|---|
| 202a | The town's Den line says **"N Traces held · summon here"** while Traces are unspent | New text, game and tool | Ruled |
| 202b | **A revive between gym fights:** a downed member comes back for the next fight | Gauntlet rule change | Ruled; the floor is D1 |
| 202c | **Two runs a session:** the agent plays a second run on the same save after the first ends | Night script + tool | Ruled; carry-over is D2 |
| 202d | **The v1 starters:** skoll_v1 and jormungandr_v1 lose their first or second fight on every seed and model so far | Investigation | Ruled ("add a ticket to investigate") |
| 202e | **Resume guard** in `runNight`; the morning report says "amber" and carries the 195k note | Night script + report | Ruled |
| 202f | **The brief:** one night, same seeds, naive brief vs primed brief, haiku and sonnet | Measurement night, then Henry rules | Open question answered below; the night is the row |
| 202g | **`npm run overnight` defaults:** every starter twice, one card session, both models | Night script | Ruled ("make that the default") |

---

## 202a: The Den line says "N Traces held · summon here"

1. **What was seen.** Of the four solo runs that reached the gym, r08 and r18 never opened the Den in three towns each, holding 4 and 5 Traces; every visit went shop, upgrade, upgrade, leave. The "Summon it in the Den." line (195b) shows once, on the first Trace, and nothing on the town screen repeats it. r17 opened the Den once and declined (*"not summoning to keep deck lean and efficient"*, died holding 110 amber and 4 Traces); r23 opened it after two upgrades (*"Not enough resources to summon yet"*) and never again.
2. **The line (Henry's words):** **"N Traces held · summon here"** on the Den tile of the town screen, **whenever N > 0**, in the game (`TownSquare.tsx`, which already prints "N traces held · party X") and in the tool's town screen (`src/debug/playtest/screens/townScreen.ts`). Read N from the same place `TownSquare.tsx` reads it (`workshopSpecies(ranch, run)`), as 195c does for the status line. When N is 0 the tile reads as it does today.
3. **Order on the screen (ruled in the review, not by Henry; build it unless he objects):** the Den line comes **before** the shop line in the tool's town screen, so an agent reads it first. In the game the tiles stay where they are.
4. **Tests.** With 2 Traces held, the town screen's Den tile (game) and the tool's town screen both carry "2 Traces held · summon here"; with 0, neither does. The tool's screen lists the Den before the shop.

## 202b: A revive between gym fights

1. **What was seen.** All three party runs that lost did so in fight 3, the boss, after clearing fights 1 and 2: r22 arrived with two of three members down and 536 HP on the third and lost in one turn; r10 arrived with one down and lost in five; r02 (party of 2) lost in two turns. Under the current rule (173a: standing members repair 30% between fights, a downed one stays down) the boss fight is lost before it starts.
2. **Henry's ruling:** *"Add a revive between fights."* On whether to change the gauntlet's shape (three fights after a run of single battles): *"I think it's good for the first run to be hard."* So the gauntlet stays three fights; a downed member **comes back for the next fight**.
3. **The rule (D1 for the floor):** between gauntlet fights, every member standing repairs 30% as today, and every downed member is revived at **D1%** of max HP (proposed **30%**, the same as the repair, so a revived member is exactly as healthy as one who ended the fight at 0 and repaired; the forecast sentence then reads "Every member repairs 30% between fights; a downed one comes back at 30%"). One small module (`gauntletRevive.ts` or similar) that `fightSettle`/the gym gate asks, in the engine; the tool's gauntlet header (195h) and the forecast (193d) read the same rule.
4. **Check.** The walker's gauntlet cells (the Rootfall and Emberfall boss cells ticket 77 uses, the day's bare) before and after, n=60 paired. Report both numbers; Henry rules whether 30% holds.
5. **Tests.** A member who ends fight 1 at 0 is at D1% of max HP on the fight-2 screen, in the engine and in the tool's header; the forecast sentence matches the rule.

## 202c: Two runs a session

1. **Henry:** *"Maybe we make each agent perform 2 runs? The second time they can try to use what they learned."*
2. **What it means.** A session is one driver conversation. Today it is one run (`new` starts it, the run ends, the agent writes its last note and stops). With this row the brief tells the agent that when the run ends it starts a second run **on the same save** (`npm run playtest -- again --session <name>`, or whatever the tool names it) and plays that to its end too. The agent keeps its own memory of run 1 (same conversation), which is the point.
3. **What carries over (D2).** The game's save already carries the roster, the banked Traces, the codex and `traceHintShown` across runs. The tool starts each session as a fresh save and should carry **exactly what the game carries**, nothing more, so the second run is the second run a player would have. D2 asks Henry to confirm that rule (and whether a won run's party stays in the roster for run 2, as it does in the game).
4. **The report.** Each session's line splits into run 1 and run 2 (outcome, fights, party, Traces); the party table counts runs, not sessions; a new column, "run 2 of a session", so the morning report can say whether second runs summon more and get further. The decision patterns stay pooled.
5. **Budget.** A session doubles in minutes and tokens: the 35-minute limit becomes 60, `--max-usd` 3 becomes 5, and the night's worst case doubles. The night's `--runs` still counts sessions.
6. **Tests.** `again` on an ended session starts run 2 with the save's roster and Traces and a fresh map on the same seed family (`pt<date>:<i>:2`); `state` says "run 2 of 2"; the report shows both runs.

## 202d: The v1 starters that lose their opening fights

1. **What was seen.** In run mode the game AI plays every fight, so these are starter-deck results, not play errors:
   - **jormungandr_v1 (seed 7):** lost its **first** fight to a Kraken's Tackle (708 over 19 hits, 6 turns) after one decision, on 2026-10-05 haiku, 2026-10-05 sonnet and 2026-10-06 haiku; seed 19 lost its second fight (Venom Fang).
   - **skoll_v1 (seeds 3 and 15):** lost its **second** fight on both seeds and both nights (10-05 sonnet, 10-06 haiku), to Fenrir's Ragnarok Edge (675) and Skoll's Flashover (666), after three decisions.
   - **ratatoskr_v1 (seeds 9 and 21):** 1 and 2 fights; r09 was the 29-turn stall.
   - By contrast kraken_v1 won two gyms, and every v2 reached biome 3 at least once.
2. **Henry's ruling (2026-09-25):** wild fights in biome 0 at least 85% for every starter. **Henry's 2026-10-02 ruling:** *"We don't care about 1v1 numbers except at the start."* These are the start.
3. **Investigate.** Run the opening-fight read (the walker's biome-0 wild cells) for the six v1 starters on the 2026-10-04 seeds 1–24, and the specific fights above by replay (`npm run playtest -- replay --results results/playtest/2026-10-06-haiku --session r07 --to 1`, and r03/r15 `--to 3`). Say which it is: the read is not being run on these seeds; the read passes but these enemies (Kraken in biome 0 water, Fenrir in biome 0 fire) are outside what it samples; or the decks are under the rule. Then propose, no change without Henry.
4. **Report.** A table: starter, seed, fight, enemy, turns, the killing card and total, the walker's read for that cell.

## 202e: Resume guard, and the report's words

1. **What was seen.** The 2026-10-06 log shows a 10:59 launch with the old defaults (haiku then sonnet, 9 runs, `--starter kraken_v1`) that Henry stopped, then the 11:05 launch of the 24-run night. The first launch had already written `r01/session.json` (kraken_v1, gym 0, 11:06 by the file's mtime). `runNight` (`scripts/playtest-night.mjs`) treats a folder with a `session.json` and no `driver.json` as an interrupted session and resumes it, with no check against the plan entry, so the night played kraken_v1 at Emberfall in the slot planned for fenrir_v1 at Rootfall. Fenrir v1 appears once in the night (r13), Kraken v1 three times.
2. **Fix (ruled: "Sure").** On resume, read the existing `session.json`'s `seed`, `starter` and `gymIndex`; if any differs from the plan entry, **stop the night** with: *"r01 was started with kraken_v1 / gym 0 but tonight's plan says fenrir_v1 / gym 1. Delete results/playtest/<date>/r01 to replay it, or run with the same flags to resume it."* One small function (`resumeMatchesPlan(session, entry)`), used by `runNight`.
3. **Also in this row:** the morning report (`src/debug/playtest/report/render.ts`) still prints "scrap left" on every run line; it says **amber** (195e-1 missed the report). And the first report after 195k was to carry the note that win rates are not comparable with nights before 2026-10-06; the report prints it when the night's date is on or after 2026-10-06 and the seed date is before it, or simply always under the party table: *"Not comparable with nights before 2026-10-06 (195k changed the gym matchups; 195h made the gauntlet carry HP)."*
4. **Tests.** `runNight` with a mismatched existing session refuses before starting any driver; a matching one resumes. The report contains no "scrap" and carries the note.

## 202f: The brief, naive or primed (the open question from 191g)

1. **Henry's questions, answered from the data.**
   - **Does `--brief` exist?** Yes: `npm run playtest:night -- --brief <path>` (193i) and `npm run overnight -- --brief <path>` both take another brief for the driver. Nothing to add.
   - **Is it Haiku?** No. On 2026-10-05, before 195b–d, **sonnet's 31 solo runs never opened the Den either** (195's own finding), and sonnet's 5 party runs won 2. After 195b–d, haiku summoned in 8 of 24. The model changes how well a run is played once a party exists (sonnet won 2 of 5 party runs, haiku 3 of 8); it has not changed whether the agent summons. That is a screen question, which is 202a.
   - **Will a human need more instruction?** Henry's own run (194) built a party of three by biome 1; the Discord playtesters are the real test. The screens are the only instruction a Steam player gets, so 202a is the part that reaches them, and the naive brief is the one that measures it.
2. **The row.** One night, after 202a, 202e and 202g: the 2026-10-04 seeds, every starter twice, **four arms** = {naive brief, primed brief} × {haiku, sonnet}. The primed brief is the current one plus one paragraph under "What to do": *"The gym at the end is three fights in a row against three enemies, with only a part heal between them. A party of three is the normal way to play: Traces you pick up are summoned at a town's Den for 25 amber each, and summoning before the first elite is usually right."* Write it to `docs/playtest/agent-player-primed.md` (193i named that file). `npm run overnight -- --brief docs/playtest/agent-player-primed.md --date 2026-10-xx-primed` runs the primed arms.
3. **What Henry rules from it:** whether the shipped screens (202a) are enough (the naive arm summons and wins at the primed arm's rate), and which model plays the nights from now on. The review's reading: keep the naive brief as the measuring stick and ship the screens until it catches up.

## 202g: The night's defaults

1. **Henry:** *"What command should I be using? Can we just make that the default?"*
2. **The command tonight, before this row ships:**

       npm run overnight -- --starter all --runs 24 --card-runs 1

   That is both models (haiku then sonnet), the 2026-10-04 seeds, every starter twice, one card-mode session per model so the report's Surprises section means something, 35 minutes and $3 a session. Worst case 2 × 25 × 35 min; the 2026-10-06 night's 24 haiku sessions took 2 h 31 min and $8.31, so expect 4–6 hours and about $25 for both models.
3. **The defaults (ruled).** In `scripts/overnight.mjs`: `starter` **all** (was kraken_v1), `runs` **24** (was 9; twelve starters twice), `cardRuns` **1** (was 0). `npm run overnight` with no flags then is the command above. The usage header, `docs/playtest/run-tonight.md` and `src/debug/playtest/overnight.test.ts` (which pins the defaults) change with it. After 202c, `minutes` 60 and `maxUsd` 5 (202c §5).
4. **Test.** `parseOvernightArgs([])` returns starter all, runs 24, cardRuns 1.

---

## Rulings (2026-10-07, Henry, on the review doc)

- The Den tile says "N Traces held · summon here" (202a). *"Regardless of 1."*
- A revive between gym fights; the gauntlet stays three fights (202b). *"I think it's good for the first run to be hard."*
- Each agent plays two runs a session (202c).
- Investigate the v1 starters (202d). *"Add a ticket to investigate."*
- The resume guard and the report's words (202e). *"Sure."*
- The per-stack scaling cards: *"Leave it for now but make a note."* (the note is at the top of this ticket)
- The night's defaults become the full night (202g). *"Can we just make that the default?"*

## Decisions for Henry

1. **D1, the revive floor (202b).** 30% of max HP proposed. Alternatives: 50% (a real second chance), or the same HP the member was revived with by a Draught.
2. **D2, what carries into run 2 (202c).** Proposed: exactly what the game's save carries (roster, banked Traces, codex), including a won run's party. If a lost run should wipe the roster in the game too, say so and the tool follows.
3. **D3, the primed brief's paragraph (202f §2).** Approve or reword before the night runs.

## Resolution

Not started.
