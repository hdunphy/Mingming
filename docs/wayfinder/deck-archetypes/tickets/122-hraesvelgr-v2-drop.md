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

## CONFIRMED 2026-08-26 — step one is done, and the drop is real

The pre-fix build was recovered in the measurement lane (a temporary `TICKET111_OFF` switch on
`drawCards`' exclusion, never committed) so that both sides could be measured on the **same** seed
bases, instead of comparing a fresh run against a single-base number from the old committed grid:

| seed base | pre-fix | post-fix | delta |
|---|---|---|---|
| `grid` | 55.35% | 45.09% | **−10.3** |
| `gridB` | 55.73% | 45.09% | **−10.6** |
| `gridC` | 56.66% | 46.43% | **−10.2** |

**Three independent bases, all agreeing inside half a point. Not a seed artifact.**

`hraesvelgr_v1` was measured the same way and moves the same direction, smaller: −3.3 on `grid`,
−2.7 on `gridB`. So both OSes were living off the loop, v2 about three times as much.

**What this means:** `hraesvelgr_v2` really was drawing 10 points of field win rate out of a bug — a
card reshuffling itself back out of the discard mid-resolution — and it did so without ever producing
a single undecided game, an FTK, or any other signal a gate would have caught. `valkyrie_v2`, the
deck the loop was *found* in, gained 1.8 from the same fix. **The deck that visibly abused it barely
moved; the deck nobody was looking at was the one quietly living on it.**

## What is still not known
- **The mechanism is unidentified.** `hraesvelgr_v1` moved −3.2 in the same direction, so whatever it
  is, both OSes touch it. Hraesvelgr's X-cost cards and `GALE_FORCE` are the obvious suspects — an
  X-cost card that empties the hand interacts with reshuffle timing differently from a fixed-cost
  one — but that is a guess, not a diagnosis.
- **Whether 44.9% is now wrong.** It is inside the 35–80 field band, so nothing is broken. The
  question is whether the deck was designed around a behaviour it no longer has, and wants a pass.

## Suggested order

1. ~~Re-run on a second seed base.~~ **Done — confirmed on three, see above.**
2. Instrument reshuffles-during-resolution per deck the way `scratch/exclusionscan.ts`
   did for ticket 111, and find what `hraesvelgr` was doing that the rest of the roster was not.
3. Only then decide whether the deck needs tuning. It sits at 45.1%, inside the 35-80 band, so
   nothing is broken - the question is whether the deck was designed around a behaviour it no
   longer has.
