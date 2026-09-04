# The sleep lock (ticket 91)

- Type: wayfinder:task - Henry-directed, 2026-08-19. Branch `archetype-web`.
- Status: **closed** (2026-08-19)

Henry, playing the published branch: *"one more bug about being put in a sleep cycle... I think
Huldra's move was sleep every other turn. But that status shouldn't be legal to apply and re-up
sleep."*

Exactly right, and the diagnosis is worth recording because **the anti-lock machinery already
existed and was simply never reached.**

## The bug

`AsleepBehavior.onApply` RESET the timer to `ASLEEP_INITIAL_STACKS` (3) when the target was already
asleep. Huldra's Debuff intent applies `Asleep`, so an enemy casting it every other turn kept the
counter pinned at 3 forever. The player never got a turn.

**Everything needed to stop that was already in the engine:**

- waking grants **1 turn of `StableOS`** - both on natural expiry (`battleReducer`) and on the
  damage-wake path (`effectHandlers`, ticket 48 closed that drift);
- `StableOS` **refuses `Asleep` and `Stunned` outright** at the apply layer;
- and `StunnedBehavior` has always no-opped when the target is already stunned.

The timer just never expired, so the immunity never fired. **`Asleep` was the one hard-CC status
that could extend itself.**

## The fix

Re-applying `Asleep` while asleep is now a no-op, matching `Stunned`. The guarantee that buys:
**every sleep ends within 3 turns and is always followed by an awake turn that cannot be taken
away.** Three tests pin the guarantee rather than the implementation, including one that spams the
status every turn and asserts the sleep still ends on schedule.

The glossary now says so too - it used to advertise *"reapplying resets it to 3"*, which was
accurate and was the bug.

## Balance cost, measured

A/B at 15 iterations against the full field, same seeds:

| | field | 0% cells | 100% cells |
|---|---|---|---|
| `draugr_v1` with re-up (before) | 47.6% | 2 | 4 |
| `draugr_v1` without re-up (after) | **41.6%** | 4 | 2 |

`draugr_v1` is the sleep deck - five of her cards apply `Asleep` - and she is the only deck that
loses anything here. **6 points, and she stays comfortably in the 35-80 band with FEWER blowout
cells than before** (100% cells 4 -> 2). No other deck runs a sleep card; huldra applies it as a
MOVE, which only exists in enemy-intent battles and is not part of the deck-vs-deck grid.

This also matches her design note: ticket 48 records that *"StableOS is what forces an awake turn
after every wake, which is the whole two-turn rhythm"* for `draugr_v1`. The re-up path was letting
her escape the rhythm she was designed around.

**Not compensated.** If Henry wants those 6 points back, the honest place is her card list rather
than the CC rules - `barrow_king` is 86% dead on that deck and has been since the ticket-85 audit.

850 tests (3 new). `tsc` clean.
