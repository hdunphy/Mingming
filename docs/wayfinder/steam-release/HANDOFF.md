# HANDOFF — steam-release map (keep this current every session)

**The line-ending sweep is fixed for good — `.gitattributes` normalizes everything and `_WARNING-line-endings.md` is gone (ticket 02). Stage explicit paths only. One writer in the tree at a time — Henry sequences agents; if the tree shows fresh engine/sim changes you did not make, STOP and ask.**

**Git on this mount, the short version.** It cannot `unlink`, which has three consequences worth knowing before you fight them: `git checkout` / branch switching **does not work** (in-place `git show HEAD:<path> > <path>` is the restore fallback); `.git/index.lock` and `.git/HEAD.lock` survive every command, so `mv .git/*.lock _to_delete/git-locks/` before each git call and ignore the `tmp_obj_*` warnings; and files are moved to `_to_delete/`, never deleted. `.github/workflows/*.yml` is additionally **write-protected against `device_commit_files`** — write those through `device_bash` instead. Long gates (`tsc -b`, `vitest run`, `npm run balance`) exceed the device VM's 45-second kill; tarball the tree to a cloud container and run them there. `git add --renormalize -u .` over the whole tree is one of the commands that silently dies at 45 s — chunk it 50 paths at a time.

*Last updated: 2026-08-30 (agent sessions: 02, 03, 04, 26, 06, 21, 23, 20, 09-15, 18, 19, 22, 24, 36, 55, 31, 57, 59, 61, 67-build, 67-legion, 68-legion, 42-legion, 70-measure, 71-legion, 72-legion, 73-legion). **State: 73 tickets, 40 closed.** The critical path is complete, the run's four edit surfaces are built, ticket 60's enemy ladder is in, and **ticket 68 rebuilt the gym boss**. **THE BOSS WALL IS GONE — AND THE FIGHT OVERSHOT.** Emberfall's boss goes **0/60 -> 48/60 (80.0%) prepared**, 39/60 (65.0%) control, against a 60% target; its three fights now read **83.3 / 90.0 / 80.0** where they read 68.3 / 81.7 / 3.3. The relics are retired as a concept: enemy passives are **DRIVERS**, side-scoped, additive to a member's own OS, on the same machinery as the player's. For the PREPARED player the other two bands still grade (Q3): **wilds 95.7% vs 95 - PASS. Elites 73.7% vs 75 - PASS.** **WAITING ON HENRY: the boss is now 15pt ABOVE the target the prepared arm grades.** Nothing was turned - the unturned levers are `BOSS_IVS` (ruling 7's re-check against the new Driver, NOT yet run), WAR FOOTING's numbers, the authored composition, and the 60% target itself, which was set against a boss nobody had designed. Also worth a decision: **WAR FOOTING's turn-4 escalation barely fires** (fights average 4.1 turns). Full write-up: [research/67-gate-validity-and-the-power-ceiling.md](research/67-gate-validity-and-the-power-ceiling.md) SS13. **Tidewrack and Rootfall are NOT authored** (68 ruling 6) and still field ticket 18's `boss_relic_*` formula boss at 0/60 - one gym per design session. **ALSO WAITING ON HENRY: the Q2 anti-boss card design pass** (deck-archetypes, 24-36 cards - the fight it was aimed at no longer exists; the handover report is [research/68-what-the-boss-redesign-asks-of-the-cards.md](research/68-what-the-boss-redesign-asks-of-the-cards.md) and it asks him three questions before the pass is worth starting), **57, 31, 25.** Blocked on deck-archetypes 109: 16, 17, 40 - **109 is the single highest-leverage ticket on the board**, nine steam-release tickets sit behind it. **OPEN REQUEST TO DECK-ARCHETYPES: ticket 22** (142 of 216 card descriptions print their power figure) and the anti-boss power tier. **Ticket 69 CLOSED + ROUND TWO APPLIED: the pick pool is your ELEMENTS now, for the shop AND for drops** (Henry 2026-08-28, closing economy-session's last open item) - a solo party's pool goes 5 -> 33 cards, the stall stocks 7 (five pool, one reserved neutral, one stranger), and the calibration-content exclusion moved into `RewardSystem.isRewardable` because an element pool would otherwise offer the control species' `baseline_*` cards to everyone. **Ticket 34 CLOSED** (theme tokens, 31 SVG icons, the winding-route map, ticket 66's card chassis, 26 screens x 2 resolutions in `research/34-screens/`); the battle-HUD glyph vocabulary and the engine's combat-log emoji remain, excluded by name from the emoji sweep so the exclusion list is the to-do list. **`scripts/debug-generate.ts` deleted — it was failing `eslint .`, i.e. CI has been red on HEAD since ticket 55; every session missed it by linting a drifted cloud copy.** **New tool: `npm run decks`** writes `docs/balance/deck_browser.html`, a standalone at-a-glance reference for all 32 decks that badges its own numbers stale by registry hash. Suite green at 132 files / 1849 tests. **LINT IS BLOCKING IN CI as of ticket 55** - the tree is at 0 errors, so a new one fails the build.** **TICKET 42 CLOSED - THE DESKTOP APP EXISTS AND THE SAVES ARE FILES.** Henry ruled Electron, no code signing, Windows + Linux, placeholder icon. `desktop/` is an Electron wrapper (`main.cjs` + a `contextBridge` preload, synchronous save IPC); saves are one atomic JSON per key under `userData/saves/`, which is what Steam Auto-Cloud is pointed at in ticket 43 - a path rule, no code. **Ticket 23's seam held: not one existing save caller changed**, the swap is one line in `main.tsx`. **Ticket 59's other half landed with it** - run logs go to `userData/run-logs/` and the settings screen names and opens that folder. **`npm run desktop:build`** (a Node script, because Henry is on Windows; `-- --linux` / `--win` / `--dir`). Proven on the packaged **Linux** binary over CDP under Xvfb: mounts, `localStorage` empty, writes its slot index and ranch save as files, and **relaunches straight to the ranch with the blueprint intact**. **WINDOWS WAS BUILT BUT NOT RUN** - real PE32+ exe with the icon embedded, but the NSIS installer needs Wine to cross-build, so **Henry should run `npm run desktop:build -- --win` on his own machine** (the zip is 146 MB, past what a session can hand over) - that is the one outstanding verification on 42. Two ticket errors flagged not faked: the icon is a **PLACEHOLDER** (34 made no logo - it is commissioned), and **`release-check` does not exist**, it is ticket 40's. Suite green at **133 files / 1863 tests**. **TICKET 70 IS MEASURED AND THE GRILLING IS READY** (60 battles, `npm run balance:snowball`): **P(win | scored the first KO) = 91.7%**, comeback rate **8.3%**, and the loser loses all three members in EVERY decided battle. The number that changes the framing is **66.9% of the average battle happens AFTER the first KO** (4.3 of 6.5 turns) - not a fast rout but a long decided one, which is an experience problem rather than a balance one. Overkill is **17.8 dmg/battle = 7.4% of a side's pool**, so the incentive is INVERTED: Henry declined 40 wasted damage (7.4% of a health bar) and gave up a kill worth 91.7% of the game. **Line 4 is a clean null - P(win | higher STARTING HP) = 50.0% across a real spread (pools 217-312, median gap 11.2%, max 35.9%) - so Henry's second, unconfirmed issue can CLOSE WITH NO CHANGE**, limit stated (starting HP, not a mid-fight lead). Hypothesis for Q3, not a finding: `panel-ramp` is in 4 of 5 comebacks vs ~1.7 expected, i.e. a comeback mechanism may already exist and be called sustain. **Design-agent handover written** ([research/70-what-the-snowball-asks-of-the-cards.md](research/70-what-the-snowball-asks-of-the-cards.md)) and it found three things the ticket did not have: **the KO cliff is TWICE what ticket 70's engine facts state** - `battleReducer` also cuts the hand (`sum(cardDraw over ALIVE) - alive + 1`), so -33% energy and -28.9% cards compound to **-52.5% of a turn from ONE death**, within a point on all six comps, which is what 91.7% is made of; **`Overkill Recovery` and `First Blood` are ruled Driver names that collide with Q1/Q2** - Overkill Recovery is *enemy faints -> party heals*, a snowball AMPLIFIER rather than the refund its name implies; and **Q2a is not a do-nothing option**, it is ticket 16 (Bulwark Reflex), blocked behind deck-archetypes 109 - so **109 is on the critical path for the snowball answer too**. **ALL THREE GYMS ARE AUTHORED AND THE RELICS ARE DELETED (tickets 71 + 72).** Tidewrack fields jormungandr_v1 + kraken_v1 + skoll_v2 under **TIDAL SURGE** (every 10 cards this side plays, 10 power to the enemy side); Rootfall fields huldra_v2 + ratatoskr_v1 + jormungandr_v2 under **ROOT ROT** (every Poison application lands 1 more). `boss_relic_*` is GONE - the firmwares, `bossFirmwareFor`, the rolled branch, and the `battleFactories`/`firmwareRegistry` carve-outs. **The deletion rests on an invariant that is now a test**: every `GYM_REGISTRY` entry must have an authored trio + Driver, or a future gym would field an EMPTY boss rather than crash. **New hook capability: a SIDE counter scope** (`resolveSideCounterKey`) - OWNER would give each member a private count and GLOBAL would let the player's cards charge the boss's Driver. **TWO SILENT TRAPS CAUGHT, both by end-to-end probes rather than structural tests: (1) a COUNTER hook action with no `target` is silently skipped by `HookFactory.executeActions`** - TIDAL SURGE looked perfectly healthy and its counter never moved; **(2) a status-applying hook on `onStatusApplied` RE-ENTERS itself** ~12 deep (the resolution cap, not a design), so ROOT ROT carries a SIDE-scoped re-entry flag and measures at exactly +1. **A live defect fixed in ticket 67's isolation lever**: `relics: 'off'` also swapped the boss's OS for `availableOS[0]`, which with authored gyms would have replaced `skoll_v2` with `skoll_v1` and changed the DECK inside a one-variable arm; it now drops only the Driver. **OUTSTANDING: the three-gym table the HELD gauntlet-target ruling waits on** - six arms of 60 with the Rally live, INCLUDING an Emberfall re-measure (its 80.0/65.0 predate both the merge and the Rally); ~4 hours, run lines in ticket 72, must run on Henry's machine. Suite **142 files / 2015 tests**. Earlier: **THE BEREAVEMENT RALLY SHIPS (Henry ruled Q2b, 2026-08-29): on any KO every surviving member of that side gains one `Energized`**, both sides, in `effectHandlers.applyBereavementRally` off `checkDefeat`. Comebacks **8.3% -> 16.7%** with length HELD at 6.5 - Henry's stated target. **Q3b ruled OUT by measurement** (cards are a null). **THIS INVALIDATES EVERY MEASURED NUMBER IN THE REPO**: `deck_grid.json` (960 cells), the Emberfall boss figures (67 SS13 / 68), and the snowball baseline itself - a fixed seed flipped 7 turns/PLAYER to 6 turns/ENEMY. **OUTSTANDING: a no-arm `npm run balance:snowball -- --iterations 1` on the new engine should read ~16.7%; not yet run.** `--energized` now stacks ON TOP of the shipped rule. Ticket 70 stays OPEN - Q1/Q2a/Q2c/Q2d/Q3a/Q3c have no numbers. Suite **140 files / 2001 tests**, nothing broken. Earlier: **SIX ARMS RUN (360 battles): THE KO CLIFF BITES THROUGH ENERGY, NOT CARDS.** The card arms are a clean NULL - `draw once` granted 206 cards and hit the baseline EXACTLY (8.3%), `draw standing` granted 836 and moved one battle (10.0%), paired flips **3:3 and 4:3** (symmetric churn, not an underpowered signal), and **combining with energy made it WORSE both times** (16.7% -> 13.3%). The bereaved side is **energy-constrained, not card-constrained** - corroborated by overkill rising with energy (17.8 -> 22.2) but not cards (17.8 -> 16.8). **This CORRECTED the design-agent report and the ticket**, which had called the card half *"the larger half"*: larger arithmetically, inert behaviourally - correction banners left in place rather than reworded. **Henry's target is 15-20% comebacks with length HELD at 6.5, and exactly one arm meets both: `energized once` (16.7%, 6.5 turns, 4.3 after KO), p = 0.125** - `--iterations 3` on that arm would settle the significance. Q1/Q2a/Q2c/Q2d/Q3a still have no numbers. Earlier: **Q2b MEASURED AND IT WORKS** (Henry's ask, 2026-08-29): Energized-on-death takes the comeback rate **8.3% -> 16.7% (`once`) -> 20.0% (`standing`)**, and the PAIRED test is what makes n=60 readable - **McNemar `standing` p = 0.039** (8 flips to a comeback, 1 away) where the unpaired test on identical data gives p = 0.114. `once` is 6:1 the same way at p = 0.125, underpowered not null. Arms verified live (269/869 stacks; a zero-grant run reports VOID, not null). **`standing` also made fights SHORTER** (6.5 -> 6.0t) - it improves the experience problem too - **and made overkill WORSE** (17.8 -> 22.2), so **Q1 and Q2 are coupled**. Both arms repair only the ENERGY half of the cliff; the CARD half is untouched. Built as a HARNESS arm - `battleReducer` is bit-identical. **NEW TICKET 71: the launch triangle** - 21 of 120 EA matchups are 0% or 100% (17.5%, vs 7.1% roster-wide), verified independently from the post-merge grid; **3 of the 21 are SAME-element**, so the merge report's "the lever is the 1.5x multiplier" is right for 18 and wrong for three. **Do not touch `TYPE_CHART`** without a ruling. **THE BALANCE MERGE (48bc586) IS GATE-GREEN ON HEAD** - tsc -b, both project tsconfigs, eslint 0, 138 files / 1984 tests, vite build. Two corrections to its report: **CI DOES typecheck `src/`** (`tsc -b` catches a planted error; only the bare `tsc --noEmit` is blind, so ticket 03's gate already covers it), and `liveness.ts`'s header still says `npx tsx` - **tsx is not a dependency**, use `npx vite-node src/debug/balance/liveness.ts`. **STILL OWED: ticket 68's SS13 re-measure.** The merge moved the engine under those numbers (t116 buffs kraken_v1 +20 at 3v3 and Water is Emberfall's counter-element; t123 nerfs stampede/serpents_coil/seed_bomb_v2 - t115's cards are Ice and do NOT reach the launch set), so 80.0%/65.0% are stale in an unpredictable direction. **PROCEDURAL, LEARNED TWICE: an agent's cloud container reclaims background processes during idle gaps** - two long runs died with nothing to show. Long measurements run on Henry's machine, and every long CLI needs an incremental `--out` (Node BLOCK-buffers stdout to a pipe, so `> file.txt` loses everything when killed). **THE BIOME WALK ORDER IS INVERTED (Henry ruled ticket 09's rule 4 the other way, 2026-08-30).** A region is `[gym element, the element that beats it, the element that beats THAT]` - Tidewrack **water-nature-fire**, Emberfall **fire-water-nature**, Rootfall **nature-fire-water**. The gym's element is the FIRST biome now, not the last. The party is picked AFTER the gym, so the offer invites a counter-pick, and that pick now walks **win / neutral / lose / then the boss it was built for** instead of possibly meeting its own predator at depth 1. Henry: *"it felt bad to go after the water boss with a nature mingming and get wiped in biome 1 by fire, or have to build up your blueprints in one boss just to lose them come to the boss you want to battle."* The thematic cost - **the leader no longer stands in a biome of its own element** - was ruled on knowingly. The `OfferDirection` roll is **DELETED**, and with it ticket 09's flagged "an offer screen has only two possible shapes": three gyms, three elements, three openings, by identity. **TWO SILENT BREAKS FELL OUT, neither of which threw: (1) `runGate.targetElementFor` aimed the prepared arm at `biomes[2]`**, which after the reorder is *the element the leader beats* - it reads `offer.gym.element` now, because an index is only ever incidentally the leader; **(2) the CONTROL arm alternated the ORDER OF A FILTERED LIST rather than the matchup**, which cancels only while the target is held fixed - it is not, so the control's neutrality was a coin flip that could tilt a band by points without failing loudly. **EVERY MEASURED WILD/ELITE BAND IS NOW STALE** (the element at a given depth moved, and so did the control lineups) - the three-gym table outstanding on ticket 72 should be run under this rule. **Ticket 71 (the launch type triangle) is RENUMBERED to 73**, freeing 71/72 for the Tidewrack and Rootfall builds; it is still open and awaiting Henry. Suite **142 files / 2016 tests**, eslint 0, tsc clean. **THE THREE-GYM PREPARED TABLE IS IN (Henry asked directly, 2026-08-30) AND TIDEWRACK IS A 37-POINT OUTLIER.** n=30 on the boss cell, prepared arm, all three authored bosses under the Rally and the new walk order: **Emberfall 83.3% (25/30), Rootfall 76.7% (23/30), Tidewrack 23.3% (7/30)** against a 60% target. Tidewrack's 95% interval (11.8-40.9) overlaps NEITHER of the others, so the separation is solid even though each figure is under-sampled. **TIDAL SURGE IS NOT THE WALL**: `--boss-relics off` reads 26.7%, paired, **exactly one discordant pair in thirty battles, McNemar p = 1.000**. It is not broken - instrumented, the boss side plays 12-27 cards so the 10-card threshold trips once or twice a fight - it just pays 10 power into a fight the boss is already winning by ~240. **Do not tune the Driver believing it is the wall, and note that lowering Tidewrack's damage makes the Driver a LARGER share of the fight.** **The wall is damage RATE: Tidewrack 55.8/turn vs Emberfall 32.3 and Rootfall 27.6** (1.7x and 2.0x), deleting a ~240 party pool in two to three turns; in the losses the player gets 12-21 cards played against 28-37 in the wins. Un-separated suspects: **kraken_v1's +20 at 3v3** (merge t116) and **skoll_v2's Strength scaling**, which lands 1.5x into two of the player's three bodies by design. **AND THE COUNTER-PICK MAY BE A TRAP**: control (2 Water + 1) beats prepared (2 Nature + 1 Water) **40.0% to 23.3%**, paired 7 flips to 2, **p = 0.180** - underpowered, not null, the same shape ticket 70's arms had before they proved real. `--iterations 90` on both arms settles it and it is the one number worth the battles before a ruling. **Emberfall's 83.3% is indistinguishable from ticket 68's 80.0%** - that number survived both the merge and the Rally. The prepared arm brings **exactly the 2-1 Henry specified** on all three bosses with the single filler always answering the boss's odd member; that is a coincidence of the arm's roster arithmetic and ruling 3's boss heuristic, now pinned as a test. Write-up [research/72-the-three-gym-prepared-table.md](research/72-the-three-gym-prepared-table.md), raw runs in `research/72-runs/`. **HENRY OWES THREE RULINGS: the gauntlet target itself (two bosses ~20pt above it, one 37pt below, and it was set against a boss nobody had designed), which knob on Tidewrack, and whether the counter-pick inversion is a bug in the incentive or a feature of a boss built to punish preparation.** **STILL OUTSTANDING: the six arms of 60 over the FULL gauntlet band** (all three fights, not just the boss) that the HELD ruling was specified against. **New: `--out <file>` on `balance:run-gate`** - Node block-buffers stdout to a pipe, so `> file.txt` on an hours-long run loses everything if it is killed; `--out` appends per line. Suite **142 files / 2017 tests**. **THE 60% TARGET IS FOR CLEARING THE GAUNTLET, NOT FOR WINNING ONE FIGHT (Henry, 2026-08-30) - AND SEVERAL SESSIONS INCLUDING THIS ONE GOT IT WRONG.** A gauntlet is three fights on one HP pool, so the per-fight line is `0.60^(1/3)` = **84.3%**. **Emberfall's 83.3/90.0/80.0 compound to exactly 60.0%** - it is CALIBRATED, never "20pt too easy", and the HELD ruling that the boss is "15pt ABOVE target" rests on the same bad comparison and must be re-read. Against 84.3%: **Emberfall 83.3% IN BAND, Rootfall 76.7% 7.6pt under with no drafted cards, Tidewrack 23.3% 61pt under.** `gauntletCompound()` already computes the right number; only the band VERDICT compares the pooled per-fight rate to 60 and prints FAIL on a calibrated gym - **proposed but NOT changed, because it moves every historical verdict.** **THREE HARNESS LIMITS FOUND, all structural: (1) `drawFromElement` picks every slot as `firmwares[index % firmwares.length]` with the SAME index, so an arm is all-v1 or all-v2 and a MIXED-FIRMWARE TEAM IS UNREACHABLE**; (2) `deckFor` deals the 18-card START deck only - no drafted picks, no market buys, no removals; (3) **ticket 69's ruled anti-Tidewrack counters did not exist.** So every earlier "prepared" number measured type preparation and nothing else. **RIPTIDE AND SHORT_CIRCUIT ARE NOW PRINTED** (Henry: *"riptide and short circuit need to be added"*): both 2e None Rare daemons in `MARKET_NEUTRAL_UTILITY` - riptide 8 power per enemy card PLAYED (breadth), short_circuit 15 power per off-phase enemy draw (depth). **Powers are LEGION's numbers**: first written at 5 and 8 and measured as ZERO damage, because the formula resolves at ~`power/4` and anything under ~8 power floors to nothing - **`feedback_loop_daemon` (5) and `hoofbeat_daemon` (8) are at or under that floor and both descriptions overstate their hooks (7 vs 5, 10 vs 8)**; flagged, not fixed. **A FOURTH SILENT-FAILURE CLASS FOUND AND CLOSED: `initDaemonHooks` builds from a HAND-MAINTAINED ALLOWLIST**, so both cards shipped printed, hooked, schema-valid and completely INERT with nothing thrown - `daemonCoverage.test.ts` now fails for any Daemon whose hook ids do not resolve. **NEW: `--handbuilt <id>`** on `balance:run-gate` (`handbuiltParties.ts`) substitutes ONLY the lineup, party and deck, leaving offer/seed/graph/node/boss/Driver/IVs/AI identical, so a designed deck is directly comparable to the arms. **THE DESIGNED DECK LOST HARDER: 13.3% (4/30)** against the arm's 23.3% and the neutral control's 40.0% (paired vs control, 10 flips to 2, **p = 0.039**). **Diagnosis is one number: the winning deck deals 58.6 damage/turn, the designed deck 28.6.** The boss deals MORE per turn against the mitigation deck (73.3 vs 55.0) because **killing a body is the only mitigation that works** - Sharp/Weakened pay 1 power a stack against hits printed at 33-105. The two new cards were played **0.6 and 0.1 times a battle**: 2e daemons cannot pay back inside a 3.1-turn fight, which is **a costing problem, not a wiring one**. Deck size is arithmetic too: a 3-member party draws 7 cards a turn, so a 3-4 turn fight sees ~25 cards and anything past ~26 is dilution. **HENRY'S CALLS: (a) re-cost the counters to 1e or give them an immediate effect, (b) bring Tidewrack's 55.8 dmg/turn down until an installed answer has time to pay, (c) whether the gate should grade the compound, (d) whether the harness should field mixed-firmware teams.** Not yet run: a designed RACE deck (the 73% control deck is the existence proof). Write-ups: [research/72-the-three-gym-prepared-table.md](research/72-the-three-gym-prepared-table.md) and [research/72-the-handbuilt-tidewrack-arm.md](research/72-the-handbuilt-tidewrack-arm.md). Suite **144 files / 2027 tests**. **CARDS_DRAWN_TRIGGERED IS NOW SCOPED TO THE MINGMING (Henry ruled it 2026-08-30: *"it should be scoped to the mingming"*).** Found by asking where the winning deck's damage came from. The scaler read `state.nonNaturalCardsDrawnThisTurn` - **a single number on the battle state, not per unit and not even per side** - so every ally's engine draw pumped every ally's `ink_stream`, and so did an enemy's inside the same turn. **This is the unfixed sibling of the CARDS_PLAYED bug ticket 123 already ruled on**, and the card text always said so (*"for each card a card, OS or daemon drew YOU this turn"*). **MEASURED BEFORE THE FIX: `ink_stream` counted 6.6 triggered draws per cast** against the ~1.75 `jormungandr_v1` produces solo - a **3.8x amplification bought purely with party width** - landing **52.9 damage from a 1-ENERGY card**, twice what 3-energy `hydro_blast` (105 power) lands, and **49% of the winning deck's total output**. The gym boss runs **four copies** off the same counter, which is a large part of Tidewrack's 55.8 dmg/turn. **IMPLEMENTATION:** new per-unit `IBattleEntity.nonNaturalDrawsThisTurn`, incremented in `executeDraw` on the drawer identified exactly as the `onCardDraw` dispatch identifies it (`sourceId`, else slot 0), reset in the SAME object literal as the side-wide counter and **on BOTH parties**, so the two can never diverge on an off-turn reactive draw. **Deliberately NOT written as `source?.x ?? state.y` like CARDS_PLAYED**: `playsThisTurn` is written on every play so its `??` is a real safety net, but a triggered-draw count is written only when a triggered draw happens, so an untouched caster holds `undefined` and a `??` chain would fall straight through to the battle-wide number **in exactly the case the ruling exists to fix**. The fallback keys off whether a CASTER is known instead. **The CONDITION path moved too** (`ConditionValidator`, `surge_protection`'s refund, whose constraint is already declared `target: SELF`) - leaving one half global would rebuild the same inconsistency; **that makes the refund harder to get at 3v3 and is a real behaviour change**, flagged not buried. Affected cards: `ink_stream`, `starfall` (scaler), `surge_protection` (refund). **EVERY 3v3 NUMBER IN THE REPO IS NOW STALE** - kraken_v1 and jormungandr_v1 are hit hardest, and Tidewrack is nerfed from the inside, which may answer its 23.3% from the other end. **NOT RE-MEASURED YET - Henry is merging other changes first.** `triggeredDraw.test.ts` pins the scope at **width 3**, because at width 1 a per-unit and a side-wide counter are indistinguishable and the test would pass either way - the fifth vacuous-green shape caught in this stretch. Suite **144 files / 2032 tests**, eslint 0, tsc -b, vite build, liveness all-LIVE. **THE TOOLBOX IS COMPLETE AND THE HELD TIDEWRACK VERDICT IS ANSWERED: the counters make the fight WORSE.** All five remaining printings shipped per `research/69-toolbox-printings.md` - `reactive_plating` (2e daemon, 1 Sharp when an ally is hit, **cap 3/turn TEAM-WIDE**), `discharge` (1e skill, remove up to 4 Strengthened, 1 Burn per 2 removed - **renamed from Overheat, `overheat` is a live 3e Fire attack**), `scrubber` (2e daemon, -1 Poison from each ally at end of your turn), `vent` (0e skill, -3 Poison from an ally), `drip_feed` (2e daemon, 1 Regen to each POISONED ally). All None, all in `MARKET_NEUTRAL_UTILITY`, pin test now reads the exported **`GYM_COUNTER_ANSWERS`** table rather than a second copy. **THE MEASUREMENT (n=30/arm, mixed firmware, paired seeds): favourable 26.7% -> 16.7% WITH the toolbox, control 50.0% -> 43.3%** - neither significant (p = 0.55 / 0.63), both in the same direction, DOWN. **Why, in one line: the three cards add 2.9 damage a battle and cost 70** (residual 16.6 -> 19.5 while card-attributed output falls 180 -> 110). They are drawn and CAST (0.63-0.88 per battle); `reactive_plating` moves Sharp granted 1.3 -> 1.4 against a cap of 3. **The mechanism is AMORTISATION, not power**: a 3-member party draws ~7 cards a turn and this fight is 4.3 turns, so three 2-energy installs into an 18-card deck is a 17% dilution paid on turn 1-2 against a boss that wins by turn 4. **The counters are MISTIMED, NOT UNDERPOWERED - a knob round on their power numbers is not supported by this.** **HENRY'S CALL, two ends of one question: (a) re-cost the installs to 1e or give them an effect on the turn they land; (b) bring Tidewrack's 55.8 dmg/turn down until the fight is long enough to amortise one.** NOT graded: Emberfall's and Rootfall's answer sets are untested in a fight, and both gyms are LONGER (4.4 / 5.6 turns) - the exact variable that broke here. **THREE ENGINE ADDITIONS, each the smallest that would do:** capped `STATUS` removal now records what it ACTUALLY took (so `STATUS_CONSUMED` works after a capped removal, which is how `discharge` pays 1 Burn against a 2-stack target); scaled stack counts are FLOORED (a no-op for every prior card, and what lets a below-1 ratio be printed); and **`targetHasStatus`**, a per-target filter on hook actions, because `ALLIES` resolves a GROUP and a `when` clause tests the CONTEXT target - *"each poisoned ally"* had no expression. **`vent` is `target: 'Self'` deliberately: `TacticalAI` aims a `Single` card with no HEAL action at the ENEMY party**, so a Single cleanse would have the AI curing the boss - **and `overgrowth` (Nature, 'Apply 3 Regen', Single, no HEAL) HAS THAT SHAPE TODAY and appears to hand the enemy 3 Regen; untouched, flagged.** **HARNESS: the firmware-pairing bug is FIXED** - each party slot now reads a different BIT of the sample index, so 3 members enumerate all eight v1/v2 combinations (measured: 2 distinct lineups -> 8, six mixed). That bug is the mechanism behind the whole per-deck split in the three-gym table: **n=30 was never thirty decks, it was two decks fifteen times**, and the v1 firmwares share a draw-and-cantrip idiom so all-v1 was accidentally synergistic. `blind` is untouched. **The gauntlet band now grades `gauntletCompound()`** (RATIFIED) - **and only when all three fight cells were measured**, because a compound over a partial set is not a clear rate; with a partial set it falls back to the pooled rate and says so. Emberfall's 83.3/90.0/80.0 (product 60.0%) now PASSES. **A SILENT OPTIONS BUG COST A 90-MINUTE RUN: `handbuilt` and `toolbox` were declared, parsed and printed in the banner but NOT PASSED at `measureCell`'s `sampleFight` call** - so `--toolbox` printed "TOOLBOX ARM" and measured the bare arm, with tsc, lint and 2075 tests all green. Caught ONLY because the paired sequences came back byte-identical. `optionsThreading.test.ts` now guards the class by diffing the DECK (no battles). **`--handbuilt` was inert on the merged tree for the same reason - any hand-built arm run since the merge measured the generated arm; the 13.3% figure predates it and stands.** **The loop audit was REWRITTEN**: its first draft flagged two shipped daemons that are safe, so it now tests the real property - *the fed-back event cannot satisfy the condition that admitted the first one* - across all three live guard shapes (counter, differing `statusApplied`, `isToken`), with a self-test and a synthetic unguarded daemon it must still catch. Write-up: [research/69-the-toolbox-measured.md](research/69-the-toolbox-measured.md), raw arms in `research/69-runs/`. Suite **151 files / 2079 tests**, eslint 0, tsc -b, vite build, liveness all-LIVE. Branch `steam-release-prep`.*

---

## Paste-into-a-fresh-agent prompt

You are working through a **wayfinder map**: a planning-and-build effort charted as decision tickets on disk. Repo: `C:\Users\hdunp\Documents\GameDev\Unity\GitHub\Mingming` (React 19 / TypeScript / Vite / Redux Toolkit roguelike deckbuilder; headless engine in `src/engine`, UI in `src/ui`, DEV-gated debug toolkit in `src/debug`). Branch **`steam-release-prep`**. Never commit to `main` or `archetype-web`.

The map lives at `docs/wayfinder/steam-release/map.md`. Read it first — destination, notes, the phase tables, the critical path, Henry's open questions, the fog. Tickets are files in `docs/wayfinder/steam-release/tickets/`. The codebase audit that every ticket assumes is `docs/wayfinder/steam-release/research/01-gap-audit.md` — read it before resolving any ticket. Binding design docs live in the deck-archetypes wayfinder: `docs/wayfinder/deck-archetypes/research/{vision,exploration-map,economy-session,macros-and-drivers,session-2026-08-19-decisions}.md` — where they and anything older disagree, the 2026-08-19 decisions record wins. Nothing you build may contradict `vision.md`.

### Session protocol — follow exactly

1. Load `map.md`. Do not bulk-read every ticket; open bodies on demand.
2. Choose **one** ticket. If Henry names one, use it. Otherwise take the first frontier ticket in critical-path order (map § "The critical path"), then phase order. Frontier = `Status: open`, every `Blocked by` closed (cross-wayfinder links count — open the linked file and check its Status), `Assignee` blank.
3. **Claim it** before any work: write your session name into `Assignee` and save.
4. Resolve it by `Type`:
   - `wayfinder:grilling` — a decision made **with Henry**. One question at a time, multiple-choice with numbers and a recommendation. Never answer your own questions; never assume his preference. If Henry is driving, keep replies audio-friendly.
   - `wayfinder:prototype` — build something cheap and concrete for Henry to react to (types, a generator dump, a stub screen); iterate on his reactions; link the artifact.
   - `wayfinder:task` — build it. **Design decisions inside a task stop the task**: if you find an un-ruled question, write it into the ticket, return it to Henry, do not improvise. Implementation agents adjust only what the ticket authorizes.
   - `wayfinder:research` — AFK investigation; findings to `research/NN-<slug>.md`, linked from the ticket.
5. Record the outcome: fill `## Resolution` (numbers, file paths, what was measured), set `Status: closed`.
6. Update `map.md`: one gist line under **Decisions so far** linking the ticket by name; graduate fog the resolution sharpened into new ticket files (create, then wire `Blocked by`); amend or delete tickets the decision invalidated; anything ruled beyond the destination goes to **Out of scope** with its ticket closed. Refresh the *State* line at the top of this HANDOFF.
7. **Stop after one ticket.**

### Repo rules (non-negotiable)

- Before shipping any code change: `npx vitest run` (green), `npx tsc -b`, `npx vite build` (which asserts the debug toolkit is absent from `dist/`) — all clean. Long gates (`npm run balance`) do not run on Henry's device VM (45-second kill); run them in a cloud container if a ticket needs them.
- Never commit `package-lock.json`. Author: Henry Dunphy <hdunphy15@gmail.com>. Docs under `docs/wayfinder` are CRLF.
- Commit the map/ticket edits together with the ticket's code, one commit per ticket, **explicit paths only** (no `git add -A` / `git add .`).
- Git lock files that will not unlink → move them to `_to_delete/git-locks/` and retry; never leave the commit undone. The device cannot delete files, only move them.
- Standing laws (map § Notes): power dies at the surface; no duplicate species per team; tiers not scaling; no leveling; never "potions"/"relics"; blueprints consumable and the only persistent currency; scrap and cards run-scoped; Henry is in every design decision.
- Scope: combat/deck/card/OS/status/sim work belongs to the deck-archetypes map — file a request there, link it here, do not do it here.

---

## Where things stand (findings log — newest first)

### 2026-08-29 - The first KO is worth 91.7%, and two thirds of the fight happens after it (ticket 70)

Ticket 70 is a grilling that refused to open without numbers - *"These four numbers frame every
option below; the grilling should not run without them."* They are in: 60 battles, the
`REFERENCE_PANEL` round-robin, 39 minutes on Henry's machine.

**P(win | scored the first KO) = 91.7%. The comeback rate is 8.3%.** The loser loses **all three**
members in every decided battle (3.0 of 3; the winner averages 0.9). Henry's play report and the
round-5 *"the first KO usually means a win"* were both right, and now have a number.

**The finding nobody predicted is line 2.** The ticket asked whether the rest of the fight is real
play or a formality. It is both: **66.9% of the average battle - 4.3 of 6.5 turns - happens after
the first KO.** A fast rout would be a balance problem. This is an *experience* problem, because
the player spends the majority of every fight in a position that is lost 92% of the time and the
game will not end. Whatever Q2 rules, this is the measurement's strongest argument for doing
something.

**The overkill incentive is inverted, not merely mispriced.** 17.8 damage wasted per battle, 7.4%
of a side's starting pool (median 13.5; the distribution is right-skewed and Henry's remembered 40
is in the tail, not at the centre). Hold the two numbers together: the waste he declined to spend
was worth **7.4% of a health bar**, and the kill he declined was worth **91.7% of the game**.

**Line 4 is a clean null, and it was checked before being believed.** P(win | higher STARTING HP) =
**50.0%**, n=60. A flat 50% is exactly what a predictor with no spread produces, so the spread was
measured: comp HP pools run **217 to 312 (43.8%)**, median pairwise gap **11.2%**, max **35.9%**,
with only 6 of 30 pairs inside 5%. The null holds across real advantages. **Henry's second,
unconfirmed issue can close with no change** - with the limit stated in the ticket: this is
*starting* HP, not a mid-fight lead, and those are different populations.

**One hypothesis, flagged as such:** `panel-ramp` - highest HP pool, the sustain/shield comp - is in
**4 of the 5 comeback battles**, against ~1.7 expected from its share of pairs. At n=5 that is
nowhere near established. If it survives `--iterations 5`, Q3 changes shape entirely: a comeback
mechanism would already exist and be called sustain, and the question becomes whether it is priced
and distributed to do that job rather than whether to build a new one.

**Why overkill is trustworthy here, since it is the number most easily faked:** it comes off
`IDamageRecord`, not an HP diff. `handleAttack` floors HP at zero, so a 60-damage hit on a 5 HP
target moves 5 HP - an HP-based instrument would have reported ~0 overkill with a straight face.
The ledger records `raw` before the floor and before shields, and it is per-action, so the harness
reads it after every dispatch including the forced `END_TURN` (a Burn tick killing a unit is a KO
like any other).

**PROCEDURAL, and learned the hard way twice in one day: long measurements do not survive in an
agent's cloud container.** It reclaims background processes during idle gaps - a snowball run died
at pair 5 of 30 and ticket 68's SS13 re-measure died at 26/60 and 17/60, all with nothing to show.
And Node **block-buffers stdout to a pipe**, so the obvious `> file.txt` leaves an empty file when
the process is killed. Two rules follow: **run long measurements on Henry's machine**, and **give
every long CLI an incremental `--out`** that appends per line, so a run that dies at pair 18 still
leaves eighteen pairs of evidence.

### 2026-08-28 - The desktop app exists, and the saves are FILES (ticket 42)

Henry's three answers, taken as rulings: **Electron. No code signing. Windows and Linux, placeholder
icon.**

**The headline is how little of the game changed.** Ticket 23 cut the storage seam a month early and
its header made a promise - *"ticket 42 implements `FileSaveStorage` behind this interface; nothing
else needs to change when it does"*. It held exactly: `SaveSystem`, `SaveSlots`, `runLog`,
`runTelemetry`, `settings` and `AudioEngine` are untouched, and the whole desktop save port is one
new file plus one call at the top of `main.tsx`. That is what cutting a seam before you need it buys.

**Why the IPC is SYNCHRONOUS, in case a future session is tempted to "modernise" it.** `ISaveStorage`
is synchronous by ruling, because an async save API leaks into every reducer that touches persistence
and into `store.ts`'s autosave subscription. Node has sync `fs` and Electron has a sync channel, so
the cost of keeping that true is paid in a main process that is doing nothing else, on single JSON
files of a few KB, on a save rather than per frame. Making it async would be a refactor of the state
layer wearing a performance costume.

**Three traps recorded because they cost time or would have:**

- **`base` must be `'./'`.** A `dist/` built for Pages has absolute `/Mingming/...` asset paths,
  which under `file://` resolve against the filesystem root and 404 - the window opens **blank with
  no error a player could report**. `MINGMING_DESKTOP=1` switches it, and `scripts/desktop-build.mjs`
  now greps the built `index.html` and refuses rather than shipping a black box.
- **The build script is Node, not shell.** `VAR=1 cmd && cp -r` does not run on Windows, which is
  the machine that has to run it. **And that was not enough** (fixed 2026-08-29): it first called
  `npx.cmd`, and **Node 20+ refuses to `execFile` a `.cmd` at all** without `shell: true` (the
  CVE-2024-27980 fix) - `spawnSync npx.cmd EINVAL` on Henry's machine. It now runs every child as
  `process.execPath <bin.js>` (`vite`, `electron-builder`) or via `npm_execpath` (`npm install`),
  which needs no shim, no shell and no PATH lookup. **If you ever spawn a tool from a script in
  this repo, do it this way** - Henry is on Windows and nothing here catches it.
- **`electron` is NOT a root dependency.** ~250 MB of binary that `tsc`, `vitest` and `eslint` never
  touch. `desktop/` is its own npm project, installed on demand.

**What was actually verified, and what was not.** The packaged **Linux** build was driven over CDP
under Xvfb: the renderer mounts, `localStorage.length === 0` (the swap took and nothing fell back),
the game wrote `saves/mingming_saves.json` unprompted, picking a starter wrote
`saves/mingming_ranch__slot_1.json`, and **killing it and relaunching opened at the ranch, not the
starter picker**, with the blueprint intact. That is load and save proven on a real binary.
**Windows was built but not run** - `Mingming.exe` is a real PE32+ x86-64 binary with all seven icon
images embedded, but the **NSIS installer needs Wine to cross-build from Linux** and fails with
`wine process failed ENOENT`, leaving a truncated `Setup .exe` that was deleted. **Henry: run
`npm run desktop:build -- --win` on your own machine** - it produces the installer with no caveat,
and the zip is 146 MB, well past what can be handed through a session.

**Ticket 59's other half is done.** `autoSaveRunLog` and `exportRunLogs` both go through one
`writeRunLogFile`, which takes the bridge when it exists and **falls back to the browser download
when a desktop write fails** - a transcript in Downloads beats one lost to a read-only `userData`.
`SettingsScreen` prints the real path instead of "your downloads folder" and grows an *Open the
folder* button, so the tester instruction is now one sentence with a real path in it.

**Two ticket errors, flagged rather than quietly satisfied** (the task protocol's rule):

- The ticket says the icon set comes *"from ticket 34's logo"*. **Ticket 34 produced no logo** - the
  identity art is commissioned (ticket 32). Henry ruled a placeholder; `desktop/build/icon.{png,ico}`
  is two fanned cards and a diamond, drawn against `tokens.css`'s own background.
- The Done-when says *"`release-check` passes on the desktop bundle"*. **There is no such script** -
  it is [ticket 40](tickets/40-standing-gates.md)'s deliverable, and 40 is open and blocked. Read as
  the existing gates on the desktop bundle, which is what ran.

**For ticket 43, written where it bites (`main.cjs`):** `electron-builder` does not pick up
`steamworks.js`'s `dist/{win64,linux64}/` redistributables by default; they must be copied into the
build root explicitly. And Auto-Cloud comes free - `userData/saves/` is one JSON per slot, so it is a
path rule with no code.

**Sizes:** 283 MB unpacked Linux, 368 MB Windows, 146 MB win zip. The game itself is `app.asar` at
**1.18 MB** - ticket 26's ~314 MB estimate was close. Suite **133 files / 1863 tests**, lint 0.

### 2026-08-28 — The pick pool is your ELEMENTS now, for the shop AND for drops

Henry's ruling, closing `economy-session.md`'s last open economy item: *"the main 5 should be any
card from your element not just your deck"* — asked about the marketplace and ruled to apply to
post-fight picks as well, because `RewardSystem.rewardCardPool` is deliberately the one rule behind
both and splitting them would create the drift it exists to prevent.

**A solo party's pool: 5 cards → 33.** A Fire+Water+Nature trio sees 94 of the 206 real cards.
Identity moved from the species to the element — a Fire party still never sees Water cards — but
ticket 08's *"recruiting IS drafting"* now describes only how a deck STARTS, not how it grows.

The stall is **seven**: five from your elements, one reserved neutral slot, one genuine stranger.

**Two things the widening broke, both caught by tests:**

- The neutral slot would have **silently emptied**. Neutral cards are in every element's pool now, so
  its `!pool.includes(id)` filter matched all four — and `drawDistinct` stops on an exhausted source
  rather than throwing, so the shelf would have quietly become six. The draw now excludes what
  earlier slots took, not what the pool contains.
- `wildcard` stopped being true, because a neutral card IS in your pool. Offers carry
  `slot: 'pool' | 'neutral' | 'stranger'` and `wildcard` survives as a derived alias for `stranger`.

**And the calibration exclusion had to move.** Ticket 69 closed the floor-deck leak by narrowing one
slot; that fix does not survive this ruling — the `baseline_*` cards are element `None`, so an
element pool would offer them to **every party in the game**. It now lives in
`RewardSystem.isRewardable` and covers drops and the shop from one place. Rewardable: 212 → 206.

**Flagged for Henry, not decided:** the stranger slot can offer cards of elements that do not ship at
EA — a Light card turned up in the capture. Real, implemented, priced content; restricting it would
be a content-scope call rather than a bug fix.

### 2026-08-28 — Ticket 34 CLOSED: the winding route and the chassis

Part two, and the ticket closes. The map is rebuilt to ticket 64's ruled OPTION N — every node
leans off its lane by a hash of its id (**never rolled**: ticket 06 kept `x`/`y` out of the save so
layout stays derivable, and a hash is derivable, stable across a reload and free to store), trails
are dotted and go dimmer where they lead into the fog, biome panels are rounded and say
`FIRE · CURRENT` / `NATURE · AHEAD`, and a visit is a gold shoulder badge.

The cards are rebuilt to ticket 66's chassis: **energy pips instead of a numeral** (a numeral is a
price you do arithmetic with; pips are a quantity you compare by looking — and a turn is two energy,
so almost every decision is "can I afford this AND that"), a **one-character type mark** where an
eight-character coloured pill used to be, and no payoff glow. `Banner` gained `MACRO`.

**A test caught what the eye would not have.** FNV-1a alone leaves adjacent ids adjacent in the low
bits: `b1l2n0` and `b1l2n1` — neighbours in the same column, exactly the pair the wander exists to
separate — landed **0.015 apart on a scale of 2**, i.e. on top of each other. A `lowbias32`
avalanche fixed it; `regionLayout.test.ts` pins it.

**And the screenshots caught two more**, which is the argument for the capture script being part of
the ticket: the off-pool tag was rendering *underneath* the price plate (the plate owns the last
31px of the card and the tag cleared 22), and the art block needed 16px of clearance rather than the
reference's 20 — the gem used to hang outside the frame, the pips sit inside it.

**26 screenshots** in `research/34-screens/`, now including the marketplace:
`scripts/screenshot-gallery.tsx` renders a screen to static markup against the BUILT stylesheet, the
route the UI tests already use, because a walked capture cannot reach a market without winning
fights. The workshop and the run summary are still unphotographed and that script is how they get
done.

**Not in this ticket, deliberately:** the in-battle glyph vocabulary and the engine's combat-log
emoji (both still excluded BY NAME from `Icon.test.tsx`'s sweep, so the exclusion list is the to-do
list), and a logo — ticket 32 ruled the capsule set COMMISSIONED, so an agent should not invent one.

### 2026-08-28 — Ticket 69 closed: the market's off-pool slot was diluted, not undefined

The slot always had a source — the set complement, everything rewardable the party's pool does not
contain. For a solo party that is **207 cards**, so any particular card was a **0.48% draw per visit,
1.4% across a run**. R4.3's hedge (the mechanical answer to WAR FOOTING must be purchasable by any
party) was therefore unreachable in practice rather than blocked in principle.

