# Ticket 186: What the agent playtester's tool found in the game

**Type:** bugs and wording (small). **Status:** OPEN. Written 2026-10-02 by the playtester agent (ticket 180, rows a–f). **Nothing here is fixed.** Ticket 180's rule 3 says the playtester never changes game code, so each item is reported here for Henry to rule on.

**Where it comes from.** Building the playtester meant playing the game through a text tool, hundreds of times, and replaying every session. This ticket lists what looked wrong. Each item says how sure it is, because some of these were looked at again and turned out to be by design.

**Not part of this ticket:** win rates and balance numbers (the walker and the sims own those), and the Strength nerf and reward weighting (ticket 185).

---

## How to work this ticket

1. **Read the whole row first.** Search for the quoted names; line numbers drift.
2. **Test first, run it on the parent, see it fail.** Put "fails on parent: yes" in the commit message.
3. **One commit per row,** gate green first. The screens agent and the playtester agent share this folder and branch: follow `HANDOFF.md` ("Two agents in parallel"), stage explicit paths only, and don't push.
4. **Rows 186a and 186b are engine changes. Rows 186c–186e are UI or wording.** Check 186c against ticket 176 (the map redesign) before building it; 176 may remove the problem.

| Row | What | How sure |
|---|---|---|
| 186a | The battle engine makes random ids that cannot be replayed | Sure (two lines of code) |
| 186b | A fight crashed on seed `ps2` | Seen once, not reproducible now |
| 186c | Map nodes with the same name cannot be told apart | Sure (seen on screen) |
| 186d | Card text understates what Fenrir's firmware adds | Probably by design; wording to rule on |
| 186e | Damage with no named source is credited to `SYSTEM` | Not measured; needs a look |

---

## 186a: Random ids in the battle engine

1. **The problem.** Two places in the battle engine make an id with `crypto.randomUUID()`:
   - `src/engine/StatusBehaviors.ts` at about line 108 (a new status instance);
   - `src/engine/effectHandlers.ts` at about line 751 (a card the effect generates).

   Instance ids on the run's creation path come from the seeded stream, and `createRun.ts` and `SeedStream.ts` both say they must never use `crypto.randomUUID()`, so that a recorded run replays. These two places do not follow that rule. Two plays of the same battle from the same seed give states that differ only in those ids.
2. **Why it matters.** Anything that compares or replays a battle by state, such as a saved run or a bug repro, sees a difference that is not real. The playtester works around it: `src/debug/playtest/battle/stableIds.ts` renames each id to `tok_<n>` after every move, and a test (`battle.test.ts`, "the same session replays to the same state") fails without that.
3. **The fix to decide.** Draw those two ids from the same seeded source as the rest, or from a counter kept in the battle state. The battle state may not carry a stream today; check before choosing. Order matters: the id must not change what the AI or the reducer does.
4. **Tests:** play one fixed fight twice, with no renaming, and assert the two final states are equal; the playtester's `stableIds.ts` and its test can then be deleted.

## 186b: A fight crashed on seed `ps2`

1. **What was seen** (during 180c, early on 2026-10-02): playing seed `ps2` in `run` mode, the first fight threw inside the engine. A status tick handed a stub card to a Driver's hook condition. The playtester caught it, ended the run as `abandoned`, and kept the message. Seed `ps12` was noted as the same kind of failure.
2. **What was tried since:** 360 `run`-mode walks (seeds `ps1`–`ps30`, all 12 starters, gym 0, 300 moves each) and another 72 (seeds `ps2` and `ps12`, all 12 starters, all 3 gyms, up to 1,500 moves each). **None threw.** So either another change fixed it, or it only happens on a path those walks did not take (for example in `turn` or `card` mode, where the agent picks the plays).
3. **What to do.** Do not build anything yet. The nightly playtest records every engine throw as an `engine-error` invariant failure, with a replay command that reproduces it exactly (a session file is a perfect repro). If one shows up in the morning report, that session is the failing test for this row. If a week of nights shows none, close the row.

## 186c: Map nodes with the same name cannot be told apart

1. **What was seen.** Neighbouring nodes can carry exactly the same name. On the first map screen at least two of the nodes you can step to read identically (for example two moves both reading "Go to Wild, Water, biome 1, layer 1" in the text tool). In the real map, `RegionMap.tsx` gives each node a tooltip and a travel-list entry made from that same text, and one rendered map had two nodes both titled "Wild, Nature, biome 1, layer 1". A player (or an agent) can only tell them apart by where they sit.
2. **Why it may not need building.** Ticket 176 redesigns the map and the towns. If the new map names or marks its nodes differently, this goes away. Check 176 before doing anything.
3. **If it stays.** Give each reachable node a distinguishing word the game already has (its element, what it drops, or which fight it is), so the same label is never shown twice on one screen.
4. **Test:** on a fresh run, no two reachable nodes share a label.

## 186d: Card text understates what Fenrir's firmware adds

1. **What was seen.** In a play log, a Fenrir card whose text promised 1 Strengthened gave 3. The extra 2 comes from the firmware (UNBOUND_KERNEL's "no-cap Strength scaler"). That is almost certainly the design. But the card text does not mention it, so a new player's prediction is wrong every time, and the playtester's `card` mode will log this as a surprise on every Fenrir card.
2. **To rule on.** Is it fine that a card's own text leaves out what the firmware adds to it? If yes, nothing to build, and the nightly report's surprise list is where it will show up so Henry can see how often it happens. If no, the card text or the firmware's own line needs to say it. See also ticket 185, which touches Strength.

## 186e: Damage with no named source is credited to `SYSTEM`

1. **What was seen.** In the damage ledger, damage from effects that carry no source id is booked to the source `SYSTEM` (`resolutionEngine.ts` lines 32, 48 and 100; `effectHandlers.ts` line 596). The playtester prints "the five biggest hits" from the ledger, and some of them read `SYSTEM`.
2. **Not measured.** It is unknown how much damage this hides, or whether it matters beyond the display. It may be the right label for damage over time. Measure first: over a handful of fights, what share of ledger damage is `SYSTEM`, and from which effects.
3. **If it matters,** the fix is to pass the real source through. If it does not, close the row.

---

## Checked and not a bug

These were first noted as game bugs and then looked at again. They are here so nobody opens them twice.

- **Wild enemies carry the firmware id `run-gate:no-firmware`.** That is a deliberate marker in the balance tool's run translation (`NO_FIRMWARE_OS`, `src/debug/balance/runWalker.ts` and `runGate.ts`). It resolves to nothing on purpose, so a wild enemy has no firmware. It is not a game bug.
- **The battle's list of legal plays can include a play the reducer then refuses.** `src/engine/ai/legalActions.ts` documents this on purpose: it keeps the reducer out of the list. The playtester logs each such play as `move-refused`. It matters only if the real battle screen offers a play it then ignores, which has not been seen.

## Done when

- 186a is fixed and the playtester's `stableIds.ts` is gone, or Henry rules that the renaming stays.
- 186b is either reproduced by a night's session file and fixed, or closed after a quiet week.
- 186c, 186d and 186e each have a ruling (build, wording only, or close).
