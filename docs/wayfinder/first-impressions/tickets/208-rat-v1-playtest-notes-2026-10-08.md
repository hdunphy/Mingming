# Ticket 208: What Henry's 2026-10-08 Ratatoskr v1 playtest notes asked for: Hamstring, Rat's frame, Seed Bomb, Corrosive Leak's name, and the water stutter

**Type:** one card number, one species frame, one card (a decision already open in 206), one rename, and one stutter that needs measuring in the real game before anything is fixed. **Status:** **OPENED 2026-10-09**, no rulings yet. Every row below says what was found, gives the options with the lean first, and ends with the question Henry has to answer. Nothing is built.

**Where it comes from.** `playtest-results/2026-10-08/rat_v1/notes.md` (gitignored folder). It is five bullets, quoted here in full, and the folder holds **only that file**: no run log and no fight logs. So which fights, which cards, which battle speed and whose turn were not available to check, and every row below is checked against the code, the balance reports and a measurement made on 2026-10-09, not against the run.

> - Hamstring is worse than thorn tithe. I think we should make it do extra damage to make up for the missing STAB bonus.
> - Rat had his stats lowered because he was supposed to have 3e. That doesn't really make sense anymore. We should up his stats. He should be middle of the road between the other two.
> - seed bomb feels like it should hit harder. 10 cards only did 500 damage. Maybe thats his stats... I don't know.
> - Corrosive leak should be renamed. This might be happening in another branch
> - water attacks still cause a stutter

**What was found, claim by claim.**

| # | Henry's claim | Verdict | One line |
|---|---|---|---|
| 1 | Hamstring is worse than Thorn Tithe, because it has no STAB | **Confirmed** | For a Nature Mingming Thorn Tithe hits 2.3 times as hard (61 against 27). The gap is half printed power, half STAB. |
| 2 | Rat's stats were lowered for 3 Energy, which he no longer has | **Confirmed** | Attack 55 was priced against 3 Energy and 4 draw (ticket 32). Ticket 136d took the Energy back and left the frame. He is the lowest total in the registry (180). |
| 3 | Seed Bomb should hit harder; 10 cards did 500 | **Not a bug; the stat is a real part of it** | The formula gives 389 to 533 for 10 cards at his attack, depending on the target. In Fenrir's or Kraken's hands the same card does 547 to 809. Ticket 202d already has the number-only fix (P3) open. |
| 4 | Corrosive Leak should be renamed; maybe done in another branch | **Not done anywhere** | Every local and remote branch carries the old name (`new-cards` has no such card at all). No commit renames it and the approved Norse list (195e-2) does not include it. |
| 5 | Water attacks still stutter | **Not reproduced** | Measured water, fire and nature casts head to head: water was the cheapest of the three. The test cannot see an enemy's turn, sound or a GPU, so the real cause is still open. |

---

## How to work this ticket

