# Bounding Sleipnir without a cap, and light tuning for the four decks that fell

- Type: wayfinder:research + implementation. **Ticket 103.** Branch `archetype-web`.
- Henry, after ticket 102: *"Can you do a run of balancing sleipnir except no caps, not even per
  turn. Try reducing his number per card, then try a consume str for damage, and also try adding a
  debuff if those don't work. Try some light tuning for the worst decks - add some riders to cards
  or a consume/cleanse effect, maybe they need a buff or a stat buff."*
- **Nothing here is a cap.** Not a hard ceiling, not a per-turn limit, not a diminishing return.
  Every arm changes a RATE, a COST, or removes a cap that was already there.

---

## 0. The short version

All five decks are back inside the healthy 35–80% band, and one of the fixes was deleting a cap
rather than adding one.

| deck | was | now | what changed |
|---|---|---|---|
| `sleipnir_v1` | **83.9%** | **57.7%** | mints 1 Strengthened per 0-cost card instead of 2 — **and 2 again once he already holds 4**; `momentum_crash` now SPENDS the pile |
| `skoll_v2` | **34.3%** | **49.4%** | her OS's five-stack cap deleted |
| `kraken_v2` | **29.7%** | **45.2%** | `capacitor` also grants 3 Sharp |
| `ratatoskr_v1` | **35.0%** | **44.4%** | `shrug_off` becomes shed-and-convert: lose 1 Weakened, gain 2 Sharp |
| `audhumbla_v2` | **31.2%** | **40.9%** | species attack 60 → 75, and `purify` also sheds Weakened and Dazed |
| `audhumbla_v1` | 53.6% | **68.3%** | (rides the same attack buff — attack is a per-species stat) |

Full 960-cell grid, 30 games per cell, both turn orders. **Decks inside the band: 28 of 32 → 31 of
32.** The one that falls out is `fafnir_v1` at 34.0% — it drifted down 2.4 points as collateral and
is now 1.0 below the floor. **Neutral blowout matchups went 34 → 30**, which is the first time that
number has moved the right way since the re-denomination. FTK stays at 2, the same two cells.

Two things are worth reading past the table.

**Skoll's fix was removing a cap, not adding one.** She was the worst deck on the roster *because*
her OS stopped counting Strength at five stacks. Every other status deck got paid for a big pile
when statuses became POWER; the one deck actually built to hoard was the one deck that couldn't
cash it. Deleting the cap — nothing else — took her from 34.5% to 50.1% and cut her blowout
matchups from 6 to 3.

**Consume-for-damage worked, but not the way it looked like it would.** Making every attack spend
the pile is a massive nerf (sleipnir drops to 18.8%) because holding N stacks is +N power on
*everything forever*, and cashing is one hit, once. What works is making the payoff card that
already reads the pile actually spend it — which as a bonus escapes an existing 8-stack cap in the
engine, so it's another cap removed.

---

## 1. Sleipnir: eight arms, no caps

He was at 83.9% because MOMENTUM_DRIVE mints 2 Strengthened per 0-Energy card and 5 of his 12 cards
cost 0 — a measured pile of mean 4.85, peak 24, against a ~40-power 1-Energy card.
`scratch/sleipnir.ts` measures each arm against the whole roster.

| arm | what it does | field | dead cards | turns | blowouts |
|---|---|---|---|---|---|
| live | 2 Strengthened per 0-cost card | **83.3%** | 18.9% | 3.98 | 5 |
| **A1** | **1 per card** — the straight rate cut | **54.4%** | 16.1% | 4.45 | 2 |
| A2 | 2, but only on 0-cost *attacks* (a condition, not a cap) | 55.3%* | 18.0% | 4.27 | 1 |
| B1 | every attack consumes the pile, 1 power per stack | 18.8%* | 17.0% | 4.48 | 1 |
| B2 | …2 power per stack | 22.5%* | 17.4% | 4.42 | 1 |
| B3 | …5 power per stack | 41.3%* | 17.5% | 4.34 | 0 |
| B4 | …8 power per stack | 60.0%* | 18.3% | 4.16 | 0 |
| B5 | the pile leaks — 1 stack spent per attack, no bonus | 66.9%* | 19.7% | 4.00 | 0 |
| B6–B8 | `momentum_crash` consumes the pile (8/12/15 power per stack) | 82.8 / 86.9 / 86.8%* | ~21% | ~3.6 | 3–4 |
| C1 | +1 Dazed on himself per mint (a price, not a ceiling) | 73.5%* | 21.5% | 3.49 | 2 |
| C2 | +2 Dazed per mint | **58.2%** | 20.4% | 3.63 | 1 |

