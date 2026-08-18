# Card budget: 20 cards over the tightened bands

- Type: wayfinder:task
- Status: open
- Assignee: —
- Blocked by: —

> ## Re-scoped by [deck-archetypes ticket 06](../../deck-archetypes/tickets/06-rescope-power-curve-tickets.md), 2026-08-12
>
> **STATUS: the bands quoted below are STALE and the card list is superseded.** This ticket is
> written against `{0:1.0, 1:4.0, 2:9.0, 3+:14.0}`; the curve has since moved to rev 3.9 and the
> bands are **`1.0 / 3.0 / 6.5 / 10.5`**. `powerscale.ts` is the executable truth — where any prose
> disagrees with it, including this file, powerscale wins.
>
> **Do not per-card retune from the list below.** Most of those 20 cards have since been rebuilt,
> re-costed or dropped by the deck passes, and several of the redlines were closed as a side effect
> (`glacier_wall`, `flash_freeze`, `stone_bark`). The registry has also nearly doubled: **36 of 198
> cards are over budget now against 20 of 111 then — 18.2% versus 18%, i.e. the RATE is unchanged.**
> That is the useful reading and it is the one this ticket should have been about.
>
> **What survives, and it is the interesting half:** the systematic causes the deck passes found,
> which are curve-level rather than per-card.
>
> - **Stun is priced at 55 power and cannot fit a 30-power band**, so every "stop the game" card in
>   Ice was over budget by construction (tickets 48/50).
> - **A per-stack scaler's static score is a FLOOR, not a price** — `avalanche`, `slander`,
>   `rimebreaker`, `deep_vein` all read far under what they do, and the deck report's
>   `POWER_DIVERGENCE` redline exists to surface exactly that.
> - **A shed card cannot reach a 1e band under the removal premium** (ticket 51 §5).
>
> Re-derive this ticket from a current report rather than editing the list below.

## Question

`npm run balance` (run 2026-08-05, registry `1:1cba1e2c`, after
[power_curve_spec.md rev 3](../../../power_curve_spec.md) — commit `8088eec`) shows 20 of 111
cards over §1.3's budget for their cost, using the retuned `BUDGET_BANDS` from that rework
(`{0:1.0, 1:4.0, 2:9.0, 3+:14.0}` over-budget line, tightened from the pre-rev-3
`{0:3.5, 1:7.0, 2:13.0, 3:18.0}`). **This growth (5 → 20 redlined cards) is the expected,
intended effect of tightening the bands per the rev-3 design decisions** — it is not itself a
sign of anything broken, but it is the concrete list of cards that now need real rebalancing
work, not just reformula work:

| card | cost | score | budget | over by |
|---|---|---|---|---|
| Scorch | 2 | 16.8 | 9 | 7.8 |
| Capacitor | 1 | 6.3 | 4 | 2.3 |
| Corrosive Leak | 0 | 2.8 | 1 | 1.8 |
| Flash Freeze | 1 | 5.5 | 4 | 1.5 |
| Glacier Wall | 1 | 5.4 | 4 | 1.4 |
| Stone Bark | 1 | 5.4 | 4 | 1.4 |
| Hydro Blast | 3 | 15.0 | 14 | 1.0 |
| Equilibrium | 1 | 4.7 | 4 | 0.7 |
| Blind Spot | 0 | 1.5 | 1 | 0.5 |
| Disorienting Gust | 0 | 1.5 | 1 | 0.5 |
| Glacial Slam | 2 | 9.5 | 9 | 0.5 |
| Lumen Surge | 1 | 4.5 | 4 | 0.5 |
| Sleep Powder | 1 | 4.5 | 4 | 0.5 |
| Stunning Strike | 2 | 9.5 | 9 | 0.5 |
| Surge Protection | 1 | 4.5 | 4 | 0.5 |
| Cinder Slash | 1 | 4.4 | 4 | 0.4 |
| Slipstream | 0 | 1.4 | 1 | 0.4 |
| Glass Cannon | 1 | 4.2 | 4 | 0.2 |
| Brute Force | 2 | 9.1 | 9 | 0.1 |
| Hoof Strike | 0 | 1.1 | 1 | 0.1 |

Scorch and Capacitor are the real outliers (+7.8 and +2.3 — everything else is within ~1.8 of
its line, and 12 of the 20 are within 0.5, i.e. borderline by design-taste rather than clearly
broken). This is the lowest-risk of the three balance tickets: no formula diagnosis needed, just
per-card retuning against a curve that's already validated.

Checklist:

- Scorch first: at nearly double its budget it's the one card here that reads as a genuine
  outlier rather than a borderline call — check what it's actually doing (damage + status?
  multi-hit?) against what the rev-3 power table prices that combination at.
  Capacitor second, same treatment.
- For the 12 cards within 0.5 of budget: these may not all need changing — worth a pass to
  decide, per card, whether the overage reflects a real pricing mistake or is an acceptable
  design choice (a slightly-above-curve card as an intentional build-around, per the rev-3
  doc's "not every card must sit exactly on the line" spirit) before touching numbers.
- Whatever gets changed, re-run `npm run balance` and confirm both the specific card(s) drop off
  the redline list and no unrelated matchup numbers move unexpectedly (a card price change
  shouldn't silently shift a mirror's turn count).
- Note in `docs/power_curve_spec.md` (or a follow-up) any card where the decision is "leave it
  over-budget on purpose," so a future audit doesn't re-flag it as new.

Done when: Scorch and Capacitor are back on budget, and every other card on this list has an
explicit decision recorded (adjusted, or deliberately left as-is with a reason) rather than being
silently unaddressed.
