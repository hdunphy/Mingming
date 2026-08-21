# Buffing the bottom four (ticket 82): fenrir_v1, kraken_v2, fafnir_v1, fafnir_v2

Henry's call: *"Let's do a similar pass of the bottom 3 decks. Do bottom 4 if we have 4 under 35%.
Give them all a slight buff. Same strategy but look for ways to improve the decks. Start with small
OS changes, but here we might want to look at under performing cards or maybe look to sub a card if
something doesn't fit."*

Four decks sat under 35%. All four diagnosed and shipped together.

| deck | before | after | change |
|---|---|---|---|
| `fenrir_v1` | 24.9% | **36.0%** | UNBOUND_KERNEL: **recoil removed**, Strengthened **1 -> 3** |
| `kraken_v2` | 25.8% | **36.6%** | TIDAL_CRUSH: gate **3e -> 2e**, bonus **15% -> 30%** |
| `fafnir_v1` | 30.5% | **40.7%** | species attack **62 -> 68**; `slag_shed` -> a 2nd `motherlode` |
| `fafnir_v2` | 33.7% | **39.2%** | species attack **62 -> 68** (shared stat block) |

Before/after are the **full 960-cell grid at 30 iterations**, all four changes live together. The
sweep numbers quoted below the fold are the 15-iteration single-arm reads used to choose them.

## 0. The OS-contribution ladder said which lever to pull

Same first instrument as the nerf passes (METHOD.md 1.3), read in the other direction: turn each
deck's OS off and see what it was worth. On a **weak** deck the reading tells you whether the OS is
carrying the deck (so the cards are the problem) or freeloading (so the OS is).

| deck | live | OS off | OS worth |
|---|---|---|---|
| `fenrir_v1` | 24.9% | 24.0% | **+0.9 - a wash** |
| `kraken_v2` | 25.5% | 19.4% | +6.1 |
| `fafnir_v1` | 30.6% | 21.9% | +8.7 |
| `fafnir_v2` | 34.1% | 22.0% | +12.1 |

Compare the nerf group, where the same measurement read +34 to +64. **No deck at the bottom has an
OS worth more than +12.** That is the whole story of the floor: the top of the roster is decided by
firmware and the bottom is decided by frames and cards.

## 1. `fenrir_v1` - the OS was charging rent on a deck it wasn't helping

UNBOUND_KERNEL: *"Attack programs apply 1 Strengthened and deal 2% Max HP recoil damage."*

The wash reading (+0.9) is not neutral, it is **negative with a rebate**. With the OS switched off
she casts `ragnarok_edge` MORE often (1.89 vs 1.64) and her games run longer - the recoil was
killing her tempo, and 1 Strengthened per attack was buying it back and nothing more.

**The price has no intermediate setting.** She is a 66 HP frame; 2% of 66 and 1% of 66 round to the
same damage, and `recoil=1` measured 24.9% - *identical* to baseline. So the recoil is either on or
off; there is no gentle version of it.

| arm | field |
|---|---|
| baseline | 24.9% |
| `recoil=1` | 24.9% (rounds to the same damage) |
| `str=2` (recoil kept) | 27.9% |
| `recoil=0` | 29.4% |
| `str=3` (recoil kept) | 30.6% |
| `recoilcost=2` (only 2e+ attacks pay) | 25.3% |
| `recoilcost=2,str=2` | 26.5% |
| **`recoil=0,str=2`** | **34.6%** |
| **`recoil=0,str=3`** (shipped) | **36.2%** |

I tried hard to keep the recoil, because a self-damage clause is the OS's flavour: gating it so
only expensive attacks pay it (`recoilcost=2`) returned 25.3% and 26.5% - it keeps the shape and
buys nothing. Removed. What survives is the half that was actually doing work, tripled: **every
attack program applies 3 Strengthened.** The kernel is still "attacks make you stronger"; it just
no longer bills you for it.

At `str=2` she landed 34.3%, a shade under the floor; `str=3` clears it at 36.2%. If 3 free
Strengthened per attack reads as too much snowball, `str=2` is a one-number step back.

**Rejected:** swapping `ember_mend` (played 97% of games, heals 2.5% of 66 HP - about 1.6 HP, and
deals nothing) for `crimson_draw` measured 35.2% *after* the OS fix, but it cut her cards/turn from
1.53 to 1.33 and pushed the first `ragnarok_edge` from turn 2.9 to 3.4. It buys nothing the OS
change didn't already buy, and it makes the deck slower. `ember_mend` is still a nearly-blank card
and is the obvious next thing to look at - as a rider, not a swap.

## 2. `kraken_v2` - a payoff the frame could not afford

TIDAL_CRUSH_OS: *"Water cards that cost 3 or more Energy deal 15% more damage."*

Kraken runs a **2-Energy** frame. The OS only pays on 3e+ cards, so it asks her to spend a turn and
a half banking for every trigger. `maelstrom` and `hydro_blast` cast **0.47 and 0.58 times a game**
- a deck built on a payoff it casts every other game, for +15% when it lands.

This is the mirror image of the hraesvelgr nerf. There the fix was making an OS trigger *less*;
here it is making it trigger *at all*.

