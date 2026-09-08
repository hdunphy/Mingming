# Ticket 149 (3e) — band tolerance on the current pool

Method: every non-token card with a numeric `baseCost` scored by `calculatePowerscale`; deviation = score / `budgetBandFor(cost).over` - 1 (same definition as `scratch/bandspread.ts`). Band window = `under..over` of the card's cost band. n = 232 cards (7 skipped: tokens, X-cost, or no fixed band).

## Reading (ticket 149, 3e)

Script: `scratch/t149_tolerance.ts` (extends `scratch/bandspread.ts`; same deviation definition). Raw rows: `results/t149_tolerance/tolerance.json`. Static scorer only - no battles.

- **The pool's own noise is ~12-15%.** Median absolute deviation from the median is 13.3% (11.5% once the |dev|>100% pricing failures are trimmed); the median |deviation| from the ceiling is 15.4%. A +/-15% tolerance therefore sits right on the pool's typical distance from target - it is the number the spread justifies, not a looser or tighter one. The raw sd (70.8%) is useless as a tolerance because 18 cards with |dev| > 100% (bloodwrath +573%, umbral_feast +397%, wither_feast -266%, ...) own it; trimmed sd is 32.2%, and even that is dominated by the under-band tail (the pool skews under: mean -8.0%, median -3.3%).
- **What +/-15% admits.** 34 cards remain OVER by more than 15% (14.7% of the pool). 24 cards are outside the band window (`under..over`) but within +/-15% - every one of those is between +3% and +13% over the ceiling, and they would stop being reported as violations. 84 cards are UNDER by more than 15% (36.2%); 106 (45.7%) sit inside the window.
- **Threshold ladder (over the ceiling):** >0% 58 cards, >+5% 48, >+15% 34, >+25% 27, >+50% 14. The step from +5% to +15% removes 14 cards; from +15% to +25% only 7 more - the over-band set is bimodal (a cluster at +3..+13% and a long tail above +25%), which is another reason 15% is the natural cut.
- **The five ticket-115 Ice Side cards and the two Ice 2e Side cards are 7 of the top 14 over-band cards** (frost_bite +143%, numbing_gale +120%, killing_frost +120%, rimefrost +90%, ice_spear +87%, numbing_storm +69%, rime_spear +58%) - all of that is the x2.2 Side multiplier (see `results/t149_width/FINDINGS.md`). Under a Single scope every one of the five is in band or within tolerance (+10%, 0%, 0%, -10%, -13%).
- **Drawback cards** score NEGATIVE: desperate_strike -0.4 and dark_pact -0.4 (the 3% self-HP hit outprices 1 Strengthened at the 0e band), wither_feast -10.8 (consuming the Poison pile is priced as a loss larger than five triggers). They are "under band by more than 15%" only nominally - a negative score is a pricing failure for cards whose drawback is the point, not an under-costed card. Same family: scrubber -1.6, vent -1.6, unbound_fang -1.3, discharge -1.3, all_in -0.9, reckless_charge -0.4. Any tolerance rule should exclude score <= 0 from the under-band list and route it to manual review.
- Also worth flagging as "not noise": 8 cards score exactly 0.0 (core_overclock_daemon, scavenge_data, reprogram, einherjar_standard, forage, hoarders_cache, grave_rest, echo_of_valhalla) - the scorer has no price for what they do.

## Distribution (score as % of band ceiling)

| stat | value |
|---|---|
| n | 232 |
| mean | -8.0% |
| median | -3.3% |
| sd | 70.8% |
| median absolute deviation (from median) | 13.3% |
| median |deviation| from ceiling | 15.4% |
| in band window (under..over) | 106 (45.7%) |
| TRIMMED (|dev| <= 100%, n=214): mean / median / sd / MAD | -11.3% / -3.3% / 32.2% / 11.5% |

| threshold | cards over | % of pool |
|---|---|---|
| > +0% | 58 | 25.0% |
| > +5% | 48 | 20.7% |
| > +15% | 34 | 14.7% |
| > +25% | 27 | 11.6% |
| > +50% | 14 | 6.0% |
| < -5% | 113 | 48.7% |
| < -15% | 84 | 36.2% |
| < -25% | 59 | 25.4% |
| < -50% | 29 | 12.5% |

## OUT OF BAND — over the ceiling by more than +15% (34)

