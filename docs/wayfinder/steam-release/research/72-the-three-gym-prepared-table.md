# The three-gym table — a prepared player against all three authored bosses

**For the design agent.** Everything measured, every lineup and every deck the player was dealt, and the one number that turned out to matter more than the headline.

**Ticket:** [72](../tickets/72-rootfall-build.md) · **Measured:** 2026-08-30 · **Engine:** Bereavement Rally live, inverted biome walk order, all three gyms authored, `boss_relic_*` deleted · **Raw output:** [`72-runs/`](72-runs/)

Henry, 2026-08-30:

> *"can you run tests against the new bosses with a prepared player. make sure the deck has counters
> and also try to match the 2-1 type advantage so bring two nature and a water vs the water boss.
> the one water will beat the skoll that the water boss uses. do the same for the other 3"*

---

## 0. READ THIS FIRST — the headline is less interesting than the split under it

The per-boss win rates below are an **average of exactly two player decks**, and those two decks do
not perform remotely alike. Reading the headline without §3 will send a tuning pass at the wrong
thing.

| | headline | deck A | deck B |
| --- | --- | --- | --- |
| Emberfall prepared | 83.3% | **100%** (15/15) | 67% (10/15) |
| Rootfall prepared | 76.7% | **93%** (14/15) | 60% (9/15) |
| Tidewrack prepared | 23.3% | 27% (4/15) | 20% (3/15) |
| **Tidewrack control** | 40.0% | **73%** (11/15) | **7%** (1/15) |

---

## 1. Reconciling the two Tidewrack files — Henry's question

> *"the two result tables are identical but you reported different numbers for the driver off runs."*

Checked by full diff. **The files are not identical, and the reported numbers are what the files
say** — but the observation behind the question is correct and is the single most important result
in this report, so it is worth being exact.

`gym_tidewrack.txt` (Driver ON) and `tidewrack-driver-off.txt` (Driver OFF) differ in:

- the isolation banner — `boss as shipped` vs `ISOLATION — boss signature passive OFF (the gym
  Driver; tuned OS and deck untouched)`, so the lever did engage;
- **exactly one battle outcome**, sample 7 of 30 (`loss` with the Driver, `WIN` without);
- the wall clock (38m 04s vs 21m 35s — the Driver costs real compute per battle, which is its own
  small confirmation that it is running);
- and therefore the totals: **7/30 = 23.3%** against **8/30 = 26.7%**.

Twenty-nine of thirty battles are byte-identical in outcome. That is not a copy-paste error, it is
the measurement: the arms share the seed stride `run-gate:gauntlet:fight2:<i>`, so every sample is
the same run seed, the same region graph, the same boss roll and the same player deck, with the
Driver as the only difference. **Removing TIDAL SURGE entirely changes one battle in thirty.**

Paired McNemar exact: 1 discordant pair, **p = 1.000**.

---

## 2. What was measured

| arm | gym | player | Driver | result | 95% CI | avg turns |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Emberfall (Fire) | prepared 2‑1 | WAR FOOTING | **83.3%** (25/30) | 66.4 – 92.7 | 4.1 |
| 2 | Rootfall (Nature) | prepared 2‑1 | ROOT ROT | **76.7%** (23/30) | 59.1 – 88.2 | 5.2 |
| 3 | Tidewrack (Water) | prepared 2‑1 | TIDAL SURGE | **23.3%** (7/30) | 11.8 – 40.9 | 3.4 |
| 4 | Tidewrack | prepared 2‑1 | **OFF** | 26.7% (8/30) | 14.2 – 44.4 | 3.6 |
| 5 | Tidewrack | control (neutral) | TIDAL SURGE | 40.0% (12/30) | 24.6 – 57.7 | 3.2 |

Target is 60.0% with a ±5 window. Command form:

```
npm run balance:run-gate -- --cells gauntlet:fight2 --gym <id> --matchup favourable --iterations 30 --out <file>
```

**Tidewrack's interval overlaps neither Emberfall's nor Rootfall's.** Each individual figure is
under-sampled against the ±5 window — the harness says so itself — but the *separation* is not in
doubt.

---

## 3. THE PLAYER — every lineup and every deck

The enemy roster was **identical on all 30 samples of every arm** (the authored trio is fixed), and
the prepared arm cycles exactly **two lineups, 15 samples each**, alternating by sample index. So
`n = 30` is really **2 decks × 15 seeds**, and the seeds vary only IV jitter and the shuffle.

