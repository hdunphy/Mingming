# Sleipnir draw-4 experiment (ticket 100): wide decks get more, weaker cards

- Type: wayfinder:task - Henry green-lit 2026-08-19 (ticket 88's recommendation; its
  after-playtesting gate is satisfied by rounds 1-2). Branch archetype-web.
- Status: **CLOSED 2026-08-20 - NEGATIVE RESULT, nothing shipped.** The ticket allowed for exactly this: *"if she feels the same, the idea dies for the cost of one ticket."*

sleipnir_v1 (designated ZOO, 36.8% field, 20 points behind her sibling): cardDraw 3 -> 4,
paid back in HER OWN cards' power (stampede-style cuts, ticket 88 measured the exchange at
~2-3 cards of power per draw point) until she lands ~45% field. Success = she plays 4+
cards a turn at a normal win rate AND feels like a different deck (Henry playtests the
result - the sim ranks this axis, only play judges it). If she feels the same, the idea
dies for the cost of one ticket; if it works, the recipe generalizes to every wide deck.
The three unused Air discard payoffs (feather_cache, sky_burial, carrion_swoop) are the
pre-identified buff levers if she lands short. Gates: band standard (neutral cells),
FTK 0, dead <=0.35; report cards/turn distribution before/after. ONE commit + a playtest
build note for Henry.

---

# Resolution

Report: [research/draw-four.md](../research/draw-four.md). **Report only - nothing shipped, so no
grid run.**

## The premise is stale, and the answer is no

The ticket describes her at "36.8% field, 20 points behind her sibling". **After ticket 103 she is
57.7% on the grid and AHEAD of `sleipnir_v2` (56.4).**

**A draw point buys her +34.6 field points and +0.36 cards per turn.** She does not get wider, she
gets stronger.

| | field | dead | cards/turn | 4+ cards on |
|---|---|---|---|---|
| draw 3 (live) | 55.6% | 17.3% | **3.40** | **47% of turns** |
| draw 4 uncut | 90.2% | 19.9% | 3.76 | 60% |

**She already plays 3.40 cards a turn and already hits 4+ on 47% of turns** - the ticket's success
condition is close to met at draw 3. There is not much width left to buy.

## The payback does not work

Ticket 88 measured ~2-3 cards of power per draw point AT HER OLD BASELINE. Post-103 it is far worse:
`stampede` scales on cards played and the Strengthened ramp compounds with volume, so the draw point
is worth MORE and the power cut LESS.

| cut | field | cards/turn |
|---|---|---|
| none | 90.2% | 3.76 |
| `stampede` 11 -> 5 | 79.4% | 3.88 |
| + `zephyr_strike` 15 -> 8, `water_slap` 12 -> 8 | 75.2% | 3.87 |
| + `adrenaline` 18 -> 8, `stampede` -> 2 | 66.9% | 3.88 |
| **`stampede` -> 1**, `zephyr_strike` -> 3, `water_slap` -> 3, `adrenaline` -> 5, `momentum_crash` 8 -> 4 | **64.6%** | **4.14** |

Five cards gutted - **`stampede` at 1 power is not a card** - and she is STILL nine points over
baseline. **There is no net-neutral point that leaves her a deck.** Also: `cardDraw` is a SPECIES
stat, so `sleipnir_v2` rides along 56.3 -> 74.1% for an experiment she is not part of.

## WHERE THE RECIPE DOES FIT: `huldra_v1`

**The diagnostic is DEAD CARDS.** A deck that plays everything it draws is hand-limited and gets
wider from drawing; a deck already binning a fifth of its hand is limited by something else and only
gets better SELECTION. Sleipnir bins 17.3%.

| | field | dead | cards/turn | 4+ cards on |
|---|---|---|---|---|
| `huldra_v1` draw 3 | 62.9% | **4.3%** | 2.49 | **0% of turns** |
| `huldra_v1` draw 4 | 80.0% | 5.6% | **3.04** | **38%** |

**She goes from NEVER playing four cards to doing it on 38% of turns**, dead cards barely moving.
That is a width change; sleipnir's 47->60% is not. Other hand-starved candidates by dead-card rate:
`jormungandr_v1` 8.4%, `huldra_v2` 9.6%, `valkyrie_v2` 10.6%, `valkyrie_v1` 12.9%. Flooded and
therefore wrong for it: `ymir_v2` 62.2%, `hraesvelgr_v2` 44.4%, `skoll_v1/v2` ~34%, `fenrir_v1`
34.1%, `kraken_v2` 31.9%.

**Recommendation: retarget the ticket-88 recipe at `huldra_v1`. Henry rules.**

## FOUND BY ACCIDENT: AN INFINITE LOOP IN A SHIPPED DECK

The cards-per-turn walker read `valkyrie_v2` at 45/turn. It is not the instrument - **3,942 plays in
one turn**, which was the walker's step guard, not the end of the loop.

```
valkyrie_v2 vs huldra_v1, seed 761868416
stuck at turn 8, side PLAYER, hand 5, drawpile 0, discard 0, energy 0
glimmer x3949
```

**`glimmer` draws itself, forever.** 0 Energy, "Draw a card". `handlePlayProgram` moves the played
card to the discard BEFORE its actions resolve, so glimmer's DRAW finds an empty drawpile, reshuffles
the discard - containing glimmer - and draws it straight back. **`runPairedBatch`'s own step guard
ends the game, so the balance sim reads it as an ordinary result, which is why it has survived.** A
human hits it as a turn that never ends. It is the "cheap-shifter cantrip loop" already on the
HANDOFF watch list.

**Two candidate fixes, both wanting their own ticket with a repro test:** (1) move the played card to
the discard AFTER resolution - the actual defect, blast radius `PLAY_LAST_CARD` and anything reading
the discard mid-resolution; (2) exclude the currently-resolving card from a mid-resolution reshuffle
- narrower and fixes the whole class.
