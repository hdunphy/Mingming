# Code review — 2026-09-26

Four reviewers each took one area: the battle engine, the run layer and sim parity, the AI and performance, and the UI. Nothing below has been fixed yet, except the two items marked FIXED, which were defects in the 09-25 rows themselves. Each finding says how it was checked:

- **probe**: a throwaway test reproduced it.
- **read**: confirmed by reading the code.
- **spot-checked**: I re-read the lines myself.

## A. Engine and AI bugs that change how fights play (they move the numbers)

| # | Finding | Where | Checked |
|---|---|---|---|
| A1 | **The AI's beam ignores its own width.** Below the first play, `explore = [...].slice(0, BEAM)` uses the process default, which is 0 in the game, instead of the fight's `beam`. Every wild and elite enemy therefore searches about one play deep. Ticket 144's "beam 16 = beam 8" result, its −12.5 pts measurement, and ticket 39's beam-8 timing were all measured on this bug. With `.slice(0, beam)`, beam 8 picked the same action as beamless on 9 of 9 sampled decisions and ran 2.4–7.5× faster. | `ai/TacticalAI.ts:589` | probe + spot-checked |
| A2 | **The AI reads the real draw order and RNG seed while planning the same turn.** A simulated draw pulls the actual next card. Shuffling only the drawpile changed 7.4% of enemy decisions. This breaks the "the AI must not read draw order" ruling, which ticket 144a applied only to the hand. | `ai/TacticalAI.ts:546`, `deckLogic.ts` | probe |
| A3 | **The lookahead scores each candidate against different random draws.** Using the same draws for every candidate changed 14% of lookahead decisions. About 40% of "the lookahead changed the pick" was noise. | `ai/TacticalAI.ts:959` | probe |
| A4 | **The AI prices Burn as if it decays one stack per turn, but Burn is permanent.** It is undervalued 2.5× at 1 stack and 1.14× at 4. The pricing test does not cover Burn. | `ai/TacticalAI.ts:110–129` | read |
| A5 | **The AI's hand value uses slot 0's energy.** At 3v3, from the third card on, cards are priced at 10%, so draws look almost worthless. | `ai/TacticalAI.ts:79–96` | read |
| A6 | **Real attacks never chip or wake Asleep.** Every attack's damage is dispatched as `sourceId: 'SYSTEM'`, which is exactly the id the Asleep rule skips. Ticket 48's rule ("loses 1 stack per incoming attack") is dead. | `resolutionEngine.ts:48`, `effectHandlers.ts:169` | probe + spot-checked |
| A7 | **The player's turn 1 skips the pre-turn step the enemy gets.** This is the same seam as the double-hand bug. The player's turn-1 `onTurnStart` hooks never fire; for example, Ymir has no Bark Shield on turn 1. The opening draw also counts downed gauntlet members, so a party with one member down opens on 10 cards. | `data/battleFactories.ts:359–370` | probe |
| A8 | **Reshuffle hooks are credited to party slot 0.** Valkyrie's REBIRTH_CYCLE only works when she sits in slot 0. | `resolutionEngine.ts:572, 592` | probe |
| A9 | **Replays fire both branches of a conditional card.** This affects Reprogram, the Echo macro and VALHALLA. Reprogram of equilibrium gave Strength **and** a heal. | `actions/ActionExecutors.ts:1037, 1108` | probe |
| A10 | **The 50% HP split fires both branches between 50% and 51%.** The pairs are authored `GT:50` / `LT:51`. | `ConditionValidator.ts:235` + card data | probe |
| A11 | **Sky Burial tokens cost 0 and ignore stun and sleep.** The generator hardcodes cost 0, and the tokens carry no constraints. | `effectHandlers.ts:735` | probe |
| A12 | **Death processing can run on a living unit or run twice.** Poison and Regen in the same tick kill and revive a unit, yet it is still processed as defeated. A dead caster hit by a riptide hook is processed again, so the bereavement rally grants Energized twice. | `battleReducer.ts:1141`, `effectHandlers.ts:265` | probe |
| A13 | **The seeded RNG has a period of only 7,298.** Every seed tested falls into the same cycle after about 1,000 draws. Fixing it re-rolls every seeded result. | `core/PRNG.ts:36–66` | probe |
| A14 | **`crypto.randomUUID()` is used inside the engine.** It generates status ids and generated-card ids. Replays and state equality break, and it blocks cheap state hashing in the AI. | `StatusBehaviors.ts:101`, `effectHandlers.ts:736` | read |

