# Ticket 70 — the raw snowball runs

The seven measurement files behind
[ticket 70](../../tickets/70-first-ko-snowball.md)'s numbers, kept because a ratio in a ticket is
only as good as the run it came from and these took six hours of wall clock to produce.

## READ THIS FIRST: every file here was measured on the PRE-RULING ENGINE

All seven predate the commit that made the bereavement rally a real rule
(`effectHandlers.applyBereavementRally`, ruled 2026-08-29). **The baseline in `snowball-70.txt` is
8.3% comebacks; on the current engine a no-arm run should read ~16.7%**, because the thing
`arm-once.txt` was testing now ships.

So these are a **historical record of how the decision was made**, not a description of the game as
it stands. Anything compared against them has to say which engine it ran on.

## The files

| file | arm | comebacks | length | what it was for |
| --- | --- | --- | --- | --- |
| `snowball-70.txt` | none — **the baseline** | 8.3% (5/60) | 6.5 | The four numbers the ticket demanded before its grilling. |
| `arm-once.txt` | `--energized once` | **16.7%** (10) | **6.5** | **The arm Henry ruled.** In band, length-neutral. |
| `arm-standing.txt` | `--energized standing` | 20.0% (12) | 6.0 | The energy cliff fully repaired. Best comeback rate, but shortens fights. |
| `arm-draw-once.txt` | `--draw once` | 8.3% (5) | 6.4 | A null. 206 cards granted, landed on the baseline exactly. |
| `arm-draw-standing.txt` | `--draw standing` | 10.0% (6) | 6.2 | A null. 836 cards granted, moved one battle. |
| `arm-both-once.txt` | `--energized once --draw once` | 13.3% (8) | 6.3 | Adding cards made the energy arm WORSE. |
| `arm-both-mixed.txt` | `--energized once --draw standing` | 13.3% (8) | 5.8 | Same, and the shortest fights of any arm. |

Every arm ran 60 battles — the `REFERENCE_PANEL` round-robin, 30 ordered pairs, both turn orders —
**seeded identically to the baseline**, which is what makes the paired McNemar test in the ticket
possible and is where nearly all of the statistical power came from.

## How to read them

Each file has a progress block, a summary of the four numbers, an **ARM LIVENESS** block, and a
per-pair table. Read the liveness block first: it reports how many Energized stacks and extra cards
the arm actually granted, and a zero there means the run is **void rather than null**. That guard
exists because of the balance merge report's costliest lesson — *"a dead arm reads exactly like a
null result"*.

The per-pair table is the useful one. `P(win|first KO)` per pair is over 2 battles, so 100% means
both battles went to the first-KO scorer, 50% means one flipped, 0% both. Differencing those against
the baseline pair-by-pair is exactly the McNemar input.

## Reproducing

```
npm run balance:snowball -- --iterations 1 --pairs --out <file>
```

~40 minutes for 60 battles. Add `--energized once|standing` and/or `--draw once|standing` for an
arm. **On the current engine `--energized` stacks on top of the shipped rally** rather than creating
it, so it is no longer the same experiment these files record.

A derived scratch file (`pairs.txt`, a three-way extraction of the per-pair tables) was not kept —
it is regenerable from these in one command.