It now draws from `MARKET_NEUTRAL_UTILITY` — four cards, derived rather than tasted: element `None`,
in no LAUNCH species' deck, real content. `hamstring`, `adrenaline`, `squirrel_away`,
`harden_daemon`. **hamstring goes from 1.4% to ~58% across a run.**

**A live bug closed on the way: the control species' calibration deck was on sale.** `control` is
the balance corpus's deliberate FLOOR ("the worst deck in the game") and is not in
`PLAYABLE_SPECIES`, so its six `baseline_*` cards fell straight through the "not in the party's pool"
filter onto the shelf at roughly 3% a visit. A test now fails if a calibration card reaches a shelf.

**Two things back to Henry**, both in the ticket's resolution: this **trades away the slot's shipped
anti-monotony purpose** (207 strangers → 4 neutrals for a mono-species party, whose own pool is 5
cards) — the list is his to extend, or a second slot keeps both properties; and **the brief's
"~+20% None-element pricing law" does not exist** — ticket 56 ruled price is energy alone and calls
that a design statement, so nothing was changed and hamstring prices at 25 like every other 1e card.

### 2026-08-28 — Ticket 34, part one: a token layer, 31 icons, biome backdrops, and the screenshots

**Ticket 34 is NOT closed** — four of five deliverables landed and card frames did not. The
ticket's own Progress section is the honest list; the short version:

