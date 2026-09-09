# Ticket 149 — The scorer prices what it can measure

> **149c RULED 2026-09-09 — Legion: start at §5.** 149b DELIVERED 2026-09-08 — all five measurements ran (3a/3b/3c/3e complete; 3d complete — the last nine owners and the 3v3 consume cells ran 2026-09-09). Read `../research/scorer-pricing.md` (short form, §6 = the §4 rulings with numbers) and `../research/firmware-power-census.md`; per-measurement findings in `results/t149_*/FINDINGS.md`; scripts `scratch/t149_*.ts`. Two findings not on the ticket: `hel_v2 lifeblood` ships at ×1.0 (inert) and `carrion_swoop` has no scorer branch (scores 1.1, delivers 2.2 fire-punches a cast). Next: Henry's §4 rulings, then 149c.

**Type:** instrument work (`powerscale.ts` and the budget report). **Report-first: no card, deck,
OS or engine number changes in this ticket.** A card that moves out of band because its price
became honest goes to Henry with the measurement; it is not "corrected".
**Status:** 149b delivered; **149c RULED by Henry 2026-09-09 (§4) — ready for Legion (§5)**. Originally: Henry and the design session take the rulings
in §4 together, then Legion runs the rows in §5. **Absorbs and closes** 63, 119, 120 (the scorer
half), 121 and 130.
**Branch:** current working branch, one commit per lettered row, authored as Henry.
**Method precedent:** ticket 61 (measured 0.19 HP per printed power on valkyrie's frame against the
0.30 folklore), ticket 66 (the census constants — every number cites `research/status-pile-census.md`).

---

## 1. Why one ticket

Five open tickets are the same complaint: `powerscale.ts` prices something with a constant that was
guessed, the constant became load-bearing in the card-budget gate, and now the gate flags cards that
are fine and waves through cards that are not. Ticket 66 already fixed the status-pile family this
way — measure the pile, cite the census, replace the constant — and the roster did not move. This
ticket does the same for the five that are left, in one pass, so the budget report can be trusted
again before ticket 148's progression arms and ticket 59's registry triage start reading it.

| folded ticket | the guessed constant | what it costs us today |
|---|---|---|
| 119 | `scope === 'SIDE'` → `×2.2` (`powerscale.ts:872`) | five ticket-115 Ice cards sit permanently 87–143% "over band" while being bit-identical at 1v1; the ledger is set up to undo a change that works |
| 130 | `EXPECTED_DAEMON_PROCS = 4` (L470); `DRAW: 15` (L102); the `Daemon && score === 0` guard (L959) | every daemon is a turn-1 best case at a guessed rate (`feedback_loop_daemon` says 2.7, measured turn-3 value 1.7); a 1e "draw 2" cantrip moved kraken_v1 33 field points while scoring 2.8 |
| 120 | `ASSUMED_CONSUMED_STACKS` vs the non-consuming scaling path (L565) | the four most over-band cards in the pool (`umbral_feast` +397%, `contagion` +214%, `hexbloom` +154%, `corrosive_leak` +130%) are all one family — the tell that it is the scorer |
| 63 | the 0.30 HP-per-power folklore under every OS payoff | ticket 61 measured 0.19 on valkyrie's frame; no other frame has been measured, so every power-denominated firmware payoff is priced on an unverified rate |
| 121 | `IN BAND` / `OVER` with no distance | `frost_bite` at +10% prints the same word as `umbral_feast` at +397%; Henry already ruled the shape (*"3 is not a hard cut off … +/- 15%"*) |

Not in this ticket: the drawback tail (`desperate_strike` −410%, `dark_pact` −410%, `wither_feast`
−266%). It is real, it is the same *kind* of problem, but ticket 138's `damageOverride` finding means
the recoil numbers themselves are still moving; price them after that settles. Recorded in §6.

## 2. What "measured" means here

Each constant gets replaced by a number with a citation, produced by a scratch census that is
committed with the ticket (the way `scratch/stackcensus.ts` backs ticket 66). The instrument for
all of them exists: `scratch/bandspread.ts` (the pool as % of band ceiling), `scratch/handeconomy.ts`
(draws per unit-turn at 3v3), `scratch/oscensus.ts`, and `teamScenario()` for anything that needs
width. **Beamless** (144 §2: the harness default is gym-grade; beam is a rung of the enemy ladder,
not an instrument setting). 1v1 at 60 iterations on the deck's own frame; 3v3 on the ticket-140 §8
panel (`ink_loop`, `fire_pair`, `control`, `zoo`, `ref_solo_a`) at 40 battles a cell.

