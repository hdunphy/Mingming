# Playtest round 1 - the protocol

Nine matches, about five minutes each. You can stop after any block; each block answers its own
question. **Everything the sim already knows is measured - what I need from you is the half a sim
cannot see.**

---

## Setup, once

1. `npm run dev`, open the app.
2. **Ctrl+Shift+D** toggles the debug toolkit. Pick the **Scenario Launcher** panel.
3. **Load** -> choose a file from `src/debug/scenarios/playtest/round-1/`.
4. Check the destination-slot warning above Launch (scenario battles write XP into the active save
   slot - use a scratch slot if you care about your run), then **Launch**.
5. Play it out.
6. **Before the killing blow lands - while the battle is still on screen - press Ctrl+Shift+E.**
   That drops `snapshot-t<turn>-<seed>.scenario.json` into Downloads, with the action tape: every
   card you played, in order. Exporting after the battle ends does nothing, so press it on the last
   turn you are still alive.
7. Move the exported files into `playtest-results/round-1/` in the repo folder and tell me. I read
   them directly - you do not have to write down anything I can count.

**The order matters in block A only** (A1 immediately before A2). Everything else is independent.

---

## Block A - does "wide" read as a different deck? (2 matches)

| | you | opponent |
|---|---|---|
| **A1** | `sleipnir_v1` - the AI plays 3.6 cards a turn | control |
| **A2** | `fenrir_v1` - 1.8 cards a turn, lowest HP frame in the game | control |

Play them back to back. **The question: did those feel like two different decks, or one deck with
different cards?** This is the single thing the whole archetype argument turns on, and the sim
cannot answer it.

## Block B - are the zeros real, or is it the AI? (3 matches)

| | you | opponent |
|---|---|---|
| **B1** | `kraken_v1` | `audhumbla_v1` |
| **B2** | `draugr_v2` | `huldra_v1` |
| **B3** | `fafnir_v2` | `gullinbursti_v1` |

**The AI loses all three of these 0 games out of 60, with no type disadvantage.** They are three of
the 13 neutral zero cells - our only remaining hard balance bugs. **If you win even one, that cell
is a pilot artifact and not a balance bug**, and the same is probably true of the others. Note the
turn at which you felt the game was already decided.

## Block C - pace (2 matches)

| | you | opponent | |
|---|---|---|---|
| **C1** | `hel_v2` | `ratatoskr_v2` | the AI ends this in **2.9 turns** |
| **C2** | `audhumbla_v2` | `valkyrie_v1` | the AI takes **17 turns** |

Does a three-turn game feel like a game? Does the seventeen-turn one drag, and from which turn?
These are the two ends of the roster; everything else sits between them.

## Block D - dead cards (2 matches)

| | you | opponent | |
|---|---|---|---|
| **D1** | `fafnir_v1` | control | `hoardbreaker` sits unplayed in the AI's hand **89%** of the time |
| **D2** | `ymir_v2` | control | her OS caps you at **one card a turn** |

D1: did you find a use for `hoardbreaker`, and when? D2: does the one-card cap read as a cost you
are paying for a strong OS, or as the game being broken?

---

## What to write down

Only the things I cannot count from the export:

- **did it feel like a distinct deck** (1-5)
- **did you have real choices**, or did the hand play itself (1-5)
- **pace**: too fast / about right / too slow
- **one line** of whatever you noticed

The score sheet (`playtest-scoresheet.html`, or the artifact in your sidebar) has a box for each of
those and a **Copy results** button that produces a block you paste straight back to me. Nothing is
saved between refreshes, so copy before you close it.

## If something breaks

Press **Ctrl+Shift+E** immediately and keep the file - a snapshot plus its tape is exactly what a
bug report needs, and it is the same format as these scenarios, so I can re-launch the exact state.