\* narrow read (10 opponents); the bolded rows were re-run against all 30 and those are the numbers
to trust. The narrow spread runs about two points hot, which is the seed-base law doing its job.

**Answering the three things you asked, in your order:**

1. **Reducing his number per card works.** 2 → 1 lands him at 54.4%, and it improves everything
   else too: dead cards 18.9% → 16.1%, games lengthen from 4.0 to 4.5 turns, blowout matchups 5 → 2.
2. **Consume-for-damage works only as a per-attack drain, and it overshoots hard.** B1 at 1 power
   per stack drops him to 18.8%. The reason is worth keeping: under POWER, *holding* ten stacks is
   +10 power on every attack for the rest of the game, and *cashing* them is one hit for 10. Cashing
   has to be worth several times more than holding before it's even a fair trade — B4 needed 8
   power per stack to land at 60%.
3. **The debuff works.** C2 (+2 Dazed on himself per mint — he hits harder and takes harder, with no
   ceiling on either) lands at 58.2%. It's a clean shape and it's the one I'd reach for next if you
   dislike the rate cut. Its cost is that it keeps games short (3.6 turns) and keeps dead cards
   high (20.4%), where the rate cut improves both.

**What shipped: A1 plus the hold-or-cash card.** The rate cut does the balancing.
`momentum_crash` — which already read the pile ("8 Air damage for every stack of Strengthened you
have") but never spent it — now consumes it. That is the consume-for-damage you asked for, in the
one place where it's a decision rather than a tax: the pile is worth +1 power on everything until
the turn you decide to cash it.

Two side effects of that, both good:

- **It removes a cap.** `STRENGTH_STACKS` scaling is hard-capped at 8 stacks inside the engine.
  Consuming uses a different path with no cap at all, so a 20-stack pile finally pays in full.
- **It fixes the card's price.** `momentum_crash` was scoring 0.8 against a 2.4–3.0 budget — one of
  the most under-budget cards in the deck. Consuming prices it at 2.8, inside the band, without
  changing the printed 8 power.

On the 30-opponent read that drives these arms: 45.2% field, 16.4% dead cards, 4.52 turns, 2
blowouts — down from 83.3% / 18.9% / 3.98 / 5. **Then your round-3 playtest changed the shape — see
1b below.**

### 1b. Then your playtest arrived, and it changed the answer

Round 3 landed while this was running, and your hands gave a better gate than any field win rate:

> Piloting against him: *"Got wiped on turn 2. Momentum Crash did 24 damage... Sleipnir had 10 str
> by turn 2!"*
> Piloting him: *"4str after turn 1 ... after turn 3 had a nice str boost to 14 ... won on turn 5
> with 22 str. This felt fun to play although was a little OP."*

Read together those say **the problem is early velocity, not the ceiling** — the turn-2 opener is
what kills people, and the turn-3-to-5 climb is the part you enjoyed. A field win rate cannot see
either, so I built `scratch/strarc.ts` to record the pile at the end of each of his turns.

The straight rate cut passes your first test and fails your second:

| end of turn | live (2/card) | rate cut (1/card) | **shipped (ramp at 4)** |
|---|---|---|---|
| 1 | 2.5 (peak 6) | 1.3 (peak 3) | 1.3 (peak 3) |
| 2 | **6.0 (peak 10)** | 3.3 (peak 6) | **3.7 (peak 8)** |
| 3 | 11.2 (peak 12) | 5.6 (peak 7) | 7.3 (peak 10) |
| 4 | 15.0 (peak 18) | 7.9 (peak 11) | **10.0 (peak 16)** |
| mean winning turn | 4.2 | 5.0 | 4.8 |

The AI's arc at the live setting matches your hands closely (turn 2 peak 10 against your 10, turn 3
mean 11.2 against your 14), which is the validation that makes the rest of the table worth reading.
At 1 per card the turn-2 spike is gone — but so is the climb you liked, topping out around 8.