- **`ui/theme/tokens.css`** — the vocabulary `index.css` never had (elements, surfaces, ink, type
  scale, space, radii). The eight legacy names ship as aliases at their old values, so **nothing
  changed appearance by being moved**; screens adopt the ruled surfaces as they are worked on.
  `theme.test.ts` parses the file and compares the nine element colours against
  `runShell.ELEMENT_COLOR`, which is the one seam that can drift silently.
- **Emoji are out of the chrome.** 31 inline SVG icons on a 24 grid in `ui/theme/icons.ts`, stroked
  in `currentColor`. The point is not taste: an emoji is a font glyph the player's system picks and
  it **ignores `color`**, so the region map could not tint a node by its biome and `U+1F573` drew as
  nothing at all on several Linux stacks. `Icon.test.tsx` renders the whole set and **sweeps
  `src/ui` for emoji**, so the acceptance criterion fails a build now.
- **Biome backdrops on the region map** — element-tinted bands with a dashed seam, derived from the
  laid-out columns so a band is exactly as wide as the nodes it stands behind.
- **12 screens x 1280x800 and 1920x1080** in `research/34-screens/`, captured by
  `scripts/screenshots.mjs` driving a real production build through a real cold-start playthrough.
  They earned their keep as a review: the `wild` icon was crossed swords, which **collapses into an
  X at 18px** — the commonest node in the game drawn as a close button — and ticket 68's uneven offer
  cards were pushing Emberfall's name out of line.