A constant is replaced only when the measurement and the constant disagree by more than the pool's
own noise (median absolute deviation 10% of ceiling, ticket 121). A constant that measures within
that keeps its value and gains its citation.

## 3. The five measurements

### 3a. Side scope — what ×2.2 should be, and at which width (119)

Measure the same five cards (`frost_bite`, `numbing_gale`, `killing_frost`, `rimefrost`,
`ice_spear`) plus the kraken side-scope package from 116 under `Single` and `Side`, at 1v1 and
3v3, in real field points. Report the ratio Side/Single at each width. The known answer is
"1.0 at width 1, ~3.0 at width 3"; what the measurement adds is the *field* value of that, which is
what the scorer is supposed to predict.

The scorer has no width today. Three shapes, Henry picks one in §4:
(i) **two scores per card** — `score1v1` and `score3v3`, bands checked at both, the report
prints both; (ii) **one blended score** at the run's true width mix (the run is 1v1 on the road and
3v3 at gyms and elites; the mix is measurable from `pathAndScout` — count encounters by width over a
sampled run); (iii) **keep ×2.2 and exempt by measurement** (ticket 119's option c; cheapest, least
honest).

### 3b. Daemons and `DRAW` (130)

Per-trigger proc rates, measured, in one table keyed by hook trigger: `onCardDraw`,
`onProgramPlayed`, `onTurnStart`, `onTurnEnd`, `onStatusApplied`, `onDamageDealt`, `onDeckShuffled`
(any others the daemons in the pool actually use — grep `hooks.json` and `programs.json` for
`category: 'Daemon'`). Procs per unit-turn at 1v1 and 3v3 (the `source: SELF` gate halves the 3v3
rate — ticket 128 — so the 3v3 number is the *seen* rate, not the side-wide one). `handeconomy.ts`
already gives the draw trigger (0.75 per unit-turn at 3v3); the others want the same instrument.

Then the play-turn axis: price a daemon at the turn it is realistically cast. Measure when the AI
actually plays each daemon (turn of first cast, mean, over the panel); the price is
`proc.score × rate × (gameLength − castTurn)`. Report every daemon at cast turns 1, 2 and 3 so
Henry's bar — *"positive even when played on turn 3"* — is a column, not a hope.

`DRAW: 15` becomes a deck-independent floor plus a per-deck term the report prints separately: a
draw is worth roughly the deck's mean card value, which `bandspread` already computes per deck.
Until that lands the ticket-130 rule stands: **any card that draws more than one is unpriced and is
gated on a field arm, not a score.**

And the plain bug: the `card.category === 'Daemon' && score === 0` guard means a daemon with its own
on-cast action loses its hook's value. Price actions and hooks additively. This is the one change in
the ticket that is unambiguously a fix, and it is a no-op on today's pool (every daemon has empty
`actions`), so it can ship in the first commit.

### 3c. The consume family (120)

Score `WEAKENED_STACKS`, `STATUS_CONSUMED` and `DAZED_STACKS` scaling cards against what they
convert in real games — the ticket-64 method for Strengthened, applied to the rest. Specifically:
for each of `hexbloom`, `umbral_feast`, `contagion`, `corrosive_leak`, `ash_communion`, log at cast
time the stacks read and the stacks consumed, mean over the panel. Two questions the log answers:
is the pile at cast time the census mean (5.04 Weakened) or the board the card is *held for* (it is
cast when the pile is big, so the truth is probably higher, not lower); and is the non-consuming
path ("the Weakened remains") priced as though it also cashed the stacks. If the second is true it
is a bug and ships with 3b's; if only the first is true the constant moves and the four cards
re-score, and Henry rules on whatever is still over.

### 3d. The firmware power-rate census (63, unchanged in scope)

For every OS payoff denominated in power or %-maxHp — REBIRTH 15/15, NOURISH 50%, the hel Gateway
costs, hel_v2 lifeblood +50% healing, GALE_FORCE 10, UPDRAFT, GENESIS maxEnergy, TOXIN_FANG +10 (the
131c flat bonus), KINETIC_RAM 2.5, TIDAL_CRUSH 1.2×, OUROBOROS, TREACHERY grants, and anything a
grep of `hooks.json` + `CustomFirmware.ts` adds — delivered HP (or HP-equivalent) per proc and per
game on its own frame. One table: OS · payoff text · printed value · delivered/proc · procs/game ·
delivered/game · implied HP-per-power · flag when it diverges >2× from the 0.19–0.30 range. The
companion table from 63 (the scaling cards `starfall`, `stampede`, `serpents_coil`,
`carrion_swoop`, `momentum_crash` against the `fire_punch_v2` benchmark) comes with it. The output
is `research/firmware-power-census.md`; the scorer does not read it in this ticket — it is the
input to any later OS ticket and to 148's frame arms.

