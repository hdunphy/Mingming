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

Nothing crosses the ticket's >2× flag line on the *rate*; the 0.30 folklore is 1.6–2.3× above
everything measured. Not measured this pass (the lane was cut off): ratatoskr_v1 GOSSIP,
gullinbursti_v2 KINETIC_RAM, kraken_v2 TIDAL_CRUSH (×1.3 in data, not 1.2), hraesvelgr_v2 UPDRAFT,
audhumbla_v1 GENESIS, skoll_v1 TREACHERY, sleipnir MOMENTUM/WAR_STEED, plus `stampede`,
`momentum_crash`, `baseline_strike` in the companion table — one more lane, ~1 h on a quiet box.

**Companion table (scaling attacks vs `fire_punch_v2`):** `carrion_swoop` on hraesvelgr_v1 deals
**2.2 fire-punches a cast** (16.6% of a target's pool, 1.6 casts a game) and scores **1.1** —
`CARDS_DISCARDED` has no branch in `calculatePowerscale` (L687–726) and no manual-review flag, so
it prices at the printed 11 with no scaling. `starfall` reads 3.0 triggered draws on valkyrie_v2
against the 1.25 constant (divergence 2.1×); `serpents_coil` 4.06 cards played against 2.5 (1.5×).

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
