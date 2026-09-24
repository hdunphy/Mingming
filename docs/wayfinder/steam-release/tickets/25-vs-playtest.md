# Vertical Slice playtest round: protocol, scoresheet, findings (ticket 25)

> **2026-09-24 — RE-SCOPED against deck-archetypes 161/162/163 (Henry's rulings). The testers play collection v2 (98 cards) with in-place `+` upgrades at three benches and one OS patch per body; the run log already records CARD_UPGRADED and PATCH_TAKEN — add "upgrades taken / patches fitted" to the scoresheet. "Removed" is not a verb any more (61); "sold" is. The 20–25 deck gate STANDS (Henry: grow the deck, but only to about 20–25 — mostly replacing; no extra Strike/Block filler, the three tackles are the filler). **25-pre is DONE (2026-09-24)** — see the write-back at the foot of this file. This ticket is unblocked on that count.**

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [09](09-run-start.md), [10](10-region-map-screen.md), [11](11-encounter-flow.md), [12](12-rewards-refit.md), [13](13-marketplace-node.md), [14](14-workshop-node.md), [15](15-macros.md), [17](17-elite-nodes.md), [18](18-gauntlet-refit.md), [19](19-run-end.md), [20](20-ranch-minimal.md), [22](22-3v3-game-side.md), [24](24-onboarding-lite.md)
- Phase: Vertical Slice

## Deliverable

The first playtest of the LOOP (previous rounds tested fights). Protocol file under `playtest-results/round-4-vertical-slice/`: 4–6 testers (Henry + friends/family), one full run each, scoresheet measuring: run length (gate 35–45 min), fights (gate 10–13), deck size at the gauntlet (gate 20–25), cards picked vs bought vs removed, gauntlet death + revive outcome (this is where the DEFERRED revive shape gets decided), confusion points (for ticket 24's re-cut), and a 1–5 "would play again". **Attach the run log** — Settings → Playtest → Export run log, once per tester at the end of their session ([ticket 59](59-run-telemetry.md)). It carries every node entered, every card taken, skipped, bought and removed, the scrap curve and the deck curve, so the scoresheet's numbers are read off a file rather than recalled. The 2026-08-24 session is the argument: every finding it produced was reconstructed from one sentence of recollection each. Snapshot exports (`Ctrl+Shift+E`) stay the thing to collect on a **bug**, since they carry the board and the log does not.

## Done when

`findings.md` with the numbers above and a ranked fix list; the gauntlet revive question returns to Henry WITH data; map updated.

## Resolution

_(open)_

---

## 25-pre — done (2026-09-24)

**The stranger slot is gated to the EA pool.** `marketplace.rollMarketStock` drew that slot from
`Object.keys(ProgramRegistry)` entire, so an all-EA party could be sold a card out of the archived v1
collection or out of one of the ten post-EA species — on the one shelf whose whole job is *"this is
not one of your team's cards"*. It is: it is not anyone's.

Narrowed by **the same gate `rewardCardPool` already narrows rewards with**, and on the same
`usesV2Pool` test, so a party with a post-EA member keeps the full complement rather than being
handed a shelf that cannot speak for it. `RewardSystem.inV2RunPool` is that gate, exported as a
predicate rather than as the set so a second copy of the rule cannot grow somewhere else; the union
is already right, because `v2RunPool` seeds itself with the run-only daemons and the neutral-utility
answers.

`marketplace.test.ts` asserts it three ways — nothing outside the pool on any shelf slot across
twelve runs' markets, the stranger slot still FILLED (a filter that emptied it would quietly drop the
shelf to six), and a mixed party still seeing the full complement. Mutation-tested by removing the
gate; the first of the three fails.

**It caught its own next hole immediately.** Deck-archetypes 163f landed a `+` card on this shelf the
same day, and the first assertion went red — which is what should happen when a new door opens onto a
shelf a previous row closed. The `+` slot is excluded there by NAME, as a declared exception rather
than by widening the pool gate.
