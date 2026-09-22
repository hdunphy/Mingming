# Scorer pricing — the ticket-149 report (149b, 2026-09-08)

**Instrument-only.** Nothing in `programs.json`, `hooks.json`, decks, engine or `powerscale.ts` was
changed. Every number below comes from beamless games on the current tree (HEAD `ae37565`), 1v1 =
owning deck vs the standard 30-opponent set, 3v3 = the ticket-140 §8 panel. Full tables, method and
caveats per measurement: `results/t149_width/FINDINGS.md` (3a), `results/t149_daemons/FINDINGS.md`
(3b), `results/t149_consume/FINDINGS.md` (3c), `research/firmware-power-census.md` (3d, ticket 63),
`results/t149_tolerance/FINDINGS.md` (3e). Scripts: `scratch/t149_*.ts`. Raw game logs (225 MB of
jsonl) are in `results/t149_raw-games.tgz`.

This document is the short form: what each constant was, what it measures, and what the §4 rulings
in ticket 149 now look like with numbers under them.

---

## 0. The one-paragraph read

The scorer is wrong in five places and they are not the same kind of wrong. **Side ×2.2 is a fair 3v3
number applied at 1v1 where the truth is 1.0** — the fix is a width axis, not a constant. **The
daemon constant (4 procs) is right by accident for always-on triggers and off by 2–5× for the
daemons that actually ship**, because the decks built around a trigger fire it 3× the roster mean;
the fix is a per-trigger rate plus a stated play-turn. **`DRAW: 15` buys a card worth 2.3× that on
average**, and the whirlpool_v2 "draw 2" arm proves it in the field (47 → 74% on kraken_v1). **The
consume family has no double count** — the four "over-band" cards are over because the pile at cast
is 2× the census constant (the AI holds the card for a big pile) and because the triangular Poison
lifetime is priced in full when games end after 11–37% of it; and one of them, `carrion_swoop`, is
not the consume family at all but a scaling type the scorer has no branch for. **±15% is the right
tolerance** — the pool's own noise is MAD 13%; sd is meaningless at 71%.

Two things the census found that were not on the ticket: **`hel_v2 lifeblood` ships at ×1.0 and
never fires**, and **`carrion_swoop` delivers 2.2 fire-punches a cast while scoring 1.1** because
`CARDS_DISCARDED` has no scorer branch.

---

## 1. Side scope (3a) — `scope === 'SIDE'` → ×2.2, `powerscale.ts:872`

Five Ice cards (draugr_v2's `frost_bite`, `numbing_gale`, `killing_frost`, `rimefrost`, `ice_spear`)
measured under `Side` (shipped) and an in-memory `Single`, 1200 games per arm at 1v1, 50 per arm at
3v3 (`control_d` = control with draugr_v2 in for ratatoskr_v2, vs the panel).

| width | field ratio Side/Single | per-cast damage ratio | per-cast stacks ratio | multiplier the scorer should use |
|---|---|---|---|---|
| 1v1 | **1.00–1.03** (identical to two decimals per cast) | 1.00 | 1.00 | **1.0** |
| 3v3 | **1.67** (±0.4, n=50/50; every panel cell moved the same way) | 1.5–1.9 | 2.4–2.8 | **1.9–2.2** attack+debuff cards, **2.6** pure debuff (`rimefrost`) |
| run-blended | — | — | — | **~1.6** (a run is ≈⅓ of fights at each width if the player recruits at every workshop; more 1v1 if not; 2v2 unmeasured) |

So ×2.2 is a fair 3v3 price for a damage+debuff card and 2.2× too high at 1v1. One card flipped
barely moves a 3v3 cell; all five do (ink_loop 100 → 60%, control 50 → 10%). The kraken "116
package" turned out not to be side-scoped in shipped data (ABYSSAL_INK_SYS still reads
`RANDOM_ENEMY`; the widening exists only as an arm in `scratch/controlosarms.ts`), so there was no
second owning deck to measure.

**Ruling this feeds (149 §4.1):** the scorer needs a width. Two scores per card (`score1v1` at ×1.0,
`score3v3` at ×2.2) is what the measurement supports; a single blended ×1.6 is defensible but goes
stale whenever 142/148 change the encounter mix.

## 2. Daemons and DRAW (3b) — `EXPECTED_DAEMON_PROCS = 4` (L470), `DRAW: 15` (L102), the guard (L959)