**Still open on 34:** the card frames (ticket 66's chassis — the largest piece), the in-battle glyph
vocabulary (excluded BY NAME from the emoji sweep, so the exclusion list is the to-do list), the
engine's combat-log emoji, and a logo — which ticket 32 ruled is COMMISSIONED, so an agent should
not invent one.

### 2026-08-28 — CI lint was RED on HEAD, and every session reported it green

`scripts/debug-generate.ts` is a pre-run-loop leftover: it imports `createDefaultSave` and
`createStarterSave` (deleted), reads `save.gauntlet` and `save.activeParty` (deleted by ticket 06),
and calls `createBattleState(save as any, [])` against a signature ticket 11 replaced. It cannot
compile or run, and it failed `eslint .` with two errors — which is `npm run lint`, which is a
BLOCKING CI gate. **Deleted.**

It survived ticket 55's burndown and every session since because **agents run the gates against a
cloud copy of the tree, and a previous session had patched this file locally without transferring
it.** Every session after that ran lint against a file the repo does not contain and reported clean.
The lesson is procedural and belongs at the top of this file: *a gate is only evidence if it ran
against HEAD.* After syncing a tree into a container, diff it against the device before trusting a
green run — content-compare with `tr -d '\r'`, since the mount is CRLF and the container is not.

### 2026-08-28 — The boss wall is gone. Emberfall goes 0/60 to 48/60, and is now too EASY.

Ticket 68, built and measured. The relic stack §12 identified as the wall is **retired as a
concept**: enemy passives are DRIVERS now — side-scoped, additive to a member's own firmware, on the
same machinery as the player's — and Emberfall fields a hand-authored trio of real tuned decks
(fenrir_v1 + skoll_v1 + ratatoskr_v2) under one Driver, **WAR FOOTING**.

| arm | result | vs the 0/60 it replaces |
|---|---|---|
| Emberfall boss, PREPARED | 48/60 — **80.0%** (CI 68.2-88.2) | **+80.0pt** |
| Emberfall boss, CONTROL | 39/60 — **65.0%** (CI 52.4-75.8) | +65.0pt |
| all three gyms, prepared (unpinned) | 14/60 — **23.3%** | ≈ the 26.7% one-rebuilt-gym-in-three predicts |
| Emberfall fights 1 and 2, prepared | **83.3%** / **90.0%** | were 68.3 / 81.7, blind and un-authored |

**The cliff became a gauntlet.** 83.3 / 90.0 / 80.0 against the old 68.3 / 81.7 / 3.3 — three fights
of comparable weight with the boss slightly the hardest. Compounded that is 60.0%, exactly the
target, and an upper bound because the harness fights each from full HP.

**AND IT OVERSHOT.** Against a 60% target the control arm passes at 65.0% and the prepared arm — the
one Q3 rules the targets grade — is **15 points high**. Six weeks of §10-§12 were about this fight
being impossible; it is now too easy for the player the targets are written for. **Nothing was
turned**: ruling 7 pins `BOSS_IVS` and the AI grade, so this is a number for Henry, not a verdict.
The unturned levers, cheapest first: `BOSS_IVS` (20/20/20 — ruling 7 asks for it to be re-checked
against the new Driver and that re-check has not been run), WAR FOOTING's numbers, the authored
composition, and the 60% target itself, which was set against a boss nobody had designed.

**WAR FOOTING's escalation is nearly decorative.** The fight averages 4.1 turns and the clause starts
at turn 4, so in most battles the Driver is worth 1 Strengthened a round. It is built, tested and
live — it is why the `turnAtLeast` hook condition exists — but it is not part of the measured
difficulty. If the intent was an aura that punishes a long fight, this fight is not long.

**Two readings the build had to make**, both isolated to one function and both flagged in the
ticket's resolution: *"the region's FINAL elite"* has no such node (the final biome's exit is the gym,
so its elites are weighted middle nodes) — implemented as **the elites in the gym's own biome**; and
`--boss-relics off` was widened to follow the Driver, or it would have measured the boss WITH its
signature and reported it as without.

**`--gym` is new** and the gate needs it now: `gauntlet:fight2` walks all three leaders, and after
ruling 6 the three leaders are no longer the same fight. An unpinned run blends one rebuilt boss with
two unchanged ones. Tidewrack and Rootfall keep ticket 18's formula boss until their own sessions.

### 2026-08-27 — `npm run decks`: a deck browser, and it flags its own stale numbers

Henry's side quest, not a ticket: *"I need a tool to look at the current decks… easy to read at a
glance, not JSON, interactive… mark it stale if we have made changes that affect it."*

`npm run decks` writes **`docs/balance/deck_browser.html`** — one self-contained file, double-click,
no server and no `npm run dev`. Left rail of all 32 decks grouped by element with win rates; main
panel per deck: statline, the FIRMWARE box (the OS description is the biggest thing on the page,
because forgetting what an OS does is the problem this solves), cost curve, the deck engine-first
with PAYOFF/ENABLER badges and per-card telemetry, and the MEASURED grid. `c` pins a deck and
compares two side by side; `j`/`k` walk the filtered list; `/` searches.

**Everything structural is read from the live registry at generation time** (`getDeckForOS`,
`startKits`, `ProgramRegistry`, `getOSBehavior`), so regenerating is all it takes to be current. The
win rates cannot work that way — they cost hours — so they are borrowed from
`docs/balance/deck_report.json` and **stamped with `computeRegistryHash()`**. Hash mismatch ⇒ banner
at the top, every borrowed number dimmed and badged. That is honest rather than a file-date
heuristic: if a card's numbers moved, the hash moved.

**The staleness banner is live right now.** The deck report was measured at `1:ce1ac459`; the
registry is at `1:1ad8616b` — i.e. every win rate on the page predates the ticket-60 ladder and the
ticket-61 engine work. `npm run balance:deck` refreshes them. Also worth knowing before trusting the
column: the report's win rate is **vs the mirror field it was run against**, not vs the new ladder.

Three files under `src/debug/balance/` (`deckBrowser.ts`, `deckBrowserTemplate.html`,
`runDeckBrowser.ts`) plus `deckBrowser.test.ts`, which pins the two things a reader would be silently
misled by: the hash comparison, and that telemetry joins by `osId|cardId` and never by position.

### 2026-08-27 — Two of three bands PASS for a prepared player. The boss wall is the relics, not the stats.

Ticket 67 ruling R3's measurement task, done. **Nothing tuned** — the boss AI grade stays locked at
full lookahead per R2, and both isolation levers are **run-scoped CLI flags** (`--boss-ivs`,
`--boss-relics off`) so the shipped constants never moved and the 0/60 baseline still exists to
compare against.

**The isolation arms**, `gauntlet:fight2`, prepared, 60 battles each, everything but the named knob
verified identical to baseline:

| arm | result | vs 0/60 |
|---|---|---|
| A — `BOSS_IVS` 10/10/10 | 1/60 — **1.7%** | +1.7pt |
| B — `boss_relic_*` off | 35/60 — **58.3%** | **+58.3pt** |

**The relics are the wall.** And structurally so: the relic effects are stat-independent — FIRE
scales on Sharp stacks, WATER heals 5% of max HP, ICE taxes energy — so lowering IVs *cannot* reach
them. Arm A's battles ran longer than baseline (6.2 turns vs 5.3) and still lost: a softer boss that
grinds you down the same way.

**The prepared and control bands**, 1,800 battles:

| band | target | blind | control | prepared |
|---|---|---|---|---|
| WILDS | 95% | 79.5% | 84.5% | **95.7%** — PASS (CI 93.7–97.0) |
| ELITES | 75% | 46.3% | 53.7% | **73.7%** — PASS (CI 68.4–78.3) |
| GYM BOSS | 60% | 3.3% | 0.0% | **0.0%** — FAIL by 55pt |

**The game is not broadly mistuned.** Two of three bands already hit their targets for the player
Q3 says the targets describe. Preparation is worth +11.2 at the wild band and +20.0 at the elite
band, and most where the run is hardest — the two largest per-spot gaps are both the SOLO fight
(wild biome 1 +22.5, elite biome 1 +24.0), which §10 had already identified as the run's worst
position.

**One fight is the whole problem**, and its knob is now named. What to do about it is R2's open
ruling: soften the relics, answer them with the Q2 cards, or both. Arm B is a diagnostic, not a
proposal.

Open gaps: gauntlet fights 1 and 2 have only been measured blind (68.3%, 81.7%), so a prepared
end-to-end gauntlet number needs ~2h; arm B's interval is wide (±12.1) and wants deepening if the
target gets ruled against its number rather than its direction; and the prepared arm still does not
shop, so both passing bands are passing **from below**.

One harness note worth keeping: the control arm at `wild:biome0` stalled 15 battles in 200 and
averaged 8.8 turns against the prepared arm's 4.1. Same-element mirrors between two tuned decks
struggle to kill each other — a small independent echo of the 89/11 type finding.


### 2026-08-26 — The boss diagnostic: a PREPARED player wins the gym boss 0 times in 60

