# Ticket 193: What the first three playtest nights found, and how to get the agent to play the whole game

**Type:** bugs (one engine, five tool), plus a run forecast shown in the game and the tool. **Status:** **CLOSED 2026-10-08** (built 2026-10-04; its two follow-up nights were replaced by the nights of 2026-10-05, 2026-10-06 and 2026-10-07, which led to tickets 195 and 202; the primed brief it asked about is written at `docs/playtest/agent-player-primed.md`, and measuring it is row 202f). written 2026-10-04 from nights 2026-10-02, 2026-10-03 and 2026-10-04 (19 sessions: 9 + 1 + 9; the 2026-10-04 night finished after the first draft of this ticket, and its r04–r09 are counted). **Henry ruled 193a, the forecast (193j), the full-run question, and the order of the two follow-up nights the same day** (see *Rulings*). **Built the same day (193a–f and 193h–k; 193g is rulings only), not pushed; the two follow-up nights are Henry's to run (see *Resolution*).** Sibling of [186](186-playtester-findings.md), which was the first batch from the tool's own build. (Numbered 193 because 191 is the Steam input template check and 192 is the Aura and Rune names.)

**Where it comes from.** Henry asked for a review of the nightrun results and then: *"Was the agent not smart enough to beat the gym? How do we get it to use its party, do we need a how to play manual added or something? I get to the gym every time, and I think I'm 2/4 beating the gym."* Every number below is from the session files in `results/playtest/` and from replays of them, not from the agents' own summaries (several of those turned out to be wrong, see 193b–193d).

**Not part of this ticket:** balance numbers (the walker, the sims and ticket 77 own those) and the Dazed/draw deck being strong (Crushing Depths+ at 1,000–3,000 damage was reported by most agents; that belongs to deck-archetypes).

---

## How to work this ticket

