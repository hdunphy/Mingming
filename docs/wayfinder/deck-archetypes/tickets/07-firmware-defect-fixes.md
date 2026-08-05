# Firmware defect fixes surfaced by the audit

- Type: wayfinder:task
- Status: open
- Assignee: —
- Blocked by: —

## Question

The [firmware truth audit](01-firmware-truth-and-enabler-audit.md) found live defects in the hook layer. Decks designed around broken hooks are wasted design, so these land before (or alongside) the first archetype pass. Per fix: change, test, `npm run balance` re-run, and read the redline diff — several current §2.3 numbers are predicted to move.

Mechanical fixes (no design input needed):

- **sleipnir_v2 token loop** — WAR_STEED_OS lacks `isToken: false` (`hooks.json:669-692`; `echo_chamber` at :400 shows the correct guard). Each generated `hoof_strike` is itself an Air Attack that generates another. Fix, then check whether the sleipnir FTK redline ([power-curve-rebalance 02](../../power-curve-rebalance/tickets/02-os-variance-gaps.md), 50 first-turn kills/100) collapses — this is the prime suspect.
- **huldra_v2 player-side dead** — `turn === 1` guard at `CustomFirmware.ts:150` never matches for the player (battles start in ACTION phase; first player onTurnStart is turn 2). Also the units bug: `stacks = floor(maxHp*0.5)` but BarkShield stacks are *percent* of maxHp → shield scales quadratically. Decide the intended shield % and fire-once mechanism.
- **fafnir_v2 id collision** — JSON and CustomFirmware both define `fafnir_v2_corrupted`; dedup-by-Set is the only thing preventing double energy. Delete one.
- **nidhoggr_v2 `target: "ANY"`** — passes only because the validator has no branch for it. Make the semantics explicit.
- **hraesvelgr_v1 no-op stub** — `CustomFirmware.ts:71-85` dead code, delete.

Design-choice fixes (flag to Henry, don't silently decide):

- **jormungandr_v2 over-fire** — no `when` clause: heals at the end of *both* sides' turns (4 HP/round in 1v1, more with allies) vs the described 2/turn. Intended rate? The §2.3 gap (v2 favored, 36%) was measured against the over-firing version.
- **kraken_v1 breadth** — no `source` condition: procs on any side's effect-draws. Intended?
- **fenrir_v2 self-burn** — grants Sharp when Fenrir burns *himself* (`all_in`). Intended synergy or leak?
- **ratatoskr_v2 self-daze** — 0-cost self-target cards (`soothe`, `healing_mist`) daze Ratatoskr himself. Intended?
- **draugr_v2 vs MOVES** — cost hooks only run on card plays, so the OS does nothing against the default intent enemies. Accept as CARDS-only, or rethink in the archetype pass?

Done when: mechanical fixes merged green (vitest + tsc + build + balance), design-choice items each have Henry's call recorded, and the §2.3/§2.2 redline diff after the fixes is written down here as the new baseline the deck work starts from.