## B. The simulations measure a different game from the one players get

| # | Finding | Where | Checked |
|---|---|---|---|
| B1 | **The walker's gym gauntlet never carries HP between fights.** Fights 2 and 3 start at full HP and downed members come back, so walker gym-clear rates read high. | `debug/balance/runWalker.ts:582–616` | read |
| B2 | **Patches never reach any sim fight.** The scenario format has no patches field. The walker pays for Amplifiers, and 163e's patch take-rate sweep measured a patch that does nothing. | `scenarios/scenarioSchema.ts:378` | read |
| B3 | **The run gate plays wild and elite cells beamless**, while the game uses beam 8. | `debug/balance/runGate.ts:1503` | read |
| B4 | **The beam also narrows the player's AI in the walker**, because the beam is not tied to one side. | `ai/TacticalAI.ts:861` | read |
| B5 | **The walker's economy leaks.** Blueprint purchases are never charged (the negative scrap is refused), recruits are free, any blueprint recruits any species, and Driver stakes are never collected. | `runWalker.ts:672, 722, 777` | probe (a) / read |
| B6 | **Stat jitter shifts the authored boss IVs**, which are meant to be fixed. The walker's rewards also ignore the visit count. | `runBatch.ts:450` | read |

## C. Plain bugs with no balance effect

| # | Finding | Where | Checked |
|---|---|---|---|
| C1 | **"Abandon run" on the map ends the run on one click.** The confirm step exists but is only wired in the gym header. | `ui/screens/RunScreen.tsx:428` | probe + spot-checked |
| C2 | **Battle hotkeys stay live under Settings.** Space on a Settings button ends your turn, Z/X/C fire macros, and the enemy AI keeps playing underneath. | `ui/components/BattleArena.tsx:280–432` | probe |
| C3 | **Space after VICTORY still ends the turn on the finished board.** An enemy-turn banner lands over VICTORY, and the gauntlet then reads HP from after that end-turn. | `BattleArena.tsx:282`, `battleReducer.handleEndTurn` | probe |
| C4 | **"Wipe save" doesn't wipe run history**, because the run log writes it back one microtask later. A wipe done mid-fight also leaves the fight running. | `ui/settings/wipeSave.ts`, `runLogMiddleware.ts` | probe |
| C5 | **Swapping or benching the starter breaks the deck floor.** The starter owns the 3 generics, so a deck of 8 can drop to 5. | `run/createRun.ts:218`, `runSlice.ts:543, 572` | probe |
| C6 | **The once-a-run `+` market card can be bought again after each paid refresh.** Its id changes with the refresh count. | `run/marketplace.ts:787, 909` | probe |
| C7 | **The `buyMarketCard` reducer checks only the deck, not the collection.** | `ui/store/runSlice.ts:377` | read |
| C8 | **Toggling particles mid-fight leaves the particle canvas detached**, so no particles show for the rest of the fight. | `ui/vfx/ParticleLayer.tsx:177` | read |

## D. Performance

| # | Finding | Gain |
|---|---|---|
| D1 | The run log re-reads, re-validates and rewrites every stored transcript on nearly every dispatch: each card select, wheel tick and AI step. That costs 2–5 ms per dispatch, and the cost grows over the run. | Throttle it to meaningful rows. This removes most of the cost. |
| D2 | `ParticleLayer` reads localStorage on every render. | Read it once at mount. |
| D3 | AI: the hook lookup is 39% of CPU, and 4.9M of those lookups are for phases no unit hooks. | Cache per entity: 1.15–1.3×, with identical results. |
| D4 | AI: a transposition table on the search's inner nodes (needs A14 first). | 1.05–1.8×, with identical results. |
| D5 | AI: Side/All cards are tried against every target. | About 6%. |
| D6 | AI: log copies still happen in simulated end-turns. | Small. |
| D7 | **The gym boss's 56× turn time.** The only lever that closes most of it is a *working* beam (A1) or a time budget. Exact optimisations D3–D6 total about 1.3–2.3×. | — |

## Fixed tonight (defects in the 09-25 rows themselves), commit `814bfc5`

- The spaced sounds let `kill`/`hitBig` and multi-hit steps jump the queue. They now take slots in order, and a ducking cue is never dropped. Mute and Combat Sounds are re-checked when a delayed cue plays.
- Escape on the discard list also opened Settings, and Enter re-clicked the focused pile. The list now consumes Escape in the capture phase, and a mouse click blurs the pile.
