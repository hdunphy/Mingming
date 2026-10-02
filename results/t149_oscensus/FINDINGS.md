# Ticket 149 (3d) — firmware power-rate census (ticket 63): what an OS payoff delivers per proc

Instrument-only. Scripts: `scratch/t149_castprobe.ts` (wraps every hook of the owner's OS in place after `getOSBehavior` has registered it — hooks.json and `CustomFirmware.ts` alike — and, outside AI lookahead (`isSimulating()` false), diffs the state a `do`-hook returns against the one it was given: enemy HP lost, `damageLedger` raw appended, owner HP gained / lost, owner and enemy stack deltas, energy, max energy, hand; for modifier hooks the number returned minus the number given, which is HP because modifiers run after the damage divisor), `scratch/t149_oscensus_report.ts` (the table), `scratch/t149_scaler_report.ts` (the companion table). Data: `results/t149_oscensus/w1_<deck>.jsonl` (600 games = 20/opponent), `results/t149_consume/w1_<deck>[_s].jsonl` (1200 games = 40/opponent), `results/t149_oscensus/w1_fenrir_v2_firepunch.jsonl` (580 games; fire_punch_v2 swapped in-memory for water_slap).

Method: owning deck on its own species, PLAYER side, vs the standard 30-opponent set, beamless, stat jitter 5, paired turn orders. **Frame** = the owner's maxHp (ticket 61's convention; NUMBER_SCALE 10 frames are 1100-1350 HP). **Implied rate** = (delivered %maxHp per proc / printed power) x 0.75 = HP per printed power on a 75-HP frame, the unit ticket 61 quoted (0.19 damage / 0.20 heal vs the 0.30 folklore). On that scale the spec's 3-power-per-1% damage rate is 0.25 and the 4-power-per-1% heal rate is 0.1875. Stat grants are converted to power with the scorer's own tables (Strengthened / Dazed 5 a stack, Sharp / Weakened 3.5, Regen 12, BarkShield 4 per %, Energized 35, Energy 40 a point, a card 15, max Energy 40 flat; an enemy-side buff counts negative) and then to %maxHp at 3 power per 1% — so a grant's HP-eq is by construction the scorer's price and its rate column is n/a; only HP-denominated payoffs are rated and flagged.

**What was NOT measured** (the run was cut off after the first eight 1v1 lanes; do not launch more sims was the instruction): ratatoskr_v1 GOSSIP_NODE (10-power heal), hraesvelgr_v2 UPDRAFT_KERNEL, audhumbla_v1 GENESIS_FIRMWARE, gullinbursti_v2 KINETIC_RAM (+2.5/Sharp), kraken_v2 TIDAL_CRUSH (x1.3 in shipped data, not 1.2), skoll_v1 TREACHERY_KERNEL, sleipnir_v1 MOMENTUM_DRIVE + hoofbeat_daemon (8 power), sleipnir_v2 WAR_STEED, control_v1 `baseline_strike`. Two names in the ticket's list do not exist in the shipped data: NOURISH_ROUTINE ("50%") was replaced by audhumbla_v2 PRIMORDIAL_MILK (+3 Regen per heal card; `mingmingRegistry.ts` L804 still calls v2 "NOURISH CANNON" in a comment), and hel_v2 `lifeblood` "+50% healing" ships as `multiplier: 1.0` (`hooks.json` L1117-1124) — measured 0 fires in 8.3 offers a game, i.e. inert.

## Table 1 — HP-denominated payoffs, ranked by |divergence| from the 0.19-0.30 band

