# The hand-built Tidewrack arm: the counters got built, the deck got worse

**Ticket:** [72](../tickets/72-rootfall-build.md) · **Measured:** 2026-08-30 · **Raw:** [`72-runs/handbuilt-v1.txt`](72-runs/handbuilt-v1.txt) · **Predecessor:** [the three-gym table](72-the-three-gym-prepared-table.md)

Henry, 2026-08-30:

> *"that's too many cards can you remove 4-5 cards then run it yourself. also riptide and short
> circuit need to be added"*

and, on the previous arm:

> *"you just threw together all V1 decks and the v1s going against the water boss do not have any
> synergy… the whole point of 3v3 and the boss set up is that type advantage cannot carry a win by
> itself. you also have to have decks, energy and some counter cards."*

Both ruled counters are now printed, the deck was designed rather than dealt, and it was measured
against the same boss at the same seeds. **It lost harder than the generated arm.** That is the
result, and the diagnosis under it is more useful than a win would have been.

---

## 1. The number

| arm | player | result | 95% CI | avg turns |
| --- | --- | --- | --- | --- |
| generated `control` | 2 Water + 1, start deck | **40.0%** (12/30) | 24.6 – 57.7 | 3.2 |
| generated `favourable` | 2 Nature + 1 Water, start deck | **23.3%** (7/30) | 11.8 – 40.9 | 3.4 |
| **hand-built v1** | designed 2‑1, 26 cards, both counters | **13.3%** (4/30) | 5.3 – 29.7 | 3.8 |

Paired against the same seeds:

- vs `favourable`: 2 flips to the hand-built, 5 the other way — **p = 0.453**, no difference worth claiming.
- vs `control`: 2 flips to the hand-built, 10 the other way — **p = 0.039**, the hand-built deck is
  genuinely worse than the neutral tempo team.

```
npm run balance:run-gate -- --cells gauntlet:fight2 --gym gym_tidewrack \
    --handbuilt tidewrack_counter_v1 --iterations 30 --out <file>
```

---

## 2. Why — and it is one number

Telemetry over 8 samples of each deck against the same boss:

| | win | avg turns | **MY damage / turn** | THEIR damage / turn |
| --- | --- | --- | --- | --- |
| hand-built v1 | 0/8 | 3.1 | **28.6** | 73.3 |
| the 73% control deck | 4/8 | 3.0 | **58.6** | 55.0 |

**The winning deck deals 2.05× the damage. Everything else follows from that.**

Read the last column carefully, because it is the mechanism rather than a coincidence: the boss deals
**more** damage per turn against the mitigation deck (73.3) than against the tempo deck (55.0). The
tempo deck kills a boss member; a dead member stops attacking. **Removing a body IS the mitigation**,
and it is worth far more than any amount of Sharp or Weakened.

That also means the Bereavement Rally runs one way in this fight. The tempo deck triggers it (and
pays the Energized) while gaining a whole body's worth of output. The mitigation deck never kills
anything, so it never collects.

### Sharp and Weakened were never going to work here

`STATUS_MODEL` pays **1 power per stack**. Against `ink_stream` at 33 power per triggered draw,
`hydro_blast` at 105, `overdrive` at 54, three Sharp is a ~9% reduction on one hit. The deck spent
roughly a third of its cards buying that.

### The two new cards barely participated

Plays per battle, hand-built deck: `water_slap` 2.1, `growth` 1.6, `crippling_vine` 1.4,
`surge_protection` 1.3, `pollen_cloud` 1.1 … **`riptide` 0.6, `short_circuit` 0.1**.

They are 2‑energy daemons in a fight that lasts 3.1 turns on a 6-energy-a-turn party. A daemon played
on turn 2 taxes one turn before the fight ends, and `short_circuit` is usually never played at all.

**This is a costing problem, not a wiring problem** — both cards are verified live and correct
(`tidewrackCounters.test.ts` counts damage and procs, not "something happened"). A tax that must be
installed cannot answer a boss that wins before installation pays back. Either:

- the counters are **1‑energy or immediate-effect** rather than 2‑energy daemons, or
- Tidewrack's damage comes down until fights last long enough for an installed answer to matter.

Both are Henry's calls. The second one is the same knob §5.2 of the previous report already flagged.

---

## 3. What got built along the way

### 3.1 `riptide` and `short_circuit` — ticket 69's ruled Tidewrack counters, printed

| card | cost | element | effect |
| --- | --- | --- | --- |
| **Riptide** | 2e Daemon, Rare | None | whenever an enemy **plays a card**, deal 8 power to it |
| **Short Circuit** | 2e Daemon, Rare | None | whenever an enemy **draws outside its draw phase**, deal 15 power to it |

