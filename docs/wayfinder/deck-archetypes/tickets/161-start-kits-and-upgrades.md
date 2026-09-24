# Ticket 161 — Start kits that grow, and card upgrades

> **Status: CLOSED 2026-09-24 — APPLIED: the start-kit shape shipped inside 162a; the upgrade half is 163; ticket 61's two kit rules retired (ruled 09-24).**

**Type:** design session → engine (upgrades) + data (kits). **Status:** OPEN, asked by Henry 2026-09-22:
*"Another thing we need to do is fix the starter decks and add upgrades. I think that will help with the
run progression."* **Relates to:** 148 (the progression curve — this is its first lever), 153 (rewards —
this is what a pick has to be *better than*), 160 (the kits are re-cut there; this decides what the
*start* kit carries), 157 (the walker measures the curve this creates), 142 §7 (the workshop/shop, where
upgrades would be bought), research/single-player-card-games.md §3 (every genre game: start deck is
meant to be replaced; removal + upgrade are half the progression).

## 1. Why the run does not feel like levelling up — the shape, not the numbers

`createRun.ts`: a starter walks in with its **5 engine cards + 3 generics**; a recruit brings its 5.
Those 5 are the *best* five of the deck — the enablers **and** the payoffs. So on fight 1 the engine is
complete, and every reward the run offers can only make the deck larger and the engine rarer per hand
(148's deck-size tax). Henry's 2026-09-10 read — *"I almost always send cards to the collection"* — is
the correct play under that shape. Slay the Spire's start deck is Strikes and Defends because the run's
job is to replace them; ours starts finished.

Two levers, both on this ticket:

## 2. The start kit under the 160 grammar

A 5-card kit is 2 enablers + 1 consume + 1 scalar + 1 glue (158 §2.2). The **start** kit should carry
the enablers and the glue and **one** payoff, with the other payoff seeded into the run's reward pool
and shop for that species:

| slot | start kit | found in the run |
|---|---|---|
| enabler ×2 | yes | more copies, and the ally-facing variant |
| scalar | yes — the path that survives a bad turn | — |
| consume | **no** — the run's first real pick | yes: guaranteed to appear in that species' biome / first shop |
| glue | yes (the None-element draw, 160) | — |

So a starter is 4 engine cards + 3 generics (7), a recruit brings 4, and the consume is a pick the
player *wants*: it completes an engine they can already see. That is the "deck at fight 1 vs fight 12"
curve 148 asked for, made of one card per body. **Reward-pool seeding** is the mechanism: the species'
missing consume, its second-lane cards, and Tidal Battery-class party cards are in the pool for that
run (Henry, 2026-09-22: *"Tidal Battery … should be a card you find in the run"*), weighted so the
consume shows up by the first shop at the latest.

## 3. Card upgrades

Every genre game in the research has them; ours has none. Three shapes, pick one for EA:

- **A. Plus one (StS):** each card has one upgraded form — numbers up, or a rider added. `ragnarok_edge+`.
  One authored line per card (243 cards; EA needs the ~60 in the twelve kits + generics first).
  Simplest to build, simplest to read, and the scorer prices `+` as a second entry.
- **B. The fork (Across the Obelisk):** two upgrade paths per card — "better" or "cheaper". Doubles the
  authoring; gives the choice the genre praises. Later.
- **C. Tier by currency:** an upgrade adds the card's *currency rider* (a Fire attack gains "+1 Burn"; a
  Nature skill gains "+1 Sharp to an ally"). Cheapest to author (a rule per element, not a line per
  card), and it pushes every upgraded card toward the 160 grammar. Reads less well on the card.

**Recommendation: A for the EA sixty, priced by 149c**, with C as the *generator* for the first draft
of each `+` line so the authoring is a review, not a blank page.

**Where:** the workshop (142 §7's static shop), for scrap — which answers 153's "scrap is not scarce"
directly by giving it a sink with a visible result. Price band to test: 25–40 scrap; one upgrade per
visit at first. Rest-site style "upgrade one card free" at the gym gate is the second venue.

**Engine:** an `upgraded: true` flag on a deck instance and a second `programs.json` entry per card
(`<id>+`), the tile shows the `+` and the changed numbers; `runLog` records `CARD_UPGRADED`. No new
mechanic — the upgraded card is just another card id the instance points at.

## 4. Measured

157's walker with policy "upgrade the highest-149c card when scrap ≥ price" versus never-upgrade; the
deck-power curve fight 1 → gym is the number. 153's pick census before/after the seeded pool: the
"sent to collection" rate should fall. Both run on the current registry before the 160 sessions so
the kit change and the upgrade change are separable.

## 5. Session questions for Henry

1. Start kit = enablers + scalar + glue, consume seeded (§2) — or keep 5 and seed the *second lane*?
2. Upgrade shape: A now, C as the draft generator?
3. Workshop price and cap per visit; is the gym gate a free-upgrade site?
4. Do upgrades persist to the collection across runs (a meta-progression hook), or reset per run?
