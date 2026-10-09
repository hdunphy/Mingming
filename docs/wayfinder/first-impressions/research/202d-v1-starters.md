# 202d: Why the v1 starters lose their opening fights

**Type:** investigation. **Nothing in the game, the card data, the deck data or the tests was changed.** Written 2026-10-08 against `first-impressions` at `e8b289a1`, for ticket [202](../tickets/202-night-2026-10-06-rulings.md) row 202d. Every measurement below was made with commands that are in the repo, plus one scratch harness that is printed in full at the end (Appendix B) because the ticket asked for only this one file to be added.

---

## The answer in plain English

1. **The 85% read was run, and it only looks at fight one.** Fight one is the scripted easy opener: the enemy keeps its start kit but its one payoff card is swapped for a Tackle, and it has no firmware (157-r2). The lost fights in this ticket are mostly **fight two**, which is an ordinary biome-0 wild: the enemy holds its full start kit, payoff included. Fight two has never been part of the number we publish, and it is the one under the rule.
2. **"The read passes" is true for fight one and false for fight two.** The enemies are not outside what the read samples: biome 0 only ever holds the two launch species of one element (Kraken and Jormungandr in Water, Fenrir and Skoll in Fire, Huldra and Ratatoskr in Nature), and the read draws all of them. What it does not do is report fight two, or report any starter on its own.
3. **The decks really are under the rule at fight two**, and for one starter at fight one. On the walker's own route, 300 seeds a starter: `jormungandr_v1` wins fight one 72.7% and fight two 59.2%; `skoll_v1` wins fight one 94.7% and fight two 61.3%; `ratatoskr_v1` 94.0% and 80.1%. Played the way the night plays them (the starter meets wilds of its own element, 195k), `jormungandr_v1` is 75.0% and 47.6%, `skoll_v1` 99.3% and 57.7%, `ratatoskr_v1` 77.0% and 82.3%.
4. **Why the averages hid it.** The gate's pooled biome-0 wild cell reads **85.4%, PASS** (`npm run balance:run-gate -- --cells wild:biome0 --iterations 480`) because it averages twelve starters; `kraken_v1` and most of the v2s sit at 90% to 99% on fight two and carry the weak v1s. "At least 85% for every starter" has never been read starter by starter at fight two.
5. **The cause is the enemy's kit, not the player's play.** In all six lost fights the game's AI played the player's side and never ended a turn holding energy and an affordable card (Table 1). The wild's start kit is drawn from either of its species' two firmwares, so **half of all biome-0 wilds hold a v2 start kit**, and the v2 kits carry the strongest payoffs in the early game (Flashover, Cinder Lance, Boiling Surge, Serpent Flurry). `skoll_v1` against a Skoll holding the v2 kit wins 19 of 100; `jormungandr_v1` against a Kraken holding the v2 kit wins 8 of 100.
6. **Nothing here is a bug in the fight engine.** Three things I noticed and did not touch are listed near the end (the text tool skips the Start-node fight; a Ratatoskr against a Huldra start kit is a 60-turn stall that the walker counts as a loss; the IV jitter both tools add).

---

## What I ran, and what I could not

**Data.** Henry's checkout holds `results/playtest/2026-10-06-haiku` (24 sessions, `pt2026-10-04:1` to `:24`), plus `2026-10-02`, `2026-10-03` and `2026-10-04`. **The two 2026-10-05 folders (haiku and sonnet) are not there**, so the 10-05 losses the ticket names (jormungandr_v1 seed 7 on both models, skoll_v1 seeds 3 and 15 on sonnet) could not be replayed from their own files. A fight is fixed by the seed, the starter and the moves made, so the 10-06 replays below are the same fights; I say "same fight" on that reasoning, not on having opened the 10-05 files. I read the data folder read-only and copied the two folders I needed into this worktree's git-ignored `results/playtest/`.