**So the shipped shape is a ramp, not a flat cut.** MOMENTUM_DRIVE grants 1 Strengthened per 0-cost
card, and **2 instead of 1 once he already holds 4 or more**. That is a condition, not a cap: the
opener is slow, and once the engine is running it runs at the old rate. It uses `sourceStatus`,
which the hook schema already supports and `nidhoggr_v1` already uses.

It is better than the flat cut on every axis I can measure:

| | flat cut (1/card) | **ramp at 4** |
|---|---|---|
| field | 45.2% | **55.7%** |
| blowout matchups | 2 | **0** |
| dead cards | 16.4% | 17.1% |
| turn-2 pile | 3.3 (peak 6) | 3.4 (peak 8) — still no 10-stack opener |
| turn-4 pile | 7.9 (peak 11) | 10.0 (peak 16) — back in the teens |

Ramp thresholds of 5 and 6 both work too (52.0% and 47.8%) if 4 turns out to feel too quick in your
hands — it is a one-number change in `hooks.json`.

Full grid: **57.7%** (from 83.9%).

---

## 2. Skoll: the cap was the bug

`skoll_v2` runs Strengthened in 7 of her 9 cards. Her OS, SOLAR_OVERDRIVE, reads
*"+15% damage per stack of Strength she holds (max 5 stacks)"* — and that parenthesis was written
back when a stack was worth 2% of your damage. After ticket 102 a stack is also +1 power, uncapped,
for everyone else; hers stopped counting at five.

| arm | field | dead cards | blowouts |
|---|---|---|---|
| live (cap 5) | 34.5% | 36.0% | 6 |
| cap 8 | 45.5% | 34.3% | 4 |
| **cap removed** | **50.1%** | **33.3%** | **3** |
| `glass_cannon` 45 → 60 power | 45.2% | 36.6% | 5 |
| both | 56.1% | 33.8% | 3 |

**Shipped: the cap deleted, and nothing else.** `Infinity` rather than a big number, on the
principle that a cap you can't reach is still a cap someone has to reason about. The valve is the
duality cancel and the sheds, same as every other duality status.

Final on the full grid: **49.4% field** (from 34.3%).

Left on the table: `glass_cannon` is still the most under-budget card in the registry at −5.1
(45 power for 20 recoil on a 55-defense frame). Raising it to 60 power reads 45.2% on its own and
56.1% combined. I didn't ship it because the cap removal alone lands her mid-band and I'd rather
not move two things at once — but it's a real redline and it's a one-line fix whenever you want it.

---

## 3. The three decks that hold none of the new currency

Ticket 102's read: `kraken_v2` has one duality stack in the whole deck, `ratatoskr_v1` and
`audhumbla_v2` have none. They weren't nerfed — the currency was revalued and they hold none of it.

### `kraken_v2` — 29.7% → 45.2%

Seven arms measured. A stat buff alone doesn't do it (58 → 70 HP is worth only +3.8), which is
worth knowing because she is the lowest-HP mingming on the roster and the obvious guess was that
she's just too fragile. She isn't: she's a 100-attack deck with 8 cards that all cost 2–3 Energy on
a 2-Energy frame, and 34% of her cards go unplayed. What she needed was to survive the turns she
can't act.

| arm | field | dead cards | blowouts |
|---|---|---|---|
| live | 30.1% | 34.2% | 5 |
| HP 58 → 70 | 33.9% | 33.5% | 4 |
| `surge_protection` + 2 Sharp | 38.1% | 32.8% | 4 |
| **`capacitor` + 3 Sharp** | **46.1%** | **31.3%** | **2** |
| both riders | 54.7% | 30.0% | 3 |

