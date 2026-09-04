# The top four (ticket 79): why they are strong, and what moves them

Report-only. `hel_v2`, `ymir_v2`, `nidhoggr_v1`, `nidhoggr_v2`. Baseline `6de40bd`. Instrument
`scratch/offenders.ts` - field win rate against all 31 other decks, plus payoff accessibility and
magnitude, plus an OS-off arm. Sweeps at 15 iterations (rankings); shipped values want a re-read
at 30.

**Framing per Henry: damage share does not diagnose anything.** The questions are how EASY the
payoff is to reach, how HARD it hits, and how much of the win rate is the OS rather than the deck.

## 0. The headline number: turn the OS off

| deck | live | OS off | the OS is worth |
|---|---|---|---|
| **`hel_v2`** | 81.4% | **1.8%** | **+79.6** |
| `ymir_v2` | 81.3% | 60.1% | +21.2 |
| `nidhoggr_v2` | 75.7% | 66.9% | +8.8 |
| `nidhoggr_v1` | 78.2% | 70.9% | +7.3 |

**These are four different problems, not one.** `hel_v2`'s OS is not a bonus on top of a deck - it
**is** her economy, and without it she cannot cast her own cards and collapses to 1.8%. The other
three would all still be top-eight decks with their OS deleted entirely, which means their cards
and stats are carrying most of it and an OS nerf alone cannot fix them.

*(Method note: an OS can live in two places - `hooks.json` and `CustomFirmware.ts`. Clearing only
the JSON side measured hel's healing bonus alone and measured nothing at all for ymir. Both have
to go.)*

---

## 1. `hel_v2` - 81.4%, and the payoff has no gate at all

**UNDERWORLD_GATEWAY:** Dark spells cost 5% max HP per Energy of printed cost instead of Energy,
at most 20% a turn; healing +50%.

| payoff | casts/game | first cast | damage as % of target's max HP |
|---|---|---|---|
| `soul_tithe` (3e, 90 power + draw) | **2.00** | **turn 1.8** | median **32%**, p90 43%, max 51% |
| `last_rites` (2e) | 0.60 | turn 2.1 | median 17%, p90 26% |

She plays **3.85 cards a turn** and wins in **3.4 turns** - the fastest clock in the game.

**There is no gate.** `soul_tithe` costs 15% of her max HP, which is inside the 20% turn budget, so
it is castable on turn one and every turn after. Her 2 Energy is untouched and pays for her Light
cards. The +50% healing then refunds the blood: `dawnstrike` heals 20 power at 1.5x, `pale_mercy`
14 at 1.5x. **The blood price is not a cost, it is a loan she repays with her own cards.**

### Knobs (live 80.7% at this sample)

| knob | field | note |
|---|---|---|
| **blood price 5% -> 6% per Energy** | **67.6%** | **-13.1.** Preserves the shape exactly - she still casts everything with blood, it just costs more. `soul_tithe` goes 15% -> 18%, still under the cap. |
| healing 1.5 -> 1.0 | 69.7% | removes a stated third of the OS text |
| healing 1.5 -> 1.25 | 72.6% | |
| turn cap 20% -> 15% | **80.3%** | **inert.** `soul_tithe` costs exactly 15%, so it still casts; only her rare second Dark card is blocked. |
| attack 95 -> 80 | 67.3% | |
| defense 60 -> 48 | 67.0% | |
| HP 80 -> 68 | 71.8% | note her costs are %-denominated, so this cuts her clock, not her economy |

**Recommendation: blood price 5% -> 6%.** It is the only knob that prices the thing that is
actually mispriced, and it leaves every card, the deck list and the OS concept untouched. The cap
is worth deleting from the list - it does not bind at any value that keeps her shape.

---

## 2. `ymir_v2` - 81.3%, and its drawback was already known to be inert

**GLACIAL_PACE_OS:** at most 2 cards a turn, but Ice cards deal +25% base damage. Her deck is all
Ice, so the bonus is unconditional.

