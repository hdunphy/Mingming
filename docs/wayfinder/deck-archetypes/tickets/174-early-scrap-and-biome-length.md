# Ticket 174: The early scrap squeeze and the late surplus

> **CLOSED 2026-10-02 (housekeeping, at the move to `first-impressions`).** Every row is built: 174a–174d (`ea4cd8b..44e8ba4`). The status line below is kept as history.

**Type:** run economy. **Status:** OPEN, **ruled by Henry 2026-09-30, ready to build.**

**Rulings:** D1 *"Yes, 45 scrap."* · D2 *"Leave as is."* · D3 *"Two per visit."* · D4 *"Let's add a new ticket for a map redesign; I don't love the current layout"* (ticket 176, so biome length is not changed here).

**Henry (2026-09-30):**

> *"I think the biomes are too short, or at least the first biome is, because I find myself needing a lot of scrap early on and at the end having too much scrap when I don't really need it. At the end I'm almost exclusively looking for upgrades, whereas in the beginning I'm trying to find cards to fill out my deck and add my second and third Mingming, so I find myself grinding a little bit in the beginning."*

---

## What the playtest logs show

The four logged runs (`playtest-results/2026-25-09` to `2026-29-09`), totalled per biome from each `mingming_run_log.json`:

| Run | Biome | Fights | Income | Spent on | Scrap at biome end |
|---|---|---|---|---|---|
| 09-26 Rootfall (won) | 0 | 3 | 80 | recruit 25, upgrade 25 | 50 |
| | 1 | 5 | 115 | upgrades 70, recruit 25 | 70 |
| | 2 | 6 | 110 | upgrades 70 | **110** |
| 09-27 Tidewrack | 0 | **8** | 130 | recruit 25, card 25, upgrade 35 | 65 |
| | 1 | 5 | 160 | recruits 50, upgrades 65, patch 45 | 65 |
| | 2 | 7 | 155 | upgrade 35, macro 48 | **137** |
| 09-29 Emberfall | 0 | **8** | 195 | blueprint 50, recruits 50, upgrade 35 | 80 |
| | 1 | 6 | 150 | upgrades 95, patch 45 | 90 |
| | 2 | 5 | 165 | upgrades 65, macro 48, patch 45, event 40 | 57 |