### 3e. Band tolerance (121 — proposal ready, needs only the ruling)

Adopt **±15% of the band ceiling** (1.5× the pool's median absolute deviation) and report three
states, always with the percentage printed: `IN BAND`, `WITHIN TOLERANCE (+n%)`, `OUT OF BAND
(+n%)`. Not standard deviation — the pool's sd is 67.5% because drawback cards score negative; MAD
ignores the outliers instead of being defined by them. `weak.ts`, `bandspread.ts` and §1.3 of the
balance report all move to the same three words.

## 4. Rulings (Henry, design session 2026-09-09)

The measurements are in `../research/scorer-pricing.md` (short form) and
`../research/firmware-power-census.md`. Henry's framing, which governs every row below: *the scorer's
job is to keep cards balanced BEFORE the grid runs, and to give general insight — its numbers are
not meant to work for a specific width or deck; the point is that no single card is one everyone has
to get or lose to, and that AI cards that feel unfair to face get spotted. Power bands are a guide,
not the law: some rare over-band cards are wanted so players win easier, and daemons may be that
rare.* The game AI does not read the scorer (verified: no caller outside `src/debug` and tests).

1. **DRAW → 20 power.** The `'DRAW': 15` table entry is dead code; the live price is the ladder at
   L803–810 (15/10/5 power for the 1st/2nd/3rd card). Ship the ladder as **20/15/10**. Modeled on
   the pool: 24 cards move, none egregious. Newly past +15%: `dread_tidings` +37%, `whirlpool_v2`
   +20% (the field says 47%, fine), `pressure_point` and `rejuvenation` +17%. The 0e cantrips
   `glimmer`/`slipstream`/`undertow` go +40% → +80% — that is the 0e ceiling of 1.0 being tight, not
   the cards; left alone. The draw-2 cards go −23% → +7%, which is the change doing its job.
2. **Width: two scores per card.** `Side` is ×1.0 at 1v1 and ×2.2 at 3v3 (measured 1.9–2.2 per
   cast; 2.6 for a pure-debuff Side card — use 2.2 for all). The report prints `score1v1` and
   `score3v3`; the band verdict is against `score1v1` unless the card is `Side`/`All`, where both
   are printed and the verdict is the worse of the two.
3. **±15% tolerance**, three states (`IN BAND` / `WITHIN TOLERANCE +n%` / `OUT OF BAND +n%`),
   the percentage always printed; a score ≤ 0 is routed to `MANUAL REVIEW` (drawback cards), never
   to the under-band list. MAD not sd.
4. **Hooks get a formula, general not deck-specific:** `hook score = per-proc payoff × trigger rate
   × horizon`, printed twice — a **floor** at the roster-mean rate and a **ceiling** at the highest
   home-deck rate the census saw. The ratio is the build-around index: a high floor is the card
   everyone has to take (flag it); a low floor with a high ceiling is a legitimate deck-specific
   rare (fine). Daemons keep the ×1.5 premium, now stated as *the size of the sanctioned rare*.
   Daemons price at cast turn 2 (the AI's median), horizon = 3 turns; an OS's horizon is 5.
5. **OSes get their own band**, in delivered value per game as a percentage of a health pool
   (the census unit): **15–40% is in band, above 50% is flagged**, printed for every OS in the
   balance report next to §1.3. Median today ≈ 20%; the flags fall out on their own (GOSSIP 127%,
   PRIMORDIAL_MILK 122%, BARK_SHIELD 67%, KINETIC_RAM 63%, SOLAR_OVERDRIVE 51%).
6. **A card that moves under an honest price is reported, never auto-tuned** — a §1.3 ledger line
   with old score, new score and the field number where one exists. Henry rules each.
7. **The drawback tail** (`desperate_strike`, `dark_pact`, `wither_feast`, `scrubber`, `vent`,
   `unbound_fang`, `discharge`, `all_in`, `reckless_charge`) stays parked behind ticket 138; the
   `MANUAL REVIEW` state (row 3) is what keeps it from polluting the under-band list meanwhile.
8. **Consume-family constants stay** for now. The census showed the pile at cast is ~2× the
   ordinary-turn pile and the triangular Poison lifetime is charged in full — both are honest
   *findings* but neither has a general fix (a "pile at cast" constant is a deck property). The
   two Poison-shed cards (`umbral_feast`, `bloodwrath`) do get one correction: the ×1.25 removal
   premium (L951–953) does not apply when the pile being shed is the caster's own (the premium's
   rationale is neutralising an opponent's card). They re-score 12.15 → 9.7 on the shed term.
9. The three OS design items (lifeblood, TOXIN_FANG/KINETIC_RAM) are ticket 150. GOSSIP_NODE at
   127% waits for the OS band to print.

## 5. Order of work (149c — Legion; scorer-only, one commit per row, authored as Henry)

- **149c-1 — the guard.** `Daemon && score === 0` (L959) → price actions and hooks additively.
  Test: a daemon with an on-cast draw and a hook scores both. §1.3 byte-identical (no shipped
  daemon has actions).
- **149c-2 — DRAW 20/15/10** (L803–810); delete the dead `'DRAW': 15` table entry. Ledger of the
  24 cards that move (`scratch/t149_draw20.ts` has the list).
- **149c-3 — `CARDS_DISCARDED` branch** in the scaling switch (L687–726): `power *=
  ASSUMED_CARDS_DISCARDED`, constant **2** with the census citation (5.0 on hraesvelgr_v1, the
  discard engine; 1.0 on sleipnir_v2 — the roster-general number is the low one, the ceiling
  column in 149c-6 shows the rest). Ledger: `carrion_swoop` 1.1 → ~2.2.
- **149c-4 — width.** `calculatePowerscale` returns `{score1v1, score3v3}` (`Side`/`All` scope
  ×1.0 / ×2.2; everything else identical); the report and `weak.ts`/`bandspread.ts` print both;
  verdict rule per §4.2. Ledger: the five Ice cards drop to 0–10% over at 1v1.
- **149c-5 — tolerance.** ±15%, three states + `MANUAL REVIEW`, percentage printed everywhere
  (`weak.ts`, `bandspread.ts`, `balance_report` §1.3, the audit scripts).
- **149c-6 — the hook formula.** New `scoreHook(hook, {rate, horizon})` used for daemons (replacing
  `EXPECTED_DAEMON_PROCS`) and, new, for OS hooks. Two rate tables in `powerscale.ts`, each entry
  citing `research/scorer-pricing.md` §2: `TRIGGER_RATE_FLOOR` (roster mean, procs per unit-turn —
  turn start/end 0.8, own 0-cost play 1.0, own triggered draw 0.33, Burn-on-self 0.14, Light attack
  0, opponent card played 4.2, opponent triggered draw 0.84, damage taken 2.2 capped) and
  `TRIGGER_RATE_CEILING` (the max home-deck rate — own 0-cost play 3.3, own triggered draw 1.4,
  the rest = floor). Daemons: cast turn 2, horizon 3, ×1.5 premium kept and named
  `DAEMON_RARE_PREMIUM`. Report columns: `floor`, `ceiling`, `ceiling/floor`. Ledger for the 14
  daemons (expected: `riptide` and `short_circuit` up, `harden`/`cinder_armor`/`einherjar` down to
  ~0 — the last two are honest zeros).
- **149c-7 — the OS band.** `scoreOS(osId)` = Σ hooks via 149c-6 with horizon 5, converted to
  %-of-pool per game with the scorer's own power→HP table; modifier hooks (`multiplier`) price as
  `(multiplier − 1) × the deck's mean attack score × rate`. Printed for all 33 OSes in a new balance
  report section `1.4 Firmware`, band 15–40%, flag >50%. Calibrate against the census table
  (`research/firmware-power-census.md` tables 1–3): a formula that puts GOSSIP, PRIMORDIAL_MILK,
  BARK_SHIELD, KINETIC_RAM and SOLAR_OVERDRIVE at the top and the 8–25% crowd in band is
  calibrated; one that does not is reported, not forced.
- **149c-8 — own-pile shed premium off** (§4.8). Test on `umbral_feast`.
- **149c-9 — close-out.** 63/119/120/121/130 close lines point here; HANDOFF's 0-ASSUMED-STACKS
  and the ticket-130 "draw-2 is unpriced" rule updated (the rule is retired by 149c-2 + 149c-4);
  `research/scorer-pricing.md` gets a §7 with the shipped ledger.

Tests: `powerscale.test.ts` gains one case per constant (cited), the guard, a width case (`Side`
×1.0 at 1v1), a hook-formula case (`riptide` > `harden_daemon` > `einherjar_standard`), an OS case
(GOSSIP above band, NULL_FIRMWARE at 0). `npm run balance` §2–3 byte-identical throughout
(scorer-only); §1.3 churn expected with the ledger.

## 6. Parked, with the reason

- Drawback tail: after 138 (§4.7).
- A "pile at cast" model for the consume family: a deck property, not a card one; the ceiling
  column (149c-6) is the general form of the same insight.
- GOSSIP_NODE's volume: a design question once 149c-7 prints the OS band.
