# Jormungandr rebuild (deep pass #1) + Water re-price + registry inventory

- Type: wayfinder:task
- Status: **closed** — implemented 2026-08-12. Two Henry decisions taken mid-pass (contagion
  3e→2e; accept v1's field overshoot and document it). See Resolution.
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

## Resolution

*Implemented 2026-08-12 on top of `62cac19`. Registry `1:e2f392b8` → **`1:b97b59ce`**.
773/773 unit tests, `npx tsc -b`, `npx vite build` and the full `npm run balance` gate all clean.
Redlines **49 → 48**.*

---

### 0. The finding that reframes the whole ticket: OUROBOROS_LOOP had never fired

Not in this build, not in any build since ticket 16 shipped it.

`jorm_v1_count`'s `COUNTER` action in `hooks.json` carried no `"target"` field, and
`HookFactory.executeActions` early-`continue`s any non-LOG action whose target resolves to null.
`jorm_water` was therefore never incremented, the `EQ 3` condition never matched, and the OS was
inert. Measured before the fix: a six-turn game ends with `counters: {"deck_shuffles": 4}` and zero
OUROBOROS log lines.

**This is the second occurrence of the trap HANDOFF recorded after ticket 53** (GENESIS_FIRMWARE hit
it too, and presented as a broken guard rather than a dropped action). A registry-wide sweep found
jormungandr_v1 is the only other victim — but **all four** of its actions were affected, `DRAW` and
both `RESET`s included. `jorm_v1_reset` additionally carried no `when` clause, so once the counter
worked it would have been wiped by the OPPONENT's turn end as well; it is now `source: SELF`.

Treated as a **defect fix, not an OS change**: Part 1's entire premise is a draw-zoo feeding the
loop, which is meaningless if the loop is dead. The ticket's ban on "capping OUROBOROS procs" is
untouched.

**Consequence for ticket 49.** It listed jormungandr_v1 at 0.71 against the control as a
top-priority *genuinely real* floor entry. Measured here: the OS fix alone, on the **unchanged old
deck**, takes that matchup from 45.0% to 96.7%. It was a dead hook the whole time.

### 1. What shipped

**Part 1 — v1 OUROBOROS draw-zoo (OS untouched beyond the defect fix).**

| | |
|---|---|
| ✦ `undertow` | 0e Water Skill Common, DRAW 1 |
| ✦ `tide_reading` | 1e Water Skill Common, DRAW 2 |
| `corrosive_leak` | raw `ENERGY` → `STATUS Energized 1 SELF` (the anti-loop change), rarity → **Rare** (§3) |
| `surge_protection` | 1e → **2e**, ATTACK 15 → **40**, conditional refund unchanged |

```
"jormungandr_v1": ["undertow", "blind_spot", "corrosive_leak", "tide_reading",
                   "surge_protection", "serpents_coil", "serpents_coil", "ink_stream", "ink_stream"]
```

Nine cards, not the ticket's ten: **`undertow` shipped at 1 copy, not 2** — that was knob round 1,
forced by the loop-watch (below).

**Part 2 — v2 TOXIN_FANG_OS.** `jormungandr_v2` becomes an `onDamageCalculated` hook,
`when.source: SELF`, additive `bonus: 2`, scaled by a new **`TARGET_POISON_STACKS`** scaling — the
first entry in `resolveScaling` that reads the DEFENDER rather than the owner. Uncapped, like
`SHARP_STACKS`: the knob is the rate, not a ceiling. Added to both TS unions and **both** zod enums
(8c2). ✦ `venom_fang` (1e Water Attack, 25 power) added.

```
"jormungandr_v2": ["corrosive_bolt", "corrosive_bolt", "venom_fang", "venom_fang",
                   "water_slap", "water_slap", "toxic_surge", "contagion"]
```

**`contagion` is 2e, not 3e — Henry's call, taken mid-pass.** See §5.

### 2. Gates

| gate | v1 | v2 | bar |
|---|---|---|---|
| **vs control** | **100%** | **100%** | ≥75% ✓ *(v1 was ~30%)* |
| turns vs control | 3.1 | 4.5 | |
| dead cards, subject side | 9.2% | 16.9% | ≤35% ✓ |
| dead cards, control side | 21.0% | 16.9% | ≤35% ✓ |
| FTK | 0/200 | 0/200 | 0 ✓ |
| **loop-watch, max plays in one side-turn** | **10** | — | STOP at >10 |
| **field** | **92.7%** | **83.3%** | 35–80% — **BOTH OVER, accepted (§5)** |
| **`contagion` dead rate** | — | **0.646** | ≤0.35 — **OVER, accepted (§5)** |
| mirror | 400/400 decided, **2.3 turns**, first-mover **−28.5%** | | ✓ |
| §2.3 | **0.910** | | diagnostic only, recorded |

**Loop-watch detail.** The modal side-turn is 5 cards played; the distribution runs
0/2/3/4/5/7/8/10. The maximum hit **11** on the ticket's original 10-card list — the STOP line —
and came down to 10 on the `undertow` 2→1 knob. It never reached 11 again.

The **2.3-turn mirror is the fastest on the roster** by a wide margin (next: hraesvelgr 3.2) and its
**−28.5% first-mover edge means moving SECOND wins.** That is the shape of a deck whose whole game
is one explosive turn.

### 3. Knobs spent

| # | deck | change | effect |
|---|---|---|---|
| 1 | v1 | `undertow` 2 → 1 copy | loop-watch 11 → **10** (clears STOP); field 98.3 → 96.0 |
| 2 | v1 | `serpents_coil` 15 → 10 power | field 96.0 → **92.7**; also closed its card redline |
| — | v2 | **both rounds UNSPENT** | v2 is inside every gate but `contagion`, and no authorised knob moves `contagion` |

### 4. Attribution — Henry asked "was it simply the broken OS?"

Full study: [research/jormungandr-v1-attribution.md](../research/jormungandr-v1-attribution.md).
**The answer is no.** A controlled 2×2 (everything else held at ticket-55 state so opponents are
identical across arms):

| | OS broken | OS fixed |
|---|---|---|
| **old deck** | field 22.3%, control 45.0% | field 55.7%, control 96.7% |
| **new deck** | field 44.7%, control 90.0% | field **92.7%**, control 100.0% |

Of the +70.4-point move: **OS fix +33.4 (47%), deck rebuild +22.4 (32%), interaction +14.6 (21%).**
The deck is worth +22.4 with a dead loop and **+48.0 with a live one** — it was built to feed the
OS, so the OS working more than doubles what the deck is worth.

**And the payoff cards are not what makes it strong.** Knockouts from the full build:

| change | field |
|---|---|
| remove BOTH cantrips | **55.0%** (−37.7) |
| remove `tide_reading` only | 78.7% (−14.0) |
| remove `undertow` only | 82.0% (−10.7) |
| `tide_reading` draw 2 → 1 | 83.0% (−9.7) |
| remove `ink_stream` ×2 | 90.7% (−2.0) |
| revert `surge_protection` to 1e/15 | **95.7% (+3.0)** |

`ink_stream` is v1's biggest damage source — 14.1 per play, 60% of its output — and cutting both
copies costs two points, because the chain finds damage regardless. **`surge_protection` at 2e/40 is
a measured NERF to jormungandr**: spending 2 of 2 Energy competes with the chain it is meant to
feed. The lever for the field window is cantrip count, nothing else.

### 5. The two Henry decisions

**(a) `contagion` 3e → 2e.** The ticket's headline gate — `contagion` off 0.82 and ≤0.35 — was
**unreachable as written**: `capacitor` was contagion's ONLY energy source, the ticket removes
capacitor, jormungandr's frame is 2 Energy, so a 3e card became uncastable by construction and its
dead rate went **0.82 → 1.000, zero plays in 720 games**. Henry chose the cost change over
re-adding capacitor or cutting contagion. Result: **0.646, 84 plays.** Still over 0.35 — a 3.2-turn
deck is a poor home for a hold-and-double card even when it is castable — and **Henry accepted it
documented rather than spending v2's knobs.** `contagion` now scores 1.4 against a 6.5 band,
deliberately under.

**(b) v1's field overshoot accepted.** 92.7% against a 35–80% window, both knob rounds spent. The
measured fix is a deck-list change (`tide_reading` out → 78.7%, in band, at 8 cards), which is not a
knob. Henry chose to ship and document: jormungandr was the roster's worst species and this is the
pass that found a two-ticket-old dead hook. **It goes to the deep-phase queue as a known
overshoot** — and it will be re-read against a roster that is itself still moving.

### 6. Part 3 — Water re-price and registry inventory

**Re-price** (rebuilt decks only, only if over band by >0.7): exactly one card qualifies —
**`corrosive_leak` at 2.3 against a 1.0 band (+1.3) → rarity `Rare`** per Henry's policy.
`serpents_coil` was the expected case at 3.8/3.0, but knob 2 brought it to **2.5, in band**, so no
rarity change. `ink_stream` at 3.6/3.0 is +0.6, under the rule — stays, noted.

**Registry inventory** delivered at
[research/registry-inventory.md](../research/registry-inventory.md). **53 cards sit in no deck**
(tokens, generated cards and the two intentional keeps excluded). **Nothing deleted.** Fourteen are
flagged as future-deck material; the two worth reading first are **`feedback_loop_daemon`** (damage
per card DRAWN — precisely the zoo payoff this ticket built by hand out of `ink_stream`) and
**`toxic_cloud`** (5 Poison to a side, which under TOXIN_FANG is a side-wide amplifier that had no
meaning before this OS existed). `poison_injection` at **0.3 against a 1.0 band** is the clearest
deletion candidate — it left jormungandr_v2 in this pass and is the lowest-scoring non-token card in
the registry.

### 7. Cross-species — `surge_protection` (1e/15 → 2e/40)

It sits in **kraken_v1 ×1 and kraken_v2 ×2**, and nowhere else (not sleipnir). Reported, not tuned:

| | before | after |
|---|---|---|
| kraken_v1 beats control | 80% | 82.5% |
| **kraken_v2 beats control** | **47%** | **81.3%** |
| kraken_v1 field | 33.0% | 26.0% |
| kraken_v2 field | 26.7% | 27.0% |
| kraken §2.3 | 0.550 | 0.540 |
| kraken mirror | 5.2 turns, 400/400 | 5.2 turns, 400/400 |

**`kraken_v2` came off ticket 49's floor list as a side effect** — `gauntlet:control-vs-kraken:kraken_v2`
moved **0.530 → 0.150**. That was the entry ticket 49 §2b called "the cleanest genuinely-real one",
on the grounds that it had moved by zero games across every ticket since ticket 47. It moved here.

kraken_v1's 7-point field drop is partly an artifact: every species now plays a much stronger
jormungandr in the round robin.

### 8. Blast radius (§9, 8-DIFF over the whole matchup table)

Redlines **49 → 48** (40 card, 8 matchup). Cards audited 210 → **213**.

**Only five matchup rows moved beyond noise, and all five are predicted:**

| row | before → after |
|---|---|
| `gauntlet:control-vs-jormungandr:jormungandr_v1` | 0.710 → **0.000** (7.9 → 3.1 turns) |
| `gauntlet:control-vs-jormungandr:jormungandr_v2` | 0.040 → **0.000** (7.9 → 4.5 turns) |
| `gauntlet:control-vs-kraken:kraken_v2` | 0.530 → **0.150** |
| `mirror:jormungandr` | 6.4 → **2.3 turns** (400/400 both) |
| `os:jormungandr` | 0.240 → **0.910** |

**Card redlines closed (2):** `serpents_coil` (knob 2) and `surge_protection` (6.5 on a 6.5 band).
**Added (1):** `undertow` at 1.4/1.0 — a 0-cost cantrip, the same shape and the same overage as
ticket 53's `glimmer`.

No test needed updating: nothing pinned the old jormungandr lists or OS text.

### 9. Left open

- **v1 at 92.7% field and v2 at 83.3%**, both accepted and documented (§5b). The measured lever is
  cantrip count; `tide_reading` out lands 78.7%.
- **`contagion` at 0.646 dead**, accepted (§5a). Both v2 knob rounds remain unspent if a later pass
  wants them.
- **The mirror is 2.3 turns with a −28.5% first-mover edge.** Nothing gates on either, but a deck
  where moving second wins by 28 points is worth a look before ship.
- **`surge_protection` is a nerf to jormungandr and a large buff to kraken_v2.** One card doing
  opposite things to two species is the shared-currency shape HANDOFF 8-SHARED-CURRENCY warns about,
  in a milder form.
- **53 orphaned cards** await Henry's deletion review.

## Amendment 1 (2026-08-12 — Henry-approved; supersedes Part 1's loop-guard approach)

**A. OUROBOROS_LOOP is capped ONCE PER TURN (OS text change, approved):**
"Each turn, the 3rd Water card you play grants 1 Energy and draws 1 card." Update the hook
(the counter/reset machinery you just fixed gains a per-turn once-guard — the hraesvelgr
guard-key pattern) and the description text. Rationale on record: the cap must live in the
FIRMWARE, not the deck list — players build from the pool, so list curation cannot contain
the chain; once-per-turn kills infinite turns by construction for every future player deck.

**B. Deck list under the capped OS:** revert to the spec list WITH both cantrips
(`undertow` ×2 + `tide_reading`, 10 cards). The cantrips stop being chain fuel under the
cap. THEN re-gate — and gate on the degeneracy axes, not field alone: mirror average turns
(should lengthen well past 2.3), first-mover edge (the −28.5% second-mover artifact should
shrink), max cards played per side-turn (STOP line stays >10), FTK 0, vs-control ≥0.75,
field window 0.35–0.80. The tide_reading-removal lever from the attribution study is
authorized ONLY if the capped deck still exceeds the field window — one round, report first.

**C. Firmware-liveness sweep (Q1 — AUTHORIZED, measurement not design):** probe all 32 OS
hooks for dead actions (the dropped-`target` / schema-stripped-field family — now THREE
occurrences: GENESIS ticket 53, OUROBOROS here, plus `jorm_v1_reset`'s missing `when`).
Fire each hook's trigger in a seeded probe battle and assert an observable effect. Deliver
the liveness table in the Resolution and add the trap to HANDOFF's do-not-re-derive list.
Mechanical repairs (missing target/when fields, same shape as the two known cases) are
pre-authorized; anything needing design interpretation → report, do not improvise.

**D. ink_stream (Q2 — recorded as design guidance):** velocity, not damage, is v1's lever.
Do not tune ink_stream's numbers; it stays at 12 × CARDS_DRAWN. Re-measure its share under
the capped OS and report.

**E. Ticket-49 floor re-read (Q3 — AUTHORIZED, measurement):** re-read the full floor list
at the post-rebuild registry hash and report it next to ticket 49's table — kraken_v2's
0.530 → 0.150 control move (a `surge_protection` side effect) suggests the deep-phase
queue's inputs have shifted. Report only; queue changes are Henry's call.

---

## Amendment 1 — Resolution

*Implemented 2026-08-12 on `39fbf3f`. Registry `1:b97b59ce` → **`1:53ea4a83`**. 773/773 tests,
`npx tsc -b`, `npx vite build`, full `npm run balance` clean. Redlines **48 → 47**.*

### A + B. The cap works, and it moved every degeneracy axis

`OUROBOROS_LOOP` is now once per turn, guarded in **firmware**: the `jorm_v1_trigger` hook gained a
`counters` AND-list (`jorm_water EQ 3` **and** `jorm_ouroboros_used LT 1`), sets the guard as its
first action, and `jorm_v1_reset` clears both keys at the owner's turn end. Both counters are
OWNER-scoped, so two Jörmungandrs never share a chain. Description updated to
*"Each turn, the 3rd Water card you play grants 1 Energy and draws 1 card."*

**Cap verified binding**, not inferred: across 35 sampled player side-turns, **max 1 proc per turn,
zero turns with more than one.**

| axis | before amendment | **after** | bar |
|---|---|---|---|
| **mirror average turns** | 2.30 | **3.19** | "well past 2.3" |
| **first-mover edge** | −28.5% | **−16.75%** | should shrink |
| **max cards played in a side-turn** | 10 | **7** | STOP at >10 |
| §2.3 | 0.910 | **0.630** | *redline CLOSED, back inside 0.30–0.70* |
| vs control | 100% | **100%** | ≥75% ✓ |
| FTK | 0 | **0** | ✓ |
| dead cards (subject) | 9.2% | **2.9%** | ≤35% ✓ |
| **field** | 92.7% | **83.0%** | 35–80 — **still 3 points over** |

**The cap is doing structural work, not cosmetic work.** `os:jormungandr` has left the redline set
for the first time since the species was measured, and the mirror lengthened 39%.

**The `tide_reading` lever was triggered and spent.** §B authorises it only if the capped deck still
exceeds the field window — it did. Measured first, as instructed:

| deck under the cap | field | mirror turns | first-mover | max plays |
|---|---|---|---|---|
| spec 10-card, both cantrips | 87.3% | 2.71 | −24.0% | 9 |
| **shipped: `tide_reading` removed (9 cards)** | **83.0%** | **3.25** | **−23.5%** | **7** |
| *probe only:* 10-card with `serpents_coil` back at 15 | 92.3% | 2.47 | −19.5% | 9 |

`undertow` stays at **2 copies** as the amendment directs. **Field remains 3 points over the ceiling
with no authorised lever left** — reported, not improvised.

The third row is a **report-only probe**, not a change: the `serpents_coil` 15→10 knob was spent
under the now-superseded loop-guard approach, so it was worth checking whether the cap made it
unnecessary. It did not — restoring 15 is worse on every axis. **The knob should stay at 10.**

### C. Firmware-liveness sweep — all 32 OSes

Two independent passes (`liveness.ts`, run at `1:53ea4a83`):

**STATIC** — replicates `HookFactory`'s own guards over every hook in `hooks.json`: actions that can
never apply (non-`LOG` with no `target`), zod-stripped keys (raw JSON vs post-`HookLibrarySchema`,
recursive), empty `do` arrays, and modifier hooks carrying neither `bonus` nor `multiplier`.

> **Result: ZERO findings across all 32 OSes.** The three known occurrences (GENESIS ticket 53,
> OUROBOROS and `jorm_v1_reset`'s missing `when` here) are the complete set. **No mechanical repairs
> were needed, so none were made.**

**DYNAMIC** — every registered hook function wrapped, then ~450 probe battles per OS (mirror,
vs-control, and five field matchups), recording invocations and *observable effects* (a returned
state that differs from the input, or a modifier that changed the damage).

> **Result: all 32 OSes LIVE.** Every one produces observable effects. Full table in the report.

**One sub-hook is silent, and it needs interpretation rather than a repair:**

`huldra_v2_bark_start` (`onTurnStart`) — **0 effects across 10,649 calls**, while its twin
`huldra_v2_bark_end` accounts for **100% of the grants**. The pair share a once-per-battle guard, so
whichever boundary comes first wins; battles open mid-turn-1 in the ACTION phase, so **every unit's
first boundary is a turn END, on both sides.** Ticket 07's comment on that firmware states enemy-side
Huldra takes the shield at her turn-1 pre-turn — measured, that never happens.

Not a defect with a wrong outcome (the shield does land), but it is the **same "two paths, one never
fires" shape that hid OUROBOROS for eight tickets**, and HANDOFF 8-SHIELD-TIMING notes a shield
granted at turn END is worth nothing to a shield-payoff deck. **Reported, not touched** — deciding
whether the dual path is still wanted is design.

### D. `ink_stream` — untouched, re-measured under the cap

Per §D it stays at 12 × `CARDS_DRAWN`. Under the capped OS:

| | before cap | after cap |
|---|---|---|
| damage share of v1 | 0.60 | **0.50** |
| damage per play | 14.1 | 11.0 |
| dead rate | 0.020 | **0.014** |

Still v1's largest single damage source at half its output. The velocity finding holds — the cap took
10 points of share out of it without anyone touching a number on the card.

### E. Ticket-49 floor re-read at `1:53ea4a83` — report only

Control win rate against every deck, 50 seeds × 2 turn orders, alongside the field round robin.
**The floor list is down from seven decks to four.**

| deck | ticket 49 §2b | **now** | field then → now |
|---|---|---|---|
| **hel_v2** | 0.81 | **0.901** | 28.2 → 25.1 |
| **skoll_v2** | 0.61 | **0.580** | 25.8 → 25.8 |
| **fenrir_v2** | 0.45 | **0.340** | 27.7 → 27.0 |
| **hraesvelgr_v1** | 0.30 | **0.310** | 48.0 → 44.0 |
| ~~jormungandr_v1~~ | 0.71 | **0.000** | 25.0 → **83.0** |
| ~~kraken_v2~~ | 0.53 | **0.190** | 26.7 → 27.0 |
| ~~fenrir_v1~~ | 0.29 | **0.194** | 28.1 → 27.4 |
| jormungandr_v2 | 0.04 | 0.000 | 9.0 → **83.3** |
| sleipnir_v1 | 0.08 | 0.180 | 48.3 → 44.3 |
| kraken_v1 | 0.20 | 0.140 | 33.0 → 26.0 |

Read `±0.05` as noise: this run uses 50 iterations and a different seed base than ticket 49's 100.
**hel_v2 moving 0.81 → 0.901 is at the edge of that, but it is the wrong direction and it is now the
only deck the control beats decisively.**

**The field window is the table that matters for the middle of the roster.** At this run's 10 iterations only **13 of 32 decks** sit inside 0.35–0.80 — *but the 30-iteration census (research/roster-census.md) revises that to **17 of 32**; the rest was sampling noise.* Six are
above (valkyrie_v2 89.3, ymir_v2 84.3, jormungandr_v2 83.3, jormungandr_v1 83.0, hraesvelgr_v2 81.3,
nidhoggr_v1 80.3) and **thirteen are below**, floored by audhumbla_v2 at 17.7. The roster is bimodal,
and the control can no longer discriminate the bottom group at all — eleven of those thirteen beat it
outright.

### Blast radius

Redlines **48 → 47**; card redlines unchanged (0 closed, 0 added); cards audited 213.
**Exactly one matchup row moved beyond noise across the whole table:**

| row | before → after |
|---|---|
| `os:jormungandr` | 0.910 → **0.630** (3.0 → 3.6 turns) — **redline closed** |

`mirror:jormungandr` reads 400/400 decided, 3.19 turns, first-mover −16.75%.

### Left open after amendment 1

1. **Field 83.0% / 83.3%, 3 points over the ceiling, no authorised lever left.**
2. **`huldra_v2_bark_start` is inert** — dual-path firmware where one path never fires.
3. **`contagion` 0.646 dead** (unchanged; both v2 knob rounds still unspent).
4. **13 of 32 decks inside the field window.** The floor list shrank because decks rose past it, not
   because the spread tightened.

---

## Amendment 1 — review decisions implemented (2026-08-13)

Design review of the amendment-1 report returned three calls and four authorisations. All are
carried out below; **nothing was picked that the review reserved.**

**Design call 1 — jormungandr_v1 at 83.0 field: ACCEPT-AND-WATCH, spend nothing.** No lever
applied. Re-read after ticket 56 moves valkyrie_v2 and audhumbla_v2, since every field number
re-reads then. *The 30-iteration census below puts him at **84.0**, four points over rather than
three — still inside the cited noise band, but it moved away from the ceiling.*

**Design call 2 — `huldra_v2_bark_start`: DELETED as dead code.** The alternative ("fix" the guard
so the turn-START grant fires) is not a neutral restoration of intent: per 8-SHIELD-TIMING a
start-of-turn shield protects the owner's own actions and an end-of-turn one does not, so it would
be a **real buff to a healthy ~71%-field deck**. Recorded in the firmware comment and in HANDOFF as
a **ready-made buff lever** instead. Behaviour is unchanged — `bark_end` already took 100% of the
grants. Post-delete liveness confirms it: huldra_v2 still LIVE, effects unchanged at 209, calls
halved 8,743 → 4,348 (the deleted path was pure overhead), and **no silent hooks remain anywhere**.

**Design call 3 — `serpents_coil` stays at 10.** Endorsed, already shipped, no action.

**Four authorised measurements — all report-only, all delivered** in
[research/roster-census.md](../research/roster-census.md):

1. **Roster-wide first-mover census.** Range −33.0% (`hraesvelgr`) to +24.5% (`skoll`).
   **jormungandr at −13.0% is fifth in magnitude, not the outlier** — `hraesvelgr` is 2.5x worse and
   has never been measured. The extremes cluster on the three shortest mirrors.
2. **30-iteration field census.** **The bimodality claim was partly a sampling artifact:
   17 of 32 decks sit inside 0.35–0.80, not 13.** Mean |delta| vs the 10-iteration read is 1.92
   points, max 5.4 — the review's ±4–5 estimate is right at the tail and conservative on average.
3. **TOXIN_FANG A/B (`bonus` 1 / 2 / 3).** Monotonic on every column, **and the mechanism is the
   inverse of the one hypothesised**: `bonus` sets game LENGTH, and length sets whether a
   hold-and-double card is castable. **`bonus: 1` puts v2's field at 61.3% — inside the window —
   and nearly halves `contagion`'s dead rate (0.619 → 0.439, 63% more casts)**, at the cost of 24%
   of the deck's damage per turn. **Not applied; it is pre-authorised and one line away.**
4. **`liveness.ts` after every `hooks.json` edit** — now standing policy. Run after the `bark_start`
   delete: zero static findings, all 32 OSes live, no silent hooks.

**Framing correction accepted.** The earlier Resolution called the field spread "alarming". That was
wrong twice over: the spread should not have tightened one item into a six-item queue, and eleven of
thirteen bottom decks beating the control says the control **discriminates the floor, not the
middle — which is what it was built to do.** The field census is the instrument for the middle; the
queue is the fix. Corrected in §E of the amendment-1 Resolution and in `map.md`.

---

## Knob round 1 (2026-08-13) — TOXIN_FANG `bonus` 2 → 1

**Henry-approved off the roster census A/B** ([research/roster-census.md](../research/roster-census.md) §3).
Knob round 1 of 2 from this ticket's pre-authorised list. **ONE change**; nothing else moved.

The A/B row that justified it, against the shipped value:

| `bonus` | field | `contagion` dead | contagion casts | v2 game length |
|---|---|---|---|---|
| **1 — applied** | **61.3%** | **0.439** | 157 | **4.18** |
| 2 — was shipped | 83.3% | 0.619 | 96 | 3.71 |

**Change:** `jorm_v2_toxin_fang.bonus` 2 → 1, and the OS description's *"+2 damage per Poison
stack"* → *"+1"*. A repo-wide `grep` for `+2 damage per Poison` found **no other occurrence** — no
card text or test pin needed updating.

### Gates — every one landed on the A/B's prediction

| gate | measured | window |
|---|---|---|
| **v2 field** | **61.3%** (300 decided) | ~61% expected; 0.35–0.80 passes ✓ |
| v2 vs control | **100%** | ≥0.60 ✓ |
| mirror | **400/400 decided, 3.2 turns** | ≥60% decided, ≤30 turns ✓ |
| FTK | **0/200** | 0 ✓ |
| dead cards, v2 side | **11.1%** (control side 12.7%) | ≤0.35 ✓ |
| **`contagion` dead rate** | **0.439** | ~0.44 expected ✓ |
| **liveness (standing policy)** | **zero static findings, 32/32 LIVE** | all LIVE ✓ |
| unit tests / `tsc -b` | 773/773, clean | ✓ |
| §2.3 (v1's share) | **0.940** *(was 0.630)* | **DIAGNOSTIC ONLY — reported, not tuned** |

`contagion` at **0.439 still exceeds the 0.35 dead bar. Known and accepted** — the remaining gap
belongs to the dead-card cleanup queue item, not to a knob. **Round 2 is BANKED and unspent.**

Side readings, unchanged and expected: **v1's field stays 83.0%** (no v1 change), and games
lengthened across the board — the control matchup went 4.5 → **5.5 turns**, which is the same
length-not-power mechanism the census A/B identified.

**No full `npm run balance` run.** Per the task's sequencing rule this commit lands before ticket
56's re-baseline so a single full run covers both; `docs/balance/balance_report.json` is therefore
untouched here and still reads `1:53ea4a83`. Registry after this change: **`1:e14e16df`**.