("Scrap at biome end" is after the biome's elite has paid out, so the low point sits just before it: 0–35 scrap in every biome 0.)

**Four findings:**

1. **Biome 0 is where the needs are.** Two recruits cost 50, and a blueprint at the market costs another 50 if the ranch has none. The first cards to buy cost 15–45.
2. **Biome 0 pays the least.** A wild fight pays `10 + 5 per extra enemy` (`RewardSystem.scrapForWin`), and biome 0 fields mostly one enemy, so most biome-0 wins pay **10**. Biome 2 wilds pay 20, and the final biome often has 2–3 elites at **45** each.
3. **The grinding is measurable.** A biome has 5 layers (entry, three middle layers, the exit elite), so a straight path is about 3 fights plus the elite. Two of the four runs fought **8** times in biome 0, re-entering the same wild node up to five times (09-29: layer 1, five visits).
4. **The late surplus is partly a spending cap, not only income.** Late in a run you want upgrades, but the market and workshop each allow **one upgrade per visit** (163 §2, `UpgradeBench` `allowance = 1`). In the 09-27 run, 137 scrap went unspent with upgradeable cards still in the deck.

So the curve is backwards: income rises through the run while the needs fall, and the one late purchase you want is capped.

---

## Decisions (as put to Henry; rulings at the top)

**D1. Starting scrap: 20 → 45?** *(recommended; ruled yes)*
`STARTING_SCRAP` (`createRun.ts`) is 20. At 45, the first workshop recruit (25) plus a first card (15–25) are affordable without grinding. It puts scrap exactly where the need is and changes nothing later. The ticket-09 rule ("a fixed grant every run carries nothing between runs") still holds.

**D2. Wild fight pay: leave it?** *(recommended: leave it; ruled: leave it)*
The alternative is raising `BASE_WIN_SCRAP` 10 → 15 (wilds pay 15 / 20 / 25). That helps biome 0, but it also adds scrap in biomes 1–2, which already have a surplus. D1 does the biome-0 job alone.

**D3. Upgrades per visit: one → unlimited?** *(recommended unlimited; **ruled: two per visit**)*
This turns the late surplus into the thing you want to buy. It also follows the standing "no arbitrary caps" rule; 163 §2's one-per-visit was ruled when scrap was scarce everywhere. The middle option is **two per visit**. The gauntlet has room for more late power: walker clears are 0% since 173, and your own replays are 35%.

**D4. Biome 0 length: leave it for now?** *(recommended; **ruled: moved to a map redesign, ticket 176**)*
Re-measure after D1 and D3. If you still find yourself grinding, add one middle layer to biome 0 only in a follow-up. The catch: runs are already 18–20 fights against the 10–13 target, and adding a layer means changing the save schema (`RegionNodeSchema` caps `layer` at 4) and the generator. If the grinding was driven by the scrap squeeze, fixing scrap shortens runs instead.

---

## How to work this ticket

1. **Read the whole row first.** Paths were checked against `133e0db` (2026-09-30). Search for the quoted code; line numbers drift.
2. **Test first, run it on the parent, see it fail.** Put "fails on parent: yes" in the commit message.
3. **Do not change anything a row does not list.** If a row seems to need something it does not name, stop and ask Henry.
4. **Numbers move in 5s.**
5. **Gate:** `npm run gate` green before each commit.
6. **Commits:** authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`), **no `Co-Authored-By` trailers**, last line `HANDOFF: <one sentence>`. **Do not push.**
7. **Line endings:** keep each file's. CRLF under `docs/wayfinder`; new files under `src/` are LF.
8. **Small single-purpose modules** (Henry's standing preference).
9. **Report** in plain English at the end, with the before/after table from 174d.

| Row | What | Needs |
|---|---|---|
| 174a | A scrap-curve report built from run logs (the table above, as a tool) | nothing |
| 174b | Starting scrap 20 → 45 | D1 |
| 174c | Upgrades per visit: one → two | D3 |
| 174d | Before/after measurement with the walker | 174a–c |

D2 builds nothing. D4 is ticket 176.

---

## 174a: The scrap-curve report

So every future playtest can be read the same way, without a one-off script. `runLog.ts` already has readers for whole-run totals: `runCurves`, `scrapByReason` and `cardFlow`, under "Reading it back". This adds the per-biome view beside them.

1. **`src/engine/run/scrapCurve.ts`** (new; engine rules apply, so no React and no Node APIs): `scrapCurve(log: IRunLog): BiomeScrapRow[]`, one row per biome reached:
   - `biome`, `fights` (count of `FIGHT_ENDED`)
   - `income` and `spent`, each a `Record<reason, number>` built from `SCRAP` events (positive `delta` is income, negative is spent, keyed by `reason`)
   - `scrapAtEnd`: the `scrap` field of the first event of the next biome, or of the last event for the final biome
   - `lowPoint`: the lowest `scrap` seen in that biome
   - `revisits`: the number of `NODE_ENTERED` events for a node the run had already entered. A node is identified by `biome` + `layer` + `nodeKind`, since the log carries no node id. Note that approximation in the docblock.

   The biome is read from `NODE_ENTERED.biome`. Events before the first `NODE_ENTERED` belong to biome 0.
2. **`src/debug/balance/runScrapCurve.ts`** (new): a CLI (`npx tsx src/debug/balance/runScrapCurve.ts <path-to-mingming_run_log.json>`) that prints the table for every run in the file with at least one fight. The file's shape is `{ version, logs: [{ runKey, seed, events }] }`.
3. **In game:** `src/debug/panels/RunLogPanel.tsx` already draws `runCurves` and `scrapByReason`. Add the per-biome table under them, so Henry can read it right after a run.
4. **Tests** (`scrapCurve.test.ts`): a hand-built log of two biomes gives the right fights, income, spent, low point and end scrap; a revisit is counted once per re-entry; a log with no fights gives no rows.
5. Run it on the four `playtest-results/*/*/mingming_run_log.json` files and paste the output into the commit message. It should match the table at the top of this ticket.

## 174b: Starting scrap 20 → 45 (D1)

1. `createRun.ts`: `STARTING_SCRAP = 45`. Update its docblock with one dated line: *"Henry, 2026-09-30, ticket 174: 20 → 45. Biome 0 is where the recruits and first cards are bought, and it pays the least."*
2. Update any test that asserts 20 (search `STARTING_SCRAP` and `scrap: 20` in tests). Assert the constant, not a copied number.
3. If a tip or screen prints the starting scrap as text, it should read the constant. Search `src/ui` and `src/engine/tips.ts` for "20 scrap".

## 174c: Upgrades per visit, one → two (D3)

1. **A named constant:** in `src/engine/run/marketplace.ts`, beside the upgrade prices, add `export const UPGRADES_PER_VISIT = 2;` with a docblock: *"Henry, 2026-09-30, ticket 174: two per visit at the market and the workshop (was one, 163 §2). Late runs had scrap and upgradeable cards but nowhere to spend it."*
2. **`MarketplaceNode.tsx` and `WorkshopNode.tsx`:** each renders `<UpgradeBench ... benchKey={`${node.id}:${node.visited}`} ...>` with no `allowance`, so the default of 1 applies. Pass `allowance={UPGRADES_PER_VISIT}` at both, and change the heading from `"UPGRADE — ONE CARD IN YOUR DECK"` to `"UPGRADE — UP TO TWO CARDS IN YOUR DECK"`. In `UpgradeBench.tsx`, the sub-heading prints `'one per visit'` for every paid bench (search `'one per visit'`). Make it read the allowance: `one per visit` when it's 1, `${allowance} per visit` otherwise. Add `· N left` once one has been used this visit.
3. **Leave `UpgradeBench`'s default, the reducer's default and every other venue unchanged:** the event benches (Overclock Rig's 2, Abandoned Terminal's 1) and the gym gate's free upgrade.
4. **`runSlice.ts`:** the upgrade reducer already honours `allowance` (`spent.filter(...).length >= (allowance ?? 1)`), and `UpgradeBench` already forwards its `allowance` prop in the dispatch, so no reducer change is needed.
5. **Docs:** update the `upgradesTaken` docblock in `runTypes.ts` (search `ONE UPGRADE PER VISIT`) with a dated line: *"Henry, 2026-09-30, ticket 174: two per visit at the market and workshop (`UPGRADES_PER_VISIT`); event benches and the gym gate keep their own allowances."*
6. **Tests:**
   - on one market visit, two paid upgrades succeed and the third is refused
   - leaving and re-entering the node (a new `visited` count) allows two more, as one did before
   - the same at the workshop
   - the Overclock Rig event bench still stops at 2, and the gym gate still gives exactly one free upgrade

## 174d: Measure before and after

1. **The walker's upgrade policy** (`chooseUpgrade` in `runWalker.ts`) currently takes one upgrade per bench. Let it take up to `UPGRADES_PER_VISIT` per bench, by its own existing ranking, while it can afford them and an upgradeable card remains. Without this, the walker cannot show the surplus being spent.
2. **Expose the walker's run log.** `walkRun` already builds a log (`let log = emptyRunLog(...)`, then `appendRunEvent`), but `WalkResult` does not return it. Add `readonly log: IRunLog` to `WalkResult` and return it. It already records `NODE_ENTERED` (with `biome`) and `FIGHT_ENDED`. It records `SCRAP` only for fights, events and blueprints (reasons `'fight'`, `'event'`, `'blueprint'`), not for the other things it pays for. Next to each `store.dispatch(...)` that spends scrap (`buyMarketCard`, `upgradeDeckCard`, `recruitIntoParty`, a paid `fitPatch`), add `record({ kind: 'SCRAP', delta: -price, reason: '<the reducer name>' })`, the same reason names the game's log uses. Without these, the walker's "spent" column is missing most of its spending.
3. **Run** the walker on the same seeds before (parent commit) and after (174b + 174c): `walkStarter` for each of `eaStarters()`, 30 seeds each. Build the same per-biome table from the walker's run logs using `scrapCurve`.
4. **Write** `docs/balance/scrap-curve-174.md` (LF): per biome, before and after:
   - mean fights
   - mean income and spend by reason
   - mean low point and scrap at biome end
   - mean revisits

   Also include the win rates (wild, elite, gym clear).
5. **Do not tune anything else.** Report the numbers to Henry. They also feed ticket 176, the map redesign.

---

## Done when

- The report tool works on real playtest logs (174a).
- Runs start with 45 scrap (174b), and the market and workshop each allow two paid upgrades per visit (174c).
- `docs/balance/scrap-curve-174.md` shows biome 0's low point and the final biome's leftover scrap before and after (174d).

## Resolution

Closed 2026-10-02: all rows built on `playtest-polish` (`ea4cd8b..44e8ba4`), merged to `main` in PR #13.
