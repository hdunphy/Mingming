# The three-gym table: a prepared player against all three authored bosses

**Ticket:** [72](../tickets/72-rootfall-build.md) (the table its resolution owed) · **Measured:** 2026-08-30 · **Under:** the Bereavement Rally, the inverted biome walk order, all three gyms authored, `boss_relic_*` deleted.

Henry, 2026-08-30:

> *"can you run tests against the new bosses with a prepared player. make sure the deck has counters
> and also try to match the 2-1 type advantage so bring two nature and a water vs the water boss.
> the one water will beat the skoll that the water boss uses. do the same for the other 3"*

---

## 0. The lineup Henry specified is the lineup the arm already brings

Checked before measuring anything, because if the arm had been bringing something else the whole
table would have been about a different player.

| boss | their trio | the prepared arm brings |
| --- | --- | --- |
| **Tidewrack** (Water) | jormungandr_v1 + kraken_v1 (Water) + **skoll_v2 (Fire)** | 2 Nature + **1 Water** |
| **Emberfall** (Fire) | fenrir_v1 + skoll_v1 (Fire) + **ratatoskr_v2 (Nature)** | 2 Water + **1 Fire** |
| **Rootfall** (Nature) | huldra_v2 + ratatoskr_v1 (Nature) + **jormungandr_v2 (Water)** | 2 Fire + **1 Nature** |

Exactly Henry's shape, on all three, and in every case the *one* is the answer to the boss's odd
member — *"the one water will beat the skoll that the water boss uses"* generalises.

**It is a coincidence of two rules that do not know about each other**, which is why it is now
pinned as a test (`runGate.test.ts`, *"brings 2-1 against every authored boss"*):

- `lineupAgainst('favourable')` fills from the counter element first and rides the remainder on the
  target's own element. The EA roster has exactly two species per element, so slots 1–2 are the
  counter and slot 3 is the leader's element — 2‑1 falls out of the roster size.
- Ticket 68 ruling 3's boss heuristic builds every trio as two of the leader's element plus one of
  *the element that counters the player's expected counter*. So the odd boss member is beaten by the
  leader's own element, which is exactly what slot 3 carries.

Neither rule mentions the other. A boss built 3‑0, or a third species added to an element, breaks
the shape while every band number keeps printing.

### The standoff this produces — and it is not "I counter everything"

```
my 2 counters  ->  beat the leader and its twin,  and are EATEN by the odd member
my 1 filler    ->  beats the odd member,          neutral into the other two
```

The third boss slot exists to punish the exact counter-pick the offer invites. A prepared player is
not immune; they are *answered*, and the single filler is the answer to the answer. Worth holding on
to when reading the numbers below: two of the player's three bodies are taking 1.5× from the boss's
closer in every one of these fights.

---

## 1. The table

`npm run balance:run-gate -- --cells gauntlet:fight2 --gym <id> --matchup favourable --iterations 30`
Target 60.0%, window 55–65. Raw output in [`72-runs/`](72-runs/).

| boss | prepared | 95% CI | avg turns | vs target |
| --- | --- | --- | --- | --- |
| **Emberfall** (Fire) | **83.3%** (25/30) | 66.4 – 92.7 | 4.1 | +23.3pt |
| **Rootfall** (Nature) | **76.7%** (23/30) | 59.1 – 88.2 | 5.2 | +16.7pt |
| **Tidewrack** (Water) | **23.3%** (7/30) | 11.8 – 40.9 | 3.4 | **−36.7pt** |

**Tidewrack's interval does not overlap either of the other two.** At n = 30 the individual figures
are provisional — the harness says so itself — but *"Tidewrack is far harder than Emberfall and
Rootfall"* is not: 11.8–40.9 against 66.4–92.7 and 59.1–88.2 is a separation no amount of
under-sampling explains away. Only the exact number needs more battles.

Two notes on the other two:

- **Emberfall at 83.3% is statistically indistinguishable from the 80.0% it measured in ticket 68**,
  which is mildly surprising: that figure predates both the balance merge and the Bereavement Rally,
  and either could have moved it. It did not move. Still ~20pt above target.
- **Rootfall at 76.7% is the closest of the three to target and has the longest fights** (5.2 turns).
  ROOT ROT grinds rather than bursts, which is what it was designed to do.

---

## 2. Why Tidewrack — two arms, and the Driver is not the answer

### 2a. TIDAL SURGE is very nearly inert

