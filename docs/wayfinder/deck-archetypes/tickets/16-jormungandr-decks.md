# Jormungandr decks: Water complete

- Type: wayfinder:task
- Status: closed
- Assignee: wayfinder (Claude session, 2026-08-05)
- Blocked by: [13-per-os-deck-data-model](13-per-os-deck-data-model.md) (closed), [14-kraken-pilot-decks](14-kraken-pilot-decks.md) (closed — the template + loop this pass follows)

## Question

Second species through the template; completes Water. v1 OUROBOROS_LOOP (every 3rd Water card in a turn → +1 energy, draw 1) wants a card-count storm; v2 VENOM_TRENCH (2 HP/turn) wants tanky poison attrition on the 110-HP frame. Starting redline: 21% OS gap, v2-favored.

## Resolution

Landed 2026-08-05 (voice-mode with Henry, seven-round sim loop). Gates: 740/740, tsc, build, balance committed (registry `1:72f1406e`).

**Final decks (Henry-approved):**

- `jormungandr_v1` OUROBOROS storm (8): blind_spot, poison_injection ×2, corrosive_leak, surge_protection ×2, **serpents_coil** ×2 — all Water (mandatory: the loop counts Water cards only), 6 cards costing 0e or refunding energy; coil is the payoff.
- `jormungandr_v2` VENOM_TRENCH attrition (8): corrosive_bolt ×2 (buffed P3→**P4**, the rev-3 shopping-list item), acid_splash ×2, toxic_surge ×2, capacitor, **contagion** as the 3e payoff (double the stacks, end the fight on rot).

**Card work:**

- **`serpents_coil`** (new): 1e Water attack, **15 power × cards played this turn** — priced against the deck's real 3-5 plays (45–75), static score 3.75 ≤ 4. Henry's standing preference recorded: **tuning numbers move in 5s**, no 13s and 14s.
- **`water_slap` → "Tackle"** (id kept for save-compat): element **None**, 12 power — the first citizen of the neutral tier. 12 = deliberate STAB compensation (a Water 10 hit 15 with STAB); shows as a **documented 0.2-over budget redline**. The pattern to continue: every element has a twin 0-cost poke (gust_jab, frost_jab, rock_throw, radiant_spark, shadow_claw, leaf_blade) — each element pass retires its twin into Tackle.
- **`capacitor` → None** — pure utility ramp, no damage so no STAB cost; instantly shareable (kraken_v2 and jormungandr_v2 both run it).
- jormungandr's v1 deck deliberately contains **no None cards** — the loop demands Water.

**Numbers:** OS gap 21% → **16% (66/34 v1)** — accepted one point over the cap as explained residual: 100-seed sampling error is ±5 points, so 16-vs-15 is statistically indistinguishable from compliance. Mirror 49/51, kraken-vs-jormungandr 61/39 (healthy sibling rivalry), gauntlet overall 56.5%.

**New pilot lesson — head-to-heads are bimodal under the deterministic AI:** coil at 14/card = 29% win rate, at 15/card = 66% — a single power point crossed a kill-a-turn-earlier threshold and flipped whole seed families; between-configs (pressure_point, whirlpool swaps) swung 55 points on one card. Read §2.3 head-to-heads as **~±5-point noise with cliff artifacts**; treat 10–20% gaps as a watch band, not a precision measurement. Root cause is the deterministic `TacticalAI` — spawned [Balance-sim performance](17-sim-performance.md) and [TacticalAI pass](18-tactical-ai-pass.md) from Henry's observations.