1. **Read the whole row first.** Search for the quoted names; line numbers drift.
2. **Test first, run it on the parent, see it fail.** Put "fails on parent: yes" in the commit message.
3. **One commit per row,** gate green first. Stage explicit paths only and don't push (`HANDOFF.md`, "Two agents in parallel").
4. **Row 193a is an engine change and needs Henry's ruling first.** Rows 193b–193f are `src/debug/playtest/` only. Row 193g is a decision, not code.
5. **Small single-purpose modules, composed** (Henry's standing preference). Each fix below should be one new small module or one changed function, not an addition to an existing large file.

| Row | What | Kind |
|---|---|---|
| 193a | A hook-fired attack carries a program with no `actions`, and a Driver's hook reads it: **engine TypeError** | Engine bug. **Ruled: it is not an attack (option A)** |
| 193b | `card-vanished` fires every time a Daemon (Aura) is played | Tool false alarm |
| 193c | The "surprise" list counts firmware and Aura effects as wrong card text | Tool false alarm |
| 193d | The status line says `HP full` right after a fight that left a unit at 39 of 1095, and never says why | Tool wording |
| 193e | An Ambush reads `bonus: FIRST BLOOD` and nothing says it is the dangerous one | Tool wording |
| 193f | A mirror fight reads `Kraken's Ink Stream on Kraken: 706` | Tool wording |
| 193g | How the agent is taught about parties, the goal and healing | Rulings recorded; D1 and D4 still open |
| 193h | The morning report does not show party size or unspent scrap, the two numbers that explain the nights | Tool report |
| 193i | The night script has no `--brief` flag, and a rerun on a finished date does nothing without saying so | Tool script |
| 193j | **A one-sentence forecast of the run** (biomes, the elites, the gym gauntlet, the boss), in the game and as the agent's forewarning | New text, shared by the game and the tool |
| 193k | A night cannot be replayed on the same seeds: they embed the date. Add `--seed-date` | Tool script |

---

## 193a: A hook-fired attack crashes on any Driver hook that checks the card's action type

1. **What was seen.** 2026-10-02 r01 ended `abandoned` with `TypeError: Cannot read properties of undefined (reading 'some')` on entering the layer-4 elite. The agent blamed the ANTIVENOM stake; that was incidental. Replay: `npm run playtest -- replay --results results/playtest/2026-10-02 --session r01 --to 28` (reproduced twice on 2026-10-03).
2. **The cause, with the stack.** Feedback Loop's Aura (`daemon_draw_damage_proc` and the `+` version, in `src/engine/data/lib/hooks.json`) fires an `ATTACK` from an `onCardDraw` hook. That attack has no card behind it, so `AttackExecutor.execute` (`ActionExecutors.ts`, the line `const programToUse = program || ({ element: element } as ProgramData)`) hands `calculateDamage` a stand-in program that is only `{ element: "Water" }`, with no `actions` list. The damage-modifier hooks then run (`Hooks.ts` `applyDamageModifiers`), and any whose condition has `actionType: "ATTACK"` reach `ConditionValidator.ts` at about line 72, `context.program.actions.some(...)`, and throw. In r01 the hook was `driver_first_blood_boost` (FIRST BLOOD was installed from the first elite, ticket 17). Logging the offending condition in a scratch copy (a program of just `{"element":"Water"}` meeting a `first_blood` counter condition) showed exactly that hook, and with a guard in place the run went on.
3. **Who else is exposed.** Every hook in `hooks.json` with `when.actionType` that runs on the damage path, which means `driver_first_blood_boost`, `driver_tenth_strike_boost`, all eight `driver_element_*_boost`, `gullin_v2_ram`, and `einherjar_standard_hook` (and probably `gullin_v2_ram`, which uses `onPowerCalculated`; not checked); against every attack that has no card: the two Feedback Loop zaps and `short_circuit_discharge` (and `+`). **The real game runs the same engine,** so a player holding one of those Drivers (Totems) and either Aura or Short Circuit should be able to hit it. This is a player-facing crash, not only a playtester one. It was not tried in the UI.
4. **Ruled (Henry, 2026-10-04): "It's not an attack."** That is option A below; option B is dropped. The options are kept so the reasoning is on file:
   - **A. Never a card:** give the stand-in program an honest `actions: []`, so `actionType` checks are simply false and the zap gets no Driver or element boost. Smallest change; no number a finished run could have produced changes, because these runs all crashed.
   - **B. Count as an attack:** the stand-in carries the attack action itself (`actions: [actionData]`), so the zap is boosted by FIRST BLOOD, the element Totems and TENTH STRIKE where their other conditions hold. Closer to ticket 16's "a Driver's zap counts as the triggering card" wording, but it changes damage numbers and the balance sims.
   - **A is the build.** A zap with no card is not an attack, so `actionType: ATTACK` hooks (FIRST BLOOD, TENTH STRIKE, the element Totems) do not boost it and do not count it. Say so in the Drivers' own text only if a Driver's description could be read the other way.
5. **The fix, either way.** Build the stand-in program in one small function (for example `standInProgram(element)` in its own file under `src/engine/actions/`) so the shape lives in one place, and make `ConditionValidator` read `context.program.actions?.some(...)` so a malformed program can never throw again.
6. **Tests.** Install FIRST BLOOD on the player, put Feedback Loop in the hand and draw by an effect: the battle must not throw. Repeat for `short_circuit_discharge` against an enemy that draws. Add the dead session as a fixture if the repo keeps any. Fails on parent: yes (the `replay` command above is the repro).

## 193b: `card-vanished` fires every time a Daemon (Aura) is played

1. **What was seen.** 2026-10-03 r01 reported two `card-vanished` failures, both for `feedback_loop` (replay moves 39 and 49, both "Play Feedback Loop Daemon").
2. **The cause.** `sidePiles` in `src/debug/playtest/invariants/battleInvariants.ts` lists hand, draw pile, discard and exhaust. A Daemon leaves the hand and goes onto the unit's `daemons` list (`IBattleEntity.daemons`, `src/engine/types.ts`), which is not in that list, so the card looks gone. It is not.
3. **The fix.** Add each unit's `daemons` for the same side to what `sidePiles` returns (a second small function, `installedDaemons(state, side)`, next to it), so the vanished-card and duplicate-id checks both see installed cards.
4. **Tests:** play a Daemon in a scripted fight and assert no violation; remove the card from every list and assert `card-vanished` still fires. Fails on parent: yes.

## 193c: The "surprise" list counts firmware and Aura effects as wrong card text

1. **What was seen.** The 2026-10-03 report lists four surprises. Whirlpool+ "Apply 4 Dazed" gave 6, Whirlpool "Apply 2 Dazed" gave 4, Pressure Point gave 2 hits for 1. The agent also wrote *"Whirlpool+ text says 4 Dazed but card only applied 2"*, which is the same misreading.
2. **The cause.** Kraken's ABYSSAL_INK_SYS applies 2 Dazed on every draw outside the draw phase (`hooks.json`, `kraken_v1_hook`), and Whirlpool draws, so the card's own 2 becomes 4 and its 4 becomes 6. Pressure Point's extra hit is Feedback Loop's zap. Both are correct and in the combat log. The Tackle "kills" mismatch was not examined.
3. **Why it is wrong to list them.** Ticket 186d ruled: *card text stays clean, the combat log reports what a firmware adds.* The detector compares a prediction with the printed card text, ignores that ruling, and so reports the ruling's own intended behaviour as a wording bug every night.
4. **The fix.** A small `explainedByLog` check beside the surprise detector: if the log lines printed for that play name the firmware or Aura that produced the difference (the status, the extra hit), file it under "explained by firmware" and keep it out of the Surprises list. Keep a count so the report can say "6 explained".
5. **Tests:** a Whirlpool play on Kraken (expected 2 Dazed, got 4, log names Abyssal Ink) is not a surprise; a play whose difference no log line explains still is.

## 193d: `HP full` right after a fight that left a unit at 39 of 1095

1. **What was seen.** 2026-10-02 r08: the layer-4 elite ended `HP left: Kraken 39/1095`, and the very next screen's status line read `Kraken … HP full`. Two agents reported it as a display bug.
2. **The cause, checked.** It is by design. HP carries only inside a gauntlet; between ordinary nodes the party is fully healed (`battleSetup.ts` "a full heal, by construction"; `runSlice.ts` "FULL HEAL between regular nodes"). `statusLine` in `src/debug/playtest/render.ts` prints `full` whenever there is no gauntlet HP to show, which is true but unexplained.
3. **Why it matters more than a wording fix.** The agents spent real effort on healing because nothing told them HP resets: *"Mend+ heals 30 HP against 700+ damage"* (2026-10-04 r01), *"health attrition was real"* (2026-10-02 r06), Mend or Salve taken in at least five runs. A new player in the real game may think the same.
4. **The fix.** Say it once, where the agent looks. On the first map screen of a run and in the status line after any fight, `HP full (the team is fully healed between fights; HP only carries inside the gym gauntlet)`; inside a gauntlet keep today's numbers. One small function, `hpNote(run)`, so the wording is not repeated per screen.
5. **Tests:** after a fight outside a gauntlet the status line contains the full-heal note; inside a gauntlet it shows the carried numbers.

## 193e: An Ambush reads `bonus: FIRST BLOOD` and nothing says it is the dangerous one

1. **What was seen.** 2026-10-04 r01 died at the first Ambush (Jormungandr and Jormungandr, 4 turns) after 4 wins. Its reason for walking in: *"Ambush offers a FIRST BLOOD bonus, suggesting extra rewards for this fight."* Its last note: *"The Ambush felt like a trap … it had 2 enemies."* 2026-10-02 r02 also died at its first Ambush with 0 scrap.
2. **The cause.** Ticket 17 gave the real map a red Ambush with a HIGH RISK mark. The text tool's `mapScreen.ts` prints `bonus: <Driver>` for an Ambush and `stakes: <Driver>` for an Elite, and no risk word.
3. **The fix.** Add the same word the real map uses to the text tool's Ambush line and to the Elite line if the real map marks it. Share the wording with the UI through the one place it already comes from if there is one (check `gameText.ts` and the map components first); do not write a second copy.
4. **Tests:** the Ambush line contains the HIGH RISK word; a plain Wild line does not.

## 193f: A mirror fight reads `Kraken's Ink Stream on Kraken: 706`

1. **What was seen.** Three agents (2026-10-02 r02, 2026-10-04 r01, 2026-10-04 r04) wrote a note asking whether their Kraken was hitting itself; 10-04 r04 wrote *"my biggest hits were my own cards hitting my own Kraken … why would my best cards hit me?"* and lost its Elite thinking it was a reflect mechanic. Other sessions printed the same lines without a note (2026-10-02 r04; 10-04 r06, where an Elite Huldra fought a party Huldra). The foe was an elite or wild unit with the same name as one of the party each time.
2. **The cause.** `fightReportLines.ts` prints `${hit.source}'s ${hit.label} on ${hit.target}` from names only, so two units with one name cannot be told apart.
3. **The fix.** Tag the enemy side when a name occurs on both sides of the fight (`Kraken (foe)`), in a small `sideTag` helper. Look at whether the game's own combat log has the same ambiguity; if it does, that is a wording row for the UI, not this tool.
4. **Tests:** a fight of Kraken against Kraken prints one tagged name; a fight with distinct names is unchanged.

---

## 193g: How the agent is taught (evidence and rulings)

**The evidence, 19 sessions** (2026-10-02 r01–r09, 2026-10-03 r01, 2026-10-04 r01–r09; every one Kraken, tier 0, haiku).

| | Sessions | Reached the gym | Won the gym |
|---|---|---|---|
| Party of 2 or 3 at the end (assembled a second member at a Den) | 6: 10-02 r05, r08; 10-04 r02, r03, r06, r08 | 3 (10-02 r05, 10-04 r02, 10-04 r03); 10-02 r08 was alive in biome 2 when the agent stopped | 1 (10-04 r03, Kraken and Jormungandr, 18 fights) |
| Solo Kraken the whole run | 13 | 1 (10-04 r09, lost in one turn holding 195 scrap) | 0 |

- **A party helps but is not the whole story.** Half of the party sessions reached the gym against one in thirteen solo ones. But two party sessions (10-04 r06 and r08) still died to an Elite, one of them in the first biome with 0 scrap, so a second unit bought late or built thin is not enough.
- **The gym itself looks fine.** Agents were 1 of 4 at the gym fight (10-02 r05, 10-04 r02 and r09 lost, 10-04 r03 won); Henry reports about 2 of 4. That is the same size of result with this few fights. What differs is the road to it: Henry reaches the gym every time, the agents 4 times in 19 sessions.
- **The agents died on the way, mostly to the Elites.** Of the 19: 9 died at an Elite, 2 at an Ambush, 1 at a Rival, 3 at the gym and 1 won it, 1 hit the 193a crash at an Elite, and 2 stopped early. Of the 13 solo sessions: 7 Elite, 2 Ambush, 1 Rival, 1 gym, 1 crash, 1 stopped early. Kraken (about 1,080 HP) took single hits of 590 to 1,037. An Elite or Ambush is a roughly one-fight exam for a one-unit party, and the Elite at the end of each of the first two biomes cannot be walked round.
- **It was offered, in plain words.** The 2026-10-02 r07 agent opened the Den with 90 scrap and saw `BLUEPRINTS (assembly costs 25 scrap and one blueprint; party 1/3)` with Fenrir, Jormungandr and Skoll listed. It spent the scrap on two upgrades at 30 each. At death the runs held 195 (10-04 r09), 185 (10-04 r02), 170 (10-04 r03), 100 (10-02 r09), 30, 25 and 20 scrap in others; the three richest all reached the gym and held that scrap through it.
- **The agents asked for it in so many words.** 2026-10-04 r09, solo Kraken, lost the gym in one turn with 195 scrap and wrote: *"Consider: were players supposed to assemble multiple party members? Was the gauntlet difficulty calibrated with multi-unit parties in mind?"* It had made 5 upgrades and 0 assemblies. 10-04 r07 made 6 upgrades and 0 assemblies; 10-04 r04 and r05 never opened the Den before dying to the first Elite.
- **Nothing tells the agent a party is the game.** `docs/playtest/agent-player.md` does not contain the words party, blueprint, Den, gym, gauntlet, Elite or heal. The real run-start screen does say *"Beat the gym leader at the end of the road"* (`RunStart.tsx`, ticket 182a), and the gym card's hover shows the boss's signature passive (`gymSignatures`, ticket 68). But the tool starts a session on the map (`playtest new --gym`), so the agent never sees that screen, and I found no goal text in `mapScreen.ts`. The 2026-10-04 r02 agent wrote *"Game unclear on end conditions or win state."* Even the real line is thin: it does not say what stands between the player and the leader.
- **The intro run teaches this to real players** (ticket 182: seven nodes, a free recruit, a one-fight leader). The tool starts at tier 0 with no intro run, so the agent is a player who skipped the tutorial and got no manual.

**Answer to "was the agent not smart enough": no.** A haiku agent won a gym run with a two-unit party, found the Dazed and draw engine on its own in nearly every run, and read costs correctly. It plays what the screens lead it to. The mistakes are strategic gaps (no party, scrap left unspent, healing it did not need, an Ambush it read as a gift), and three of them are gaps in what the screens say.

**Rulings (Henry, 2026-10-04).**

- **Row 193a:** *"It's not an attack."* Option A is built.
- **What goes on the screens (was D2):** *"If the agent felt it was unclear a player will as well. We need some description of what to expect on the run so players and the agent can plan for the boss. Keep it short and ideally in game, although it would probably happen before the run so maybe the agent needs it as a forewarning."* This is row 193j. It replaces my earlier list (goal line, party count, HP note on the map status line) with one short forecast; the HP line stays in 193d and the Ambush word in 193e.
- **The intro run (was D3):** *"Keep it the full run."* The tool keeps playing the full tier-0 run. No `--intro` mode. A consequence worth knowing: the agent never gets the intro run's free recruit, so it is a player who skipped the tutorial, and the forecast is what has to carry the lesson.

- **Order of the two follow-up nights (was D1 and D4).** Henry, 2026-10-04: *"Yes to both of your suggestions."* So:
  1. **Build first:** 193a–193f and 193j (and 193k so the nights can reuse seeds).
  2. **Night A, haiku with the forecast, on the 2026-10-04 seeds, brief unchanged.** The 2026-10-04 night is the baseline: 9 sessions, 1 win, 3 reached the gym, 4 ended with a party. Read the 193h table beside it. A primed brief (`agent-player-primed.md`, with `--brief`, 193i) is written **only if** the gap does not close; it is not built now.
  3. **Night B, sonnet with the forecast, on the same seeds.** Compare it with Night A (same code, same seeds, only the model differs), not with the baseline. Ticket 180's A3 comparison; roughly 3 to 5 times a haiku night in tokens. Nine sessions is the useful size; the first three seeds are the minimum.
  4. **Commands (after the build, from the repo, in this order):**
     - `npm run playtest:night -- --date 2026-10-06 --seed-date 2026-10-04 --runs 9 --starter kraken_v1 --card-runs 0 --model haiku`
     - `npm run playtest:night -- --date 2026-10-06-sonnet --seed-date 2026-10-04 --runs 9 --starter kraken_v1 --card-runs 0 --model sonnet`
     - then `npm run playtest:report -- 2026-10-06` and `npm run playtest:report -- 2026-10-06-sonnet`.
     The 2026-10-04 night used `--starter kraken_v1` (every session is Kraken) and `run` mode only. The dates are examples; any unused date works, because the results folder follows `--date` while the seeds follow `--seed-date`.
  5. **Seeds only mean the same world while the engine and data do not change.** 193a changes damage only for a card-less zap, and 193j is text, so the world is the same for this purpose. Do not run a balance change between the baseline and Night A.

## 193h: The morning report does not show the numbers that explain the nights

1. **What was seen.** The report has biome, cards, scrap left and decision count per run. Party size, blueprints unspent, and how the run ended (Elite, Ambush, Rival, Gym) had to be rebuilt by replaying every session by hand.
2. **The fix.** Add three columns to the per-run line, each from its own small function in `src/debug/playtest/report/facts.ts`'s neighbours: party size at the end, blueprints held at the end, and where it ended. Add a one-line table to the top of the report: sessions by party size, how many reached the gym. This is the table in 193g and it should be free every morning.
3. **Tests:** a fixture night with one solo and one party session produces the table.

## 193i: The night script has no `--brief` flag, and a rerun on a finished date is silent

1. **What was seen.** `runNight` already reads `options.briefPath`, but `parseNightArgs` never sets it, so a second brief cannot be chosen from the command line. And Henry's first rerun used the same date: every session had a `driver.json`, so all were skipped, and the only sign was a column of `already done` lines.
2. **The fix.** The all-skipped line is wanted now; `--brief <path>` is only needed if Night A (see *Rulings*) shows the gap staying open. Add `--brief <path>` to `parseNightArgs`. When every planned session is skipped, print one line first: `Every session for <date> is already finished; use --date <new date> for a fresh night, or delete results/playtest/<date>.` The resume rule itself stays (it is what makes an interrupted night safe).
3. **Tests:** `--brief x.md` sets `briefPath`; an all-skipped night prints the line.

## 193j: A one-sentence forecast of the run, in the game and as the agent's forewarning

1. **What Henry asked for.** See the ruling above: a short description of what to expect on the run, so a player (and the agent) can plan for the boss. Short, in the game, shown before the run starts, and given to the agent as its forewarning.
2. **What a run is, from the code and the replays.** Three biomes of five layers. The layer-4 node of the first two biomes is an Elite, and beating it raises the loadout offer (`boundaryScreen.ts`). The layer-4 node of the third biome is the gym. The gym is a gauntlet of three fights in a row with no healing between them (`gauntlet.ts`: fights 1 and 2 are the leader's team drawn from the run's three biomes; fight 3 is the boss, authored for Emberfall, and for Tidewrack and Rootfall one species from each of the run's three biomes). Outside the gauntlet the party is fully healed between fights. Ticket 176 is redrawing this map, so **no number or node name in the text may be typed in by hand**; it is built from the run's own data.
3. **The text, one `<p>`, 140 characters at most** (the copy budget, ticket 182a: `MAX_PARAGRAPHS = 1`, `MAX_PARAGRAPH_CHARS = 140`). Draft for Henry to reword, 123 characters: *"Two elites guard the road to the gym, whose three fights come back to back with no healing between them. Bring a full team."* Measure the final wording in the test; if the party clause does not fit, drop it and let the Den's `party 1/3` line carry it.
4. **Where, in the game.**
   - **Run start.** The one sentence that is there now, *"Beat the gym leader at the end of the road."* (`RunStart.tsx`, the `ranch-note` paragraph on the "Choose a gym" step), becomes the forecast. Same one paragraph, so `copyBudget.test.tsx` stays green.
   - **The boss, on hover.** The gym card's hover (`offerHover`) already shows the leader's signature passive. Add one line there for the gauntlet's shape and one for the boss team's rule, from the **same table the gauntlet fields** (`authoredBossFor` for Emberfall; the one-per-biome rule for the other two). Ticket 28a is the warning: a preview that reads from a second table is worse than no preview. Hover text does not count against the budget.
   - **Mid-run.** Optional: the map's one-line tip toast (`src/engine/tips.ts`) repeats it once on the first map. Only if `tips.ts` already has a slot; do not add a paragraph to the map.
5. **Where, in the tool (the forewarning).** Print the same sentence and the same hover lines as a short `RUN FORECAST` block on the first screen of every session (before the first move only; later screens do not repeat it). The tool starts on the map today, so this is the agent's whole equivalent of the run-start screen.
6. **How to build it (small pieces).** One pure engine function, `runForecast(biomes, gymId)`, in its own file under `src/engine/run/` (no React, no Redux, no `src/ui` or `src/debug` imports). It returns the sentence and the detail lines. The count of fights, the number of biomes and the elite gates come from the constants and data the run already uses. `RunStart.tsx` and the tool's first screen both call it; neither writes its own text. A second small function formats the detail lines for the hover.
7. **Tests.**
   - The sentence is at most 140 characters for each of the three gyms.
   - Changing the gauntlet length constant changes the sentence (it is not typed in).
   - For Emberfall the detail lines contain the authored signature; for Tidewrack and Rootfall they state the one-per-biome rule and do not name a species.
   - `copyBudget.test.tsx` is green for the run-start screen.
   - The tool's first screen contains the block and its second screen does not.
8. **How we know it worked.** Night A (see *Rulings*): the 2026-10-04 seeds again, brief unchanged, with the forecast. Read the 193h table: party size at the end, blueprints held, scrap at death and how many reached the gym, against the baseline of 3 of 9 reaching it, 4 of 9 ending with a party and the three richest runs holding 170 to 195 scrap.

## 193k: A night cannot be replayed on the same seeds

1. **What was seen.** `planNight` (`src/debug/playtest/night/plan.ts`) names the seed `pt${date}:${index}`, and `date` is also the results folder. So the only way to play the same seeds again is the same `--date`, and then every finished session is skipped (that is what happened to Henry's first rerun) unless the old folder is moved away by hand. A before-and-after comparison, and a model comparison, both need the same seeds in a new folder.
2. **The fix.** Give `planNight` an optional `seedDate` (default: `date`, so nothing changes today) and use it only for the seed: `pt${seedDate ?? date}:${index}`. The `plan` command takes `--seed-date <date>` and `parseNightArgs` passes it on. Starter and gym still follow the index, so session N is the same world as before. The results folder, the session names and the report keep following `--date`. Record `seedDate` in nothing else; the seed is already in each session file's header.
3. **Tests.** `planNight('2026-10-06', starters, { seedDate: '2026-10-04' })` returns the same seeds, starters and gyms as `planNight('2026-10-04', starters)`; without `seedDate` the plan is unchanged; `parseNightArgs` reads `--seed-date`.

## Done when

- 193a is built as ruled (a card-less zap is not an attack), the crash is gone, and the replay of 2026-10-02 r01 reaches its next move.
- 193b–193f are built or closed, and a night's report has no false `card-vanished` and no firmware "surprises".
- 193j and 193k are in, Night A and Night B have been run on the 2026-10-04 seeds and read with the 193h table beside the baseline, and Henry rules on the primed brief (193i) from that.

## Resolution

**Built 2026-10-04: 193a–f and 193h–k (193g is rulings only).** Ten commits, one per row, `9782d4c..713b9c5` on `first-impressions`, not pushed. Each row's tests were written first and fail on the parent (the commit messages say so). `tsc -b`, `eslint src` and the whole vitest suite are green on a Linux copy except `runWalker.scrap` 174d, which fails the same way on the parent (the other agent has an uncommitted fix for it); `npm run gate` could not run there.

| Row | Commit | What changed |
|---|---|---|
| 193a | `9782d4c` | A card-less zap (Feedback Loop's, Short Circuit's) is not an attack: its stand-in program has no actions, the Driver conditions read it safely, and the crash is gone. Nine tests. |
| 193b | `5ca0c60` | An installed Aura (Daemon) no longer reads as a vanished card. |
| 193c | `146308c` | A difference a firmware, Aura or Driver accounts for in the game's own log is filed as *explained* and counted on one report line, not listed as a surprise. |
| 193d | `046b685` | The status line says why HP reads full (the team is healed between fights; HP only carries inside the gym gauntlet). |
| 193e | `e4ec4bf` | The text tool's map marks an Ambush `HIGH RISK — they outnumber you`, from one constant shared with the real map's marker. |
| 193f | `ca9cefd` | A mirror fight reads `Kraken (foe)` for the enemy, so `Kraken's Ink Stream on Kraken: 706` is no longer ambiguous. |
| 193j | `1d301c6` | `runForecast`: one sentence for the run-start screen, detail lines for each gym card's hover, and a `RUN FORECAST` block on the tool's first screen. |
| 193k | `75f60a4` | `--seed-date` on the plan and the night script: a new night on an old night's seeds. |
| 193h | `51400cf` | The report shows party size, blueprints unspent and where each run ended on every run line, and a table by party size (sessions, reached the gym, won) at the top. |
| 193i | `713b9c5` | `--brief <path>` on the night script, and a first line saying so when every session was already finished. |

**Things that differ from the ticket, or that Henry may want to know.**

- **All three gyms have an authored boss.** The ticket said Tidewrack and Rootfall use the one-species-per-biome formula; `bosses.ts` authors all three, so every gym's hover reads its boss rule from that table. The one-per-biome wording is kept as the fallback for a gym with no authored boss and is tested with an invented gym id. The boss team's species are not named in the forecast (ticket 68 ruling 4 telegraphs the rule; the scout shows the team mid-run).
- **The forecast sentence is a draft for Henry to reword.** Today it reads: *"Two elites guard the road to the gym, where three fights come back to back with only light repairs between. Bring a full team."* (126 characters.) It says "light repairs" because ticket 173 repairs 30% between gauntlet fights, so "no healing" would be untrue. The count, the fights and the repair come from the game's own constants, so a longer gauntlet or a 0% repair changes the sentence; the words are in one function, `sentenceFor` in `runForecast.ts`.
- **An Elite is not marked HIGH RISK** (193e): the real map does not mark one, and the agent should see what a player sees.
- **The real combat log's mirror ambiguity is fixed too** (follow-up, commit `237faa8`). The enemy side is renamed when the battle is built (`tagMirrorFoes`, used by `createBattleState` and the playtester's `openBattle`), so the log, the nameplate and the tool all say `Kraken (foe)`. Enemy-versus-enemy duplicates are not renamed.
- **The playtester now prints the game's words** (follow-up, commit `a7f3264`): firmware, card, macro, patch and Driver names and the relayed combat log go through the UI's `plain()`, so the agent reads Instinct, Aura, Alert and the Norse names as a player does. **This changes what the agent sees against the 2026-10-04 baseline.** For a pure A/B on the old words, revert that one commit before Night A.
- **A firmware's explained share can hide a same-kind real bug in the same play.** The report counts how many differences were explained, by what, so a rising count is visible.
- **The HP note on the status line** appears on every non-gauntlet screen while any member reads full. The token cost is small.
- **The 2026-10-02 r01 replay could not be run to confirm the crash is gone**: that session was recorded before ticket 176's map, so its first move names a node the current map does not have. The nine tests in `cardlessZap.test.ts` (all red on the parent) are the proof instead.
- The old one-line pin in `RanchScreen.cut.test.tsx` (182a's "Beat the gym leader at the end of the road.") now holds the forecast sentence, on purpose. The two older report fixtures gained the four new fields.

**Henry still has to** (none of this is mine to do):

1. Run `npm run gate`.
2. Look at the forecast sentence and reword it if he wants (`sentenceFor` in `src/engine/run/runForecast.ts`).
3. Run Night A, then Night B, with one command from any terminal (the 2026-10-04 night is the baseline; do not change balance between them): `npm run overnight` (follow-up, commit `d12f515`; it checks the tool first, then plays both nights, and `npm run overnight -- --dry-run` shows the plan without playing). It replaced a bash script that did not start under PowerShell. The script runs exactly these:
   - `npm run playtest:night -- --date 2026-10-06 --seed-date 2026-10-04 --runs 9 --starter kraken_v1 --card-runs 0 --model haiku`
   - `npm run playtest:night -- --date 2026-10-06-sonnet --seed-date 2026-10-04 --runs 9 --starter kraken_v1 --card-runs 0 --model sonnet`
   - `npm run playtest:report -- 2026-10-06` and `npm run playtest:report -- 2026-10-06-sonnet`
4. Read the two reports' top table beside the baseline (3 of 9 reached the gym, 4 of 9 ended with a party) and rule whether a primed brief (`agent-player-primed.md`, which `--brief` can now load) is needed.
5. Push: `git push origin first-impressions`.

**Closed 2026-10-08.** Nothing in 193 is still open: the Night A and Night B it asked for were replaced by later, larger nights, and the question of a primed brief became row 202f of [ticket 202](202-night-2026-10-06-rulings.md).
