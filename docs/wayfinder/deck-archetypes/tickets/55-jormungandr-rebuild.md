# Jormungandr rebuild (deep pass #1) + Water re-price + registry inventory

- Type: wayfinder:task
- Status: **open** — Henry-approved design (2026-08-12); this ticket IS the implementation
  brief. The implementing session flips to closed and appends its Resolution.
- Assignee: —
- Blocked by: nothing. Read `HANDOFF.md` (the DEEP-PHASE POLICY at the top is binding) and
  `research/first-pass-process.md` first. Branch card-dev. Author
  `Henry Dunphy <hdunphy15@gmail.com>`; line-ending law per HANDOFF; locks → `_to_delete/git-locks/`.

## Context

Deep-phase queue item 1 (ticket 54). jormungandr_v1: 25% field, ~30% vs the frozen control
(under the floor). jormungandr_v2: 9% field, dead-last; contagion 82% dead / 11.8x power
divergence, capacitor 73% dead — both structurally dead, not mistuned (capacitor's economy
argument died with the 2-Energy world; contagion's hold-and-double premise loses to the
horizon-capped poison eval, which is correct). Frame 110/75/75, 2 Energy.

## Part 1 — v1: OUROBOROS draw-zoo (OS UNCHANGED)

Three data edits + one deck list. OUROBOROS_LOOP itself is not touched.

1. ✦ NEW `undertow` | Undertow | 0e Water Skill Common | Self | DRAW 1 |
   "The current pulls: draw a card." (Must be Water — the loop counts Water cards only.)
2. ✦ NEW `tide_reading` | Tide Reading | 1e Water Skill Common | Self | DRAW 2 |
   "Read the tides: draw 2 cards."
