# Handoff: the whirlpool / draw / HP / number-scale arc

**For the next agent on `legion/ai-perf`.** Three changes were ruled by Henry on 2026-09-01. Two are
committed and green. **The third is implemented, verified at the engine level, and deliberately NOT
committed** — §4 says exactly what is left and why I stopped.

Read §5 before touching anything. Those traps cost real time.

---

## 0. State of the branch

```
4b083ff  ticket 131b: +1 card draw and +50% HP, hand cap 12     <- HEAD, green
fd720af  ticket 131a: whirlpool_v2 keeps its power, gains 1 Dazed
6a05ae2  tickets 128-131: the measurements behind all of it
73544bb  Improved blueprint rate                                 (Henry)
cb8312a  merge origin/steam-release-prep
2270834  ticket 127 part two: beam on in the game + played-card reveal
fd37f96  ticket 127: the enemy turn costs 16s at 3v3
```

At `4b083ff`: **2129/2129 tests green**, `tsc -p tsconfig.app.json` and `-p tsconfig.node.json`
clean, eslint clean.

---

## 1. Why whirlpool got a Dazed and kept its power

Henry: *"whirlpool seems very under powered. Especially compared to pressure point."*

He was right and the scorer agreed: `whirlpool_v2` scored **2.2** against a 1e band of 2.4–3.0 while
`pressure_point`, at the same cost, scored **3.1**. Both appear twice in `kraken_v1`.

He first ruled *"remove the power and make it add dazed and card draw"*. **I priced that shape at 2.8,
called it in-band, and recommended it without running it. That was the mistake of this arc** — Henry
caught it by asking "did you test the whirlpool?". Six arms then ran on `kraken_v1`'s field (30 cells
× 10 iterations) and on the control-vs-zoo panel at 3v3 (12 games):

| arm | score | 1v1 field | 3v3 |
|---|---|---|---|
| shipped — 8 power, draw 1 | 2.2 | 52.50 | 66.67 |
| **THIS — 8 power, draw 1, +1 Dazed** | **2.7** | 56.50 | **75.00** |
| 15 power, draw 1 | 2.9 | 56.50 | 83.33 |
| 8 power, draw 1, 1 Dazed to side | 4.2 | 56.33 | 91.67 |
| draw 2, 1 Dazed, no power | 2.8 | **85.67** | 83.33 |
| draw 1, 2 Dazed, no power | 2.4 | 56.50 | **91.67** |

**Both no-power shapes fail, at opposite widths.**

- **`draw 2` breaks 1v1.** 85.67 on a deck that sat at 52.50 — eight times what any other in-band arm
  is worth. `kraken_v1` runs two copies, so a 1e card drawing 2 is net +1 card twice a cycle.
  `powerscale` prices `DRAW` at 15 power and that is badly under: **nothing in the 1e band should be
  able to move a field 33 points.** Log that against ticket 130.
- **`2 Dazed` breaks 3v3.** 91.67, level with the side-scoped arm. Henry named the mechanism —
  *"that feeds the payoff"* — and it is bigger than `pressure_point`'s conditional draw:
  `calculateDamage` adds `statusPower = powerPerStack × ((Str − Weak) + (Dazed_target − Sharp_target))`
  **before** the divisor, so **every stack of Dazed on a target amplifies every attack anyone makes
  into it.** The control panel already generates Dazed from `kraken_v1`'s side-wide OS (ticket 116)
  and from `rimefrost`; whirlpool doubling its contribution compounds into the same pile.

So the **power is the least inflationary part of the card** and the shipped shape keeps it.

**Also ruled and NOT done: `feedback_loop_daemon` → 1e, proc power 7, owner-gated.** Henry rejected
the side-wide variant outright: *"we already learned our lesson that per side OS's are too OP. You add
in a zoo draw deck and it become unbeatable."* Read ticket 128's sixteen `source: SELF` firmwares as a
feature on that ruling, not a bug. At power 7 the turn-by-turn value is T1 3.9 / T2 3.1 / T3 2.4 /
T4 1.6 against a 2.4–3.0 band. **This has not been implemented — it is the smallest open item.**

## 2. Why the HP buff and the extra draw shipped together

Henry's complaint had two halves and they need different medicine:

| arm | turns/battle (zoo / control) | energy unspent | cards cast/turn |
|---|---|---|---|
| baseline | 5.2 / 4.5 | 22.9% / 19.3% | 5.77 |
| +50% HP | **7.7 / 5.8** | 15.5% / 17.4% | 5.63 |
| +1 draw | 3.8 / 4.3 | **11.5% / 9.6%** | 7.09 |
| both (arm) | 7.5 / 5.3 | 13.8% / 9.9% | 5.82 |

- **Extra draw** fixes *"always leaving energy on the table"* and **shortens** the game.
- **HP** buys **turns** at the same cards-per-turn, which is what answers *"tough to get out combos
  with only 3 cards"* — the deck is drawn deeper over a battle.

