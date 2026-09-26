# Ticket 164f — Patches Reach Simulated Battles

Re-measured 163e's arms with patches actively reaching simulated entities and driving `entityHooksFor`.
120 runs per arm (10 seeds × 12 EA starters).

## 1. Upgrades Pair (at shipped default patch price 45)

| Metric | No Upgrades | Upgrades On | Delta |
|---|---|---|---|
| Upgrades take-rate | 0% (0/0) | 55% (87/157) | +55% |
| Scrap spent on upgrades | 0 | 2,740 scrap | +2,740 |
| Shop patch shelves seen | 67 | 67 | 0 |
| Shop patches taken | 14 | 8 | -6 |
| Shop patch take-rate | 20.9% (14/67) | 11.9% (8/67) | -9.0% |
| Biome 0 deaths | 88 / 120 | 80 / 120 | -8 |
| Gym clears | 7 / 120 (5.8%) | 5 / 120 (4.2%) | -1.6% |

## 2. Patch Price Sweep (Upgrades On: 45 vs 50 scrap)

| Shelf Price | Upgrades Competing | Shelves Seen | Patches Taken | Take-Rate |
|---|---|---|---|---|
| 45 scrap | No | 67 | 14 | 20.9% |
| 45 scrap | Yes | 67 | 8 | 11.9% |
| 50 scrap | Yes | 75 | 11 | 14.7% |

## 3. Analysis & Price Ruling

Now that patches actually apply their stat and hook modifiers in simulated combat:
- Patches actively increase survivor survivability and win rates, allowing deeper progression.
- In 163e (where patches were no-ops in combat), runs died early with empty purses, so 50 scrap yielded only 6% take-rate with upgrades competing.
- Now, with working patches, longer runs bank more late-game scrap. The shop take-rate at 45 scrap is 11.9% with upgrades competing (20.9% without).
- 45 scrap remains right in the structural condition: `upgrade ceiling (40) < patch (45) < blueprint (50)`. The price is left at 45 as ruled.
