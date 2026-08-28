# hel_v2 Gateway rework (deep pass #3): throttled blood, %-denominated

- Type: wayfinder:task
- Status: **closed** — implemented 2026-08-13. All gates pass, knob round 1 spent, round 2
  banked. Three findings for design in the Resolution (§6).
- Assignee: —
- Blocked by: ticket 56 (baseline ordering). DEEP-PHASE POLICY binds. Branch card-dev;
  author Henry Dunphy <hdunphy15@gmail.com>; line-ending law; locks → _to_delete/git-locks/.

## Context

hel_v2 (UNDERWORLD_GATEWAY blood-mage): 28% field, the only deck the control beats
outright, 30% dead cards, the roster's only FTKs. Diagnosis on record: HP-casting today is
a COUNTDOWN, not a risk trade — HP never refills, the deck's only heal is ~3 HP vs ~12/cast,
so optimal play is to barely use the OS (the AI correctly discovered this); and the health
bar's depth (~90+) vs energy's 2 makes the unthrottled alpha strike the FTK engine. Design
decision (Henry): keep the risk fantasy, throttle the blood, denominate everything in
%maxHp so it is level-proof (flat HP drifts with level — the rev-3 statuses precedent).

## Part 1 — UNDERWORLD_GATEWAY replacement text (approved)

**"Hel's Dark spells cost 5% of her max HP per Energy of their printed cost instead of
Energy. She can spend at most 20% of her max HP this way each turn."**

Implementation: cost = ceil(maxHp × 0.05) × printedEnergyCost paid as HP at cast (through
the existing HP-payment path); a per-turn spent-% counter (guard-key pattern) blocks casts
that would exceed 20% — blocked casts are simply unaffordable (grey out / AI skips via the
cost check; remember HANDOFF 8d: cost hooks must run in BOTH getEffectiveCardCost consumers
AND the reducer). Remove/replace any escalating-toll remnant (8c3). Floor: a cast always
costs at least 1 HP.

## Part 2 — deck: UNTOUCHED this ticket

The Dark drain suite (leech_strike, drain_life) is the pre-identified recoup engine IF the
gate says the throttled deck still cannot sustain — that is a list change and returns to
Henry with the findings. Do not swap cards.

## Part 3 — gates (deep-phase, Henry's final numbers), knobs, docs

Field 0.35–0.80 · ≥0.60 vs control · dead ≤0.35 both sides · **FTK 0 is the headline** ·
mirror ≥60% ≤30 turns. The binds-check: report mean %maxHp spent per turn — if it never
approaches 20%, the cap is decoration (8-INERT-CAP) and that is a finding, not a pass.
**Knobs (max 2 rounds, one change per sim):** cap 20% → 25 or → 15; cost 5% → 4 (wait —
numbers move in 5s; use cap first, cost only if cap rounds exhaust, 5% → 10 is the nerf
direction). Both OS halves' SHAPE is design-frozen. tsc / vitest / build; scoped
BALANCE_ONLY=hel; full npm run balance when in band; ticket Resolution + map line + HANDOFF
refresh (queue item 3 done). ONE commit. Deliverable: hash, gate numbers, %-spent
distribution, rounds, deviations — or findings.

---

## Resolution

*Implemented 2026-08-13 on `00b4747`. Registry `1:66efb2d7` → **`1:be695e83`**. 777/777 tests,
`npx tsc -b`, `npx vite build`, full `npm run balance` clean. Redlines **47 → 48** (see §5).*

### 0. A red test on the branch, inherited from ticket 56 — fixed here

`baseDecks.test.ts` pins every deck at 8–12 cards. **Ticket 56's Part 2 round 2 explicitly
authorised valkyrie_v2 down to SEVEN**, so an approved deck violates an approved template.
**My process error: ticket 56 ran the full suite BEFORE its deck change and never re-ran it after**,
so `04fe60f` landed red. Scoped and full balance both passed, which is why nothing else caught it.

