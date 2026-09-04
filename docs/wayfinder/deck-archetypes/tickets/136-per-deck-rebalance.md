# Ticket 136 — the review of 134/135, two bugs, and a per-deck rebalance package

**Status:** RULED 2026-09-02 — see §7 for what ships; §4–5 are the pre-ruling measurements
**Branch:** `legion/ai-perf` (nothing committed; every change here lives only in the measurement copy)
**Asked by Henry:** *"review Ticket 135, Handoff-back-in-band.md and the last handful of commits...
look at each of the decks and see how we can rebalance some of these decks either through increase
energy, changing the card draw, changing cards or something else."*

---

## The short version

Three things came out of the review before any deck was touched:

1. **Ticket 134's "Group B is immune to every knob" was never actually tested.** The percentage
   arm skipped Poison, Regen and Bark Shield — the mechanics Group B runs on. Done completely
   (every %-of-max-HP number reads the pre-131 health bar), it moves nidhoggr_v1 78 → 62 and
   fenrir_v2 70 → 46, and it is the correctness fix the handoff called Option 4. It does not fix
   the band on its own (sd 19.4 → 18.3) and huldra_v1 does not move at all.
2. **Ticket 131c's ×10 silently divided two firmwares by ten.** `TOXIN_FANG_OS` (+1 damage per
   Poison stack) and `KINETIC_RAM_OS` (+0.25 per Sharp) are flat post-calculation adds in
   `hooks.json`, and 131c scaled only `calculateDamage` and health. Restoring them to their old
   value (×10) takes jormungandr_v2 21 → 63 and gullinbursti_v2 28 → 53. **Two of the bottom
   four decks were a bug, not a balance problem.**
3. **Re-denominating energy ×10 buys nothing by itself.** 20 energy with cards at 0/10/20 is the
   same game as 2 energy with 0/1/2. It only becomes a fine knob once card costs are spread off
   the tens, which is Option 1 (widen the cost curve) — real card design, not a relabel. The fine
   knobs that exist *today* are firmware hooks: "+1 max Energy from turn N" (UPDRAFT's mechanism,
   `turnAtLeast` already in the engine) is worth roughly half of a permanent +1, and it measured
   that way.

Then every deck got a diagnosis and, where a lever was clear, a single-row measurement (each
row is 1–3 minutes in the container). The package that came out of it is in §5, with its full
32-deck grid.

---

## 1. Where the numbers come from

