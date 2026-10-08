# Ticket 195: What the 2026-10-05 overnight night found: Traces nobody summons, Bark Smash, the last sci-fi words, and the night script

**Type:** one card change, new on-screen text, a word sweep, four bugs in the game and three in the playtest tool and night script. **Status:** **CLOSED 2026-10-06** (Henry; built 2026-10-05, `npm run gate` passed at `ef0c144`, pushed). Written 2026-10-05 from the night of 2026-10-04 → 05 (72 sessions: 36 haiku, 36 sonnet, every starter). **Henry ruled every row on 2026-10-05** (see *Rulings*). The only open item is approving the Norse names list in 195e-2 (see *Decisions for Henry*). Sibling of [193](193-playtest-nights-findings.md), which built the night script this ticket fixes.

**Where it comes from.** Henry asked for a review of the night (*"if the agent continues to fail, why is it failing"*). The review is the Claude project doc `overnight-2026-10-05-review` and the artifact "Overnight Playtest 10/05". Its headline: **the agent loses because it plays alone.** Across both sonnet nights, 37 solo runs won 0. Runs with a party of 2–3 won 4 of 8, and 3 of the other 4 were stopped by the clock in the gym. None of the 31 solo sonnet runs on 2026-10-05 ever opened the Den. 20 of them passed through a town and still ended with unspent Traces. Henry's reply, the same morning:

> *"Bark smash should be slightly nerfed. We need to better explain blueprints and how to use them. When you get the first one a line should say 'summon in the den'. It looks like not all the names have been changed from robot/sci Fi to Norse names in the text. Scrap should be amber everywhere. Fix the path bug. Are the starters going against the correct gym … If it's the same gym they need to go against their type advantage instead (F vs N or W vs F or N vs W). Increase the default minutes to 35 minutes. Ticket to fix all the bugs that were noticed and everything I mentioned above."*

**Not part of this ticket:** cards nobody picks or buys. That is [196](196-unused-cards.md).

---

## How to work this ticket

