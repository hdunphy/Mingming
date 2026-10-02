# Playtest review: 2026-09-25, Rootfall, fenrir_v2 solo

Reviewed by Claude from `notes.md`, the run log, both fight logs and the ranch save. Raw numbers are in `enemy-first-hand-measurement.txt` beside this file.

## What the log says happened

- **Fight 1** was the scripted opener: a Sköll holding its start kit, with its payoff (Flashover) swapped for a Tackle. You won in 4 turns but finished on **404 / 1125 HP (36%)**.
- **The pick** offered Scrubber, Snarl and Howl, and you took Snarl. The deck went from 8 cards to 9.
- **Fight 2** was an ordinary biome-0 wild: a Sköll with its full start kit, Flashover included. You died on its third turn after taking **1,133 damage in three enemy turns**. **502 of that landed before your second turn.**
- The whole run lasted about 7 minutes.

## 1. The enemy's first turn is a double turn (a bug, and the main reason the run felt bad)

**What you saw.** On its first turn, Sköll played **8 cards in both fights**. Every later enemy turn it played 4–5, and your first turn had 4. In fight 2 those 8 cards were Ember Jab ×3 and Ignite, which put 4 Burn on you, and then Flashover at 4 Burn for **319 damage**. The 3 Tackles took it to 412, and the Burn tick added 90 more. That is 45% of your HP before you had played your second hand.

**Why it happens.** When a battle is created, both sides are dealt a 4-card opening hand. At the end of your turn 1 your hand is discarded, but the enemy's opening hand has not been used yet. It keeps that hand through your turn, and at the start of its own first turn it draws 4 more on top. Your opening hand gets thrown away before the enemy's does, and the enemy's never is. The code is `engine/data/battleFactories.ts` (the deal) plus the refill in `battleReducer.processPreTurn`, which draws 4 up to a hand limit of 15. `debug/scenarios/buildScenarioState.ts` has the same deal, so **every sim and every balance grid has had this too**. The note written when the enemy-hand preview was reworked (159a revert, 09-21) says the enemy "holds nothing" during your turn. That is true from turn 2 onward but not on turn 1, and the preview shows the wrong cards on turn 1 for the same reason.

**Measured.** This is the same instrument as the 157-r2 fight-one read (the progression walker): 200 seeds × 12 starters. The only change is that the enemy is not dealt an opening hand and draws its normal 4 when its first turn starts. The LIVE fight-one number, 93.3%, reproduces the 93.0% on record.

| | LIVE (as shipped) | FIXED |
|---|---|---|
| Fight 1, all starters | 93.3% | **96.8%** |
| Fight 2, all starters | 77.9% | **85.6%** |
| Fight 3, all starters | 67.2% | **75.9%** |
| **Alive after 3 fights, all starters** | **49%** | **63%** |
| fenrir_v2 fight 2 (your exact fight) | 84.0% | **97.0%** |
| fenrir_v2 alive after 3 fights | 59% | **80%** |

Every starter improves. jormungandr_v1 gains the most on fight 1 (66 → 78).

**Why this needs your ruling.** Fixing it moves every balance baseline once, on purpose, because both the game and the grids have always had it. In the 1v1 grids the side that goes second gets the extra hand. Some species read as better off going second, and this may be part of the reason.

## 2. Even fixed, biome 0 is not a cake walk, and the target is part of why

- **Win targets are set per fight.** The wild band you ruled on 09-25 is 90%. A solo run ends at its first loss and HP resets between fights, so the odds multiply. **Five wilds at exactly 90% means only 59% of runs get through them.** The measurements agree: 63% of runs are alive after three fights even with the fix.
- **"Cake walk" needs about 98% a fight** if about 90% of runs are to clear biome 0.
- **Biome-0 wilds are a mirror by design** (157-r1a): the enemy holds the same shape of deck you do. After the fix your only real edge is your OS plus one pick. The handoff already records that a mirror can't reach 95.
- **The first pick did not help.** Snarl measured as worth about nothing at 1v1 in the 08-24 debuff study. Scrubber cleanses Poison, which does nothing in a Fire biome. Howl gives +1 Strength. Adding a card that doesn't advance the engine thins an 8-card deck, which is the 148 finding: every arm that added cards lost. So question 1 of your playtest page ("did the first pick complete something?") comes out as a **no**.
- **One loose end.** My LIVE fight-2 number (77.9%) is lower than the 86.2% the handoff records for fight two after 157-r1a. I haven't found why yet, so treat fight 2 as roughly 78–86.

