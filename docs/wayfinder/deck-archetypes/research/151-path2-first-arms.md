# 151 — the first four path-2 cards, added to the tuned decks and measured (2026-09-09)

**What ran.** Henry (2026-09-09): *"maybe they need to be added to the tuned deck versions. Add your
ideas and then rerun the grid and see if it can be balanced."* Four cards were added to
`programs.json` and to the four tuned decks in `mingmingRegistry.ts` (start kits untouched), and the
1v1 grid was re-run for the 12 EA decks with `scratch/rebaseline.mjs` — **same seeds, same iterations
(30/order), same tree as the committed `deck_grid.json`**, which the container reproduced
bit-identically first (huldra_v2 baseline row: 30/30 cells equal). One knob round after
(bark_lash 1e → 0e, huldra_v2 row only). Nothing is committed. Raw rows in `results/151-runs/`.

## 1. The cards

| card | deck | cost | text | scorer | band | note |
| --- | --- | --- | --- | --- | --- | --- |
| `serpent_flurry` | jormungandr_v2 ×2 (added) | 1e Water | Three strikes of 9 power. | 2.7 | 3.0 | each hit collects TOXIN_FANG's +10/Poison-stack separately |
| `seed_spit` | ratatoskr_v1 ×2 (**replaces** `water_slap` ×2) | 0e Nature | 6 power. Apply 1 Poison. | 0.9 | 1.0 | a 0-cost that feeds echo_chamber / GOSSIP_NODE / seed_bomb AND Poison |
| `thorn_whip` | huldra_v1 ×2 (added) | 1e Nature | 15 power. +5 power per Sharp stack you have. | 1.5* | 3.0 | *scorer is blind to SHARP_STACKS; hand-priced 15 + 5×6 = 45 at her realistic pile |
| `bark_lash` | huldra_v2 ×2 (added) | 1e → **0e** | 1 power for each stack of Bark Shield you hold. | 0.7* | 3.0 / 1.0 | *scorer assumes 7 stacks; her OS grants **50** at end of turn 1, decaying 20%/turn — hand-priced ~35–40 on turn 2, falling |

## 2. The grid — EA 120 cells, committed → re-run

| EA cells | n | mean | median | 0/100 | ≥90 or ≤10 |
| --- | --- | --- | --- | --- | --- |
| advantaged | 48 | 74.9 → 74.3 | 85.8 → 85.8 | 9 → 8 | 26 → 22 |
| disadvantaged | 48 | 26.5 → 25.9 | 14.2 → 14.2 | 8 → 7 | 23 → 23 |
| same-element | 24 | 49.3 → 48.2 | 48.3 → 47.8 | 2 → 4 | 7 → 8 |

**The headline is unchanged — 19 exact 0/100 cells before, 19 after.** The four cards moved the
decks they were on, not the triangle. Per deck (adv / dis / same, committed → re-run; `*` = changed):

```
*jormungandr_v2   adv .42 → .58   dis .49 → .52   same .42 → .60    field 50.0 → 55.6
*ratatoskr_v1     adv .70 → .65   dis .05 → .06   same .49 → .52    field 54.1 → 63.6
*huldra_v1        adv .33 → .32   dis .30 → .29   same .67 → .54    field 51.9 → 60.3
*huldra_v2 (1e)   adv .70 → .53   dis .03 → .02   same .07 → .01    field 52.5 → 37.1
*huldra_v2 (0e)   EA mean 30.7 → 37.9                               field 52.5 → 52.6
 kraken_v1        same .28 → .14  (its jorm_v2 cell 46.7 → 20.0)
 kraken_v2        same .41 → .26  (its jorm_v2 cell 63.3 → 33.3)
```

## 3. Card by card

**`serpent_flurry` — WORKS, and it is the one that changes shape.** jorm_v2 goes from the deck that
lost while *advantaged* (.42) to .58, and its two anti-triangle cells are gone: jorm_v2 vs fenrir_v1
53 → 82 (advantaged, now reads right), vs skoll_v2 30 → 52. Same-element it now beats both krakens
(kraken_v1's cell 47 → 20, kraken_v2's 63 → 33) — the draw decks are fragile to three hits that
each cash the OS. Turns unchanged (3.6–5.3), so it did not become a race deck. **Watch item:** the
triple OS dip is where the value is; if jorm_v2 runs away later, the knob is hit power (9 → 8),
never hit count.

**`seed_spit` — HELPS THE DECK, NOT THE CORNER.** rat_v1's field rate +9.5 (54 → 64) and the 0-cost
chain is fatter, but into Fire it is still **6%** (was 5%). That is the pace failure predicted:
Poison is quadratic and Fire kills on turn 2–3. A second Poison path is not a second *fast* path.
Keep it (it is on-curve and makes the engine feel like an engine), but it does not answer R1's
"remove one status" test against burst — it answers it against cleanse.