`--boss-relics off` strips the Driver and leaves the trio, the tuned OS and the decks identical
(the one-variable arm, after ticket 71's fix to that lever).

| arm | result |
| --- | --- |
| prepared, **Driver ON** | 23.3% (7/30) |
| prepared, **Driver OFF** | 26.7% (8/30) |

Same seeds, so this is paired. **Exactly ONE discordant pair across thirty battles** (one battle the
player won only with the Driver off, none the other way): McNemar exact **p = 1.000**. Removing
TIDAL SURGE entirely is worth nothing measurable.

**It is not broken — it fires.** Instrumented over eight boss battles, the boss side plays 12–27
cards, so the 10-card threshold trips **once or twice every fight**. It simply pays 10 power into a
fight where the boss is already dealing ~240. The Driver is ~4–8% of the boss's output.

That is worth stating carefully because ticket 71 shipped this Driver after catching a silent
`COUNTER`-with-no-`target` bug. This is the other failure mode: correctly wired, and too small to
see.

### 2b. What is actually killing the player: raw damage rate

Boss damage per turn, telemetry over eight prepared boss battles per gym:

| boss | avg turns | avg boss damage | **damage per turn** |
| --- | --- | --- | --- |
| **Tidewrack** | 3.5 | 195 | **55.8** |
| Emberfall | 4.4 | 142 | 32.3 |
| Rootfall | 5.6 | 156 | 27.6 |

**Tidewrack outputs 1.7× Emberfall's damage rate and 2.0× Rootfall's.** A three-member party pool is
roughly 240; Tidewrack deletes it in two to three turns. In the losses the player plays 12–21 cards
against 28–37 in the wins — they are not being out-played, they are not getting turns.

The likely contributors, in order, none of them measured apart yet:

1. **`kraken_v1` carries a +20 buff at 3v3** from balance-merge t116 — and Water is the element the
   merge report singled out.
2. **`skoll_v2` (SOLAR_OVERDRIVE)** is a Strength-scaling closer landing 1.5× into two of the
   player's three bodies, by design (§0).
3. Both of the above land inside a fight that is over before a slower counter-element can convert.

### 2c. The counter-pick may be a TRAP here

| arm | result |
| --- | --- |
| prepared (2 Nature + 1 Water) | 23.3% (7/30) |
| **control** (2 Water + 1 alternating) | **40.0%** (12/30) |

Paired: 7 battles the control won and the prepared arm lost, 2 the other way. McNemar exact
**p = 0.180** — underpowered, *not* null, and the direction is 7:2. (The same 6:1 / 8:1 shape in
ticket 70 turned out real at higher n.)

If it holds, **the type-advantaged team is worse than the neutral team against Tidewrack**, and the
mechanism is legible: the control fields two Water bodies that `skoll_v2` cannot eat and one that
answers it, where the prepared team fields two Naturas that skoll eats at 1.5×. The gym designed to
punish the counter-pick punishes it hard enough to invert the incentive.

This is the one number in this report worth spending battles on before ruling. **`--iterations 90`
on both arms would settle it** (~3 hours per arm on Henry's machine).

---

## 3. What this does and does not decide

**Decided by these numbers:**

- The three gyms are *not* the same difficulty, and Tidewrack is the outlier by a wide margin.
- TIDAL SURGE is not the reason. Do not tune it in the belief that it is; and note that if
  Tidewrack's damage is brought down, the Driver becomes proportionally *more* of the fight, not
  less.
- Emberfall's ticket-68 numbers survived the merge and the Rally unchanged.

**Not decided, and needing Henry:**

1. **The gauntlet target itself.** The HELD ruling was waiting on this table. Two of three bosses sit
   ~20pt above 60%, one sits 37pt below. The target was set against a boss nobody had designed.
2. **Which knob on Tidewrack.** `kraken_v1`'s 3v3 buff, `skoll_v2`'s Strength scaling, `BOSS_IVS`, or
   the composition. All four are one-variable arms the harness can run; none has been.
3. **Whether the counter-pick inversion is real** (§2c), and if it is, whether it is a bug in the
   incentive or a feature of a boss built to punish preparation.

## 4. Method notes

- n = 30 per arm, ~60–76s per battle. Every arm is under-sampled against the ±5pt window by the
  harness's own standard; they are sized to separate bosses from each other, not to grade one.
- All arms share the seed stride `run-gate:gauntlet:fight2:<i>`, so **same-index samples are paired**
  — same run seed, same region graph, same boss roll, different player lineup. The McNemar tests
  above use that, and it is far more powerful here than an unpaired comparison.
- `--out` was added to `balance:run-gate` for these runs. Node block-buffers stdout to a pipe, so
  `> file.txt` on an hours-long run loses everything if it is killed; `--out` appends per line, and a
  killed run becomes a short measurement rather than no measurement.