**Shipped: `capacitor` also grants 3 Sharp.** It's a 2-Energy "gain 2 Energy next turn" card — a
turn she spends not attacking — so giving it a defensive rider costs her nothing she was using.

**Budget note, stated plainly: this puts `capacitor` at 7.2 against a 5.2–6.5 band — 0.7 over.**
I tried to avoid it. The alternative that stays in band (move the Sharp to `surge_protection` and
pay for it by cutting that card from 40 to 30 power) reads 34.7% — twelve points worse and two more
blowouts. I took the overage deliberately; it is the only redline this ticket adds that I'd call
a real one.

### `ratatoskr_v1` — 35.0% → 44.4%

| arm | field | blowouts |
|---|---|---|
| live | 35.8% | 8 |
| `forage` applies 1 Weakened | 21.3% | 11 |
| **`shrug_off` grants Sharp** | **51.8%** | **5** |
| both | 37.6% | 8 |

The `forage` rider actively hurt him, which is a useful negative: `forage` is a card he plays on
himself (draw 1, take damage), so hanging an offensive rider on it doesn't fit the card.

**Shipped: `shrug_off` becomes shed-and-convert.** It was "remove 1 Dazed and 1 Weakened" for 0
Energy. It is now "remove 1 Weakened, then gain 2 Sharp" — the Dazed shed is traded away to pay for
the Sharp, which keeps a 0-cost card inside the tightest band in the game (0.8–1.0). It scores
exactly 1.0. The first cut, which kept both sheds and added 3 Sharp, scored 1.9 — nearly double
budget.

Final on the full grid: **44.4% field** (from 35.0%). His blowout count is unchanged at 8, which is its own problem
and not one light tuning reaches.

### `audhumbla_v2` — 31.2% → 40.9%, and `audhumbla_v1` 53.6% → 68.3%

This one took the most work and is the least satisfying.

Every rider arm raised her field rate and made her matchups *more* binary — the opposite of what
you want. She is a heal deck; making her tankier turns games into "she outlasts you completely" or
"she can't", and her games already run 9 turns.

| arm | field | turns | blowouts |
|---|---|---|---|
| live | 32.6% | 8.90 | 12 |
| `dawnstrike` applies 2 Weakened | 49.0% | 10.87 | 14 |
| `sacred_spring` grants 4 Sharp | 56.5% | 11.64 | 18 |
| both | 62.3% | 13.22 | 21 |
| **`purify` extended to shed Weakened and Dazed** | **45.0%** | **9.69** | **10** |

The cleanse was the only arm that improved her blowouts. But pricing it honestly was a problem:
`purify` sits at exactly 3.0 against a 3.0 ceiling with zero headroom, so the full version scored
6.5 — more than double budget. Raising it to 2 Energy made it price correctly and **made her
worse** (27.6%), because on a 2-Energy frame a 2-cost cleanse costs her the entire turn.

**What shipped is a stat buff plus a trimmed cleanse.** Her attack was **60 — the lowest on the
roster against a median of 85**, and a clock costs no card budget at all. Attack 60 → 75, and
`purify` sheds one less Poison/Burn to pay for shedding 2 Weakened and 2 Dazed (score 3.3, 0.3
over).

Attack is a per-species stat, so this moves `audhumbla_v1` too — and that is fine: she goes 53.6% →
**68.3%**, in band, with her one blowout matchup going to **zero**.

Final on the full grid: v2 **40.9%**, v1 **68.3%**. But v2's blowout count went 11 → 12, she still holds no duality
card of her own, and she still takes nearly nine turns to win. **Light tuning got her into band and
did not make her a better deck.** Ticket 101's rebuild — heals overflowing into Regen, a card that
drinks the pile — is still the answer, and this ticket is a holding pattern until it lands.

---

## 4. Two things found along the way

### The cell cache has been blind to every `hooks.json` change since ticket 97

This one caught me in the act. I shipped the Sleipnir ramp hook, re-ran the 960-cell grid, and got
**960 cache hits, 0 misses, and a byte-identical result** — for a change that demonstrably alters
his win rate by ten points.

