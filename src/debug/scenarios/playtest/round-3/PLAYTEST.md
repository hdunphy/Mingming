# Playtest round 3 - the power-status round

Seven scenarios (nine files - S2 and S6 have extra parts), about 90 minutes total. You can stop
after any one; each answers its own question.

**Build check first:** scenarios S1, S2, S5, S6 need ticket 102 (STATUS_MODEL = POWER, +1/stack)
landed in your build. If that hasn't shipped yet, play S3, S4, S7 tonight and come back for the
rest later.

---

## Setup, once

1. `npm run dev`, open the app.
2. **Ctrl+Shift+D** toggles the debug toolkit. Pick the **Scenario Launcher** panel.
3. **Load** -> choose a file from `src/debug/scenarios/playtest/round-3/`.
4. Check the destination-slot warning above Launch (scenario battles write XP into the active save
   slot - use a scratch slot if you care about your run), then **Launch**.
5. Play it out.
6. **Before the killing blow lands - while the battle is still on screen - press Ctrl+Shift+E.**
   That drops `snapshot-t<turn>-<seed>.scenario.json` into Downloads, with the action tape: every
   card you played, in order. Exporting after the battle ends does nothing, so press it on the last
   turn you are still alive.
7. Move the exported files into `playtest-results/round-3/` in the repo folder and tell me. I read
   them directly - you do not have to write down anything I can count.

**Note per game (30 seconds, right after):** deck | opponent | fun 1-5 | the ONE decision that
mattered most | the moment you felt railroaded (if any) | anything the UI hid from you.

---

## S1 - are riders real now? (needs 102)

| | you | opponent |
|---|---|---|
| **S1** | `skoll_v1` - rebuilt consume-cycle deck | `kraken_v1` |

TREACHERY feeds Strength when you're hit, `fury_strike`/`battle_rhythm` add stacks,
`sun_devourer` eats the pile at 15 power per stack. When you hold `sun_devourer` at ~5 stacks: is
"eat now or grow to 8" a real hesitation? Play it twice - was the second game's line the same as
the first?

## S2 - feel the runaway, both sides (needs 102, 2 games)

| | you | opponent | |
|---|---|---|---|
| **S2a** | `fenrir_v1` | `sleipnir_v1` | his OS mints 2 Str per 0-cost card, uncapped |
| **S2b** | `sleipnir_v1` | control* | play the runaway from his own seat |

\* the pack didn't name S2b's opponent - `S2b` uses control as a neutral baseline; swap the enemy
block in the file if you'd rather feel it against a real deck.

Play A then B back to back. At what stack count did the game feel decided? (That number sizes
ticket 103's grant cap.) From the sleipnir seat: is the runaway FUN-broken or just broken - would
you miss anything if his mint were capped at ~4 Str/turn?

## S3 - the tug-of-war, before we fix it

| | you | opponent |
|---|---|---|
| **S3** | `draugr_v2` | `huldra_v1`* |

\* the pack said "huldra" with no OS suffix - this uses `huldra_v1` to match round-1's B2; swap to
`huldra_v2` if that's not what was meant.

The contested-status cell - your Dazed against their economy. Name the turn you felt you'd lost
agency. What did your hands WISH the deck could do instead in that moment? Write the wish
verbatim - it's direct input to draugr's second-lever design session.

## S4 - audhumbla baseline, before the milk

| | you | opponent |
|---|---|---|
| **S4** | `audhumbla_v2` | `gullinbursti_v1` |

One game, as she is today - her Regen-as-ammo rebuild is designed but not built. Count the turns
where you had an actual choice (predicted: near zero). Note every moment you would have DRUNK the
Regen pile if the payoff card existed - if those moments are frequent and tense, the rebuild is
right; if you never wished for it, say so before it's built.

## S5 - the new defensive axis (needs 102)

| | you | opponent |
|---|---|---|
| **S5** | `ratatoskr_v1`* | `kraken_v1` |

\* the pack said "pilot anyone you like" - this uses `ratatoskr_v1` because it carries
`shrug_off`, the shed card the pack specifically asks you to watch; swap the player block for a
different species if you'd rather.

His ink applies Dazed to you on his draws. Dazed now EXPOSES you: +1 power to every attack that
hits you, per stack, uncapped. Does incoming Dazed create real fear? Did you change your line to
play around it? If you cast the shed: did it feel like real value for the first time?

## S6 - favorites regression (needs 102, pick ONE)

| | you | opponent |
|---|---|---|
| **S6a** | `hel_v2` | control |
| **S6b** | `ymir_v2` | control |
| **S6c** | `fafnir_v1` | control |

All three files are provided so you don't have to hand-edit JSON - play whichever favorite you
want. Is the thing you loved intact? The status change shouldn't touch their engines, but hands
catch what diffs don't. Rate it against your memory: better / same / worse, one sentence why.

## S7 - fenrir's threshold, before ticket 96

| | you | opponent |
|---|---|---|
| **S7** | `fenrir_v1` | control |

Try to LIVE below 50% HP deliberately. How many turns did you manage to stay in the berserk
window? What killed the attempt - their burst, or your own heals? Ticket 96 raises the threshold
to 60% and adds a recoil enabler - after playing, does that feel like enough?

---

## What to write down

Only the things I cannot count from the export:

- **fun** (1-5)
- **the ONE decision** that mattered most
- **the moment you felt railroaded**, if any
- **anything the UI hid from you**

The `playtest-scoresheet.html` from round 1 will still work mechanically if you want a form to
fill in, but its prompts are round-1's - tell me if you want a round-3 version built to match the
fields above.

## If something breaks

Press **Ctrl+Shift+E** immediately and keep the file - a snapshot plus its tape is exactly what a
bug report needs, and it is the same format as these scenarios, so I can re-launch the exact
state.

## What tonight decides

S2 sizes the generation caps. S3 seeds draugr's design session. S4 validates (or vetoes) the
audhumbla rebuild before it's built. S1/S5 are the verdict on the entire status re-denomination -
if riders still feel fake at +1, we sweep +2 before anything else ships on top. S6 is the
regression gate.