Henry ruled ticket 67's three questions (research note
[67-gate-validity-and-the-power-ceiling](research/67-gate-validity-and-the-power-ceiling.md), §9):
report a **control** number and a **prepared** number for every band, add a power tier of **2-3
anti-boss cards per deck** (24-36 cards, deck-archetypes' content), and **95/75/60 grade the
prepared player**, not the control.

The gate now has both arms — `--matchup blind|favourable|control`. `blind` is the original stride and
is still the default, so every number taken before the ruling reproduces exactly.

**The boss diagnostic, 180 battles:**

| arm | boss result |
|---|---|
| PREPARED (counter-element, nobody the champion is strong against) | **0/60 — 0.0%** |
| CONTROL (champion's own element, type removed) | **0/60 — 0.0%** |
| blind (earlier) | 2/60 — 3.3% |

**The boss is a wall and type advantage cannot rescue it.** The prepared arm is not better than the
blind one. Average battle length 5.3 turns, so these are routs rather than near-misses: the boss team
removes a party before it can execute, and a damage multiplier on attacks nobody lives to make does
nothing. The "the 3.3% is a matchup artefact" hypothesis is dead.

**What it does NOT settle:** this is a result about the boss, not about type advantage. Wilds and
elites have still only been measured blind, and the prepared arm should move them a lot — they are
ordinary enemies, not three champions carrying `boss_relic_*` firmware. Measuring those two bands
prepared is the next thing worth an hour.

**What it means for ruling Q2:** it sizes the job. The anti-boss cards are not shifting a 40% fight to
60% — they are being asked to make a **0%** fight winnable, against a starting deck, where the loss is
a rout. A throughput-style effect cannot do that; the cards likely have to change the fight's shape
(survive FIRE's field ignition, deny WATER's heal trigger, escape ICE's energy tax). `BOSS_IVS` is one
authored triple per slot and exists so it can move too — asking 24-36 unwritten cards to carry all of
a 0-to-60 gap is a large bet.

Also worth stating before those cards are designed: even at 60% per fight, clearing all three
compounds to ~33%, and the harness does not carry HP between fights. Whatever the gauntlet is meant
to produce end-to-end should be a number somebody has said out loud.


### 2026-08-26 — Ticket 67 steps 1-2: the ladder is built, and the re-measure says it is not enough

Build-then-grill, as ruled. `KIT_FRACTION_BY_BIOME` — ticket 08's enemy-deck table indexed by biome
depth — is **deleted**, and `encounter.ENEMY_LADDER` replaces it: every enemy in the game holds the
full tuned deck, and a rung raises **how well it plays it** (wild = no firmware + greedy, elite =
firmware + lite lookahead, gauntlet = firmware + full lookahead). The tier raises the wild rung and
nothing else, clamped at tier 3. Henry's IV flip is applied: wilds 0-20, elites 0-31 uncapped, and
the gym boss rolls nothing at all (`gauntlet.BOSS_IVS`, fixed at 20/20/20 — the old band's mean, so
the re-measure reads the ladder rather than two changes at once).

**One seam had to be built first, and it is worth knowing about.** The three AI grades existed only
as `AI_GREEDY=1` / `AI_LITE=1`: process-wide env switches read once at module load. That is right for
ticket 99's corpus and cannot express three grades inside one run, so the grade is now
`IBattleState.enemyAiTier`, set at battle creation exactly as `enemyMode` is and defaulting to the
env value when unset. **Enemy side only** — grading the player in a two-AI harness would measure two
changes at once. `runBatch` takes it as an option and applies it to the materialized state, so
`ComposedSetup` (a versioned format with 51 committed scenarios) did not have to grow a field.

**The numbers, at 1,080 battles over 4h 09m** — equal `n` within each band, so a band is the mean of
its three cells rather than whichever was cheapest to run:

| band | target | before | after | 95% CI |
|---|---|---|---|---|
| WILDS | 95% | 52.8% | **79.5%** (477/600) | 76.1-82.5 |
| ELITES | 75% | 41.7% | **46.3%** (139/300) | 40.8-52.0 |
| GAUNTLET | 60% | 50.0% | **51.1%** (92/180) | 43.9-58.3 |

**What landed:** both curves are monotonic. Wilds run 73.5 / 79.0 / 86.0 across the biomes and elites
39.0 / 48.0 / 52.0, where the old table produced a **trough** at biome 1 (26.7%, against 67.1% at
biome 0). That cell moved **+52 points** and is the single biggest change in the re-measure — the
middle row's "startKit alone" was five pure engine cards a body with no filler, a *sharper* list than
the tuned one, so the middle of a run was its hardest part.

**What survived, and it is two things rather than one.** The gym boss is at **3.3%** (2 of 60, where
the old 8.3% was 1 of 12) sitting between fights that measure 68.3% and 81.7% — a wall, now measured
properly rather than made harder. And the **ELITE band moved only 4.6 points**: ruling 3 expected the
boss to be the survivor, but 46.3% against a 75% target is the larger miss. Both bands' worst cells
are the same fight — `elite:biome0` at 39.0% and `wild:biome0` at 73.5% are **one mingming, eight
cards, against a complete tuned per-OS deck**, which is the direct cost of the ladder's central
choice. It is clearly a good trade at three members and eighteen cards (biome-2 wilds went 50% →
86%) and the hardest position in the run at one.

**Nothing was tuned.** Options with numbers are in the ticket; the grilling happens on this baseline.

**One thing ticket 60 asks for that does not exist:** the gauntlet rung's *"+ Driver"*. There is no
enemy-driver machinery — `createBattleState` applies `setup.drivers` to the player's party only. The
boss's `boss_relic_*` signature firmware is the closest thing in the tree and is what the rung ships
as. A literal enemy Driver is its own ticket.

Ticket 08's clause 6 carries a supersession note pointing here.


### 2026-08-26 — Ticket 61 CLOSED. The run gate exists, and it says we are failing by 30-40 points.

The whole of Henry's amended spec is built: five-card engines, the per-card ADD/STORE choice on
picks, the four edit surfaces behind one editor, selling back with paid removal gone, and the 8/13/18
floor enforced at every door that can shrink a deck. The market, the workshop and the editor are
rebuilt to the ruled mockups over one shared screen kit (`src/ui/screens/runShell.css` + `.ts` — the
five prototypes open with the same ~45 lines of CSS character for character, so it is one kit that
had nowhere else to live).

**The headline is the gate.** `npm run balance:run-gate` measures the shipped game against
95/75/60 ±5 and reports **52.8 / 41.7 / 50.0**. The two cheapest cells were re-run to 1,200 samples,
so the misses are not noise. Three shapes matter more than the magnitudes:

1. **Enemies out-roll the player by ~5 IV in every stat, everywhere.** The player rolls
   `nextInt(0, 31)` (`gameTypes.ts:109`), enemies roll `nextInt(10, 31)` (`encounter.ts:416`). That
   is upstream of every band, every biome and every deck.
2. **Difficulty is not monotonic** — biome 1 wilds (26.7%) are harder than biome 2 (50.0%) and much
   harder than biome 0 (67.1%). Ticket 08's kit-fraction table produces a spike, not a ramp.
3. **The gym boss is not in the same game as the two fights before it** — 8.3% against 75.0/66.7,
   and that is from full HP, which a real gauntlet is not. Clearing all three: 4.2%.

Nothing was tuned. All of it is [ticket 67](tickets/67-enemy-ladder-and-bands.md), which also
absorbs ticket 61's unbuilt package 2 (the enemy ladder) — the ladder and the numbers belong
together, and package 2 was written before any of this was measured.

**Three real bugs the run collection created, all found by writing tests rather than by playing:**

- `isOfferSold` looked only at the deck, so a bought card moved to the collection **un-sold its own
  offer** and could be bought again — a card duplicated out of nothing, and a real cards-for-scrap
  farm.
- `sellRunCard` had no floor check, so 5 scrap bought you a deck under its minimum. The floor was
  enforced at four of five doors, which is not a floor.
- The boundary alert listed suggestions by instance rather than by card. **Eleven of the twelve
  ruled engines contain a duplicate**, so one benched member's repeats could fill all five slots.

Two dead controls fixed on the way: the editor's party chip invited a bench a party of one cannot
perform and answered the click with a beep (a run OPENS solo, so that was the first editor most
players would ever see), and the editor's empty-book copy told a player holding twelve cards that
nothing had landed in their collection whenever a filter matched nothing.

**Worth knowing beyond this ticket:** under `vite-node` every `process.env` read compiles to
`undefined`, because `vite.config.ts` carries `define: { 'process.env': {} }`. That silently disables
`BALANCE_ONLY` for `npm run balance:deck` as well as for the new gate.

**One reading flagged for Henry.** Mockup I puts VIT/PWR/DEF on the assembly stage under *"stats roll
at assembly — this is the reveal moment"*, which reads two ways. It ships as `??` until you assemble,
because `workshop.planRecruit`'s standing ruling is that the roll is never previewed and the
consequence — walking away re-rolls the individual, at the price of the road back — is the mid-run
echo of *"re-assembly is the re-roll"*. A previewed roll makes that free and turns every workshop
into a button to mash. One line either way if the intent was a genuine preview.

Also recorded: **the amended spec never reached a commit.** It arrived as chat and an uncommitted
edit, and the sitting that applied sections 1/4/5 overwrote it with progress notes. It is restored
verbatim at the top of ticket 61's resolution, and the map's ticket-60 gist now points there.


### 2026-08-25 — Ticket 57 CLOSED, and the ticket numbers were colliding

**Two tickets shared each of 58 and 59.** A grilling session filed `58-difficulty-and-agency` and `59-apply-58` (commit `2a969f5`) on numbers this map had used the day before for `58-interaction-tests` (open) and `59-run-telemetry` (closed, shipped). Henry's call: the earlier pair keep their numbers. **The new pair is now 60 and 61**, with a note in each recording the shift and `2a969f5` named as the commit that closed 60 under its old number. Both now have phase-table rows, which neither had.

**Ticket 57 is closed, six of six.** The two items that stopped it were ruled today:

- **Relay is CUT.** *"Keep transfer energy as is in the code, we don't use it yet. we can cross that bridge when we get there."* `TRANSFER_COST = 2` / `TRANSFER_GAIN = 1` stays exactly as built — the 2-for-1 reducer is an unused mechanism, not a bug to fix ahead of a caller. No macro bridge, no `OTHER_ALLY` targeting mode, no Relay in the macro list. The conflict with 56's "move 1 energy" is **kept written down in the ticket** rather than softened, so the next pass finds it investigated instead of discovering it again.
- **The pick pool was already compliant, and 56's weighting clause is dropped.** *"The cards should be from the current roster of mingmings. we can swap rosters mid run so we want cards to be based on the current active mingmings."* That is what `rewardCardPool` does — the union over the party `rollDropTable` is handed, and `BattleArena` hands it the LIVE `playerParty`. The gap was only 56 ruling 1's second half, a bias nobody had numbered against a `IRunState.deck` the roll cannot see; ticket 60's collection retires it anyway, since a skipped card now goes to the collection and the deck is editable. **What was added is a test, not a change:** the source half was pinned, the DYNAMIC half was not, and the bench makes it load-bearing — a benched species' cards must leave the pool immediately, asserted as an exclusion because the inclusion form would pass on a pool that lazily unioned the whole roster.
- Carried into 61 package 4: *"skipped cards now go to your in-run collection but not the current deck"* — which retires the skip's 2026-08-24 meaning of taking nothing, and re-labels `BattleReport`'s button.
- `gauntlet.ts`'s **FLAGGED FOR HENRY** block on `GAUNTLET_ENEMY_COUNT` is recorded as settled: 56 ruling 4 ratified the reading, and 60 re-confirmed it from the other side by making the gauntlet's three harder without making them more numerous.
- The **deck-archetypes note** (item 6) was sent, rewritten: it was specified to say ticket 09's startKit table is ratified content, and ticket 60 replaced that table wholesale in the meantime. It names the mini-engine six and asks one thing — a deck pass that renames or re-roles a card should check the tagged six still form an opening engine.

**Next: ticket 61, four packages, in order.** Henry on package 1: *"yes I play tested and the starting kit was not fun."*

### 2026-08-24 — Run telemetry CLOSED (ticket 59) — **a run writes a transcript of itself**

Henry: *"we should record/log everything I do in the playtest run."* Built and closed the same day. Full resolution in the ticket; the parts worth carrying:

- **Every row is a sample.** `seq`, `fightIndex`, `deckSize` and `scrap` are stamped on all fourteen event classes rather than emitted as their own kinds — because "when did the deck get big" and "where did the scrap go" are questions about curves, and a curve you reconstruct by interleaving two streams is a curve nobody plots. `runCurves` is a `.map`.
- **Derived, not announced.** One middleware, `concat`ed alongside the action tap and deliberately not in it (one slot, last caller wins, the debug tape holds it). Nothing dispatches a scrap event: the middleware notices `run.scrap` moved and names the action. Fight boundaries are transitions on `battle.battle`, so a fight logs the same whether it came from a node, the gauntlet or the debug launcher — and `FIGHT_ENDED` reads the PRE-dispatch board, because by the time the battle is null the turns and HP are gone.
- **The one thing the store cannot see** is a DECLINED pick — it lives in `BattleReport`'s component state, so "three offered, none taken" and "no rewards" are the same silence from the store. `BattleArena` reports it through `logRunEvent`, a logging-only action, its only call site.
- **Two bounds, both needed.** 800 rows per run, 3 runs kept: a single bound big enough for three normal runs is big enough for one runaway run to evict them all. At the cap rows are DROPPED and counted, not evicted — a head-truncated transcript answers the questions, a tail-truncated one does not, and `droppedEvents` is what stops it looking complete.
- **A wiring test.** Every other case builds its own store, which leaves the likeliest failure uncovered: a middleware that works and is not in the chain. It fails when the `concat` is reverted.
- The tests caught a live bug first: `game/swapOS` takes `{ id, targetOS }`, and the `REFLASHED` row was reading `{ memberId, osId }` — a reflash you can see happened and cannot identify.
- **Auto-save landed the same day** (`ISettings.autoSaveRunLog`, default off). Henry: *"having to export at the right time doesn't work, I often forget."* A run now writes itself to a file when its summary appears, so the tester instruction is *turn this on, play, send me everything in Downloads called `mingming-run-*.json`* with no timing in it. It is a **download, not the folder he asked for**, because a browser cannot write to a chosen path: `showDirectoryPicker` is Chromium-only and its permission is not reliably persisted across sessions, so it would relocate the "silently saved nothing" failure rather than remove it. **The real answer is the desktop build — flagged onto ticket 42**, whose Done-when should name a `run-logs/` directory under `userData`. Idempotency rides on `recordRunEnd`'s return value, the one signal that already means "this run just ended, once".
- **One number needs Henry:** `RUN_LOG_RUNS = 3` is a guess at "a playtest session is a handful of runs". A tester who plays five before exporting loses the first two. One line; the cost of raising it is quota shared with the ranch save.
- Suite 1634 green across 124 files. Commits `181a053`, plus auto-save.

### 2026-08-24 — Henry played it. Eight items, six defects, six rulings (new ticket 59)

The first real session at the controls since the loop closed. Everything below is his, in his words, with what it turned out to be.

- **"The cards should show the full damage not what it gets capped to when its lethal."** The preview never had a second implementation — it MEASURED, casting through the real reducer and diffing HP (ticket 104's fix for 52 parity mismatches). But HP moves less than the card hits for in two places: the floor in `effectHandlers`, and BarkShield, which absorbs *before* HP is touched. So a lethal blow read as remaining HP and a shielded hit read as **no number at all**. His constraint on the fix was explicit — *"share damage calculation functions, just be able to pull out from it before it gets Math.Max(0, damage)... just no bugs"* — so `handleAttack` now records `IDamageRecord {raw, absorbed, applied}` on `IBattleState.damageLedger` at the one line where all three exist, and the preview, the `DAMAGE_TAKEN` event and the floats all read it. Still one calculation; it reports itself instead of being inferred from its side effects.
- **The new parity assertion caught a second live bug within the hour.** Burn overflow damage comes out of `behavior.onApply`, not `handleAttack`, so it was missing from the ledger and two cards previewed 17 against 29 actual. Also: the old parity suite's `shielded` sample shielded the **caster**, never the target — which is how the shielded case survived unseen. There is a `target-shielded` sample now, plus a floor asserting the absorbed field actually fires.
- **"I don't see damage indicators when going against bark shield."** Absorption happens before the emit, so the event carried the post-shield figure and a fully absorbed hit rendered the word ABSORBED with no number. Two floats now, and a shield chip on the card face at decision time.
- **"Huldra_V2 didn't start with a temp shield."** The OS description said she did, and had been lying since ticket 07. Ruling: **fix the copy.** Ticket 55 measured the timing deliberately (`bark_start`: 0 effects across 10,649 calls, because a battle opens mid-turn-1 in ACTION) and moving it to turn start is a buff, which she does not need at ~71%.
- **"It was too hard to build a good deck"** was two numbers. The 1-of-3 card pick was **mandatory, once per defeated body** — ~16 forced cards a run on top of the party's 18, against `economy-session.md`'s 20-25 gate, with removal at 20 and three markets. And a mid-run recruit brought **3 kit cards + 1 generic**, the first three of five, so *"it felt really bad to play Rat without his kit"* was arithmetic: 3 cards of a 12-card deck drawing 5-7 a turn. Picks are skippable per card now, and a recruit brings its whole kit with no filler.
- **"I had to farm like 7 battles to afford my 2nd mingming and remove a card."** Total run income was never short — ~215 measured, above ticket 56's 150-180 model. The run was poor exactly where the decisions are: early fights pay 10-15, the first purchases cost 25 and 20, and a run opened on **0**. It opens on **20** now, and an elite pays **45** rather than 30 (Henry: *"yes and extra elite payout"*; the figure is mine). ~260 a run.
- **"You can't see the card descriptions"** in the marketplace. Both shops withheld them on the standing law that power dies at the surface — 142 of 216 descriptions quote a power figure, and two tests enforced it with `not.toMatch(/power/i)`. **Henry repealed that clause on 2026-08-23** (power stays in card text, or cards cannot be compared). Both tests are inverted rather than deleted, and stricter: every stocked and strippable card must print its own text.
- **"We should record/log everything I do in the playtest run."** Correct, and nothing does: ten scalars per finished run, no export, no viewer, an action tape that resets at every battle. **Ticket 59** files it, and it is what ticket 25 needs to be worth running — every finding above was reconstructed from one sentence of recollection each, then confirmed by reading constants.
- Two prior blockers the same day: the starter-picker soft-lock (`9181ae7`) and the codex recorder dispatching inside a reducer, which killed every card play (`7491acf`). Both filed the interaction-test gap as **ticket 58**.
- Suite 1603 green across 120 files; tsc, lint, build and the debug-absence gate clean. Commits `463e08a`, `f29f1ee`, `c079606`.

### 2026-08-24 — Two shipped blockers, and the reason no test could see either (new ticket 58)

Henry ran the game for the first time in a while and could not get past the first screen, and then could not play a card. Both had shipped through a green suite, `tsc -b`, a blocking lint gate and a build.

- **The starter picker was a soft-lock** (`9181ae7`). `App` chose it on `roster.length === 0`. `MainMenuView` dispatches `addBlueprint`; only `assembleMingming` writes `roster`. So the click worked, the screen did not change, and every press stacked another blueprint — the screen's own copy ("Assemble it at the ranch") described a route the branch made unreachable. Fallout from 11/20 deleting `HubScreen`. The gate reads both halves now (no roster **and** no blueprints), and an empty roster opens the ranch on the Assembly bay.
- **No card could be played** (`7491acf`). `useCodexRecorder` (ticket 31) dispatched from a `globalBattleEventBus` listener. `PROGRAM_PLAYED` is emitted synchronously from `resolutionEngine.applyMutations`, **inside the reducer**, so Redux threw "You may not call store.getState() while the reducer is executing", the throw unwound back through the engine, and `state.battle` was never reassigned. `useBattleVfx` is on the same bus and is called first, so the hit animation and damage number had already played against a state that was then discarded — the play looked like it landed and wasn't there. The dispatch is on a microtask now; `emit` is deliberately left throwing.
- **The finding worth keeping: the suite has no way to say "the player did a thing, and then the game was different."** Every UI test in the repo uses `renderToStaticMarkup` — no effects, no event loop, no clicks. Both defects are invisible to it *by construction*, because the one frame it renders is correct in both cases. 1585 tests, and the first two things a player touches were broken. **Ticket 58** files the fix: a small jsdom + `createRoot` + `act` harness (which already exists in `App.errorBoundary.test.tsx`), seven click-level tests over the spine of the loop, a `console.error` trap in the harness, and a repo rule that a new clickable screen brings one interaction test with it. `@testing-library/react` is still not needed and still forbidden.
- Both fixes carry a test that was **verified to fail when the fix is reverted** — the codex one reproduces Henry's console error verbatim. Suite green at 118 files / 1593 tests.

### 2026-08-23 — Ticket 57 (apply 56's economy) — **four of six done; Relay is blocked on a 2-for-1 reducer**

- **The scrap model changed SHAPE, not just scale.** Ticket 12 rolled a band per defeated body (~450-500 a run); Henry's table pays **per fight and flat** — `scrapForWin` = 10 + 5 per extra enemy, elite 30. Scrap is predictable before you swing now, which is what makes a shop price a plan. One fewer PRNG draw per corpse, so the reward seed chain moved.
- **Buy prices are ENERGY ALONE** — `[15, 25, 35, 45]`, clamped above 3. A 2e Common and a 2e Rare both cost 35. Rarity is a drop-rate weight, not a power tier, so a shop charging for it was charging twice on the wrong axis. **Removal 20 (market and workshop), workshop assembly 25, reflash 15.**
- **`REROLL_PRICE` 20 → 10 is the one number 56 did not rule.** Ticket 13's law was "below the cheapest card"; at a cheapest card of 15 the old 20 broke it. Rescaled by ratio onto the 5-grid. Wrong by 5 if wrong.
- **Macro prices stay 32/48 but are LITERALS now.** They used to be derived from the card table; 56's reconciliation ruled them over its own 25/40, so the two rulings disagree about a 1-energy card and a live derivation would produce 25/37 and silently overturn the winner. Link cut on purpose, with a test that fails if anyone re-derives them.
- **Selling is gone end to end** — `sellPrice`, `SELL_MULTIPLIER`, `sellRunCard`, the shop control. The no-farm law used to be a clamp; it is structural now, and `MarketplaceNode.test.tsx` asserts no `/sell/i` in the markup across four states.
- **RELAY IS BLOCKED, and the middle reason is a design conflict: the built `TRANSFER_ENERGY` reducer is 2-FOR-1** (`TRANSFER_COST` 2, `TRANSFER_GAIN` 1 — it destroys energy) where 56 rules Relay as "move 1 energy". Shipping it as written sells a 48-scrap rare whose description cannot be true. Also: there is no path from a macro to that reducer (it is a top-level `BattleAction`, not an `ActionType`), and no "another ally" targeting mode — `ALLY` includes the firer and `MacroRack` defaults to it, so a mis-click would burn 2 for 1. **Needs: 1-for-1 or 2-for-1, plus sign-off on an `OTHER_ALLY` mode and a bridge.**
- **The pick pool DIFFERS from 56 ruling 1 and was not fixed.** Source is right (the live party's species decks); **the entire weighting clause is absent** — the pool is flat, the only weighting anywhere is by rarity, and "not yet in the run deck" is an explicit ticket-12 refusal. Implementing it needs `IRunState.deck` threaded into `rollDropTable` (touching `BattleArena`) *and* a bias strength nobody has ruled.
- **Already compliant:** blueprint drops (per body, 0.20/0.20/0.25/1.00; gym stays 0.50 per ticket 18's hold), the gauntlet boss (always 3 — `rollGauntletFight` never reads party size, and `GauntletNode` says so on screen), and no free energy-transfer UI anywhere.
- **The Done-when arithmetic, re-measured and pinned as a test: 215 spendable a run against 56's ~150-180 estimate.** The gap is the three elites — at a flat 30 they are 90 of it, more than the eight wilds put together. Reported, not retuned.
- **FLAG: 56 removed the last rarity gate in the market.** Rarity is out of the price and the stock was already drawn uniformly, so a Rare and a Common at the same energy cost the same and are equally likely to be stocked. If a Rare should feel rare at a stall, the gate has to be put back deliberately — a weighted draw, a scarcity cap, or a rarity term returning to `cardPrice`.
- Suite **1576 → 1585**.

### 2026-08-23 — Lint burndown CLOSED (ticket 55) — **510 to 0, the gate blocks, and six wrong annotations fell out of it**

- Henry on the test-file question: *"fix them all unless there is a reason not to."* All 256 `no-explicit-any` typed, tests included. `continue-on-error` is gone from `.github/workflows/ci.yml` — **a new lint error now fails CI**, with no backlog for it to hide in.
- **Most were noise**: `'Poison' as any` where `'Poison'` is a `StatusType`; `const action: any = {...}` where the real union member exists; seventeen reaches in `battleReducer` already legal through `ProgramAction`'s index signature; three vestigial casts in `BattleArena`. Deleting a cast was the fix more often than writing a type.
- **SIX WRONG ANNOTATIONS, found by typing around them** — the reason this was worth doing properly rather than relaxing the rule:
  1. **`PRNG.nextSeed` is two-valued**, string for a string seed and number for a number one. Typing it as the bare union broke three sites that assign it into `IBattleState.seed`; `PRNG` is **generic over its seed kind** now, so `new PRNG(state.seed)` yields `string` and the invariant is proved rather than asserted.
  2. **`RewardSystem` declared `nextSeed: number` and was wrong** — the proof sat three lines below one of them, where the caller calls `.toString()` on it.
  3. **`HookAction.element` resolved to the DOM's `Element`.** `HookTypes.ts` never imported the game's union and `lib: ["DOM"]` is on, so the global won and every hook setting an element was checked against the wrong type. One import.
  4. **`HookAction['type']` was missing `'HP'`**, which `hooks.json` uses and `HookFactory` dispatches on — the comparison needed a cast just to compile.
  5. `battleReducer`'s `removedStatusQueue` was `string` where a `StatusType` goes.
  6. `EffectHandler`'s `payload: any` meant the handler registry checked nothing; it is a keyed payload map now.
- **`ActionExecutor<T>` widened deliberately** to `T extends ProgramAction | HookAction`: `HookFactory` routes a `HookAction` through the same registry and a `HookAction` is not a `ProgramAction`. The old `ActionExecutor<any>` was hiding a genuinely second caller shape.
- **TWO `any` SURVIVE, disabled at the declaration with the argument beside them**, and both are deck-archetypes' call per this ticket's own deliverable: `ProgramAction`'s `readonly [key: string]: any` (the card data model — ~200 reads go through it before narrowing; the real fix is a discriminated union over `ActionType`, i.e. a change to how cards are authored) and `MutationRequest.payload` (fourteen mutation types with genuinely different payloads — worth doing at the same time, not before).
- Suite unmoved at **1576**.

### 2026-08-23 — Henry's rulings — **the opening fight is Slay the Spire's, and power stays on the card**

- **THE STANDING LAW IS AMENDED.** "Power dies at the surface" read as *never show it anywhere*; Henry reversed that, because out of combat you compare two cards with no target to measure against, so the printed figure is the only comparison currency there is. The law is now **"the card's printed description states its power; nothing else in the UI shows a number derived from `power`"**. **The 142 power-printing descriptions ticket 22 reported are CORRECT — do not "fix" them** — and the open request to deck-archetypes is withdrawn.
- **No code changed for that.** Ticket 22 had already scoped its assertion with `stripDescriptions()`, and the marketplace/workshop tests pass because descriptions render in a hover portal static rendering never emits. The line Henry drew is the line the code already drew.
- **The opening fight, re-ruled twice.** *"skip tips doesn't fix the first fight"* — ticket 24 tied the easy opening encounter to `seenTips`, so Skip tips silently made your first fight harder. And *"it's fine to script the first encounter to an easy fight like slay the spire"* — StS uses an easy pool for Act 1's opener **every run**. Adopting that deletes the machinery: `ONBOARDING_MODIFIER`, `createRun`'s `onboarding` input and `tips.FIRST_BATTLE_TIP_ID` are gone, and the gate is `isOpeningFight(run) = fightsResolved === 0`.
- **The first STEP is a fight now too**: `generateRegionGraph` pins biome 0 layer 1 to `wild`, so the opening move can no longer be a shop you have no scrap for — or the biome-0 elite, which was ticket 24's finding. Pockets are untouched (a pocket shares its host's layer but hangs off a middle node, never the entry), so the test asserts over the entry's neighbours.
- **Two rulings recorded, no code:** ticket 18's gym paying 3x **stays for the playtest** (*"leave it for now. we will need to play test"*), with the arithmetic restated for ticket 25; ticket 31's codex payouts are **cosmetics, once cosmetics exist** — blueprints rejected because a codex paying them pays power. There is no cosmetics ticket yet, so 31 is open on a dependency rather than a decision.

### 2026-08-22 — Codex (ticket 31, still open) — **built; the payouts are the one thing left, and they are Henry's**

- **Open on one clause only:** "completion milestones paying cosmetics or blueprints (Henry numbers)". Milestones are detected, fired once and shown; `reward` is `null` on every row. Not guessed, because **blueprints are the only persistent currency** — a codex that pays them pays power, which is the one thing `economy-session.md` forbids it — and **cosmetics do not exist**. Wiring one is a field per row plus one dispatch.
- **Five ledgers now, all `.default([])`, no version bump.** `seen` (on screen), `played` (YOU cast it), `species` (stood on a battlefield), `assembled` (you built one), `os` (equipped). Collapsing any two loses something unrecoverable — the sharpest being that "I have played Maelstrom" and "Maelstrom has been played at me" are different achievements, so the recorder checks the caster's side. `assembled`/`os` are written **inside** `assembleMingming`/`swapOS`, not by callers; `addToRoster` deliberately records nothing, because it is the debug/test seam and a fixture is not an achievement.
- **THE TICKET'S SUGGESTED SEAM WAS WRONG.** It says to log plays through the `ActionTap` middleware in `store.ts`. That slot is documented "last caller wins" and the **debug action tape holds it** — a production consumer would silently kill the tape and vice versa. Worse, `battle/playProgram` carries the card's **instance id**, not its dataId (and the card is out of the hand by the time the action lands), and the action is *intent*: `handlePlayProgram` can fizzle after the cost is paid when the caster dies paying. The `PROGRAM_PLAYED` **event** carries the dataId, fires only on a resolved play, and **is not emitted while the bus is muted** — which is free filtering of `TacticalAI`'s speculative sequences and every damage preview. `statusCensus.ts` already calls that the "0-AI-SIM-COUNTS predicate".
- **Three denominator filters, each an argument.** Tokens excluded (216 → **212**): a token is generated mid-battle by another card, so counting them makes 100% depend on drawing the right generator. The control species excluded (the registry says to enumerate through `PLAYABLE_SPECIES` "or the control shows up as a wild Mingming"). The three `boss_relic_*` firmware excluded — never equippable, so counting them makes the codex incompletable by three. The OS list is derived by inverting `availableOS` rather than reading `FIRMWARE_REGISTRY`, which also dodges a real bug: that registry is **populated lazily** and enumerating it races whatever called `getOSBehavior` first.
- `held` is **intersected** with the target rather than counted, because the ledgers are add-only and never pruned — a save holding a retired id would otherwise report 213 of 212.
- **The screen shows every slot and names only what you have met.** With zero power attached there is nothing to protect by hiding silhouettes, and a player who cannot see the target cannot pursue it. `statusGlossary` and `TypeChartPanel` are reused verbatim, not paraphrased.
- **Small finding:** the status glossary's four duality entries read "+N POWER per stack" (deck-archetypes ticket 102 re-denominated the status economy in power and derives that text from the model), and two OS descriptions use the word. The codex's power-law test therefore covers the pages it authors and excludes the two reference pages, on the record — that is the game's own vocabulary for a mechanic, not a card leaking its pricing figure.
- Suite **1549 → 1574**.

### 2026-08-22 — Lint burndown steps 1-3 (ticket 55, still open) — **452 errors -> 256, and the 256 are all one rule**

- Gate is still advisory: step 4 (`no-explicit-any`, 256) and step 5 (drop `continue-on-error`) are untouched, and 5 cannot land before 4.
- **71 of the 141 `no-unused-vars` were already correct code the linter could not read.** `StatusBehaviors.ts` (35) and `ActionExecutors.ts` (36) implement one interface each, so `onApply(_source, _target, _power)` must take three arguments whether or not Burn uses the source — position is meaning, the parameters cannot be deleted, and `void _source` eleven times is noise. `argsIgnorePattern: '^_'` teaches the linter the convention that was already in the code. `ignoreRestSiblings` is on for exactly one idiom: `const { nextProgramModifier, ...rest } = e` is how `battleReducer` STRIPS a field, so the binding must carry the real property name.
- **Four dead locals were worth reading before deleting; all four were scaffolding, none a defect.** The loudest: `battleReducer.ts:288` held a **second copy of the cost-discount arithmetic**, harmless only because `getEffectiveCardCost` already applies `nextProgramModifier.costReduction` — it fed nothing and could only ever disagree. Also a hand-built `HookContext` passed to nothing, a `GetBaseCost` with no callers that could not have handled X-cost anyway, and `LEVEL_UP_OVERLAY_DELAY_MS` outliving the overlay ticket 21 deleted.
- **`react-hooks/refs` found a real bug.** Three hover tooltips read `getBoundingClientRect()` during render as `style={ref.current ? (...) : {}}`. The render-phase read is the rule's complaint and is not a bug today; **the `: {}` branch is** — on the first render of a newly mounted anchor the ref is null and the portal renders unpositioned, `position: static`, top-left of the body. `ui/hooks/useAnchoredRect.ts` now measures in `useLayoutEffect` for all three, and `rect === null` means *hidden* rather than *misplaced*.
- **`no-case-declarations` was not purely stylistic:** `const` in an unbraced case is scoped to the whole switch, so `ConditionValidator`'s `op`/`valStr`/`threshold` sat in the temporal dead zone of every case below them.
- **Six hook findings reviewed and disabled with the argument in the file**, not restructured: transition-driven `setActiveTab`, two timer-owned FX one-shots, the seeded reward roll (a render-phase derivation could roll twice under StrictMode and change the drop), the art-fallback reset, the latest-value ref in `useBattleVfx` (written during render because the bus listener fires synchronously inside the same commit), and `SaveEditorPanel`'s memo whose `save` dep is a trigger rather than a read.
- **`react-refresh` fixed by extraction, not suppression:** `cardIcons.ts`, `cardKeywords.ts`, `elementMatchups.ts`. Those helpers were never component-local — four other files already imported them — and a module mixing a component with plain functions was throwing away component state on every hot reload.
- Suite unmoved at **1547**; `tsc -b` clean; build green.

### 2026-08-22 — Settings screen (ticket 36) — **two of its eleven items were wrong about the game**

- **There is no music.** `AudioEngine` is one gain node over synthesized SFX with a single `{volume, muted}` pair, so "master/music/SFX volume" cannot be built without inventing two channels. One volume control ships — the existing `AudioControls`, rendered rather than reimplemented so two sliders cannot disagree. Ticket 35 earns the split.
- **There is no main menu.** `MainMenuView` is the first-run starter picker (three cards, roster-0 only) — no Continue, no Quit, nothing to hang "reachable from the main menu" on. Entry points are the nav bar and **Esc in a fight**. A real main menu is ticket 34's.
- **Esc is sequenced, not rebound.** Ticket 22's Esc clears the selection — the only way a keyboard player drops a half-built play. Now: clears if anything is selected, **opens settings if nothing is**. The reversible binding wins the tie (press it twice and you get settings anyway). The overlay is `state.ui`; the battle stays mounted and **nothing on the screen dispatches at the battle reducer**, which is the rest of the Done-when.
- **A fourth slice, `uiSlice`, for one boolean** — two unrelated places open the same overlay and `BattleArena` cannot reach a `useState` in `App`. Ticket 09's precedent; two hand-built test stores needed the reducer added. Session state only: the settings themselves are not in Redux.
- **`ui/keybinds.ts` is now the one copy of the bindings.** Ticket 22 wrote them twice (a handler and a hardcoded legend string whose comment said "a fight has no options screen to hide a key list behind"); this screen would have been the third. The strip and the settings table are both generated, and the handler compares against the table's constants. **Remap is NOT built** and the screen says so — the stored overrides, conflict checker and capture UI are the actual work, and "what does ⇧W/E/R mean once W moved" is a real question.
- **Reduced motion is three-state (system / on / off), and that needed CSS surgery.** The JS override reaches all seven `prefersReducedMotion()` callers for free, but the five `@media (prefers-reduced-motion: reduce)` blocks cannot be reached from JS — they are scoped `:root:not([data-reduced-motion])` now, with a matching `[data-reduced-motion="on"]` block beside each. **That is what makes "off" real**: without it a player whose OS says reduce could never get animation back. `system` leaves NO attribute, so anyone who never opens the screen is on exactly the old behaviour.
- **Text size is a four-rung ladder (90/100/115/130%), not a slider**, and the screen says why next to the control: ticket 22 measured the console to the pixel and `body`/`#root`/`.battle-screen` are all `overflow: hidden`, so the top rung crowds the hand. Ticket 37 owns the real layout audit.
- **The ticket-11 orphan is home.** `SaveSystem.deleteSave()` had ZERO callers and a docblock describing a hub deleted two tickets ago. `ui/settings/wipeSave.ts` is three steps, not one — clear the run, reset the ranch, remove the bytes (plus run telemetry) — because clearing only the bytes is undone by the next autosave. Two-step arm/confirm, no `window.confirm` (ticket 19's rule), and `dispatch` is a parameter so the destructive path is testable.
- **Deferred and named on screen** rather than shipped as dead controls: fullscreen/resolution (37), colourblind palette (38 — the eight `--fire`/`--water`/... custom properties are the seam), licence text (54).
- Settings live at `mingming_settings`, a top-level key with no slot prefix, following `mingming_audio` and `mingming_run_telemetry`: switching save slot must not change how loud or how big the game is. `.default()` not `.catch()`.
- Suite **1514 → 1547**.

### 2026-08-22 — Onboarding-lite (ticket 24) — **and the first fight of a first run could be a tuned elite**

- **THE FINDING, and the reason half this ticket exists.** `generateRegionGraph` draws biome-0 layer-1 kinds from the shuffled `[marketplace, workshop, ...weighted pool]` list, and that pool contains **`elite`** — which `kitFractionFor` gives the FULL tuned per-OS deck *regardless of depth*. A brand-new player, one mingming, eight cards, can meet a complete tuned list as their **first ever fight**. An `ambush` there is two enemies against their one. Either ends the run before the tutorial finishes its sentence.
- **The ticket's premise was wrong and is replaced, not faked.** It asks for Epic8's "Initiation", whose defining mechanic is a *scripted counter* — the opponent's element picked to counter your starter. Ticket 07 made that unbuildable: the biome's element **is** the promise the map makes, and the player chose that biome two screens earlier on the gym offer. Epic8 also puts the fight in a Training Hub `vision.md` deleted.
- **What shipped instead is a FLOOR.** A run created while `seenTips` lacks the first battle tip carries an `onboarding` modifier; its **first** fight is pinned to one enemy holding `KIT_FRACTION_BY_BIOME[0]` — the same eight cards the player is holding, no firmware. Nothing else changes: same seed, same species pool, same IVs, and where the node was already gentle a test asserts the two rolls are **byte-identical**. **FLAGGED FOR HENRY, one function to delete.** The alternative fix is one line in `generateRegionGraph` pinning biome-0 layer-1 to `wild` — but that changes the map for every run forever, which is his ruling, not this ticket's.
- **One piece of state does both halves.** `IRanchState.seenTips`, `.default([])`, **no version bump** (a v4 save without the field is a player who has seen no tips). On the ranch, not the run, so dying in biome 0 does not un-teach you. Consequence worth knowing: **"Skip tips" turns the softened first fight off too** — a player who says they do not need teaching is not quietly handed an easier fight anyway.
- Nine tips: five in the fight (energy, play, STAB, the type chart, end turn), three on the map (types are visible, the gym is the run, workshops grow the team), one on the ranch (blueprints are what you keep). One at a time, in a priority order, each waiting for the moment it is actually true — STAB waits for a card that could STAB, the matchup tip for a non-neutral pairing really on the field, the workshop tip for a workshop **one step away**.
- **Two deliberate departures from the ticket's list.** The type chart moved ahead of END TURN (a matchup is worth knowing while you still have energy), and `battle:endturn` fires on "you played a card" rather than "you cannot afford anything" — the honest version of the second is a cost-pipeline run per (card, caster) on every render, to answer a question the greyed-out cards already answer. The sentence was rewritten to match the moment that does fire.
- **The callout is a strip, not a coach mark, and that was costed.** Anchoring a bubble means hand-rolled `getBoundingClientRect` + listeners (no positioning library, no lockfile change) dropped into the one layout ticket 22 tuned to the pixel — and a measured position is one **no test here can ever see**. The moment is contextual instead, and the sentence names the thing in words.
- **What cannot be tested, said plainly:** that clicking "Got it" advances the sequence. No `@testing-library/react`, and `renderToStaticMarkup` runs no effects. Splitting the predicates into `engine/tips.ts` is what reduces the untested surface to a single `onClick` line; the sequence itself is covered exhaustively.
- **For ticket 25:** there is no "replay onboarding" button. Watching a second tester means `resetSave` today. That belongs with the run-editor panel the debug-toolkit map still needs.
- Suite **1480 → 1514**.

### 2026-08-22 — 3v3 game-side (ticket 22) — **and the standing law turns out to be broken in the data**

- **READ THIS: 142 of the 216 card descriptions print their power figure.** `fire_punch_v2` reads "30 power."; `scorch` reads "25 power. Apply 3 Burn." The power-dies-at-the-surface law is broken on the card face, in the data.
- **And ticket 13's identical assertion passed over it.** `ProgramCard` renders a description only inside a **hover portal**, which `renderToStaticMarkup` never produces — so "no /power/i in the markup" was true of the markup and false of the screen. The battle hand renders descriptions unconditionally, which is the only reason it surfaced. **Anyone writing a power-leak test should render the hover state, not the card.**
- **Not fixed here, deliberately.** Rewriting 142 cards' copy is a content pass with balance-communication consequences (for some cards that string is the only place the scaling is explained, and `drawScaling.test.ts` asserts against two), it is Henry's call how each reads, and it belongs to **deck-archetypes**. Filed as a request on the map's scope-boundary line.
- `formatAction` was *also* printing `action.power` — the leak `MacroRack.test.tsx` names by file and function as the likeliest break. Gone.
- **Previews are caster-aware, always-on, and name their subject.** Reuses ticket 15's cast-and-measure; `simulatePlay` lifted out of `computeDamagePreview` so heal figures use the identical helper. Memoised on `(state, caster, target, card)` in a WeakMap keyed by **state identity** — the state is immutable and replaced wholesale, so staleness and cache invalidation are the same event.
- **Six-entity energy fits 1280x800, with the sum in the CSS.** 126px of pip budget; six pips = 108.6px, seven = 127.1px. Six is the ceiling **by one pixel**. Compacts to a bar past six rather than wrapping, because wrapping would spend the whole 30px of vertical slack. `Energized` carryover gets its own cyan pip — a state the old bar clamped away.
- **Keyboard: there was no key that picked an enemy and no key that committed a play.** A keyboard player could arrange an entire fight and never take a swing. A/S/D, Shift+W/E/R, Tab, Enter, Z/X/C added, with a legend. Still mouse-only: the drag gesture (function fully covered) and `BattleReport`'s reward/driver pickers, which are `<div onClick>` — ticket 12/16 territory and ticket 38 will want them.
- `TRANSFER_ENERGY` left unwired as the ticket instructs; cutting it is ~60 lines and 3 test cases with no callers to migrate.
- Suite **1436 → 1480**.

### 2026-08-22 — Run end (ticket 19) — **the loop is closed**

- **One `teardownRun` for all three endings** (victory, defeat, abandon), because three separately-written endings drift. It is the *complete* description of what an ending does to the ranch, which is how "defeat and abandon unlock nothing" became checkable in one place. The victory unlock is dispatched twice on purpose — `BattleArena` banks it when it happens (ticket 12's argument) and teardown does it again; both reducers are idempotent and a test runs teardown twice.
- **The ranch surviving a defeat now has a test.** That is how ticket 11's save-wipe bug stays fixed.
- **Two things the summary could not honestly report, so it does not.** "Scrap spent" is not derivable — `IRunState.scrap` is one balance with two writers and no totals — so the screen shows the closing balance and says so in those words, with a test asserting the phrase "scrap spent" never appears. And the deck's starting size is not exact once a mid-run recruit joins with 4; what *is* exact is `IRunCard.ownerId` (the ratified type reserves `null` for bought/drafted/granted), so it reports picked vs kit and they sum.
- **The summary reports, it does not pay.** Blueprints bank at drop (ticket 12). To say so on screen without giving the ranch a provenance field, the run keeps a `banked:blueprint:<id>` ledger in `IRunState.modifiers` — ticket 15's map-reveal precedent — with the ranch credit still going first, so a crash between the two costs a line on a screen, never a blueprint.
- **Codex: the honest minimum.** Teardown merges the run's card dataIds into `codex.seen`, deduped. The seen/played distinction is **ticket 31's** — `played` needs an in-battle hook — and this records only what the run *held*, so a card bought and later sold is not in it.
- **Run clock is local-only, behind the storage adapter** (`mingming_run_telemetry`, never a slot key), zod-validated, bounded at 50 entries trimmed from the front. Written on summary **mount** so the duration is the run and not the reading time; idempotent on `seed@startedAt`, which covers StrictMode and an app reopened on the summary.
- **`window.confirm` is gone** — abandon is an inline two-step. The summary is not the confirmation: by the time it renders the run has already ended and there is no way back to the map, so something still has to stand between one stray click and forty minutes, and it should not be an unstyleable, gamepad-unreachable native modal.
- Suite **1380 → 1436**.

### 2026-08-22 — Gym gauntlet refit (ticket 18) — **the exam exists, and the gym now overpays 3x**

- Three unhealed fights, a boss drawn from **the run's own three biomes** with `boss_relic_*` firmware (de-duped so two biomes sharing an element cannot stack the same relic), and a Pit Stop between fights showing HP, the macro rack and the next opponent's types.
- **Both questions the ticket said to ask Henry were taken as readings, both cheap to reverse.** Statuses do NOT carry — the ratified `IGauntletProgress` has nowhere to put one and v3's schema said it outright, plus carrying Burn would make Kindle the best macro for fight 1 and dead for the other two. And the boss team is **always three whatever the player brings** — two workshops exist to get you there, which is what makes "recruiting IS drafting" mean anything; `GAUNTLET_ENEMY_COUNT` + `enemyPartySize` are two lines to soften it.
- **LOUDEST OPEN ITEM: the gym pays three times what ticket 12 sized it for.** `BLUEPRINT_DROP_RATE.gym` and `SCRAP_PER_ENEMY.gym` were set when the gym was ONE fight; three fights of three bodies is ~4.5 blueprints and ~225 scrap a gauntlet. Blueprints are the only persistent currency. One line to change once Henry rules; `RewardSystem`'s own comment already predicted 18 would want one authored award instead.
- Deleted from `battleFactories`: the whole hardcoded gauntlet branch — `synergyMap`, the tier-1 grunt roll, the `${element} Sector Warden` at 1.5x HP with three hardcoded moves and two Firewall Sentinels. **`IBattleSetup.gauntlet` went with it**; a gauntlet now hands the factory nothing but `persistedHp`.
- **`GauntletContext` reconciled with `IGauntletProgress`, no version bump — checked, not assumed:** all 37 committed scenarios carry `gauntlet: null` or omit it (it is composed-only and `createDraft` hardcodes null), and all 14 `playtest-results/` files are snapshots with no `setup`. Bumping with nothing to migrate would re-stamp every future file to describe a no-op.
- **Revive's hook is wired both ways** — at fire time and again in `advanceGauntlet`'s recompute — so a revive cannot be lost to ordering. The economy stays ticket 25's.
- **The FTK/stall gate exists over all eight boss comps** (the whole boss space, not a sample): `npx vitest run --config vitest.balance.config.ts src/debug/balance/gauntlet-boss.balance.ts`. **The full gate has since run (96 battles, 63 min): FTK 0, pooled 7.4 turns, GREEN — and the player panel won 1 of 96 (95.8% boss).** All three stalls are huldra comps against `panel-mixed-b` — `boss_relic_water` out-healing the one panel that cannot out-damage it, the exact failure mode the suite was written to watch. The win rate is printed, not redlined, because the harness cannot model the two fights' worth of spent HP a real gauntlet arrives on — but it is the number ticket 25's playtest reads against, and ticket 28 should hold it in view when it authors real leaders. Also measured: a 3v3 costs ~300x a 1v1 in this harness (pre-existing to ticket 98).
- Suite **1323 → 1380**.

### 2026-08-22 — Macros (ticket 15) — **thirteen of them, and the one action the vocabulary could not express**

- **The design doc says "The 11" and then names twelve** (7 commons + 5 rares). The list is what was designed, so all twelve ship; with ticket 07's map-reveal that is **13 registry entries**. Nothing was cut to make the prose arithmetic true.
- **The `Recharge` trap the ticket warned about is avoided and proved.** `processPreTurn` SETS `currentEnergy` — the thing that bit three OSes. The `ENERGY` action's mutation is `max(0, current + amount)`, an add on the live value, and the test drives it past `maxEnergy` (4 of 3), which no SET can produce.
- **`REVIVE` is the one thing the action vocabulary could not express.** Every resolution loop skips a target at `currentHp <= 0` — correct for all 216 cards, and exactly what a revive must not do. `HEAL` could not be pressed into service: it would hand the ability to every heal card the day that guard was relaxed. Added as an ordinary `ActionType` + executor, with `handleFireMacro` the only site that lets a target past the alive-check. **`registryHash` is unchanged** (it hashes the three registries, not the action enum), so no stored snapshot moved.
- **Two readings flagged.** A macro does **not** count as a card play — `CARDS_PLAYED` scalers are deliberately uncapped (ticket 74) because they reward playing out of your deck, and a bought consumable that inflated them would be a purchasable multiplier; leaving `lastProgramPlayed` alone is also what makes Echo's "replay your last **card**" literally true. And pricing reads as two flat tiers (32/48) rather than rarity-priced-then-x1.5, which charges rares for rarity twice and lands one at 108 — most of a market visit.
- **The map-reveal needed no new field.** It writes `reveal:biome:N` into `IRunState.modifiers` and `regionLayout`'s fog rule gained a third clause. Refuses a second survey of the same biome rather than burning a consumable for nothing.
- **Echo has no stale-target problem**: `lastProgramPlayed` is a bare dataId with no target, so the player re-aims every time; aiming at a corpse is refused with the slot intact, and Echo with nothing played is refused rather than spent on a log line.
- **Ticket 18 inherits three Revive questions**, written into 15's resolution: write the revive back into `IGauntletProgress` (out of `downedMemberIds`, into `persistedHp`) or the next fight re-downs them; decide whether 50% is right across three unhealed fights; decide whether a downed member can be revived *between* fights.
- Suite **1235 → 1323**.

### 2026-08-22 — Workshop node (ticket 14) — **the run's three sinks now quote against each other**

- **The number this ticket owns: `WORKSHOP_ASSEMBLY_SCRAP = 75`**, derived rather than picked. 450 income ÷ 3 guaranteed markets = 150 a visit; ÷ 2 recruits (the ruled 1→2→3) = 75. Deliberately the same sentence ticket 13 wrote about removal, so the sinks are comparable: **of the three market visits a run earns, one buys the team, one strips the filler, one buys cards.** One recruit ≈ 1.6 cards' worth of shop (median rewardable card = 48, computed from the registry and asserted).
- **Reflash at 40 is flagged as a READING.** Ticket 06's ruling names *assembly* and is silent on reflash. Narrow = free; wide takes the ruling's mechanism (a mid-run transaction spends run currency so it competes with the market) and notes that a reflash re-aims both `rewardCardPool` and `rollMarketStock` for the rest of the run. **Set the constant to 0 to read it narrowly** — the price is a payload, never a literal.
- **Removal is same-as-market**, re-exported rather than re-declared. Cheaper here would falsify ticket 13's derivation without retuning it (everyone would do all five at workshops) and make the market's button a decoy. Its real job is a floor: a blueprint drops from ~20% of wilds, so most workshops are walked into empty-handed.
- **The dispatch-ordering argument is a TEST, not a comment.** Assembly writes both slices and no reducer can, so it is two dispatches; both orders were executed against the real store and handed to `reconcileLoadedState`. Ranch-first: blueprint spent, individual on the roster, run resumes — that is the ranch transaction exactly. Run-first: `partyIds` names a member the roster lacks, so reconcile is *obliged* to discard, and forty minutes goes instead of 75 scrap.
- **The recruit's stat roll comes from `nodeSeed(run, node, 'workshop')`**, not a fresh roll — the workshop is a node's contents, so ticket 07's re-roll rule and ticket 23's resume both apply. Never previewed, so it is a detour rather than a scum button.
- `party.ts`'s note predicted this ticket would be `legalParty`'s first caller; it used `partyBlockFor` instead, so the note now records the correction. **`legalParty` still has no production caller.**
- Suite **1163 → 1235**.

### 2026-08-22 — Marketplace node (ticket 13) — **the economy has numbers, and "power dies at the surface" has a test**

- Buy / sell / remove / reroll, as a panel on `RunScreen` (not a route — the map stays visible, so there is no "leave the shop" button to get stuck behind).
- **Every number derived from ticket 12's anchor and flagged as a proposal.** 450 scrap ÷ 3 markets = ~150 per visit. Stock 5 + 1 off-pool wildcard; cards 24/40/64/96 by rarity, +8 per energy; sell 0.4x; reroll 20; **removal 30**, which is Henry's stated target done as arithmetic (3 start generics + 1 per recruit on a 1→2→3 party = 5; 150 / 5 = 30). **The test computes that from the constants**, so retuning `START_GENERICS` or the visit count fails the test rather than quietly falsifying the comment.
- **The standing law finally has a test.** `cardPrice` is a pure function of (rarity, energy): two cards identical but for `power` price identically, and the rendered markup contains no `/power/i`. That second assertion cost us card descriptions on the offer row — several of them say the number out loud (`water_slap`: "priced at 12 power to compensate").
- `sell < buy` for all 216 registry cards **by construction** — sell is derived from buy, so it is arithmetic rather than vigilance.
- **Two things `IRunState` had no field for, solved without touching the ratified type.** Sold-out is derived: offer `IRunCard`s are minted inside `rollMarketStock` from the node seed, so an offer is sold exactly when its instance id is already in the deck (survives a resume for free, and the duplicate-id refusal is also a correctness guard — two deck cards sharing an id would both vanish on one removal). And the reroll is a **paid re-entry** — it increments the node's `visited`, which buys precisely what walking away and back already buys.
- `nodeSeed(run, node, purpose)` extracted; `encounterSeed` calls it and the derived string is **byte-identical**, pinned by a test, so no stored encounter changed.
- Suite **1107 → 1163**.

### 2026-08-22 — Rewards refit (ticket 12) — **every economy number is now one table, and all of them want Henry**

- A won fight pays scrap + one pick-1-of-3 per defeated enemy + maybe a blueprint. `IRewardBundle.totalXP` is deleted from the type, so XP has no slot to reappear in.
- **Two exported tables keyed by node kind, every value a proposal.** `BLUEPRINT_DROP_RATE`: wild/ambush 0.20, elite 0.25, **alpha 1.00 (ruled by ticket 07)**, gym 0.50 placeholder. `SCRAP_PER_ENEMY`: wild 8–14, ambush 10–16, elite 18–26, alpha 30–40, gym 20–30 — a full 8–10 fight run with three members lands near **450–500 scrap**, and **ticket 13 calibrates against this and may move it**.
- **`getBlueprintRate(rosterSize)` is deleted.** It scaled drops by roster size (0.75/0.50/0.15) — mercy when a blueprint was a dedup'd permission, inverted now it is currency: roster size records blueprints already SPENT, so it throttled hardest on the player deepest in the grind Henry blessed, and it would have delivered the alpha's ruled 100% as 15%.
- **The blueprint banks when it DROPS, not on CONTINUE.** It was firing from component state on the button, so winning a fight and closing the app on the reward screen lost it outright — and "dead runs still pay forward" only means something if the payment does not wait on a click. Idempotent per battle seed via a ref (a state guard double-credits under StrictMode). Scrap/cards/driver deliberately still land on claim: they are run-scoped and the run resumes into the identical re-rolled fight, so paying early would pay twice.
- **The last open economy item shipped as the recommendation, behind one function.** `rewardCardPool` draws from the current party's species pools (ticket 08: a species' untagged kit cards are in the pool while it is in the party). Alternatives named in its doc comment; **Henry's ruling changes that one function and nothing else**.
- Repeat fights pay full rewards — asserted four ways, including flat mean scrap across visits 1/2/3/6/12. `rollDropTable` cannot see a visit count or a run, so a falloff cannot be added by accident.
- Flagged not fixed: closing the app on the reward screen resumes the same unfinished encounter, so re-winning banks the blueprint again. Bounded by the sanctioned farm (one won fight per blueprint either way).
- **Process note for future sessions: the cloud working copy's `docs/` tree goes stale.** A subagent wrote this resolution against a stale ticket 12 that was missing Henry's 07/08 amendment; transferring it would have silently reverted him. Resolutions are now written on the device, and only `src/` is ever transferred.
- Suite **1077 → 1107**.

### 2026-08-22 — Node encounter flow (ticket 11) — **the loop closes, and a save-wipe bug was one lost fight away**

- **READ THIS ONE FIRST.** `BattleArena` called `deleteSave()` the instant the player's last unit fell, and again in `handleDefeatReset`, and the overlay said "DATA WIPED". That was correct when a save WAS the run. Since ticket 23 it is the **ranch** — every assembled individual, every blueprint, the codex. **Losing a biome-1 wild would have deleted all of it.** Latent (nothing could reach a run defeat until today) but it would have gone off the first time Henry lost. Both calls removed; defeat dispatches `endRun('defeat')` and touches nothing durable.
- **`ranchProjection` is deleted.** `state.game` is `IRanchState` exactly; `App` dispatches `loadSave(result.ranch)` verbatim. Cards, deck, scrap, relics and the gauntlet all live on the run now. `activeParty` left the ranch entirely — the party is picked at run start, so the species clause lives in `RunStart` and `reconcileLoadedState`. `legalParty` is deliberately kept with no caller for ticket 14's mid-run recruiting, pinned by its own test.
- **`createBattleState` takes `IBattleSetup`, not a save.** This was far smaller than feared: there was exactly ONE production call site, and the balance harness never touched `IPlayerSave` — it goes through `buildScenarioState`. Deleted with it: `IPlayerSave`, `IActiveDeck`, `PlayerSaveSchema`, `createDefaultSave`, `createStarterSave`, `DECK_SIZE`, `MIN_DECK_SIZE`, `deckGrantKey`, `OS_SWAP_PICK_COUNT`, `IGauntletState`, `deckSuggest.ts`, and the three legacy screens.
- **Encounters roll from run seed + node id + visit count**, so re-entering a wild is a different fight, both directions tested. Ticket 08's kit fraction is one knob `KIT_FRACTION_BY_BIOME`, and biome 1's enemy deck is built by the same `startKitIdsFor` the player's is so the two cannot drift. A test builds one species at biome 1 and biome 3 and asserts the stats are identical — only deck and OS differ.
- **Full heal between nodes was already true by construction** (three independent legs), so it is asserted rather than implemented.
- **NEEDS HENRY: run fights are `enemyMode: 'CARDS'`.** A MOVES enemy is never dealt a hand, so under the engine default ticket 08's whole ruling would be computed and never played — and the balance corpus is CARDS on both sides. It changes how a fight reads, so it is one constant (`RUN_ENEMY_MODE`) and one line to unmake.
- **The debug toolkit lost five verbs** — grant scraps / cards / relic, unlock sector, heal party — because they wrote fields the ranch no longer has and there is no run editor to move them to. That is a real gap for playtesting the run loop; **a run-editor panel wants a ticket in the debug-toolkit wayfinder**, which is not this map's to add.
- **Two deliberate deferrals:** the `game` slice is still named `game` though it holds only the ranch (a pure rename wants its own commit), and the gauntlet chain is deleted rather than ported — **ticket 18 is amended to rebuild it**.
- Suite **1064 → 1077** (dipping to 1040 mid-refactor as the deck-builder, kit-grant, starter-save and deckSuggest suites went with their subjects).

### 2026-08-22 — Region map screen (ticket 10) — **the graph is drawn, and the fog rule grew two clauses**

- **Layout is a pure module** (`ui/screens/regionLayout.ts`), not part of the component. Ticket 06 removed `x`/`y` from `IRegionNode` deliberately — position is derivable from `(biomeIndex, layer)` and storing pixels would freeze a UI decision into the save — so layout is a pure function, testable without a DOM, and ticket 34 can re-lay-out the map without touching a save. Column is `biomeIndex * 5 + layer`; pockets sort last in their column so the main route reads as a spine.
- **Fog needed two clauses the ruling implies but does not state.** (1) Anywhere you have already stood stays revealed — fog that forgets where you walked is amnesia, and it would break the backtracking ticket 07 explicitly allows. (2) Fog hides the KIND, never the node: the graph's shape is public so routing is a decision. There is a test that **the gym icon is not on screen on turn one**, which is the specific leak an "always show the destination" convenience would open.
- **Visited nodes show a COUNT, never a grey-out.** Entering a node triggers it again always, and farming is fine; a map that showed a cleared wild as spent would say the opposite. Test asserts the markup contains no "cleared"/"spent"/"exhausted".
- **Accessibility is two renderings of one thing:** the SVG is `aria-hidden` and a real `<nav>` of buttons underneath is the control. Hand-rolling focus and roles onto an SVG `<g>` narrates badly however much work you put in; a button list is correct by construction. **Ticket 38 inherits a keyboard-operable screen rather than a retrofit**, and ticket 34 can restyle the picture without touching it.
- **Steam Deck:** `viewBox` units scrolling in an `overflow-x` container. A 15-column region is honestly wider than 1280px and panning beats shrinking nodes below readable. Ticket 37 gets a window, not a squash.
- Suite **1045 → 1064**; `tsc -b` clean; build green; new files lint-clean.

### 2026-08-22 — Run start (ticket 09) — **a run exists, and it survives closing the app**

- **`engine/run/` is new**: `regionGraph.ts` (the TS port of ticket 07's Python prototype, ruled parameters in one exported `REGION_PARAMS`), `gyms.ts` (`GYM_REGISTRY` + `offerGyms`), `createRun.ts` (`createRun`, `startDeckFor`, and `recruitDeckFor` for ticket 14). All seeded through `SeedStream`; no `Math.random`, and **no `Date.now()` — `startedAt` is injected**, because an engine module that reads the clock cannot be tested deterministically.
- **The second autosave arm landed.** `store.ts` now watches `game` and `run` separately, so the two-key split is real rather than nominal: travelling a node does not rewrite the ranch, and `clearRun` REMOVES the run key rather than writing a null envelope. `runSlice.test.ts` asserts both directions.
- **Start deck = 5 `startKit` + 3 `water_slap`.** Henry ratified the 12 tag sets in `e2ec61f`; the generic was left as my call and the answer is reuse, not a new `basic_strike` — adding a card changes `ProgramRegistry`, which changes `registryHash`, which invalidates every stored snapshot in `playtest-results/`.
- **THREE THINGS FOR HENRY, all in the ticket's resolution.** (1) Ticket 07's node mix and its one-market-one-workshop guarantee are mutually exclusive at these biome widths; I made the guarantee win and measured the cost (markets/workshops ~13% vs the ruled 8%; shortest path 8.19 fights vs the prototype's 6.7 — the lever is the event weight). (2) "Gym element last" + "three different openings" makes the opening a derangement of 3, of which there are exactly **two**, so the offer screen has only two possible shapes. (3) `kraken_v2` starts with five doubles out of eight cards.
- **SCOPE MOVED TO TICKET 11, deliberately.** 09's own note said it would delete `ranchProjection` and move the six run-scoped fields. It does not. Those are the same job as moving `createBattleState` off `IPlayerSave` — and `createBattleState` is what the **whole balance harness and scenario system** call. Ticket 11 has been amended to own: the field move, the projection deletion, `addToRoster`'s base-deck grant, the DEV-only legacy tabs, the node trigger, and ticket 08's per-depth `kitFraction` for enemy decks.
- `MainMenuView`'s starter pick now grants a **blueprint** instead of a whole save; `startNewGauntlet` is deleted. The ranch is the single path.
- `RunScreen` is a shell with a plain neighbour list where the map goes. **Ticket 10 drops `RegionMap` into it** — the placeholder says so in as many words so nobody mistakes it for the finished screen.
- Suite **1002 → 1045**; `tsc -b` clean; build green.

### 2026-08-22 — Ranch-minimal (ticket 20) — **one screen, one currency, and the species clause is finally real**

- **Blueprints are `Record<species, count>` now.** This was the actual work; the screens fell out of it. v3 held `IBlueprint[]` **deduplicated on `architectureId`** — coherent for a permission ("you may build this"), incoherent for currency, which is what `vision.md` ruled them. `IBlueprint` is deleted along with its flat 100-scrap `compileCost`. Reward bundles carry species ids; `addBlueprint` stacks.
- **Assembly and reflash each cost ONE blueprint and no scrap.** The ranch has no scrap economy at all — scrap is run-scoped, so charging it there charges a currency the player cannot bring home. A blueprint *plus* scrap is the **workshop** price (ticket 14 owns the number). New atomic `assembleMingming` reducer: the old flow was `spendScrap` then `addToRoster` with the affordability check in a component, and anything landing between them produced a free unit.
- **`src/engine/party.ts` is new and is where the species clause lives.** Before this it was enforced NOWHERE — `debug/balance/teamComps.ts` called it an open question, gap audit §5 confirmed no code checked it, and ticket 23's `reconcileLoadedState` could only discard a run after the fact. Three call sites now share one implementation: `setActiveParty`, `applyRanchState` (which was a real gap — a pre-20 save could hydrate a party the reducer refuses to produce), and the screen, which **says why** rather than swallowing the click. The ROSTER may hold three krakens; the PARTY may field one. Re-assembly is the re-roll.
- **Tab shell: `RanchScreen` is the only player-facing tab.** Roster/Lab/Relics absorbed (three files retired to `_to_delete/ticket-20-screens/`). **Hub, Sectors and Deck are demoted to DEV-ONLY, not deleted** — deleting them would remove the only way to start a fight before 09/10 exist and take the debug scenario launcher's saved-deck mode with it. Tickets 09 and 10 delete them.
- **Two knock-ons for later tickets.** (1) The "restart run (wipe data)" button lived on the Hub, so a **player-facing wipe is currently unreachable — ticket 36 should carry it.** (2) `addToRoster` still grants a species base deck into `cardInventory`; that is legacy under the run-scoped model and survives only as the launcher's card source until **ticket 09** grants the start kit from ticket 08's `startKit` tags.
- New screen has a co-located `RanchScreen.css` (the `DeckTerminal.css` precedent) built on `auto-fill` grids and relative units, so ticket 37's Steam Deck pass has nothing to undo.
- Suite **916 → 939**; `tsc -b` clean; build green; new files lint-clean.

### 2026-08-21 — Save schema v4 (ticket 23) — **v4 is the floor, and the run half has nowhere to live yet**

- **Two keys, written independently.** `mingming_ranch__<slot>` and `mingming_run__<slot>`. `saveRun(null)` *removes* the key rather than writing a null envelope, so "not in a run" has exactly one representation. `reconcileLoadedState` ported from the prototype and green: a corrupt run costs the run, never the ranch.
- **Ordering is the guarantee, three times over.** (1) The **version check runs BEFORE the schema parse** — a v3 blob also fails `RanchSaveSchema`, so parsing first would report it as an *error*, and ticket 04's loader treats an error as damage and clings to the bytes. Checking version first is what makes a pre-v4 save read as a **new player**. There is a test asserting the ordering, not just the outcome. (2) validate → serialize → write, so every failure path leaves the last good bytes. (3) index-before-payload in `SaveSlots`.
- **`.catch()` → `.default()` everywhere persistent.** This was a live v3 data-loss bug, not a style preference: one malformed blueprint entry parsed clean as an EMPTY inventory and the next autosave wrote that over the good save.
- **The storage-adapter seam landed here, not in 42** (`engine/save/storage.ts`). `grep -rn "localStorage" src` now hits **only that file**, comments included — `AudioEngine` migrated too. Ticket 42 implements `FileSaveStorage` behind `ISaveStorage` and calls `setSaveStorage` once at Electron boot; nothing else should need to change. Note audio settings now ride the same backend under their own key.
- **THE THING TO KNOW BEFORE YOU OPEN THE BUILD.** `IRanchState` drops `cardInventory`, `activeDeck`, `scrapCount`, `relics`, `gauntlet`, `baseDecksGranted` — six fields read by **~40 files**, including the whole balance harness and the scenario system. Rewriting the slice to `IRanchState` today would rewrite all of them and 09–15 would rewrite them again. So the slice shape is untouched and the **save boundary translates**: `engine/save/ranchProjection.ts`, `toRanchState` out / `applyRanchState` in, with a delete-me-in-09 note on it. **A reload therefore keeps your roster and blueprints and drops your cards, deck and scrap.** That is 06's ruling (all six are run-scoped) rather than a shortcut, and `ranchProjection.test.ts` asserts it deliberately so nobody "fixes" it without reading 06 — but it is a real difference in the playable build.
- **What 09 inherits:** delete `ranchProjection.ts`, move the six fields into `IRunState`, and grow `store.ts`'s autosave a second arm calling `saveRun` on run-slice changes. The subscription carries a comment saying exactly that.
- **Debug toolkit:** the save-editor's file import **validates instead of upgrading** (its `migrated` flag became `defaulted`); the slots panel vets payloads against `RanchSaveSchema` and shows both keys. `PlayerSaveSchema` moved to `gameTypes.ts`, because it validates the in-memory slice now and not the save.
- Suite **906 → 916**; `tsc -b` clean; build green; lint unchanged (pre-existing).

### 2026-08-21 — Run data model (ticket 06) — **the Vertical Slice is unblocked**

- **`src/engine/runTypes.ts` is the ratified shape** (prototype, imported by nothing; ticket 23 lands it in `SaveSystem.ts`). 25 tests. The rule it encodes: *in `IRunState` = destroyed at run end and cannot inflate the next run; in `IRanchState` = someone has to justify why it can.* Ranch keeps only individuals, blueprint **counts**, codex, gyms/tier. `cardInventory`, `activeDeck` and `scrapCount` leave the permanent save entirely.
- **Henry's four rulings:** (1) a run **survives app close, one slot**; (2) ranch and run under **separate storage keys** — a corrupt run must never cost a blueprint; (3) **save v4 is a clean break, no v3 migration**; (4) **assembly costs a blueprint at the ranch, a blueprint + scrap at a mid-run workshop.**
- **Ruling 4 resolved a real contradiction between two binding docs** — `vision.md` says workshops cost scrap, `economy-session.md` says blueprints only. Now each is true of the place it described. Design consequence: **mid-run recruiting competes with the marketplace for scrap.** Ticket 14 owns the number.
- **Ruling 2's price is `reconcileLoadedState()`** — two independent writes can tear, so the cross-object laws moved out of the schema into an explicit load step with one law: **the run is always the disposable half; nothing is ever half-repaired.** This is also the **first enforcement anywhere of the no-duplicate-species law** (`teamComps.ts` calls it an open question; gap audit §5 confirms no code checked it).
- **Ruling 3 was safe because there is nothing to migrate.** Both this ticket and 23 claimed `playtest-results/` held v3 save fixtures — it does not. All 14 files there are **battle snapshots** on `scenarioIO`'s own `registryHash` versioning. The only v3 data in existence is in Henry's browser. Ticket 23 now **deletes** `migrateSave` and its callers rather than extending them, and must make a v3 blob read as *no save*, not as corruption — otherwise ticket 04's loader clings to it forever.
- **A live v3 bug found by the prototype's own tests:** `PlayerSaveSchema` uses `.catch([])` on `blueprints`, `relics`, `unlockedSectors`, `baseDecksGranted`. `.catch` swallows *malformed* input and lets the parse succeed — so one corrupt blueprint count would empty the player's permanent inventory and autosave would write that over the good save. Harmless when blueprints were an unspendable list; not harmless now they are currency. Use `.default()`. Flagged into ticket 23.
- **Next on the critical path: 08 (start-kit rule), a Henry session** — car-friendly. 21 (leveling freeze) is agent-runnable and can go in parallel right now.

### 2026-08-21 — Foundations session (tickets 02, 03, 04, 26)

- **The tree is trustworthy now.** Line endings normalized once and permanently (`.gitattributes` + `git add --renormalize`; the index was 339 CRLF / 340 LF / 11 mixed and is now 683 LF). `git status` is clean. Root artifacts untracked into `_to_delete/ticket-02-artifacts/` for Henry to delete; ~27 MB of them remain in **history**, which nobody has authorized rewriting. `dist/` 8.0 MB → **1.0 MB** (Kraken 7.37 MB → 95 KB).
- **The suite was always green.** 74 files / **902 tests**, ~46 s. The committed `test_output.txt` that said "4 failed" was a stale partial run and is now untracked. CI (`ci.yml`) hard-gates `npm ci` / `tsc -b` / `vitest run` / `build` on every push and PR, and `deploy.yml` calls it via `workflow_call`, so **a red test blocks the Pages deploy**.
- **Lint cannot be a gate yet: 510 pre-existing errors** (296 `no-explicit-any`, 154 `no-unused-vars`, 33 auto-fixable `prefer-const`, 18 react-hooks). Henry ruled it advisory; **new ticket 55** owns the burndown and flips it blocking. `scratch/` stays tracked but left eslint's surface.
- **A white screen is no longer a possible outcome.** Top-level `ErrorBoundary` with a "your save is safe" screen, return-to-ranch and copy-crash-report; `saveGame` restructured to explicit validate→serialize→write with a typed failure `kind`; a failed autosave now reaches the *player* via a banner instead of a `console.error` that a packaged build has no console for. First DOM-mounting tests in the repo (`createRoot` + `act` under a `// @vitest-environment jsdom` docblock) — copy that shape for future component tests.
- **Wrapper decided (pending Henry's ratification in 42): Electron + `steamworks.js`.** The deciding fact is not size, it is that **Tauri's Steam-overlay issue is closed as "not planned"** — the overlay hooks graphics-device init and Tauri hands rendering to the OS webview. A spike boots the real `dist/` unchanged (Electron 43 / Chromium 150; ~410 ms warm start; 249–314 MB packaged around a 1.0 MB game) and confirms **`base` must become `'./'`**. `localStorage` → file is only **6 production call sites**; use Steam Auto-Cloud, and **ticket 23 should introduce the storage-adapter seam** so ticket 42 does not edit the save layer twice. Full findings: `research/26-wrapper.md`.
- **Three things the tickets assumed that were not true**, all resolved with Henry rather than improvised: `git checkout --` cannot restore files on this mount; `npm run lint` cannot block CI today; and "reuse `debug/snapshotIO.ts`'s export shape" had to mean the shape, not the module (importing it would drag the DEV-only toolkit into every shipped bundle and fail `assert-no-debug`).

### 2026-08-21 — charting session

- **Audit headline:** the engine is a shipped game's engine; the game around it is not built. 3v3, persistence, the debug toolkit and the parity gate are real. There is no run object, no map, no marketplace/workshop/elite/event nodes, no Macros or Drivers (a 4-relic stub exists and is superseded), no onboarding, no settings, no packaging, no Steamworks. Leveling code is everywhere and must be frozen out (ticket 21). `vite.config.ts` `base: '/Mingming/'` blocks any desktop build (ticket 42). `Kraken.png` is 7.37 MB (ticket 02).
- **Henry's rulings today:** success = shipped + 10 reviews; PvP out of scope for the first release; art budget ≤ $500, art only, only if recoupable; SFX from owned packs (licence check in ticket 35).
- **Recommendation on the table:** Early Access (reasoning in map § Destination). Henry decides in ticket 05.
- **Steam facts verified 2026-08-21** (`research/02-steam-facts.md`): $100 Steam Direct fee per app, recouped after $1,000 revenue; generative-AI disclosure is mandatory for AI content reaching players or the store page, dev-tool use exempt; Next Fest is one-time per game, demo must be live, game unreleased, registration ~7–8 weeks ahead; 2026 fests Feb/Jun/Oct, 2027 dates not yet published; Electron + `steamworks.js` is the web-game community's default wrapper path, Tauri trades Steamworks support and graphics for binary size.
- **Cross-wayfinder dependencies in force:** deck-archetypes 109 (3v3 pricing + canary) gates Drivers (16) and authored boss comps (28); deck-archetypes 108 (pipeline optimization) gates any nightly balance CI (fog). A request for 32 `startKit` tags will be filed there when ticket 08 rules the rule.