The cause: `cellCache.sideHash` read `FIRMWARE_REGISTRY[os]` directly, and that registry is **empty
until something calls `getOSBehavior()`**. Ticket 97 made the grid hoist all 960 cell keys *before
the first battle* — which is exactly the moment nothing has initialised firmware yet. So the
`?? null` fallback fired for all 32 decks and the firmware component of every key was the constant
`null`. Any pass between ticket 97 and now that changed **only** `hooks.json` would have silently
reported the previous run's numbers.

Fixed (`getOSBehavior(os)` instead of the raw registry read, which triggers the init), pinned with
`src/debug/balance/cellCache.test.ts`, and ticket 97's own `cacheproof.ts` still passes
bit-identical. **Tickets 102 and this ticket's first pass are unaffected** — both changed engine
`.ts` files, which *are* hashed as source text, so those runs recomputed from cold. Every grid in
this report was re-run after the fix.

### `isAttack` is dead schema

`isAttack` is declared in `HookSchema.ts` as a hook condition and **nothing in the engine reads
it**. A hook written with `when: { isAttack: true }` fires unguarded, silently. No shipped hook uses
it (I checked all 46), so this is dead schema rather than a live bug — but the next person to write
a hook will reach for it. The working equivalent is `actionType: 'ATTACK'`. It cost me one
measurement run that came back byte-identical to the control.

---

## 5. The whole-roster diff

| | before 103 | after 103 |
|---|---|---|
| decks inside 35–80% | 28 / 32 | **31 / 32** |
| out of band | `sleipnir_v1` 83.9, `skoll_v2` 34.3, `audhumbla_v2` 31.2, `kraken_v2` 29.7 | `fafnir_v1` 34.0 |
| neutral 0% cells | 15 | **13** |
| neutral 100% cells | 19 | **17** |
| all-bucket 0% / 100% | 42 / 53 | **34 / 46** |
| FTK | 2 | 2 (same two cells) |
| dead cards | 21.0% | 20.8% |
| average game length | 5.21 turns | 5.21 turns |

Twenty-three of 32 deck rows moved by a point or more. Eight of those are the intended targets. The
rest is collateral worth naming: **`valkyrie_v1` and `valkyrie_v2` each dropped 4.1 points**
(52.4 → 48.3 and 53.1 → 49.0), and `fafnir_v1` dropped 2.4 through the band floor. Both are the
same story — they were beating the decks this ticket buffed. Nothing else moved more than 3 points.

### Redlines

**66 → 68**, and every one of the three changes is accounted for:

| | |
|---|---|
| **NEW** `capacitor` | 7.2 against a 6.5 ceiling — **the deliberate overage**, section 3 |
| **NEW** `purify` | 3.3 against 3.0 — 0.3 over, the trimmed cleanse |
| **NEW** `os:kraken` variance gap | 0.18 against 0.15 — her two decks are further apart now that v2 works. A §2.3 diagnostic, not a gate. |
| **RESOLVED** `os:sleipnir` variance gap | his two decks are closer together now that v1 is not 84% |

`momentum_crash` also left the under-budget list (0.8 → 2.8, inside its band) without appearing on
the over list. `shrug_off` stayed inside its band by design.

The 22 failing checks in the balance suite are all section 2.3 OS-variance, which is the check the
deep-phase policy demoted to diagnostic. Same 22 before and after — no regression.

---

## 6. What I did NOT do

- **No caps.** Not one, anywhere, including per-turn. Two existing caps were removed.
- **`glass_cannon`** is still −5.1 under budget and still the worst-priced card in the registry.
  One line, whenever you want it.
- **`audhumbla_v2`'s blowout count** went 11 → 12. Light tuning put her in band; it did not make her
  a better deck. **Ticket 101's rebuild is still the answer.**
- **`fafnir_v1` at 34.0%** is 1.0 under the floor after drifting down 2.4. I left it rather than
  chase it — one more knob on a deck nobody asked about, to move a number that is inside the
  measurement's own noise, is how a balance pass turns into a spiral.