| OS | payoff text | printed value | delivered / proc | procs / game (offers) | delivered / game | implied rate (HP per printed power, 75-frame) | flag |
|---|---|---|---|---|---|---|---|
| valkyrie_v2 REBIRTH_CYCLE_OS (damage half) | on reshuffle: 15 power Light to a random enemy | 15 power | 31.0 HP raw (27.7 after shields) = 2.56% frame | 14.12 (18.28) | 438 HP raw | **0.128** | 1.5x under the band floor; not >2x |
| hel_v2 UNDERWORLD_GATEWAY toll | Dark spell costs 5% maxHp per printed Energy instead of Energy (25%/turn cap) | 5% maxHp / Energy | -123.5 HP = 10.35% maxHp (= 2.07 Energy a cast) | 5.27 (25.50) | -651 HP = 55% of her pool a game | matches print (5.0%/Energy) | none; the cost hook zeroes the Energy price 5.27x a game |
| valkyrie_v2 REBIRTH_CYCLE_OS (heal half) | ... and heals herself 15 power | 15 power | 43.6 HP = 3.59% maxHp (3.75% before the overheal clamp) | 14.12 | 616 HP | **0.179** | in band (heal spec 0.1875) |
| hraesvelgr_v1 GALE_FORCE_OS | voluntary discard: 8 power Air to a random enemy (data says 8; the ticket's "10" is not what ships) | 8 power | 25.6 HP raw (24.1 applied) = 2.23% frame | 12.80 (14.18) | 328 HP raw | **0.209** | in band |
| fenrir_v1 UNBOUND_KERNEL recoil | attack: -2% maxHp recoil (+1 Strengthened) | 2% maxHp | -22.0 HP = 1.95% maxHp | 6.09 (19.15) | -134 HP = 11.9%/game; +6.0 Strengthened/game | matches print | none |
| fafnir_v1 HOARD_PROTOCOL recoil | turn start: 1% maxHp per hoarded point (min 1) | 1% / point | -23.4 HP = 1.88% maxHp (1.91 hoarded) | 0.40 (7.83) | -9.4 HP | matches print | none; fires 0.4x a game — the hoard rarely exists |
| fire_punch_v2 (the 30-power benchmark, fenrir_v2 frame) | 30 power | 30 power | 88.5 HP raw (80.0 applied) = 7.54% of target maxHp | 0.57 casts/game | - | **0.189** | = ticket 61's 0.19 |

Reading: a printed 15-power OS attack lands at 0.128 on valkyrie's frame against 0.189 for a printed 30-power card on fenrir_v2's — the OS hit has no STAB, no Strengthened / Sharp riding it and picks a random enemy, so the "0.19 per printed power" folklore over-reads OS damage by ~1.5x; the heal half (0.179) and GALE_FORCE (0.209) are on the spec rate. Nothing crosses the >2x flag line. The 0.30 folklore is 1.6-2.3x above everything measured.

## Table 2 — modifier hooks (delivered HP per proc is the delta the hook adds; "printed" is the multiplier / bonus)

| OS | payoff text | printed | delivered / proc | procs / game (offers) | delivered / game | effective multiplier | note |
|---|---|---|---|---|---|---|---|
| jormungandr_v2 TOXIN_FANG_OS | attacks +10 HP (flat, post-divisor) per Poison stack on target | +10 HP / stack | +93.9 HP on a 32.1 HP base = 7.07% frame (= 9.4 stacks read) | 5.70 (16.23) | +535 HP = 40% of a pool | **x3.93** | the flat bonus is 3x the attack it rides; printed as HP, not power, so it does not scale with the pace divisor |
| skoll_v2 SOLAR_OVERDRIVE_OS | attacks +10% per Strengthened stack, no cap | +10% / stack | +131.2 HP on 131.0 = 11.43% frame (= 10 stacks) | 4.75 (11.81) | +624 HP = 51% of a pool | **x2.00** | plus `solar_charge` +4.8 Strengthened a game |
| fenrir_v1 UNBOUND_KERNEL berserk | Fire attacks up to +50%, scaled by missing HP | up to x1.5 | +33.9 HP on 145.2 = 3.00% frame | 6.79 (15.70) | +230 HP | x1.23 | mean missing HP ~47% at cast |
| ymir_v2 GLACIAL_PACE_OS | Ice cards x1.25 | x1.25 | +36.6 HP on 148.0 = 2.67% frame | 6.74 (18.79) | +247 HP | x1.25 | exact |
| draugr_v2 GRAVE_CHILL_OS | enemies with 2+ debuffs deal x0.8 to Draugr | x0.8 | -15.2 HP on 74.2 = -1.23% frame | 8.70 (25.12) | -133 HP taken | x0.79 | fires on 35% of hits |
| hel_v2 UNDERWORLD_GATEWAY cost hook | Dark spell Energy cost -> 0 | - | -2.07 Energy a cast | 5.27 (25.50) | -10.9 Energy a game (= 436 power-eq at 40/point) | - | the Energy half of the toll above |
| hel_v2 lifeblood | onHealCalculated x1.0 | x1.0 | 0 | 0.00 (8.30) | 0 | - | inert |

## Table 3 — stat / resource grants (HP-eq at the scorer's own table; rate n/a)

| OS | payoff text | printed | delivered / proc | procs / game (offers) | delivered / game | HP-eq / game (scorer table) |
|---|---|---|---|---|---|---|
| huldra_v1 ALLURE_PROXY | ally buffs ally: 1 Weakened on a random enemy | 1 Weakened | +0.87 enemy Weakened (0.13 cancels an enemy Strengthened) | 20.34 (70.89) | +17.8 enemy Weakened | 75 power = 25% pool — the pile hexbloom cashes (3c) |
| kraken_v1 ABYSSAL_INK_SYS | ally effect-draw: 2 Dazed on a random enemy | 2 Dazed | +1.80 enemy Dazed (0.20 cancels Sharp) | 6.58 (37.22) | +11.8 enemy Dazed | 64 power = 21% |
| ratatoskr_v2 INSTIGATOR_OS | ally plays 0-cost at enemy: 1 Dazed | 1 Dazed | +0.91 enemy Dazed | 12.55 (28.91) | +11.4 enemy Dazed | 62 power = 21% |
| nidhoggr_v2 BLOOD_SCENT_OS | any unit crosses half HP: +1 Energy, draw 1 | 1 Energy + 1 card | +1 Energy, +1 card | 2.11 (2.11) | +2.1 Energy, +2.1 cards | 116 power = 39% |
| nidhoggr_v1 ROOT_CORRUPTION | enemy turn end: +1 Poison (cancels the decay) | 1 Poison | +1 enemy Poison | 2.66 (6.54) | +2.7 enemy Poison | 53 power = 18% (at the 20-a-stack fallback; the real value is the triangular tail it preserves) |
| ymir_v1 GLACIER_HEART_SYS | turn start: +4 BarkShield | 4% maxHp shield | +4.00 | 7.90 (15.88) | +31.6 % shield | 126 power = 42% |
| huldra_v2 BARK_SHIELD_OS | end of first turn: 50% BarkShield | 50% | +50 | 1.00 (10.29) | +50 % | 200 power = 67% |
| audhumbla_v2 PRIMORDIAL_MILK | heal card: +3 Regen | 3 Regen | +3.00 | 10.20 (16.36) | +30.6 Regen | 367 power = 122% (Regen 12/stack is the scorer's price, not a measurement of HP healed) |
| fafnir_v2 CORRUPTED_GOLD_OS | turn start: +2 Strengthened per debuff type, each debuff -1 | 2 / type | +3.66 Strengthened; -0.9 Dazed, -0.8 Poison, -0.2 Weakened, -0.1 Burn | 3.08 (6.84) | +11.3 Strengthened | 31 power = 10% (net of the debuff sheds at their table prices) |
| fenrir_v1 UNBOUND_KERNEL (both hooks) | attack: +1 Strengthened; ally attack: +1 (SELF is an ally in 1v1, so both fire on her own attacks) | 1 + 1 | +0.98 and +0.97 Strengthened | 6.09 each (19.15) | +11.9 Strengthened | 59 power = 20% |
| fenrir_v2 CINDER_WALL_OS | ally applies Burn: +1 Sharp | 1 Sharp | +0.95 Sharp | 9.24 (28.89) | +8.8 Sharp | 28 power = 9% |
| skoll_v2 solar_charge | ally plays a Fire attack: +1 Strengthened | 1 | +0.97 | 4.98 (17.43) | +4.8 | 23 power = 8% |
| jormungandr_v1 OUROBOROS_LOOP | 5th Water card a turn: draw 1 | 1 card | +1 card | 1.63 (24.29) | +1.6 cards | 24 power = 8% |
| draugr_v1 PERMAFROST_WAKE | wake from Asleep: +1 Energized, draw 1 | 1 + 1 | +1 Energized, +1 card | 0.91 (2.05) | +0.9 each | 46 power = 15% |
| fafnir_v1 HOARD_PROTOCOL hoard | turn end: unspent Energy -> Energized | - | +1.91 Energized | 0.49 (7.89) | +0.9 Energized | 33 power = 11% (then the recoil above) |
| hel_v1 TWILIGHT_CADENCE | Dark cast -> DarkStance (+45% dealt); Light cast -> LightStance (-45% taken) | stance | 1 stance swap | 6.02 + 5.89 (43.64) | 12 stance swaps | 20-a-stack fallback, not priced by the scorer |
| valkyrie_v1 VALHALLA_UPLINK | turn end: replay a random discard for free | a card | 66.0 HP raw damage (5.43% frame) + 30.4 HP heal (2.50%) + 0.6 Strengthened + 0.35 Sharp | 7.07 (14.84) | 467 HP raw dmg + 215 HP heal | a free ~35-power card a turn: 7.9% of a pool in HP a proc |
| gullinbursti_v1 UNSTOPPABLE_MASS | primes next attack +3 power per Sharp | - | (BUFF_NEXT_PROGRAM: no state delta the probe reads) | 0 measurable (42.84 offers) | - | not measured by this instrument |

## Companion table — the per-turn scaling attacks vs the 30-power benchmark

Damage = the cast's `damageLedger` raw sum (all hits, before shields and the 0 floor). Divergence = (measured damage ratio to fire_punch_v2) / (scorer score ratio to fire_punch_v2); 1.00 = priced exactly as it delivers. Ranked by |divergence|.

| card | owner deck | games | casts | casts / game | scaler read at cast (mean) | dmg raw / cast | % target maxHp / cast | 0-dmg casts | shipped score (band) | dmg ratio vs fire_punch_v2 | score ratio | divergence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| carrion_swoop | hraesvelgr_v1 | 1200 | 1951 | 1.63 | 5.03 cards discarded — `CARDS_DISCARDED` has NO branch in `calculatePowerscale` (L687-726), so it prices at the printed 11 | 201.5 HP (192.7 applied) | 16.57% | 14% | 1.1 (3.0) | 2.20 | 0.37 | **6.00** |
| starfall | valkyrie_v2 | 1200 | 2024 | 1.69 | 3.00 triggered draws (constant 1.25, L591) | 148.4 HP (141.2) | 12.27% | 3% | 2.3 (3.0) | 1.63 | 0.77 | **2.12** |
| serpents_coil | jormungandr_v1 | 1200 | 1951 | 1.63 | 4.06 cards played incl. itself (constant 2.5, L513) | 115.5 HP (107.8) | 9.54% | 4% | 2.5 (3.0) | 1.27 | 0.83 | 1.52 |
| fire_punch_v2 | fenrir_v2 (swapped for water_slap) | 580 | 330 | 0.57 | - | 88.5 HP (80.0) | 7.54% | 0% | 3.0 (3.0) | 1.00 | 1.00 | 1.00 |
| stampede | sleipnir_v1 / v2 | not measured (lane cut off) | | | | | | | 2.8 (3.0) | | | |
| momentum_crash | sleipnir_v1 | not measured (lane cut off) | | | | | | | 2.8 (3.0) | | | |
| baseline_strike | control_v1 | not measured (lane cut off) | | | | | | | 3.0 (3.0) | | | |

carrion_swoop is the largest single miss in either table: a 1e card that hits for 2.2 fire_punches (16.6% of a target's pool a cast, 1.6 casts a game) and is scored at 1.1 because the scorer has no `CARDS_DISCARDED` branch — it reads the printed 11 with no scaling and no `manualReview` flag (the L724-726 flag covers only BURN_STACKS / SELF_ANY_STATUS). starfall's triggered-draw count on the deck that ships it is 3.0, not the roster-mean 1.25 (L583-591 says so itself: "a deck with a real engine [is charged] less"). serpents_coil reads 4.06 cards played on jormungandr_v1 against the 2.5 constant.

## Questions for Henry

1. **REBIRTH_CYCLE**'s attack half lands at 0.128 HP per printed power on her frame (no STAB, random target) against 0.189 for a printed 30-power attack — is the OS attack meant to be priced at the card rate, or is a discount for "no STAB, no stack riders, random target" the intended reading of ticket 61's 0.19?
2. **TOXIN_FANG** adds +10 HP per Poison stack AFTER the divisor (`HookFactory.ts` L63): at the measured 9.4 stacks it is +94 HP on a 32 HP hit, x3.93. Printed in HP it does not move with the pace dial or the frame the way power does — should the bonus be re-denominated in power (the ticket-26 law the file quotes for statuses), or is a flat post-divisor HP bonus the design?
3. **KINETIC_RAM** (+2.5 HP per Sharp, per hit) is the same shape and was not measured this pass; the same question applies.
4. **skoll_v2** doubles her attacks on average (10 Strengthened stacks read, +51% of a pool a game) with the cap removed in ticket 103 — is x2.0 the intended steady state, and does `powerscale` need a firmware term for it (the L171-172 note says it cannot see this)?
5. **hel_v2 lifeblood** ships at `multiplier: 1.0` and never fires; the ticket's "+50% healing" does not exist in the data. Was it deliberately zeroed, or lost in a data edit?
6. **NOURISH_ROUTINE** no longer exists (audhumbla_v2 is PRIMORDIAL_MILK, 3 Regen per heal card = 30.6 Regen a game); the registry comment at `mingmingRegistry.ts` L804 still describes the NOURISH CANNON. Which is the design of record?
7. **GALE_FORCE** ships at 8 power (`hooks.json` L738), the ticket says 10 — which number is current?
8. **carrion_swoop** has no scorer branch at all and delivers 2.2x a fire_punch per cast on hraesvelgr_v1 — add a `CARDS_DISCARDED` constant (measured 5.0 on the owning deck, but that deck IS the discard engine) or flag it for manual review like BURN_STACKS?
9. **huldra_v1 ALLURE_PROXY** puts ~18 free Weakened a game on the enemy (20 procs); hexbloom reads 10.2 of them at cast (3c). Is an OS that feeds a 2e card's scaler at 2x the census constant an OS-pricing question or a card-pricing one?
10. The three unmeasured decks the ticket named (ratatoskr_v1 GOSSIP, gullinbursti_v2 KINETIC_RAM, kraken_v2 TIDAL_CRUSH) plus UPDRAFT / GENESIS / TREACHERY / hoofbeat / stampede / momentum_crash / baseline_strike need one more lane (`results/t149_consume/lane_a.sh` tail, ~1 h on a quiet box) — worth running before ticket 63 closes?

## Caveats

- 1v1 only. Several OS hooks are `source: ALLY` and in 1v1 SELF is the only ally (fenrir_v1's two hooks both fire on her own attacks; huldra_v1 mirrors her own self-buffs); their 3v3 rates are a different measurement (sibling 3b covers daemons, not firmware).
- "Delivered" for a `do` hook is the state diff inside the handler; a hook whose effect is a counter or a token (jorm_v1_count, echo_chamber, sleipnir_v2, gullin_v1_prepare) shows no delta and is listed as not measured by this instrument, not as 0 value.
- Modifier deltas are pre-shield, pre-floor HP (the number the hook returns); enemy-HP-based columns are post-shield.
- Frame = owner maxHp for every row, including damage on a differently-sized enemy (frames differ by up to ~15% across the roster); the 0.128 / 0.209 rates would move by that much on the target's frame.
- Grants' HP-eq uses the scorer's tables; it is a price, not a measurement of HP moved. Regen at 12 power a stack is the loudest example (audhumbla_v2 reads 122% of a pool a game in Regen "price").
- fire_punch_v2's benchmark rides fenrir_v2's frame, Fire STAB and CINDER_WALL Sharp (not on her own attacks — Sharp is defensive); baseline_strike on the control frame was queued as the no-STAB, no-firmware control and did not run.

## Addendum 2026-09-09 — lane E (the nine owners the first pass did not reach; 20 games per opponent) and the 3v3 consume cells

Folded into `research/firmware-power-census.md` (tables 1–3, companion table, Q3/Q10) and `research/scorer-pricing.md` §3–§4. Raw tables: `table_raw2.md` (full census incl. new decks), `scaler_table.md`.
