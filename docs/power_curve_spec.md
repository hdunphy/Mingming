# Mingming Power Curve Spec (rev 3 — corrected after code review, 2026-08-05)

Everything below was decided in the grilling sessions on Aug 4–5, then checked against the real
engine code and card registry on Aug 5 — two numbers didn't survive contact with the data (3e
budget, heal/shield price) and got corrected below. Nothing is implemented yet as of this revision;
implementation follows immediately after.

## The unit

All costs are in **power**. Conversions (level-proof by design):

- 1 energy = 40 power
- 1% of target maxHP as damage = 3 power
- 1% of maxHP as healing or shield = 4 power (rev 2 had this at 2 power — cheaper than damage per
  %HP, which was backwards: a fixed power budget should buy *less* %HP from healing than from
  damage, since healing doesn't advance the win condition the way damage does. Corrected so heal is
  now the more expensive of the two per %.)

## Engine changes required

1. **calculateDamage** — remove the flat `+2`, change divisor `/50` → `/35` (keeps a 1e-40 dealing the same ~7–10 damage at L10, so pacing is preserved). **Superseded by rev 3.1 — the divisor is now `/45`; see the amendment at the end of this file.** Damage floor stays at **0** (the existing `Math.max(0, damage)`): attacks *can* deal nothing — a tanky Mingming with Sharp stacks shrugging off hits is a feature, not a bug. *Why the +2 goes: it was paid per hit, making small/multi hits secretly stronger, and its value shrank with level — card economics drifted as units leveled.*
2. **calculateHeal** — replace with `maxHp × power / 400` (1 power heals 0.25% maxHP, matching the corrected 4-power-per-1% price above). Drop attack scaling and the flat +2. *Why: healing was ~18× damage per power point (natures_touch healed 47 HP at L10 for 1 energy).* LightStance ×1.5 stays on top.
3. **Burn** — decays 1 stack/turn (was permanent). Keeps tiers 2/5/12% maxHP + def shred + overflow burst.
4. **Regen** — heals 3% maxHP per stack per turn (was flat 5 HP).
5. **BarkShield** — shield is % of maxHP (was flat points). Same 20%/turn decay.
6. Data: **reprogram** 1e → 2e; **feedback_loop** daemon 10 → ~7 power per draw.

## Damage curve

| cost | budget (power) |
|---|---|
| 0e | 10 |
| 1e | 40 |
| 2e | 90 |
| 3e | 140 |
| 4e | 190 |

Rule: **50 × energy − 10** (rev 2 had 3e at 150, which the rule itself doesn't produce — 50×3−10=140.
Every other point already matched the rule; 150 was the typo, not the rule). With the +2 gone, this
is a super-linear premium that grows with cost — a 2e card is worth +12.5% over two 1e cards, a 3e
card +16.7% over three 1e cards, a 4e card +18.75% over four 1e cards — identical at every level.

- **Multi-hit:** no surcharge — N hits price at total printed power (thistle_barrage 10×4 = 40 = fair 1e).
- **Side AOE:** budget = 2.2 × power (cyclone 25 → 40; tidal_wave ~65–70).
- **Combining:** sum of parts ≤ budget. Conditional effects ×0.7. Example: 2e with 60 damage has 30 power of rider room.

## Status prices (per stack unless noted)

| effect | price (power) | notes |
|---|---|---|
| Strengthened / Dazed | 15 | 2%/stack, 25% cap; offense stream |
| Weakened / Sharp | 10 | 2%/stack, 25% cap; defense stream |
| Burn 1 / 2 / 3 | 6 / 21 / 60 | decaying, tiers 2/5/12%; overflow = 36/excess stack |
| Poison (S stacks) | 1.5·S·(S+1) | 9 / 18 / 30 / 45 / 63 at S=2–6 |
| Stunned | 55 | one denied enemy turn |
| Asleep | 45 | sets 3, breaks on damage |
| Regen (S stacks) | ~3·S·(S+1) | 3% maxHP/stack/turn decaying |
| Shield | 4 per 1% maxHP | 1e shield card = 10% maxHP |
| Energized | 35 | +1 energy next turn |
| Energy (immediate) | 40 | |
| Draw | 15 / 10 / 5 | 1st / 2nd / 3rd+ on one card |

