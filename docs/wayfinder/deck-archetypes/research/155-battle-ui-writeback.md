# Ticket 155 — write-back (§4)

**Rows built:** 155a, 155b, 155c, 155d, 155e, 155f, 155g, 155h, and deep-dive items 1–10.
**Branch:** `playtest-polish`. **Commits:** `2465ab2` (155a), `478dc8a` (155b–h + dives 1, 3, 5, 7,
8, 10), `ac0dd86` (dives 2, 4, 6, 9).
**Measured on:** 2 cores, Intel Xeon @ 2.80GHz, headless Chromium, at 1280×800 and 1920×1080.

---

## 1. What was captured

§4 asks for *"screenshots at 1280×800 and 1920×1080 with three bodies a side and an 11-card hand,
and a 10-second capture of one cast with the switches on."*

| artifact | what it shows |
|---|---|
| `155-wb3-1280.png` | 3v3, eleven cards, 1280×800, every switch on |
| `155-wb3-1920.png` | the same board at 1920×1080 |
| `155-wb-cast.gif` | ten seconds, one cast, switches on — flight, reveal, float, impact, settle |

The three artifacts came back through the conversation rather than the file bridge, which refused
anything over about 40KB for the whole of this session; they belong in `Claude outputs/` beside
146's.

The board is posed through the debug scenario launcher rather than played into: an eleven-card hand
at 3v3 is not reachable in the first minutes of a run, and the point of the shot is the geometry,
not the fight. Three of the eleven cards are added with God Tools' `ADD_CARD_TO_HAND`, which is why
the top bar reads `[DEBUG] ADD_CARD_TO_HAND` in the stills. The backdrop is the `None` fallback in
these two because a scenario has no biome — deep dive 6 is verified separately, in a real run, and
is described in §4 below.

## 2. The geometry, at both viewports

This is the measurement the ticket exists for: 155b's claim is that the console band and the stage
now agree about how tall the band is, and that all six bodies fit above it.

| | 1280×800 | 1920×1080 |
|---|---|---|
| `--console-h` published by `BattleArena` | 210px | 287.8px |
| `.console-area` measured height | 212px | 290px |
| console top | 588 | 790 |
| lowest slot bottom | **522** | **687** |
| clearance, lowest body to the band | 66px | 103px |
| slots on screen | 6 / 6 | 6 / 6 |
| cards in hand | 11 | 11 |
| card, rotated bounding box | 163×194 | 196×232 |
| card, true size | 140×176 | 168×211 (scale 1.2, the cap) |
| fan extent | 74 → 1145 | 118 → 1741 |
| fan top / bottom | 578 / 782 | 820 / 1061 |
| `document.scrollWidth` vs `clientWidth` | 1280 = 1280 | 1920 = 1920 |
| `document.scrollHeight` vs `clientHeight` | 800 = 800 | 1080 = 1080 |

Nothing overflows on either axis and the page does not scroll. The measured band is 2px over the
published one at both sizes — a border, not the old 180px disagreement that put row three under the
fold. The fan's top sits 10px ABOVE the console's top at 1280 and 30px BELOW it at 1920 — the arch lifts
out of the band only where the band is tight, which is 155b's intent and not a leak.

## 3. The frame budget

Measured with an in-page `requestAnimationFrame` probe, 239 frames per reading, on the posed 3v3
board with eleven cards and every switch on. As 146's write-back established, a vsynced frame IS
16.7ms, so the useful reading is *frames much above 20ms*, not "under 16".

| board | median | p95 | max | frames > 20ms |
|---|---|---|---|---|
| idle, 1280×800 | 16.7 | 16.7 | 33.4 | 1 / 239 |
| idle, 1920×1080 | 16.7 | 16.8 | 16.8 | 0 / 239 |
| one cast, 1280×800 | 16.7 | 33.3 | 83.4 | 15 / 239 |
| one cast, 1920×1080 | 16.7 | 33.3 | 150.1 | 13 / 239 |

The idle rows are the idle rule holding at 3v3: with nothing burning and nothing in flight, the
board schedules no work. The screencast bears it out independently — 10 seconds of wall clock
produced 74 painted frames spanning 2.79s, and then the page stopped repainting entirely.

