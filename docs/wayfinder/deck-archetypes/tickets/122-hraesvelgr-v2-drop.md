# Ticket 122 — `hraesvelgr_v2` lost 10.9 points of field to the ticket-111 fix, and nobody knows why

**Status:** OPEN, unconfirmed. Opened 2026-08-26 at Henry's request — *"Add a ticket to investigate
hraesvelgr_v2."*

## The finding

The post-ticket-111 re-baseline moved 31 of 32 decks by less than 4 points. One did not:

| deck | field after | field before | delta | cells moved 5+ |
|---|---|---|---|---|
| `hraesvelgr_v2` | 44.9% | 55.9% | **−10.9** | **21 of 30** |
| `hraesvelgr_v1` | 48.5% | 51.7% | −3.2 | 11 of 30 |
| *(next largest mover)* | | | ±1.8 | |

**Twenty-one of thirty cells moved.** Every other deck on the roster shrugged the fix off.

## Why this is interesting rather than just noise

Ticket 111 stopped a card drawing itself back out of its own mid-resolution reshuffle. The obvious
victim of that fix would be a deck that was exploiting the loop — but `valkyrie_v2`, the deck where
the loop was *found* (213 `glimmer` plays a game, a 249-play streak, 43 of 60 games never deciding),
came out **+1.8**. The deck that visibly abused it barely moved; a deck nobody was looking at lost 11
points.

**So `hraesvelgr_v2` was quietly living off the same bug, in a way that never produced a single
undecided game and never showed up in any gate.** It sat in the committed 960-cell grid the whole
time, indistinguishable from a legitimately strong deck. That is the part worth understanding: not
the 11 points, but that a bug worth 11 points of field can hide completely inside a clean-looking
row.

## What is not known

- **It has never been confirmed on a second seed base.** One base, 30 iterations. The whole finding
  could be a seed artifact, and this repo has already seen full-tier runs disagree with themselves by
  MAD 6–13 per cell across bases. **Confirming or killing it is step one and it is cheap.**
- **The mechanism is unidentified.** `hraesvelgr_v1` moved −3.2 in the same direction, so whatever it
  is, both OSes touch it. Hraesvelgr's X-cost cards and `GALE_FORCE` are the obvious suspects — an
  X-cost card that empties the hand interacts with reshuffle timing differently from a fixed-cost
  one — but that is a guess, not a diagnosis.
- **Whether 44.9% is now wrong.** It is inside the 35–80 field band, so nothing is broken. The
  question is whether the deck was designed around a behaviour it no longer has, and wants a pass.

## Suggested order

1. Re-run `hraesvelgr_v2`'s 30-cell row on a second seed base. If the drop does not reproduce, close
   this ticket.
2. If it does, instrument reshuffles-during-resolution per deck the way `scratch/exclusionscan.ts`
   did for ticket 111, and find what `hraesvelgr` was doing that the rest of the roster was not.
3. Only then decide whether the deck needs tuning.
