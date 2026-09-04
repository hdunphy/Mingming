# Ticket 129 — whirlpool, feedback_loop, and what an extra card draw does

**Status:** CLOSED 2026-09-01. Every measurement here was acted on in ticket 131 (a–e). The 0e
finding stands as a decision NOT to spend a knob.

Three of Henry's playtest calls, measured. Nothing shipped — every number below is a proposal.

Instruments: `scratch/pricewhat.ts` (flag-based pricer), `scratch/whirlpoolarms.ts` (deck arms at
both widths), `scratch/handeconomy.ts` (leftover energy, hand-limit clip, triggered-draw rate).

---

## 1. `whirlpool_v2` — under-priced, and the fix depends on width

Henry: *"whirlpool seems very under powered. Especially compared to pressure point. I almost never
play it unless I have extra energy."*

**He is right, and the gap is exactly the one he names.** Both cards are 1e and both sit in
`kraken_v1` twice:

| card | 1e | score | band 2.4–3.0 |
|---|---|---|---|
| `whirlpool_v2` — 8 power, draw 1 | 1e | **2.2** | **under by 19%** |
| `pressure_point` — 22 power, draw 1 if Dazed | 1e | **3.1** | over by 15% |

A 41% relative gap at the same cost. "I almost never play it unless I have extra energy" is the
correct read of a card priced 19% below its rung sitting next to one priced 15% above it.

### The arms, at both widths

Four arms on `kraken_v1`. Each asserts the mutation reached the engine and prints the card the
engine actually sees, because four arms in this project have "worked" and measured nothing.

| arm | score | 1v1 field (30 cells) | 3v3 control-vs-zoo |
|---|---|---|---|
| SHIPPED — 8 power, draw 1 | 2.2 | 52.50 | 66.67 |
| **DAZED1** — + 1 Dazed, single | **2.7** | 56.50 | 75.00 |
| **POWER15** — power 8 → 15 | **2.9** | 56.50 | 83.33 |
| SIDEDAZED — + 1 Dazed, Side | 4.2 | 56.33 | **91.67** |

**At 1v1 all three buffs are the same card.** 56.50 / 56.50 / 56.33 — Side scope is worth *nothing*
against one enemy, which is ticket 119's width-blind ×2.2 multiplier seen from the field instead of
from the scorer. Anyone tuning this at 1v1 would conclude the three options are interchangeable.

**At 3v3 they are not, and Henry's own suggestion is the one to avoid.** Side-wide Dazed takes a
matchup control *already wins* from 66.7% to 91.7%. Control-vs-zoo was 40% after ticket 115; it is
66.7% now that ticket 123 nerfed the zoo scalers and the beam is on. Piling more side-wide control
onto that is the ticket-119 trap: a card that reads fair at 1v1 and is ~4.5× at 3v3.

**Recommendation: `DAZED1` (+1 Dazed, single target).** It scores 2.7 — dead centre of the 1e band —
fixes the pressure_point comparison, and its 3v3 move (+8.3) is one game in twelve. `POWER15` is the
alternative if you want the bigger swing; it is 2.9, still in band, and reads as a plainer card.

**Caveat, stated plainly: the 3v3 rows are 12 games each, so one game is 8.3 points.** The ordering
is monotone with the score, which is reassuring, but only SIDEDAZED's gap is bigger than the noise.

---

## 2. `feedback_loop_daemon` — 54% under band, and a cost drop does not fix it

Henry: *"I draw about 1-3 times a hand and games are 3-4 turns maybe more with 3v3, but it does not
match the 2e power curve. Can you help me calculate its worth and it must be positive even if its
played turn 2 or 3."*

### Both of his observations check out

Measured over real 3v3 battles (`scratch/handeconomy.ts`):

- **triggered draws per turn, side-wide: 1.84 (zoo) / 1.59 (control)** — his "1-3 times a hand".
- **turns per battle: 5.2 (zoo) / 4.5 (control)** — a bit longer than his "3-4".

### But the number that prices the card is smaller than either

The hook is `onCardDraw` gated `when: { source: SELF, isNaturalDraw: false }`, and
`resolutionEngine` sets that source to the unit that **caused** the draw. At 3v3 the deck is shared,
so an ally casting the draw card procs nothing:

- **per-unit triggered draws per turn: 0.84 (zoo) / 0.65 (control) — call it 0.75**
- **zero on 57–64% of unit-turns**

That is the same 3v3 shared-deck problem ticket 128 found in `fenrir_v2`, in a second card.

### The worth, by the turn it is played

The proc is **5 power** (the card text says "5 damage", which is wrong — it is power, and it goes
through the damage formula like any attack). Score = procs × (power/10) × 1.5 daemon premium, over a
five-turn side:

| played on | procs (0.75/turn) | score | vs 2e band 5.2–6.5 | vs 1e band 2.4–3.0 |
|---|---|---|---|---|
| turn 1 | 3.75 | **2.8** | 46% below floor | in band |
| turn 2 | 3.00 | **2.25** | 57% below | 6% below floor |
| turn 3 | 2.25 | **1.7** | 67% below | 29% below floor |

The scorer agrees independently: **2.7 at 2e against a 5.2–6.5 band, 54% under.** At 1e it prices at
2.7 against 2.4–3.0 — dead centre.

### So: dropping it to 1e fixes turn 1 and nothing else

**It does not satisfy the requirement as written.** A daemon's value is *linear in remaining turns*,
so no per-turn-only payoff can be in band both when played on turn 1 and when played on turn 3 of a
five-turn game — being in band at turn 3 puts it 60% over at turn 1. That is a property of the
shape, not of the numbers.

Three ways out, in order of how much I like them:

1. **Widen the proc to the side** — `source: SELF` → `ALLY`, so any ally's effect-draw procs it.
   That is the measured 1.7/turn instead of 0.75, **2.3× the card**, and it lands turn-1 at **6.4**
   — in the 2e band — with turn 2 at 5.1 (on the floor) and turn 3 at 3.8. Keeps 2e and the printed
   5 power, changes one word of JSON, and is a **pure 3v3 fix**: at 1v1 "side" and "self" are the
   same unit, so no 1v1 number can move. It also fixes the same complaint as ticket 128.
2. **Give it an on-cast payoff** — e.g. "draw a card when played", which flattens the turn curve and
   conveniently procs itself once. This is the only option that genuinely satisfies "positive even
   on turn 3", because it front-loads value the per-turn engine cannot. Note the scorer cannot price
   this today: its daemon branch only runs `if (score === 0)`, so a daemon with any `actions` of its
   own silently loses its hook's value. That is a scorer bug worth its own ticket.
3. **Drop to 1e.** Cheapest, correct for a turn-1 cast, still under from turn 2. Fine if the answer
   is "this is an early-game card and that is allowed".

**My recommendation is (1), and (2) on top if you want the turn-3 guarantee.** (3) alone leaves the
card in exactly the position Henry noticed.

---

## 3. An extra card draw per mingming — it works, and it makes the hand limit bind

Henry: *"I seem to always play all my cards and often have an energy left over especially in these
zoo decks. The strategy then becomes what order instead of which cards to play. I've been wondering
what an extra card draw for every mingming might do. Maybe up the hand limit if we do that."*

**Both halves of the observation are confirmed, and so is the instinct about the hand limit.**

| | baseline | **+1 cardDraw on every unit** |
|---|---|---|
| energy unspent at end of turn, zoo | **22.9%** (1.13/turn) | **11.5%** (0.61/turn) |
| energy unspent at end of turn, control | 19.3% (1.04) | 9.6% (0.50) |
| bodies that spent NOTHING, control | 9.1% | 5.1% |
| cards left in hand at end | 1.29 / 1.52 | 1.83 / 1.88 |
| refill wanted | 5.36 / 5.71 | 7.47 / 7.45 |
| **refills clipped by the hand limit** | **4.0% / 9.5%** (0.1 cards) | **52.9% / 50.0%** (1.1 cards) |
| turns per battle | 5.2 / 4.5 | **3.8 / 4.3** |

Reading it:

- **It does the thing.** Leftover energy roughly halves, and it halves hardest in the zoo panel,
  which is where Henry felt it. Cards left in hand rises from 1.3 to 1.8, so the hand no longer
  empties — the "which cards" decision comes back rather than only "what order".
- **The hand limit stops being decorative.** Today it clips 4–9.5% of refills and costs a tenth of a
  card; with +1 it clips **half of them** and eats **1.1 cards a turn**. So Henry's "maybe up the
  hand limit if we do that" is not optional — half the extra draw would be thrown away.
- **Games get shorter.** 5.2 → 3.8 turns in the zoo panel. More cards is more damage. That is worth
  weighing against two open items: the 3v2 snowball (a shorter game gives the losing side less time
  to come back) and every DoT price in the pool, which is denominated in turns.

### A trap if you raise the limit

`HAND_SIZE_LIMIT = 9` is declared **twice** — `deckLogic.ts:9` and `effectHandlers.ts:13` — despite
`deckLogic`'s comment claiming ticket 32 made it "single source of truth. battleReducer.ts and
resolutionEngine.ts import this rather than re-declaring their own copies (all three previously said
9 independently)." It consolidated three of four. Changing only `deckLogic` would leave the
effect-driven draw path capped at 9 while the refill obeys the new number, which would look like an
intermittent bug.

