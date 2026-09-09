| OS / hook | payoff text | printed | procs/game (offers/game) | delivered / proc | delivered / game | implied rate (HP per printed power, 75-frame) | flag |
|---|---|---|---|---|---|---|---|
| audhumbla_v1 GENESIS_FIRMWARE `aud_v1_genesis` | overheal: +1 max Energy (once/turn) | - | 1.87 (26.43) | maxEnergy 1.00 | maxEnergy 1.87; = 74.7 power-eq = 24.9% maxHp-eq | - |  |
| audhumbla_v1 aud_v1_genesis_reset `aud_v1_genesis_reset` | (not in PRINTED table) | - | 0.00 (15.11) | (no measurable delta) | - | - |  |
| audhumbla_v2 PRIMORDIAL_MILK `aud_v2_milk` | heal card: +3 Regen | - | 10.20 (16.36) | Regen +3.00 | Regen +30.60; = 367.2 power-eq = 122.4% maxHp-eq | - |  |
| draugr_v1 PERMAFROST_WAKE `draugr_v1_wake` | wake from Asleep: +1 Energized, draw 1 | - | 0.91 (2.05) | Energized +1.00; cards 1.00 | Energized +0.91; cards 0.91; = 45.5 power-eq = 15.2% maxHp-eq | - |  |
| draugr_v2 GRAVE_CHILL_OS `draugr_v2_chill` | enemies with 2+ debuffs deal x0.8 to Draugr | - | 8.70 (25.12) | mod -15.2 HP on 74.2 (-1.23% frame; x0.79) | mod -132.7 HP | - |  |
| fafnir_v1 HOARD_PROTOCOL `fafnir_v1_hoard` | turn end: unspent Energy -> Energized | - | 0.49 (7.89) | Energized +1.91 | Energized +0.94; = 33.1 power-eq = 11.0% maxHp-eq | - |  |
| fafnir_v1 HOARD_PROTOCOL `fafnir_v1_recoil` | turn start: 1% maxHp per hoarded point (min 1) | - | 0.40 (7.83) | self -23.4 HP = 1.88% maxHp | self -9.4 HP | 1.88% maxHp per proc |  |
| fafnir_v2 CORRUPTED_GOLD_OS `fafnir_v2_corrupted` | turn start: +2 Strengthened per debuff type, each debuff -1 | - | 3.08 (6.84) | Strengthened +3.66; Dazed -0.91; Poison -0.78; Weakened -0.18; Burn -0.09 | Strengthened +11.28; Dazed -2.82; Poison -2.41; Weakened -0.56; Burn -0.28; = 30.6 power-eq = 10.2% maxHp-eq | - |  |
| fenrir_v1 UNBOUND_KERNEL `fenrir_v1_ally_hook` | ally attack: +1 Strengthened (in 1v1 SELF counts as ally: fires on own attacks) | - | 6.09 (19.15) | Strengthened +0.97; Weakened -0.03 | Strengthened +5.93; Weakened -0.16; = 29.1 power-eq = 9.7% maxHp-eq | - |  |
| fenrir_v1 UNBOUND_KERNEL `fenrir_v1_berserk` | Fire attacks up to +50% scaled by missing HP | - | 6.79 (15.70) | mod +33.9 HP on 145.2 (3.00% frame; x1.23) | mod +230.3 HP | - |  |
| fenrir_v1 UNBOUND_KERNEL `fenrir_v1_hook` | attack: +1 Strengthened and -2% maxHp recoil | - | 6.09 (19.15) | self -22.0 HP = 1.95% maxHp; Strengthened +0.98; Weakened -0.02 | self -134.1 HP; Strengthened +6.00; Weakened -0.10; = 29.6 power-eq = 9.9% maxHp-eq | 1.95% maxHp per proc |  |
| gullinbursti_v1 UNSTOPPABLE_MASS `gullin_v1_prepare` | non-attack status card primes next attack +3 power per Sharp | - | 0.00 (42.84) | (no measurable delta) | - | - |  |
| gullinbursti_v2 KINETIC_RAM_OS `gullin_v2_blunt` | turn start: 1 Dazed on self | - | 5.53 (11.07) | Dazed +0.15; Sharp -0.85 | Dazed +0.85; Sharp -4.68; = -12.1 power-eq = -4.0% maxHp-eq | - |  |
| gullinbursti_v2 KINETIC_RAM_OS `gullin_v2_ram` | Earth attacks +2.5 HP (flat, post-divisor) per Sharp stack, per hit | - | 23.39 (40.45) | mod +32.6 HP on 21.3 (2.68% frame; x2.53) | mod +761.4 HP | - |  |
| hel_v1 TWILIGHT_CADENCE `hel_v1_cadence_dark` | Dark cast: DarkStance (+45% dmg dealt) | - | 6.02 (43.64) | DarkStance +1.00; LightStance -0.90 | DarkStance +6.02; LightStance -5.43; = 11.7 power-eq = 3.9% maxHp-eq | - |  |
| hel_v1 TWILIGHT_CADENCE `hel_v1_cadence_light` | Light cast: LightStance (-45% dmg taken) | - | 5.89 (43.64) | DarkStance -0.91; LightStance +1.00 | DarkStance -5.38; LightStance +5.89; = 10.3 power-eq = 3.4% maxHp-eq | - |  |
| hraesvelgr_v2 UPDRAFT_KERNEL `hraesvelgr_v2_updraft` | after 2 deck cycles: +1 max Energy (once) | - | 1.00 (33.22) | energy 1.00; maxEnergy 1.00 | energy 1.00; maxEnergy 1.00; = 80.0 power-eq = 26.7% maxHp-eq | - |  |
| huldra_v2 BARK_SHIELD_OS `huldra_v2_bark_end` | end of first turn: 50% BarkShield (allies smaller) | - | 1.00 (10.29) | BarkShield +50.00 | BarkShield +50.00; = 200.0 power-eq = 66.7% maxHp-eq | - |  |
| kraken_v1 ABYSSAL_INK_SYS `kraken_v1_hook` | ally effect-draw: 2 Dazed on random enemy | - | 6.58 (37.22) | enemy:Dazed +1.80; enemy:Sharp -0.20 | enemy:Dazed +11.84; enemy:Sharp -1.32; = 63.8 power-eq = 21.3% maxHp-eq | - |  |
| kraken_v2 TIDAL_CRUSH_OS `kraken_v2_hook` | Water cards costing 2+ deal x1.3 | - | 3.00 (11.75) | mod +66.4 HP on 222.8 (6.07% frame; x1.30) | mod +198.9 HP | - |  |
| nidhoggr_v1 ROOT_CORRUPTION `nidhoggr_v1_root` | enemy turn end: +1 Poison (cancels the decay) | - | 2.66 (6.54) | enemy:Poison +1.00 | enemy:Poison +2.66; = 8.0 power-eq = 2.7% maxHp-eq | - |  |
| ratatoskr_v1 GOSSIP_NODE `ratatoskr_v1_hook` | ally plays 0-cost: heal that ally 10 power | 10 | 53.76 (103.86) | heal 26.5 HP = 2.38% maxHp | heal 1425.5 HP | 0.179 |  |
| ratatoskr_v2 INSTIGATOR_OS `ratatoskr_v2_hook` | ally plays 0-cost at enemy: 1 Dazed on target | - | 12.55 (28.91) | enemy:Dazed +0.91; enemy:Sharp -0.09 | enemy:Dazed +11.43; enemy:Sharp -1.12; = 61.1 power-eq = 20.4% maxHp-eq | - |  |
| skoll_v1 TREACHERY_KERNEL `skoll_v1_hook` | ally hit by enemy attack: +1 Strengthened | - | 10.90 (33.84) | Strengthened +0.89; Weakened -0.11 | Strengthened +9.69; Weakened -1.21; = 44.2 power-eq = 14.7% maxHp-eq | - |  |
| skoll_v2 SOLAR_OVERDRIVE_OS `skoll_v2_solar_charge` | ally plays Fire attack: +1 Strengthened | - | 4.98 (17.43) | Strengthened +0.97; Weakened -0.03 | Strengthened +4.81; Weakened -0.17; = 23.4 power-eq = 7.8% maxHp-eq | - |  |
| skoll_v2 SOLAR_OVERDRIVE_OS `skoll_v2_solar_overdrive` | attacks +10% per Strengthened stack | - | 4.75 (11.81) | mod +131.2 HP on 131.0 (11.43% frame; x2.00) | mod +623.5 HP | - |  |
| sleipnir_v1 MOMENTUM_DRIVE `sleipnir_v1_hook` | play 0-cost: +1 Strengthened | - | 10.74 (30.87) | Strengthened +0.92; Weakened -0.08 | Strengthened +9.86; Weakened -0.88; = 46.2 power-eq = 15.4% maxHp-eq | - |  |
| sleipnir_v2 WAR_STEED_OS `sleipnir_v2_hook` | Air attack: generate hoof_strike token | - | 8.80 (27.54) | cards 1.00 | cards 8.80; = 132.0 power-eq = 44.0% maxHp-eq | - |  |
| valkyrie_v1 VALHALLA_UPLINK `valkyrie_v1_uplink` | turn end: replay a random discard for free | - | 7.07 (14.84) | dmg raw 66.0 HP (applied 62.3) = 5.43% frame; heal 30.4 HP = 2.50% maxHp; Strengthened +0.60; Sharp +0.35; Dazed -0.03; Weakened -0.06; enemy:BarkShield -0.19 | dmg raw 466.6 HP; heal 214.6 HP; Strengthened +4.27; Sharp +2.49; Dazed -0.24; Weakened -0.39; enemy:BarkShield -1.31; = 32.8 power-eq = 10.9% maxHp-eq | - |  |
| ymir_v1 GLACIER_HEART_SYS `ymir_v1_hook` | turn start: +4 BarkShield (%maxHp) | - | 7.90 (15.88) | BarkShield +4.00 | BarkShield +31.59; = 126.3 power-eq = 42.1% maxHp-eq | - |  |
| ymir_v2 GLACIAL_PACE_OS `ymir_v2_glacial` | Ice cards x1.25 | - | 6.74 (18.79) | mod +36.6 HP on 148.0 (2.67% frame; x1.25) | mod +246.8 HP | - |  |

n: games per deck are in the rows' owner files (40 per opponent x 30 opponents = 1200 at --iter 20; 600 at --iter 10). Frame = owner maxHp.