Pure-status stacks per cost (%-statuses): 1e = 2–3 offensive or 4 defensive; 2e = 6/9; 3e = 10/12 (12 = the whole cap → redline).

**Cap mechanism, decided:** the 25% cap clamps the *damage multiplier*, not the raw stack count —
`pct = min(0.25, stacks × 0.02)`. Stacks themselves are stored and keep accumulating without limit,
so cards that read stack count directly (fenrir_v1's Strengthened-doubler, anything with a
`STATUS_COUNT` scaling) still have something real to scale off of past the point where the damage
effect itself has capped out. Capping the raw stack count instead was rejected: 25%/2% = 12.5,
which doesn't even land on a whole stack, and it would flatten those stack-reading synergies right
when they'd otherwise start to matter.

Confirms the "offense costs more than defense" split (15 vs 10) stays as designed. Note for the
record: since both streams share the same 2%/stack rate and the same 25% cap, defense-stream stacks
(Weakened/Sharp) still reach that cap for less energy than offense-stream (Strengthened/Dazed) — about
3.1e worth of power fully caps a defense stat vs. 4.7e for offense. That's fine: the cap is what
prevents the old mirror-deadlock regardless of price, so the price differential is purely a
deck-building-economy choice, not a safety mechanism.

## Daemons

Budget = **per-turn value × 4** (break-even by turn 4; skip in routs, profit turn 5+; targets Henry's 75–85% play rate — verify against balance_report.json average turn counts after implementation).

- harden (1e, Sharp/turn = 10 → 40): exactly on curve
- fertile_ground (2e, draw/turn = 15 → 60): buff
- feedback_loop (2e): nerf to ~7 power/draw
- echo_chamber / cinder_armor (2e): slightly under, archetype-dependent — fine
- battery_pack (4e, 40/turn → 160/190): fine (uncastable without ramp)
- fenrir_v1 (3e, doubles Strengthened): manual watch

## Exotics — verdicts

- heat_wave (2e): fair after Burn rework
- contagion (3e): slightly under — consider "double + 1"
- toxic_surge (1e): fair scaler (free tick doesn't decrement — known quirk)
- scavenge_data (1e tutor ≈ 25): → 0e or add a rider
- purify, aegis (1e): fair
- nightfall_edge / dawns_respite: SHIFT_STANCE ≈ 15 enabler; stance multipliers balanced later in an Equinox pass
- reprogram: → 2e, replay-anything kept; sims watch the 3e-replay combo

## Content pass shopping list

Rescale ~36 %-status appliers to the 2%/stack world (mostly 1→2–3 stacks). Buff: ignite, corrosive_bolt (→P4–5), cyclone (→40), tidal_wave (→65–70), fertile_ground, contagion, scavenge_data, entangle (redesign). Nerf/move: flash_freeze (→2e or self-downside), capacitor (E2 = 70 on a 40 budget), feedback_loop, reprogram (→2e). Heal cards re-numbered for the % world (natures_touch 15→40 etc.). Vanilla attacks to 40/90/150.

## Known engine facts recorded on the way

- Base energy is 2 (only ratatoskr/audhumbla have 3); 3e+ cards are ramp payoffs.
- Poison's `getScaledStacks` (attack × power scaling) is dead code — the STATUS pipeline never passes `power`. Delete or implement deliberately.
- powerscale.ts bugs, confirmed against real card data, fixed in the rewrite: `action.target: 'TARGET'` (meaning "aimed at the opposing side") shadows `card.target: 'Side'/'All'` (meaning how much of that side) — every AOE card (`cyclone`, `tidal_wave_v2`, `entangle`, `heat_wave`) was scored as single-target. Fix separates the two axes: `action.target === 'SELF'` still means self (glass_cannon's recoil sub-action correctly flips negative), anything else defers to `card.target` for the count multiplier. Separately, `MULTIPLY_STATUS`/`CLEANSE`/`SEARCH`/`PLAY_LAST_CARD`/`TRIGGER_STATUS` all fall through the action-type branch scoring **0** today — that's `contagion`, `purify`, `scavenge_data`, `reprogram`, half of `toxic_surge`. `SHIFT_STANCE` and `MULTIPLY_STATUS` get real heuristic scores in the rewrite (using this doc's own ≈15-power stance value and a doubled-stack-count estimate, respectively); `CLEANSE`/`SEARCH`/`PLAY_LAST_CARD`/`TRIGGER_STATUS` get an explicit `manualReview` flag instead of a silent 0, since pricing them generically isn't honest (their value depends on board state a static formula can't see) — matches why `purify`/`aegis`/`scavenge_data`'s verdicts above were already hand-judged rather than formula-derived.
- Pacing at the locked numbers: rout 2–3 turns, even 3–4, hard 7, boss 11–13 (targets: 3 and 10–12). Enemy HP is the pacing knob, not the curve.

## rev 3.1 — pace amendment (ticket 23, 2026-08-06)

**`calculateDamage` divisor `/35` → `/45`.** One constant. No card price changes.

rev 3 chose `/35` to *preserve* the pace the old `/50 + 2` formula produced. Preserving it
was the mistake: at that pace a single full turn removed **60–70% of a health pool**, so
even matchups resolved in **3–4.5 turns**. That is not enough turns for a game to happen in.
Anything that wins by building — poison attrition, momentum stacking, a discard windmill —
was dead on arrival, because the game ended before its second payoff ever landed. The deck
passes kept discovering this one archetype at a time.

A/B simulation across the registry showed slowing damage ~22–30% moves even matchups to
**~5.5–6.5 turns** while element- and level-advantage routs still close in **~3**, and FTK
stays at 0 — a first-turn kill now needs a perfect setup rather than an ordinary curve-out.
`/45` is that ~22% slowdown.

**Card budgets and prices are unchanged, and that is not an oversight.** A global divisor
scales every card by the same factor, so it moves *absolute* pace only; the rev-3 budget
bands, the 1e = 40 power unit, and every relative card economics decision survive it intact.
The one thing a longer game does change is the *value* of slow-build archetypes relative to
burst ones — which is the entire point of the amendment, and shows up as jormungandr's §2.3
swinging toward its attrition variant.

## rev 3.2 — curve re-price (ticket 24, 2026-08-07)

**Damage curve `50E−10` → `10 / 35 / 75 / 120`.** Budget bands move with it:
`BUDGET_BANDS` 1.0 / 4.0 / 9.0 / 14.0 → **1.0 / 3.5 / 7.5 / 12.0**.

rev 3.1 slowed the game by dividing damage globally. This does the other half: the curve
itself was calibrated to ~3-turn games. Measured at the balance frame, damage ≈ 0.30 ×
power and a health pool ≈ 79 HP ≈ 263 power, so a deck spending both its Energy on 1e
damage removed 80 power ≈ 31% of a pool per turn. Sleipnir landed exactly there (28.6%,
3.17 turns). 10/35/75/120 measures at **5.3 turns average across the tuned species, minimum
3.7, FTK 0** — the 5–6 target with a 3–4 floor.

**The power UNIT is unchanged and the per-status prices are deliberately NOT rescaled.**
A point of power still buys the same fraction of a health pool: cards carry less power, so
they deal proportionally less damage, and the "1% maxHP = 3 power" conversion still holds.
Only the *budget* per Energy moved. Rescaling the status prices as well would have
double-counted the change.

### Two findings from the A/B, both worth keeping

**1. An exponential curve is incompatible with a turn-count floor.** `5+10E²`
(5/15/45/95) and `5+10E^1.5` (5/15/33/57) were both measured. Every v1 deck in the
registry lost **0/100**, and mirrors ran 10–19 turns. The shape cuts 1e by 62% while
cutting 3e by only 32%, so cheap decks collapse and expensive decks win everything — the
*ramp* deck becomes the fastest deck, which is backwards from a minimum turn count. This is
structural to the shape, not the constants; do not revisit without changing the Energy
ceiling.

**2. A global curve change under ~20% is invisible to status cards.** Status is quantised
in whole stacks: at a 0.875 ratio, `corrosive_bolt`'s 4 Poison stacks round straight back
to 4. Across the whole registry only **5 status stacks** changed. Attack cards take the
full cut, status cards take none, so any small curve cut systematically favours status
decks — jormungandr's §2.3 fell 0.33 → 0.04 on the re-price alone, and the smallest
available stack step (4→3, a 25% cut against the curve's 12.5%) only recovered it to 0.11.
Status decks must be re-gated by hand after any curve move, and buffing the attack side is
usually the finer instrument.

## rev 3.3 — pace completion (ticket 25, 2026-08-07)

**Curve `10/35/75/120` → `10/30/65/105`.** Bands 1.0/3.5/7.5/12.0 → **1.0/3.0/6.5/10.5**.

rev 3.2 landed the tuned-species average at 4.73 turns — the 3-4 floor was on spec but the
average sat ~0.3 short of the 5-6 target. This is the last ~14%. Measured after re-gate:
kraken mirror 5.1, jormungandr 6.6, sleipnir 4.4 — **average 5.4, floor 4.2, FTK 0**.

Re-gate needed (the 1e band takes a slightly harder cut than 3e, which favours the big-card
OS): kraken fell to 0.28, fixed with TIDAL_CRUSH 1.2 → **1.15** and `ink_stream` 11 → **12**.
`ink_stream` is a CARDS_DRAWN scaler and correspondingly twitchy — 13 overshot to 0.65 and
pulled the mirror back to 4.9 turns; 12 is the seat.

## rev 3.4 — pricing corrections (ticket 28) and the status top-up (ticket 29, 2026-08-07)

**The curve constants did not move.** `10 / 30 / 65 / 105`, bands `1.0 / 3.0 / 6.5 / 10.5`,
unchanged from rev 3.3. What changed is *what the model charges for* — five places where
powerscale was billing a card for value the engine never delivers, or failing to bill it for
a cost the engine does.

### 1. Mutually exclusive branches are scored `max()`, not `sum()`

A card whose two `HEALTH_THRESHOLD` branches are complementary (`GT:50` / `LT:51`) resolves
exactly ONE of them, never both. Each branch was taking the 0.7 condition discount and the
two were then summed — a **1.4× charge for something worth 1.0×**. `blood_rite` scored 4.40
against a 3.00 cap while measuring at *under* a 1e card's damage rate.

Narrow by construction. Only paired GT/LT `HEALTH_THRESHOLD` conditionals on the same target
group. A lone conditional (`berserk_rush`'s "+17 below 50%") has nothing to be exclusive
*with*. Non-threshold conditionals that stack on an unconditional base — `molten_core`'s
`self_sharp` — keep summing, which is correct for them. The 0.7 discount stays on the
surviving branch: you always get one half, but you do not choose which.

### 2. `damageOverride` is literal HP, not curve power

It bypasses `calculateDamage` entirely. `desperate_strike`'s 10 HP self-hit is 13% of a 75 HP
pool — 40 power at the spec's 3-power-per-1%-maxHP rate — and was being scored as `power: 10`,
a **4× under-charge on the one term meant to make the card cost something**. Priced now
against `ASSUMED_MAX_HP = 75`. Affects `desperate_strike`, `glass_cannon`, `dark_pact`.

### 3. Stream statuses re-priced: Strengthened/Dazed **15 → 5**, Weakened/Sharp **10 → 3.5**

The old prices were never derived. A 2%/stack damage modifier is worth 2% of the damage you
have LEFT to deal: a pool is ~263 power, so a stack landed turn 1 is worth `0.02 × 263 = 5.3`
power and one landed mid-fight about half that. Measured independently: 1 Strengthened on
fenrir_v1 was worth **+1.1 HP across a whole game**, i.e. 3.7 power. 5 is the generous end of
that range; 3.5 holds the old 1.5:1 offense:defense ratio.

This is why `desperate_strike` existed: 1.35 score of upside for a self-hit the model also
under-charged, so a card costing 13% of a health pool to gain ~1 HP of damage scored
comfortably UNDER its 0-cost cap.

### 4. Priced stacks are capped at the engine's cap

`Hooks.ts` applies 2%/stack to a **net cap of 25%**, so the 13th stack and everything after it
changes nothing — but the price was linear and uncapped. The model would charge 10.0 for 20
stacks that deliver exactly what 13 do. Any card designed against the uncapped price is paying
for stacks the engine throws away.

### 5. What this implies for design — read this before pricing a status card

At the honest price, **a pure 2%/stack status card cannot fill a 2e budget without running
into the 25% cap.** 6.5 score at 5 power/stack is 13 stacks, which IS the cap. A 3e pure-status
card is impossible. Statuses have to be paired with damage, draw, or scope (the Side ×2.2
multiplier) to reach curve — or the status itself has to be worth more than 2%/stack. That is
a live design question, deliberately left open.

### Ticket 29: the top-up

Ticket 28 left 32 stream-status cards reading under budget. Ticket 29 brings 21 of them back to
curve — raising attack power where the card already had an attack, raising stacks where the
status IS the card. Stack counts get noticeably larger as a result (`cold_snap` 2 → 8 Weakened,
`shield_shards` 2 → 9 Sharp): that is the honest consequence of pricing a 2%/stack effect at 3.5
power, and it changes the *texture* of status numbers across the registry.

**Eleven cards were deliberately NOT topped up, and must not be "fixed" without thought:**

- **Model blind spots** — `scry`, `keen_edge`, `soothe`, `spiked_carapace`, `equilibrium`,
  `acid_splash`, `curse_mark`. Their score is dominated by an action powerscale prices at
  **zero** (DRAW, CLEANSE, SEARCH, shields). The gap is the model failing to see the card, not
  the card being weak. Buffing to "curve" here buffs straight past it.
- **Drawback cards** — `desperate_strike`, `dark_pact`, `all_in`, `reckless_charge`,
  `glass_cannon`. Under budget because the self-harm is now priced honestly. Whether they get
  compensating power is a design call, not a mechanical top-up.

**A known blind spot with no fix in the model:** powerscale is per-card static analysis with no
deck or OS context, so it cannot see that a conditional is *guaranteed* by the deck's own OS.
`brute_force` takes the 0.7 discount on `+22 power if you have Strength` while skoll_v1's
TREACHERY_KERNEL grants Strengthened every time skoll is hit — the condition is near-certain,
and the card measures at **33 damage per play against a 19.5 rate for its cost**. Conditionals
that an OS makes free need manual review; the auditor will never flag them.

## rev 3.5 — the status question, answered by NOT moving the percentage (ticket 30)

The rev-3.4 note left an open design question: at the honest price, a pure 2%/stack status
card cannot fill a 2e budget without hitting the 25% cap, so either statuses get stronger or
status cards always need a rider. Ticket 29 took the "leave the percentage, pile on stacks"
branch and produced `cold_snap` at 8 Weakened and `shield_shards` at 9 Sharp — numbers that
stopped meaning anything to a reader.

**Raising the percentage was modelled and rejected.** 4.5%/stack lands exactly on a legible
stack ladder (1 / 2-3 / 5-6 / 8-9 for 0-3e) and it is arithmetically correct. It fails for two
reasons that have nothing to do with the arithmetic:

1. **It shrinks the cap in stack terms.** The 25% cap is 12.5 stacks at 2% but only 5.6 at
   4.5%. Every headroom decision above a 2e budget gets tighter, not looser.
2. **It is a silent, uncosted buff to 13 OS and daemon hooks.** `skoll_v1`, `sleipnir_v1`,
   `draugr_v1`, `nidhoggr_v2`, `kraken_v1`, `fenrir_v1`, `fenrir_v2`, `huldra_v1`,
   `ratatoskr_v2`, `ymir_v1`, `cinder_armor_daemon`, `defensive_daemon` all grant 1-3 stacks
   as their whole payload. Changing the per-stack value multiplies every one of them by 2.25x,
   and **none of it passes through powerscale** — firmware is not card data and is never
   audited. A change that reprices half the firmware in the game while the auditor reports
   nothing is not a pricing fix.

**The percentage stays at 2% and the cap stays at 25%.** The fix is on the CARDS: a status
card that cannot fill its budget on stacks should spend the rest on a second effect. That is
also the better design outcome — it buys variety instead of bigger numbers.

### Riders are cheaper than you think

The palette, all already priced: ATTACK 10 power = 1.0 score, HEAL 10 power = 0.75, **DRAW 15
power per card**, **ENERGY 20 power per point**, Poison `1.5 x S x (S+1)`, BarkShield 4 power
per %maxHP, Stunned 55. A 1e card carrying 2 Weakened (0.70) has 2.3 score of room — which is
one card of draw plus 8 power of attack, not six more stacks.

### Correction to rev 3.4's "model blind spot" list

Ticket 29 listed `scry`, `keen_edge`, `soothe`, `spiked_carapace`, `equilibrium`,
`acid_splash` and `curse_mark` as cards the model cannot see. **That was wrong.** DRAW, HEAL,
BarkShield and Poison are all priced; every one of those seven returns an empty `manualReview`
and a real score. They were under budget for the ordinary reason and are legitimate rework
candidates.

The genuinely unpriced set is **three cards**, all using a `MANUAL_REVIEW_TYPES` action:
`scavenge_data` (SEARCH), `reprogram` (PLAY_LAST_CARD), `purify` (CLEANSE). Those score 0.00
and flag themselves.

**A real scoring bug found while checking this, NOT yet fixed:** `soothe` removes a debuff by
applying negative stacks, and the scorer reads `Math.abs(stacks)` before the debuff-on-self
sign flip. So a card that REMOVES a debuff is priced as if it APPLIED one — `soothe` scores
**-0.80** against a 1.0 cap. Any future cleanse-by-negative-stacks card will be mispriced the
same way.

## rev 3.6 — per-stack scaling attacks, and daemons finally get a score (ticket 32)

### Henry's design law for per-stack scaling attacks

**A per-stack scaling attack should underperform early and overperform late. That is the shape,
not a bug.** The card is the payoff for building a board state, so it should feel weak drawn on
turn 1 and disproportionate once the engine runs.

Two consequences for pricing:

1. **Do not cap pre-emptively.** `STRENGTH_STACKS` is capped at 8, but that cap was added by
   ticket 24 *after* measurement showed `momentum_crash` at 29.3 damage a play. Measure first.
   `DAZED_STACKS` (ticket 32) ships **uncapped** for the same reason and did not need one:
   `slander` measured 13.7 stacks at cast for 16.8 damage per play on an attack-55 frame — on
   rate for a 2e card, not running away.
2. **The static score is a FLOOR, not a price.** powerscale has no deck or OS context (the same
   limitation ticket 29 documented for `brute_force` and ticket 28 for Burn overflow). It prices
   a scaling attack at `ASSUMED_STATUS_COUNT = 3`; `slander` in the deck built around it sees
   **13.7**. A scaling card must always be hand-priced against its deck's realistic count, and
   the ticket must say so in writing.

### Daemons are scored now

Daemons carry empty `actions`, so every one of them scored **0.00** and the existing "Daemon
Premium x1.5" multiplied nothing. Ticket 27 priced daemons for the *AI*; the static side stayed
blind until now. A daemon's registered hooks' `do` actions are scored once and multiplied by
`EXPECTED_DAEMON_PROCS = 4`, then the premium and exhaust discount apply as before.

`GENERATE_CARD` is priced as **the generated card's own score**, recursively, with a `seen` guard
so a token that generates itself is scored once and cannot spin.

This too is a floor: `echo_chamber_v2` scores **4.90** against a 6.5 band, and in ratatoskr_v1 -
five 0-costs each procing it - it runs at roughly twice that.

**Hook shapes with no `do` array still score 0** and that is correct, not an oversight:
`core_overclock_daemon` is a pure damage multiplier and `einherjar_standard` is a passive. The
model cannot see those effects, so it declines to invent a number for them.

Nine daemons now carry a non-zero score for the first time. One is over budget -
`fertile_ground_daemon` at **7.60 against a 6.5 band** - reported, deliberately not re-tuned here.

## rev 3.7 — the band is a target, not a law (ticket 33)

**Henry's ruling: the budget band is a target, not a law. Some cards ship over and some under,
and that spread is intended.** `thorn_tithe` ships at **+0.1** and `thornguard` at **+0.3**, both
recorded as accepted rather than as redlines to chase.

This does **not** loosen the standing rule that *imbalance* is fixed at the enabler rather than by
bending card economics. The two say different things:

- **Small variance around the band is normal.** A card at 3.1 against a 3.0 cap is a card, not a
  bug. Chasing every ±0.3 produces a registry of identical cards.
- **A deck that wins 70/30 is still fixed at its enabler.** The OS, the deck's cost curve, the
  mechanic — not by shaving the cards that happen to be in it.

The auditor still reports every overage; the ticket decides which ones matter.

### Corollary from ticket 33's knob round

`hexbloom` hand-prices to **7.96 at its measured 6.8 consumed stacks**, 23% over its 6.5 band —
genuinely off-curve, not band noise. The authorised fix was a half conversion, and it **failed
in a way worth recording**: §2.3 barely moved (0.790 → 0.740) while the mirror **collapsed from
20.6 turns back to 47.7, and decided games from 368/400 to 176/400**.

The lesson is that `hexbloom` was not the imbalance — it was the *clock*. Gutting it removed the
Poison pressure that was resolving the stall this whole pass existed to fix, and left the win-rate
skew untouched because that skew comes from ALLURE_PROXY generating Weakened for free. **Enabler,
not economics** — exactly the standing rule, arrived at from the other direction.

## rev 3.8 — Regen is a duration, not an intensity (ticket 34)

**Henry's correction: Regen heals a FLAT 3% of maxHP per turn, and `stacks` is how many TURNS it
lasts.** 3 stacks = 3% a turn for three turns, then it falls off. It was never meant to be an
intensity multiplier.

The engine multiplied the heal by the stack count, which made it the most broken status in the
registry in two compounding ways:

**1. Quadratic, not linear.** One application of N stacks healed `3% x (N + N-1 + ... + 1)` =
`1.5·N(N+1)` percent of a pool. Now it heals `3% x N` — linear.

| stacks | old total | new total |
|---|---|---|
| 2 | 9% | 6% |
| 5 | **45%** | 15% |
| 8 | **108%** | 24% |
| 15 | **360%** | 45% |

**2. Unbounded, because the decay is a flat 1/turn.** Regen was the ONLY uncapped heal in the game:
Burn caps at 3 stacks, the 2%/stack statuses cap at a 25% effect, BarkShield decays
multiplicatively. Regen had no cap and a flat −1/turn, so a card granting **2 per play accumulated
forever** while **1 per play was a treadmill** that exactly cancelled the decay.

That single property was a step function, and it decided a whole matchup. huldra_v1 with
`iron_bark` at 2 Regen won **79%** of its §2.3; at 1 Regen it won **1%**; at 0 it won **0%**. The
buff riding alongside was irrelevant — Sharp, Strength, more Strength and Strength-plus-damage all
measured 0.000 without the Regen. Fifteen stacks was healing **45% of a health pool every turn**.

### Pricing follows the shape

`regenPower()` was `3·S(S+1)` — wrong twice. It used Poison's triangular shape for a status that no
longer has one, *and* it applied damage's 3-power-per-1%-maxHP rate instead of heal's 4, so it
under-charged by 2x on top of the wrong curve. It is now **`12 · stacks`**: 3% x S of a pool at 4
power per 1%.

Poison's `1.5·S(S+1)` is unchanged and remains correct — Poison genuinely is a decaying DoT whose
per-turn damage scales with stacks. **The two statuses look alike and are not**: Poison's stacks are
intensity, Regen's are duration.

### Effect

huldra §2.3 **0.790 -> 0.660** (inside the first-pass band), mirror **20.6 -> 15.3 turns**, decided
368 -> 385/400. **All eight tuned species now pass every first-pass band**, and the tuned mirror
mean lands at **6.0 turns** — inside the 5-6 target for the first time.

Blast radius was small: two cards (`iron_bark`, `overgrowth`) and two enemy intents (`kraken_regen`,
`audhumbla_milk`). `overgrowth` fell from a corrected 7.20 to **3.60** against a 3.0 band; it is in
no deck and should be re-checked before it enters one.

## rev 3.9 — type advantage is soft and asymmetric (ticket 35)

**Henry's decision: advantage 2.0 -> 1.5, and resistance removed entirely (0.5 -> absent).** A bad
matchup means you simply do not get the bonus; it never means your damage is halved. Doing extra
damage feels good, having yours halved felt awful, and type advantage still has to reward bringing
the right deck to a gym or boss.

### Where the old 4x came from

STAB cancels in the ratio (1.5 / 1.5), so the swing was entirely the reciprocal `2.0 / 0.5` pair:

| | before | after |
|---|---|---|
| advantaged attacker, with STAB | 1.5 x 2.0 = **3.00** | 1.5 x 1.5 = **2.25** |
| disadvantaged reply, with STAB | 1.5 x 0.5 = **0.75** | 1.5 x 1.0 = **1.50** |
| **swing between the two sides** | **4.00x** | **1.50x** |

### Resisted pairs are ABSENT from the table, not written as 1.0

This is load-bearing. `getModifierBreakdown` multiplies any *defined* secondary-element entry by
`SECONDARY_MITIGATION` (0.75), so an explicit `1.0` would silently become `1.0 x 0.75` — a 25%
penalty on a matchup that is meant to be neutral. Absence means "no interaction", which is what
asymmetric requires. A consequence worth knowing: mitigation can now only ever scale a real
advantage (1.5 x 0.75 = 1.125), so `effectiveness` is never below 1 and the "Not very effective..."
log in `effectHandlers.ts` is **unreachable via the elemental path**. The line is left in place for a
future matrix that reintroduces resistance, and a test pins the current behaviour so removing it is
a conscious act.

### Why 1.5 and not smaller — measured, and the reason it stops here

A **persistent multiplicative** damage modifier is a win condition, not matchup flavour: it applies
to every attack all game, so shrinking it only makes the same outcome arrive more slowly. Measured
over 1,440 games per variant:

| adv / dis | ratio | cross-element spread | avg deviation from 50% |
|---|---|---|---|
| 2.0 / 0.5 (old) | 4.00x | 0% – 100% | 42.2 |
| 1.5 / 0.75 | 2.00x | 0% – 100% | 28.8 |
| 2.0 / 1.0 | 2.00x | 1% – 99% | 38.0 |
| **1.5 / 1.0 (shipped)** | **1.50x** | 5% – 95% | 30.2 |
| 1.25 / 0.8 | 1.56x | 2% – 98% | 28.3 |
| 1.15 / 0.9 | 1.28x | 5% – 95% | 27.7 |
| 1.05 / 1.0 | 1.05x | 11% – 89% | 27.4 |

**Even a 5% edge still produced an 89/11 split**, and pace is not the amplifier either — 8.6-turn
games measured the same spread as 4.4-turn ones (deviation 41.6 vs 42.2), because more turns means
less variance and a persistent edge converts more reliably.

So 1.5 is chosen for **feel**, and the residual lopsidedness is accepted as the price of type
mattering at all. **If it ever needs to be a true coin flip, change the mechanism's SHAPE — do not
shave this number again.** The options, in the order they were judged most promising: make it
non-persistent (first hit each turn, or once per battle), make it **additive** (+N flat damage rather
than xN, which is self-limiting and does not compound), pay it out in energy/draw instead of damage,
or rubber-band it (the resisted side draws a card when hit super-effectively).

### Measured effect

Cross-element average deviation **42.2 -> 31.3**. Element win rates moved a long way, and the biggest
winner is the one that was being punished for nothing:

| element | before | after | |
|---|---|---|---|
| Fire | 68% | 44% | -25 |
| Nature | 62% | 53% | -8 |
| Water | 34% | 30% | -4 |
| **Air** | **36%** | **72%** | **+36** |

Air was resisted *by* Fire while Fire had no advantage over Air — a one-way punishment with no
reciprocal upside, so Air simply lost for free. Several pairs had that shape (`Air->Earth`,
`Water->Earth`, and `Earth->Earth` self-resist). Removing resistance fixed a genuine asymmetry
rather than only softening the numbers.

**All eight tuned species are unchanged and still pass every band** — §2.3 and the mirror are
same-species, so the matrix never applied there. That is the correct blast radius: this change only
touches cross-element play.
