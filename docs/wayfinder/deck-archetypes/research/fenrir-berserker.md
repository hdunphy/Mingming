# Is fenrir_v1 a berserker? (ticket 83 - diagnostic, nothing shipped)

Henry's question: *"was fenrir supposed to be a berserker? could he have a deck problem that didn't
reward taking the recoil damage? can we try buffing some of his berserker cards, add a damage buff
to his OS so like fire attacks do extra damage, add new cards?"*

**Yes to both halves of the question.** He is built as a berserker, three separate things stop the
berserker from happening, and the fix Henry guessed at works - but only in one specific shape.

**The headline: a FLAT Fire damage bonus is worth nothing (34.8%). The SAME bonus scaled by how
much HP is missing is worth up to +20 points, and it lets the recoil come back.**

## 1. The deck is half a berserker deck and the other half fights it

fenrir_v1 on a **66 HP / 91 attack / 69 defense** frame - the lowest HP in the roster next to nearly
the highest attack, which is a berserker's stat line exactly.

**Pays you for being hurt (4 of 9 cards):**

| card | cost | text |
|---|---|---|
| `ragnarok_edge` x2 | 2e | 30 power, **+0.7 power per 1% of max HP missing** (max 50%) |
| `berserk_rush` x2 | 1e | 17 power, **+17 if you are below 50% HP** |

**Pays you for being healthy, or pushes you back over the line (4 of 9):**

| card | cost | text |
|---|---|---|
| `blood_rite` x2 | 1e | 15 power, **+15 above 50% HP**; below 50% it **heals 10% of max HP instead** |
| `crimson_draw` | 1e | 18 power, heal 8.5% max HP |
| `ember_mend` | 0e | heal 2.5% max HP - **1.6 HP** on this frame |

`battle_rhythm` is the ninth: 2 Strengthened above 50%, 2 Sharp below - a sidegrade either way.

**`blood_rite` is the load-bearing inconsistency.** Two copies, and below 50% HP it *loses half its
damage* and *heals you back over the threshold* - the berserk payoff running in reverse on the
deck's most common card.

## 2. The recoil could never reach the threshold - it is one HP

`HookFactory` computes it as `Math.max(1, Math.floor(maxHp * pct/100))`. On 66 HP: 2% is
`floor(1.32)` = **1 HP**, and 1% is `floor(0.66)` = 0 clamped to **1 HP**. The same number, which
is why ticket 82's `recoil=1` arm measured identical to baseline.

Her games run ~4.9 turns at ~1.5 cards a turn, so the recoil supplies about **5-6 HP, ~8% of her
bar**. On `ragnarok_edge` 8% missing is **+5.6 power**; at ticket 61's measured rate (~0.19 HP of
damage per printed power) over 1.75 casts a game, **the OS sold ~5.5 HP of her own health for about
1.9 HP of extra damage.** `berserk_rush` needs **50%** missing - the recoil delivers 8%, so the OS
never once switched that card on.

## 3. The AI is engineered to leave the state the deck wants

`TacticalAI.getEntityScore` scores HP **concave** - 85% square-root - and the comment that put it
there names this deck:

> *"Linear HP made the AI take the bigger damage line right up to death (fenrir_v1 dove to 13.9%
> average HP in 40/40 games and cast its heal once)."* (ticket 27)

Below 50% HP the pilot is at its most desperate to heal, and this deck hands it three ways to do
it. Ticket 27 fixed a real bug by making the pilot risk-averse; the deck that motivated the fix is
the one deck that wanted the risk. **The concavity is global and stays** - the deck and OS have to
make the hurt state pay enough that even a cautious pilot goes there.

## 4. What was missing from the kit

Nothing in the **entire card pool** lets a Mingming spend HP on purpose (hel does it through her
OS). Every one of the eight cards that touches missing HP or a health threshold is a *payoff*.
There is no accelerator, so the berserk state can only be reached by letting the enemy hit you -
the one route the AI is built to avoid.

## 5. Measured (ITER=15, control = the shipped ticket-82 build at 36.2%)

