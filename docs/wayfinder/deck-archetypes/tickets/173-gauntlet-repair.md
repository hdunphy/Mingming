# Ticket 173: A 30% repair between gauntlet fights

**Type:** game change and a balance-tool fix. **Status:** RULED by Henry 2026-09-30.

**Source.** Henry's answers to the ticket 172 report, after 172f replayed his Emberfall gauntlet loss (`docs/balance/gauntlet-172.md`):

1. Surge Protection and Poison Injection: *"Good."*
2. The heal between gauntlet fights: *"30% is fine. I've beaten the gym before with a different deck. You have to lose sometimes it just can't feel unfair to lose."*
3. Make the balance walker carry gauntlet HP: *"Sure."*
4. Jormungandr v1's fight-one read: *"Ignore for now."*

One commit per row, test first, authored by Henry, no push.

| Row | What |
|---|---|
| 173a | Between gauntlet fights, every member still standing repairs 30% of max HP; the pit stop says how much each got |
| 173b | The run walker carries gauntlet HP into each fight and applies the same repair |

**Assumption (not ruled):** the repair does not bring a downed member back. A member at 0 stays at 0 until a Revive. 172f measured it this way, and it keeps Revive the answer to a lost body.

---

## 173a: The repair

- `engine/run/gauntletHeal.ts`: `GAUNTLET_HEAL_PERCENT = 30` and `healBetweenFights(hp, maxHp)`. It adds floor(30% of max), capped at max, and gives 0 to a downed member.
- `advanceGauntlet` takes each member's `maxHp` and, when it is given, applies the repair before writing `persistedHp`. What each member got is saved as `gauntlet.healedHp` (optional, so old saves load), rewritten each fight.
- `BattleArena` passes `maxHp`.
- The pit stop says "Between fights, every member still standing repairs 30% of its max HP", tags the party "HP carries between fights · +30% repair", and shows "+N repaired" on each member who got some. No hidden math.
- The gym tip reads "three fights back to back, with only a 30% repair in between".
- `exploration-map.md`'s "NO healing between them" carries an amendment line.

## 173b: The walker

`runWalker.ts` printed the carried HP in its log and never gave it to the fight, so every gauntlet fight it played started at full HP. That is 172f's "100%" row, not the game. `withCarriedHp` now puts each member's carried HP on the fight's setup, and the gym loop passes `maxHp` to `advanceGauntlet`, so the walker uses the game's own repair rather than a copy of it.

This moves the walker's gauntlet numbers once, on purpose. Nothing before the gym changes. Before and after on the same seeds are in the outcome note.