**Caveat: 3 battles per panel.** The energy and clip figures are per-turn averages over 23–31
side-turns and are solid; the turn-count drop is 3 battles and wants a bigger run before it is
quoted as 5.2 → 3.8.

---

## 4. The 0e question — the mechanism is real but it is not what is shortening the game

Henry: *"I like the extra card draw but I don't like the turns going down. Do we need to reduce the
damage on 0e cards? maybe thats why zoo is so strong. Maybe we spend some knobs by tuning 0e cards
down 10%-15%."*

The proposed mechanism is sound on its face — **the energy cap does not restrain a 0-cost card, only
the hand does**, so extra draw should convert more directly into 0e damage than into paid damage.
39 of the pool's cards are 0e, and they are 38–41% of every card cast.

**But the share does not move when you add the draw.** 0e cards are 38.0% of casts at baseline and
39.3% with +1 (zoo); 38.5% → 41.5% (control). The extra cards are being spent across the whole curve,
not funnelled into free ones. What actually changes is the raw volume: **5.8 → 7.1 cards cast per
turn, +23%.** The game gets shorter because more cards are being played, not because 0e cards got
better.

That also predicts the nerf will barely help, and it doesn't:

| arm | zoo turns | control turns | mean | 0e share of casts |
|---|---|---|---|---|
| baseline | 5.2 | 4.5 | **4.85** | 38.0 / 38.5% |
| +1 draw | 3.8 | 4.3 | **4.05** | 39.3 / 41.5% |
| +1 draw, 0e −15% | 4.3 | 4.2 | **4.25** | 42.9 / 41.1% |
| +1 draw, 0e −10% | 4.7 | 3.8 | **4.25** | 40.6 / 38.2% |

A 10–15% cut to 40% of casts is a ~5% cut to total damage, and it recovers roughly 0.2 of the 0.8
turns lost. **And that 0.2 is not established** — three battles per panel cannot resolve half a turn,
and the control panel moves the *wrong way* in both nerf arms (4.3 → 4.2 → 3.8). Do not spend a knob
on this reading.

**If the goal is to keep the extra draw and keep the turn count, the lever is the draw itself, not
0e damage.** The refill is `sum(cardDraw) − alive + 1`, so +1 per mingming is **+3 cards a turn at
3v3** — that is why it moves so much. A +1 on the *formula* instead (`− alive + 2`) is +1 card a turn
whatever the party size: a third of the effect, and it does not scale with width. Worth measuring
beside the per-body version before choosing.

**Whether 0e cards are separately over-priced is a real question this does not answer.** It wants the
band audit run over the 39 of them rather than a field arm — that is a different measurement and a
cheap one.

### The 0e band audit, since the field arm could not answer it

Every non-token 0e card scored against the 0.8–1.0 band (`scratch/zeroaudit.ts`):

- **38 cards. 10 over band (26%), 19 in, 9 under.**
- **Median absolute deviation from band centre: 11.1%**, against the **10.0%** ticket 121 measured
  across all 208 costed cards. (Computed excluding the four negative-scoring drawback cards —
  `desperate_strike` −3.10, `dark_pact` −3.10, `vent` −1.60, `reckless_charge` −0.40 — for exactly
  the reason ticket 121 gives for not using standard deviation.)

**So 0e cards are not unusually mispriced as a class.** They scatter 1.1× the pool's own noise. The
26%-over-band count reads worse than it is because 0.8–1.0 is the narrowest rung on the curve: one
0.1 step is +11%, so a card can be "over band" by a rounding error.

**And the panel comparison does not support the zoo hypothesis either:**

| panel | 0e card slots | total score | mean | over band |
|---|---|---|---|---|
| zoo — jormungandr_v1 + sleipnir_v1 + hraesvelgr_v1 | **10** | 12.70 | **1.27** | 8 of 10 |
| control — kraken_v1 + huldra_v1 + draugr_v2 | **7** | 8.50 | **1.21** | 4 of 7 |

The two panels' 0e cards are priced **the same** (1.27 vs 1.21). What differs is that the zoo runs
**ten free-card slots to control's seven** — a deck-construction difference, not a pricing one. A
blanket 10–15% cut would hit control's seven slots as well, so it is not aimed at the thing that
actually differs between them.

**Two individual cards do stand out, and both are already someone's ticket:**

- `corrosive_leak` **+156%** (jormungandr_v1) — one of the four worst scaling/consume cards
  **ticket 120** already names. Fix it there, as a scorer problem, not as a 0e problem.
- `rimefrost` **+111%** (draugr_v2) — a **ticket 115** card, shipping knowingly over band by ruling.
  Note it is in the **control** panel, not the zoo one.

**Recommendation: do not spend a knob on 0e damage.** The class is priced correctly, the panel gap is
slot count rather than power, and the two real outliers are owned by tickets 120 and 115.