## 3. Your UI and feel notes

- **Node icons need a legend.** Confirmed. The map's legend explains fog, rivals and Driver stakes but never the icons. The icons are explained only by a one-time tip (`map:types`), and after that the explanation is gone. Fix: an icon key built from the node kinds on the current map, added to the legend row. Small, and no decision needed.
- **"I think you skip the first fight."** The node you start on is drawn as a **Wild** because there is no "start" node type. The code reuses `wild` and marks it as already visited so it doesn't fire. So it looks like a fight you skipped. Walking back into a node fights again because of your ticket 07 ruling, "entering a node triggers it again, always", which was meant to allow farming. Fix: draw the start node as **Start**. Whether walking back into it (or any cleared node) should still start a fight is your call.
- **Five sounds at once.** That count is literal. Each fenrir_v2 burn card fires about **6 different sounds at the same moment**: the card whoosh, the fire cast, the hit, Burn applied, Sharp gained, and the OS proc ("feeds on the flames"). Ignite adds a draw tick. The limiter only merges *identical* sounds within 35 ms, so different sounds all play together. Ember Jab followed by Ignite comes to about 12 cues in roughly a second.
- **The played card stays stuck in the centre.** This was deliberate in tickets 127 and 155: the card stays up until the next play or the end of the turn. A timer was avoided because it raced the enemy's 1.2 s hold. On your own turn, the side effect is that your last card sits over the combat log until you press End Turn. Fix: your own card flies to the discard after a short hold, and the enemy's hold stays as it is.
- **Click the discard to see your cards.** The discard pile only shows a count, and clicking it does nothing. Fix: click to see the list. Small.

## 4. Log housekeeping (minor, affects reading future logs)

- The turn that killed Sköll in fight 1 is logged **after** the reward screen and tagged as fight 2 (run-log seq 11–15).
- `run_telemetry` says biome reached 1, and the run log says 0.
- The export also carries the 09-23 run (`mueu9oq4…`).

## Decisions needed from Henry

1. **Fix the enemy's double first hand?** I recommend yes, as one commit that says it moves the numbers, followed by a re-baseline.
2. **What does "biome 0 is a cake walk" mean as a number?** Either a per-fight win rate (around 98%) or "X% of runs reach biome 1". The current 90%-per-fight band cannot deliver it.
3. **Sound: which fix?** (a) one headline sound per card, (b) mute self-buff sounds (Sharp and the like) when they ride on a card that already made a sound, or (c) stagger the sounds about 80 ms apart.
4. **Your own played card: how long should it hold** before flying to the discard? I suggest about 1.5 s.
5. **Start node and walking back:** keep "walking back into a node fights again"?

With no decision needed, I can do the node legend, the "Start" label, the discard viewer and the log ordering. After fix 1, the natural retest is the same scenario: Rootfall with a Fire-led party. Tonight's question, whether the counter route works against the strongest gym, never got asked because the run ended at fight 2.

## Henry's rulings (same night) and what shipped

1. Fix the double first hand: **yes**. Shipped `d30106e`. The grids are owed a re-baseline.
2. Cake walk = **at least 85% at each node, not cumulatively**. After the fix: biome-0 wilds 91.2%, rivals 82.7%, elites 52.7% (`results/t0925_playtest/per-node-after-fix.txt`). Still open: does 85 replace the 90 band, and does it cover elites and rivals?
3. Sound: **space them**. Shipped `2fd4025`, 80 ms apart.
4. Own card hold: **1.5 s**. Shipped `a1c78e2`.
5. Walking back in still fights: **yes**. The Start node and the icon key shipped in `fefa717`.

Also shipped: the discard viewer (`f4cc844`) and the run-log ordering fix (`d096c47`).