**`thorn_whip` — INERT IN THE EA GRID, A RUNAWAY OUTSIDE IT.** huldra_v1's EA numbers did not move
(adv .33 → .32); she still dies to Fire on turn 4 before Sharp is worth anything. But the
vs-control deck report reads **102.5 average damage per play, 22% of her total output, measured
score 38.9 against a 3.0 band** — in a long fight the pile (iron_bark ×2 + growth ×2 + Sharp's
own +1 power/stack, uncapped since ticket 102) makes this a one-card kill. Field +8.4 is that
runaway against slow decks. **Under the no-caps rule the fix is a shape change: make it CONSUME the
Sharp** (`consume: true`, `STATUS_CONSUMED` — `sun_devourer` is the template). Cashing the pile
costs the defence it was providing, which is the self-limiting shape the design law names.

**`bark_lash` — the design was right and the COST was wrong.** At 1e the AI played it **17.7% of
the time it was in hand, dead 62.5%** (competing for 2 Energy with thornguard/nettle on a 2-Energy
frame), and two copies of a card that mostly sits in hand is Track A's dilution tax in a 1v1:
field 52.5 → **37.1**. When it *was* played it hit for **23.1 damage** (measured score 8.8 at a 1e
slot). At **0e** the same card reads field 52.6 (neutral) and **EA mean 30.7 → 37.9**: vs kraken_v2
70 → 95, vs jorm_v2 (with flurry) 73 → 80, vs rat_v2 10 → **35** — the same-element cell that was
7% is moving. Into Fire still 0–19%. **Recommend 0e ships as the candidate**; the honest price is
~25 power on turn 2 in a 10-power band, and it decays every turn after, so the shape is
"strong turn 2–3, gone by turn 5" — the opposite of a scaler, and the fast path the Poison deck
lacked.

## 4. What this says about the rework

1. **The R1 test has two halves, and the cards only passed one.** "Remove one status and the deck
   still has a plan" is met by all four. "Survive Fire's turn-3 kill" is met by none of the Nature
   decks — huldra_v2 / rat_v1 / rat_v2 into Fire read 0–19% before and after. That corner is
   **pace, not paths**, and no on-curve path-2 card fixes a 3-turn fight. Options are 73's (the
   constant, deferred) or a *defensive* second path Henry ruled out of R1 — worth a look at whether
   "sustain doesn't count" should have a pace exception for the type-disadvantaged cell.
2. **Cost decides whether a path-2 card exists at all on a 2-Energy frame.** 1e path-2 cards compete
   with the engine for the same two Energy; bark_lash went from −15.4 to neutral on cost alone.
   Path-2 cards for 2-Energy species should default to **0e or to replacing** a kit card, never to
   "add a 1e".
3. **Adding two copies is the tax Track A measured, in 1v1 form.** jorm_v2 and huldra_v1 absorbed +2
   cards and improved anyway because the card was above their average; huldra_v2 could not. The
   rule for the remaining eight: **prefer replace over add** (seed_spit → water_slap is the model).

## 5. Knobs for Henry (numbers move in 5s; one per sim)

- `bark_lash`: ship at **0e**; fallback knob `power` 1 → hand-check only (it is already the floor).
- `thorn_whip`: **shape change to consume Sharp** (design, not knob) — needs Henry's yes.
- `serpent_flurry`: hold; watch knob = hit power 9 (→ 8).
- `seed_spit`: hold.
- Rootfall re-take (77's bare arm) after Henry rules the above — the trio is huldra_v2 + rat_v1 +
  jorm_v2 and all three moved.

## Card appendix (in-game text)

- **Serpent Flurry** (1e Water, Uncommon) — Three strikes of 9 power.
- **Seed Spit** (0e Nature, Common) — 6 power. Apply 1 Poison.
- **Thorn Whip** (1e Nature, Uncommon) — 15 power. +5 power per Sharp stack you have.
- **Bark Lash** (0e Nature, Uncommon) — 1 power for each stack of Bark Shield you hold.
- Referenced: **Thornguard** — 20 power. Apply 3 Poison if you are shielded. **Nettle Sting** — 22
  power and 1 stack of Poison. **Blightbloom** — 20 power. Apply 5 Poison. **Iron Bark** — Gain 3
  Sharp and 2 Regen. **Growth** — Gain 1 Sharp. Heal with 8 power. **Sun Devourer** (consume
  template) — consume your Strengthened, 15 power per stack. **Venom Fang** — 25 power.
  **TOXIN_FANG_OS** — his attacks deal +10 damage per Poison stack on the target.
  **BARK_SHIELD_OS** — at the end of Huldra's first turn she raises a massive Bark Shield (50) and a
  smaller one around each ally.