1. **Read the whole row first.** Search for the quoted names, because line numbers drift.
2. **Test first.** Run the test on the parent, see it fail, and put "fails on parent: yes" in the commit message.
3. **One commit per row,** with the gate green first. Stage explicit paths only and don't push. Commits are authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com'`), with no Co-Authored-By trailer.
4. **Small single-purpose modules, composed** (Henry's standing preference): many small classes, composition over inheritance. 208e is the row where this matters most.
5. **Order:** 208d is independent and can go first. 208a, 208b and 208c all move numbers that the Rootfall and Emberfall measurements read, so Henry rules on them together and they are measured together (one run of the balance harness after the last one lands, not three). 208e starts with the recorder, not with a fix.

| Row | What | Kind | State |
|---|---|---|---|
| 208a | **Hamstring does too little for a card with no STAB** | One card number, or a design call | Open: three options |
| 208b | **Ratatoskr's frame (62 / 55 / 63) was priced for a third Energy he no longer has** | Species stats | Open: needs a number and a measurement |
| 208c | **Seed Bomb** (the same decision as 202d P3 in ticket 206, C1; do not build it twice) | One card number | Open: folded into 206 C1 |
| 208d | **Rename Corrosive Leak** | Name only | Open: needs a name |
| 208e | **The water stutter: build the frame recorder, then fix what it names** | Instrument first, fix second | Open: needs Henry to play once |

---

## 208a: Hamstring does too little for a card with no STAB

1. **The two cards (`src/engine/data/programs.json`).** Hamstring: element None, Common, 1 Energy, "20 power. Apply 2 Weakened." There is no Hamstring+. Thorn Tithe: Nature, Uncommon, 1 Energy, "30 power. Apply 3 Weakened." (Thorn Tithe+ is 30 power and 5 Weakened.)
2. **The rule behind "missing STAB" (`src/engine/combatUtils.ts`).** `STAB_BONUS` is 1.5 and applies only when the card's element matches the attacker's. `element: 'None'` never gets it (a `None` card used to get it from everyone by accident, and that was fixed). So a neutral card needs 1.5 times the printed power to do what the same number does on a card of the attacker's own element.
3. **The numbers** (Ratatoskr, attack 55, at the game's fixed level 15 with 15 IV, hitting a Huldra with defense 80, computed with the game's own damage formula): Hamstring **27**, Thorn Tithe **61**. Against a Kraken (defense 87): 25 and 58. Take the STAB away from Thorn Tithe and it still does 41, so the gap is about half printed power (30 against 20) and half STAB (1.5 times).
4. **Why it is built this way, and what that changes.** Hamstring is not a Ratatoskr card. It sits in no launch deck. A player gets it from the marketplace's reserved neutral slot (`NEUTRAL_UTILITY_IDS` in `speciesPools.ts`), which exists so that **any** party can buy a Weakened answer to Emberfall's WAR FOOTING Driver (`marketplace.ts`, `gym_emberfall: ['quench', 'sindris_forge', 'hamstring']`). Its comment says a neutral card gains no STAB anywhere, "which is the same reason it is priced as it is". So today's number is deliberate. Two more facts: `speciesPools.ts` already carries "FOR 162b: collection v2 has no replacement for `hamstring`. Give the neutral slot a v2 buff answer and these ids can leave", so Hamstring is a known leftover from collection v1; and the other neutral Attack cards are few (12 `None` Attack cards in the whole registry, most of them contact cards and the enemies' `baseline_*` cards), so a global "neutral attacks deal extra" rule would move cards nobody mentioned.
5. **What a change touches.** `hel_v1`'s deck holds Hamstring (`mingmingRegistry.ts`; ticket 78's note there measured Hamstring in that slot at 34.7% field against 46.7% for the second Eclipse it kept); the hand-built Tidewrack counter party in `handbuiltParties.ts` holds two; `skillsThatHitAreAttacks.test.ts` pins it as an Attack; `marketplace.test.ts` derives the neutral list from "element None and in no launch deck".
6. **Options (lean first).**
   - **A. Raise Hamstring's power, one number.** 20 to 30 makes a Nature Mingming's Hamstring (41) equal to a plain neutral Thorn Tithe, and a 30-power neutral card equal to a 20-power STAB card, which is the "make up for the missing STAB" Henry asked for. It still leaves Thorn Tithe (61) well ahead, which is right for an Uncommon with one more Weakened. Going to 45 would match Thorn Tithe's damage and beat an Uncommon with a Common; not recommended. Price it in `powerscale` first; re-measure `hel_v1` and Emberfall.
   - **B. Leave it** as the cheap, commitment-free answer. Henry's note then becomes "a Nature party will rarely buy it", which may be fine for a card whose job is to be bought for one fight.
   - **C. Do 162b instead:** design a v2 neutral buff answer and retire Hamstring. A design session, not an agent task.
7. **Test (if A).** Hamstring's printed text and its action both read 30; a pinned damage test for a neutral 30-power card against a 20-power STAB card of the same attacker is equal; `hel_v1`, the Tidewrack counter party and the Emberfall cell are re-run once with the rest of this ticket's number changes.
8. **Question for Henry.** A, B or C. If A, is 30 the number, or does he want it felt first?

## 208b: Ratatoskr's frame was priced for a third Energy he no longer has

1. **The facts (`mingmingRegistry.ts`).** Ratatoskr: HP 62, Attack 55, Defense 63, Energy 2, card draw 5; total 180. Fenrir: 66 / 91 / 69 (226). Kraken: 58 / 100 / 87 (245). The next lowest totals I could read are Skoll and Hraesvelgr at 220. I read Henry's "the other two" as the other starters (`INTRO_STARTERS`: Kraken, Fenrir, Ratatoskr). The midpoint of Fenrir and Kraken is 62 / 95.5 / 78: **his HP is already at it**; attack and defense are far below.
2. **How it got here.** Ticket 32 called attack 55 "the lowest of all 16 species, offset by 3 Energy and cardDraw 4". Ticket 136d (commit `b39c351`, ticket 136 closed 2026-09-04) took the third Energy back because at 3 Energy he ran **73% and 79%** against the field (v1 and v2), and the lever it chose was Energy, not the frame; the shipped package left him at **60.2 (v1) and 53.7 (v2)**. The frame was never revisited. So Henry's reading is correct: the reason for the low frame is gone. The reason for the removal is not: he was too strong.
3. **What a raise does.** Attack stat is `floor((2 * base + IV + 25) * 15 / 100) + 5`, so base 55 is a stat of 27. Base 75 is 33 (+22% damage on every attack), 85 is 36 (+33%), 95 is 39 (+44%). At the full midpoint his Seed Bomb for 10 cards goes from 411 to 594 against that Huldra, and his Thorn Tithe from 61 to 89.
4. **Who else changes.** Ratatoskr v1 is a member of Rootfall's boss team (`bosses.ts`, the "zoo" team, ticket 207), and Ratatoskr is one of the two launch species in the Nature biome's wilds. So a raise also hardens Rootfall's gym and every Nature wild that fields him, and it moves the opener numbers in `202d-v1-starters.md` (ratatoskr_v1: 94.0% fight one and 80.1% fight two on the walker's route; 77.0% and 82.3% in the night's configuration). No test pins his stats (the `ratatoskr_v1` mention in `powerscale.test.ts` is the roster order).
5. **Options (lean first).**
   - **A. Raise attack only, to about 75 to 85,** and defense a little (63 to about 70). Smallest step that gives the felt change; keeps him the weakest frame, which is what a 0-cost volume deck with 5 draw can afford.
   - **B. The full midpoint (62 / 95 / 78).** What the note literally says. It would make him the second-highest attack of the starters, on a species that already wins on card volume; the 3-Energy history says that is the direction that broke him.
   - **C. Leave the frame and fix the card** (208c). Seed Bomb is one card, the frame is every card.
6. **Measure before choosing.** Same harness as 136 and 202d: the field run for ratatoskr_v1 and ratatoskr_v2 at the candidate frame, the first-biome opener and wild (`_scratch_balance/202d-t4/cellsv.ts` has the cells script, `README.txt` the commands), and the Rootfall boss cell. Ticket 136's field band is 35 to 80; its numbers put him at 60.2 (v1) and 53.7 (v2) after the Energy change, so there is room above him, and the roster's top is nidhoggr_v1 at 76.8.
7. **Question for Henry.** A, B or C, and if A or B, whether to let the measurement choose the exact numbers within the band.

## 208c: Seed Bomb (the same decision as 206 C1 / 202d P3)

1. **The card.** Seed Bomb: Nature, Uncommon, 2 Energy, "20 power per card you played this turn" (`CARDS_PLAYED` scaler; the card counts itself). Seed Bomb+ is 30 per card.
2. **Henry's 500.** Ten cards is 200 power. At his attack of 27, with STAB, the damage is **411 against Huldra (defense 80), 389 against Kraken, 533 against Skoll**. So 500 is what the formula produces; the card is doing what it says. The same ten cards from a Fenrir-frame attacker (38) is 579 (+41%), from a Kraken-frame attacker (41) 624 (+52%), and with the 30-per-card Seed Bomb+ Rat does 617. Henry's "maybe that's his stats" is a real part of it: the same card from a starter-frame attacker does 41 to 52% more.
3. **What the balance tools already say.** `docs/balance/deck_report.json` (2026-10-09, `npm run balance:deck`): Seed Bomb is ratatoskr_v1's highest-damage card, played 65% of the time it is seen, 203 damage a play; the auditor flags it as `POWER_DIVERGENCE` (priced at 5, measures 77, "underpriced sleeper"). Ratatoskr v1 averages 7.6 turns a game in the deck report's matchups, so a 10-card turn is rare and a typical Seed Bomb is a 4 to 6 card turn (164 to 246 for Rat).
4. **202d P3 is the same question.** `research/202d-v1-starters.md`: Seed Bomb 20 to 25 moves the regular wild 75.0 to 76.3; **Seed Bomb 30 moves it to 83.8 and the opener to 79.0**; and its own note says "a number alone will not make it" against the Huldra v1 kit stall. The registry comment says the same: closing GOSSIP_NODE's opener "needs a real closer ... or `seed_bomb` castable earlier than 2 energy, a deck pass, and Henry's". It is open as 206 C1.
5. **Two things the earlier write-ups did not say.** (a) **Seed Bomb 30 collapses its own upgrade:** Seed Bomb+ is already 30, so P3 as written leaves the + identical to the base card; the + would have to move (for example to 40) and the 163a `+` registry would need the matching row. (b) **208b and P3 multiply:** both raise Seed Bomb, so doing both overshoots; pick one lever first and measure the second against it.
6. **Recommendation.** Do not change Seed Bomb in this ticket. Take 208b first (it fixes every Rat card, and Henry's own guess was "his stats"), re-read the 202d cells with the new frame, and let 206 C1 decide P3 on those numbers.
7. **Question for Henry.** None new; his note is evidence for 206 C1, and 206 C1 now links here.

## 208d: Rename Corrosive Leak

1. **Where it stands.** The card is `corrosive_leak` (Water, Rare, 0 Energy, Skill: "Poison yourself 2 stacks. Gain 1 Energized.") with a `Corrosive Leak+`. Every local and remote branch carries the old name; `new-cards` has no such card because it predates it. The history of the name is two commits (the card's first appearance and the `+` registry in 163a). The 195e-2 Norse names list (events, Draughts, event debuffs, Totems, 7 cards, 2 modifier lines) does not include it. Nothing is being renamed in another branch that I can find.
2. **Why it may have bothered Henry (a guess, not his words).** It reads like an attack on the enemy and sits beside Corrosive Bolt, an attack in the same Water and Poison family, but the card poisons **you** to gain Energy. Ticket 196 lists it as one of the "cards that cost you something", picked 0 of 10 times.
3. **What the rename touches.** The display name only; the id `corrosive_leak` stays, because saves, decks, `speciesPools.ts` (jormungandr_v1's pool), `bosses.ts` (a boss deck) and the tests key on the id. The strings to change: `programs.json` (the card and the `+`, which is a separate name field), and the design record's four files (`collection-v2/collection.py`, `collection.json`, `registry.json`, `upgrades.json`), regenerated by `npm run decks` then `python build.py`, which is already on Henry's chore list in 206. No test in `src` pins the name (only the design record and old saved scenario logs carry it), but run the gate.
4. **Candidates** (each checked against every card name in `programs.json`; none collides): **Swallow Brine** (what the card does: you take the poison, you get the Energy), **Bitter Gall**, **Serpent's Gall** (Jormungandr's pool, and snakes are poison). Avoid anything with "Draught", which is the name of a different thing in this game.
5. **Question for Henry.** The name, or "pick one of the three". Then it is a ten-minute change.

## 208e: The water stutter: build the frame recorder, then fix what it names

1. **What is already done.** Two stutter fixes are committed: `ccce4b82` (the particle layer draws straight onto its own canvas; the compositor is gone, the big-hit stutter) and `96a49bd7` (the run log is written once per quiet window, the whole-game slowdown). The write-up is the project doc `claude/vfx-stutter-2026-10-05.md`, which ends "If the run-log fix does not cure it either, add an opt-in frame recorder". Henry's note says water attacks **still** stutter, so something water-shaped is left, or the build he played did not have both.
2. **Measured 2026-10-09** on a production build of the stage sheet (`stage.html`) in headless Chromium in the cloud container, 1280 by 720, software raster, at the game's default battle speed (Showy): one cast per page load, a 5-second window, mean of four loads at device pixel ratio 1 and three at ratio 2. "Slack" is the milliseconds of frame time above 16.7 across the window; lower is smoother.

   | Cast | Slack, ratio 1 | Frames over 33 ms, ratio 1 | Slack, ratio 2 |
   |---|---|---|---|
   | No cast (control) | 10 | 0 | 18 |
   | Fire single (Fire Punch, 30) | 126 | 2.3 | 179 |
   | Nature single (Thorn Tithe, 30) | 201 | 4.5 | 257 |
   | **Water single (Ink Stream, 33)** | **110** | 1.5 | **107** |
   | **Water single (Hydro Blast, 120)** | **97** | 2.5 | **112** |
   | Fire spread (Wildfire, 45) | 239 | 4.8 | not run |
   | Nature spread (Crippling Vine, 20) | 164 | 2.3 | not run |
   | **Water spread (Tidal Wave, 55)** | **80** | 2.3 | **107** |

   Water is no worse than fire or nature at either ratio, single target and spread, small hit and big hit. Against nature and against both spreads the gap is clear; against the fire single-target cast (126 against 97 to 110) it is inside the run-to-run noise of four loads. The jet and the wave draw three stroked paths and some non-additive drops, which is more vector work than the flame beam's three straight lines, and it still measures lowest. **So the particle layer is not the water problem.** `castWater.mp3` is 14 KB against `castFire.mp3` at 14 KB, so sound size is not it either. The Water biome's backdrop is the same static art as the others (`BiomeBackdrop.tsx`).
3. **What that test cannot see, and so what is still open.**
   - **An enemy's turn.** The stage sheet's End Turn button does not run one (confirmed: the screenshot after nine seconds still says Turn 1). The Water species are Kraken and Jormungandr, so in a Nature starter's run **most water attacks Henry sees are likely the enemy's**, and the enemy's turn is also when the AI plans its next move on the main thread. This is the first suspect, and it is untested.
   - **Sound** (the browser blocks audio in a headless run), **a real GPU**, and **the live game's store** with the run-log and autosave paths.
   - **Which build.** The 10-05 write-up asked Henry to rebuild the desktop app and play before calling the run-log fix done; the notes do not say which build the water stutter was seen on.
4. **Row 208e-1: build the frame recorder (opt-in, no gameplay change).** Small single-purpose modules, composed (Henry's rule): a **`FrameSampler`** (frame deltas plus the browser's long-animation-frame entries), a **`CastTagger`** that stamps each long frame with what was in flight (card, element, whose turn, battle speed, whether the AI was planning), a **`HeapDomSampler`** (a slow periodic read), and a **`RecorderExport`** (copy to the clipboard). Each takes its inputs as arguments; a thin **`FrameRecorder`** composes them and is switched on by a setting or a key. Off by default and free when off. The long-frame tagging is the part the 10-05 plan did not have and the part that answers "water".
5. **Row 208e-2: one playtest.** Henry plays one fight against Water enemies (a Nature run into a Water gym, say) with the recorder on, stutters on purpose, and pastes the export.
6. **Row 208e-3: fix what it names.** Written once the export says what it is. If it is the AI's planning, the fix is to plan during the player's idle time or to time-slice it; if it is a draw cost, the fix is in `src/ui/vfx`; if it is audio, in `src/ui/audio`.
7. **Questions for Henry (they cost nothing and may settle it).** Is it the **enemy's** water attacks, yours, or both? Do the enemy's fire and nature attacks play smoothly in the same build and the same fight? Which battle speed? Was the desktop app rebuilt after `96a49bd7`?
8. **Not committed.** The measuring scripts (a small static server, a Playwright script that casts a card and records frame times) are in the session's scratchpad. They could be committed as `scripts/vfx-perf.mjs` like the 10-05 write-up suggested; say so if wanted.

---

## Decisions for Henry

| # | Decision | Options (lean first) | Row |
|---|---|---|---|
| 1 | **Hamstring** | A: 20 to 30 power (re-measure hel_v1 and Emberfall) · B: leave as the cheap neutral answer · C: retire it for a v2 neutral buff answer (162b, a design session) | 208a |
| 2 | **Ratatoskr's frame** | A: attack to about 75 to 85 and defense to about 70, measured · B: the full midpoint (62 / 95 / 78) · C: leave the frame, change Seed Bomb | 208b |
| 3 | **Seed Bomb** | Leave it here; decide 202d P3 in 206 C1 after 208b is measured. If P3 goes ahead, Seed Bomb+ has to move too | 208c / 206 C1 |
| 4 | **Corrosive Leak's new name** | Swallow Brine (lean) · Bitter Gall · Serpent's Gall · your own | 208d |
| 5 | **Water stutter** | Build the recorder (lean), then one playtest; or answer the four questions in 208e-7 first | 208e |

## Resolution

Not started.