Two implementation notes the next agent needs:

**HP is applied to `calculateHealth`'s OUTPUT, not to `baseStats.hp`, and that is load-bearing.**
`calculateHealth` is `calculateStandardStat(base, iv) + 15 + 30`, and `calculateStandardStat` ends in
`+ 5` — a **flat +50 dominates**. Fenrir's base 66 yields 75 HP, of which only 25 comes from the base.
Multiplying `baseStats.hp` by 1.5 would have produced **85 — a 13% buff wearing a 50% label** — and
widened the roster's spread unevenly. Verified after: Kraken 73 → 109, Huldra 80 → 120.

**The hand cap had to move with it.** The refill is
`min(sum(cardDraw) − alive + 1, LIMIT − hand.length)`, so +1 a body is +3 at 3v3. Measured: the cap
clipped 4–9.5% of refills before and **~50%** after, eating 1.1 cards a turn — half the ruled buff
thrown away silently. `HAND_SIZE_LIMIT` 9 → 12. **`effectHandlers.ts` held a fourth private copy of
the 9** that ticket 32's "single source of truth" consolidation missed; it now imports.

### The row that did not come out as hoped — read this

```
                    baseline        shipped (4b083ff)
turns per battle    5.2 / 4.5       4.3 / 4.5
```

**The turn count did not go up.** The isolated arms predicted 7.5–7.7; on the shipped build — which
also raises the hand cap, so more of the extra draw actually arrives — the zoo panel is *shorter* than
baseline and control is flat. The extra cards are cancelling the extra health.

This is recorded rather than smoothed over. **n=3 battles a panel cannot settle a half-turn
difference**, so the first job for the next agent is a bigger run (10+ battles a panel,
`scratch/handeconomy.ts --width 3 --iter 10`). If the effect is real, the honest levers are a larger
HP multiplier, or a smaller draw step — **a +1 on the FORMULA (`− alive + 2`) is +1 card at any party
size instead of +3**, and was never measured.

## 3. Why the numbers are being scaled ×10

Henry: *"should we scale all our numbers by 10 or even 5. Bigger numbers often feel better."*

Nobody had written down what they are (`scratch/numberfeel.ts`, 136 attack cards at the balance frame):

```
min 0   p25 2   MEDIAN 4   p75 7   max 32
62 of 136 attack cards read 3 damage or LESS.  pollen_cloud reads 0.
```

**The feel argument is real; the resolution argument is stronger.** `calculateDamage` ends in
`Math.floor`, so at a median hit of 4 a card at 2 damage and one at 3 differ by 50% with nothing
expressible between them. Half the attack pool lived where the engine could not represent a small
tuning step at all. **×10 buys every knob one more significant figure.**

After the change (verified): median **41**, max **328**, frames **1095–1200**, and **0 of 136 cards
read ≤3**. Every card price is unmoved — whirlpool 2.7, pressure_point 3.1, maelstrom 9.5.

**It is deliberately one constant at two sites**, because nearly everything else is denominated in
*power* or *% of maxHp* and scales itself: card power values, status stacks (`statusPower` is added
before the divisor), heals (`maxHp × power / 400`), Burn/Poison tiers, and the whole rev-3 band table.

Four things did **not** scale themselves and are changed in the same working tree:

1. `damageOverride` on `desperate_strike` / `glass_cannon` / `dark_pact` — flat HP, ×15 (the ×10 scale
   **and** ticket 131b's ×1.5, which had already left them 1.5× stale).
2. `powerscale.ASSUMED_MAX_HP` — now derives from `HP_MULTIPLIER × NUMBER_SCALE`.
3. **`TacticalAI.TERMINAL_SCORE` — the one that would have failed silently.** Its own comment promises
   it sits "far above any reachable board score ... a full 200 HP frame with every buff is worth a few
   hundred". With frames ten times bigger a board is worth a few *thousand*, and a flat 10000 stops
   dominating: the AI quietly begins trading a win for a good position. It now derives.
4. **A save migration, NOT written.** `IGauntletProgress.persistedHp` is the only persisted absolute
   HP — the ranch stores IVs and recomputes. A save with an in-progress gauntlet will restore units at
   1/10 health. There is no save-version infrastructure in this repo and I did not invent one.

## 4. Why commit 3 is NOT committed, and exactly what is left

The engine change is done and verified. **Its test suite is red: 27 assertions across 13 files pin
absolute damage or HP numbers.** That is the expected cost of a units change, and it is real work.

**I tried twice to do it mechanically and both attempts made it worse** (27 → 46, then 27 → 48).
Recorded so nobody repeats it:

- Scaling HP literals in **`scenarioTestSupport.ts`** breaks a hundred *passing* tests that share it.
  **Do not touch the shared helper.**
- Scaling HP literals across a failing *file* breaks the other, passing tests in that same file.

**And the expectations cannot be multiplied by 10 either** — `floor(3.9) = 3` but `floor(39.1) = 39`,
not 30. That lossiness *is* the problem the change fixes, so every number has to be recomputed, not
scaled.

The 27 fall into three classes:

- **Pure pins** (~11): `expect(damage).toBe(7)` → 71. Verify each moved by ≈10× before accepting it.
  Mostly `StatusCombat.test.ts`, `combatUtils.test.ts`.
- **Clamping/lethality artifacts** (~13): a fixture with `maxHp: 100` now dies to one hit, so a
  second measurement never happens or both readings clamp to the same value. `StanceSystem`'s
  `[12, 0, 0]` and its `expected 200 to be 130` are this. These need *that fixture's* HP raised —
  individually.
- **Needs investigation** (at least 1): `battleReducer.test.ts` "should consume nextProgramModifier"
  reads **29 where it expects 93** — *lower*, not 10× higher. **Do not paste the actual over the
  expectation until you know why.** That is the one that could be a real defect.

**Blind-updating expectations to match actuals is how you cement a bug**, which is why I stopped
rather than shipping a green-looking suite.

The working tree for commit 3 is in `_c3wip/` (or the tar handed over with this report):
`types.ts`, `combatUtils.ts`, `ai/TacticalAI.ts`, `powerscale.ts`, `programs.json`.

## 5. Traps in this repo that cost real time

- **`tsc --noEmit` typechecks NOTHING.** `tsconfig.json` is a solution file (`"files": []` + two
  references), so the default invocation resolves an empty program and exits 0. Vitest strips types
  rather than checking them. Use `tsc -b`, or `-p tsconfig.app.json` / `-p tsconfig.node.json`.
- **`vite.config.ts` sets `define: { 'process.env': {} }`**, and under vite-node environment variables
  reach module code by **no route at all** — `globalThis.process.env` has zero keys. Every debug CLI
  here takes **flags**. To set a module-level env constant from a harness, write it onto
  `globalThis.process.env` through a **computed key** and then `await import(...)` the engine; that is
  what `scratch/beamgate.ts` and `handeconomy.ts` do.
- **Git cannot unlink through the desktop mount.** `merge`, `reset --hard`, `rebase --skip`, `tar x`
  over an existing file — all half-complete. `git add`/`commit` are safe (they only write). Stale
  `.git/*.lock` files must be **moved aside inside the mount** (`mv .git/index.lock _lk/`) — moving
  them to `/tmp` crosses a filesystem, which is a copy+unlink, and the unlink fails. To overwrite
  files, extract to a staging dir and `cat src > dest` (truncate in place). **Run merges and rebases
  from Windows.**
- **A dead arm reads exactly like a null result.** Five times in this project a measurement "worked",
  stayed green and measured nothing. **Every arm must assert it took effect and throw if it did not** —
  `whirlpoolarms.ts` and `handeconomy.ts` both do, and `beamgate.ts` asserts via `AI_CENSUS`.
- **A passing test is not evidence about the shipped game.** `OSSystem.test.ts` asserted
  `CINDER_WALL_OS` worked for months using a card that exists only in `TestProgramRegistry` and
  hand-registered hooks. Ticket 128 re-tested it through the real registry and real deck.
- **Never deliver a whole file from a stale copy.** Ticket 126 once overwrote `battleReducer.ts` from
  an old tarball, silently reverting `canFireMacro` (imported by 7 files) and the damage ledger, and
  turning 45 tests red while the commit message claimed green. **Re-sync from `git archive HEAD`
  before editing, and apply changes surgically.**

## 6. Open items, in rough priority

1. **The 27 test updates** (§4), then land commit 3.
2. **`feedback_loop_daemon` → 1e, power 7** (§1) — ruled, not implemented.
3. **A bigger `handeconomy` run** (§2) — did the HP buff actually extend games?
4. **The save migration** for `persistedHp` (§3.4).
5. **Ticket 130** — `EXPECTED_DAEMON_PROCS = 4` is a guess; and its hook-pricing branch only runs
   `if (score === 0)`, so a daemon with any actions of its own silently loses all its hook value.
   Add `DRAW`'s mispricing (§1) to it.
6. **Ticket 128** — 16 firmwares gate on `source: SELF` at a caster-chosen trigger, and at 3v3 the
   deck is shared and `BattleArena` persists the caster selection between plays. Henry has ruled the
   gating stays; the **UI** should make the caster unmistakable.
7. **Ticket 119** — the width-blind Side ×2.2 multiplier, which this arc hit twice more.
8. **Web Worker for the AI** (steam-release ticket 39) — 569 ms a decision still misses its own 1.0 s
   p95 target, and the search is synchronous on the main thread so the UI freezes through it.
