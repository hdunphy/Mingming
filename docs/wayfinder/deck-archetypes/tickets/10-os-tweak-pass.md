# OS tweak pass (implements the 09 verdicts)

- Type: wayfinder:task
- Status: closed
- Assignee: wayfinder (Claude session, 2026-08-05)
- Blocked by: —

## Question

Implement the six TWEAK verdicts from the [OS design review](09-os-design-review.md), run all gates, and commit the new balance baseline: jormungandr_v2 own-turn heal, kraken_v1 own-side draws, fenrir_v2 description fix (behavior kept), ratatoskr_v2 enemy-only daze, huldra_v2 comment finalization (50% is the decided value), ymir_v2 +50% → +35%.

## Resolution

All six landed (2026-08-05), gates green: 647/647 vitest, `tsc -b` clean, `vite build` clean, `npm run balance` committed. Edits: `hooks.json` (jorm_v2_heal `when: {source: SELF}`; kraken_v1 `source: ALLY` + description; ratatoskr_v2 `target: OPPONENT` + description; fenrir_v2 description "to any unit — including himself"; ymir_v2 description 35%), `CustomFirmware.ts` (ymir ×1.5 → ×1.35; huldra comments finalized), `OSGapClosures.test.ts` (Item 9 assertion ×1.35).

**Post-tweak baseline** (registry `1:e4a7f49f` → `1:421c0302`, redlines 36 → 35):

| metric | pre-tweak | post-tweak | note |
|---|---|---|---|
| ratatoskr OS gap | 18% (v1 68/32) — **redline** | **6% (56/44) — cleared** | enemy-only daze stopped v2 sabotaging itself |
| jormungandr OS gap | 36% (v2 86/100) | **22% (72/100)** | own-turn heal halved the passive; remainder is the shared poison deck favoring passive sustain over v1's combo — deck work's problem |
| ymir OS gap | 38% (v2 88/100) | 35% (85/100) | +35% still strong when the shared deck is 10 Ice cards all feeding it — the watch item stands for ticket 04's ymir decks |
| kraken OS gap | 50% (v2 87/87) | 47.9% (v2 94-of-94 minus 2) | v1's ink no longer procs on enemy draws; still capped by v2's dead-in-deck hook until decks split |
| kraken mirror | 61.0 avg turns, 400/400 draws | **54.7 avg turns, 354/400 draws** | own-side ink restriction shortened the eternal mirror |
| fenrir OS gap | 16.7% | 16.7% (unchanged, as expected) | description-only change; stays just over cap for the deck pass |
| everything else | — | byte-identical | 20 budget overages + other stalls carry over |

Remaining §2.3 redlines (8): kraken, gullinbursti, sleipnir, hraesvelgr, jormungandr, ymir, nidhoggr, fenrir — every one now explained by known causes (dead-in-deck hooks, shared-deck confound, or pending reworks) rather than by firmware defects. This is the baseline the rework specs ([ticket 11](11-os-rework-specs.md)) and deck work ([ticket 04](04-archetype-identity-template.md)) start from.
