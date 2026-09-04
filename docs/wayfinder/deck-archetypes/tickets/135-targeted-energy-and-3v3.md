# Ticket 135 — targeted +1 energy, and the first 3v3 numbers

**Status:** CLOSED 2026-09-04 — ruled; the targeted-energy half shipped in 136d, the 3v3 half moved to ticket 140.
**Branch:** `legion/ai-perf`
**Asked by Henry:** *"can you see what happens if you give 1e extra to all of the decks that are
under performing... give me the 3v3 numbers... report on both when you're done"*

---

## PART ONE — +1 energy to the nine underperforming decks

### What was run

The nine decks that came out of the promoted grid below the 35–80 band got +1 energy. Nobody else
did. `huldra_v1` is the tenth out-of-band deck but it is out the **top** at 91.8, so it was left
alone.

This is **not** ticket 134's `ENERGY` arm. That one gave +1 to everybody and made the losing decks
*worse* — ymir_v2 went 42.1 → 19.9 — because the cheap winners had more cards in hand to spend it
on. This is the opposite experiment: give it only to the decks that need it.

Full 32-deck grid, not a panel, and that choice matters. Buffing nine decks changes the score of
all thirty-two: every deck that plays one of the nine now meets a stronger opponent. Reading this
off a ten-deck panel would have confused that drift with a real effect.

Energy is a **species** stat (`initializeBattleEntity` reads `definition.baseStats.energy`), and
five of the nine underperformers have a healthy sibling on the same species — fenrir_v1 is 26.8
while fenrir_v2 is 70.0 — so patching the species would have buffed decks that need no help.
`scratch/energyshard.ts` patches per cell instead, which is exact rather than approximate: the
opponent list is built with `if (sp !== SPECIES)`, so within any one cell the two sides are always
different species carrying exactly one firmware each. Both the shard and the merger independently
re-derive which sides should have been buffed and throw if the per-cell energies disagree.

### The result

| deck | field | was | delta | |
|---|---|---|---|---|
| `huldra_v1` | 85.2 | 91.8 | −6.7 | OUT |
| `kraken_v1` | 79.3 | 29.4 | **+49.9** | **+1e** |
| `kraken_v2` | 74.5 | 29.1 | **+45.4** | **+1e** |
| `jormungandr_v1` | 71.1 | 74.6 | −3.6 | |
| `nidhoggr_v1` | 68.6 | 78.5 | −9.9 | |
| `ratatoskr_v2` | 68.3 | 78.2 | −9.9 | |
| `ratatoskr_v1` | 67.1 | 75.4 | −8.2 | |
| `draugr_v1` | 66.0 | 29.3 | **+36.6** | **+1e** |
| `fenrir_v1` | 63.0 | 26.8 | **+36.1** | **+1e** |
| `sleipnir_v1` | 61.3 | 72.4 | −11.1 | |
| `fenrir_v2` | 59.4 | 70.0 | −10.6 | |
| `audhumbla_v1` | 56.0 | 67.0 | −10.9 | |
| `hraesvelgr_v1` | 55.1 | 63.9 | −8.7 | |
| `jormungandr_v2` | 54.2 | 33.0 | **+21.2** | **+1e** |
| `huldra_v2` | 52.0 | 61.2 | −9.2 | |
| `gullinbursti_v1` | 50.9 | 63.6 | −12.7 | |
| `fafnir_v1` | 50.2 | 19.0 | **+31.2** | **+1e** |
| `gullinbursti_v2` | 47.9 | 27.3 | **+20.6** | **+1e** |
| `valkyrie_v1` | 43.9 | 62.0 | −18.1 | |
| `draugr_v2` | 43.9 | 54.0 | −10.1 | |
| `skoll_v2` | 42.5 | 51.9 | −9.3 | |
| `hel_v2` | 38.8 | 31.7 | **+7.1** | **+1e** |
| `ymir_v1` | 37.1 | 48.7 | −11.7 | |
| `skoll_v1` | 33.6 | 40.7 | −7.1 | OUT |
| `hel_v1` | 33.6 | 49.3 | −15.7 | OUT |
| `audhumbla_v2` | 33.3 | 47.7 | −14.4 | OUT |
| `ymir_v2` | 31.8 | 42.1 | −10.4 | OUT |
| `fafnir_v2` | 30.7 | 17.8 | **+12.9** | **+1e** OUT |
| `valkyrie_v2` | 28.5 | 46.8 | −18.3 | OUT |
| `sleipnir_v2` | 24.0 | 41.4 | −17.4 | OUT |
| `nidhoggr_v2` | 23.7 | 35.3 | −11.6 | OUT |
| `hraesvelgr_v2` | 19.0 | 37.8 | −18.8 | OUT |