**The cast cost is first-mount cost.** Three casts in a row, same battle, 1920×1080, 179 frames each:

| | median | p95 | max | frames > 20ms |
|---|---|---|---|---|
| cast 1 | 16.7 | 66.6 | 100.0 | 15 / 179 |
| cast 2 | 16.7 | 16.7 | 133.3 | 3 / 179 |
| cast 3 | 16.7 | 16.8 | 100.0 | 6 / 179 |

p95 drops from 66.6 to 16.7 after the first cast, which is 146's `ProgramCard`-mount finding
again — 155e made the lane render the shared `CardFace`, so the lane now pays that cost once
instead of the hand and the lane each paying their own.

**What does NOT go away: one 100–133ms frame per cast.** Every cast, warm or cold, has a single
frame of about six dropped frames' worth at the moment the reveal mounts. It is one hitch, not a
stutter, and it lands under a card that is flying anyway — but it is the last thing on this screen
above 20ms, and it is a decision, not a defect. **See §6.**

## 4. The three features that were dead, and the proof they are not

Deep dives 2, 6 and 9 were all the same shape: something built, something testing the scaffold
around it, and the line that runs it never written. None of them could be caught by the suite.

**The biome backdrop (dive 6).** `BattleStage` read `biomeName`/`biomeElement` off the battle state
through `as unknown as`, and nothing had ever written them, so every fight since 145f rendered the
`None` fallback. The fields are declared on `IBattleState`, `startBattle` sets them, `RunScreen`
passes `run.biomes[node.biomeIndex]`. Verified in a real run rather than a scenario: the stage reads
**"Verdant Sprawl"** over green shafts.

**The death FX (dive 9).** `BattleStage.test` has asserted since 145 that a slot's anchor survives
the unit's death *"because 146 plays the death FX AT the slot"* — and 146 shipped with no death
branch and no recipe. `emitDeath` is a ring and a grey scatter at the slot, deliberately not the
killer's element: a death is the board losing a body and should read the same whoever dies.

**The reveal lane (dive 2).** Measured, before and after, at both viewports:

| | before | after |
|---|---|---|
| lane centre x, 1280 | 640 (from `left: 50%`) | 640 (from `anchors.reveal`) |
| lane card top, 1280 | **−9** | 89 |
| lane card top, 1920 | 18 | 153 |

The `−9` is mine. The first cut of dive 2 anchored `left` to the rect's centre and `top` to the
rect's TOP edge, against a transform that centres on both axes — so the card hung half its own
height above the lane, off the top of the screen and behind the bar. Nothing but this measurement
found it; `PlayedCardReveal.test.tsx` now fails if either axis goes back to a corner.

## 5. What the gate says

eslint 0, tsc 0, **2,490 vitest across 181 files**, production build clean, `assert-no-debug` OK
(69 files in `dist/`, no toolkit marker).

## 6. Decisions needed

1. **The 100–133ms frame when the reveal mounts.** One dropped-frame cluster per cast, every cast,
   at both viewports. It can be removed by keeping the lane's card mounted and hidden between casts
   rather than mounting it per play — cheap to do, but it means a card face permanently in the tree
   over the stage. Leave it, or pre-mount it?
2. **Eleven cards is where the fan stops carrying its text.** At 1280×800 every card's NAME, cost
   pips, keyword chips and element word stay readable, and the fan is correctly inside the frame —
   but the description paragraph is clipped by the next card on every card except the rightmost.
   `Surge Protection` reads *"40 power. If a ca… or daemon drew… card this turn, r… Energy."* The
   geometry is right and nothing is off-screen, so this is a design question the ticket did not
   ask: does an eleven-card hand keep fanning, or go to two rows, or scroll? The shot §4 asked for
   is what surfaces it.
3. **`[DEBUG]` in the top bar during a posed board.** God Tools' verb log writes into the combat-log
   line. Harmless, and arguably right for a debug verb — but it is the line 155c just gave a
   placeholder to, so it is worth saying out loud that a debug verb can occupy it.