Fixed as a **named exception** (`osId === 'valkyrie_v2' ? 7 : 8`) rather than widening the band for
the whole roster — that records a decision already taken in writing and leaves the next sub-8 deck
having to argue for itself. **Reverse the line, not the rule, if `glimmer` goes back.**

### 1. Part 1 — the throttled Gateway

**"Hel's Dark spells cost 5% of her max HP per Energy of their printed cost instead of Energy. She
can spend at most 15% of her max HP this way each turn."** (20% as specified; **15% after knob
round 1** — §3.)

On her 80-HP frame: **4 HP per Energy point**, budget **12 HP/turn = 3 Energy-points of Dark**.

**It moved out of `hooks.json` into `CustomFirmware.ts`, and that is forced, not preference.** The
cap has to answer *"would THIS cast, at ITS printed cost, take me past the budget"* — a per-card
quantity compared against a running counter. `when.counter` can only compare a counter to a
constant, so in data it would take one blocking hook per cost tier.

**The block is a PRICE, not a veto.** `onCostCalculated` returns a cost the frame cannot pay when
`spent + thisCast > cap`. That is what makes the reducer and `TacticalAI` agree without a third
code path — both price cards through `executeCostCalculated` (**HANDOFF 8d**) — and the UI cost pip
greys out for free. Retired in the process: the blanket `multiplier: 0` cost hook and the ticket-36
`escalatePerPlay: 1.25` toll (**8c3**). Floor of 1 HP per cast is implemented; on this frame it
never binds.

**SCOPE NARROWED, reported not improvised.** The approved text says *"Hel's **Dark** spells"*; the
old implementation zeroed and taxed **every** card she played. Her 1-Energy Light/None cards
(`dawnstrike` ×2, `squirrel_away`) therefore pay **Energy** again. That is what stops the cap being
a hard stop on her turn — and it incidentally revives a stat this OS had made dead (the standing
complaint in HANDOFF and ticket 37).

**`hel_v2_lifeblood` (+50% healing) was left in place** — the ticket does not list it for removal
and removing it would be a shape change. Its sentence is retained in the OS description.

### 2. Gates — the headline passes, and so does everything else

| gate | before | **after** | bar |
|---|---|---|---|
| **FTK** | the roster's only FTKs (3 per hel deck / 480 games) | **0/360 at deck-report scale, 0/200 scoped, 0 across all 67 matchups** | **0 — headline ✓** |
| **field (30-iteration)** | 26.7% | **78.2%** | 0.35–0.80 ✓ |
| **vs control** | **the only deck the control beat outright** (0.810 control-wins) | **1.000** (control-wins 0.000) | ≥0.60 ✓ |
| dead cards, hel_v2 | ~30% | **15.1%** | ≤0.35 ✓ |
| dead cards, control side | — | 15.6% | ≤0.35 ✓ |
| mirror | — | **400/400 decided, 5.4 turns** | ≥60%, ≤30t ✓ |
| §2.3 `os:hel` | 0.520 | **0.030** | diagnostic-only — see §5 |
| liveness (hooks.json edited) | — | zero static findings, **32/32 LIVE** | ✓ |

`hel_v1` is untouched and measured unchanged at **26.7% field** (identical to the 30-iteration
census), confirming no side effects.

### 3. The binds-check the ticket asked for — **the cap is not decoration**

Mean %maxHp spent per PLAYER turn, and how often the budget was actually reached:

| cap | mean spent | **turns at cap** | distribution |
|---|---|---|---|
| **20%** (as specified) | 15.9% | **47.7%** (71/149) | 0%:4 · 5%:9 · 10%:13 · 15%:52 · 20%:71 |
| **15%** (shipped, knob 1) | 13.5% | **83.0%** (137/165) | 0%:5 · 5%:11 · 10%:12 · 15%:137 |

**Not 8-INERT-CAP in either case** — it bound on half the turns at 20% and four in five at 15%.
**But see §6.1: binding 83% of the time is arguably the opposite failure**, and it is a finding, not
a pass.