|  | mean | spread (sd) | in band |
|---|---|---|---|
| before | 49.9 | 19.4 | 22/32 |
| after | 49.8 | **17.3** | 22/32 |

**Eight of the nine buffed decks came into band.** Only fafnir_v2 stayed out, at 30.7.
**Eight unbuffed decks fell out of band.** skoll_v1, hraesvelgr_v2, sleipnir_v2, ymir_v2,
valkyrie_v2, audhumbla_v2, hel_v1, nidhoggr_v2.

### The thing this measurement actually taught us

**The field is zero-sum, and no knob can ever change that.** Every deck's score comes from playing
every other deck, so one deck's extra win is another deck's extra loss. The mean is pinned by
arithmetic: 49.9 before, 49.8 after, and it will be ~50 after every arm anybody ever runs. The
whole 30-point rescue of nine decks was paid for by a ~10-point levy on the other twenty-three.

That reframes the goal. **"Get the decks back in band" cannot mean "lift the bottom" — it can only
ever mean "compress the spread."** Every previous arm was implicitly trying to lift, which is why
none of them worked. This one is the first to compress at all: sd 19.4 → 17.3.

### But the step is far too big

kraken_v1 went 29.4 → 79.3. That is not a fix; it is a deck thrown from the bottom of the roster to
the top edge of the band in one move, and kraken_v2 (74.5) went with it. Base energy is **2** for
16 of the 17 species, so +1 energy is a **50% resource increase.** There is no smaller step
available.

**This is the same wall ticket 134 hit with cost.** Cards cost 0, 1 or 2, so +1 cost is a 50%
change; units have 2 energy, so +1 energy is a 50% change. Every integer knob in this game's
economy is a 50%-plus change, because the whole economy runs on numbers between 0 and 2. **There is
no fine adjustment available anywhere in it**, and that — not any individual deck — is why the
roster cannot be tuned back into shape.

Which points at a specific fix, and it is one Henry already accepted the argument for once.
Ticket 131c multiplied damage and health by 10 partly because *"bigger numbers often feel better"*.
The energy economy never got that treatment. If base energy were 20 and cards cost 0–20, then ±1 is
a 5% adjustment and every knob in this ticket and ticket 134 becomes usable at a sane resolution.
It is a pure re-denomination — no card changes meaning, nothing rebalances — and it buys back the
tuning resolution that ticket 131 spent.

---

## PART TWO — the 3v3 numbers

### How they were taken, and why they are not the same instrument

**A deck is three copies of itself.** At 3v3 the pile is shared across the party, so a mixed trio
measures its partners as much as its subject — one deck in three is one third of the pile and one
third of the cost profile. Three copies of one firmware keeps the pile's average cost exactly equal
to that deck's, while expressing the full three-body draw. That is the only construction that
isolates the deck under test.

