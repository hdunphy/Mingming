# Ticket 130 — daemons are priced by a guess, and the guess is load-bearing

- Type: wayfinder:task. **Status: open.** Raised by Henry, 2026-09-01: *"Do we have a ticket to
  address daemon power? if not we need one."*

We did not. This is it.

## The problem in one line

`powerscale` prices every daemon as **exactly four procs**, forever, regardless of what it procs on,
how often that happens, or when in the battle it was played.

```ts
const EXPECTED_DAEMON_PROCS = 4;
```

Its own comment is honest about this — *"This is a FLOOR, not a price. powerscale has no deck
context ... a daemon in a deck built around it runs at roughly twice this"* — but the number is used
as a price anyway, because it is the only number there is.

## Three things the constant cannot see, all measured now

**1. The proc rate is not 4, and it is not one number.** `feedback_loop_daemon` procs on triggered
draws. Measured over real 3v3 battles (ticket 129, `scratch/handeconomy.ts`): **0.75 per-unit
triggered draws a turn**, zero on 57–64% of unit-turns, over a five-turn side. That is 3.75 procs for
a turn-1 play and 2.25 for a turn-3 play. The flat 4 happens to be about right for a turn-1 cast of
this one card and wrong everywhere else.

**2. Value is linear in remaining turns, and the price is not.** A daemon played on turn 3 of a
five-turn game is worth 60% of the same daemon played on turn 1. A single score cannot describe that,
and the current one silently describes the best case. **Any daemon that has to be "positive even when
played on turn 3" (Henry's bar) needs a non-per-turn component**, and the model has no way to say so.

**3. The `source: SELF` gate halves them at 3v3 and the price does not know.** `feedback_loop_daemon`
and 15 other firmwares/cards fire only for the unit that caused the trigger. At 3v3 the deck is
shared, so the side-wide rate (1.71 draws/turn) is 2.3× the rate the daemon actually sees (0.75).
The scorer prices the printed text, which reads side-wide. See ticket 128.

## And a plain bug while we are here

```ts
if (card.category === 'Daemon' && score === 0) { ...price the hook... }
```

**A daemon with any `actions` of its own loses its hook's value entirely.** The guard exists because
daemons "carry empty `actions` by construction", which is true of every daemon today — so the bug is
latent. It stops being latent the moment anyone gives a daemon an on-cast effect, which is exactly
the fix ticket 129 proposes for `feedback_loop_daemon` ("draw a card when played"). That card would
price as *just the draw*, hook value zero, and read as wildly under-costed while actually being fine.

## What a fix looks like

Not a bigger constant. Three pieces, in order of value:

1. **Per-trigger measured rates.** A small table keyed by trigger (`onCardDraw`,
   `onProgramPlayed`, `onTurnStart`, …) of procs-per-turn measured from real battles, the way
   `ASSUMED_TRIGGERED_CARDS_DRAWN = 1.25` already does for one scaler. `scratch/handeconomy.ts`
   produces the draw number; the others want the same treatment.
2. **A stated play-turn.** Price a daemon at the turn it is realistically cast, and record which
   turn that was, rather than implying turn 1. Henry's bar ("positive even on turn 2 or 3") is a
   statement about this axis and the model currently cannot express it.
3. **Fix the `score === 0` guard** so a daemon can have both actions and hooks.

Until (1) and (2) exist, every daemon price in the pool is a turn-1 best case with a guessed rate,
and `feedback_loop_daemon` is the proof that the error is large enough to matter: the constant says
2.7, the measured turn-3 value is 1.7.