1. **Read the whole row first.** Search for the quoted names; line numbers drift.
2. **Test first, run it on the parent, see it fail.** Put "fails on parent: yes" in the commit message.
3. **One commit per row,** gate green first. Stage explicit paths only and don't push (`HANDOFF.md`, "Two agents in parallel"). Commits are authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com'`), with no Co-Authored-By trailer.
4. **195e-2 waits for Henry's approval of its names list.** Everything else can be built now.
5. **Small single-purpose modules, composed** (Henry's standing preference). Each fix is one new small module or one changed function, not an addition to a large file.
6. **Card numbers:** 195a changes a card. Henry reviews every card change before it reaches the registry, so show him the before/after line in the report.

| Row | What | Kind | State |
|---|---|---|---|
| 195a | Bark Smash is slightly nerfed: 6 → 5 a point, Bark Smash+ 10 → 8 | Card data | **Built** |
| 195b | The first Trace on a save says "Summon it in the Den." | New text, game and tool | **Built** |
| 195c | The run's status line says how many Traces are held | New text, game and tool | **Built** |
| 195d | The Summon option says how many cards it adds to the shared deck | Game wording bug | **Built** ("fix all the bugs") |
| 195e | **Amber everywhere**, and the last robot/sci-fi words become Norse | Word sweep, game and tool | **195e-1 built; 195e-2 BUILT 2026-10-08** (Henry approved the list 2026-10-07) |
| 195f | The event debuffs (Frayed Signal, Static Haze) never say what they do | Game wording bug | **Built** |
| 195g | A Rune offer names the unit by its id (`mm_0jbxbmp_1`) | Game/tool bug | **Built** |
| 195h | In the gym gauntlet, a downed member reads "HP full" | Tool bug, maybe engine | **Built** |
| 195i | `moves` keeps going after a purchase reshuffles the list, and sold a card by accident | Tool bug | **Built** |
| 195j | **The path bug:** haiku's sessions land in `resultsplaytest<date>-haiku/` | Night script bug | **Built** |
| 195k | Each starter plays the gym its element beats | Night script | **Built** |
| 195l | The default session limit is 35 minutes | Night script | **Built** |
| 195m | A command in a full-party gym session takes 90 s to 3 min | Tool speed | **Built** ("fix all the bugs") |

---

## 195a: Bark Smash is slightly nerfed

1. **What was seen.** Bark Smash was the killing blow in 5 of the night's 45 defeats, and **all 5 fights lasted 2 turns or fewer.** In the gym, Huldra's Bark Smash hit a lone Fenrir for 851 of 1,140 HP on turn 1 (sonnet r13), and a lone Kraken for 1,166, more than its 1,110 max HP (sonnet r29). The elite Huldra killed a 1,335 HP Jormungandr in one turn (r08, both models). The final screens are rebuilt with `npm run playtest -- state --session r13 --results results/playtest/2026-10-05-sonnet`.
2. **Where.** `src/engine/data/programs.json`: `bark_smash` (`"power": 6`, description *"Consume your Bark Shield: 6 power per point consumed."*) and `bark_smash+` (`"power": 10`, *"… 10 power per point consumed."*). It sits in `huldra_v2`'s deck (`mingmingRegistry.ts`) and in the enemy decks that copy it.
3. **The change (ruled):** `bark_smash` 6 → **5** per point, `bark_smash+` 10 → **8** per point. That is −17% and −20%, and the upgrade stays about 1.6× the base, as it is today. Change the `power` and the description together. A test pins both numbers and checks that each description matches its `power`.
4. **Check.** Re-run the opening-fight read the walker uses (Henry's 2026-09-25 ruling: wild fights in biome 0 at least 85%) for `huldra_v2`, since its own deck is the one that loses damage. Report huldra_v2's number before and after. Henry's 2026-10-02 ruling: *"We don't care about 1v1 numbers except at the start."*

## 195b: The first Trace says "Summon it in the Den."

1. **Why.** The agent picks up Traces and never learns what they are for. Sonnet r36: *"nothing on screen says what a blueprint does for the run or whether I can field a second body soon; picked blindly."* Sonnet r31: *"took only a Skoll blueprint, no way to field it."* The 5 runs that did summon worked it out from the forecast's "Bring a full team" while holding three or more Traces.
2. **The line (Henry's words):** **"Summon it in the Den."** It shows directly under the Trace, wherever the Trace is gained:
   - the fight result (`BattleReport.tsx`, the "Trace Recovered" block);
   - the Wild Tracks event pick (`events.json`, "Pick 1 of 3 blueprints");
   - a Trace bought in the shop (`MarketplaceNode.tsx`);
   - the gym gate and any other place that grants one (search `blueprint` in `src/ui/store/runSlice.ts` for every grant).
3. **When it shows (ruled: once a save):** on the **first Trace the player ever gets on this save**, and never again. Keep a flag in the persistent save (`gameSlice`, beside the Trace counts and the codex), not in the run, and set it when the line has been shown. Put the check in one small module (`firstTraceHint.ts` or similar) that every place above asks. A wiped save shows the line again. The playtest tool starts each session as a fresh save, so the agent sees it on its first Trace of every session.
4. **The tool.** The playtest tool prints the same line on the same screens (`src/debug/playtest/screens/`). It reads the text from the same module, so the agent and a player see one sentence.
5. **Tests.** The first Trace on a fresh save carries the line. A later Trace in the same run does not, and neither does the first Trace of a second run on the same save. The tool's screen for that grant contains the line.

## 195c: The run's status line says how many Traces are held

1. **Why.** The status line in both the game and the tool shows Amber, the party, the deck and the Draughts, but not Traces. The agent's header read `scrap 115 | party: Kraken … | deck 12 | macros: …` with 6 unspent Traces in its pocket (sonnet r30). The town's Den tile already says "N traces held · party X" (`TownSquare.tsx`), but only once you are in a town.
2. **Fix (ruled: "just say how many traces are held").** Add **Traces held** to the run status line: `RunMeta.tsx` in the game, and the bracketed header in the tool's `render.ts` (for example `traces 3`). Read the count from the same place `TownSquare.tsx` reads it (`workshopSpecies(ranch, run)`), so the two never disagree. **No** new line at the biome boundary.
3. **Test.** With 2 Traces held, the run's status line in the game and the tool's header both say 2. After a summon spends one, both say 1.

## 195d: The Summon option says how many cards it adds

1. **What was seen.** Three of the five summoning runs were caught off guard. Sonnet r04: *"the deck jumped from 14 to 24 cards when I assembled two bodies (their engine cards are added automatically), which I did not expect and the screen did not warn about."* Also r02 (13 → 18) and r16 (16 → 26). A careful player may refuse to summon to protect a lean deck.
2. **Fix.** The Summon option in the Den (`WorkshopNode.tsx`, the summon button and its row) and the tool's Den screen say **"+N cards to your deck"**, with the card names on hover. N comes from the same place the summon reads the engine cards from, so it cannot drift.
3. **Test.** For a species whose summon adds 5 cards, the option's text says +5 and the deck grows by 5.

## 195e: Amber everywhere, and the last robot/sci-fi words become Norse

1. **What was seen.**
   - **The playtest tool still prints the old words.** Its header reads `scrap 45`. Its town screen reads *"A town has a shop (cards, macros, a blueprint, patches, upgrades) and a workshop (assemble, reflash, the team)."* Its moves read "Go to the workshop" and "Take the macro Echo". Ticket 193's `a7f3264` covered names and the combat log only. So the agent was confused by text a player never sees: *"rerouting needs 'amber' which I never saw as a currency (I have scrap)."*
   - **Some game text never goes through `plain()`.** The Relay Tower's option said "+20 scrap" while its result said "+20 amber" (sonnet, "Vent" notes). The event names and lines in `src/engine/data/events.json` say "scrap" and "blueprint" outright ("Take 15 scrap instead", "Pay 30 scrap", "Pick 1 of 3 blueprints", "+50 scrap. Static Haze next fight."). Modifier text in `modifiers.json` says "Marketplace and workshop prices +25%".
   - **Sci-fi flavour left in names and text that ticket 183h's word map cannot fix:**
     - **Events (`events.json`):** Scrap Cache, Data Fragments ("Loose code drifts through the static."), Relay Tower, Corrupted Stream ("a torn data stream"), Macro Crate ("single-use routines, factory-sealed"), Overclock Rig, Data Broker, Mirror Protocol, Driver Shrine ("cradled in a data shrine"), Black-Market Patch, Corrupted Cache ("wrapped in corrupted code"), The Toll ("A construct blocks the path"), Firmware Reflash ("A reflash station"), Stray Mingming ("following your signal"), Wild Tracks ("Fresh signal trails").
     - **Draughts (`macroRegistry.ts`):** Free Exec, Cache Pull, Ping Sweep, Recharge, and maybe Surge and Echo.
     - **Event debuffs:** Frayed Signal, Static Haze.
     - **Modifiers (`modifiers.json`):** Junk Start's "Corrupted Data" cards.
     - **Cards (`programs.json`):** Corrupted Data, Scavenge Data, Deep Scan, Capacitor, Discharge, Tidal Battery, Surge Protection.
     - **Totem names (`hooks.json`):** check FIRST BLOOD, TENTH STRIKE, ANTIVENOM, BULWARK REFLEX and ROOT ROT against the direction. They may already be fine.
2. **Fix, in two commits.**
   - **195e-1, Amber and the label words everywhere (Ruled).** Every on-screen string in the game and in the playtest tool's screens goes through `label()` / `plain()` in `src/ui/labels/labels.ts`, or says the new word directly. That covers Amber, Trace, Den, Summon, Draught, Rune, Totem, Retrain, Instinct and Card. Add a test that renders every tool screen and every event in `events.json` through the tool, and fails on any of the old words (`scrap`, `blueprint`, `workshop`, `assembl…`, `macro`, `patch`, `firmware`, `reflash`, `daemon`, `driver`, `program`). Ids, saves and the walker's output keep their names (183h, D1).
   - **195e-2, new Norse names for the flavour above (D1).** Follow the pattern of 183i and 192: write `research/195-norse-flavour-names.md` with each current name and line, a proposed Norse replacement, and one line of why. Henry approves it before anything changes. Then apply it in one commit. Ids stay the same.

## 195f: The event debuffs say what they do

1. **What was seen.** *"Corrupted Stream event: 'Frayed Signal' is not explained, and rerouting needs 'amber'…"* (2026-10-04 sonnet, twice). *"Static Haze did not visibly do anything."*
2. **Fix.** An event option that adds a next-fight debuff prints its effect in one short clause, from the debuff's own definition, in the game and in the tool. For example, "Frayed Signal next fight: " followed by what Frayed Signal actually does, read from its definition (do not paraphrase it by hand). Under 195e-2 the name may change, but the clause comes from the same place.
3. **Test.** Every event option whose `detail` names a debuff carries that debuff's rule text.

## 195g: A Rune offer names the unit by its id

1. **What was seen.** *"Patch offer is Fehu again, which Kraken already has; the screen does not say whether it stacks, and shows the unit as an id (mm_0jbxbmp_1) not a name."* (sonnet notes, 2026-10-05).
2. **Fix.** Rune offers (shop and gym gate) name the unit by species name, and say "already has Fehu" when the Rune is a repeat. Check whether the game shows the id too or only the tool does, and fix wherever it appears. Henry's 2026-10-01 ruling stands: a Rune that does nothing on a body is hidden from its offers.

## 195h: In the gym gauntlet, a downed member reads "HP full"

1. **What was seen.** Sonnet r16: *"Gym between fights: Skoll ended fight 1 at 0/1155 and the forecast said a downed one stays down, but the next screen shows the whole party at full HP (1155/1170/1095), not 30% repairs. Either the screen or the rule is wrong."*
2. **Reproduced.** `npm run playtest -- replay --results results/playtest/2026-10-05-sonnet --session r16 --to 50` prints `HP left: Skoll 0/1155, Fenrir 1170/1170, Ratatoskr 1047/1110.` Its header on the same screen says `Skoll [Sunscorch] HP full; Fenrir … HP full; Ratatoskr … HP full (the team is fully healed between fights; HP only carries inside the gym gauntlet)`.
3. **Fix.** First find out whether only the header is wrong (193d's wording assumes a heal between every fight) or the engine really restores the downed member between gauntlet fights. Inside the gauntlet, the header shows each member's real HP, and "down" for a downed one. If the engine is wrong too, fix the engine against the forecast's rule ("Every member still standing repairs 30% between fights; a downed one stays down"), and report it as an engine change.
4. **Test.** A gauntlet where a member ends fight 1 at 0 shows that member down on the next screen, and the others at their HP plus 30%.

## 195i: `moves` keeps going after a purchase reshuffles the list

1. **What was seen.** Sonnet r16: *"the move numbers shifted after buying Fehu (the Skoll blueprint line vanished), so my next number sold Brand by accident."* Selling is one keypress with no confirm and no undo.
2. **Fix (tool only).** `moves` stops at the first move after which the list of moves changed shape, and prints the new screen and which numbers it did not take. A sell taken through `moves` (not `move`) is refused. This does not change the game. The game's own sell button is a decision for Henry if he wants a confirm there (not in this ticket).
3. **Test.** A `moves` chain of buy-then-sell where the buy removes a line stops after the buy.

## 195j: The path bug

1. **What was seen.** **21 of 36 haiku sessions** (and 3 of 9 on 2026-10-04) recorded no moves. The games were played, but into a folder named `resultsplaytest2026-10-05-haiku/` at the repo root (18 sessions, with seeds the agent made up such as "test" and "r27b", mostly on the default `fenrir_v1`).
2. **The cause.** `promptFor` in `scripts/playtest-night.mjs` builds the results folder with `path.join`, which on Windows gives `results\playtest\2026-10-05-haiku`. The agent's Bash tool is Git Bash, which treats an unquoted backslash as an escape and drops it. Sonnet usually quoted the path, so it was mostly unaffected.
3. **Fix.** The prompt names the folder with forward slashes (`path.posix.join`, or `.split(path.sep).join('/')`), which Node and the tool both accept on Windows. Also have the tool's `state` say clearly when `--results` names a folder with no such session, instead of leaving the agent to start a new one: *"No session r12 in <folder>. Check the --results path."* `new` already exists for starting sessions.
4. **Tests.** `promptFor` on a Windows-style path contains no backslash. `state` on a missing session returns that message and a non-zero exit code.
5. **Clean-up (Henry's machine):** delete `resultsplaytest2026-10-04-haiku/` and `resultsplaytest2026-10-05-haiku/` at the repo root. Their games are on made-up seeds and are not part of either night.

## 195k: Each starter plays the gym its element beats

1. **The answer to Henry's question: they do not all play the same gym, but they don't play the right one either.** `planNight` in `src/debug/playtest/night/plan.ts` sets `gym: i % GYMS_ON_OFFER`. That is an index into the seed's own gym offer (`offerGyms(seed)`), which is ordered differently per seed. And because 12 starters ÷ 3 gyms divides evenly, each starter always gets the same index. The result on 2026-10-05: only **14 of 36** sonnet runs faced the gym their element beats. Fire starters played Emberfall (Fire) 6 times, Rootfall 4 and Tidewrack 2. Both wins were advantage matchups (Kraken v1 into Emberfall, Sköll v2 into Rootfall).
2. **The rule (Henry):** Fire → **Rootfall** (Nature), Water → **Emberfall** (Fire), Nature → **Tidewrack** (Water). Fenrir and Sköll are Fire, Kraken and Jormungandr Water, Huldra and Ratatoskr Nature. Read the element from the species registry, not a table in the plan.
3. **Fix.** The plan stays pure. It takes a `gymFor(seed, starter)` function that returns the index in `offerGyms(seed)` of the gym whose element the starter's element beats (`COUNTERED_BY` / `BEATS` in `src/engine/run/gyms.ts`). The night script passes the real one. Each seed's offer holds all three gyms, so the index always exists. The test asserts that.
4. **Note for the reports.** The 2026-10-04 and 2026-10-05 nights are not comparable to nights after this row on win rate, because the matchups change. Say so in the first report after it ships.

## 195l: The default session limit is 35 minutes

`scripts/overnight.mjs` (`minutes: count('minutes', 25)`, and its usage line "(25)") and `scripts/playtest-night.mjs` (`DEFAULTS.minutes: 25`) both become **35**. Update `src/debug/playtest/overnight.test.ts`, which pins 25, and the command list in the Claude project doc `ticket-193-followup-overnight-script` ("--minutes (25)"). The worst case for a 36-session night per model rises from 15 to 21 hours, so put that in the script's usage line too.

## 195m: A command in a full-party gym session takes 90 s to 3 min

1. **What was seen.** The tool rebuilds the run from move 0 on every call. Once a 3-body party is in the gym, a single `state` took 88–92 s (sonnet r17, 2026-10-04 sonnet r03 and r07) and over 160 s on sonnet r02, r04 and r33. Two of those three (r04, r33) hit the 25-minute limit in the gym, and r02 stopped there at 17 minutes. **None of them lost.** So the night currently measures the stopwatch, not the gym, for exactly the runs that play the game properly. 195l's 35 minutes helps but does not fix it.
2. **Fix.** Find where the time goes first: rebuilding fights the session already played, or the gym's AI search (ticket 166f narrowed it for the game, but the tool may replay every gym fight at full depth). Then cache. The likely shape is a snapshot of the world after the last move, written beside `session.json` and checked against the moves that produced it, so a mismatch falls back to a full replay. **Bit-identical or it does not ship** (Henry's instrument rule): the output of `state` and `replay` for every 2026-10-05 session must not change.
3. **Test.** `state` on a saved session returns the same text with and without the snapshot, and the second call does not replay finished fights.

---

## Rulings (2026-10-05, Henry)

- Bark Smash is slightly nerfed: 6 → 5 a point, Bark Smash+ 10 → 8 (195a). *"Nerf is good."*
- The first Trace says "summon in the den" (195b), **once a save**.
- The status line says how many Traces are held (195c). *"Just say how many traces are held"*: no extra line at the biome boundary.
- Scrap reads Amber everywhere, and the remaining robot/sci-fi words become Norse (195e).
- Fix the path bug (195j).
- Starters play the gym their element beats: F vs N, W vs F, N vs W (195k).
- Default session limit 35 minutes (195l).
- Fix every bug the night noticed (195d, f, g, h, i, m).

## Decisions for Henry

1. **D1, the Norse flavour names (195e-2). RULED 2026-10-07 and BUILT 2026-10-08.** Henry approved the list in `research/195-norse-flavour-names.md` with three changes (Einherjar Feast, Forge Slag, Urðarbrunnr); see the last paragraph of *Resolution*.

## Resolution

**Built 2026-10-05, one commit per row on `first-impressions`, not pushed.** Every row except the Norse names list (195e-2, which waits for Henry's approval) is in.

- **195a** Bark Smash 6 to 5 a point, Bark Smash+ 10 to 8. Golden hashes moved on purpose (a walk that meets either card plays a different game from the same seed). Huldra's opening-fight read is 98% before and after.
- **195b** The first Trace a save gains says "Summon it in the Den.", once per save (new ranch field `traceHintShown`, default false).
- **195c** The status line says how many Traces are held, in the game and in the tool.
- **195d** The Den's Summon says "+5 cards to your deck"; the bench button says its cards go to the collection.
- **195e-1** The tool and its brief say Amber, Trace, Den, Summon, Draught, Rune, Totem, Retrain and Instinct everywhere; a test renders every screen, modifier and event and fails on the old words.
- **195e-2** `research/195-norse-flavour-names.md`: the list, for Henry. Nothing is renamed yet.
- **195f** An event option with a next-fight debuff prints the debuff's rule text from its own definition.
- **195g** The tool rolled a Rune offer for a body that was not on the team (the harness's made-up entity ids against the roster's). Fixed in the tool; the game's Rune bench now prints the species name, not its id.
- **195h** The tool never carried HP in the gauntlet, for the same reason as 195g (made-up ids), so the header always read "HP full" and every gym fight ran at full health. Now it carries each member's HP and who is down. **The game was right.**
- **195i** A `moves` list stops after a move that changes what the screen offers, says which numbers it did not take, and never takes a sale (use `move`).
- **195j** The night prompt names the results folder with forward slashes; a missing session says where it looked.
- **195k** Each starter plays the gym its element beats.
- **195l** Default session limit 35 minutes.
- **195m** The time was the three gym fights (8 to 87 s each, the game's AI playing a full party), replayed on every call. A snapshot beside `session.json` makes a call replay only the new moves: r17 `state` 56 s to 2 s, and the text and JSON are identical with and without it on the real r17 and r02 sessions.

**What this changes in how to read the nights.** Win rates from nights before and after 195k are not comparable (the matchups changed). The 195h fix changes the tool's gauntlet again: before it, the tool played every gym fight at full health, so its gym win rates were too high. Three old sessions that took a reward Rune (2026-10-02 r01, 2026-10-04 sonnet r01, 2026-10-05 sonnet r30) no longer replay past that move.

**For Henry:** D1 below; run `npm run gate` and push (`git push origin first-impressions`); delete the stray `resultsplaytest2026-10-04-haiku/` and `resultsplaytest2026-10-05-haiku/` folders at the repo root; regenerate `registry.json`, `collection.json` and `browser.html` (`npm run decks`) so the Bark Smash text is current.

**Closed 2026-10-06 (Henry).** `npm run gate` passed at `ef0c144` and the branch is pushed. D1 (the Norse flavour names, 195e-2) was not approved at close: nothing is renamed, and the list stays in `research/195-norse-flavour-names.md` for whenever Henry rules on it.

**195e-2 built 2026-10-08, one commit on `first-impressions`, not pushed (Henry approved the list on 2026-10-07 with three changes: Overkill Recovery is EINHERJAR FEAST, Corrupted Data is Forge Slag, Surge Protection is Urðarbrunnr).** The shown names changed in `events.json` (20 events, their lines, the Relay Tower's "Plunder it", and the option lines that name a card or a debuff), `macroRegistry.ts` (4 Draughts), `hooks.json` (4 Totems, the 2 event debuffs and their 6 battle-log lines), `programs.json` (7 cards and their "+" versions) and `modifiers.json` (Junk Start now reads "Start with two Forge Slag in your deck.", Tight Budget "Shop and den prices +25%."). Ids, saves and the walker's output keys did not change, and no card number or text changed. `src/ui/labels/norseFlavourNames.test.ts` pins the whole list; the 195e-1 old-words sweep now also fails on the old flavour names; the `WAITING_FOR_195` exception in `battleLogWords.test.ts` is gone. One bug found on the way: the event-debuff line capitalised the letter after "ö" ("GjöLl Chill"); `eventDetail.ts` now capitalises on spaces only. **For Henry:** regenerate the design record (`npm run decks`, then `python build.py`); `registry.json`, `collection.json`, `upgrades.json` and `browser.html` still show the old card names until you do.
