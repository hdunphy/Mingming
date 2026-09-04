# Firmware defect fixes surfaced by the audit

- Type: wayfinder:task
- Status: closed
- Assignee: wayfinder (Claude session, 2026-08-05)
- Blocked by: —

## Question

The [firmware truth audit](01-firmware-truth-and-enabler-audit.md) found live defects in the hook layer. Decks designed around broken hooks are wasted design, and the [OS design review](09-os-design-review.md) needs un-bugged sim numbers — so these mechanical fixes land first. Per fix: change, test, `npm run balance` re-run, and read the redline diff.

This ticket is **purely mechanical** — behavior-intent questions (jormungandr_v2's heal rate, kraken_v1's breadth, fenrir_v2's self-burn, ratatoskr_v2's self-daze, draugr_v2 vs MOVES, huldra_v2's shield %) live in the [OS design review](09-os-design-review.md), not here.

- **sleipnir_v2 token loop** — WAR_STEED_OS lacked `isToken: false`; each generated `hoof_strike` was itself an Air Attack that generated another.
- **huldra_v2 player-side dead** — `turn === 1` guard never matched for the player (battles start in ACTION phase; first player onTurnStart is turn 2), plus the quadratic-shield units bug (`floor(maxHp*0.5)` stacks where stacks are *percent* of maxHp).
- **fafnir_v2 id collision** — JSON and CustomFirmware both defined `fafnir_v2_corrupted`; dedup-by-Set was the only thing preventing double energy.
- **nidhoggr_v2 `target: "ANY"`** — passed only because the validator had no branch for it.
- **hraesvelgr_v1 no-op stub** — dead code in `CustomFirmware.ts`.

## Resolution

All five fixes landed (2026-08-05), all gates green: **647/647 vitest** (4 new regression tests in `OSGapClosures.test.ts` under "Ticket 07"), `tsc -b` clean, `vite build` clean, `npm run balance` re-run and committed.

What changed where:

- `hooks.json` — sleipnir_v2's `when` gains `"isToken": false` (mirrors echo_chamber's guard).
- `CustomFirmware.ts` — huldra_v2 rebuilt: the shield now lands at the owner's **first turn boundary** (onTurnStart *or* onTurnEnd, once-guarded per owner) — enemy-side at her turn-1 pre-turn, player-side at the end of turn 1, in both cases before the opposing side's first attack resolves against her. Shield is now a flat `HULDRA_V2_SHIELD_PERCENT = 50` stacks (= 50% maxHP, linear) — **placeholder; the final % is [ticket 09](09-os-design-review.md)'s call**. The fafnir_v2 duplicate and the hraesvelgr_v1 stub are deleted (notes left in place).
- `ConditionValidator.ts` + `HookTypes.ts` — `'ANY'` is now a named, typed always-match value on the source/target axes instead of validator fall-through.

**New balance baseline** (registry `1:1cba1e2c` → `1:e4a7f49f`, report committed):

- **The sleipnir FTK redline is gone: 50/100 first-turn kills → 0.** The token loop was the FTK engine, as predicted. Redline count 37 → 36.
- sleipnir OS_GAP barely moved (50% → 49%; v2 wins 99/100 decided) — with the loop removed, v2's dominance over v1 on the shared deck is now a *real* signal for [ticket 09](09-os-design-review.md) rather than an artifact of infinite free attacks.
- huldra: v2's shield now actually fires for both sides; pooled gap stays under the cap (v1 44.4% of 99 decided, was 42.9% of 98).
- **Everything else is byte-identical** — all 20 CARD_OVER_BUDGET, all 7 TURN_COUNT stalls, and the other 8 OS_GAP redlines have exactly the same values, confirming the fixes touched nothing they shouldn't (and that jormungandr_v2's over-fire, being a ticket-09 design question deliberately not fixed here, still shapes its 36% gap).

This is the baseline the [OS design review](09-os-design-review.md) and all deck work measure against.
