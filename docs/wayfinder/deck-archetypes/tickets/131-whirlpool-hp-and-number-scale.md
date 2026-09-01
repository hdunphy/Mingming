# Ticket 131 — the whirlpool ruling fails, HP is the right lever, and the numbers are too small to tune

Henry, 2026-09-01. Three rulings tested and one design question answered.

---

## 1. Whirlpool — I owed you a field test, and both ruled shapes fail

Henry: *"Did you test the whirlpool? I like the dazed + draw 2, but that feeds the payoff."*

**No, I had not — I priced it at 2.8 and recommended it off the score alone.** That was the wrong
call and the field says so loudly. All six arms, `kraken_v1` field at 1v1 (30 cells x 10) and the
control panel vs zoo panel at 3v3 (12 games):

| arm | score | 1v1 field | 3v3 |
|---|---|---|---|
| SHIPPED — 8 power, draw 1 | 2.2 | 52.50 | 66.67 |
| **DAZED1 — 8 power, draw 1, +1 Dazed** | **2.7** | 56.50 | **75.00** |
| POWER15 — 15 power, draw 1 | 2.9 | 56.50 | 83.33 |
| SIDEDAZED — 8 power, draw 1, 1 Dazed to side | 4.2 | 56.33 | 91.67 |
| **RULED — draw 2, 1 Dazed, no power** | 2.8 | **85.67** | 83.33 |
| **RULED_DAZED2 — draw 1, 2 Dazed, no power** | 2.4 | 56.50 | **91.67** |

**Both shapes you ruled break, and they break at opposite widths.**

**`draw 2` is broken at 1v1: 85.67% field, +33 points on a deck that was at 52.50.** The scorer
priced it mid-band at 2.8 and it is worth eight times what the other in-band buffs are worth
(+4 each). Two copies of a 1e card that draws 2 is net +1 card each, and `kraken_v1` runs two of
them — the deck stops having a card economy and starts having an engine. **`DRAW: 15` power in
`powerscale`'s utility table is badly under-pricing the second card**, which is a scorer finding in
its own right: nothing in the 1e band should be able to move a field 33 points.

**`2 Dazed` is broken at 3v3: 91.67%, level with the side-wide arm I already told you to avoid.**
And your instinct named the mechanism exactly. Dazed is not just a debuff — in
`calculateDamage`, `statusPower = powerPerStack x ((Str - Weak) + (Dazed_target - Sharp_target))` is
added to power **before** the divisor, so **every stack of Dazed on a target amplifies every attack
anyone makes into it.** At 3v3 the control panel already generates Dazed from `kraken_v1`'s
side-wide OS (ticket 116) and from `rimefrost`; doubling whirlpool's contribution compounds into the
same pile. "That feeds the payoff" was right and it feeds more than `pressure_point`.

**The measured answer is the opposite of the ruling: keep the power, add exactly one Dazed.**
`DAZED1` scores 2.7 (dead centre of the 1e band) and is the *only* arm that stays under 80% at 3v3.
The 8 power is the least inflationary part of the card — the draw and the Dazed are what compound.

---

## 2. Feedback loop — ruling recorded

**1e, proc power 7, owner-gated.** Henry: *"we already learned our lesson that per side OS's are too
OP. You add in a zoo draw deck and it become unbeatable."* The `source: SELF` → `ALLY` option from
ticket 129 is **rejected**, and the reasoning generalises: at 3v3 a side-wide trigger on a shared
deck multiplies by party size, and a deck built to feed it multiplies again. Ticket 128's sixteen
`source: SELF` firmwares should be read as a feature, not a bug, on this ruling.

Turn-by-turn at power 7 (measured 0.75 per-unit triggered draws/turn, 5-turn side, x1.5 premium):
T1 3.9 · **T2 3.1** · T3 2.4 · T4 1.6, against a 1e band of 2.4–3.0.

---

## 3. HP buff — it does what you want, and it is a different lever from draw

Henry: *"Maybe we give everyone a flat HP buff to extend games ... its tough to get out combos with
only 3 cards and no drawing."*

| arm | turns/battle (zoo / control) | energy unspent (zoo / control) | cards cast per turn (zoo) |
|---|---|---|---|
| baseline | 5.2 / 4.5 | 22.9% / 19.3% | 5.77 |
| +25% HP | 5.3 / 5.8 | 15.7% / 12.5% | 6.41 |
| **+50% HP** | **7.7 / 5.8** | 15.5% / 17.4% | 5.63 |
| +1 draw | 3.8 / 4.3 | 11.5% / 9.6% | 7.09 |
| **+1 draw AND +50% HP** | **7.5 / 5.3** | **13.8% / 9.9%** | 5.82 |

