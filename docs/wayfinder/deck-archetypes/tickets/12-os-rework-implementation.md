# OS rework implementation: CRUSADER_KERNEL, BLOOD_SCENT_OS, GRAVE_CHILL_OS + einherjar_standard

- Type: wayfinder:task
- Status: closed
- Assignee: wayfinder (Claude session, 2026-08-05)
- Blocked by: [11-os-rework-specs](11-os-rework-specs.md) (closed)

## Question

Implement the three [rework specs](11-os-rework-specs.md) and the EINHERJAR daemon conversion, gates green, new balance baseline committed.

## Resolution

All four items landed (2026-08-05). Gates: **657/657 vitest** (10 new tests in `OSReworks.test.ts`, 1 stale `hookWiring` test rewritten to the rebuilt hook), `tsc -b` clean, `vite build` clean, `npm run balance` committed.

**The general-purpose engine event** — `onHpThresholdCrossed` (HookTypes + `crossedDownHalf`/`fireHpThresholdCrossed` in `resolutionEngine.ts`): fires once per downward crossing of 50% maxHP, re-armed naturally by healing (crossings, not states, are detected — no counters needed). Three integration sites cover every HP loss: `handleAttack` (which turned out to be the shared choke point for card attacks, intent attacks, hook ATTACK actions *and* HP mutations — mutations route through `effectHandlers['ATTACK']`), the status-apply overflow path (Burn bursts), and the end-of-turn DoT tick loop in `battleReducer`.

**The three OSes:**

- `valkyrie_v2` **CRUSADER_KERNEL** — CustomFirmware onDamageCalculated: Light attacks ×(1 + 0.1 × distinct positive status *types* on her). Tested: types-not-stacks (5 Sharp stacks = +10%, Sharp+Regen = +20%).
- `nidhoggr_v2` **BLOOD_SCENT_OS** — hooks.json on the new trigger: +2 Strengthened +2 Sharp per crossing, any unit, either side. Tested: direct damage, no-proc above the line, self-inflicted crossing, **re-arm via heal (4 stacks after two crossings)**, and DoT-tick crossing at enemy turn end.
- `draugr_v2` **GRAVE_CHILL_OS** — hooks.json onDamageCalculated ×0.8 when the attacker has ≥2 distinct debuff types. Defender-side hooks were already consulted (`applyDamageModifiers` collects from source *and* target — no engine gap). Tested against a card play **and against an EXECUTE_INTENT attack** — the thing the old cost-tax could never see.
- `einherjar_standard` — new Light Daemon card (2e, exhaust) + hooks.json entry + `daemonHooks.ts` registration: Light attacks ×(1+0.1×ALIVE_ALLIES). Tested inert in 1v1, +10% with one ally. Audits clean (112 cards, no new budget redline).

**New balance baseline** (registry `1:421c0302` → `1:5e763093`, redlines 35 → 36) — the reworked pairs measured with live firmware for the first time:

| pair | pre-rework | post-rework | reading |
|---|---|---|---|
| valkyrie | 57/43 (both hooks dead — pure deck noise) | **v2 wins 69/100 — new 19% OS_GAP redline** | CRUSADER is alive and strong on the shared deck (4 self-buff cards feed it); a real deck-fit signal at last, resolved by giving each OS its own deck in ticket 04 |
| nidhoggr | v2 90% of 40 decided (dead hook — noise) | **v2 94.6% of 37 decided** | BLOOD_SCENT feasts on the shared poison deck's chip crossings; the 63-stall mirror is the poison deck's problem, not the OS's |
| draugr | 56.8/43.2 of 37 | unchanged, as predicted | shared deck applies only Weakened (1 debuff type) → GRAVE_CHILL never fires until draugr's deck carries a second type — the [Ice sleep package](09-os-design-review.md)'s job |
| everything else | — | byte-identical | 20 budget + 7 stalls + the other gaps carry over |

Nothing on the map is blocked on firmware anymore: all 32 variants are implemented, defect-free, and 1v1-measurable (valkyrie_v1 team-by-design excepted). The remaining §2.3 redlines are now entirely a *deck* problem — ticket 04's territory.