### 4. Knob round 1 — and why the 10-iteration read would have missed it

**The field gate looked like a pass at 10 iterations and was not.**

| read | field |
|---|---|
| 10-iteration | **79.6%** — inside the window |
| **30-iteration (~900 games)** | **81.6%** — **1.6 points OVER** |

Knob round 1 applied on the decision-grade number: **cap 20% → 15%** (the ticket's stated first
lever and the nerf direction). Result **81.6% → 78.2%**, inside the window at 30 iterations.
**Round 2 is BANKED and unspent.**

### 5. Blast radius (8-DIFF over the whole table)

Redlines **47 → 48**; card redlines unchanged (0 closed, 0 added); cards 213.

| row moved beyond noise | before → after |
|---|---|
| **`gauntlet:control-vs-hel:hel_v2`** | **0.810 → 0.000** |
| `gauntlet:control-overall:slot2` | 0.132 → 0.081 |
| `os:hel` | 0.520 → **0.030** — **NEW redline at 0.47** |

Three rows, all hel. **The slot-2 aggregate moved because hel_v2 alone was carrying it.**

**`os:hel` flipped rather than closed:** hel_v2 was the weak deck at 0.520 and now beats v1 **97/100**.
Diagnostic-only per deep-phase policy and **not tuned** — but the magnitude is worth recording: the
rework did not lift v2 to parity, it made v2 the species' strong deck.

### 6. Findings for design