Fourteen daemons in the pool; **three are in a shipped deck** (`echo_chamber_v2` on ratatoskr_v1/v2,
`hoofbeat_daemon` on sleipnir_v1). Proc rates measured with probe hooks (a twin of each daemon's
trigger + `when`, counted outside AI lookahead) over 22,780 unit-turns at 1v1 and 575 at 3v3:

| trigger | field rate, procs per unit-turn (1v1) | units with zero | on the deck that ships it | implied procs per cast vs the constant 4 |
|---|---|---|---|---|
| turn start / turn end | 0.79 | 0–3% | — | ≈3.9 per game — **4 is right by accident of game length** |
| own 0-cost non-token play (echo, hoofbeat) | 1.0 | 6% | ratatoskr_v1 **3.3**, sleipnir_v1 2.3, ratatoskr_v2 2.0 | installed: **21.8** (ratatoskr_v1, 5.4×), 9.5 (sleipnir_v1, 2.4×), 7.6 (ratatoskr_v2) |
| own non-natural draw (feedback_loop) | 0.33 | 67% | kraken_v1 1.4 | 1.6 at t2 on a random deck; 3.8 on kraken_v1 |
| Burn applied to self (cinder_armor) | 0.14 | 84% | fenrir_v1 0.0 | ≈0 |
| Light attack (einherjar) | 0.00 | 100% | — | 0 — no Light attacker in any shipped deck |
| opponent card played (riptide) | **4.2** | 0% | — | ~20 per game — **5× the constant** |
| opponent non-natural draw (short_circuit) | 0.84 | 41% | — | ≈4 |

At 3v3 the shared deck means any unit casts the daemon and the `source: SELF` gate then limits it to
that caster: `echo_chamber_v2` was cast by four different species across 27 games, 4.75 procs per
cast, 2.3 turns alive — the constant lands near right there for the wrong reason.

**Play turn.** The AI casts shipped daemons on turn 1.9 mean (median 2) and skips the 2e
`echo_chamber_v2` in 63% of ratatoskr_v2 games. Priced at per-proc × rate × (game length − cast
turn): on the field rate **no daemon is in band when cast on turn 3**; on their own decks
`echo_chamber_v2` on ratatoskr_v1 is 2.5× OVER at turn 3 and `riptide` is 1.2–1.7× over; everything
else is under. Henry's bar ("positive even on turn 3") is met by nothing on the roster mean and by
two cards on their home decks. Full table in the findings.

**DRAW.** 15 power = 1.5 score buys a card whose mean scorer value across the 33 shipped decks is
**3.39 (2.26×)** — under the mean in 31 of 33 decks, range 1.39 (nidhoggr_v1) to 7.09 (ymir_v2).
The ticket-131 case, re-run at 1200 games each on kraken_v1:

| whirlpool_v2 arm | score | field |
|---|---|---|
| shipped: 8 power, draw 1, 2 Dazed | 3.2 | **47.1%** |
| draw 2, 1 Dazed, no power | 2.8 | **73.9%** (positive vs 30/30 opponents, median +27) |

Eight cards in the pool draw more than one (`scry`, `tempest`, `tailwind`, `creeping_dread`,
`squirrel_away`, `dread_tidings`, `morning_light`, `tide_reading`); ticket 130's rule — a card that
draws more than one is unpriced, gate it on a field arm — stands until 149c.

**The guard** is confirmed: an in-memory `feedback_loop_daemon` with an added on-cast ATTACK 10
scores 1.2 instead of 3.2 — the hook branch is skipped. No shipped daemon trips it today. Bonus
reads: `scrubber` scores **−1.6** (ally Poison removal priced as a downside); `core_overclock_daemon`
and `einherjar_standard` score **0.0** (modifier hooks have no `do`, so no price).

## 3. The consume family (3c) — `ASSUMED_CONSUMED_STACKS` (L565), `ASSUMED_WEAKENED_STACKS` (L556), `MEASURED_BOARD_PILE` (L404)

Every cast of each card logged with the pile read before the reducer and consumed after, 1200 games
per owning deck at 1v1.