Decks are 18 cards: 8 for the first member (5 `startKit` + 3 generics) and 5 for each recruit.

### 3.1 Tidewrack — Water · TIDAL SURGE · **23.3% prepared**

Boss: `jormungandr_v1`[Water] + `kraken_v1`[Water] + **`skoll_v2`[Fire]**

**PREPARED — deck A · 4/15 (27%)** — `ratatoskr_v1`[Nature] + `huldra_v1`[Nature] + `kraken_v1`[Water]

```
seed_bomb_v2, forage, forage, echo_chamber_v2, healing_mist, water_slap, water_slap, water_slap,
hexbloom, growth, growth, iron_bark, thorn_tithe,
ink_stream, undertow, whirlpool_v2, pressure_point, pressure_point
```

**PREPARED — deck B · 3/15 (20%)** — `huldra_v2`[Nature] + `ratatoskr_v2`[Nature] + `jormungandr_v2`[Water]

```
blightbloom, sap_vigor, thornguard, thornguard, heartwood, water_slap, water_slap, water_slap,
crippling_vine, pollen_cloud, pollen_cloud, nagging_bite, nagging_bite,
contagion, corrosive_bolt, corrosive_bolt, toxic_surge, venom_fang
```

**CONTROL — deck A · 11/15 (73%)** — `kraken_v1`[Water] + `jormungandr_v1`[Water] + `ratatoskr_v1`[Nature]

```
ink_stream, undertow, whirlpool_v2, pressure_point, pressure_point, water_slap, water_slap, water_slap,
ink_stream, undertow, undertow, serpents_coil, blind_spot,
seed_bomb_v2, forage, forage, echo_chamber_v2, healing_mist
```

**CONTROL — deck B · 1/15 (7%)** — `jormungandr_v2`[Water] + `kraken_v2`[Water] + `skoll_v2`[Fire]

```
contagion, corrosive_bolt, corrosive_bolt, toxic_surge, venom_fang, water_slap, water_slap, water_slap,
hydro_blast, capacitor, capacitor, surge_protection, surge_protection,
overdrive, fury_strike, fury_strike, strength_burst, reckless_charge
```

### 3.2 Emberfall — Fire · WAR FOOTING · **83.3% prepared**

Boss: `fenrir_v1`[Fire] + `skoll_v1`[Fire] + **`ratatoskr_v2`[Nature]**

**PREPARED — deck A · 15/15 (100%)** — `kraken_v1`[Water] + `jormungandr_v1`[Water] + `fenrir_v1`[Fire]

```
ink_stream, undertow, whirlpool_v2, pressure_point, pressure_point, water_slap, water_slap, water_slap,
ink_stream, undertow, undertow, serpents_coil, blind_spot,
ragnarok_edge, blood_rite, berserk_rush, battle_rhythm, crimson_draw
```

**PREPARED — deck B · 10/15 (67%)** — `jormungandr_v2`[Water] + `kraken_v2`[Water] + `skoll_v2`[Fire]

```
contagion, corrosive_bolt, corrosive_bolt, toxic_surge, venom_fang, water_slap, water_slap, water_slap,
hydro_blast, capacitor, capacitor, surge_protection, surge_protection,
overdrive, fury_strike, fury_strike, strength_burst, reckless_charge
```

### 3.3 Rootfall — Nature · ROOT ROT · **76.7% prepared**

Boss: `huldra_v2`[Nature] + `ratatoskr_v1`[Nature] + **`jormungandr_v2`[Water]**

**PREPARED — deck A · 14/15 (93%)** — `fenrir_v1`[Fire] + `skoll_v1`[Fire] + `ratatoskr_v1`[Nature]

```
ragnarok_edge, blood_rite, berserk_rush, battle_rhythm, crimson_draw, water_slap, water_slap, water_slap,
sun_devourer, fury_strike, fury_strike, brute_force, battle_rhythm,
seed_bomb_v2, forage, forage, echo_chamber_v2, healing_mist
```

**PREPARED — deck B · 9/15 (60%)** — `skoll_v2`[Fire] + `fenrir_v2`[Fire] + `huldra_v2`[Nature]

```
overdrive, fury_strike, fury_strike, strength_burst, reckless_charge, water_slap, water_slap, water_slap,
pyre_sacrifice, ignite, ignite, molten_core, slag_strike,
blightbloom, sap_vigor, thornguard, thornguard, heartwood
```

### 3.4 The boss piles

The three members' cards are merged into one side pile (`createBattleState`'s convention), so this is
what the boss side actually draws from:

- **Tidewrack** (26 cards) — `undertow ×3, blind_spot, corrosive_leak, surge_protection ×2, serpents_coil ×2, ink_stream ×4, whirlpool_v2 ×2, pressure_point ×2, strength_burst, fury_strike ×2, all_in, desperate_strike, reckless_charge, overdrive, glass_cannon, water_slap`
- **Emberfall** (27 cards) — `ember_mend, blood_rite ×2, berserk_rush ×2, battle_rhythm ×2, crimson_draw ×3, ragnarok_edge ×2, sun_devourer ×2, fury_strike ×2, brute_force, water_slap ×3, pollen_cloud ×2, nagging_bite ×2, crippling_vine, slander, echo_chamber_v2`
- **Rootfall** (28 cards) — `sap_vigor ×2, nettle_sting ×4, heartwood, thornguard ×2, blightbloom, forage ×2, healing_mist, shrug_off, seed_bomb_v2 ×2, echo_chamber_v2, corrosive_bolt ×2, venom_fang ×2, toxic_surge, contagion, water_slap ×5`

---

## 4. The 2‑1 shape Henry asked for — confirmed, and why it is fragile

| boss | their trio | prepared brings |
| --- | --- | --- |
| Tidewrack (Water) | 2 Water + **skoll_v2 (Fire)** | 2 Nature + **1 Water** |
| Emberfall (Fire) | 2 Fire + **ratatoskr_v2 (Nature)** | 2 Water + **1 Fire** |
| Rootfall (Nature) | 2 Nature + **jormungandr_v2 (Water)** | 2 Fire + **1 Nature** |

Exactly the shape Henry specified, on all three, with the single filler always the answer to the
boss's odd member — *"the one water will beat the skoll"* generalises.

**It is a coincidence of two rules that do not reference each other**, now pinned as a test
(`runGate.test.ts`, *"brings 2-1 against every authored boss"*):

- `lineupAgainst('favourable')` fills from the counter element first, then rides the remainder on the
  target's own element. The EA roster has exactly two species per element, so slots 1–2 are the
  counter and slot 3 is the leader's element. **The 2‑1 falls out of the roster size, not out of a
  rule.**
- Ticket 68 ruling 3's boss heuristic builds every trio as two of the leader's element plus one of
  *the element that counters the player's expected counter*, so the odd boss member is beaten by the
  leader's own element — exactly what slot 3 carries.

A boss built 3‑0, or a third species added to an element, breaks the shape while every band number
keeps printing.

### The standoff — it is not "I counter everything"

```
my 2 counters  ->  beat the leader and its twin,  and are EATEN by the odd member (1.5x)
my 1 filler    ->  beats the odd member,          neutral into the other two
```

Two of the player's three bodies take 1.5× from the boss's closer in every one of these fights, by
design. The prepared player is not immune; they are *answered*, and the single filler is the answer
to the answer.

---

## 5. Findings

### 5.1 TIDAL SURGE is not the wall — and it is not broken either

Arms 3 and 4: 23.3% with the Driver, 26.7% without, **one discordant pair in thirty, p = 1.000**.

**It fires.** Instrumented over eight boss battles, the boss side plays 12–27 cards, so the 10-card
threshold trips **once or twice every fight**. It simply pays 10 power into a fight the boss is
already winning by ~240 — roughly 4–8% of the boss's output.

Ticket 71 shipped this Driver after catching a silent `COUNTER`-with-no-`target` bug that made it do
nothing. **This is the other failure mode: correctly wired, and too small to see.** Two consequences:

1. Do not tune TIDAL SURGE in the belief that it is what makes Tidewrack hard.
2. If Tidewrack's damage comes down, the Driver becomes a **larger** share of the fight, not a
   smaller one — so re-read it after any nerf rather than before.

### 5.2 The wall is raw damage rate

Boss damage per turn, telemetry over eight prepared boss battles per gym:

| boss | avg turns | avg boss damage | **damage / turn** |
| --- | --- | --- | --- |
| **Tidewrack** | 3.5 | 195 | **55.8** |
| Emberfall | 4.4 | 142 | 32.3 |
| Rootfall | 5.6 | 156 | 27.6 |

**1.7× Emberfall and 2.0× Rootfall.** A three-member party pool is roughly 240, so Tidewrack deletes
it in two to three turns. In the losses the player gets **12–21 cards played** against **28–37 in the
wins** — they are not being out-played, they are not getting turns.

