# Water retune under the corrected instrument

- Type: wayfinder:task
- Status: open
- Assignee: —
- Blocked by: [19-ai-measurement-upgrade](19-ai-measurement-upgrade.md) (closed — the instrument these numbers come from)

## Question

Ticket 19's AI/measurement upgrade re-read both completed Water species, and the corrections are real play, not artifacts (play-frequency audits confirm every card now gets used at sensible timing):

- **kraken §2.3 = 8/92 v2-favored** (was 50/50 under the blind AI). v2's SURGE ramp works as designed — capacitor turn ~1, hydro_blast/maelstrom cashed turn ~2.6 — and v1's STORM tempo can't race it. v1's `ink_cloud` is also near-dead in hand (1 play in 100 games; the new eval finds nothing it buys). Direction: v1 up and/or v2's nuke line priced up.
- **jormungandr §2.3 = 66/34 v1-favored.** v2 plays contagion/capacitor properly now (first plays ~turn 4, correct doubling timing) and still loses — a genuine curve verdict: 3e contagion and 2e capacitor don't pay back in a ~6-turn format on this deck. Direction: v2's ramp/payoff priced down or swapped for pressure.

Retune both to the ≤15% §2.3 gap under the NEW baseline, one variable per sim, numbers move in 5s, all card changes reviewed by Henry before the registry commit. Mirrors are already healthy (kraken 50/50, jorm 48/52, ~4.5 turns, no draws) — keep them that way. The rev-3 budget redlines (corrosive_leak 2.8 static score flagged in the new report) get resolved or documented in the same pass.
