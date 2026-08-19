# The 20 remaining absolutes, diagnosed (ticket 94 - diagnosis, no measurement yet)

Read from the committed grid at `e271f0b` and the live deck lists. **Nothing here is measured yet** -
the sandbox lost its copy of the repo and file staging is blocked on a desktop re-login, so the arms
are specified and queued rather than run.

## The list, grouped by CAUSE rather than by deck

| # | cells | mechanism |
|---|---|---|
| 1 | **8** | `audhumbla_v2` has no clock |
| 2 | **5** | `gullinbursti`'s shield wall is unbreakable by a low-damage deck |
| 3 | **3** | `fafnir_v2` has no payoff that beats a wall |
| 4 | 4 | singles - `ratatoskr_v1` vs `draugr_v2`, `huldra_v2` vs `nidhoggr_v2`, `hel_v2` vs `ratatoskr_v2`, `nidhoggr_v1` vs `gullinbursti_v2` |

Three mechanisms cover 16 of the 20. That is the pass.

---

## 1. `audhumbla_v2` has no clock (8 cells)

**42.2% field, 10.5-turn games** - the slowest deck on the roster - and after ticket 93's swap her
damage is `dawnstrike` x2 (15 power), `smite` (27) and `radiant_spark` (10), plus NOURISH_ROUTINE
converting **50% of the printed heal power** of every heal into Light damage.

Her whole offence is therefore a fraction of her healing. At level 15 that is single-digit damage a
turn against 90-100 HP opponents, so:

- against anything that cannot out-damage her healing she wins **100%** (she simply never dies),
- against anything that can she loses **0%** (she can never close),
- and there is nothing in between, because the result is one inequality: opponent throughput
  against her heal rate.

Her losses are to exactly the decks with a sustain or shield engine of their own -
`gullinbursti_v1`/`v2`, `huldra_v1`, `ymir_v1`, `valkyrie_v1` - at 9 to 17 turns.

**Arms to run, in order of how little they disturb her identity:**

1. **NOURISH conversion 50% -> 65%.** Turns the healing she already casts into a real clock without
   touching a card. This is the OS knob and it goes first.
2. **NOURISH 50% -> 65% plus `sacred_spring` (2e, heal 90) -> a 2e damage card.** If (1) is not
   enough, the biggest heal is also the biggest single source of stall.
3. **Heal numbers down across the board** (`healing_light` 45 -> 35, `sacred_spring` 90 -> 70) with
   the conversion held at 50%. Same clock, less wall.

Prediction on the record: **(1) alone moves 5 or 6 of the 8**, because five of them are stalls she
loses at 9+ turns and shortening the game is exactly what those need.

## 2. `gullinbursti`'s shield wall (5 cells)

`gullinbursti_v1` runs **2x `keen_edge` (+5 Sharp), 2x `shield_shards` (+4 Sharp, +5 Bark Shield),
`stone_bark` (+8 shield) and `spiked_carapace` (+4 Sharp, +8 shield)** - up to **13 Sharp and 21
Bark Shield** on an 85 HP / 90 defence frame.

Sharp caps at -25% damage taken, but **Bark Shield absorbs point for point and has no cap**. Against
a deck whose cards land for 2-8 damage, 21 points of shield is not a mitigation, it is immunity -
which is precisely why he is 100% against `fafnir_v2` and `audhumbla_v2` and why Henry's playtest
note on B3 was *"Stone Fist hits too hard"* (it is not the fist, it is that he is unhurtable while
throwing it).

**Arms:** `shield_shards` 5 -> 3 shield, `spiked_carapace` 8 -> 5, `stone_bark` 8 -> 6 - swept
singly first, because one of them may be carrying the whole wall. The Sharp numbers stay: Sharp is
capped and therefore self-limiting, and it is his identity.

## 3. `fafnir_v2` has no payoff that beats a wall (3 cells)

His deck is `iron_will` x2 (+4 Strengthened, +2 self Dazed), `rust_blood` x2 (45 power, +3 self
Poison), `boulder_smash` x2 (30 power), `squirrel_away`, `veinburst` x2 (85 power, +4 self Poison,
+2 self Dazed). CORRUPTED_GOLD pays +2 Strengthened per distinct debuff he is carrying.

So he **buys damage with self-inflicted debuffs**, and the damage he buys is a flat power number.
Strengthened is 2% per stack capped at +25%; against `gullinbursti`'s -25% Sharp and 21 Bark Shield
his 85-power `veinburst` arrives as a rounding error, while the Poison he paid for it keeps ticking.
**He is the only deck on the roster that gets weaker the longer a game runs.**

**Arms:** he needs a payoff that a wall cannot eat -
1. `veinburst` gains **"ignores Bark Shield"**, or
2. a swap to a multi-hit card, since Bark Shield absorbs per hit but Sharp caps per hit -
   `stone_flurry` (10 power x3) and `crag_barrage` (18 x3) already exist in the Earth pool, or
3. his self-Poison converts to damage rather than only to Strengthened.

(2) is the cheapest to test and the least new mechanic.

## 4. The four singles

- **`ratatoskr_v1` loses to `draugr_v2`** - NEW, created by ticket 93. Permanent Burn is a permanent
  distinct status, and `draugr_v2`'s payoff counts distinct statuses, so she gained 23.9 points. This
  cell is the tail of that and should be re-read after the audhumbla and gullinbursti arms land.
- **`huldra_v2` loses to `nidhoggr_v2`**, **`hel_v2` beats `ratatoskr_v2`** (2.9 turns - the fastest
  blowout on the roster), **`nidhoggr_v1` beats `gullinbursti_v2`**. One cell each; leave until the
  three mechanisms above are fixed, since two of them touch `gullinbursti_v2`.

## Method note

This is the first pass in the project run **by mechanism rather than by deck**. Three of the six
decks in the queue turn out to be on the receiving end of the same two engines, so fixing the
engines is expected to clear more cells than fixing the decks would - and `kraken_v1` and
`huldra_v1`, which appear in the list only opposite `audhumbla_v2`, need no changes of their own at
all.