`CustomFirmware.ts` already says this, from ticket 50: *"the `maxCardsPerTurn: 2` drawback that was
meant to pay for it is INERT: at 2 Energy with no 0-cost cards the most Ymir can play in a turn is
already 2, so the cap never binds."* The bonus has been walked **50% -> 35% -> 25%** across three
tickets and she is still the joint-strongest deck.

**Measured: she plays 1.06 cards a turn.** The cap is set at 2 and she cannot reach 2. It has never
done anything.

| payoff | casts/game | first cast | damage as % of target's max HP |
|---|---|---|---|
| `glacial_maul` (2e, flat 65 power) | 2.55 | turn 2.1 | median 30%, p90 40%, max 52% |

No condition, no setup, no gate - it is a vanilla 2-cost attack that hits for a third of a health
bar because the OS silently adds 25% and **`powerscale` cannot see firmware**, so every Ice card in
this deck is worth 25% more than its printed score.

### Knobs

| knob | field | cards/turn | note |
|---|---|---|---|
| **max 1 card a turn** | **65.9%** | 0.81 | **-15.4.** Makes the drawback real for the first time. She was averaging 1.06, so this barely changes what she *does* - it removes her occasional two-card turn. |
| Ice bonus 0.25 -> 0.10 | 66.3% | 1.09 | continues a walk that has already failed twice |
| Ice bonus 0.25 -> 0.15 | 71.3% | 1.08 | |
| Ice bonus -> 0 | 60.4% | 1.11 | |
| attack 95 -> 80 | 68.5% | | |
| defense 85 -> 72 | 70.9% | | |
| HP 120 -> 104 | 77.2% | | weakest lever; her 120 frame is the roster's largest |

**Recommendation: make the drawback bite - `maxCardsPerTurn` 2 -> 1 - rather than shaving the bonus
a fourth time.** It restores the trade the OS was designed around ("slow but heavy") instead of
eroding the half that works. -15.4 points for a change that alters her actual play by a quarter of
a card a turn.

---

## 3. `nidhoggr_v1` - 78.2%, and the OS knob does not work

**ROOT_CORRUPTION:** Poison on her enemies does not decay.

| payoff | casts/game | first cast | damage as % of target's max HP |
|---|---|---|---|
| `wither_feast` (2e, triggers Poison 5x then consumes) | **0.63** | **turn 4.4** | median **39%**, p90 56%, max 68% |
| `blight_bloom` (2e, 50 power + 2 Poison) | 1.91 | turn 2.3 | median 20%, p90 26% |

**This is what a healthy payoff deck looks like on the accessibility axis** - `wither_feast` lands
once every other game, on turn 4-5, after real setup. The problem is purely magnitude: **39% of a
health bar median, 68% max.**

### Knobs

| knob | field | note |
|---|---|---|
| ROOT requires >= 2 stacks | 76.7% | |
| ROOT requires >= 3 stacks | 76.3% | |
| ROOT requires >= 4 stacks | 75.3% | |
| HP 105 -> 90 | 72.7% | |
| attack 100 -> 85 | 72.3% | |
| **defense 80 -> 68** | **67.0%** | **-11.2**, and it halves her blowouts: 13 cells >90% down to 6 |

**The OS condition I tested is the wrong shape and I would not ship any of it.** `minStacks` gates
maintenance on the pile being *large*, so it triggers **more** in the late game, not less - exactly
backwards. Her deck applies Poison fast enough (`rot_seed` x2 at 0e, `venom_shade` x2, `curse_mark`,
`blight_bloom` x2) that the pile clears any threshold within two turns.

**The OS knob worth building is a MAXIMUM, not a minimum**: stop maintaining the pile once it is
already big, so ROOT_CORRUPTION keeps a small poison alive - which is the flavour - without
underwriting an unbounded one. The hook schema has `minStacks` and no `maxStacks`; that is a small
`HookSchema` addition, and I would rather add it than ship a stat change on a deck whose OS is the
real engine.

**Interim recommendation if you want a number now: defense 80 -> 68.** But the OS fix is the honest
one, and it needs the schema field first.

