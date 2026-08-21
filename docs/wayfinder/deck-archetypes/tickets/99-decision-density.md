# Decision-density census (ticket 99) - CLOSED, instrument rejected

- Type: wayfinder:research - report only. Branch `archetype-web`.
- Status: **closed** (2026-08-19). No design changes, as specified.

Report: [research/decision-density.md](../research/decision-density.md).

## Verdict

**The instrument failed its own validation gate and is rejected.** The ticket said that if the
ranking disagrees with Henry's playtest the INSTRUMENT is wrong; it disagrees, so it is.

Henry's three favourites (`ymir_v2` 5/5, `fafnir_v1` 4/5, `hel_v2` "most fun") rank **22nd, 9th and
28th of 32** on flip rate, while two decks he called boring rank **3rd and 7th**. Close-call rate
separates nothing - 28 of 32 decks sit between 82% and 99.5% - except that `ymir_v2` is the LOWEST
at 49.3%, which is backwards. A fourth proxy added mid-ticket (foreclosure: share of held cards
never played) also fails: `fenrir_v1` at 42.5% sits between the two favourites.

## Why, in one line

**Every proxy measures how hard a choice is to COMPUTE; the fun tracks what a choice COSTS.**
`ymir_v2`'s AI almost always knows which card is best - and the player is choosing which card to
give up forever, because her OS allows one play a turn. A solver cannot report opportunity cost.

## What replaced it

Reading the OS text. **Second resource axis: 3 of 3 of Henry's favourites have one, 0 of 4 of his
bottom decks do** - `hel_v2` spends HP, `ymir_v2` is rationed on plays, `fafnir_v1` banks Energy.
Perfect separation, no simulation required, and exactly the prediction the ticket put on record.

Only **8 of 32 decks** have a second axis. The other 24 are the backlog - and it is the same backlog
ticket 88 produced from the economy side, which is two independent routes to one list.

## Kept

`setDecisionTap` in `TacticalAI` (inert in production, same seam shape as the store's action tap)
and `scratch/decisions.ts`. The numbers are sound even though the hypothesis is wrong, and the tap
is the only view into the AI's candidate distribution we have.

`AI_GREEDY=1` also lands: it disables the 1-turn lookahead, which is the ticket's greedy-gap proxy
and a useful switch for any future AI work.
