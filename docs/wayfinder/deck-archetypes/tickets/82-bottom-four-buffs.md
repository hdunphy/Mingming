# Buffing the bottom four (ticket 82): fenrir_v1, kraken_v2, fafnir_v1, fafnir_v2

- Type: wayfinder:task - Henry-directed, 2026-08-18.
- Status: **closed** (2026-08-18)

## Shipped

| deck | before | after | change |
|---|---|---|---|
| `fenrir_v1` | 24.9% | **36.0%** | UNBOUND_KERNEL: **recoil removed**, Strengthened **1 -> 3** |
| `kraken_v2` | 25.8% | **36.6%** | TIDAL_CRUSH: gate **3e -> 2e**, bonus **15% -> 30%** |
| `fafnir_v1` | 30.5% | **40.7%** | species attack **62 -> 68**; `slag_shed` -> a 2nd `motherlode` |
| `fafnir_v2` | 33.7% | **39.2%** | species attack **62 -> 68** (shared stat block) |

Two OS changes, one stat change (shared by both fafnir decks), one card swap. Report:
[research/bottom-four-buffs.md](../research/bottom-four-buffs.md).

## Why each lever

**The OS-contribution ladder decided it.** Turning each OS off: `fenrir_v1` **+0.9**, `kraken_v2`
+6.1, `fafnir_v1` +8.7, `fafnir_v2` +12.1. The nerf group read +34 to +64. **No deck at the bottom
has an OS worth more than +12** - the top of the roster is decided by firmware, the bottom by
frames and cards.

- **`fenrir_v1`** - the OS was *a price with no product*: 2% max HP per attack for 1 Strengthened,
  and with the OS off she cast `ragnarok_edge` MORE often (1.89 vs 1.64). On a 66 HP frame 1% and
  2% round to the same damage, so `recoil=1` measured 24.9%, identical to baseline - **the price
  has no intermediate setting.** Cost-gating it so only 2e+ attacks pay (25.3%, 26.5%) preserved
  the shape and bought nothing. Recoil off, Strengthened 1 -> 3.
- **`kraken_v2`** - *a product with no price the frame can pay*: TIDAL_CRUSH paid on 3e+ Water
  cards on a **2-Energy** frame, so `maelstrom` and `hydro_blast` cast 0.47 and 0.58 times a game.
  Gate alone +2.1, bonus alone +5.5, **both together +11.9.** The mirror of the hraesvelgr nerf -
  there the fix was making an OS trigger less, here it is making it trigger at all.
- **`fafnir_v1`/`v2`** - both OSes work and no OS knob moved anything (`hoardpct=0.005` 30.3%,
  `strper=3` 33.3%). His attack was **62, the lowest of the 32 decks**, on the element with the
  largest card pool; the ticket-52 registry comment already said the same card deals 47% less here.
  62 -> 68 rather than 72, because 72 put v2 at 45.3% and the stat is shared.
- **`slag_shed`** - **72% dead, 0 damage, measured 0.0 power**, the deadest card in any audit so
  far. Replaced with a 2nd `motherlode`, the card HOARD_PROTOCOL banks Energy to cash into.

**Rejected:** swapping fenrir's near-blank `ember_mend` for `crimson_draw` (35.2%, but -0.2
cards/turn and half a turn of payoff delay); swapping kraken's `maelstrom` for `pressure_point`
(23.9%, worse); halving fafnir's hoard tax.

## Gates

Full 960-cell grid at 30 iterations: absolute 0% cells **64 -> 51**, 100% cells **63 -> 54**,
NEUTRAL absolutes **21/20 -> 14/12**, out-of-band cells **357 -> 317**, decks inside the 35-80 band
**28/32 -> 31/32**, FTK unchanged at 2 (both accepted). `fenrir_v1` alone went from 12 zero cells
to 4. 8-DIFF 10 of 67 rows, all in the three touched species or in gauntlet aggregates containing
them; matchup redlines 11 -> 10, card redlines unchanged. 843/843 tests.

**Largest single-ticket improvement in roster health so far** - the bottom four were producing most
of the blowout cells, as ticket 81 predicted.

## Next

1. **`sleipnir_v2` at 33.7% is the new and only sub-35 deck** - it got there by standing still
   while four decks around it improved.
2. **`kraken_v1` (41.3%) is now the weaker kraken** and the OS-variance row flipped 72% -> 39%.
3. `hoardbreaker` (0.14 casts/game on a 5.6-turn deck) and `ember_mend` (97% played, ~1.6 HP) are
   both still near-blank; `ember_mend` wants a rider rewrite, not a swap.
4. `avalanche`'s uncapped rate still stands from ticket 81.