They tax the two halves of Tidewrack's engine separately — `riptide` taxes **breadth** (cards played
per turn) and `short_circuit` taxes **depth** (how much of the draw is engine rather than the natural
step) — so a zoo pays both and an ordinary enemy pays almost nothing. Both are `None` so any party can
buy them, and both are in `MARKET_NEUTRAL_UTILITY`.

**The powers are my numbers and are the one place design judgement was exercised.** They were first
written at 5 and 8 power and measured as **zero damage**: the formula resolves at roughly
`power ÷ 4`, so anything under ~8 power floors to nothing. Worth knowing generally — **`feedback_loop_daemon`
(5 power per draw) and `hoofbeat_daemon` (8 power) are both at or under that floor**, and both cards'
printed descriptions overstate their hooks (7 vs 5, 10 vs 8). Not fixed here; flagged.

### 3.2 A fourth silent-failure class, closed

Both cards shipped **printed correctly, hooked correctly, schema-valid, and completely inert**.
`initDaemonHooks` builds from a **hand-maintained allowlist** of `hooks.json` keys, and a daemon
missing from it does nothing — no error, no warning, no failing test. The symptom is a counter card
that measures as "too weak".

This is the fourth variant of one shape in this engine, after ticket 71's `COUNTER`-with-no-`target`,
zod stripping undeclared `when` keys, and `runGate` reading a biome index instead of the leader. All
four are *"the data is fine and the wiring is missing, so the thing is inert instead of loud"*.

`daemonCoverage.test.ts` now fails for **any** Daemon in the registry whose hook ids do not resolve —
the class, not the instance.

### 3.3 `--handbuilt` on the run gate

`handbuiltParties.ts` holds designed parties; `--handbuilt <id>` substitutes **only** the lineup, the
party instances and the deck. The offer, run seed, region graph, node, encounter roll, boss, Driver,
IVs and AI tier are all still built by the same code path from the same seed stride, so a hand-built
number is directly comparable to `favourable` and `control` at the same cell and gym.

It exists because the generated arms **cannot** field the team a player would build: `drawFromElement`
picks every slot as `firmwares[index % firmwares.length]` with the same `index`, so an arm is all‑v1
or all‑v2, and `deckFor` deals the 18-card start deck with no drafted or bought cards.

### 3.4 Deck size is a design parameter

A 3-member party draws `sum(cardDraw) − alive + 1` = **7 cards a turn**. A 3–4 turn boss fight sees
about **25 cards**. At 26 the deck cycles once and every card is drawn; past that each extra card is
one the fight never reaches *and* a dilution of the ones that matter. Henry's *"that's too many
cards"* is arithmetic, not preference.

---

## 4. The deck as measured

`tidewrack_counter_v1` — **huldra_v1** + **ratatoskr_v2** + **kraken_v2** (2 Nature + 1 Water, mixed
firmware), 26 cards:

```
growth, growth, iron_bark, thorn_tithe, hexbloom, water_slap, water_slap, water_slap,
pollen_cloud, pollen_cloud, nagging_bite, nagging_bite, crippling_vine,
capacitor, capacitor, surge_protection, surge_protection, hydro_blast,
riptide, short_circuit, hamstring, hamstring, hexbloom, crippling_vine, shrug_off, soothe
```

The plan was `pollen_cloud`/`hamstring` → `hexbloom` (*2 Poison per stack of Weakened, the Weakened
remains*), so every Weakened both blunts a hit and becomes a poison clock, behind Sharp, with
`capacitor` as the energy plan and `hydro_blast` as the answer to `skoll_v2`.

**The plan was coherent and the fight is not the fight it was built for.** It is a race decided in
three turns, and a conversion engine needs five.

---

## 5. What to try next

1. **A race build, not a control build.** The 73% control deck is the existence proof: 58.6 damage a
   turn beats this boss and 28.6 does not. A designed 2‑1 race deck is the arm that has not been run.
2. **Re-cost the counters to 1 energy**, or give them an immediate effect on the turn they land.
   Measure the same deck again with only that changed — a clean one-variable arm.
3. **Or accept that Tidewrack's damage is the problem** (§5.2 of the previous report: 55.8/turn
   against Emberfall's 32.3) and bring it down until an installed answer has time to pay.

Options 2 and 3 are the same question asked from two ends, and the answer decides whether Tidewrack
is a boss that punishes preparation or one that outruns it.