**Instrument check (the ticket's stop condition).** The walker reproduces what was published before, so it is not broken: `huldra_v2` fight one is **98.3%** over 300 seeds (195a published 98%), and pooled over all twelve starters fight one is **96.5%** and fight two **85.8%** (the 157-r2 note in the deck-archetypes HANDOFF published 96.8% and 85.6%). The replays reproduce the ticket's own figures exactly (Tackle 708 over 19 hits, Ragnarok Edge 675, Flashover 666, Sap Strength 6,581).

**Commands** (all from the repo root; `npm run runread` reads exported run logs from a human run and has nothing to say about enemy draws, so I did not use it):

- The standard read: `npm run balance:walk -- --fight 1 --seeds 300` and `--fight 2`. This is the walker's own route; its gym choice is `index % 3`, so each starter meets each of the three biome-0 elements a third of the time ("mixed" below).
- The night's configuration: the same walker (`walkRun` with `stopAfterFights: 3`), but with the gym the starter's element beats (`gymFor`, 195k), so biome 0 is always the starter's own element ("own element" below). Seeds `r202d:<starter>:1..300`, and on the playtest's own seeds `pt2026-10-04:1..24` for each of the six starters.
- The pooled gate: `npm run balance:run-gate -- --cells wild:biome0 --iterations 480`.
- The replays: `npm run playtest -- replay --results results/playtest/2026-10-06-haiku --session r07 --to 1` (and r19, r03, r15 `--to 3`, r09 and r21 to the end).
- The cell table (Table 3): the scratch harness in Appendix B, which builds each biome-0 enemy from the engine's own pieces and plays it with the game's AI, 100 fights per cell.

**A caveat on Tables 2 and 3.** The walker's fight two is conditional (it only counts starters that won fight one) and the walker's player has taken the card the reward policy picked after fight one. The cell harness uses the bare eight-card start deck. The two agree on direction and roughly on size (Table 2, last columns) but are not the same number.

**A caveat on skoll_v1.** At `e8b289a1` its start kit still holds Howl. The ruling to swap Howl for Brute Force (202k, a second payoff ruled as an exception) is not built at this commit, so none of the skoll_v1 numbers here include it. It will move them and should be re-read with the same commands. Brute Force is in the card appendix for that reason.

---

## Table 1: the lost fights, replayed

"Seed" is the playtest seed `pt2026-10-04:N`; the session folder is under `results/playtest/2026-10-06-haiku`. "Killing card" is the enemy's card that dealt the most damage in the fight (the same reading as the ticket's "Tackle 708 over 19 hits"). "Missed play" is: turns the player ended holding energy and a card it could afford, out of the player's turns. "Walker, same cell" is the win rate of that starter in that kind of fight against that enemy deck (cell harness, 100 fights) and against that species on the walker's own route (own element, 300 seeds).

| Starter | Seed (session) | Fight | Enemy and its deck | Turns | Killing card and total | Missed play | Walker, same cell |
|---|---|---|---|---|---|---|---|
| jormungandr_v1 | 7 (r07) | 1, the opener | Kraken, Kraken v1 kit with Ink Stream swapped for a Tackle (four Tackles, two Whirlpool, Undertow, Pressure Point) | 6 | Kraken's **Tackle 708** (19 hits); Pressure Point 449, Whirlpool 213 | none (0 of 6) | **49 of 100** against this deck as an opener; 73% against any Kraken opener; 110 of 153 = **72%** against Kraken in fight one on the route |
| jormungandr_v1 | 19 (r19) | 2, a regular wild | Jormungandr, Jormungandr v2 kit (two Corrosive Bolt, Poison Injection, Serpent Flurry, Venom Fang, three Tackle) | 7 | Jormungandr's **Venom Fang 231** (3 hits); Tackle 180, Serpent Flurry 150. Lost by 1 HP: the foe finished on 1 of 1,335 | none (0 of 6) | **33 of 100** against this deck; 73 of 108 = **68%** against Jormungandr in fight two on the route |
| skoll_v1 | 3 (r03) | 2, a regular wild | Fenrir, Fenrir v1 kit (Ragnarok Edge, Glass Cannon, Desperate Strike, War Pact, Forage, three Tackle) | 3 | Fenrir's **Ragnarok Edge 675** (2 hits); Glass Cannon 336 | none (0 of 3) | **63 of 100** against this deck; 87 of 144 = **60%** against Fenrir in fight two on the route |
| skoll_v1 | 15 (r15) | 2, a regular wild | Skoll, Skoll v2 kit (Brand, two Ember Jab, Flashover, Ignite, three Tackle) | 3 | Skoll's **Flashover 666** (2 hits); Ember Jab 257 | none (0 of 3) | **19 of 100** against this deck; 85 of 154 = **55%** against Skoll in fight two on the route |
| ratatoskr_v1 | 9 (r09) | 2, a regular wild (reached at node b0l5n0 after two events and a town; deck of ten with two upgrades: Deep Scan+, Rejuvenation+) | Huldra, Huldra v1 kit (two Bolster, Sap Strength, Thorn Tithe, Tend, three Tackle) | 29 | Huldra's **Sap Strength 6,581** (15 hits); Thorn Tithe 703. The player dealt 372 in total | none (0 of 29) | **0 of 100** against this deck (Sap Strength finishes it in about 20 turns); 61 of 102 = **60%** against Huldra in fight two on the route |
| ratatoskr_v1 | 21 (r21) | 3, the biome-0 exit **Elite** (the player had won both wilds) | Huldra running Huldra v1 firmware, lite AI | 12 | Huldra's **Sap Strength 1,012** (6 hits); Thorn Whip 555 | none (0 of 11) | Not a wild, so outside the 85% rule; elites were last published at 52.7% (HANDOFF) and I did not re-run them |

Two things the table says. **First, seed 7 is the only loss at fight one, and it is the one the standard read already flagged** (`jormungandr_v1` 72.7%). **Second, the other five happened at the first regular wild or later, where the enemy keeps its payoff.** Ragnarok Edge and Sap Strength are two of the per-stack scaling cards the ticket rules "leave it for now, make a note"; I name them because they killed, and I propose nothing for them.

The other six v1 sessions that night: `kraken_v1` r01 and r05 cleared the gym; r17 lost gym fight one; `huldra_v1` r11 lost an elite after ten wins, r23 lost the gym; `fenrir_v1` r13 lost an elite after three wins. None of them lost a biome-0 wild.

---

## Table 2: the walker's read, per starter, against the 85% rule