| card | deck | casts/game | pile READ at cast (mean / median / p90) | pile on an ordinary owner turn | constant the scorer uses | shipped score | score at the measured pile |
|---|---|---|---|---|---|---|---|
| `hexbloom` | huldra_v1 | 2.28 | Weakened **10.2** / 10 / 17 | 4.3 | 5 | 3.5 (−46%) | 16.1 (+148%) |
| `contagion` | jormungandr_v2 | 0.72 | Poison **8.9** / 8 / 14 | 5.5 | 6.57 | 20.4 (+214%) | 36.9 (+467%) |
| `umbral_feast` | nidhoggr_v2 | 0.60 | self Poison **4.7** / 2 / 12 | 1.3 | 8 | 14.9 (+397%) | 6.2 (+105%) |
| `bloodwrath` | nidhoggr_v2 | 0.87 | self Poison **4.4** / 2 / 11 | 1.3 | 8 | 20.2 (+573%) | 8.5 (+182%) |
| `ash_communion` | fenrir_v2 | 0.35 | self Burn **2.8** / 3 / 3 | 0.9 | 1.5 | 4.6 (−29%) | 8.8 (+36%) |
| `corrosive_leak` | jormungandr_v1 | 1.83 | (adds 2; 69% of casts on an empty pile) | 1.4 | none — its price is the Energized term | 2.3 (+130%) | 2.3 |