The repo tree was staged into the cloud container (Henry's `node_modules` cannot run vite-node),
`npm ci`'d, and checked against the promoted grid before anything was patched: `huldra_v1`
reproduced at **91.83 = 91.83**, bit-identical. Everything below is the standing instrument —
`scratch/rebaseline.mjs` → `pool.mjs` → `gridshard.ts`, 1v1, beamless, 30 iterations, seed base
`grid`, band 35–80 — with one change applied per arm and the file restored after.

Single-row numbers are a deck's field against the **unchanged** opponents. The package grid in
§5 is the real thing: all changes at once, every deck against every other.

---

## 2. Finding one — the percentage arm was half an arm

`scratch/bandarms.ts` PCTNERF, header: *"heals / Burn / Poison / Regen all [read maxHp]"*. Code:
divides HEAL `power` and `BURN_CONFIG.tiers[].damagePercent`. Nothing else.

What actually reads `maxHp` in the engine, and was left out:

| site | effect | who runs on it |
|---|---|---|
| `StatusBehaviors.ts` Poison tick | 1% max HP per stack per turn | nidhoggr_v1 (80% of deck), huldra_v1 (hexbloom), huldra_v2, ratatoskr_v2, jormungandr_v2, fafnir_v2 |
| `StatusBehaviors.ts` Regen tick | flat 3% max HP per turn | huldra_v1 (iron_bark), audhumbla_v2 |
| `StatusBehaviors.ts` Bark Shield | absorbs % of max HP | ymir_v1, gullinbursti_v1/v2, huldra_v2, draugr_v1 |
| `HookFactory.ts` `percentMaxHP` | OS heals / recoil | ratatoskr_v1 GOSSIP_NODE 2.5%, fenrir_v1 UNBOUND recoil 2% |
| `CustomFirmware.ts` | hel's HP-per-Energy cost, fafnir's hoard tax | hel_v2, fafnir_v1 |

**HPFRAME** = one helper, `pctHpBase(maxHp) = maxHp / HP_MULTIPLIER`, at all nine sites plus the
two PCTNERF already had. Every percentage number in the game is then priced against the health
bar it was tuned on. Full grid:

| deck | HPFRAME | was | delta | | deck | HPFRAME | was | delta |
|---|---|---|---|---|---|---|---|---|
| huldra_v1 | **91.0** | 91.8 | −0.9 | | ymir_v2 | 49.2 | 42.1 | +7.1 |
| jormungandr_v1 | 79.3 | 74.6 | +4.7 | | sleipnir_v2 | 48.6 | 41.4 | +7.2 |
| ratatoskr_v2 | 78.6 | 78.2 | +0.4 | | fenrir_v2 | 45.7 | 70.0 | **−24.3** |
| sleipnir_v1 | 77.6 | 72.4 | +5.2 | | hel_v2 | 43.0 | 31.7 | **+11.3** |
| ratatoskr_v1 | 73.4 | 75.3 | −2.0 | | audhumbla_v2 | 42.8 | 47.7 | −4.9 |
| hraesvelgr_v1 | 67.9 | 63.9 | +4.1 | | skoll_v1 | 37.4 | 40.7 | −3.3 |
| gullinbursti_v1 | 65.5 | 63.6 | +1.9 | | nidhoggr_v2 | 35.3 | 35.3 | 0.0 |
| ymir_v1 | 61.8 | 48.7 | **+13.1** | | kraken_v2 | 35.1 | 29.1 | +6.0 |
| nidhoggr_v1 | 61.8 | 78.5 | **−16.7** | | kraken_v1 | **34.3** | 29.4 | +4.9 |
| valkyrie_v1 | 60.0 | 62.0 | −2.0 | | hraesvelgr_v2 | **31.4** | 37.8 | −6.4 |
| audhumbla_v1 | 57.4 | 67.0 | −9.5 | | fenrir_v1 | **30.4** | 26.8 | +3.6 |
| skoll_v2 | 56.6 | 51.9 | +4.7 | | draugr_v1 | **29.3** | 29.3 | 0.0 |
| draugr_v2 | 56.3 | 54.0 | +2.3 | | gullinbursti_v2 | **27.9** | 27.3 | +0.6 |
| hel_v1 | 54.0 | 49.3 | +4.7 | | fafnir_v1 | **22.9** | 19.0 | +3.9 |
| huldra_v2 | 52.6 | 61.2 | −8.6 | | fafnir_v2 | **22.1** | 17.8 | +4.3 |
| valkyrie_v2 | 51.2 | 46.8 | +4.4 | | jormungandr_v2 | **21.0** | 33.0 | **−12.0** |

|  | mean | sd | in band |
|---|---|---|---|
| promoted grid | 49.9 | 19.4 | 22/32 |
| HPFRAME | 50.0 | **18.3** | **23/32** |

Read: it does what a correctness fix should — attack-based decks (jormungandr_v1, sleipnir_v1,
ymir_v1, hel_v2) gain, DoT/heal decks (nidhoggr_v1, fenrir_v2, audhumbla_v1, huldra_v2) give it
back. It compresses a little. **It does not touch huldra_v1, ratatoskr, or the bottom six**, so
the per-deck work is still needed — but it changes which decks need it: nidhoggr_v1 and
fenrir_v2 come off the list, hel_v2 and ymir_v1 come off the list, jormungandr_v2 gets worse
(and see §3 for why that one is fine).

Caveat to carry: `TacticalAI.ts` values statuses in full-max-HP terms, so under HPFRAME the AI
slightly overvalues DoT and heals. If HPFRAME ships, the AI's basis moves in the same commit.

---

## 3. Finding two — the ×10 that missed two firmwares

`HookFactory.ts` `onDamageCalculated`: `newDamage += bonus * scaleFactor`. That runs on the
**final** damage number, after `calculateDamage` — which ticket 131c multiplied by 10. The two
firmwares that use a flat `bonus`:

| firmware | `bonus` | before 131c | after 131c |
|---|---|---|---|
| jormungandr_v2 TOXIN_FANG_OS, per Poison stack on target | 1 | +5 on a ~20 hit ≈ +25% | +5 on a ~200 hit ≈ +2.5% |
| gullinbursti_v2 KINETIC_RAM_OS, per Sharp stack | 0.25 | +3.5 on ~20 at 14 Sharp ≈ +18% | ≈ +1.8% |

Both decks fell in ticket 131 (42.7 → 33.0, 41.9 → 27.3) and both were at the bottom of the
roster. Restored to ×10 (`bonus` 10 and 2.5), measured on the HPFRAME build:

| deck | HPFRAME | + bonus ×10 | |
|---|---|---|---|
| jormungandr_v2 | 21.0 | **63.0** | in band |
| gullinbursti_v2 | 27.9 | **53.3** | in band |

Nothing else in `hooks.json` carries a flat damage number (`thermal_overload`'s `amount: -5`
HP is a daemon not in any deck; every other hook uses `power`, which scales itself). The
`damageOverride` cards were caught by 131c. These two were not.

---

## 4. The lever menu, finest first

Every lever Henry named, with what it measured as, so the per-deck table reads in one pass.

| lever | scope | size (measured) | notes |
|---|---|---|---|
| a card swap in the deck | one deck | ~5–10 | Henry designs these; not measured here |
| an OS condition or rate | one firmware | 5–25 | huldra 91→66 (condition), 91→83 (rate); sleipnir 78→68; jorm 79→72 |
| **+1 max Energy from turn N** (hook) | one firmware | **+20–25** | kraken 34→63 / 35→61 at N=3; fenrir_v1 30→50; draugr_v1 29→49; hraes_v2 31→56 at N=2 |
| +1 max Energy permanent | species | +30–50 | ticket 135: kraken 29→79 — too big; fafnir is the exception below |
| cardDraw ±1 | species | −20 to −30 on a volume deck | ratatoskr 5→4: v1 73→42, v2 79→57 |
| energy ±1 | species | ±20–45 | ratatoskr 3→2: v1 73→54, v2 79→58; fafnir 2→3: v1 23→64, v2 22→44 |

The turn-gated hook is the resolution the handoff said did not exist. It is data, not code —
`turnAtLeast` (ticket 68) plus `MAX_ENERGY` (GENESIS_FIRMWARE's action), a `counters` guard so
it fires once, on `onTurnStart` which runs after the refill so the energy is usable that turn.
On the card face it reads "From turn 3, +1 max Energy" — a condition, not a cap. N is the dial:
N=2 is most of a permanent +1, N=4 is a third of one.

---

## 5. Every deck

Working baseline = HPFRAME + the two bug fixes ("corrected"). "Single" is that deck's own row
with only its change applied; "package" is the full grid with everything in §5b at once.

### 5a. Species where both firmwares point the same way — species levers fit

| species | v1 / v2 corrected | lever | single | why this one |
|---|---|---|---|---|
| **ratatoskr** | 73 / 79 | energy 3 → 2 | 54 / 58 | The only species with 3 Energy *and* 5 draw after 131 — the richest economy on the roster, on two volume decks. Energy 3→2 lands both mid-band; draw 5→4 overshoots v1 (42) while leaving v2 at 57, so energy is the better of the two. His attack-55 frame was offset by "3 Energy and cardDraw 4"; he keeps the draw. |
| **fafnir** | 23 / 22 | energy 2 → 3 | 64 / 44 | Both decks are expensive and slow (v1: a 3e finisher plus two X-costs, v2 a 0.9 avg). Ticket 135 measured +1e at +31 / +13; on the corrected build it is +41 / +22. A tanky 92/68/95 frame with 3 Energy is the same shape as ratatoskr's justification, and it makes fafnir the third 3-Energy species. v2 at 44 is in band but low; if it needs more it is a card, not more energy. |
| **kraken** | 34 / 35 | +1 max Energy from turn 3 (both firmwares) | 63 / 61 | Ticket 135's permanent +1 threw both to 79/74. The turn-3 version is half that and lands both mid-band. Fits the species: the deep builds pressure. |
| huldra | 91 / 53 | — split, see 5b | | |
| hel | 54 / 43 | none | | HPFRAME did it (hel_v2 +11). |
| ymir | 62 / 49 | none | | HPFRAME did it (ymir_v1 +13, v2 +7). ymir_v2's 60% dead-card ratio is by design (one card a turn) and is the one deck the draw change gave nothing to; it is in band now, watch it at 3v3. |
| audhumbla | 57 / 43 | none | | audhumbla_v2 is low-in-band; leave for the second pass. |
| valkyrie | 60 / 51 | none | | |
| skoll | 56 / 37 | none yet | | skoll_v1 is on the edge; TREACHERY at 1v1 only feeds off her own damage taken. If it needs a nudge, turn-4 energy is the smallest available. |

### 5b. Species where one firmware wins and the other loses — firmware levers only

| deck | corrected | lever | single | why |
|---|---|---|---|---|
| **huldra_v1** | 91 | ALLURE_PROXY mirrors only buffs from cards that **cost Energy** (`baseCost ≥ 1`) | **66** | She was already the roster's top deck pre-131 (62). The engine is Weakened → `hexbloom` (2 Poison per Weakened, reads raw stacks, so it bypasses the ±25% cap and is quadratic in how many buffs she played). +1 draw = more free `growth` plays = more Weakened. The rate change (hexbloom 2→1) only gets her to 83; the condition gets her to 66 and reads well: *"Whenever Huldra pays Energy for a card that buffs herself or an ally, she mirrors it with 1 Weakened on a random enemy."* `growth` ×2 and `soothe` stop proccing; `iron_bark` ×2 keep proccing. huldra_v2 (53) is untouched. |
| **sleipnir_v1** | 78 | remove the ramp clause ("2 instead of 1 once he holds 4+") | **68** | MOMENTUM_DRIVE pays 1 Strengthened per 0-cost; the ramp clause doubles it after 4. With 5 free cards and a 12-card deck, +1 draw put him over 4 stacks a turn earlier. Removing the clause is a condition removal, not a cap. sleipnir_v2 (49) untouched. |
| jormungandr_v1 | 79 | OUROBOROS: 5th Water card → 6th | 72 | Small. Left OUT of the package: the package buffs eight bottom decks and that alone should pull the top down; measure first, spend this second. |
| jormungandr_v2 | 21 → **63** | the ×10 bug fix (§3) | 63 | Nothing else. |
| gullinbursti_v2 | 28 → **53** | the ×10 bug fix (§3) | 53 | Nothing else. gullinbursti_v1 (65.5) untouched. |
| **fenrir_v1** | 30 | +1 max Energy from turn 3 | **50** | UNBOUND is a below-half-HP deck (100% of its cards are % denominated). Permanent +1 measured 63 in ticket 135; turn 3 lands 50. fenrir_v2 (46) untouched. |
| **draugr_v1** | 29 | +1 max Energy from turn 3 | **49** | 11 cards at 1.09 average with a 3e `barrow_king`; PERMAFROST_WAKE already pays Energized on wake, so the turn-3 surge sits naturally on top. draugr_v2 (56) untouched. |
| **hraesvelgr_v2** | 31 | +1 max Energy from turn 2 | **56** | UPDRAFT_KERNEL *is* a turn-gated energy OS (after the first full cycle). An 8-card deck at 5 draw cycles on turn 2 anyway; this is the same promise paid one turn earlier and reliably. Reads as the OS's own text tightened. hraesvelgr_v1 (68) untouched. |
| nidhoggr_v1 | 78 → **62** | HPFRAME (§2) | 62 | Nothing else. nidhoggr_v2 (35, band edge) untouched. |
| fenrir_v2 | 70 → **46** | HPFRAME (§2) | 46 | Burn is % of max HP. Watch it: −24 is the largest HPFRAME move. |

### 5c. The package, all at once — full 32-deck grid

| deck | package | corrected | promoted grid | |
|---|---|---|---|---|
| jormungandr_v1 | **80.2** | 79.3 | 74.6 | OUT |
| fafnir_v1 | **66.6** | 22.9 | 19.0 |  |
| kraken_v1 | **65.9** | 34.3 | 29.4 |  |
| sleipnir_v1 | **65.2** | 77.6 | 72.4 |  |
| kraken_v2 | **64.7** | 35.1 | 29.1 |  |
| hraesvelgr_v1 | **64.5** | 67.9 | 63.9 |  |
| jormungandr_v2 | **59.9** | 63.0 | 33.0 |  |
| ymir_v1 | **59.7** | 61.8 | 48.7 |  |
| skoll_v2 | **58.8** | 56.6 | 51.9 |  |
| huldra_v1 | **56.3** | 91.0 | 91.8 |  |
| nidhoggr_v1 | **55.8** | 61.8 | 78.5 |  |
| gullinbursti_v1 | **55.6** | 65.5 | 63.6 |  |
| fenrir_v1 | **52.0** | 30.4 | 26.8 |  |
| draugr_v2 | **51.9** | 56.3 | 54.0 |  |
| ratatoskr_v2 | **51.6** | 78.6 | 78.2 |  |
| draugr_v1 | **50.8** | 29.3 | 29.3 |  |
| ratatoskr_v1 | **49.9** | 73.4 | 75.3 |  |
| hraesvelgr_v2 | **49.9** | 31.4 | 37.8 |  |
| audhumbla_v1 | **49.3** | 57.4 | 67.0 |  |
| fafnir_v2 | **47.2** | 22.1 | 17.8 |  |
| ymir_v2 | **46.5** | 49.2 | 42.1 |  |
| huldra_v2 | **45.6** | 52.6 | 61.2 |  |
| valkyrie_v1 | **45.4** | 60.0 | 62.0 |  |
| gullinbursti_v2 | **45.2** | 53.3 | 27.3 |  |
| hel_v1 | **44.8** | 54.0 | 49.3 |  |
| fenrir_v2 | **44.1** | 45.7 | 70.0 |  |
| hel_v2 | **38.3** | 43.0 | 31.7 |  |
| valkyrie_v2 | **37.8** | 51.2 | 46.8 |  |
| sleipnir_v2 | **34.9** | 48.6 | 41.4 | OUT |
| skoll_v1 | **34.4** | 37.4 | 40.7 | OUT |
| audhumbla_v2 | **28.3** | 42.8 | 47.7 | OUT |
| nidhoggr_v2 | **26.5** | 35.3 | 35.3 | OUT |

|  | mean | sd | in band |
|---|---|---|---|
| promoted grid | 49.9 | 19.4 | 22/32 |
| corrected (HPFRAME + the two bug fixes) | 52.2 | 17.2 | 25/32 |
| **package** | 50.9 | 11.7 | 27/32 |

**Spread 19.4 → 11.7, in band 22 → 27.** Every deck the package touched landed between 45 and
67. The five still out are the levy: eight bottom decks got stronger, so the four decks just
above them fell through the floor (sleipnir_v2, skoll_v1, audhumbla_v2, nidhoggr_v2), and
jormungandr_v1 — untouched — rose to 80.2 because three of its worst matchups (huldra_v1,
ratatoskr, sleipnir_v1) got weaker.

### 5d. Round two — the five, measured on top of the package

Single rows against the package field. The same turn-3 energy hook where nothing finer fit.

| deck | package | round-2 lever | single | |
|---|---|---|---|---|
| jormungandr_v1 | 80.2 | OUROBOROS: 5th Water card → 6th | **70.4** | in |
| audhumbla_v2 | 28.3 | +1 max Energy from turn 3 (she has 3, so it is 3 → 4) | **56.6** | in |
| sleipnir_v2 | 34.9 | +1 max Energy from turn 3 | **53.9** | in |
| skoll_v1 | 34.4 | +1 max Energy from turn 3 | **51.1** | in |
| nidhoggr_v2 | 26.5 | +1 max Energy from turn 3 | 37.4 | edge — energy is not what it lacks |

nidhoggr_v2 is the one deck left where the energy lever does not answer: BLOOD_SCENT already
pays Energy on a half-HP crossing, and the deck's problem is that its payoff (`rend_marrow`
+35 below half) needs the enemy low while its own fuel (`bloodletting`, self-Poison) puts *it*
low first. That is a card conversation for Henry, not a stat.

Round two would levy a few more points off the middle; expect one more pass of ±5 before the
roster is settled. The tool for that pass exists now and costs about a minute a row.


---

## 6. What I did not do

- **No card swaps.** Every deck-list change is Henry's to sketch; the levers above are all
  OS/hook/stat changes that leave every card on the curve.
- **No 3v3.** The six-deck trio numbers in ticket 135 are 4 battles a cell and each deck was
  three copies of itself; 13/15 absolute cells says "snowball", not which knob. The package
  should go to 3v3 after Henry rules, on real trios.
- **Nothing committed.** The measurement copy is in the container; the repo is untouched
  except for this ticket file.

---

## Decisions I need from Henry

1. **Ship HPFRAME (§2) as a correctness ticket?** Every percentage-of-max-HP number reads the
   pre-131 health bar. My recommendation: yes — it is what the +50% HP buff should have shipped
   with, and it is the only change here that touches all 32 decks by the same rule.
2. **Ship the ×10 fix on TOXIN_FANG and KINETIC_RAM (§3)?** `bonus` 1 → 10 and 0.25 → 2.5.
   Recommendation: yes, it is a bug.
3. **The species changes (5a):** ratatoskr Energy 3 → 2; fafnir Energy 2 → 3; kraken "+1 max
   Energy from turn 3" on both firmwares. Yes to all three, or pick.
4. **The firmware changes (5b):** huldra_v1 ALLURE_PROXY condition; sleipnir_v1 ramp clause out;
   fenrir_v1 / draugr_v1 turn-3 energy; hraesvelgr_v2 turn-2 energy. Yes to all, or pick.
5. **Re-denomination (ticket 135 decision 1):** my recommendation is **not now** — see the short
   version. Revisit when a cost-curve widening pass is on the table.
5b. **Round two (5d):** jormungandr_v1 6th card; audhumbla_v2, sleipnir_v2, skoll_v1 turn-3
   energy. nidhoggr_v2 needs you to look at the deck.
6. **Do you want the package measured at 3v3 before or after it ships?**

---

## Card appendix — in-game text of every card named above

| card | cost | text |
|---|---|---|
| growth | 0e | Gain 1 Sharp. Heal with 8 power. |
| soothe | 0e | Remove debuff by 1 stack. |
| iron_bark | 1e | Gain 3 Sharp and 2 Regen. |
| thorn_tithe | 1e | 30 power. Apply 3 Weakened. |
| hexbloom | 2e | Apply 2 Poison per stack of Weakened on the target. The Weakened remains. |
| slipstream | 0e | Draw a card. |
| tailwind | 1e | Draw 2 cards. |
| stampede | 1e | The herd thunders: deal 11 Air damage for every card you played this turn. |
| momentum_crash | 1e | Cash the charge: consume all your Strengthened and deal 8 Air damage per stack consumed. |
| hoofbeat_daemon | 2e | Daemon: whenever you play a 0-cost card, deal 10 damage to a random enemy. |
| undertow | 0e | The current pulls: draw a card. |
| serpents_coil | 1e | The world-serpent tightens: deal 10 Water damage for every card you played this turn. |
| ink_stream | 1e | Deal 33 power for each card a card, OS or daemon drew you this turn. |
| barrow_king | 3e | 95 power. Apply 2 Weakened. |
| hoardbreaker | 3e | 90 power. Gain 3 Strengthened. |
| deep_vein | Xe | Spend all Energy: 35 power for each Energy spent. |
| maelstrom | 3e | Summon a crushing vortex: deal heavy Water damage and apply 1 Dazed. |
| hydro_blast | 3e | 105 power. |
| capacitor | 2e | Gain 2 Energy next turn and 3 Sharp. |
| sun_eaters_plunge | 3e | Dive from the sun: 68 power. Apply 3 Burn. |
| wither_feast | 2e | Trigger the target's Poison five times, then consume it. |
| rot_seed | 0e | Add 2 stacks of Poison. |

### OS text

| firmware | text |
|---|---|
| ALLURE_PROXY (huldra_v1) | Whenever Huldra applies a buff to herself or an ally, she mirrors it by applying 1 stack of Weakened to a random enemy. |
| MOMENTUM_DRIVE (sleipnir_v1) | Whenever you play a card that costs 0 Energy, Sleipnir gains 1 stack of Strengthened — and 2 instead of 1 once he already holds 4 or more. |
| OUROBOROS_LOOP (jormungandr_v1) | Each turn, the 5th Water card you play draws 1 card. |
| TOXIN_FANG_OS (jormungandr_v2) | Jörmungandr's venom coats his fangs: his attacks deal +1 damage per Poison stack on the target. |
| KINETIC_RAM_OS (gullinbursti_v2) | Earth Attack cards deal additional damage for each stack of Sharp Gullinbursti holds, but the ram blunts its own edge: he takes 1 Dazed at the start of each of his turns. |
| UPDRAFT_KERNEL (hraesvelgr_v2) | The first time you cycle through your entire deck and shuffle your discard pile, permanently gain +1 max Energy for the rest of the battle. |
| ROOT_CORRUPTION (nidhoggr_v1) | Poison afflicting Níðhöggr's enemies does not lose stacks at the end of their turn. |
| CINDER_WALL_OS (fenrir_v2) | Whenever Fenrir applies the Burn status to any unit — including himself — he gains a stack of Sharp. |
| UNBOUND_KERNEL (fenrir_v1) | Attack programs apply 1 Strengthened and deal 2% Max HP recoil damage. Fire attacks deal up to 50% more damage, scaled by how much of your max HP is missing. |
| PERMAFROST_WAKE (draugr_v1) | Draugr can act while Asleep. Whenever it wakes from Asleep or is revived, it gains 1 Energized and draws a card. |
| HOARD_PROTOCOL (fafnir_v1) | At the end of your turn, store unused Energy as Energized. At the start of your next turn, take 1% Max HP damage per hoarded point as the hoard is cashed in. |
| CORRUPTED_GOLD_OS (fafnir_v2) | At the start of Fafnir's turn, he gains 2 Strengthened for each different debuff on him, then each of those debuffs loses 1 stack. |
| GOSSIP_NODE (ratatoskr_v1) | 0-cost programs heal all allies for 2.5% of their max HP. |
| INSTIGATOR_OS (ratatoskr_v2) | Whenever Ratatoskr plays a 0-cost card at an enemy, he applies 1 stack of Dazed to the target. |

---

## Reproducing

Container copy of the tree at `/tmp/mm` (staged from `_to_delete/xfer/tree.tgz`), `npm ci`,
then:

```bash
node scratch/rebaseline.mjs --lanes 2 --iter 30 --outdir results/hpframe          # §2, 47 min
node scratch/rebaseline.mjs --only jormungandr_v2,gullinbursti_v2 --outdir results/hpframe_bonus10   # §3
/tmp/arms/driver.sh                                                                # every single-row arm in §4/§5
node scratch/rebaseline.mjs --lanes 2 --iter 30 --outdir results/package          # §5c
```

HPFRAME patch: `pctHpBase` in `types.ts`; sites in `StatusBehaviors.ts` (Burn overflow, Burn
tier, Poison, Regen, Bark Shield), `combatUtils.ts` (heal), `HookFactory.ts` (`percentMaxHP`),
`CustomFirmware.ts` (hel cost, fafnir hoard recoil). The turn-gated energy hook:

```json
{ "id": "<os>_surge", "trigger": "onTurnStart", "priority": 45,
  "when": { "source": "SELF", "turnAtLeast": 3,
            "counters": [{ "key": "<os>_surge_used", "operator": "LT", "value": 1 }] },
  "do": [ { "type": "MAX_ENERGY", "amount": 1, "target": "SELF" },
          { "type": "COUNTER", "target": "SELF", "key": "<os>_surge_used", "operator": "SET", "amount": 1 },
          { "type": "LOG", "text": "{owner} surges: +1 max Energy." } ] }
```


---

## 7. RULED PACKAGE — final grid (2026-09-02, after Henry's rulings)

Henry's rulings superseded §4–5: no "from turn N" hooks (does not read well), no hidden
percentage math (HPFRAME withdrawn — Regen 3% → 2% is the one visible global number kept), fenrir_v1
OS unchanged (deck rework slated), kraken v1/v2 redesigned in session (§8). What ships:

| change | measured |
|---|---|
| TOXIN_FANG / KINETIC_RAM `bonus` ×10 (the 131c bug) | jormungandr_v2 33 → 62, gullinbursti_v2 27 → 40 |
| Regen 3% → 2% per turn (+ glossary text fixed) | global |
| hexbloom: 1 Poison per Weakened, then consumes the Weakened | huldra_v1 92 → 69 |
| ratatoskr Energy 3 → 2 | 75/78 → 60/54 |
| fafnir Energy 2 → 3 | 19/18 → 54/34 |
| draugr Energy 2 → 3, cardDraw 4 → 3 | 29/54 → 52/65 |
| sleipnir_v1 ramp clause removed | 72 → 58 |
| kraken_v1: OS 2 Dazed per draw, whirlpool 2 Dazed, Crushing Depths for surge_protection | 29 → 54 |
| kraken_v2: capacitor 3 Energized (no Sharp), Boiling Surge for surge_protection, Scald ×2 for the tackles | 29 → 65 |

|  | mean | sd | in band |
|---|---|---|---|
| promoted grid (post-131) | 49.9 | 19.4 | 22/32 |
| **ruled package** | 49.9 | **14.9** | **26/32** |

| deck | package | was | | deck | package | was |
|---|---|---|---|---|---|---|
| nidhoggr_v1  | 76.8 | 78.5 | | jormungandr_v1  | 75.0 | 74.6 |
| huldra_v1  | 68.7 | 91.8 | | audhumbla_v1  | 66.4 | 67.0 |
| fenrir_v2  | 65.9 | 70.0 | | draugr_v2  | 65.0 | 54.0 |
| kraken_v2  | 64.9 | 29.1 | | jormungandr_v2  | 62.1 | 33.0 |
| hraesvelgr_v1  | 61.0 | 63.9 | | ratatoskr_v1  | 60.2 | 75.4 |
| huldra_v2  | 60.0 | 61.2 | | sleipnir_v1  | 58.1 | 72.4 |
| gullinbursti_v1  | 54.6 | 63.6 | | fafnir_v1  | 54.1 | 19.0 |
| ratatoskr_v2  | 53.7 | 78.2 | | kraken_v1  | 53.6 | 29.4 |
| valkyrie_v1  | 52.9 | 62.0 | | draugr_v1  | 52.5 | 29.3 |
| skoll_v2  | 49.6 | 51.9 | | ymir_v1  | 47.0 | 48.7 |
| gullinbursti_v2  | 40.4 | 27.3 | | hel_v1  | 38.5 | 49.3 |
| ymir_v2  | 38.1 | 42.1 | | audhumbla_v2  | 36.6 | 47.7 |
| skoll_v1  | 36.5 | 40.7 | | valkyrie_v2  | 36.1 | 46.8 |
| fafnir_v2 **OUT** | 34.4 | 17.8 | | sleipnir_v2 **OUT** | 30.6 | 41.4 |
| nidhoggr_v2 **OUT** | 28.6 | 35.3 | | hraesvelgr_v2 **OUT** | 26.1 | 37.8 |
| fenrir_v1 **OUT** | 24.7 | 26.8 | | hel_v2 **OUT** | 24.5 | 31.7 |

**Still out (6):** fenrir_v1 24.7 and hraesvelgr_v2 26.1 (deck reworks already slated), nidhoggr_v2
28.6 (deck look slated), hel_v2 24.5 (fell 7 — the levy; a UNDERWORLD_GATEWAY deck look), sleipnir_v2
30.6 (fell 11 — WAR_STEED deck look), fafnir_v2 34.4 (one point out; CORRUPTED_GOLD needs one more
self-debuff source — a card, per Henry). All six are card/deck conversations, none are stat knobs.

### Unspent energy on the package build, worst first (Henry's bar: 15%; flagged for playtest)

| deck | unspent | max E | deck | unspent | max E |
|---|---|---|---|---|---|
| audhumbla_v1 | 23.0% | 4.0 | draugr_v2 | 19.2% | 3.0 |
| fafnir_v2 | 17.9% | 3.0 | audhumbla_v2 | 15.5% | 2.0 |
| nidhoggr_v2 | 15.5% | 2.0 | ratatoskr_v1 | 14.2% | 2.0 |
| hraesvelgr_v1 | 13.5% | 2.0 | huldra_v1 | 11.4% | 2.0 |
| draugr_v1 | 11.0% | 3.0 | hel_v2 | 10.3% | 2.0 |
| fenrir_v2 | 9.2% | 2.0 | nidhoggr_v1 | 9.1% | 2.0 |
| hel_v1 | 9.0% | 2.0 | fafnir_v1 | 8.9% | 3.0 |
| kraken_v2 | 8.7% | 2.0 | skoll_v2 | 8.5% | 2.0 |
| jormungandr_v1 | 7.8% | 2.0 | fenrir_v1 | 6.0% | 2.0 |
| ratatoskr_v2 | 5.9% | 2.0 | huldra_v2 | 5.5% | 2.0 |
| sleipnir_v1 | 5.5% | 2.0 | valkyrie_v1 | 5.5% | 2.0 |
| skoll_v1 | 5.1% | 2.0 | valkyrie_v2 | 4.6% | 2.0 |
| sleipnir_v2 | 4.5% | 2.0 | jormungandr_v2 | 4.1% | 2.0 |
| hraesvelgr_v2 | 3.6% | 2.7 | gullinbursti_v1 | 3.5% | 2.0 |
| kraken_v1 | 3.5% | 2.0 | ymir_v1 | 3.3% | 2.0 |
| gullinbursti_v2 | 3.0% | 2.0 | ymir_v2 | 2.5% | 2.0 |

Measured at real end-of-turns only (the AI's lookahead is excluded — the first probe counted it and
read 50–80% for everyone). Over 15%: audhumbla_v1 (GENESIS takes her to 4 max Energy), draugr_v2,
fafnir_v2, audhumbla_v2, nidhoggr_v2. Everyone else is under.

## 8. Kraken session — what was measured before the pick

See `docs/wayfinder/deck-archetypes/tickets/136-IMPLEMENTATION-PROMPT.md` for the exact card JSON.
kraken_v1 single rows (base 26): OS 2 Dazed/draw 42; OS +8 power hit per draw 48; Crushing Depths
alone 27; whirlpool 2/3 Dazed 30/39; Depths + 2 Dazed/draw + whirlpool 2 Dazed **54** (picked).
kraken_v2 single rows (base 25): OS 35/40/45% 28/31/33; capacitor 3 Energized ±Sharp 68/49; Scald
2-Burn 62; Boiling Surge 49; maelstrom +3 Dazed / +2 Burn / X-cost 26/35/32. With capacitor (no
Sharp) + Boiling Surge: Scald ladder 2 Burn 82, 2 Burn+2 self Dazed 78, 1 Burn+1 Sharp 76, 2 Burn+
self hit 71, **1 Burn + 1 self Dazed 65** (picked), 1 Burn + 2 self Dazed 60.

## 9. Open after this pass
- fenrir_v1 deck rework (Henry: give Ignite a Scald-style treatment in the Fire pass).
- hraesvelgr_v2 deck rework; nidhoggr_v2, hel_v2, sleipnir_v2, fafnir_v2 deck looks.
- Flat-number DoT / Regen / heal / Bark Shield ticket: every "% of max HP" becomes a literal number
  so nothing reprices when HP changes and every card reads what it does.
- 3v3 measurement of the package (not yet).
- Playtest the five decks over 15% unspent.

---

# SHIPPED — 2026-09-03, seven commits on `legion/ai-perf`

The whole package landed as written. **Every one of the 32 decks reproduced its target to the
tenth of a point** — the grid below is not "within tolerance", it is bit-identical to the numbers
this ticket predicted, which is what you would expect from a seeded deterministic instrument
running the same build.

| commit | ticket | what shipped |
|---|---|---|
| `c8978ba` | 136a | TOXIN_FANG_OS `bonus` 1 → 10, KINETIC_RAM_OS 0.25 → 2.5 |
| `9774084` | 136b | Regen 3% → 2% of max HP per turn; glossary text corrected |
| `446d575` | 136c | hexbloom converts at ×1 and consumes the Weakened |
| `b39c351` | 136d | ratatoskr Energy 3→2; fafnir 2→3; draugr 2→3 and cardDraw 4→3 |
| `ff7e699` | 136e | sleipnir_v1 MOMENTUM_DRIVE ramp clause deleted |
| `9b5fa87` | 136f | kraken_v1: 2 Dazed/draw, whirlpool 2 Dazed, `crushing_depths` |
| `36c26a3` | 136g | kraken_v2: capacitor 3 Energized, `boiling_surge` ×2, `scald` ×2 |

Gates on every commit: `npx tsc -b` clean, `npx vitest run` **2128 passed / 157 files**,
`npx eslint .` clean.

## The grid, target vs measured

`node scratch/rebaseline.mjs --iter 30 --outdir results/rebaseline-136`, 1v1 beamless, seed base
`grid`, 30 iterations, 960 cells. Rows are in `results/rebaseline-136/`.

| deck | target | measured | deck | target | measured |
|---|---|---|---|---|---|
| nidhoggr_v1 | 76.8 | **76.8** | jormungandr_v1 | 75.0 | **75.0** |
| huldra_v1 | 68.7 | **68.7** | audhumbla_v1 | 66.4 | **66.4** |
| fenrir_v2 | 65.9 | **65.9** | draugr_v2 | 65.0 | **65.0** |
| kraken_v2 | 64.9 | **64.9** | jormungandr_v2 | 62.1 | **62.1** |
| hraesvelgr_v1 | 61.0 | **61.0** | ratatoskr_v1 | 60.2 | **60.2** |
| huldra_v2 | 60.0 | **60.0** | sleipnir_v1 | 58.1 | **58.1** |
| gullinbursti_v1 | 54.6 | **54.6** | fafnir_v1 | 54.1 | **54.1** |
| ratatoskr_v2 | 53.7 | **53.7** | kraken_v1 | 53.6 | **53.6** |
| valkyrie_v1 | 52.9 | **52.9** | draugr_v1 | 52.5 | **52.5** |
| skoll_v2 | 49.6 | **49.6** | ymir_v1 | 47.0 | **47.0** |
| gullinbursti_v2 | 40.4 | **40.4** | hel_v1 | 38.5 | **38.5** |
| ymir_v2 | 38.1 | **38.1** | audhumbla_v2 | 36.6 | **36.6** |
| skoll_v1 | 36.5 | **36.5** | valkyrie_v2 | 36.1 | **36.1** |
| fafnir_v2 | 34.4 | **34.4** | sleipnir_v2 | 30.6 | **30.6** |
| nidhoggr_v2 | 28.6 | **28.6** | hraesvelgr_v2 | 26.1 | **26.1** |
| fenrir_v1 | 24.7 | **24.7** | hel_v2 | 24.5 | **24.5** |

Largest deviation from target across all 32 decks: **0.0 points**.

`node scratch/promotegrid.mjs --dry-run`:

```
cells 960, all claimed. moved 5+ points: 472
biggest single-cell move: huldra_v1|kraken_v2 -100.0
field mean 49.9  sd 14.9  in band (35-80) 26/32
OUT OF BAND: fafnir_v2 34.4, sleipnir_v2 30.6, nidhoggr_v2 28.6,
             hraesvelgr_v2 26.1, fenrir_v1 24.7, hel_v2 24.5
--dry-run: nothing written.
```

**Accept criteria met.** Mean 49.9 (unchanged), **sd 19.4 → 14.9**, **in band 22/32 → 26/32**. The
grid was NOT promoted — `deck_grid.json` still holds the pre-136 numbers, per the ticket.

## Test assertions changed

Exactly two, both in `src/engine/OSSystem.test.ts`, both pinning the kraken_v1 Dazed feed that
136f deliberately doubled:

- the test name `'v1 (ABYSSAL_INK_SYS): applies 1 Dazed to random enemy when drawing outside draw
  phase'` → `'... applies 2 Dazed to every enemy when drawing outside draw phase'` (the old name
  also said "random enemy"; the hook has always targeted `ENEMIES`)
- `expect(e1.statusEffects.some(s => s.type === StatusType.Dazed && s.stacks === 1)).toBe(true);`
  → `s.stacks === 2`, in that test and in `'v1 (ABYSSAL_INK_SYS): triggers when ANY ally draws a
  card'`

Nothing else in the suite pinned a number this package moved. `anyStatusConsume.test.ts` turned
out to be a `rimebreaker` test that only *cites* hexbloom in a header comment — no assertion — and
`drawFormula`/`createRun`/`runSlice.loadout` read species stats from the registry rather than
hard-coding them.

## Comments corrected because the change made them false (text only, no numbers moved)

`StatusBehaviors.ts` (Regen 3%), `ActionExecutors.ts` ×2 (the hexbloom reads-without-consuming
precedent, cited by ticket 124's reasoning), `anyStatusConsume.test.ts`'s header, `deckReport.ts`
(huldra_v1's line said hexbloom converts "at x2 without consuming it"), `handbuiltParties.ts` ×2
(hexbloom's quoted card text, and capacitor's payload — that party is the frozen ticket-118 panel
and its LIST was not changed, only the note saying which side of 136 it is on), and
`mingmingRegistry.ts` (ratatoskr's species comment, kraken's v2 design note).

## Deviations and notes for Henry — nothing was tuned

1. **Where the grid was run.** `rebaseline.mjs` drives `pool.mjs`, which runs `vite-node`, which
   needs rollup's native binding. The linux VM behind the desktop bridge sees the repo's *Windows*
   `node_modules`, so vite-node cannot start there — the same trap HANDOFF §8 records. The grid was
   run in a container against a byte-identical copy of the tree (verified: identical md5 over all
   515 `.ts`/`.tsx`/`.json`/`.mjs` files in `src/` and `scratch/`). Results are committed under
   `results/rebaseline-136/`.
2. **`TacticalAI.ts` still hardcodes Regen at 3%** (`0.03 * s * entity.maxHp`, line 176). 136b
   moved the engine to 2% and this number was NOT touched, because it is not on the authorized
   list and because the measured targets above were produced with it at 3%. The AI now values Regen
   about 50% above what Regen pays. Worth its own ticket; changing it will move the grid.
3. **`draugr`'s v1 design comment** narrates the sleep rhythm as "a SLEEP turn on 2 energy and an
   AWAKE turn on 3". With 136d's base at 3 those turns are 3 and 4. The rhythm is unchanged; the
   prose was left alone as out of scope.

## 10. Round two (same day) — the six reworks, measured

See §136h–n of the implementation prompt for exact edits. Session rows are in project memory
(`fenrir_hraes_session`, `round3_sessions`). Full grid after round two:

| deck | round 2 | round 1 | | deck | round 2 | round 1 |
|---|---|---|---|---|---|---|
| jormungandr_v1  | 72.8 | 75.0 | | nidhoggr_v1  | 72.0 | 76.8 |
| sleipnir_v2  | 64.9 | 30.6 | | fenrir_v2  | 61.7 | 65.9 |
| draugr_v2  | 61.0 | 65.0 | | kraken_v2  | 60.8 | 64.9 |
| audhumbla_v1  | 60.1 | 66.4 | | fenrir_v1  | 59.5 | 24.7 |
| huldra_v1  | 59.1 | 68.7 | | huldra_v2  | 58.2 | 60.0 |
| hraesvelgr_v1  | 57.2 | 61.0 | | ratatoskr_v1  | 55.1 | 60.2 |
| hel_v2  | 54.9 | 24.5 | | sleipnir_v1  | 54.5 | 58.1 |
| jormungandr_v2  | 53.5 | 62.1 | | fafnir_v1  | 50.6 | 54.1 |
| kraken_v1  | 49.4 | 53.6 | | draugr_v1  | 48.9 | 52.5 |
| gullinbursti_v1  | 48.2 | 54.6 | | fafnir_v2  | 46.4 | 34.4 |
| hraesvelgr_v2  | 46.3 | 26.1 | | ratatoskr_v2  | 45.8 | 53.7 |
| ymir_v1  | 44.2 | 47.0 | | valkyrie_v1  | 44.2 | 52.9 |
| skoll_v2  | 44.1 | 49.6 | | nidhoggr_v2  | 40.7 | 28.6 |
| ymir_v2 **OUT** | 34.9 | 38.1 | | gullinbursti_v2 **OUT** | 34.8 | 40.4 |
| hel_v1 **OUT** | 32.3 | 38.5 | | skoll_v1 **OUT** | 29.5 | 36.5 |
| audhumbla_v2 **OUT** | 28.9 | 36.6 | | valkyrie_v2 **OUT** | 24.7 | 36.1 |

|  | mean | sd | in band |
|---|---|---|---|
| round 1 package | 49.9 | 14.9 | 26/32 |
| **round 2 package** | 50.0 | 12.0 | 26/32 |

unspent over 15%: audhumbla_v1 23%, fafnir_v2 21%, draugr_v2 19%, audhumbla_v2 16%

---

# ROUND TWO — SHIPPED 2026-09-03, seven commits on `legion/ai-perf`

136h–136n landed exactly as the implementation prompt ruled them, one commit per letter, on top of
`3baa1dc` (post-136 round one, post-138). **Every one of the 32 decks reproduced its predicted
number to within 0.05 points** — the largest deviation across the whole grid.

| commit | ticket | what shipped |
|---|---|---|
| `0b7504b` | 136h | `STRENGTH_STACK_CAP` → Infinity; `SELF_ANY_STATUS` and `BURN_STACKS` scalings |
| `c090608` | 136i | fenrir_v1: OS pays 2 Strengthened, `war_pact` + `unbound_fang`, deck and kit |
| `65c89aa` | 136j | hraesvelgr_v2: Plunge 3e/68 → 2e/45, Talon X-cost → 2e/25 per Burn |
| `f6fb3f1` | 136k | hel_v2: blood price 6% → 5%, cap unchanged |
| `b6ec28c` | 136l | sleipnir_v2: deck list only, four slots |
| `e54e33f` | 136m | nidhoggr_v2: `bloodletting` 25/1, new `bloodwrath` |
| `45e2451` | 136n | fafnir_v2: new `tarnish` + `corroded_edge`, two deck slots |
| _this commit_ | grid + docs | promoted into `deck_grid.json`, and this record |

Gates on every commit: `npx tsc -b` clean, `npx vitest run` **2132 passed / 158 files**,
`npx eslint .` clean.

## The grid, target vs measured (`results/rebaseline-r2/`)

|  | mean | sd | in band |
|---|---|---|---|
| promoted post-138 | 49.8 | 15.0 | 26/32 |
| **round two, measured** | **49.9** | **12.0** | **26/32** |

The six reworked decks all landed in band: fenrir_v1 **58.19** (was 24.4), sleipnir_v2 **65.00**
(30.7), hel_v2 **54.71** (24.2), hraesvelgr_v2 **46.39** (25.9), fafnir_v2 **46.39** (34.4),
nidhoggr_v2 **39.86** (27.4). The six now out — ymir_v2 34.9, gullinbursti_v2 34.1, hel_v1 31.6,
skoll_v1 29.5, audhumbla_v2 28.5, valkyrie_v2 23.7 — are the levy the prompt named in advance and
are the next session's list, not a failure of this one. 311 of 960 cells moved 5+ points; the
biggest single cell is fenrir_v1 vs huldra_v1 at **+91.7**, which is one rebuilt deck meeting a deck
it used to lose to outright.

Per-deck deltas against the target table were: max 0.05, and 25 of 32 within 0.03.

## Test assertions changed, quoted

**136i, OSSystem.test.ts** — deliberate, the OS pays double now:
- `'v1 (UNBOUND_KERNEL): applies 1 Strengthened and 2% recoil on Attack'` → `'applies 2 Strengthened…'`
- `expect(p1.statusEffects.some(s => s.type === StatusType.Strengthened && s.stacks === 1)).toBe(true);` → `s.stacks === 2`

**136i, RewardSystem.test.ts** — NOT a pinned value, and the finding is below: the fixture for
`"includes a species' UNTAGGED kit cards while it is in the party"` moved from fenrir_v1 to
kraken_v1. The assertion is unchanged.

**136j, XCostAction.test.ts** — the card left the scaling:
- `'BURN_TIMES_ENERGY deals nothing without Burn, and scales with it'` → `'BURN_STACKS deals nothing without Burn, and is linear in the pile (ticket 136j)'`, body unchanged.

**136k, StanceSystem.test.ts** — eight assertions, all the 6% → 5% price, and two that changed
SHAPE because a cheaper step fits more casts under an unchanged ceiling:
- describe `'(ticket 81: 6% blood, 25% cap…)'` → `'(ticket 136k: 5% blood, 25% cap…)'`
- `expect(OS_KNOBS.hel.pctPerEnergy).toBe(6)` → `.toBe(5)`; title `'the shipped price is 6%'` → `'…is 5%'`
- `expect(tolls).toEqual([120, 120, 120])` → `[100, 100, 100]`
- `expect(state.playerParty[0].currentHp).toBe(1005)` → `toBe(1025)`
- `'allows FOUR Energy-points of Dark a turn at the shipped 6% price and 25% cap'` → `'allows FIVE … at the shipped 5% price'`; fixture gains a sixth card, `toBe(1520)` → `toBe(1500)`
- the 20%-cap fallback test: three casts fit at 6%, **four** at 5%; `expect(counters).toBe(18)` → `.toBe(20)`
- `expect(counters).toBe(6)` → `.toBe(5)` (budget reset)
- `'charges 18% of her pool'` → `'15%'`, `toBe(1640)` → `toBe(1700)`

136h, 136l, 136m and 136n moved no assertion at all.

## Findings the implementation turned up, reported not fixed

1. **fenrir_v1's rebuilt deck has five DISTINCT cards and all five are in its start kit** (nine
   slots, four of them second copies). Ticket 61's model is "payoff + 4 enablers, and the run
   builds back toward the tuned deck" — for fenrir_v1 the tuned deck now IS the kit, doubled, so
   there is nothing to draft back toward. `RewardSystem.test.ts`'s own
   `expect(untagged.length).toBeGreaterThan(0)` fixture guard is what caught it. Every other
   species still has an untagged half. **Deck-design call, not a test problem.**
2. **`BURN_TIMES_ENERGY` now has no card in the registry.** 136j was its only consumer. The engine
   branch is still there and still correct; it is a deletion candidate for whoever next audits dead
   scalings. Thermal Lance still uses `ENERGY_SPENT_SQUARED`, so the X-cost mechanic itself keeps a
   live consumer.
3. **hel_v2's heal still out-earns her blood toll, and 136k widened the gap.** The test file already
   recorded 125 healed against a 120 toll on a 2000 frame; at 5% the toll is 100, so the loan grows
   from +5 to +25 a cast. It was a finding before this ticket and still is — closing it means moving
   the heal power or the price, which is a balance decision.
4. `powerscale` cannot price `BURN_STACKS` or `SELF_ANY_STATUS` and now says so in `manualReview`
   rather than reading them at their printed base. Both were hand-priced against their real
   ceilings (Talon 25 × ≤4 Burn, because Burn caps at 4; Corroded Edge 20 × 3–4 statuses) and the
   sim gate decides them. Deliberately given no `ASSUMED_` constant: every one of those came from
   ticket 66's census of real battles, and neither pile has been measured.

---

# ROUND THREE — SHIPPED 2026-09-04, five commits on `legion/ai-perf`

Implemented from `tickets/136-ROUND3-PROMPT.md`. **136s (audhumbla_v2) was skipped on Henry's
instruction** — see below, because the measurement turned that into the most interesting row on the
grid.

| commit | ticket | what shipped |
|---|---|---|
| `7b825da` | 136o | ymir_v2: three new 2e Ice cards, deck is 8 cards and every one costs 2 |
| `2e27ff5` | 136p | gullinbursti_v2: `keen_strike` + `pebble_flurry`, deck swaps, OS text carries the number |
| `da9d685` | 136q | hel_v1: `STANCE_BONUS` 0.35 → 0.45, and the OS text that still said 30% |
| `8ca6cf1` | 136r | skoll_v1: `sun_devourer` 15 → 20 per stack |
| `9e331f1` | 136t | valkyrie_v2: `falling_star` 40 → 50, `starfall` text |
| — | 136s | **SKIPPED** (audhumbla_v2), Henry |

Gates on every commit: `npx tsc -b` clean, `npx vitest run` **2139 passed / 159 files**,
`npx eslint .` clean.

## The grid (`results/rebaseline-r3/`, promoted)

|  | mean | sd | in band |
|---|---|---|---|
| round two | 49.9 | 12.0 | 26/32 |
| ticket 137 | 49.9 | 11.5 | 27/32 |
| **round three** | **49.9** | **9.7** | **30/32** |

Accept was ±5 per deck and ≥29/32. **Max deviation 2.44, nothing outside ±5, 30 in band.** For
scale, the pre-131 roster sat at sd 9.2 / 31 of 32.

The two still out are the two the prompt named and ruled: **skoll_v1 34.61** (a 3v3 deck, not to be
pushed) and **valkyrie_v2 24.95** (Ascension stays, no second Glimmer — a second Glimmer measured 91,
a full-cycle loop, and that is next session).

## The base was not what the prompt assumed, and it did not matter — except once

The prompt states its base as `c9fdb74` (post round two) and says *"Ticket 137 (AI Regen constant)
still lands AFTER this round."* **137 had already shipped** (`735c77a` / `e2c1513`) before this round
started, so every row below was measured on a build the design session did not have. Two rows carry
that, and both are explainable rather than noise:

- **huldra_v1 53.76 against a 56.2 target, −2.44 — the round's only deck over 2 points off.** Ticket
  137 measured huldra_v1 at −2.72 on its own. This is that, and nothing else.
- **audhumbla_v2 landed at 43.42 against a 43.2 target — WITHOUT 136s.** 136s was the change designed
  to take her from 28.5 to 43.2 (`drink_deep` 15 → 18). Ticket 137 had already taken her from 28.5 to
  **43.65** by correcting the AI's Regen valuation, because `drink_deep` is the card that CASHES a
  Regen pile and an eval that over-values holding one will not cash it. **Had 136s shipped as well,
  the two would have stacked.** Henry's "ignore audhumbla" was the right call and the grid puts a
  number on it.

Every other deck is within 0.55 of target, so 137's effect on the rest of the roster is inside the
noise the ±5 band was written for.

## Test assertions changed, quoted

**136q, `StanceSystem.test.ts`** — deliberate, this ticket's change:
- `it("are 35% both ways")` → `it("are 45% both ways")`
- `expect(STANCE_BONUS.dark).toBe(0.35)` → `.toBe(0.45)`; same for `.light`

Every other stance assertion in that file already derives from `STANCE_BONUS` rather than pinning a
literal, so none of them moved. **`TacticalAI` needed no edit either — it has read `STANCE_BONUS`
since ticket 78**, which is the pattern ticket 137 had just finished writing up.

**136t, `drawScaling.test.ts`**:
- `expect(GetProgramData('starfall')!.description).toContain('card, OS or daemon');` →
  `.toContain('an effect drew you');`

What that assertion is for is that the card's text tells the player the count excludes the
draw-phase refill, and the new wording says it as well as the old list did.

136o, 136p and 136r moved no assertion.

## Findings, reported not fixed

1. **`ink_stream` still carries the phrasing Henry cut from `starfall`** — "for each card a card, OS
   or daemon drew you this turn", the same stumble, on the other carrier card for the same mechanic.
   The two now word one mechanic two ways. Only starfall was ruled on. Recorded in
   `drawScaling.test.ts` next to the assertion.
2. **hel_v1's OS text was wrong before this round and by more than one number.** It said 30% while
   the code had said 35% for some time; 136q makes both 45%. That is ticket 138's defect class and
   exactly what ticket 139 proposes to make a test catch.
3. The prompt's prose for 136o says "one Ice Spear, one Numbing Gale and the 1e Thaw leave", but its
   deck list — the authoritative half — drops **both** copies of each, taking ymir_v2 from ten cards
   to eight. Eight is `MIN_DECK_SIZE` exactly; `baseDecks.test.ts` holds that floor and is green.
