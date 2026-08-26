# Ticket 118 — playtest session: stacked-species comps, and whether control is fun to play

**Status:** OPEN, needs Henry at the controls. Opened 2026-08-26 at his request — *"Need to do some
play testing. Lets add a ticket to play test 3 & 4."*

Two questions the simulator cannot answer. Both were raised in ticket 114 and neither is a numbers
problem.

---

## 1. Stacked-species comps — feature, or does the per-card scaler need a condition?

**To be clear about what this is, because it was easy to misread as "duplicate OSes":** it is
**three of the same SPECIES on one team**, which your 2026-08-21 ruling made legal when the copy cap
came off. Not two decks sharing an OS — the same mingming, three times, feeding one shared 27-card
pile.

Measured (ticket 114 §Q3):

| stacked comp | vs `panel-zoo` | vs `panel-control` |
|---|---|---|
| `triple-jormungandr` | **86.7%** | 93.3% |
| `triple-sleipnir` | **80.0%** | **100%** |
| `triple-hel` | 70.0% | 83.3% |

For scale: ticket 109 threw twenty-five hand-built stress comps at `panel-zoo` and **none** beat it
(best 50%, mean 14.1%) — but none of them could stack a species. **Three of the five tried here beat
it.** FTK 0 and truncated 0 throughout, so nothing is broken; it is the ceiling that moved.

The suspected mechanism: the copy cap was what bounded scaler density in the shared pile.
`jormungandr_v1` carries `ink_stream`, an uncapped per-card-played scaler, and stacking the deck
three times puts three copies in one pile.

**What playtesting has to decide:** are these comps *reachable* and *fun*? A player has to actually
catch three of one species. If a triple is rare, this is a reward for a committed build and probably
the best thing the ruling bought. If it is easy, it is the default build and the roster collapses to
"which species do you triple". The acquisition rules are not settled, so the sim cannot tell you.

**If it needs bounding**, `0-NO-CAPS` rules out a ceiling — so the lever is a CONDITION that makes
the per-card scaler pay less often when the pile is dense, not a cap on copies.

---

## 2. Does coverage-based control feel good, or does it feel like chores?

Tickets 115 and 116 moved `panel-control` vs `panel-zoo` from ~10% to 40% at 3v3, entirely by making
control's answers reach the whole enemy side instead of one body. **The win rate says it worked. It
says nothing about whether the turns are enjoyable.**

The specific worry: control's play pattern is now "cast the side-wide debuff, then cast it again",
and side-wide effects resolve slowly and produce a lot of log spam. That can read as powerful or as
tedious, and only a person can tell which.

**Also worth feeling out in the same session:** whether 40% against the strongest zoo panel is the
right place for control to sit, or whether it should be closer to even. The design intent from the
start has been *control should beat zoo* — it currently still loses that matchup, just not
catastrophically.

---

## What is NOT in this ticket

Control vs RAMP at 1v1 (37.6% over 41 neutral cells). Henry's read, 2026-08-26: *"Ramp is supposed to
beat control"*, and the overall 44.2% is dragged down by how many of those neutral cells happen to be
RAMP. **Deliberately parked** — see the note in ticket 114 question 2.
