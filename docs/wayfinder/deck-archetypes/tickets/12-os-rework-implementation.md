# OS rework implementation: CRUSADER_KERNEL, BLOOD_SCENT_OS, GRAVE_CHILL_OS + einherjar_standard

- Type: wayfinder:task
- Status: open
- Assignee: —
- Blocked by: [11-os-rework-specs](11-os-rework-specs.md) (closed — specs are final there)

## Question

Implement the three [rework specs](11-os-rework-specs.md) and the EINHERJAR daemon conversion, gates green, new balance baseline committed. Work items:

1. **valkyrie_v2 CRUSADER_KERNEL** — `CustomFirmware.ts` onDamageCalculated (own Light ATTACK): `1 + 0.1 × distinct buff types on owner` (Strengthened/Sharp/Regen/StableOS/Energized/BarkShield). Replace the EINHERJAR hooks.json entry; update name/description.
2. **nidhoggr_v2 BLOOD_SCENT_OS** — needs the **general-purpose threshold event**: emit `onHpThresholdCrossed` (threshold 50%, direction down, re-armed on heal back above) from the HP-loss choke point in `effectHandlers.ts` so attacks, DoT ticks, recoil and self-damage all count. OS hook: +2 Strengthened +2 Sharp to Nidhoggr per crossing, any unit, either side. Delete FALLEN_FEAST.
3. **draugr_v2 GRAVE_CHILL_OS (rebuilt)** — incoming-damage multiplier ×0.8 when the damage source has ≥2 distinct debuff types. Verify defender-side onDamageCalculated hooks run for both card and intent damage; if the pipeline only consults attacker hooks today, add the defender pass as general-purpose engine work (this OS first consumer). Replace the cost-tax hook.
4. **einherjar_standard daemon card** — new Light Daemon program, 2e, exhaust: own Light attacks ×(1+0.1×ALIVE_ALLIES) while active. Registers the retired EINHERJAR fantasy as player-earnable; expect a CARD_OVER_BUDGET manual-review flag (ally-scaling is board-state-dependent) — annotate rather than suppress.
5. **Tests** — regression tests in `OSGapClosures.test.ts` (or a new `OSReworks.test.ts`): CRUSADER counts types not stacks; BLOOD_SCENT procs on DoT crossing, re-arms on heal, self-drop procs, 25%-cap bounded; GRAVE_CHILL fires vs MOVES intents; einherjar daemon inert in 1v1.
6. **Gates + baseline** — `npx vitest run`, `npx tsc -b`, `npx vite build`, `npm run balance`; commit `docs/balance/` artifacts; record the redline diff here. Expected: nidhoggr's §2.3 pair becomes two live hooks for the first time (its 90%-on-40-decided gap and 60% stall rate should both move); valkyrie's pair becomes measurable-in-1v1 for the first time; draugr_v2 stays quiet until its deck applies 2 debuff types (that's ticket 04's job, not a bug).

Done when: all four items merged green, the diff table is in this ticket's resolution, and the map baseline note points at the new registry hash.