| card | cost | element | scope | score | ceiling | vs ceiling |
|---|---|---|---|---|---|---|
| bloodwrath | 1e | Dark | Single | 20.2 | 3.0 | +573.3% |
| umbral_feast | 1e | Dark | Self | 14.9 | 3.0 | +396.7% |
| sun_devourer | 2e | Fire | Single | 20.4 | 6.5 | +213.8% |
| contagion | 2e | Water | Single | 20.4 | 6.5 | +213.8% |
| frost_bite | 1e | Ice | Side | 7.3 | 3.0 | +143.3% |
| corrosive_leak | 0e | Water | Self | 2.3 | 1.0 | +130.0% |
| bloodletting | 0e | Dark | Single | 2.2 | 1.0 | +120.0% |
| numbing_gale | 1e | Ice | Side | 6.6 | 3.0 | +120.0% |
| killing_frost | 1e | Ice | Side | 6.6 | 3.0 | +120.0% |
| rimefrost | 0e | Ice | Side | 1.9 | 1.0 | +90.0% |
| ice_spear | 1e | Ice | Side | 5.6 | 3.0 | +86.7% |
| ragnarok_edge | 1e | Fire | Single | 5.5 | 3.0 | +83.3% |
| numbing_storm | 2e | Ice | Side | 11.0 | 6.5 | +69.2% |
| rime_spear | 2e | Ice | Side | 10.3 | 6.5 | +58.5% |
| sleep_powder | 1e | Nature | Single | 4.5 | 3.0 | +50.0% |
| lumen_surge | 1e | Light | Self | 4.5 | 3.0 | +50.0% |
| falling_star | 1e | Light | Single | 4.5 | 3.0 | +50.0% |
| capacitor | 2e | None | Self | 9.5 | 6.5 | +46.2% |
| slipstream | 0e | Air | Self | 1.4 | 1.0 | +40.0% |
| glimmer | 0e | Light | Self | 1.4 | 1.0 | +40.0% |
| undertow | 0e | Water | Self | 1.4 | 1.0 | +40.0% |
| ink_stream | 1e | Water | Single | 4.1 | 3.0 | +36.7% |
| crimson_draw | 1e | Fire | Single | 4.1 | 3.0 | +36.7% |
| thorn_tithe | 1e | Nature | Single | 4.1 | 3.0 | +36.7% |
| molten_core | 1e | Fire | Single | 3.9 | 3.0 | +30.0% |
| stunning_strike | 2e | Nature | Single | 8.4 | 6.5 | +29.2% |
| lance | 1e | Air | Single | 3.8 | 3.0 | +26.7% |
| water_slap | 0e | None | Single | 1.2 | 1.0 | +20.0% |
| overgrowth | 1e | Nature | Single | 3.6 | 3.0 | +20.0% |
| tidal_battery | 2e | Water | Side | 7.7 | 6.5 | +18.5% |
| fertile_ground_daemon | 2e | Nature | Self | 7.6 | 6.5 | +16.9% |
| short_circuit | 2e | None | Self | 7.6 | 6.5 | +16.9% |
| sun_eaters_plunge | 2e | Air | Single | 7.5 | 6.5 | +15.4% |
| entangle | 3e | Nature | Side | 12.1 | 10.5 | +15.2% |

## WITHIN TOLERANCE — outside the band window but within +/-15% (24)

| card | cost | element | scope | score | ceiling | vs ceiling |
|---|---|---|---|---|---|---|
| blood_rite | 1e | Fire | Single | 3.4 | 3.0 | +13.3% |
| blind_spot | 0e | Water | Single | 1.1 | 1.0 | +10.0% |
| pollen_cloud | 0e | Nature | Single | 1.1 | 1.0 | +10.0% |
| frost_ward | 0e | Ice | Self | 1.1 | 1.0 | +10.0% |
| grit | 0e | Earth | Single | 1.1 | 1.0 | +10.0% |
| purify | 1e | Light | Self | 3.3 | 3.0 | +10.0% |
| thornguard | 1e | Nature | Single | 3.3 | 3.0 | +10.0% |
| glacial_slam | 2e | Ice | Single | 7.0 | 6.5 | +7.7% |
| glass_cannon | 1e | Fire | Single | 3.2 | 3.0 | +6.7% |
| feedback_loop_daemon | 1e | Water | Self | 3.2 | 3.0 | +6.7% |
| whirlpool_v2 | 1e | Water | Single | 3.2 | 3.0 | +6.7% |
| thistle_barrage | 1e | Nature | Single | 3.2 | 3.0 | +6.7% |
| photosynthesis_v2 | 1e | Nature | Self | 3.2 | 3.0 | +6.7% |
| dread_tidings | 1e | Ice | Self | 3.2 | 3.0 | +6.7% |
| dawn_of_creation | 3e | Light | Single | 10.9 | 10.5 | +3.8% |
| brute_force | 1e | Fire | Single | 3.1 | 3.0 | +3.3% |
| shield_shards | 1e | Earth | Self | 3.1 | 3.0 | +3.3% |
| fire_poke | 1e | Fire | Single | 3.1 | 3.0 | +3.3% |
| pressure_point | 1e | Water | Single | 3.1 | 3.0 | +3.3% |
| iron_bark | 1e | Nature | Self | 3.1 | 3.0 | +3.3% |
| battle_rhythm | 1e | Fire | Single | 3.1 | 3.0 | +3.3% |
| bloodlust | 1e | Fire | Single | 3.1 | 3.0 | +3.3% |
| thaw | 1e | Ice | Single | 3.1 | 3.0 | +3.3% |
| benediction | 1e | Light | Single | 3.1 | 3.0 | +3.3% |

