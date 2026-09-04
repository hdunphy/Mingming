# Economy and 3v3 numbers: reward pool, workshop fee, scrap table, drop rate, short-party gauntlet, energy transfer (ticket 56)

- Type: wayfinder:grilling
- Status: closed
- Assignee: wayfinder (Henry grilling session, 2026-08-21)
- Blocked by: [05](05-release-shape.md), [08](08-start-kit-rule.md)
- Phase: Vertical Slice

## Question

Map questions 2, 7, 8, 9, 10 and 11 had no ticket of their own — six un-ruled numbers the Vertical Slice build tickets (12, 13, 14, 15, 18, 22) were carrying as "Henry picks". Rule them in one sitting so no task ticket stops for them.

## Resolution

**RULED (Henry, 2026-08-21):**

1. **Reward-pool source (Q2):** post-fight picks draw from the **current party's species pools** — the kit cards of species in the party, weighted toward untagged kit cards not yet in the run deck. Recruiting = choosing your draft pool. Off-pool wild-cards appear only at events (ticket 30). → ticket 12.
2. **Workshop cost (Q7; consistent with ticket 06 ruling 4):** ranch assembly = 1 blueprint; **mid-run workshop assembly = 1 blueprint + 25 scrap; workshop reflash = 1 blueprint + 15 scrap.** Blueprints are ranch inventory and spendable at workshops. → ticket 14.
3. **`TRANSFER_ENERGY` (Q8): keep it in the reducer for future cards, expose it now only as a Macro** — **Relay** (rare, 40 scrap): move 1 energy from one party member to another this turn. Plus **Scout** (common, 25 scrap): reveal the current biome's node types (ticket 07's map-reveal). Macro roster is now the 10 ruled + Relay + Scout + Revive. → ticket 15 (and 22 builds no transfer button).
4. **Gauntlet with fewer than 3 (Q9): the boss is always 3 — 3 vs N.** The gym node shows three silhouettes; under-recruiting is the run's failure mode, Revive and farming are the answers. → ticket 18.
5. **In-progress runs (Q10):** already ruled in ticket 06 — one run slot, survives app close.
6. **Blueprint drop rate (Q11): 20% per defeated wild, 50% per elite, 100% from alphas**; a species you already own can drop again (re-roll fodder). → ticket 12.
7. **Scrap table (Q11):** win pays **10 + 5 per enemy beyond the first** (1v1 10, 2v2 15, 3v3 20); elite win 30. **Cards cannot be sold** (amends economy-session.md's "selling cards" income — removal is a pure sink). Market buy: 0e 15 / 1e 25 / 2e 35 / 3e 45; **card removal 20** (market and workshop). Expected 3-member run income ~150–180 scrap ≈ 3 purchases + 3 removals + 1 workshop fee. The slice playtest re-tunes in steps of 5. → tickets 12, 13, 14, 15.

### Reconciliation with the already-built slice (Henry, 2026-08-22)

Legion built tickets 10–15/18–20/22/24 in parallel with this grilling, from his own proposed numbers (ticket 12's resolution marks them AWAITING HENRY). Henry ruled the deltas:

- **Blueprint drops are PER DEFEATED ENEMY: wild/ambush 20%, elite 25% (the Driver is the elite's headline prize — supersedes this ticket's 50%), alpha 100%, gym per ticket 18.** Legion's build stands.
- **Scrap rescales to THIS ticket's table** (income 10+5/extra, elite 30; buy 15/25/35/45; removal 20; workshop 25/15) — Legion's ~450–500/run scale is replaced wholesale so the numbers stay small and legible.
- **Selling is REMOVED** (built with a buy>sell guard; comes out anyway).
- **Macro prices keep the older 'full 1e-card value' ruling — commons 32, rares 48** — superseding this ticket's 25/40. The 13th macro (map-reveal) is built; **Relay still needs adding**.

Ticket 57 applies this reconciliation to the code; nothing else in this resolution changed.

All numbers are starting values for the slice playtest (ticket 25), not ship constants.