Un-separated suspects, in the order worth arming:

1. **`kraken_v1` carries a +20 at 3v3** from balance-merge t116 — and it appears in the boss pile
   alongside `jormungandr_v1`'s four `ink_stream` and three `undertow`.
2. **`skoll_v2` (SOLAR_OVERDRIVE)** — `all_in`, `desperate_strike`, `glass_cannon`, `overdrive`,
   `reckless_charge` — a Strength-scaling burst closer landing 1.5× into two of three player bodies.
3. `BOSS_IVS`, unchecked against any authored Driver (ticket 67 ruling 7 is still owed).

### 5.3 The counter-pick inversion is real but it is a DECK effect, not a type effect

Control beats prepared **40.0% to 23.3%** (paired, 7 flips to 2, McNemar **p = 0.180** —
underpowered, not null). At first reading that says *the type-advantaged team is worse than the
neutral one*, which would be a serious incentive bug.

**The split says otherwise.** Control's 40% is one deck:

| control deck | result |
| --- | --- |
| `kraken_v1` + `jormungandr_v1` + `ratatoskr_v1` | **11/15 (73%)** |
| `jormungandr_v2` + `kraken_v2` + `skoll_v2` | **1/15 (7%)** |

Both prepared decks sit at 20–27%. So the honest statement is **not** "neutral beats countered" — it
is **"one specific Water deck beats Tidewrack 73% of the time while everything else loses"**, and
that deck is `kraken_v1` + `jormungandr_v1` — *the same two firmwares the boss itself fields*.

That reframes the question for the design pass. It is not "is the type triangle inverted at
Tidewrack"; it is **"why is `kraken_v1`+`jormungandr_v1` a 73% answer to a fight nothing else
survives, and is Nature simply too slow to convert inside 3.4 turns?"**

### 5.4 The v1 decks beat the v2 decks everywhere

Not a Tidewrack finding — it shows up in every arm:

| gym | v1-flavoured deck | v2-flavoured deck |
| --- | --- | --- |
| Emberfall prepared | 15/15 | 10/15 |
| Rootfall prepared | 14/15 | 9/15 |
| Tidewrack control | 11/15 | 1/15 |
| Tidewrack prepared | 4/15 | 3/15 |

Five arms, and the v1 deck is ahead in all five. **The between-deck gap is larger than the
between-boss gap on two of the three gyms**, which is a deck-archetypes observation rather than a
gym-tuning one, and it is the reason §0 leads with the split.

### 5.5 Emberfall survived the merge and the Rally unchanged

83.3% here against ticket 68's 80.0% — statistically indistinguishable. That number predated both
the balance merge and the Bereavement Rally and I expected it to move. It did not.

---

## 6. What still needs a ruling from Henry

1. **The gauntlet target itself.** Two bosses sit ~20pt above 60%, one sits 37pt below, and the
   target was set against a boss nobody had designed. This is the HELD ruling.
2. **Which knob on Tidewrack** — §5.2's three suspects are all one-variable arms the harness can run;
   none has been.
3. **Whether §5.3's deck effect is a bug or a feature.** A boss that only one specific team answers
   may be the intent of a gym built to punish preparation, or it may be a hole.

## 7. What still needs measuring

- **§5.3 at `--iterations 90`** on the prepared and control arms — the one number worth the battles
  before a ruling.
- **The six arms of 60 over the FULL gauntlet band** (all three fights, not just the boss), which is
  the population the HELD ruling was specified against. Everything here is `gauntlet:fight2` only.
- **A wider deck sample.** Every arm here is two decks; §5.4 says that is the dominant variance term.

## 8. Method notes and known limits

- **n = 30 per arm = 2 decks × 15 seeds.** The enemy roster is fixed by the authored gym, so the only
  per-sample variation is IV jitter and the shuffle. Treat every headline as an average of two decks.
- **All arms share the seed stride** `run-gate:gauntlet:fight2:<i>`, so same-index samples are paired:
  same run seed, same region graph, same boss roll. The McNemar tests use that, and it is far more
  powerful here than an unpaired comparison at this n.
- Every arm is under-sampled against the ±5pt window by the harness's own standard. They are sized to
  separate bosses from each other, not to grade one.
- `--out` was added to `balance:run-gate` for these runs. Node block-buffers stdout to a pipe, so
  `> file.txt` on an hours-long run leaves an **empty** file when it is killed, not a partial one;
  `--out` appends per line, so a killed run is a short measurement rather than no measurement.
