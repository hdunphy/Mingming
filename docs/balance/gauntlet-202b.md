# Ticket 202b: the walker's gauntlet before and after a revive between fights

Henry ruled on 2026-10-07: a downed member comes back for the next gauntlet fight. The floor (decision D1) is built as one constant, `GAUNTLET_REVIVE_PERCENT = 30` in `src/engine/run/gauntletRevive.ts`. This page measures what that does to the walker's gauntlet and leaves D1 to Henry. Nothing here was tuned to chase a number: 30% is the proposed floor and it is the only value measured.

## The answer

The walker clears **19.2%** of gauntlets before the revive (23 of 120) and **30.8%** after (37 of 120), on the same 120 gates.

| Gym | Starters (195k: the gym their element beats) | n | Clears before | Clears after |
|---|---|---|---|---|
| Rootfall | fenrir_v1, fenrir_v2, skoll_v1, skoll_v2 | 60 | **19 / 60 (31.7%)** | **26 / 60 (43.3%)** |
| Emberfall | kraken_v1, kraken_v2, jormungandr_v1, jormungandr_v2 | 60 | **4 / 60 (6.7%)** | **11 / 60 (18.3%)** |
| Both | | 120 | **23 (19.2%)** | **37 (30.8%)** |

**Paired, seed for seed:** in both gyms every gauntlet that was cleared before is cleared after (0 lost), and 7 more are cleared in each gym (14 in all, 0 the other way). A sign test on 14 against 0 is p < 0.001, so the rise is not noise. The ruled gauntlet target is 60% (`RUN_GATE_TARGETS.gauntlet`); neither gym reaches it with the revive at 30%, and Emberfall is far below it.

## Fight by fight

Rates are of the gauntlets that reached that fight (a fight is only played if the one before was won).

| Gym | Arm | Fight 1 | Fight 2 | Boss (fight 3) | Of those that won fight 2, ended it with a member at 0 |
|---|---|---|---|---|---|
| Rootfall | before | 55/60 (91.7%) | 30/55 (54.5%) | 19/30 (63.3%) | 9 of 30 |
| Rootfall | after | 55/60 (91.7%) | 46/55 (83.6%) | 26/46 (56.5%) | 24 of 46 |
| Emberfall | before | 50/60 (83.3%) | 19/50 (38.0%) | 4/19 (21.1%) | 14 of 19 |
| Emberfall | after | 50/60 (83.3%) | 29/50 (58.0%) | 11/29 (37.9%) | 23 of 29 |

Reading it:

1. **Fight 1 is identical, as it must be.** Nothing happens before the first fight, so the two arms play the same fight 1 from the same gate. The 5 Rootfall and 10 Emberfall gauntlets that lose fight 1 lose it in both arms.
2. **The revive pays off in fight 2, not at the boss.** A member who falls in fight 1 now plays fight 2 at 30%, and fight 2 goes from 54.5% to 83.6% (Rootfall) and from 38.0% to 58.0% (Emberfall).
3. **The boss rate per gauntlet that reaches it does not rise in Rootfall (63.3% to 56.5%).** That is expected: before the revive, the gauntlets that reached the boss were the ones that had come through fight 2 in good shape; after it, many more weaker parties reach the boss, so the boss is played by a harder mix. The number that answers Henry's question is the whole-gauntlet clear rate in the first table. In Emberfall the boss rate does rise (21.1% to 37.9%).
4. **Parties still arrive at the boss hurt.** Of the gauntlets that won fight 2 with the revive, someone ended it at 0 HP in 24 of 46 (Rootfall) and 23 of 29 (Emberfall). Before the revive that member stayed down for the boss; now they come back at 30%, not at full, so a revived member is a weak body at the boss. This is the column to look at if Henry thinks 30% is too small.

## Which command produced each number

All three steps run on the repo's own balance tooling: the 170a ghost walk (`walkToGym`) and `playGauntlet` in `src/debug/balance/ghostWalk.ts`, which play the gauntlet through `walkRun` with HP carried between fights (173b). The driver is `scratch/t202b_gauntlet.ts`, new in this commit.

