# Water retune under the corrected instrument

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-06
- Blocked by: [19-ai-measurement-upgrade](19-ai-measurement-upgrade.md) (closed — the instrument these numbers come from)

## Question

Ticket 19's AI/measurement upgrade re-read both completed Water species, and the corrections are real play, not artifacts (play-frequency audits confirm every card now gets used at sensible timing):

- **kraken §2.3 = 8/92 v2-favored** (was 50/50 under the blind AI). v2's SURGE ramp works as designed — capacitor turn ~1, hydro_blast/maelstrom cashed turn ~2.6 — and v1's STORM tempo can't race it. v1's `ink_cloud` is also near-dead in hand (1 play in 100 games; the new eval finds nothing it buys). Direction: v1 up and/or v2's nuke line priced up.
- **jormungandr §2.3 = 66/34 v1-favored.** v2 plays contagion/capacitor properly now (first plays ~turn 4, correct doubling timing) and still loses — a genuine curve verdict: 3e contagion and 2e capacitor don't pay back in a ~6-turn format on this deck. Direction: v2's ramp/payoff priced down or swapped for pressure.

Retune both to the ≤15% §2.3 gap under the NEW baseline, one variable per sim, numbers move in 5s, all card changes reviewed by Henry before the registry commit. Mirrors are already healthy (kraken 50/50, jorm 48/52, ~4.5 turns, no draws) — keep them that way. The rev-3 budget redlines (corrosive_leak 2.8 static score flagged in the new report) get resolved or documented in the same pass.

## Resolution

Landed 2026-08-06 (10-80-10 flow: design + verification analysis by the primary session; this implementation by a secondary session). Gates: 740 vitest, tsc, build, full balance committed (registry 1:fe1e668d).

Henry's approved package - cards stay on the rev-3 curve; the enabler was the anomaly:

1. TIDAL_CRUSH_OS (kraken v2) damage bonus +30% -> +20% (hooks.json multiplier 1.3 -> 1.2).
2. kraken v1 deck: ink_cloud -> surge_protection (the slot was dead: 0-1 plays per 100 games at any value). ink_cloud STAYS in the registry for future 2v2/3v3 content.
3. ink_stream 12 -> 15 power per card drawn.
4. corrosive_bolt Poison 4 -> 5 (the jorm v2 fix, approved from the first overnight report).
5. hydro_blast description text corrected ("150 power" -> "140 power"; the value was always 140).

Committed numbers: kraken §2.3 43/57, jorm §2.3 51/49, mirrors 51/49 & 48/52. Overnight sim evidence (decomposition sweeps, ~200 measurements): the OS multiplier carried ~29pts of kraken's 90/10 gap, deck structure ~10pts; the type-matrix 100/0 blowouts are NOT the ElementalMatrix (persist at 1.05x) - matrix tuning + AI-determinism work deferred until element passes land (Henry's sequencing call: all decks get a first-pass makeover before intensive tuning; small-sample cross-element data is dominated by uncalibrated legacy decks).