---

## 4. `nidhoggr_v2` - 75.7%, and my self-loop hypothesis was wrong

**BLOOD_SCENT_OS:** whenever *any* Mingming drops below half max HP, gain 1 Energy and draw a card.
Healing above half re-arms it.

The hook has **no `when` clause at all**, so it fires on her own crossings as well as the
opponent's - and her deck self-damages on purpose (`bloodletting` x2, 0e, "18 power, add 2 Poison
to yourself"). I expected a self-triggering loop: poison herself under the line, collect, heal back
with `umbral_feast`/`leech_strike`, repeat.

**Measured: she crosses below half 1.01 times a game.** There is no loop. The OS fires about twice
a game - once on her, once on the opponent - and is still worth +8.8 points.

| payoff | casts/game | first cast | damage as % of target's max HP |
|---|---|---|---|
| `rend_marrow` (2e, 40 power, **+35 if the target is below half**) | 2.21 | turn 2.9 | median 19%, p90 35%, max 43% |
| `leech_strike` (2e, 40 power, heal 30) | 2.29 | turn 2.2 | median 14%, p90 20% |

Note the synergy the numbers show: BLOOD_SCENT and `rend_marrow` read the **same threshold**, so
the turn the opponent drops below half she gets an Energy, a card, and a +35-power attack at once.

### Knobs

| knob | field | note |
|---|---|---|
| **drop the DRAW, keep the Energy** | **67.7%** | **-8.0.** The draw is worth more than the Energy. |
| defense 80 -> 68 | 67.3% | |
| fire only on the OPPONENT crossing | 71.1% | removes her own crossing - smaller than expected, per the 1.01/game measurement |
| drop the ENERGY, keep the draw | 73.0% | |
| HP 105 -> 90 | 73.3% | |
| **attack 100 -> 85** | **61.4%** | the single biggest lever on any of the four |

**Recommendation: drop the draw from BLOOD_SCENT.** It is Henry's "hits less hard when it triggers"
shape, it keeps the flavour intact (she still smells blood and gets the Energy), and it is the
larger of the two halves. `oppsonly` is tempting for tidiness - a hook with no `when` looks like an
oversight - but it is worth only 4.6 points and it removes the interaction with `bloodletting` that
the deck was built around.

---

## 5. Summary of what I would do

| deck | first choice | field | why |
|---|---|---|---|
| `hel_v2` | blood price 5% -> **6%** per Energy | 80.7 -> **67.6** | prices the thing that is mispriced; shape untouched |
| `ymir_v2` | `maxCardsPerTurn` 2 -> **1** | 81.3 -> **65.9** | makes an inert drawback real instead of shaving the bonus a 4th time |
| `nidhoggr_v2` | BLOOD_SCENT drops the **draw** | 75.7 -> **67.7** | keeps the trigger and the flavour, halves the payout |
| `nidhoggr_v1` | **build `maxStacks`** on the hook, then cap the maintained pile | - | the minStacks knob is backwards; defense 80->68 (67.0%) is the interim |

Three of the four land in the high sixties, which is inside the 0.35-0.80 field band and roughly
where `hraesvelgr_v2` and `valkyrie_v2` sit now. None of them requires touching a card.

**Two things that are not knobs but should be said:**

1. **`powerscale` cannot see firmware.** Every Ice card in `ymir_v2` is worth 25% more than its
   printed score, and nothing in the card audit knows. The same is true of any OS that multiplies
   damage. That is a scorer gap, not a ymir problem.
2. **`wither_feast` prices at -10.8 statically and measures 13.1.** Any repricing pass on
   `nidhoggr_v1` will get her wrong until that is fixed - the scorer currently believes her best
   card is the worst in the game.

## 6. What I did not do

Ship anything. These are rankings at 15 iterations; the pick wants a re-read at 30, a full
`npm run balance` 8-DIFF and a deck-grid re-run before it goes in - and all four of these decks are
in the top eight, so the roster-wide diff matters more than usual here.