1. **Walk to the gate, once** (a lost fight on the way is carried on as a win, so every seed reaches the gate; 120 of 120 did). This does not touch the gauntlet rule, so the gate is identical in both arms. Run on `e8b289a1`:

       npx vite-node scratch/t202b_gauntlet.ts -- --mode walk --gym gym_rootfall  --from 0 --to 60 --dir gates
       npx vite-node scratch/t202b_gauntlet.ts -- --mode walk --gym gym_emberfall --from 0 --to 60 --dir gates

2. **Play the gauntlet from those gates, before** (tree at `e8b289a1`, the parent: a downed member stays down):

       npx vite-node scratch/t202b_gauntlet.ts -- --mode play --gym gym_rootfall  --from 0 --to 60 --dir gates --out before-rootfall.jsonl
       npx vite-node scratch/t202b_gauntlet.ts -- --mode play --gym gym_emberfall --from 0 --to 60 --dir gates --out before-emberfall.jsonl

3. **Play the same gauntlets, after** (tree at `ebe8f288`, the revive at 30%): the same two `--mode play` commands.

Seeds are `t202b:<gym>:<i>` for i = 0 to 59; seed i plays starter i mod 4 from the list above, so each starter has 15 seeds in its gym. The sampling is identical in the two arms because both play the same saved gate and the same seeded fights. Every run's row (starter, seed, each fight won or lost, turns, each member's HP at the end of the fight) is in `docs/balance/gauntlet-202b-rows.jsonl`, 240 rows (`arm` is `before` or `after`).

## Is the instrument sound

The ticket's stop condition: the walker's before-number must reproduce the 172f figures. The 172f page has no walker figure (its tools played every gauntlet fight from full HP, which 173b fixed), so the reproducible figure is 172f's own replay, `scratch/t172_gauntlet.ts`, with the same 20 samples of Henry's 2026-09-30 gate. Run on the commit 172f was written against (`8612c83d`):

| Heal between fights | 172f page | Re-run on `8612c83d` | Re-run on `e8b289a1` (today's parent) |
|---|---|---|---|
| 0% (downed stay down) | 4 / 20 | 5 / 20 | not run |
| 30% (today's repair) | 7 / 20 (fights 20, 18, 7) | 8 / 20 (fights 20, 18, 8) | 11 / 20 (fights 20, 19, 11) |

On the commit it was written for the replay is within one sample of 172f (5 points, inside its own stated plus or minus 20). On today's parent it is 55% rather than 35%: the same party at the same gate wins more, because the game has changed in many ways since 30 September (tickets 173 to 201 touched cards, enemy decks and the AI). So the instrument is sound and the drift is the game's. That script has a typo in its save path (`playtest-results/2026-29-09/...`, the folder is `2026-09-29`), which I corrected in a scratch copy and did not commit.

The ticket 77 run-gate cells (`npm run balance:77`, `gauntlet:fight2`) were **not** used for the number. They play each gauntlet fight from full HP by design (`runRunGate.ts`), so the revive cannot change them. The walker is the only balance tool that carries HP between fights.

## What this does not say

- **One policy, one party shape.** The walker is a bot with one buying and recruiting policy; it picks the starter's own element against the gym's weakness (195k's matchup), so these are the favourable matchups. A human, and the unfavourable matchups, differ.
- **No Draughts are fired.** Neither arm uses a Revive or Mend Draught; a player who saves a Revive for the boss is better off in both arms.
- **Only 30% was measured.** I did not run 50% or any other floor.

## For Henry: D1, does 30% hold

The floor is one constant, `GAUNTLET_REVIVE_PERCENT` in `src/engine/run/gauntletRevive.ts`, and moves in 5s. The alternatives in the ticket are 50% ("a real second chance") or the same HP a Revive Draught gives. **The Draught revives at 50% (`REVIVE_PERCENT_MAX_HP`, `macroRegistry.ts`), so those two alternatives are the same number.** Henry rules; if he picks 50%, change the one constant, and rerun steps 3 of the commands above to measure it against the same gates (the gates and the `before` rows do not need to be redone).
