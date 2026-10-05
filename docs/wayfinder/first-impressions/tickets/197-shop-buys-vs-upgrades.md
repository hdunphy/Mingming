# Ticket 197: The shop sells upgrades, not cards

**Type:** measurement, then a pricing decision for Henry, then the ruled change. **Status:** written 2026-10-05. Split out of [196](196-unused-cards.md) on Henry's ruling the same day (*"It's own ticket"*). Not blocked, but read the caveat in *Why the agent may be the cause* before changing a price.

**Where it comes from.** The four agent nights so far (2026-10-04 haiku and sonnet, 2026-10-05 haiku and sonnet; 63 sessions with moves) made **22 card purchases and 180 upgrades** in the shop. One agent wrote: *"Upgrade prices (25-30) vs a card (15-35) make upgrading Glass Cannon feel obviously best."* Mend was on a shelf 50 times and never bought, Adrenaline 47, Hamstring 38. Ticket 196 has the full never-bought list.

---

## What the prices are today

All in `src/engine/run/marketplace.ts`:

| What | Price by card cost 0 / 1 / 2 / 3+ | Constant |
|---|---|---|
| Buy a card | 15 / 25 / 35 / 45 | `CARD_PRICE_BY_ENERGY` |
| Upgrade a card you own | 25 / 30 / 35 / 40 | `UPGRADE_PRICE_BY_ENERGY` |
| A `+` card on the shelf | buy + upgrade, less 15% (ticket 163f; Henry's 2026-09-24 ruling allows 10–20%) | `upgradedCardPrice` |
| Sell a card | 5 / 10 / 15 / 20 | `SELL_PRICE_BY_ENERGY` |
| A Draught | 32 standard, 48 rare | `MACRO_PRICE_STANDARD` / `_RARE` |
| A Trace | 50 | `MARKET_BLUEPRINT_PRICE` |

Upgrades are capped at 3 per town visit ("Upgrades left on this visit: 3."). The `Tight Budget` modifier raises shop prices 25% (`modifiers/shopPrice.ts`).

## Why the agent may be the cause

1. **It keeps decks lean on purpose.** Its usual reason for skipping a card reward was *"keeps the deck lean"* or *"13 cards is enough."* A player who believes that will upgrade rather than buy at almost any price.
2. **It played alone.** 31 of 36 sonnet runs had a party of one, so cards for allies or for several enemies were worth little (ticket 195 fixes the Trace explaining).
3. **The fights were auto-played,** so it never saw a bought card do anything.

So a price change made on these numbers alone could fix an agent habit rather than a game problem. Row 197a checks that first.

## Rows

| Row | What | Kind |
|---|---|---|
| 197a | Measure buys against upgrades on a night after 195, and against the walker | Measurement |
| 197b | Decision session with Henry on what the shop is for | Henry's rulings |
| 197c | Build the ruled prices | Data |

## 197a: Measure it properly

1. From the first night after 195b–d (when the agent summons a team), count per run: Amber earned, Amber spent on cards, upgrades, Draughts, Traces and Runes, and Amber left at the end. Add these columns to the morning report (`src/debug/playtest/report/`). They are additions, so existing output is unchanged.
2. Run the same count on the walker (`src/debug/balance/`), whose shop policy is code rather than an agent's taste. If the walker also buys almost nothing, the prices are the cause. If it buys and the agent doesn't, it is the agent.
3. For the five cards most often left on the shelf (Mend, Adrenaline, Hamstring, and the two most-shelved Auras), measure in the sims what buying one adds to a starter deck, against upgrading that deck's best card for the same Amber.

## 197b: Decision session

Bring 197a's numbers, and these questions for Henry:

- Is a shop card meant to compete with an upgrade, or is the shop meant to be mostly upgrades?
- If cards should compete, which lever? Cheaper cards, dearer upgrades, a lower upgrade cap per visit, or a better `+` discount (inside the 10–20% he ruled)?
- Should Traces at 50 Amber come down, now that summoning is the thing that wins runs?

Henry's standing rulings apply: numbers move in 5s, no hidden math, no arbitrary caps, and the shop's stock is frozen at your first visit.

## 197c: Build the ruled prices

One commit per ruled change, with the before/after prices in the message. Re-run the opening-fight read (the 85% wild-fight bar in biome 0) after any change that touches the first town.

## Decisions for Henry

None until 197a's numbers are in.

## Resolution

(open)