## UNDER BAND — below the ceiling by more than 15% (84)

| card | cost | element | scope | score | ceiling | vs ceiling |
|---|---|---|---|---|---|---|
| scorch | 2e | Fire | Single | 5.5 | 6.5 | -15.4% |
| serpents_coil | 1e | Water | Single | 2.5 | 3.0 | -16.7% |
| natures_touch | 1e | Nature | Side | 2.5 | 3.0 | -16.7% |
| nettle_sting | 1e | Nature | Single | 2.5 | 3.0 | -16.7% |
| heartwood | 1e | Nature | Single | 2.5 | 3.0 | -16.7% |
| zealots_edge | 1e | None | Single | 2.5 | 3.0 | -16.7% |
| venom_fang | 1e | Water | Single | 2.5 | 3.0 | -16.7% |
| supernova_v2 | 2e | Light | Single | 5.4 | 6.5 | -16.9% |
| morning_dew | 2e | Light | Self | 5.4 | 6.5 | -16.9% |
| pebble_flurry | 0e | Earth | Single | 0.8 | 1.0 | -20.0% |
| uplift | 2e | Light | Side | 5.2 | 6.5 | -20.0% |
| disorienting_gust | 0e | Air | Single | 0.8 | 1.0 | -20.0% |
| cinder_slash | 1e | Fire | Single | 2.4 | 3.0 | -20.0% |
| cinder_gust | 1e | Air | Single | 2.4 | 3.0 | -20.0% |
| sky_dance | 1e | Air | Single | 2.4 | 3.0 | -20.0% |
| slag_strike | 1e | Fire | Single | 2.4 | 3.0 | -20.0% |
| tempest | 1e | Air | Self | 2.3 | 3.0 | -23.3% |
| tailwind | 1e | Air | Self | 2.3 | 3.0 | -23.3% |
| nightfall_edge | 1e | Dark | Single | 2.3 | 3.0 | -23.3% |
| squirrel_away | 1e | None | Self | 2.3 | 3.0 | -23.3% |
| morning_light | 1e | Light | Self | 2.3 | 3.0 | -23.3% |
| starfall | 1e | Light | Single | 2.3 | 3.0 | -23.3% |
| tide_reading | 1e | Water | Self | 2.3 | 3.0 | -23.3% |
| echo_chamber_v2 | 2e | Nature | Self | 4.9 | 6.5 | -24.6% |
| veinburst | 2e | Earth | Single | 4.9 | 6.5 | -24.6% |
| gale_slash | 1e | Air | Single | 2.2 | 3.0 | -26.7% |
| ash_communion | 2e | Fire | Self | 4.6 | 6.5 | -29.2% |
| chorus | 1e | Nature | Side | 2.1 | 3.0 | -30.0% |
| war_pact | 0e | Fire | Self | 0.7 | 1.0 | -30.0% |
| ember_mend | 0e | Fire | Self | 0.7 | 1.0 | -30.0% |
| corroded_edge | 1e | Earth | Single | 2.0 | 3.0 | -33.3% |
| spreading_rot | 1e | Water | Side | 2.0 | 3.0 | -33.3% |
| glacier_thaw | 2e | Ice | Single | 4.2 | 6.5 | -35.4% |
| drink_deep | 2e | Light | Single | 4.2 | 6.5 | -35.4% |
| overheat | 3e | Fire | Single | 6.7 | 10.5 | -36.2% |
| equilibrium | 1e | Nature | Self | 1.9 | 3.0 | -36.7% |
| hallow | 1e | Light | Self | 1.9 | 3.0 | -36.7% |
| inferno | 2e | Fire | Side | 4.0 | 6.5 | -38.5% |
| cyclone | 2e | Air | Side | 4.0 | 6.5 | -38.5% |
| tremor | 2e | Earth | Side | 4.0 | 6.5 | -38.5% |
| rimebreaker | 2e | Ice | Single | 4.0 | 6.5 | -38.5% |
| corrosive_bolt | 1e | Water | Single | 1.8 | 3.0 | -40.0% |
| aegis | 1e | Light | Self | 1.8 | 3.0 | -40.0% |
| seed_bomb_v2 | 2e | Nature | Single | 3.8 | 6.5 | -41.5% |
| hoofbeat_daemon | 2e | Air | Self | 3.8 | 6.5 | -41.5% |
| riptide | 2e | None | Self | 3.8 | 6.5 | -41.5% |
| ash_reclamation | 1e | Fire | Single | 1.7 | 3.0 | -43.3% |
| hexbloom | 2e | Nature | Single | 3.5 | 6.5 | -46.2% |
| harden_daemon | 1e | None | Self | 1.6 | 3.0 | -46.7% |
| cinder_lance | 2e | Fire | Single | 3.4 | 6.5 | -47.7% |
| spike_launch | 1e | Earth | Single | 1.5 | 3.0 | -50.0% |
| scald | 0e | Water | Single | 0.5 | 1.0 | -50.0% |
| feather_cache | 0e | Air | Single | 0.5 | 1.0 | -50.0% |
| war_molt | 1e | Air | Single | 1.5 | 3.0 | -50.0% |
| sky_burial | 1e | Air | Single | 1.5 | 3.0 | -50.0% |
| battery_pack | 4e | Water | Self | 4.9 | 10.5 | -53.3% |
| crushing_depths | 2e | Water | Single | 3.0 | 6.5 | -53.8% |
| slander | 2e | Nature | Single | 3.0 | 6.5 | -53.8% |
| scry | 2e | Light | Self | 2.9 | 6.5 | -55.4% |
| tarnish | 0e | Earth | Single | 0.4 | 1.0 | -60.0% |
| firestorm_talon | 2e | Air | Single | 2.5 | 6.5 | -61.5% |
| carrion_swoop | 1e | Air | Single | 1.1 | 3.0 | -63.3% |
| poison_injection | 0e | Water | Single | 0.3 | 1.0 | -70.0% |
| acid_splash | 1e | Water | Single | 0.8 | 3.0 | -73.3% |
| cinder_armor_daemon | 2e | Fire | Self | 1.6 | 6.5 | -75.4% |
| reactive_plating | 2e | None | Self | 1.6 | 6.5 | -75.4% |
| toxic_surge | 1e | Water | Single | 0.3 | 3.0 | -90.0% |
| core_overclock_daemon | 2e | Fire | Self | 0.0 | 6.5 | -100.0% |
| scavenge_data | 1e | Water | Self | 0.0 | 3.0 | -100.0% |
| reprogram | 2e | Water | Single | 0.0 | 6.5 | -100.0% |
| einherjar_standard | 2e | Light | Self | 0.0 | 6.5 | -100.0% |
| forage | 0e | None | Self | 0.0 | 1.0 | -100.0% |
| hoarders_cache | 2e | Nature | Self | 0.0 | 6.5 | -100.0% |
| grave_rest | 0e | Ice | Self | 0.0 | 1.0 | -100.0% |
| echo_of_valhalla | 1e | Light | Single | 0.0 | 3.0 | -100.0% |
| scrubber | 2e | None | Self | -1.6 | 6.5 | -124.6% |
| all_in | 1e | Fire | Self | -0.9 | 3.0 | -130.0% |
| reckless_charge | 0e | Fire | Self | -0.4 | 1.0 | -140.0% |
| desperate_strike (drawback) | 0e | Fire | Single | -0.4 | 1.0 | -140.0% |
| dark_pact (drawback) | 0e | Dark | Self | -0.4 | 1.0 | -140.0% |
| unbound_fang | 1e | Fire | Single | -1.3 | 3.0 | -143.3% |
| discharge | 1e | None | Single | -1.3 | 3.0 | -143.3% |
| vent | 0e | None | Self | -1.6 | 1.0 | -260.0% |
| wither_feast (drawback) | 2e | Dark | Single | -10.8 | 6.5 | -266.2% |

## Drawback cards

| card | cost | element | scope | score | ceiling | vs ceiling |
|---|---|---|---|---|---|---|
| desperate_strike (drawback) | 0e | Fire | Single | -0.4 | 1.0 | -140.0% | OUT (under)
| dark_pact (drawback) | 0e | Dark | Self | -0.4 | 1.0 | -140.0% | OUT (under)
| wither_feast (drawback) | 2e | Dark | Single | -10.8 | 6.5 | -266.2% | OUT (under)

## Skipped (7)

thermal_lance (cost X), hoof_strike (token), feedback_token (token), sky_burial_risen (token), sky_burial_ascended (token), deep_vein (cost X), genesis_surge (cost X)
