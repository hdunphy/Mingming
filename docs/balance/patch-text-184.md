# Ticket 184d: what each patch does on each launch firmware

**Status:** RULED by Henry 2026-10-01 and SHIPPED. The sentences live in `src/engine/data/patchText.ts`, which is the source of truth; this file records how they were worked out and what Henry ruled. Every screen that shows a patch reads them: the reward offer, the patch bench, the event pick and the OS tooltip.

**Why this exists.** Henry, 2026-10-01: *"the patches are lazily done, each patch should probably have a defined effect per OS. For now we hand write them per OS. They can be a modular thing in the backend, but its mostly the description that is too unclear."* Each patch had one generic sentence, for example AMPLIFIER's *"Your firmware's number goes up: one more stack, or half again as much."* That sentence couldn't say what changed on *this* monster. Writing a sentence per firmware also exposed three broken patches on Jörmungandr v1.

**How each cell was worked out.** Each patch's transform was applied to the firmware's hook data the way the engine applies it (`scratch/t184_patch_matrix.ts`). The suspicious cells were also played through the real reducer (`scratch/t184_ouroboros_patches.ts`, `scratch/t184_fenrir_relay.ts`). Every ruled override is played through the reducer in `src/engine/data/patchOverrides.test.ts`.

## Henry's rulings (2026-10-01)

1. **No-op patches are hidden** (*"Hide them I think"*).
2. **OUROBOROS_LOOP (Jörmungandr v1)** — *"amplifier -> draw 2 cards, repeater -> draw cards on the 3rd and 5th water cards, splitter -> any element not just water"*.
   - The generic AMPLIFIER and SPLITTER had switched the firmware off: the counter stepped by 2 and never equalled 5.
   - The generic REPEATER had made the draw unlimited.
   - All three are now hand-written effects (`patchOverrides.ts`).
3. **Fenrir v1 RELAY** — *"should be ignored"*. It's never offered.
4. **SPLITTER** — *"doesn't double up on Fenrir_V1, he stays the same allies just gain the stacks too. same for Fenrir_v2 splitter and skoll_v1 splitter."* SPLITTER's copy now goes to the other allies only (the new `OTHER_ALLIES` hook target), so the host keeps exactly what it had.
5. **Ratatoskr v1 AMPLIFIER** — *"go to 12 power"*. The heal goes from 10 power (2.5% of max HP) to 12 (3%).
6. The four things with no counter pip (Valkyrie v1, Frayed Signal, Static Haze, Root Rot's guard) are fine as they are.

## What is offered, and what it says

40 of the 72 launch cells are hidden: 39 patches that do nothing on that firmware, plus Fenrir v1's RELAY. OVERCLOCK is never hidden, because it changes how a card counts the stacks the monster holds, not any firmware hook. Every OVERCLOCK line reads "Every stack {name} holds counts as one more when a card cashes it (3 stacks scale as 4)."

| Firmware | Patch | Sentence |
|---|---|---|
| Fenrir v1 UNBOUND_KERNEL | AMPLIFIER | Fenrir gains 4 Strengthened per attack instead of 2, and 2 instead of 1 when an ally attacks. |
| | SPLITTER | Whenever the kernel gives Fenrir Strengthened, the rest of your side gains the same. |
| | FAILSAFE | Fenrir's attacks no longer cost him 2% of his max HP. |
| Fenrir v2 CINDER_WALL_OS | AMPLIFIER | Fenrir gains 2 Sharp instead of 1 whenever an ally applies Burn. |
| | SPLITTER | Whenever an ally applies Burn, the rest of your side gains 1 Sharp too. |
| Sköll v1 TREACHERY_KERNEL | AMPLIFIER | Sköll gains 2 Strengthened instead of 1 whenever an ally takes damage from an enemy attack. |
| | SPLITTER | Whenever an ally is hit by an enemy attack, the rest of your side gains 1 Strengthened too. |
| Sköll v2 EMBER_FUSE | AMPLIFIER | Each of Sköll's hits on a Burning target applies 2 more Burn instead of 1. |
| | RELAY | Every ally's hits on a Burning target apply 1 more Burn, not only Sköll's. |
| Kraken v1 ABYSSAL_INK_SYS | AMPLIFIER | Each bonus draw applies 3 Dazed to a random enemy instead of 2. |
| Kraken v2 TIDAL_CRUSH_OS | AMPLIFIER | Kraken's Water cards that cost 2 or more deal 45% more damage instead of 30%. |
| | RELAY | Any ally's Water cards that cost 2 or more deal 30% more damage, not only Kraken's. |
| Jörmungandr v1 OUROBOROS_LOOP | AMPLIFIER | The 5th Water card each turn draws 2 cards instead of 1. |
| | REPEATER | The 3rd and the 5th Water card each turn both draw a card. |
| | SPLITTER | Any card counts, not just Water: the 5th card your side plays each turn draws a card. |
| Jörmungandr v2 TOXIN_FANG_OS | AMPLIFIER | Jörmungandr's attacks deal +6 power per Poison stack on the target instead of +4. |
| | RELAY | Every ally's attacks deal +4 power per Poison stack on the target, not only Jörmungandr's. |
| Ratatoskr v1 GOSSIP_NODE | AMPLIFIER | Each 0-cost card heals its caster 3% of max HP instead of 2.5%. |
| Ratatoskr v2 INSTIGATOR_OS | AMPLIFIER | Each 0-cost card an ally plays at an enemy applies 2 Dazed instead of 1. |
| Huldra v1 ALLURE_PROXY | AMPLIFIER | Each buff an ally gives an ally applies 2 Weakened to a random enemy instead of 1. |
| Huldra v2 BARK_SHIELD_OS | OVERCLOCK only | Hand-written firmware with no hook data, so no other patch can reach it. |

## Measured (OUROBOROS_LOOP, ten Water cards in one turn)

| Patch | Before 184e | After 184e |
|---|---|---|
| none | draws 1 on card 5 | draws 1 on card 5 |
| AMPLIFIER | never draws | draws 2 on card 5 |
| REPEATER | draws on 5, 10, 15 … | draws on 3 and 5, then stops |
| SPLITTER | never draws | draws on the 5th card of any element |

## Reproduce

```
npx vite-node scratch/t184_patch_matrix.ts        # every changed field, per cell (generic transforms)
npx vite-node scratch/t184_ouroboros_patches.ts   # OUROBOROS_LOOP per patch, through the reducer
npx vite-node scratch/t184_fenrir_relay.ts        # UNBOUND_KERNEL's RELAY / SPLITTER / AMPLIFIER / FAILSAFE
```