| arm | field | 0% cells |
|---|---|---|
| **shipped** (recoil off, 3 Strengthened) | 36.2% | 11 |
| `recoil=2, str=1, firepct=20` - original OS + **flat** *"Fire attacks deal 20% more"* | **34.8%** | 12 |
| `recoil=2, str=1, berserk=50` - original OS + **missing-HP-scaled** Fire bonus | **40.1%** | 6 |
| `recoil=2, str=1, berserk=60` | 44.7% | 5 |
| `recoil=2, str=2, berserk=50` | 46.9% | 4 |
| `recoil=2, str=1, berserk=75` | 52.4% | 3 |
| `berserk=50` on the shipped OS (no recoil, 3 Strengthened) | **56.0%** | 3 |
| `recoil=8, str=1, berserk=50` - pay 5 HP an attack instead of 1 | **20.2%** | 19 |
| `bloodflip` - `blood_rite`'s branches swapped (heal healthy, +15 power hurt) | 35.2% | 10 |
| `swap ember_mend -> bloodlust` (the pool's unused missing-HP scaler) | 35.9% | 11 |
| `swap ember_mend -> feral_bite` (NEW 0e card: lose 8% max HP, gain 2 Strengthened) | 36.5% | 12 |
| `recoil=2, str=1, berserk=50, bloodflip` | 39.7% | 8 |
| `recoil=2, str=1, berserk=50, swap ember_mend -> bloodlust` | 40.0% | 6 |

`berserk=N` reads *"Fire attacks deal up to N% more damage, scaled by how much of your max HP is
missing"* - at N=50 that is +25% at half health, +50% at death's door. It needed hand-written
firmware: the data hooks' `MISSING_HP` scaling key resolves the **target's** missing HP, not the
owner's.

### What the numbers say

1. **The bonus has to be scaled, not flat.** Same +20% ceiling, two shapes: flat measured **-1.4**
   against the shipped build, scaled measured **+3.9**, and the scaled version halves her zero
   cells (11 -> 6). Flat damage is just a power increase and it prices in against every opponent
   equally; the scaled one pays exactly when she is hurt, which is where a 66 HP frame lives, so it
   turns hopeless cells into contests instead of making good matchups better.
2. **The recoil can come back.** `recoil=2, str=1, berserk=50` restores UNBOUND_KERNEL's original
   text word for word and still beats the shipped build (40.1% vs 36.2%). **The recoil was never
   the problem; it was unpaid.**
3. **The price cannot grow.** Raising it to 8% (5 HP an attack, enough to actually reach the
   threshold) collapses her to **20.2%** with 19 zero cells - she dies a turn and a half sooner.
   On the roster's smallest frame, a self-damage cost has to stay near-zero and the payoff has to
   come from *incoming* damage. **That is the whole reason the berserker never worked: the only
   version of the price that reaches the payoff also kills her.**
4. **Card changes do nothing on their own.** `bloodflip` behaves exactly as designed - more
   `ragnarok_edge` casts (1.93 vs 1.79), more `berserk_rush` (1.38 vs 1.22), longer games - and
   moves the field **-1.0**. The `bloodlust` and `feral_bite` swaps are +/-0.3. The deck's
   anti-berserk cards are a real design inconsistency, but they are not what was holding her win
   rate down.
5. **The new card was a dud, and the reason is section 3.** `feral_bite` (0e, lose 8% max HP, gain
   2 Strengthened) is the accelerator the kit lacks, and the AI barely plays it - a card that costs
   HP is priced by a scorer that values HP concavely. **A voluntary HP cost will not work under
   this pilot without an AI change**, which is not a fenrir-sized decision.

## 6. Recommendation

Ship **one** of these; they are the same shape at different dials, all measured:

| option | field | what it says on the tin |
|---|---|---|
| **A - faithful** | **40.1%** | *"Attack programs apply 1 Strengthened and deal 2% Max HP recoil damage. Fire attacks deal up to 50% more damage, scaled by your missing HP."* - the original OS, plus the clause that pays for it |
| B - middle | 46.9% | same, with the Strengthened at 2 |
| C - loud | 56.0% | ticket 82's OS (no recoil, 3 Strengthened) plus the scaled bonus - the strongest, and the least like the deck's original text |

**A is my recommendation**: it restores the recoil, restores the original Strengthened, sits four
points above where ticket 82 left her, and cuts her zero cells almost in half. B is the same thing
with one number moved if 40% reads too low for a deck that is meant to be a threat.

Two notes for whoever ships it:

- **`powerscale` cannot see this bonus** - it is firmware, not card data - so every Fire card in
  fenrir_v1 will be worth more than its printed score says, the same blind spot ymir_v2's Ice bonus
  has.
- `blood_rite` is still a berserk payoff running backwards, and `ember_mend` still heals 1.6 HP.
  Neither costs her the matchup, but if the deck is ever opened up, those are the two cards that do
  not believe in the deck's plan.
