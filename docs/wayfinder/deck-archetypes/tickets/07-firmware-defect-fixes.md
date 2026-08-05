# Firmware defect fixes surfaced by the audit

- Type: wayfinder:task
- Status: open
- Assignee: —
- Blocked by: —

## Question

The [firmware truth audit](01-firmware-truth-and-enabler-audit.md) found live defects in the hook layer. Decks designed around broken hooks are wasted design, and the [OS design review](09-os-design-review.md) needs un-bugged sim numbers — so these mechanical fixes land first. Per fix: change, test, `npm run balance` re-run, and read the redline diff — several current §2.3 numbers are predicted to move.

This ticket is **purely mechanical** — behavior-intent questions (jormungandr_v2's heal rate, kraken_v1's breadth, fenrir_v2's self-burn, ratatoskr_v2's self-daze, draugr_v2 vs MOVES, huldra_v2's shield %) live in the [OS design review](09-os-design-review.md), not here.

- **sleipnir_v2 token loop** — WAR_STEED_OS lacks `isToken: false` (`hooks.json:669-692`; `echo_chamber` at :400 shows the correct guard). Each generated `hoof_strike` is itself an Air Attack that generates another. Fix, then check whether the sleipnir FTK redline ([power-curve-rebalance 02](../../power-curve-rebalance/tickets/02-os-variance-gaps.md), 50 first-turn kills/100) collapses — this is the prime suspect.
- **huldra_v2 player-side dead** — `turn === 1` guard at `CustomFirmware.ts:150` never matches for the player (battles start in ACTION phase; first player onTurnStart is turn 2). Make it fire once at battle start for both sides, and fix the units bug (`stacks = floor(maxHp*0.5)` where stacks are *percent* of maxHp → quadratic shield) by making the shield a linear, named % of maxHP. Use a placeholder % matching current effective mid-level values; the final number is [ticket 09](09-os-design-review.md)'s call.
- **fafnir_v2 id collision** — JSON and CustomFirmware both define `fafnir_v2_corrupted`; dedup-by-Set is the only thing preventing double energy. Delete one.
- **nidhoggr_v2 `target: "ANY"`** — passes only because the validator has no branch for it. Make the semantics explicit (either a real ANY branch in `ConditionValidator` or an explicit always-true form).
- **hraesvelgr_v1 no-op stub** — `CustomFirmware.ts:71-85` dead code, delete.

Done when: fixes merged green (vitest + tsc + build + balance), and the §2.3/§2.2 redline diff after the fixes is written down here as the new baseline the OS review and deck work start from.