Fights are numbered along the walker's route (fight one is the scripted opener at the Start node, fight two the first regular wild). Every fight in these tables was a wild: the Start node and the first route row are pinned wild, and no fight-two row in the 300-seed runs came out as anything else. Fight two counts only starters that won fight one, so its denominator is shown. Bold is under 85%.

**A. The standard read** (`npm run balance:walk -- --fight N --seeds 300`; the three biome-0 elements mixed):

| Starter | Fight one | Fight two (n that reached it) | Won both, of all 300 |
|---|---|---|---|
| kraken_v1 | 100.0% | 97.7% (300) | 97.7% |
| jormungandr_v1 | **72.7%** | **59.2%** (218) | **43.0%** |
| fenrir_v1 | 98.3% | 88.1% (295) | 86.7% |
| skoll_v1 | 94.7% | **61.3%** (284) | **58.0%** |
| huldra_v1 | 100.0% | **81.0%** (300) | **81.0%** |
| ratatoskr_v1 | 94.0% (18 hit the 60-turn cap, counted as losses) | **80.1%** (282) | **75.3%** |

The v2s at fight two, for scale: skoll_v2 98.7%, jormungandr_v2 98.7%, kraken_v2 98.3%, fenrir_v2 93.7%, ratatoskr_v2 90.0%, and **huldra_v2 73.6%**. (195a's "98%" for huldra_v2 was fight one only.) Pooled over all twelve: fight one 96.5%, fight two 85.8%.

**B. The night's configuration** (own element, seeds `r202d:<starter>:1..300`, same walker):

| Starter | Fight one | Fight two | Won both |
|---|---|---|---|
| kraken_v1 | 100.0% | 99.7% (300) | 99.7% |
| jormungandr_v1 | **75.0%** | **47.6%** (225) | **35.7%** |
| fenrir_v1 | 99.0% | 89.2% (297) | 88.3% |
| skoll_v1 | 99.3% | **57.7%** (298) | **57.3%** |
| huldra_v1 | 100.0% | 98.0% (300) | 98.0% |
| ratatoskr_v1 | **77.0%** | **82.3%** (231) | **63.3%** |

**C. The same configuration on the 24 playtest seeds** (`pt2026-10-04:1..24` for each of the six starters; 24 a starter is small, the 95% interval on a rate is about plus or minus 16 points on the middle values):

| Starter | Fight one | Fight two | Won both |
|---|---|---|---|
| kraken_v1 | 24 of 24 | 24 of 24 | 100% |
| jormungandr_v1 | 19 of 24 (79%) | **5 of 19 (26%)** | **21%** |
| fenrir_v1 | 24 of 24 | 22 of 24 (92%) | 92% |
| skoll_v1 | 23 of 24 (96%) | **10 of 23 (43%)** | **42%** |
| huldra_v1 | 24 of 24 | 23 of 24 (96%) | 96% |
| ratatoskr_v1 | 22 of 24 (92%) | 21 of 22 (95%) | 88% |

**D. What the element mix does.** On the same 300 seeds, putting a starter on the gym its element beats instead of rotating the gyms moves skoll_v1's fight two from 62.5% (mixed) to 57.7%, huldra_v1's from 83.7% to 98.0%, jormungandr_v1's from 59.5% to 47.6%, ratatoskr_v1's fight one from 92.7% to 77.0%. So the mix is not what hides the failures: it moves numbers by a few points in both directions. For jormungandr_v1 and skoll_v1 the failure is there in every configuration. (Per-element detail, skoll_v1: Fire biome 99% / 55%, Water biome 78% / 34%, Nature biome 100% / 100%, fights one / two.)

---

## Table 3: why, cell by cell

Each row is one enemy deck a biome-0 wild can hold: the species the biome fields (two per element), times the firmware its start kit is drawn from (v1 or v2, half each). "Opener" is fight one's rule (payoff swapped for a Tackle). "Regular" is every other biome-0 wild (full start kit). 100 fights per cell, the player holding the bare eight-card start deck. The last line of each starter is the equal-weighted average, which is what a run meets.

| Player | Enemy deck | Opener | Regular wild | What kills (regular wild) |
|---|---|---|---|---|
| kraken_v1 | Kraken v1 / v2, Jormungandr v1 / v2 | 100 / 100 / 100 / 100 | 99 / 99 / 100 / 100 | nothing of note |
| | **average** | **100.0%** | **99.5%** | |
| jormungandr_v1 | Kraken v1 kit | **49** | **14** | Ink Stream (83 of 86 losses, about 670 a fight) |
| | Kraken v2 kit | 97 | **8** | Boiling Surge (91 of 92, about 680) |
| | Jormungandr v1 kit | 100 | 83 | Serpent's Coil |
| | Jormungandr v2 kit | **60** | **33** | Venom Fang, Serpent Flurry |
| | **average** | **76.5%** | **34.5%** | |
| fenrir_v1 | Fenrir v1 / v2 | 100 / 98 | 92 / 99 | Ragnarok Edge |
| | Skoll v1 / v2 | 100 / 100 | 100 / **77** | Flashover (v2 kit) |
| | **average** | **99.5%** | **92.0%** | |
| skoll_v1 | Fenrir v1 kit | 100 | **63** | Ragnarok Edge (37 of 37 losses) |
| | Fenrir v2 kit | 94 | **73** | Cinder Lance |
| | Skoll v1 kit | 100 | 100 | |
| | Skoll v2 kit | 99 | **19** | Flashover (80 of 81 losses, about 570 a fight) |
| | **average** | **98.3%** | **63.7%** | |
| huldra_v1 | any of the four | 100 each | 100 each | |
| | **average** | **100.0%** | **100.0%** | |
| ratatoskr_v1 | Ratatoskr v1 / v2 | 100 / 100 | 100 / 100 | |
| | Huldra v1 kit | **0** (a stall: 100 of 100 hit the 60-turn cap) | **0** (Sap Strength, about 3,300 a fight, over about 20 turns) | Sap Strength |
| | Huldra v2 kit | 100 | 100 | |
| | **average** | **75.0%** | **75.0%** | |

Reading it:

- **Opener to regular wild is a cliff, and the cliff is the payoff card.** skoll_v1 goes 98.3% to 63.7%, jormungandr_v1 76.5% to 34.5%. With the payoff swapped out of the enemy's deck, skoll_v1 wins at least 94% against every deck.
- **A v2 start kit is a different opponent.** skoll_v1 wins 19 of 100 against Skoll's v2 kit and 100 against Skoll's v1 kit; jormungandr_v1 wins 33 against Jormungandr's v2 kit and 83 against the v1 kit. Kraken is the exception: both of its kits beat jormungandr_v1 (14 and 8 of 100). The wild draws its firmware blindly, 50/50.
- **jormungandr_v1 is weak even at the opener.** With Ink Stream swapped out, Kraken's kit still has two Whirlpool and an Undertow that draw it into four Tackles, and Whirlpool leaves Dazed stacks on Jormungandr: 49 of 100 against the v1 kit is the seed-7 loss.
- **kraken_v1 and huldra_v1 as the player's own deck are untouched by all this** (99.5% and 100.0%), and kraken_v1's own start kit is the strongest in the game. Kraken is half of every Water biome's wilds, which is what jormungandr_v1 meets.
- **ratatoskr_v1 vs a Huldra v1 kit is not a close fight: it is a wall.** At the opener neither side can finish the other (Huldra heals with Tend and stacks Sharp; Ratatoskr's only damage card that scales is Seed Bomb at cost 2). With the full kit Huldra's Thorn Tithe puts Weakened on Ratatoskr and Sap Strength scales with it. A quarter of a Nature biome's wilds are this deck (Huldra, drawn with her v1 kit).

---

## Verdict

It is a mix, and I can put a number on each starter.

**(a) "The read is not being run on these seeds."** Partly true, in a way that matters. The standard read is run (`--fight 1`), on seeds that are not the playtest seeds, and it is fight one only. Fight two, which is the same rule, is measured by the same command (`--fight 2`) and was not reported. The pooled gate cell reports one number for twelve starters. Neither prints "per starter at fight two". Run on the 24 playtest seeds themselves (Table 2C) the walker points the same way as the 300-seed runs, within the wide interval 24 seeds give.

**(b) "The read passes but these enemies fall outside what it samples."** True for fight one and for skoll_v1 and ratatoskr_v1 in the standard read (94.7% and 94.0%), but not because of the enemies. Kraken, Fenrir and Skoll are all in the pool the read draws from (each Water biome seed has a Kraken or a Jormungandr, each Fire biome a Fenrir or a Skoll). What the fight-one read cannot show is the enemy keeping its payoff, because fight one removes it.

**(c) "The decks really are under the rule."** True, at these numbers:

| Starter | Fight one (standard / own element) | Fight two (standard / own element) | Under 85%? |
|---|---|---|---|
| jormungandr_v1 | 72.7% / 75.0% | 59.2% / 47.6% | **Yes, both fights** |
| skoll_v1 | 94.7% / 99.3% | 61.3% / 57.7% | **Yes, fight two** |
| ratatoskr_v1 | 94.0% / 77.0% | 80.1% / 82.3% | **Yes** in the night's configuration at fight one; fight two just under in both |
| huldra_v1 | 100.0% / 100.0% | 81.0% / 98.0% | Standard fight two is 4 under, because a Nature starter dropped in a Fire biome (57%) is an element disadvantage by design; at its own element it passes |
| fenrir_v1 | 98.3% / 99.0% | 88.1% / 89.2% | No (fight two is the closest pass) |
| kraken_v1 | 100.0% / 100.0% | 97.7% / 99.7% | No |

Also from this data and outside the ticket: `huldra_v2` is at 73.6% on fight two, and the 195a check (98%) was fight one only. It is not one of the six v1 starters, so I left it.

---

## Proposals

None applied. All are framed as: what changes, what it did in the cell harness (Table 3 averages, equal weights, 100 fights a cell, the bare start deck), and the command that measured it. The harness prints a per-cell table; "average" below is the last line of a starter. The confirming run for any of these is the same one the ticket names: `npm run balance:walk -- --fight 1 --seeds 300` and `--fight 2`, plus `npm run balance:run-gate -- --cells wild:biome0 --iterations 480` (which is 85.4% today).

**P1. Every biome-0 wild holds the start kit minus its payoff, not just the opener.** One place in `rollEncounter` (the loadout choice where `isOpeningFight(run)` picks `OPENING_FIGHT_LOADOUT`) and no new number: the same "the enemy shows the engine that cannot fire" rule Henry ruled for fight one (157-r2), applied to the other wilds of the first biome. A wild past the first biome and every elite keep the full kit. Measured as the "Opener" column: regular-wild averages go from 99.5 / **34.5** / 92.0 / **63.7** / 100.0 / **75.0** to 100.0 / **76.5** / 99.5 / 98.3 / 100.0 / **75.0** (kraken, jormungandr, fenrir, skoll, huldra, ratatoskr). That fixes skoll_v1 and fenrir_v1. It leaves jormungandr_v1 and ratatoskr_v1 under 85%.

**P2. For jormungandr_v1 on top of P1, one of two:**
- **P2a. Wild IV band in biome 0 from 0 to 20 down to 0 to 10.** A visible number (the band is `WILD_IV` in `encounter.ts`, ruled in ticket 67), applied to biome 0 only. Measured with P1: jormungandr_v1 76.5 to **86.5**, skoll_v1 98.3 to 98.8, the rest unchanged. Alone (without P1) it is weak: 0 to 15 gives jormungandr_v1 39.0, 0 to 10 gives 44.0, 0 to 5 gives 48.8 on the regular wild. It buys about ten points on the opener and almost nothing elsewhere.
- **P2b. Serpent's Coil 10 to 15 power per card played** (her payoff, cost 1). Measured with P1: jormungandr_v1 opener **98.8%**; without P1 the regular wild goes 34.5 to **69.5**. **But the field rate moves 74.3% to 99.7% (300 games against the control, `scratch/202d/field.ts`), and average turns go 7.0 to 5.0**, so it is a large buff to her everywhere; it is also in jormungandr_v2's kit and `tidewrackCounters.test.ts` pins its 10, so `npm run balance:run-gate -- --bands gauntlet` would have to be re-read before anyone ships it. Smaller nudges to her other cards do not do it: Surge Protection 25 to 30 gives an opener of 86.3% and a regular wild of 43.3%; Riptide Run 20 to 25 gives 81.3% and 41.3%.

**P3. ratatoskr_v1 against Huldra's start kit needs a design call, and a number alone will not make it.** Seed Bomb 20 to 25 per card moves the regular wild 75.0 to 76.3 (the Huldra v1 kit 0 to 5 of 100); **Seed Bomb 30 moves it to 83.8** (the Huldra v1 kit 39 of 100) and the opener to 79.0, and average turns in the 1v1 against the control go from 6.4 to 4.7 (her field rate is already 100%, so it cannot show a cost). Acorn Toss 5 to 10 (all three hits) does nothing (75.0), and swapping Tend for a Tackle does nothing (74.8). So the lever, if Henry wants one, is Seed Bomb by 10, or a kit swap in the style of 202k's Howl-for-Brute-Force for skoll_v1 (which card is a design choice I did not make). Doing nothing leaves Ratatoskr at 75.0% in a Nature biome and the stall in the opener.

**P4. Say the rule out loud in the reports.** No code. Henry's ruling is "at least 85% at each node, for every starter". The numbers that get published are pooled over twelve starters and are fight one only. Proposed: the read is always published as the table in Table 2 (fight one and fight two, per starter, in the night's configuration: `walkRun` with `gymFor`), and a stall (the 60-turn cap) is printed as a stall, not folded into the losses. The cost is small: 300 seeds of fight one and fight two for all twelve starters took about 15 minutes here.

**Not proposed.** Flare Burst 15 to 20 on both hits for skoll_v1 does little (regular wild 63.7 to 69.8); P1 already fixes skoll_v1. The per-stack scaling cards (Ragnarok Edge, Sap Strength) stay as the ticket rules.

### Table 4: what the proposals do to the 85% rule

Per-starter averages, cell harness. "P1" means every biome-0 wild is the opener rule.

| Starter | Today, fight one (opener) | Today, fight two (regular) | P1 | P1 + IV 0 to 10 | P1 + Coil 15 | P1 + Seed Bomb 30 |
|---|---|---|---|---|---|---|
| kraken_v1 | 100.0 | 99.5 | 100.0 | 100.0 | | |
| jormungandr_v1 | 76.5 | 34.5 | 76.5 | 86.5 | 98.8 | |
| fenrir_v1 | 99.5 | 92.0 | 99.5 | 99.5 | | |
| skoll_v1 | 98.3 | 63.7 | 98.3 | 98.8 | | |
| huldra_v1 | 100.0 | 100.0 | 100.0 | 100.0 | | |
| ratatoskr_v1 | 75.0 | 75.0 | 75.0 | 75.0 | | 79.0 |

---

## Things I noticed and did not touch

1. **The text playtester skips the Start-node fight.** `createWorld` hands the run to `startRun` in its `encounter` phase on the Start node (`withOpeningFight`, 2026-10-03), but the tool's map screen offers only "Go to b0l1n0", and the first fight played is at b0l1n0 with the opener's rules (`fightsResolved` is 0 when it starts). The game opens on the Start node's fight; the walker fights it too. The fight kinds come in the same order in all three (opener, then regular wilds), so the rates here are comparable, but the tool's run has one fight fewer than the game's, and the node ids differ: the walker's seed-7 opener is at b0l0n0 and is a Jormungandr, the tool's seed-7 opener is at b0l1n0 and is a Kraken. The same node (b0l1n0) holds the same Kraken in both, but the walker plays it as a regular wild and the tool as the opener. That is why I cannot quote "the walker's read for seed 7" and have used the cell instead. Worth a look; not a balance matter.
2. **A fight nobody can win has no end.** Ratatoskr against the Huldra v1 kit at the opener hit the 60-turn cap in 100 of 100 fights. The tool and the walker stop at 60 and count a loss; a human would have no cap. (This is the stall the 202 note on r09 asks the tool to cap or flag.)
3. **The walker and the tool add a +/-5 IV jitter to both sides** (`BALANCE_STAT_JITTER`, ticket 19), which is why a wild in the replays shows an IV above the ruled 0 to 20 band. It is documented, applied equally and not what loses these fights, but it is a difference from the game.

---

## Decisions needed from Henry

Each is on its own: P1 first, because P2 and P3 are only needed for what P1 leaves.

1. **P1: should every biome-0 wild hold the start kit minus its payoff?** No new number. Moves skoll_v1 63.7 to 98.3 and fenrir_v1 92.0 to 99.5 on the regular wild; jormungandr_v1 stays at 76.5 and ratatoskr_v1 at 75.0.
2. **P2 for jormungandr_v1, if P1: 0 to 10 IV in biome 0 (76.5 to 86.5, no card changes) or Serpent's Coil 10 to 15 (76.5 to 98.8, but her field rate goes 74.3% to 99.7%)?** Or neither, and accept 76.5%.
3. **P3 for ratatoskr_v1: Seed Bomb 20 to 30 (75.0 to 83.8 on the regular wild, 79.0 at the opener), a kit swap you design, or leave it?**
4. **P4: report fight one and fight two, per starter, in the night's configuration, every time?** And is a stall a loss or its own line?
5. Unrelated but found on the way: **`huldra_v2` is 73.6% at fight two**, which 195a's 98% did not show. Add it to this list, or leave it?

---

## Card appendix

Read from `src/engine/data/programs.json` at `e8b289a1`. Power numbers are the printed ones; "x per" is the scaling the text states. Names appear in the order of first use.

| Name | Id | Cost | Element | In-game text | Numbers |
|---|---|---|---|---|---|
| Tackle | tackle | 0 | None | 12 power. | attack 12 |
| Whirlpool | whirlpool | 1 | Water | 8 power. Draw a card. Apply 2 Dazed. | attack 8; draw 1; Dazed 2 |
| Undertow | undertow | 0 | Water | Draw a card. You gain 1 Weakened. | draw 1; Weakened 1 on self |
| Ink Stream | ink_stream | 1 | Water | 33 power for each card an effect drew you this turn. | attack 33 per card drawn |
| Pressure Point | pressure_point | 1 | Water | 22 power. If the target is Dazed, draw 1. | attack 22; draw 1 |
| Blind Spot | blind_spot | 0 | Water | 6 power. Apply 1 Dazed. | attack 6; Dazed 1 |
| Serpent's Coil | serpents_coil | 1 | Water | 10 power for every card you played this turn. | attack 10 per card played |
| Riptide Run | riptide_run | 1 | Water | 20 power. Refund 1 Energy if this is the third or later card you played this turn. | attack 20; refund 1 |
| Surge Protection | surge_protection | 1 | Water | 25 power. If an effect drew your team a card this turn, refund 1 Energy. | attack 25; refund 1 |
| Venom Fang | venom_fang | 1 | Water | 30 power. | attack 30 |
| Serpent Flurry | serpent_flurry | 1 | Water | Three strikes of 10 power. | attack 10 x3 |
| Corrosive Bolt | corrosive_bolt | 1 | Water | Apply 3 Poison. | Poison 3 |
| Poison Injection | poison_injection | 0 | Water | Apply 1 Poison. | Poison 1 |
| Boiling Surge | boiling_surge | 2 | Water | 55 power. Apply 2 Burn. | attack 55; Burn 2 |
| War Pact | war_pact | 0 | Fire | Above half HP: gain 2 Strength and 2 Dazed. Below half: heal with 15 power. | Strengthened 2 and Dazed 2 on self, or heal 15 |
| Desperate Strike | desperate_strike | 0 | Fire | 8 power. Gain 1 Strength. Lose 3% of your max HP. | attack 8; Strengthened 1; lose 3% HP |
| Ragnarok Edge | ragnarok_edge | 1 | Fire | 20 power. +1 power per 1% of your max HP missing. | attack 20 + 1 per 1% missing HP |
| Glass Cannon | glass_cannon | 1 | Fire | 45 power. Lose 5% of your max HP. | attack 45; lose 5% HP |
| Fury Strike | fury_strike | 1 | Fire | 25 power. Gain 1 Strength. | attack 25; Strengthened 1 |
| Flare Burst | flare_burst | 1 | Fire | 15 power, twice. | attack 15 x2 |
| Howl | howl | 1 | Fire | Every ally gains 1 Strength. | Strengthened 1 on allies |
| Brute Force | brute_force | 1 | Fire | 25 power. +8 power if you have Strength. | attack 25; +8 with Strength |
| Flashover | flashover | 2 | Fire | 50 power. +15 power per Burn on the target. | attack 50 + 15 per Burn |
| Ember Jab | ember_jab | 0 | Fire | 8 power. Apply 1 Burn. | attack 8; Burn 1 |
| Brand | brand | 1 | Fire | 25 power. If the target is Burning, apply 1 more Burn. | attack 25; Burn 1 |
| Ignite | ignite | 0 | Fire | Apply 1 Burn. If the target was already Burning, draw a card. | Burn 1; draw 1 |
| Cinder Lance | cinder_lance | 2 | Fire | 40 power. +6 power per stack of Sharp you hold. | attack 40 + 6 per Sharp |
| Forage | forage | 0 | None | Draw 1. Take damage equal to 15 power. | draw 1; self-damage 15 |
| Bolster | bolster | 1 | Nature | An ally gains 3 Sharp. | Sharp 3 |
| Tend | tend | 0 | Nature | An ally gains 1 Sharp and heals with 8 power. | Sharp 1; heal 8 |
| Thorn Tithe | thorn_tithe | 1 | Nature | 30 power. Apply 3 Weakened. | attack 30; Weakened 3 |
| Sap Strength | sap_strength | 1 | Nature | 20 power. +6 power per Weakened on the target. | attack 20 + 6 per Weakened |
| Thorn Whip | thorn_whip | 1 | Nature | 15 power. +5 power per Sharp you hold. | attack 15 + 5 per Sharp |
| Acorn Toss | acorn_toss | 0 | Nature | 5 power, three times. | attack 5 x3 |
| Seed Bomb | seed_bomb | 2 | Nature | 20 power per card you played this turn. | attack 20 per card played |
| Deep Scan+ | deep_scan+ | 1 | None | Draw 3. | draw 3 |
| Rejuvenation+ | rejuvenation+ | 1 | Nature | Draw a card. Heal with 35 power. | draw 1; heal 35 |

---

## Appendix B: the scratch harness

Not committed (the ticket allows one file). It lives in `scratch/202d/` of this worktree and is reproduced here so any number above can be re-run. It changes nothing on disk: `tweak.ts` edits the in-memory card registry for one process only. Run from the repo root, with `node_modules` in place.

`scratch/202d/tweak.ts`:

```ts
import { ProgramRegistry } from '../../src/engine/data/programRegistry';

/** "id:actionIndex:field=value,..." applied to the in-memory registry for this process only. */
export function applyTweaks(spec: string | undefined): void {
    if (!spec) return;
    for (const part of spec.split(',')) {
        const [id, idx, kv] = part.split(':');
        const [field, value] = kv.split('=');
        const card: any = (ProgramRegistry as any)[id];
        if (!card) throw new Error('no card ' + id);
        const actions = card.actions.map((a: any, i: number) => (i === Number(idx) ? { ...a, [field]: Number(value) } : a));
        (ProgramRegistry as any)[id] = { ...card, actions };
    }
}
```

`scratch/202d/cellsv.ts` (`npx vite-node scratch/202d/cellsv.ts <fights per cell> <out.json> [ivHi] [opening,wild] [tweaks] [starters] [from=to]`):

```ts
import { writeFileSync } from 'node:fs';
import { SeedStream } from '../../src/engine/core/SeedStream';
import { GetMingmingData, GENERIC_HIT, START_KIT_PAYOFF, LAUNCH_SPECIES } from '../../src/engine/data/mingmingRegistry';
import { initializeBattleEntity } from '../../src/engine/types';
import type { IMingmingState } from '../../src/engine/types';
import { startDeckFor, startKitIdsFor, START_KIT_SIZE } from '../../src/engine/run/createRun';
import { OPENING_FIGHT_LOADOUT, enemyLoadoutFor, dedupeCantrips } from '../../src/engine/run/encounter';
import { memberFor, setupFor } from '../../src/debug/balance/runWalker';
import { autoPlay, openBattle } from '../../src/debug/playtest/battleSim';
import { applyTweaks } from './tweak';

applyTweaks(process.argv[6]);
const startersOnly = process.argv[7]?.split(',');
const n = Number(process.argv[2] ?? 100);
const out = process.argv[3] ?? 'scratch/202d/out/cells.json';
const ivHi = Number(process.argv[4] ?? 20);
const whichList = (process.argv[5] ?? 'opening,wild').split(',') as Array<'opening' | 'wild'>;
const starters = ['kraken_v1', 'jormungandr_v1', 'fenrir_v1', 'skoll_v1', 'huldra_v1', 'ratatoskr_v1'];
const elementOf: Record<string, string[]> = {};
for (const sp of LAUNCH_SPECIES) { const d = GetMingmingData(sp); (elementOf[d.primaryElement] ??= []).push(sp); }

const rows: any[] = [];
for (const starter of (startersOnly ?? starters)) {
    const player = memberFor('mm1', starter);
    const myEl = GetMingmingData(player.definitionId).primaryElement;
    const swap = process.argv[8]?.split('=');
    const deck = [...startKitIdsFor(player, START_KIT_SIZE), GENERIC_HIT, GENERIC_HIT, GENERIC_HIT]
        .map((id) => (swap && id === swap[0] ? swap[1] : id));
    for (const species of elementOf[myEl]) {
        const def = GetMingmingData(species);
        for (const os of def.availableOS) {
            for (const which of whichList) {
                const loadout = which === 'opening' ? OPENING_FIGHT_LOADOUT : enemyLoadoutFor('wild', 0, 0);
                let w = 0, turns = 0, trunc = 0;
                const killers: Record<string, { n: number; total: number }> = {};
                for (let i = 0; i < n; i += 1) {
                    const seed = `c202d:${starter}:${species}:${os}:${which}:${i}`;
                    const rng = new SeedStream(seed);
                    const lo = loadout.iv[0]; const hi = Math.min(loadout.iv[1], ivHi);
                    const hpIV = rng.nextInt(lo, hi), attackIV = rng.nextInt(lo, hi), defenseIV = rng.nextInt(lo, hi);
                    const state: IMingmingState = { id: `e${i}`, definitionId: species, nickname: 'Wild', activeOS: os, blueprintsCollected: 0, hpIV, attackIV, defenseIV };
                    const entity = { ...initializeBattleEntity(state, def), activeOS: undefined };
                    let ids = startDeckFor(state, new SeedStream(seed + ':deck'), true).map((c) => c.dataId);
                    if (which === 'opening') {
                        const payoff = START_KIT_PAYOFF[os];
                        const at = payoff === undefined ? -1 : ids.indexOf(payoff);
                        if (at >= 0) ids = ids.map((id, k) => (k === at ? GENERIC_HIT : id));
                    }
                    ids = dedupeCantrips(ids, loadout);
                    const setup = setupFor(seed, [player], deck, [entity as any], ids, [], [], undefined);
                    const opening = openBattle({ setup, seed, enemyAiTier: loadout.ai, aiBeam: loadout.beam });
                    const res = autoPlay(opening);
                    turns += res.turns;
                    if (res.truncated) trunc += 1;
                    if (res.winner === 'PLAYER') w += 1;
                    else {
                        const top = res.hits.find((h) => h.side === 'ENEMY');
                        if (top) { const k = top.label; (killers[k] ??= { n: 0, total: 0 }); killers[k].n += 1; killers[k].total += top.total; }
                    }
                }
                rows.push({ starter, species, os, which, n, wins: w, rate: w / n, meanTurns: turns / n, truncated: trunc, killers });
                console.error(`${starter} vs ${species}/${os} ${which}: ${w}/${n}`);
            }
        }
    }
}
writeFileSync(out, JSON.stringify(rows, null, 1));
```

Examples used above: the baseline is `npx vite-node scratch/202d/cellsv.ts 100 out.json`; IV 0 to 10 is `... 100 out.json 10 wild`; Serpent's Coil 15 is `... 100 out.json 20 opening,wild serpents_coil:0:power=15 jormungandr_v1`; Seed Bomb 30 is `... seed_bomb:0:power=30 ratatoskr_v1`; Tend for Tackle is `... "" ratatoskr_v1 tend=tackle`.

`scratch/202d/field.ts` (`npx vite-node scratch/202d/field.ts 150 jormungandr_v1 serpents_coil:0:power=15`): the same vs-control recipe `balance:deck` uses, subject as the enemy, both turn orders, with the optional in-memory tweak.

```ts
import { applyTweaks } from './tweak';
import { CONTROL_SPECIES, matchupScenario } from '../../src/debug/balance/balanceScenarios';
import { quietly } from '../../src/debug/balance/balanceReporting';
import { runPairedBatch } from '../../src/debug/balance/runBatch';
import { speciesOwningFirmware } from '../../src/engine/run/gyms';

applyTweaks(process.argv[4]);
const iterations = Number(process.argv[2] ?? 100);
for (const subjectId of (process.argv[3] ?? 'jormungandr_v1').split(',')) {
    const species = speciesOwningFirmware(subjectId)!;
    const setup = matchupScenario({ player: CONTROL_SPECIES, enemy: species, enemyOS: subjectId, seed: `deck-report:vs-control:${subjectId}` });
    const p = quietly(() => runPairedBatch(setup, { iterations, maxTurns: 60, telemetry: true })).pooled;
    console.log(`${subjectId} field rate vs control: ${(100 * p.enemyWins / p.iterations).toFixed(1)}%  (${p.enemyWins}/${p.iterations})  avg turns ${p.averageTurns.toFixed(1)}  truncated ${p.truncatedCount}`);
}
```

The walker runs in Table 2B and 2C are `walkRun({ seed, starter, gymIndex: gymFor(seed, starter), stopAfterFights: 3 })` from `src/debug/balance/runWalker.ts`, one per seed, reading `result.fights` and the `FIGHT_DECK` rows of `result.log` for the enemy species.