3. REWORK `corrosive_leak` (0e): its raw ENERGY action becomes **STATUS Energized 1 SELF**
   (delayed energy cannot fuel the current turn's chain — the anti-loop change). New text:
   "Poison self 2 stacks. Gain 1 Energized." Self-poison half unchanged.
4. REWORK `surge_protection` (Henry's spec): baseCost 1 → **2**; ATTACK 15 → **40**; the
   drew-this-turn conditional Energy refund stays exactly as-is. New text: "40 power. If you
   drew a card this turn, refund 1 Energy." (Prices ≈60 vs the 65 band. NOTE: this card is
   also in kraken_v1 and sleipnir lists? — grep decks for `surge_protection` and report every
   deck it sits in with before/after gate numbers for those species; do NOT tune them.)

```
"jormungandr_v1": ["undertow", "undertow", "blind_spot", "corrosive_leak", "tide_reading", "surge_protection", "serpents_coil", "serpents_coil", "ink_stream", "ink_stream"],
```

(10 cards. ink_stream is kraken_v1's card — element-shared, unchanged. Scales: coil on
cards PLAYED, ink_stream on cards DRAWN — the zoo's two payoffs.)

**LOOP-WATCH (gate-enforced):** cantrips + the OS's 3rd-Water-card proc net positive cards
AND energy — mega-turns are possible. The gate must record the MAX cards played in any
single side-turn across the scoped runs; **any turn >10 plays or any FTK → STOP.** First
authorized guard is the undertow 2→1 knob. Capping OUROBOROS procs is NOT authorized — that
is an OS change and returns to Henry.

## Part 2 — v2: TOXIN_FANG_OS poison-bruiser (OS REPLACED)

1. Replace the `jormungandr_v2` hook content in hooks.json (keep the key): name
   **TOXIN_FANG_OS**, description "Jörmungandr's venom coats his fangs: his attacks deal
   +2 damage per Poison stack on the target." Implementation: `onDamageCalculated`, source
   SELF, additive `bonus: 2` scaled by the TARGET's Poison stacks (the DAZED_STACKS/
   SHARP_STACKS scaling family is the pattern; add a target-poison scaling key if none
   exists). Additive, not a multiplier — and note HANDOFF 8-COMPOUND: the bonus lands
   before status percentages and compounds with them; that is known and accepted.
   Edit hooks.json surgically as text (its inline arrays do not survive a JSON round-trip).
2. ✦ NEW `venom_fang` | Venom Fang | 1e Water Attack Common | Single | ATTACK 25 |
   "Strike with envenomed fangs: 25 power." (The OS is the scaling; the card stays plain.)
3. `capacitor` LEAVES the deck (card stays in the registry — ramp draft card).
   `contagion` STAYS: under TOXIN_FANG, doubling the pile doubles the amplifier immediately
   — cashable by attacking the same turn, which dissolves the horizon problem. **The
   headline gate check: contagion's dead-card rate must come off 0.82 and land ≤0.35.**

```
"jormungandr_v2": ["corrosive_bolt", "corrosive_bolt", "venom_fang", "venom_fang", "water_slap", "water_slap", "toxic_surge", "contagion"],
```

## Part 3 — Water re-price + registry inventory (NO deletions)

- Re-price rule (Henry): only cards in the REBUILT decks, only if over band by **>0.7**.
  After the rebuild, run the static audit: `serpents_coil` (was 3.8/3.0) is the expected
  case — if it still exceeds 3.7, set its `rarity` to Rare and REPORT it; re-costing it is
  only the pre-authorized knob below, gate-driven. `ink_stream` at 3.6 stays (≤0.7 over),
  note it. Cards over-curve but kept become Rare per Henry's rarity policy.
- **Registry inventory (deliverable, not deletion):** produce
  `docs/wayfinder/deck-archetypes/research/registry-inventory.md` listing every card in NO
  deck (all 32 lists + control), excluding tokens (`isToken`), hook-generated cards
  (GENERATE_CARD references), and known intentional keeps (`shatter` — drop-only by ticket
  50; `capacitor` — kept above). Flag daemons and anything mechanically interesting as
  future-deck material. **Delete nothing** — Henry reviews the list; deletion is its own
  follow-up ticket.

## Part 4 — gates (DEEP-PHASE POLICY: field/control primary, §2.3 diagnostic-only)

`npx tsc -b` → `npx vitest run` (update any test pinning old jorm lists/OS text; anything
else → STOP) → `npx vite build` → `BALANCE_ONLY=jormungandr` scoped runs:

- **vs-control ≥0.75 for BOTH decks** (v1 was ~0.30)
- mirror ≥60% decided, ≤30 turns; FTK 0; loop-watch per Part 1
- dead cards ≤0.35 BOTH sides (print both); **contagion ≤0.35 is the headline**
- §2.3 is RECORDED but is not a gate (hard counters are allowed design)

**Pre-authorized knobs, max 2 rounds per deck, ONE change per sim:** undertow 2→1 copy;
TOXIN_FANG bonus 2→3 or →1; venom_fang 25→30 or →20; surge_protection 40→35 or →45;
serpents_coil 15→10. contagion and both OS shapes are design-frozen — anything else STOPS
with findings for Henry.

When in band: full `npm run balance` (commit gate; diff the whole matchup table per
8-DIFF — kraken and sleipnir rows may move via surge_protection; report any species moving
beyond noise with numbers, do not tune them).

## Part 5 — docs + commit

Flip this ticket to closed with a Resolution (deck lists, gate numbers incl. before/after
field-proxy rows, knob rounds, the surge_protection cross-species report, the inventory
summary count). Map line after ticket 54's:
`- **BUILT** — [Jormungandr rebuild](tickets/55-jormungandr-rebuild.md) — deep pass #1: v1 OUROBOROS draw-zoo (Undertow/Tide Reading, Energized corrosive_leak, 2e surge_protection — loop-guarded), v2 TOXIN_FANG_OS poison-bruiser (+2/Poison-stack attacks — contagion finally cashable, capacitor retired to the registry). Control {{v1}}/{{v2}} from 0.30/—, contagion dead {{n}} from 0.82. Registry inventory delivered for Henry's deletion review.`
HANDOFF: refresh the queue state (item 1 done), and add under open items:
`STRATEGIC (Henry, 2026-08-12): after balancing completes, decide 1v1-only vs 3v3 as the shipped mode — gates ticket 05, the team OSes (valkyrie L-family, einherjar_standard), and Steam scope. Henry's stated goal: ship on Steam. 1v1 balancing finishes first.`
ONE commit. Deliverable to Henry: commit hash, all gate numbers vs bands, knob rounds, the
inventory list itself, deviations — or findings if STOPPED.