1. **At a 15% cap, `soul_tithe` (3 Energy = 15%) fills the entire turn's budget by itself.** That is
   visible in the per-card dead rates: **`venom_shade` 53.3% dead and `last_rites` 45.0% dead**,
   while `soul_tithe` is **0.0% dead at 25 damage per play**. She casts the big one and the other
   two Dark cards become unaffordable that turn. Combined with **83% of turns at cap**, the 15%
   version reads less like a budget she manages and more like *"one big Dark spell per turn"* — the
   risk fantasy is intact but the decision texture is thinner than at 20%, where `soul_tithe` +
   `venom_shade` both fit. **If the design prefers the trade-off over the ceiling, the 20% cap with
   a different lever (cost 5% → 10 is the ticket's other authorised direction) is worth a round.**
2. **Part 2's escape hatch was not needed.** The drain suite (`leech_strike`, `drain_life`) was
   pre-identified in case the throttled deck could not sustain. It sustains: dead cards halved and
   the control matchup went to 1.000. **No list change is requested.**
3. **hel_v2 is now the species' strong deck and near the top of the roster at 78.2% field**, from
   28.2%. Every gate passes, but that is a 50-point swing in one pass — worth a look alongside
   valkyrie_v2 (84.7%) and jormungandr_v1 (84.0%) when the field census is next re-read.

### 7. Left open

- **`os:hel` 0.47**, a new §2.3 redline, diagnostic-only.
- **Knob round 2 banked** (cap → 25/15 spent on 15; cost 5% → 10 untouched).
- The **cap texture** question in §6.1.
- The **valkyrie_v2 7-card exception** in §0 wants ratifying or reversing.

## Amendment 1 (Henry, 2026-08-13): cap reverts to 20% - texture over the number

Henry's call at the design review, overriding the designing agent's keep-15 recommendation:
the decision texture at 20% (soul_tithe + venom_shade fit together; ~48% of turns at cap vs
83%; venom_shade/last_rites come off their 53%/45% dead rates) is worth shipping 81.6 field -
**the field ceiling is consciously WAIVED for hel_v2 at this read** under the ceiling-freeze
policy (the 81.6 is a provisional number that should deflate as Fire/kraken/hel_v1 rise; if
the POST-QUEUE census still reads hel_v2 above 0.80, it joins the top-cluster conversation
with valkyrie_v2/jorm_v1 and any further change is a design session, not a knob).

Also decided: the agent's SS5.1 combo (20% cap + cost 5->10) is REJECTED on arithmetic -
at 10%/energy soul_tithe costs 30% vs a 20% cap (permanently uncastable) and last_rites
fills the cap alone, so it delivers neither of its stated goals. Do not implement it.

### Implementation (small; run BEFORE ticket 60)

1. CustomFirmware.ts: the per-turn budget constant 15 -> 20 (% of maxHp). Update the OS
   description text to say 20%. No other value moves.
2. Both knob rounds are now SPENT (round 1: 20->15; round 2: this revert). No levers remain;
   anything further returns to Henry.
3. Gates: tsc / vitest (unit suite AFTER the last edit, per 0-DECK-SIZE-EXCEPTION's lesson) /
   build; scoped BALANCE_ONLY=hel; expected from the already-measured 20% arm: field ~81.6
   (WAIVED, do not knob it), binds ~48% turns at cap, FTK 0 (hard gate), control >=0.60,
   mirror >=60% <=30 turns; report venom_shade/last_rites dead rates at 20% (not previously
   tabled - they inform the dead-card cleanup item). Full npm run balance; ONE commit; append
   results here; HANDOFF refresh. Anything outside these windows -> STOP.

### Amendment 1 — implemented 2026-08-13

Cap **15% → 20%**, description synced, both cap pins in `StanceSystem.test.ts` moved back.
`HEL_BLOOD_CAP_PCT` is the only value that changed. **Both knob rounds are now SPENT**
(round 1: 20→15; round 2: this revert). **No levers remain.** The 5% → 10 cost combo was
rejected on arithmetic and was not implemented. Registry **`1:be695e83` → `1:3466b533`**;
777/777 tests (run after the last edit, per `0-DECK-SIZE-EXCEPTION`), `tsc -b` / `vite build`
clean, liveness zero static findings / 32-of-32 LIVE, full `npm run balance` clean.

| gate | measured at 20% | expected | |
|---|---|---|---|
| **FTK** | **0/360** deck-report · **0/200** scoped · **0** across all 67 matchups | 0 | **hard gate ✓** |
| field (30-iteration) | **81.6%** | ~81.6 | **ceiling consciously WAIVED** |
| vs control | **0.980** (control-wins 0.020) | ≥0.60 | ✓ |
| dead cards, deck level | **12.2%** (was 15.1% at the 15% cap) | ≤0.35 | ✓ |
| mirror | 400/400 decided, 5.4 turns | ≥60%, ≤30t | ✓ |
| **binds — turns at cap** | **47.7%** (mean 15.9%) | ~48% | ✓ not decoration |

Blood spent per turn: `0%:4 · 5%:9 · 10%:13 · 15%:52 · 20%:71`.
**Nothing in the roster moved beyond noise** — redlines 48 → 48, zero matchup rows changed.

#### The requested dead-rate table — and it is a split decision

| card | cost | **at 15% cap** | **at 20% cap** | plays 15% → 20% |
|---|---|---|---|---|
| `venom_shade` | 1e = 5% | **53.3% dead** | **0.0% dead** | 150 → **441** |
| `last_rites` | 2e = 10% | 45.0% dead | **51.7% dead** | 184 → **142** |
| `soul_tithe` | 3e = 15% | 0.0% dead | 0.0% dead | 520 → 507 |

**The texture argument delivered on `venom_shade` and cost `last_rites`.** At 20% the budget fits
`soul_tithe` (15%) **plus** `venom_shade` (5%) exactly, so the AI takes that pairing almost every
turn — `venom_shade` goes from half-dead to never-dead at three times the plays. But that same
perfect fit is what crowds `last_rites` (10%) out: it no longer pairs with `soul_tithe` at all, and
its dead rate rose 45.0% → 51.7%. At 15% neither fit alongside `soul_tithe`, so `last_rites` was
picked more often as the second-best option.

**Deck-level dead cards still improved, 15.1% → 12.2%**, so the trade is net positive — but
`last_rites` is now the odd card out and belongs in the dead-card cleanup item, not in a knob.
