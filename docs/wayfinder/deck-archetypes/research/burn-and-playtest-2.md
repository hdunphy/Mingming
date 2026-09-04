# Permanent Burn, and what the human playtest proved (ticket 92)

Two things came out of Henry's second sitting: a question about Burn, and - more important - the
answer to the question the B block was built to ask.

---

## 1. Burn: you remembered right, and permanence makes exactly one deck OP

**Burn WAS permanent.** `power_curve_spec.md` rev 3 changed it to decay 1 stack a turn, and the
comment in `BurnBehavior.endTurn` still says so: *"Burn now decays 1 stack/turn (was permanent)."*

Measured, 31 opponents, 15 iterations, decay 1 -> 0 with nothing else touched (same cap of 4, same
tier table, same 14% detonation):

| deck | live | permanent Burn | delta |
|---|---|---|---|
| `hraesvelgr_v2` | 60.2% | **75.5%** | **+15.3**, and >90% cells go **4 -> 12** |
| `fenrir_v2` | 47.2% | **56.7%** | +9.5 |
| `skoll_v2` | 36.8% | 35.7% | -1.1 (nothing) |

**One deck breaks: `hraesvelgr_v2`, and the reason is a single card.** `firestorm_talon` reads
*"Spend all Energy: 15 power x target's Burn x X"* - a multiplier on the Burn pile itself. While
Burn decays, the pile she is multiplying by falls every turn and the card has to be timed. Make it
permanent and the pile only ever grows, so her payoff compounds with the length of the game. Twelve
matchups above 90% is the tell: that is not a stronger deck, it is a deck that stops losing.

`fenrir_v2` at 56.7% is the interesting case in the other direction - **permanence suits him**, and
his Burn is largely SELF-inflicted (`pyre_sacrifice`), so it is a real cost he is now paid properly
for carrying. `skoll_v2` does not care; her only Burn card, `all_in`, is 82% dead.

### If you want permanence, here is the price

1. **Permanent Burn + reprice `firestorm_talon`.** The card is the whole problem. Its Burn
   multiplier is uncapped, which is fine against a decaying pile and is not against a permanent
   one. Capping the Burn it reads at the stack cap (4) would keep the card's shape and remove the
   compounding.
2. **Permanent Burn + a lower cap.** The detonation cap is 4; permanence means the pile sits at cap
   and every application detonates for 14% max HP. A cap of 3 with permanence is a smaller, more
   frequent payout, and worth a sweep before choosing.
3. **Slow decay instead of no decay** - 1 stack every other turn. Splits the difference and keeps
   `firestorm_talon` honest. Not measured yet; one dial away now that `BURN_CONFIG.decayPerTurn`
   exists.

**Nothing shipped.** `decayPerTurn` is live at 1, which is exactly the current behaviour; the dial
just exists now so the question is answerable without a rebuild.

---

## 2. The B block did its job: the zeros are REAL

This is the finding that matters. The B block existed to test one hypothesis - **"the AI loses
these 0 of 60, so maybe the cells are a pilot artifact"** - and Henry piloted all three himself.

| match | result | his note |
|---|---|---|
| B1 `kraken_v1` vs `audhumbla_v1` | **loss** | *"Audhumbla gets so much energy and then plays supernova and crushes me for 23 HP. It's really hard to get off Kraken's combos."* |
| B2 `draugr_v2` vs `huldra_v1` | **loss** | *"Once the poison was applied it was over... the draugr payoff card keeps getting countered by the sharp, so my payoff was only doing 4 dmg."* |
| B3 `fafnir_v2` vs `gullinbursti_v1` | **loss** | *"Stone Fist hits too hard and Fafnir has no real payoff cards. Also didn't feel like there was much strategy in the cards."* |

**A human lost all three.** The zeros are not an AI artifact - they are real, and they are now the
top of the balance queue rather than a suspicion. Better than that, he named the mechanism in each
one, which is three diagnostics we did not have to run:

- **B1 - the energy engine, not the payoff.** `audhumbla_v1` is the only deck that reliably reaches
  a 3-Energy payoff (`supernova_v2`) because GENESIS gives her the Energy to do it. The measured
  version: she is the strongest deck on the roster at 68.7% and `os:audhumbla` is a 100% wipe. This
  is the same finding as ticket 88's *"Energy is worth three times what cards are worth"*, seen
  from the receiving end.
- **B2 - the counter-status annihilation.** `draugr_v2`'s payoff scales on DISTINCT negative
  statuses; huldra hands out Sharp, and **Dazed and Sharp cancel each other stack for stack**. His
  payoff read 4 damage because the statuses it counts were being deleted as fast as he applied
  them. That is a mechanic interaction nothing in the balance suite can see - it looks like a card
  underperforming, not like a status system eating it.
- **B3 - a payoff-less deck against a payoff.** `fafnir_v2` has no real payoff card (confirmed: his
  best is `veinburst` at a measured 11.8 against `stone_fist`'s 15+), and *"not much strategy in
  the cards"* is the honest player-side reading of a deck that ticket 82 could only fix with a stat
  bump.

### And the frustration is fair

> *"Its really frustrating to play the low damage decks that have no chance."*

That is on me: the B block deliberately handed him the three worst matchups in the game back to
back, because that was the cheapest way to test the hypothesis. It worked, and it should not be
repeated - **round 2 should be balanced matchups and decks he might actually enjoy**, with at most
one diagnostic cell in it.

## What I would do next, in order

1. **`audhumbla_v1`/`v2`** - the strongest deck AND half the remaining neutral absolutes, now
   confirmed by hand.
2. **The Dazed/Sharp annihilation as it hits `draugr_v2`** - a payoff that reads 4 damage because
   its own counting statuses are being cancelled is a design bug, not a tuning one.
3. **`fafnir_v2` needs a payoff card**, not another stat point.
4. Burn permanence, if Henry wants it, with `firestorm_talon` repriced in the same ticket.