| arm | field |
|---|---|
| baseline | 25.5% |
| swap `maelstrom` -> `pressure_point` | 23.9% (worse) |
| `tidalcost=2` | 27.6% |
| `tidalpct=0.30` | 31.0% |
| **`tidalcost=2,tidalpct=0.30`** | **37.4%** |

Neither half is enough alone, and that is the point: dropping the gate without raising the bonus
just spreads a bonus too small to notice, and raising the bonus without dropping the gate makes a
payoff she still can't reach hit slightly harder. Shipped together - **Water cards costing 2 or
more Energy deal 30% more damage.** The OS is unchanged in kind; it now fits the frame it lives on.

`maelstrom` was 52% dead and I tried replacing it (23.9%, clearly worse) - the card was never the
problem, the price of using it was.

## 3. `fafnir_v1` and `v2` - the lowest attack stat in the game

Fafnir's frame: 92 HP, **attack 62 - the lowest of the 32 decks** - defense 95. The registry note
from ticket 52 already knew: *"the same card deals 47% less damage here than on nidhoggr."*

Both his OSes work. HOARD_PROTOCOL is worth +8.7 and CORRUPTED_GOLD_OS +12.1, and OS knobs moved
nothing - `hoardpct=0.005` (halving the hoard tax) returned 30.3%, `strper=3` returned 33.3%. There
is nothing wrong with either OS; there is not enough attack under them for the payoff to matter.

| arm | field |
|---|---|
| `fafnir_v1` baseline | 30.6% |
| `hoardpct=0.005` | 30.3% |
| swap `slag_shed` -> `motherlode` | 34.6% |
| `attack=72` | 42.6% |
| **`attack=68` + the swap** (shipped) | **41.5%** |
| `fafnir_v2` baseline | 34.1% |
| `strper=3` | 33.3% |
| `attack=72` | 45.3% |
| **`attack=68`** (shipped) | **39.7%** |

62 -> 68 rather than 72: 72 put v2 at 45.3%, above the middle of the roster, and the stat is
**shared by both decks** so it has to be priced for the stronger of the two.

**The card swap.** `slag_shed` sat **72% dead**, dealt **0 damage** and measured **0.0 power** -
the deadest card found in any audit so far. HOARD_PROTOCOL banks Energy; `motherlode` is what cashes
the bank in, and the deck ran only one. It now runs two (the rulebook's max), which is what a hoard
deck wants far more than a card the AI never plays.

`hoardbreaker` is still nearly dead - **0.14 casts a game, first cast turn 5.1** on a deck whose
games run 5.6 turns. It is the next card to look at, and I left it alone here so this pass reads
cleanly.

## 4. What this pass says about the roster

The nerf passes found OSes worth +34 to +64 and cut them. This pass found the opposite failure
twice, in two different flavours:

- **A price with no product** (`fenrir_v1`): the OS charged a real cost every turn and returned
  something worth less than the cost.
- **A product with no price it can pay** (`kraken_v2`): the OS offered a real bonus behind a gate
  the frame could not clear.

And once, neither: **fafnir's OSes are fine and his frame is not.** That is the case where the stat
block is the honest lever - and it is the only stat change in the whole pass.

## 5. Gates

Full grid, 960 cells at 30 iterations, all four changes live:

| | before | after |
|---|---|---|
| absolute 0% cells | 64 | **51** |
| absolute 100% cells | 63 | **54** |
| NEUTRAL 0% cells | 21 | **14** |
| NEUTRAL 100% cells | 20 | **12** |
| out-of-band cells (<10% / >90%) | 357 | **317** |
| decks inside the 35-80 field band | 28/32 | **31/32** |
| FTK | 2 (both accepted) | 2 (both accepted) |

Per deck: `fenrir_v1` 12 zero cells -> **4** and 22 out-of-band -> 15; `fafnir_v1` 5 -> **1**;
`kraken_v2` 5 -> 3; `fafnir_v2` 6 -> 4.

**This is the biggest single-ticket improvement in roster health so far** - the bottom four were
generating most of the roster's blowout cells, exactly as ticket 81 predicted.

8-DIFF: 10 of 67 balance rows moved, every one of them a fenrir, kraken or fafnir row or a control
gauntlet aggregate containing them. Matchup redlines 11 -> 10, card redlines unchanged at 42. 843
of 843 unit tests pass.

Everything untouched drifted down 0.3-3.3 points, which is what four decks getting stronger looks
like from the other side.

## 6. Next

1. **`sleipnir_v2` is the new floor at 33.7%** (was 37.0%) - the only deck left under 35, and it
   got there by standing still. It is the whole of the next pass.
2. **`kraken_v1` at 41.3% is now the weaker kraken**, and the OS-variance row flipped hard
   (72% -> 39%). v2 has overtaken it. Worth a look before v1 becomes the next floor.
3. **`hoardbreaker` is still nearly dead** on `fafnir_v1` - 0.14 casts a game, first cast turn 5.1
   on a deck whose games last 5.6 turns. Left alone deliberately so this pass reads cleanly.
4. **`ember_mend` on `fenrir_v1`** is played in 97% of games and does almost nothing (heals ~1.6 HP
   on a 66 HP frame). Rewrite it as a rider rather than swapping it out - the swap measured worse.
5. `avalanche`'s uncapped rate still stands from ticket 81.
