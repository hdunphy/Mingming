# Playtest Round 5 - The 3v3 Width and Inversion Round

Six scenarios focusing on 3v3 team combat dynamics, about 60–80 minutes total. 
Every scenario here is built programmatically from the current registry and stamped with your active registry hash (`1:d5a18ed7`).

---

## Setup, once

1. `npm run dev`, open the app.
2. **Ctrl+Shift+D** toggles the debug toolkit. Pick the **Scenario Launcher** panel.
3. **Load** -> choose a file from `src/debug/scenarios/playtest/round-5/`.
4. Check the destination-slot warning above Launch, then **Launch**.
5. Play it out.
6. **Before the killing blow lands - while the battle is still on screen - press Ctrl+Shift+E.**
   Move the exported files into `playtest-results/round-5/` and let me know.

**Note per game (30 seconds, right after):**
- **comp** played
- **fun** (1-5)
- **the ONE decision** that mattered most
- **the moment you felt railroaded** (if any)
- **any preview number that didn't match what happened** (mismatches are bug reports)

---

## S1 - The Earth Bastion (Stab-Earth vs Panel-Zoo)

| | you | opponent |
|---|---|---|
| **S1** | `stab-earth` (`fafnir_v2` + `gullinbursti_v1` + `ratatoskr_v1`) | `panel-zoo` (`jormungandr_v1` + `sleipnir_v1` + `hraesvelgr_v1`) |

Can Earth's high defense, shield stacking (BarkShield), and status control withstand the sheer card velocity of the Zoo role? 
The simulator says Earth achieves a high **79.2%** win rate against the panel, making it the non-zoo king. Let's see if a human player feels the same.
- How hard did it feel to stay alive in the early turns?
- Did Earth's buffs feel satisfying to stack, or did you feel starved for options compared to Zoo's speed?

---

## S2 - Zoo vs Control Rematch (Panel-Control vs Panel-Zoo)

| | you | opponent |
|---|---|---|
| **S2** | `panel-control` (`kraken_v1` + `huldra_v1` + `draugr_v2`) | `panel-zoo` (`jormungandr_v1` + `sleipnir_v1` + `hraesvelgr_v1`) |

Zoo is control's designated prey, but at 3v3 width the web inverts: the simulator shows Zoo winning **100%** of these battles because control's debuffs are diluted while zoo's velocity scales with party size. 
Can a human pilot prove the simulator wrong and shut down the zoo?
- Did you feel like you had any agency to lock them down, or was the debuff dilution too severe?
- If the matchup felt hopeless, did you wish for the unbuilt `riptide_daemon` (punishes drawing 3+ cards in a turn)?

---

## S3 - Stall vs Anti-Heal (Anti-Heal vs Triple-Stall)

| | you | opponent |
|---|---|---|
| **S3** | `tag-antiheal-vs-stall` (`nidhoggr_v2` + `jormungandr_v2` + `huldra_v1`) | `triple-sustain-STALL` (`audhumbla_v1` + `valkyrie_v1` + `gullinbursti_v1`) |

The stall comp consists of three healers/shielders. The designed anti-heal answer (BLOOD_SCENT / Dark STAB) underperformed in simulation (**25.0%** win rate). 
Can you, as the anti-heal pilot, find the execution to pierce their heals and shut them down?
- Does anti-heal feel structurally weak, or did the AI just play the matchup poorly?
- Did the game drag out, or were you able to pressure a single target effectively?

---

## S4 - The Solar Jackpot (Solar-Jackpot vs Panel-Control)

| | you | opponent |
|---|---|---|
| **S4** | `tag-solar-jackpot` (`skoll_v2` + `fenrir_v2` + `gullinbursti_v1`) + `core_overclock_daemon` | `panel-control` (`kraken_v1` + `huldra_v1` + `draugr_v2`) |

Stacking Strengthened under SOLAR_OVERDRIVE's uncapped +15%/stack multiplier alongside `core_overclock_daemon`. The sim says it's only **45.8%** (mid-table), but how does it feel in human hands?
- Does pulling off the big setup turn feel satisfying and fun, or is it too hard/clunky to set up in a real match?
- Did you hit a massive damage turnout? (Please note the highest single hit/turn damage you managed).

---

## S5 - Fire Storm Clock (Stab-Fire vs Panel-Ramp)

| | you | opponent |
|---|---|---|
| **S5** | `stab-fire` (`fenrir_v1` + `skoll_v2` + `hel_v1`) | `panel-ramp` (`audhumbla_v1` + `ymir_v1` + `fafnir_v1`) |

Fire STAB team focusing on stacking permanent Burn. Can the Burn clock tick down the high HP, heals, and shields of the Ramp panel before they stabilize?
- Does permanent Burn feel like a real, scary countdown timer at 3v3 width?
- Did you play to detonate the Burn, or did you hold at 3 stacks to keep the passive damage going?

---

## S6 - Water-Poison Tide (Stab-Water vs Panel-Mixed-A)

| | you | opponent |
|---|---|---|
| **S6** | `stab-water` (`kraken_v2` + `jormungandr_v2` + `ymir_v2`) | `panel-mixed-a` (`valkyrie_v1` + `ratatoskr_v2` + `skoll_v1`) |

Water STAB with an Ice splash - the Poison clock plus ramp. Does Poison's damage share feel weak/underpowered at 3v3 width, or does it serve as a steady inevitability clock?
- The simulator showed Poison's share of total damage dropped significantly at 3v3 because damage output from other sources scaled faster than the DoT tick. Did Poison feel underwhelming or did it still pull its weight?

---

## What tonight decides

1. **Zoo Inversion & Riptide Priority:** If control continues to lose 100% to Zoo in S2, the `riptide_daemon` zoo-killer becomes a top priority design task.
2. **Earth STAB Strength:** S1 checks if Earth's defensive engine is genuinely strong or if it needs tuning adjustments.
3. **Anti-Heal Efficiency:** S3 tells us if anti-heal needs a buff to make it a viable counter to stall.
4. **Jackpot vs Core Overclock:** S4 reviews the fun factor and viability of the uncapped Strengthened ramp.
5. **Burn & Poison Piles:** S5 and S6 calibrate the feel of damage-over-time status effects at team scale.