At 3v3 (panel cells, 20–26 games per deck, run 2026-09-09) the cards are cast far less — hexbloom
0.20 a game, contagion 0.30, corrosive_leak 0.50 — and the pile at cast is *bigger* for contagion
(15.7 Poison, one cast at 44) and about the same for hexbloom (6.0; the enemy Weakened census at
width is 0.9 because ALLURE_PROXY's stacks spread over three bodies). corrosive_leak is cast on an
empty pile 100% of the time at width.

**Question 1 — is the pile at cast the census mean?** No. For every card that reads an existing pile
the AI holds it for **~2× the pile it sees on an ordinary turn** (hexbloom 10.2 vs 4.3; contagion
8.9 vs 5.5). The census means ticket 66 installed were the right measurement of the wrong moment.
For the two Poison-consume cards the direction is the other way: the pile is **half** the constant 8.
And `ash_communion`'s 1.5 (ticket 58) is now half of what fenrir_v2 actually carries.

**Question 2 — is the non-consuming path double-counted?** **No.** `hexbloom`'s two actions price
against two *different* constants (read at 5 via L755–761, consume at 3 via the L566–569 fallback)
and the consume is a *negative* term (L903) — 4.5 − 1.05 = 3.5. What the scorer misses is the pile,
not the sign. The place the same stacks *are* counted twice is `umbral_feast`/`bloodwrath`: the
shed is priced as the full triangular lifetime of an 8-stack pile **with ticket 51's ×1.25 removal
premium** (L951–953: 12.15 of the 14.9), and then the payoff prices the same stacks again (2.7).
The premium's rationale — "an answer cheaper than the threat it answers" — is about neutralising
the opponent's card; here the pile is the deck's own fuel. Drop the removal term and price the
payoff at the measured pile: umbral_feast 1.6 (UNDER its 1e band), bloodwrath 4.4 (+47%).

**The bigger term is the lifetime.** `poisonPower(S) = 1.5·S·(S+1)` prices a pile as every tick it
will ever do. Games end first: contagion's doubling is charged 145% of a health pool per cast and
ticks **11%** before the game ends (mean 4.6 turns); hexbloom 37%; umbral_feast's shed 86%. That,
not the pile constant, is why the measured pile makes contagion *more* over-band.

`corrosive_leak`'s +130% is entirely `ENERGIZED_POWER_PER_STACK = 35` (L303) against a 1.0 band; it
is played as a 0-cost Energized card (69% of casts on an empty pile). A question about that
constant, not about piles.

## 4. Firmware power-rate census (3d, ticket 63) — see `research/firmware-power-census.md`

Headline rows (HP per printed power on a 75-HP frame; ticket 61 measured 0.19 damage / 0.20 heal;
the spec's own rates are 0.25 damage / 0.1875 heal; the folklore was 0.30):

| payoff | implied rate | read |
|---|---|---|
| valkyrie_v2 REBIRTH_CYCLE attack (15 power, random enemy) | **0.128** | 1.5× under the floor — no STAB, no stack riders, random target |
| valkyrie_v2 REBIRTH_CYCLE heal (15 power) | 0.179 | on spec |
| hraesvelgr_v1 GALE_FORCE (ships at **8** power, not the ticket's 10) | 0.209 | on spec |
| `fire_punch_v2` benchmark (30 power) | 0.189 | = ticket 61 |
| jormungandr_v2 TOXIN_FANG (+10 HP flat per Poison stack, post-divisor) | **×3.93** on the attack it rides (+94 HP on a 32 HP hit; 40% of a pool a game) | printed in HP, so it does not move with the pace dial |
| skoll_v2 SOLAR_OVERDRIVE (uncapped) | **×2.00**, +51% of a pool a game | the scorer has no term for it |
| hel_v2 UNDERWORLD_GATEWAY toll | 5.0%/Energy, exactly as printed; 55% of her pool a game | — |
| hel_v2 `lifeblood` "+50% healing" | ships at `multiplier: 1.0` — **inert, 0 fires in 8.3 offers a game** | data defect or deliberate? |
| huldra_v1 ALLURE_PROXY | ~18 free Weakened a game on the enemy | the pile hexbloom cashes (§3) |
| gullinbursti_v2 KINETIC_RAM (+2.5 HP flat per Sharp, post-divisor) | **×2.53** on the attack (13 Sharp read; 23 procs, 63% of a pool a game) | the same flat-HP shape as TOXIN_FANG, bigger by volume |
| ratatoskr_v1 GOSSIP_NODE (10-power heal per ally 0-cost) | 0.179 per proc — on spec — but **54 procs a game = 127% of her pool healed** | the largest delivered-per-game number in the census |
| kraken_v2 TIDAL_CRUSH | ×1.30 exactly (data says 1.3, the ticket said 1.2) | — |
| `baseline_strike` on the control frame (no STAB, no firmware) | 0.146; 0.77 of `fire_punch_v2` | the "same card, different deck" spread the scorer cannot see |

Nothing crosses the ticket's >2× flag line on the *rate*; the 0.30 folklore is 1.6–2.3× above
everything measured. The census is complete (the last nine owners ran 2026-09-09).

**Companion table (scaling attacks vs `fire_punch_v2`):** `carrion_swoop` on hraesvelgr_v1 deals
**2.2 fire-punches a cast** (16.6% of a target's pool, 1.6 casts a game) and scores **1.1** —
`CARDS_DISCARDED` has no branch in `calculatePowerscale` (L687–726) and no manual-review flag, so
it prices at the printed 11 with no scaling. `starfall` reads 3.0 triggered draws on valkyrie_v2
against the 1.25 constant (divergence 2.1×); `serpents_coil` 4.06 cards played against 2.5 (1.5×); `stampede` 4.3 against 2.5 on both sleipnir decks
(2.5 fire-punches a cast on v1, 2.7×); `momentum_crash` consumes 8.6 Strengthened against the constant
8 — the constant is right and the card is still 2.2 fire-punches for 1e (2.4×). `carrion_swoop` on
sleipnir_v2, which has no discard engine, prices exactly — the scaler is the whole card.

## 5. Band tolerance (3e) — `bandspread` on the current pool, n = 232

| statistic | value |
|---|---|
| median / mean of score as % of ceiling | −3.3% / −8.0% |
| **median absolute deviation** | **13.3%** (11.5% trimmed) |
| standard deviation | 70.8% — 18 cards with |dev| > 100% own it |
| cards over +5 / +15 / +25 / +50% | 48 / **34** / 27 / 14 |
| cards under −15% | 84 (29 below −50%; eight score exactly 0.0 — the scorer has no price for them) |

±15% sits on the pool's own noise. The over-band set is bimodal — a cluster at +3…+13% (24 cards,
"within tolerance") and a tail above +25% — so +15% → +25% only drops seven cards. Seven of the top
fourteen over-band cards are the Ice Side cards (entirely §1). Drawback cards score *negative*
(`desperate_strike`, `dark_pact` −140%; `wither_feast` −266%; also `scrubber`, `vent`,
`unbound_fang`, `discharge`, `all_in`, `reckless_charge`) — a tolerance rule should route score ≤ 0
to manual review rather than the under-band list.

---

## 6. What this does to the §4 rulings

1. **Width:** measured 1.0 / ~2.2 / ~1.6 blended. Two scores per card is the honest shape; the
   blended number moves with 142/148.
2. **Daemon play turn:** the AI's own median is **turn 2**. Price at turn 2, print 1–3. Also: the
   rate must be *per trigger* (turn-start 0.79, 0-cost play 1.0 roster / 3.3 on the home deck,
   opponent-card 4.2), not one constant — and the home-deck rate is the one that matters, which is a
   deck-context question the scorer cannot answer alone (same shape as DRAW).
3. **Tolerance:** ±15% confirmed by the data (MAD 13%). Three states, percentage always printed,
   score ≤ 0 → manual review.
4. **A card that moves under an honest price:** the census gives a ledger of ~15 cards that would
   re-score by more than a band (Ice Side cards *down* at 1v1; contagion/hexbloom *up*; umbral_feast
   /bloodwrath *down*; ash_communion up; carrion_swoop up; whirlpool_v2 draw arms). None of them
   should be auto-tuned — but four of them (`contagion`, `carrion_swoop`, `bloodwrath`,
   `hexbloom` at the measured pile) are 2–5× over band on delivered value, which is the same
   signal ticket 136 acted on.
5. **The drawback tail** wants its own pass once 138 settles; the census already shows the sign
   convention is the problem (self-harm priced at full lifetime, ×1.25 removal premium on the
   deck's own fuel).

Two new items for Henry that are not scorer questions: `hel_v2 lifeblood` at ×1.0, and whether
TOXIN_FANG / KINETIC_RAM stay flat post-divisor HP (they are the only payoffs that do not scale with
the pace dial).


## 7. What shipped (149c, 2026-09-21) — the ledger

Nine rows, one commit each, scorer-only: §2–3 of the balance report are untouched throughout, and
no engine code changed, so nothing here needs re-simulating.

### 149c-1 — the guard

`Daemon && score === 0` priced hooks as a FALLBACK for "the card scored nothing" and ASSIGNED
rather than added, so a daemon with both an on-cast action and a hook lost the hook (§2's measured
case: an in-memory `feedback_loop_daemon` with an added on-cast ATTACK 10 scored 1.2 instead of
3.2). Now additive. **§1.3 byte-identical**, verified by scoring all fourteen daemons before and
after: thirteen carry `actions: []` and the fourteenth (`battery_pack`) registers no hooks. That
claim is a test now, so the day someone authors a daemon with both, it says so.

### 149c-2 — DRAW 20/15/10

Up from 15/10/5 on §4.1. `'DRAW': 15` deleted from `ACTION_WEIGHTS`, where it was read by nothing
and misled anyone looking the price up. **24 cards moved**, and every figure §4.1 predicted
reproduced exactly:

| | |
|---|---|
| newly past +15% | `dread_tidings` +7% → +37%, `whirlpool_v2` +7% → +20%, `pressure_point` +3% → +17%, `rejuvenation` +0% → +17% |
| the draw-2s | `morning_light`/`squirrel_away`/`tailwind`/`tempest`/`tide_reading` −23% → +7% |
| 0e cantrips | `glimmer`/`slipstream`/`undertow` +40% → +80% (the 0e ceiling being tight, not the cards) |
| one of its own | `forage` 0.0 → 0.5 — "draw 1, take 15 power" scored LITERALLY ZERO, the old draw price exactly cancelled by its own drawback |

A DRAW action is `target: 'SELF'` on every card in the registry, so it always takes the 0.9
self-scope discount: the effective first card is 18 power, not 20. True of 15/10/5 too, so no
ratio here moves.

### 149c-3 — `CARDS_DISCARDED`

Had no branch and no manual-review flag. `carrion_swoop` — §4's "largest single miss in either
table" — **1.1 → 2.2**. The constant is **2**, not the measured 5.03: 5.03 is hraesvelgr_v1's
number and hraesvelgr_v1 IS the discard engine; on sleipnir_v2 the card discards about one. Even
doubled it sits **27% under** its 1e band while being 2.4× a `fire_punch_v2` on the deck built for
it, which is the floor/ceiling spread in its purest form.

### 149c-4 — width

`score1v1` and `score3v3`, Side scope ×1.0 / ×2.2 (measured 1.9–2.2 delivered per cast, not
counted). Verdict on `score1v1` unless Side/All, where it is the worse of the two. **All 22 Side
cards moved and nothing else.**

**The finding Henry has not yet ruled:** seven of the eight worst are Ice, and every one of them is
at or under band at 1v1 while 58–143% over at 3v3 — `frost_bite` +143/+10, `numbing_gale` +120/+0,
`killing_frost` +120/+0, `rimefrost` +90/−10, `ice_spear` +87/−13, `numbing_storm` +69/−23,
`rime_spear` +58/−28. **Ice reads as a 3v3 element**, and the old single score was averaging that
into seven redlines.

`All` scope collapses to ×1.0 at 1v1 and keeps ×4.0 at 3v3 rather than inheriting Side's measured
2.2. No card in the pool has `target: 'All'`, so it prices nothing; flagged in the constant.

### 149c-5 — ±15% tolerance

Four states with the percentage always printed. **15 is the pool's own median ABSOLUTE deviation
from band** — 15.4% at 1v1, 13.8% at 3v3 across 236 costed non-token cards. MAD and not sd on
§4.3's ruling, and the numbers say why: the sd is **68.8%**, 4.5× the MAD, dragged by a handful of
cards 200–570% over. A tolerance built on the sd would be built on `bloodwrath`.

    before   71 redlines
    after    36 redlines, 35 within tolerance, 16 manual review (160 of 243 in band at 1v1)

Nothing was repriced by this row. A score ≤ 0 routes to MANUAL REVIEW rather than "under band":
those are the §4.7 drawback tail (`scrubber` −1.6, `wither_feast` −10.8), and calling them far too
weak would be the report asserting something it does not know.

### 149c-6 — the hook formula

`payoff × rate × horizon` replaces `EXPECTED_DAEMON_PROCS = 4`, with §2's per-trigger rates.
Daemons: cast turn 2, horizon 3.

| daemon | before | after | band | floor | ceiling | index |
|---|---|---|---|---|---|---|
| `riptide` | 3.8 | **11.9** | 6.5 | 11.9 | 11.9 | 1.0 |
| `fertile_ground_daemon` | 9.7 | 5.8 | 6.5 | 5.8 | 5.8 | 1.0 |
| `short_circuit` | 7.6 | 4.8 | 6.5 | 4.8 | 4.8 | 1.0 |
| `echo_chamber_v2` | 4.9 | 3.6 | 6.5 | 3.6 | **12.0** | **3.3** |
| `drip_feed` | 5.9 | 3.6 | 6.5 | 3.6 | 3.6 | 1.0 |
| `hoofbeat_daemon` | 3.8 | 2.8 | 6.5 | 2.8 | **9.4** | **3.4** |
| `reactive_plating` | 1.6 | 2.7 | 6.5 | 2.7 | 2.7 | 1.0 |
| `harden_daemon` | 1.6 | 1.0 | 3.0 | 1.0 | 1.0 | 1.0 |
| `feedback_loop_daemon` | 3.2 | 0.8 | 3.0 | 0.8 | **3.4** | **4.3** |
| `cinder_armor_daemon` | 1.6 | 0.2 | 6.5 | 0.2 | 0.2 | 1.0 |
| `einherjar_standard` | 0.0 | 0.0 | 6.5 | — | — | — |
| `core_overclock_daemon` | 0.0 | 0.0 | 6.5 | — | — | — |
| `scrubber` | −1.6 | −1.0 | 6.5 | −1.0 | −1.0 | — |
| `battery_pack` | 4.9 | 4.9 | 10.5 | — | — | no hooks |

**`riptide` is the headline and a new redline**: 42% under its band to 83% over. Nothing about the
card changed; the scorer started counting the 4.2 procs a unit-turn its trigger actually fires at.

**§5 expected `short_circuit` up and it goes down.** Its trigger is the opponent's non-natural
draw at 0.84/unit-turn — 2.5 procs over the horizon against the old 4. §2's own table says the
implied figure is "≈4", i.e. the constant already matched it; there was never headroom to find.

Two zeros, and only one of them is a gap. `einherjar_standard` is an **honest zero** — its Light
attack trigger measured 0.00 across 22,780 unit-turns because no shipped deck has a Light attacker
— so it is not flagged. `core_overclock_daemon` IS flagged: a multiplier on `onDamageCalculated`
with no element gate is a class §2 never measured, and a fallback rate would read as a
measurement.

### 149c-7 — the firmware band

All 33 OSes scored in **%-of-pool per game**, band 15–40, flag >50, as a new §1.4 of the balance
report.

**§5's "horizon 5" was not used, on Henry's ruling.** The daemon trigger table has eight classes
drawn from fourteen daemon hooks and cannot reach firmware (`onHeal`, `onDiscarded`,
`onDeckShuffled`, `onHpThresholdCrossed`, `onStatusRemoved`, any-cost own-play). The firmware
census measured each OS in **procs per game**, which is already the band's denominator — so the
rates are per-hook and measured, and there is no horizon to multiply by.

    FLAGGED     GOSSIP_NODE 143.5% · REBIRTH_CYCLE_OS 117.7% · PRIMORDIAL_MILK 108.8%
                TWILIGHT_CADENCE 71.5%
    OVER BAND   WAR_STEED_OS 41.1%
    IN BAND     14 of them, 15.2-38.0%
    UNDER BAND  kraken_v2 11.9 · jormungandr_v1 9.8 · fenrir_v2 9.2 · skoll_v2 8.3
                nidhoggr_v1 2.7 · hel_v2 0.0
    UNMEASURED  audhumbla_v1, control_v1, fafnir_v1, gullinbursti_v1, hraesvelgr_v2,
                huldra_v2, valkyrie_v1, ymir_v2

**Calibration, reported and not forced (§4.5).** GOSSIP and PRIMORDIAL_MILK land at the top and
fourteen of the 8–25% crowd land in band. **BARK_SHIELD, KINETIC_RAM and SOLAR_OVERDRIVE do not**,
and it is one fact three times: the scorer can only see firmware that lives in `hooks.json`. Six
OSes register no hooks at all — their behaviour is in `CustomFirmware` code. SOLAR_OVERDRIVE is
half-visible: its +1 Strengthened hook is in data (8.3%), its +10%-per-stack multiplier, which is
the 51% the census measured, is not. KINETIC_RAM is the floor/ceiling case again: +2.5 HP per Sharp
stack at the roster-assumed 3 is 15.6%, against 13 stacks measured on the deck built to feed it.

**Two flags §4.5 did not predict.** REBIRTH_CYCLE_OS looks real — 15 power of damage AND a
15-power heal, 14.12 reshuffles a game; the census recorded the two halves separately and never
summed them. TWILIGHT_CADENCE is probably an artefact: its payoff is a STANCE status the scorer has
no price for, so it takes the generic 2-per-stack fallback, which §4 of the firmware census says in
its own words. Treat 71.5% as unpriced, not as a finding.

A sign bug the ledger caught: GRAVE_CHILL_OS is ×0.8 on the damage Draugr TAKES, and priced as
`(m − 1)` it read **−23% of a pool** — the report calling a defensive firmware a debt. `(1 − m)`
for a hook on the opponent's damage; now 23% and in band.

### 149c-8 — the own-pile shed premium

§4.8. The ×1.25 removal premium exists because shedding a debuff undoes an OPPONENT's card too;
that does not survive a `consume`, where the pile is fuel the deck built. **The discriminator is
`consume`, not the target** — a `stacks: -N` self-shed is still removal and keeps the premium
(`purify` is untouched).

| | | |
|---|---|---|
| `umbral_feast` | 14.9 → 12.4 | +397% → +313% |
| `bloodwrath` | 20.2 → 17.7 | +573% → +490% |
| `ash_communion` | 4.6 → 4.3 | −29% → −34% |

§4.8 predicted the shed term at 12.15 → 9.7 and both Poison cards drop by exactly 2.5.
`ash_communion` was not named and moves anyway: it consumes its own BURN, same shape, same reason.

### 149c-9 — close-out

Tickets **63 / 119 / 120 / 121 / 130** closed against this section. HANDOFF's `0-ASSUMED-STACKS`
extended (the same constant is now the floor for a flat-bonus firmware hook, and the same trap is
in it). **Ticket 130's "any card that draws more than one is unpriced, gate it on a field arm"
rule is RETIRED** by 149c-2 and 149c-4 — those cards have a price now.

`BALANCE_REPORT_SCHEMA_VERSION` 1 → 5 across the nine rows.

### Open for Henry (§4.6: reported, never auto-tuned)

1. **`riptide`** — 3.8 → 11.9, 83% over its band.
2. **Ice as a 3v3 element** — seven cards, at band at 1v1 and far over at 3v3.
3. **REBIRTH_CYCLE_OS** — 118% of a pool a game, not on §4.5's flag list.
4. The 36 cards still out of band and the 35 inside the tolerance, per row.