**They are genuinely different medicines and the diagnosis matters:**

- **+1 draw** gives more cards *per turn* (5.77 → 7.09) and fixes the leftover energy (22.9% →
  11.5%) — but shortens the game (5.2 → 3.8 turns), which is what you disliked.
- **+50% HP** leaves cards per turn alone (5.77 → 5.63) and buys **turns** (5.2 → 7.7). It does not
  fix leftover energy on its own — the zoo drop is real, the control panel barely moves.
- **Together**: turns 7.5 / 5.3, *longer than baseline*, with leftover energy nearly halved. **That
  combination is the only arm that fixes both complaints at once.**

So the honest split of your sentence: the HP buff answers *"tough to get out combos"* (more turns =
the deck is drawn deeper over a battle), and it does **not** answer *"leaving energy on the table"*,
which is a per-turn fact only more draw can move.

**The hand limit still binds** in the combined arm — 35.9% / 53.8% of refills clipped, losing ~1.0–1.6
cards. `HAND_SIZE_LIMIT` still needs raising in **both** places (`deckLogic.ts` and
`effectHandlers.ts` — see ticket 129).

**Caveat: 3 battles a panel.** The turn counts are the noisiest column here and the direction is
consistent across every arm, but the magnitudes want a bigger run before they are quoted.

---

## 4. Scaling every number — yes, and the reason is better than feel

Henry: *"should we scale all our numbers by 10 or even 5. Bigger numbers often feel better."*

**Nobody had written down what the numbers actually are. They are tiny** (`scratch/numberfeel.ts`,
136 attack cards at the balance frame, 73–80 HP):

```
min 0   p25 2   MEDIAN 4   p75 7   max 32
62 of 136 attack cards read 3 damage or LESS.  pollen_cloud reads 0.
```

The median hit is **5.0% of a health bar** and reads as the number **4**.

**The feel argument is real, but the resolution argument is stronger.** Damage ends in
`Math.floor`, so at a median of 4 the rounding is eating a large fraction of every balance change: a
card at 2 damage and a card at 3 damage differ by 50% and there is nothing between them. Half the
attack pool lives in a range where the engine cannot express a small tuning step at all. **Scaling
x10 does not just look better, it gives every knob in the game one more significant figure.**

### How, and it is one line plus a data change

```ts
const reduced = scaled / 45;      // combatUtils.calculateDamage
```

**Change the divisor 45 → 4.5, and multiply base HP by 10.** That is the whole of it, because almost
everything else in the game is denominated in *power* or in *% of maxHp*, not in displayed damage:

- **card `power` values: unchanged.** The divisor's own comment already says it "moves absolute pace
  only ... relative card economics are untouched".
- **status stacks: unchanged.** `statusPower` is added *before* the divisor, so a stack keeps its
  exact relative worth.
- **heals: automatic.** `calculateHeal` is `maxHp x power / 400` — a percentage, so it scales itself.
- **Burn/Poison tiers: automatic.** They are `damagePercent` of maxHp.
- **`powerscale` bands, the whole rev-3 curve: unchanged.**

### The five things that must move with it

1. **`damageOverride` on three cards** — `desperate_strike`, `glass_cannon`, `dark_pact`. Flat HP, x10.
2. **`ASSUMED_MAX_HP = 75` → 750** in `powerscale` (prices those same three).
3. **`TERMINAL_SCORE = 10000` in `TacticalAI` — this is the one that breaks silently.** Its comment
   says it is "deliberately far above any reachable board score — a full 200 HP frame with every buff
   is worth a few hundred". At x10 HP a frame is worth a few *thousand*, and 10000 stops dominating.
   The AI would quietly stop treating winning as strictly better than a good board.
4. **A save migration.** Stored HP is an absolute number.
5. **Both halves must ship together.** Divisor without HP is a 10x lethal game; HP without divisor is
   a 10x tankier one. This is not a change that can land in two commits.

### x5 or x10

| | median hit | biggest hit | frame |
|---|---|---|---|
| today | 4 | 32 | 73–80 |
| **x5** | 20 | 160 | 365–400 |
| **x10** | 40 | 320 | 730–800 |

You said *"400 might feel better than 40"*. x10 puts the **frame** near 750 and the biggest hits near
320; x5 puts the frame near 400. If the number you want to feel big is the health bar, x5 already
gets you there; if it is the damage float, x10 does. **x10 is also the one that buys the full extra
significant figure**, which is the argument I would actually spend the migration on.