**They are beamed, and that was not a choice.** Every 1v1 number on record is beamless (ticket
108's rule). Beamless 3v3 is no longer affordable: the probe at `--beam 0` **did not finish two
paired iterations in ten minutes.** Branching is roughly casters × hand × targets at depth 3, and
ticket 131 took the hand cap from 9 to 15, so the beamless 3v3 tree grew with the hand. These ran
at `GAME_BEAM_WIDTH` (8) — the search a player actually plays against — at a measured 60s per
battle with the beam pruning 5.78M candidates of 7.36M enumerated.

So read these for **ordering and spread**, not against 1v1 absolutes. Six decks, round robin, four
battles a cell.

### The result

| deck | 3v3 | 1v1 | avg cost |
|---|---|---|---|
| `sleipnir_v1` | **95.0** | 72.4 | 0.67 |
| `huldra_v1` | 75.0 | 91.8 | 0.67 |
| `ratatoskr_v1` | 65.0 | 75.3 | 0.73 |
| `ymir_v2` | 40.0 | 42.1 | 1.50 |
| `fafnir_v1` | 20.0 | 19.0 | 0.82 |
| `fafnir_v2` | **5.0** | 17.8 | 0.90 |

|  | mean | spread (sd) | in band |
|---|---|---|---|
| 1v1 (same six) | 53.1 | 28.6 | 3/6 |
| 3v3 | 50.0 | **31.4** | 3/6 |

**Henry's instinct was right, and it is worse than he thought.**

1. **The spread is wider at 3v3, not narrower.** sd 28.6 → 31.4 on the same six decks.
2. **Thirteen of the fifteen cells are absolute — 0% or 100%.** At 3v3 these matchups are not
   close; they are decided. The only two that were not: ratatoskr_v1 vs sleipnir_v1 (25%) and
   huldra_v1 vs fafnir_v2 (75%).
3. **The ordering mostly survives**, with one reversal: `sleipnir_v1` goes from third at 1v1 to
   first at 3v3, and beats `huldra_v1` 100–0 there having lost to it at 1v1. sleipnir_v1 is the
   panel's largest deck (12 cards, 5 free, 0.67 average cost), which is exactly the profile that
   should gain most when the draw triples.
4. **Games are longer:** 6.45 turns at 3v3 against roughly 5.0 at 1v1.

The cost axis holds: the three decks at 0.67–0.73 average cost take the top three places, and the
most expensive deck on the panel (ymir_v2 at 1.50) sits fourth despite having been the *best* deck
on the roster before ticket 131 at 66.4.

### A side finding with a product consequence

Ticket 131 made the AI's job substantially harder. The beamless 3v3 search went from expensive to
unaffordable purely because the hand cap went 9 → 15. The shipping beam absorbs it, but
**steam-release ticket 39 (move the AI to a Web Worker) got more urgent, not less** — ticket 127
left the 3v3 decision at 569ms against a 1.0s p95 target with a bigger hand than it was measured
on.

---

## Decisions I need from Henry

**1. Do you want the energy economy re-denominated?** Multiply base energy and every card cost by
the same factor — say ×10, so units have 20 energy and cards cost 0/10/20. Nothing changes meaning
and no deck rebalances; it is the same move ticket 131c made for damage and health. What it buys is
**tuning resolution**: today every knob is a 50% change because every number is a 0, 1 or 2, and
that is why both the cost knob and the energy knob overshoot so violently. This is my
recommendation and I think it should come before any per-deck work, because it is what makes the
per-deck work possible.

**2. Do you want the targeted +1 energy shipped as-is in the meantime?** It rescues 8 of 9 decks
and it is the first thing to compress the spread (19.4 → 17.3). But it knocks 8 other decks out
while doing it, and it throws kraken from 29 to 79 in one step. My recommendation is **no, not
as-is** — it is the right lever at the wrong resolution, and it becomes the right answer once
decision 1 is made. If you want it now anyway, it would ship as an on-battle-start firmware hook
granting +1 maxEnergy, not as a stat change; `driverRegistry`'s `ENERGY_CAP_BONUS` already does
exactly this.

**3. Given 13 of 15 3v3 cells are absolute, is "in band at 3v3" even the right target?** A 3v3
matchup that is 100–0 is not a balance problem you can tune away with win rates — it means the
first side to establish its engine wins outright. That may want a structural answer (a comeback
mechanic, a cap on how far ahead a turn-one lead compounds) rather than a numbers answer. I have
not investigated it and would need your steer before spending time there.

---

## Reproducing

```bash
node scratch/energygrid.mjs --iter 30                       # ~2h, resumable per deck
npx vite-node scratch/trio3v3.ts -- --iter 2 --shard 0 --shards 2   # ~2h across 2 lanes
npx vite-node scratch/trioprobe.ts -- --beam 8 --iter 2     # the cost measurement
```

Results land in `results/energyarm/` and `results/trio3v3/`. Both runners are resumable and both
assert their arm took effect — `energygrid` re-derives the buff set independently of the shard and
throws on disagreement; `trio3v3` throws if the beam pruned nothing.

---

# Resolution — CLOSED 2026-09-04

Ruled through ticket 136, which its header names as a review of 134/135.

**Part one — targeted +1 energy — shipped, but narrowed.** Henry did not take the blanket +1 to
all nine underperformers. What shipped in **136d** was three species stats moved by a single point
each, in BOTH directions: ratatoskr Energy 3 → 2, fafnir 2 → 3, draugr 2 → 3 with cardDraw 4 → 3.
That is this ticket's instrument used as a scalpel rather than a blanket, and it rescued five deck
slots (fafnir 19/18 → 54/34, draugr 29/54 → 52/65) while taking ratatoskr DOWN from 75/78.

**Part two — the 3v3 numbers — superseded by ticket 140**, which has the wider comp measurements
and the beamless-3v3 cost reduction that makes them affordable to repeat.

Everything in the 1v1 roster this ticket measured against has since been re-measured seven times;
its tables are historical.
