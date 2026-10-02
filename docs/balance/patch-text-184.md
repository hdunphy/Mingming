# Ticket 184d: what each patch does on each launch firmware (draft for Henry)

**Status:** DRAFT, waiting for Henry's review. Nothing in this file is in the game yet. Once he rules on it, each sentence becomes that firmware's patch text on every screen that shows a patch: the reward offer, the patch bench, the event pick, the "who has a patch" line, and the OS tooltip.

**Why this exists.** Henry, 2026-10-01: *"the patches are lazily done, each patch should probably have a defined effect per OS. For now we hand write them per OS. They can be a modular thing in the backend, but its mostly the description that is too unclear."* Today every patch has one generic sentence, for example AMPLIFIER's *"Your firmware's number goes up: one more stack, or half again as much."* That sentence cannot tell the player what changes on *this* monster. Writing a sentence per firmware also showed that three combinations are broken (see "Broken" below).

**How each cell was worked out.** For every pair, the patch's transform was applied to the firmware's hook data, the same way the engine applies it (`scratch/t184_patch_matrix.ts` prints every changed field). Cells marked **measured** were also played through the real reducer (`scratch/t184_ouroboros_patches.ts`, `scratch/t184_fenrir_relay.ts`). The rest are read from the changed fields.

**Hidden.** Henry ruled on 2026-10-01 that a patch that does nothing on a body is not offered for it (*"Hide them I think"*). That shipped in 184d: **39 of the 72 cells are hidden.** OVERCLOCK is never hidden, because it changes how a card counts the stacks the monster holds, not any firmware hook.

## The summary

| Firmware | AMPLIFIER | REPEATER | RELAY | SPLITTER | OVERCLOCK | FAILSAFE |
|---|---|---|---|---|---|---|
| fenrir_v1 UNBOUND_KERNEL | ok | hidden | **check** | **check** | ok | ok |
| fenrir_v2 CINDER_WALL_OS | ok | hidden | hidden | **check** | ok | hidden |
| skoll_v1 TREACHERY_KERNEL | ok | hidden | hidden | **check** | ok | hidden |
| skoll_v2 EMBER_FUSE | ok | hidden | ok | hidden | ok | hidden |
| kraken_v1 ABYSSAL_INK_SYS | ok | hidden | hidden | hidden | ok | hidden |
| kraken_v2 TIDAL_CRUSH_OS | ok | hidden | ok | hidden | ok | hidden |
| jormungandr_v1 OUROBOROS_LOOP | **BROKEN** | **BROKEN** | hidden | **BROKEN** | ok | hidden |
| jormungandr_v2 TOXIN_FANG_OS | ok | hidden | ok | hidden | ok | hidden |
| ratatoskr_v1 GOSSIP_NODE | **check** | hidden | hidden | hidden | ok | hidden |
| ratatoskr_v2 INSTIGATOR_OS | ok | hidden | hidden | hidden | ok | hidden |
| huldra_v1 ALLURE_PROXY | ok | hidden | hidden | hidden | ok | hidden |
| huldra_v2 BARK_SHIELD_OS | hidden | hidden | hidden | hidden | ok | hidden |

- **ok:** it does what its sentence says.
- **check:** it works, but it does something Henry may not want. Each one says what.
- **BROKEN:** the patch switches the firmware off, or does something other than what any sentence could honestly promise.

## Broken: three patches on OUROBOROS_LOOP (jormungandr_v1)

**Measured.** Ten 0e Water cards (Undertow) in one turn, and which card makes the OS draw:

| Patch | Draws on Water card # | Unpatched: card 5 |
|---|---|---|
| none | 5 | |
| AMPLIFIER | **never** | It adds 1 to every number in the hook, including the counter's step. Water cards count 2, 4, 6, and the trigger checks for exactly 5. |
| SPLITTER | **never** | It copies every "self" action to "allies", including the counter. Each Water card counts twice: 2, 4, 6. |
| REPEATER | 5, 10, 15 … | It lifts the once-a-turn gate from 1 to 2, but the guard is written as "set to 1", not "add 1", so it never reaches 2. The patched OS draws on every 5th Water card, with no limit. |

**This is live in the game today.** The gate offers Jörmungandr v1 exactly SPLITTER and AMPLIFIER (`gatePatchChoices`), and the elite offer gives her SPLITTER (`bestPatchFor`). So the two patches she is offered both switch her firmware off. The scorer ranks them highly because it sees "draw 1 → 2" and cannot see that the counter never reaches 5.

**Recommended fix (decision for Henry):**
- AMPLIFIER and SPLITTER should leave counters alone. A counter is bookkeeping, not a "number" the player gets more of. That is one rule in two transforms, and it covers any future firmware that counts. Then AMPLIFIER on OUROBOROS_LOOP reads "the 5th Water card draws 2", and SPLITTER makes the draw land for each ally (worth reviewing, since the hand is shared).
- REPEATER: write OUROBOROS_LOOP's guard as "add 1" instead of "set 1". Unpatched it behaves the same, because the gate is "less than 1". Patched, it then reads "the 10th Water card each turn draws too".
- Until it is ruled: hide all three for jormungandr_v1, the same way no-ops are hidden.

## Every cell

### fenrir_v1 — UNBOUND_KERNEL
*Attack programs apply 2 Strengthened and deal 2% Max HP recoil damage. Allies' attacks apply 1 Strengthened to Fenrir. Fire attacks deal up to 50% more damage, scaled by how much of your max HP is missing.*

| Patch | What changes (**measured**) | Draft sentence | Status |
|---|---|---|---|
| AMPLIFIER | Own attack: Fenrir +2 → **+4** Strengthened. Ally attack: +1 → **+2**. | "Fenrir gains 4 Strengthened per attack instead of 2, and 2 instead of 1 when an ally attacks." | ok |
| REPEATER | Nothing: no once-a-turn limit. | — | hidden |
| RELAY | An ally's attack now also runs the own-attack clause. Ally attack: Fenrir +1 → **+2** Strengthened, **and Fenrir pays 2% max HP recoil.** | "Your allies' attacks run the kernel too: Fenrir gains 2 Strengthened and pays 2% max HP recoil each time an ally attacks." | **check:** Fenrir pays recoil for his allies' attacks. |
| SPLITTER | Every Strengthened Fenrir gets, the side gets too, **Fenrir included**. Own attack: Fenrir **+4**, each ally +2. Ally attack: Fenrir +2, that ally +1. | "Every Strengthened the kernel gives Fenrir, your whole side gets too, and Fenrir gets it twice." | **check:** Fenrir double-dips (he is one of his own allies). |
| OVERCLOCK | A card that scales off a stack Fenrir holds counts one more. | "Every stack Fenrir holds counts as one more when a card cashes it (3 Strengthened scales as 4)." | ok |
| FAILSAFE | The 2% recoil is removed. HP unchanged after an attack. | "Fenrir's attacks no longer cost him 2% max HP." | ok |

Note: the berserk clause (up to +50% on Fire attacks) is hand-written code, so no patch can change it.

### fenrir_v2 — CINDER_WALL_OS
*Whenever an ally applies the Burn status to any unit, including themselves, Fenrir gains a stack of Sharp.*

| Patch | What changes | Draft sentence | Status |
|---|---|---|---|
| AMPLIFIER | Sharp per Burn application 1 → 2. | "Fenrir gains 2 Sharp instead of 1 whenever an ally applies Burn." | ok |
| REPEATER | Nothing. | — | hidden |
| RELAY | Nothing: it already watches allies. | — | hidden |
| SPLITTER | Each Burn application also gives the whole side 1 Sharp (Fenrir included). | "Whenever an ally applies Burn, your whole side gains 1 Sharp, and Fenrir gains 2." | **check:** the same double-dip as fenrir_v1. |
| OVERCLOCK | Body. | "Every stack Fenrir holds counts as one more when a card cashes it (3 Sharp scales as 4)." | ok |
| FAILSAFE | Nothing: no drawback. | — | hidden |

### skoll_v1 — TREACHERY_KERNEL
*Whenever an allied Mingming takes damage from an enemy attack, Sköll gains 1 stack of Strengthened.*

| Patch | What changes | Draft sentence | Status |
|---|---|---|---|
| AMPLIFIER | Strengthened per hit 1 → 2. | "Sköll gains 2 Strengthened instead of 1 whenever an ally takes damage from an enemy attack." | ok |
| REPEATER | Nothing. | — | hidden |
| RELAY | Nothing: it already watches allies. | — | hidden |
| SPLITTER | Each trigger also gives the whole side 1 Strengthened (Sköll included). | "Whenever an ally is hit by an enemy attack, your whole side gains 1 Strengthened, and Sköll gains 2." | **check:** the same double-dip. |
| OVERCLOCK | Body. | "Every stack Sköll holds counts as one more when a card cashes it." | ok |
| FAILSAFE | Nothing. | — | hidden |

### skoll_v2 — EMBER_FUSE
*Each of Sköll's hits on a Burning target applies 1 more Burn.*

| Patch | What changes | Draft sentence | Status |
|---|---|---|---|
| AMPLIFIER | Extra Burn per hit 1 → 2. | "Each of Sköll's hits on a Burning target applies 2 more Burn instead of 1." | ok |
| REPEATER | Nothing. | — | hidden |
| RELAY | The fuse fires on any ally's hit, not only Sköll's. | "Every ally's hits on a Burning target apply 1 more Burn, not only Sköll's." | ok |
| SPLITTER | Nothing: it gives nothing to Sköll. | — | hidden |
| OVERCLOCK | Body. | "Every stack Sköll holds counts as one more when a card cashes it." | ok |
| FAILSAFE | Nothing. | — | hidden |

### kraken_v1 — ABYSSAL_INK_SYS
*Whenever Kraken's side draws a card outside the draw phase, apply 2 Dazed to a random enemy.*

| Patch | What changes | Draft sentence | Status |
|---|---|---|---|
| AMPLIFIER | Dazed per bonus draw 2 → 3. | "Each bonus draw applies 3 Dazed to a random enemy instead of 2." | ok |
| REPEATER, RELAY, SPLITTER, FAILSAFE | Nothing. | — | hidden |
| OVERCLOCK | Body. | "Every stack Kraken holds counts as one more when a card cashes it." | ok |

### kraken_v2 — TIDAL_CRUSH_OS
*Water cards that cost 2 or more Energy deal 30% more damage.*

| Patch | What changes | Draft sentence | Status |
|---|---|---|---|
| AMPLIFIER | +30% → +45%. | "Kraken's Water cards that cost 2 or more deal 45% more damage instead of 30%." | ok |
| RELAY | Allies' 2+ cost Water cards get the bonus too. | "Any ally's Water cards that cost 2 or more deal 30% more damage, not only Kraken's." | ok |
| REPEATER, SPLITTER, FAILSAFE | Nothing. | — | hidden |
| OVERCLOCK | Body. | "Every stack Kraken holds counts as one more when a card cashes it." | ok |

### jormungandr_v1 — OUROBOROS_LOOP
*Each turn, the 5th Water card your side plays draws 1 card.*

| Patch | What changes (**measured**) | Draft sentence | Status |
|---|---|---|---|
| AMPLIFIER | Never draws (see Broken). | After the fix: "The 5th Water card each turn draws 2 cards instead of 1." | **BROKEN** |
| REPEATER | Draws on every 5th Water card, no limit. | After the fix: "The 10th Water card each turn draws a card too." | **BROKEN** |
| RELAY | Nothing: it already counts the whole side. | — | hidden |
| SPLITTER | Never draws (see Broken). | After the fix: to be ruled. | **BROKEN** |
| OVERCLOCK | Body. | "Every stack Jörmungandr holds counts as one more when a card cashes it." | ok |
| FAILSAFE | Nothing. | — | hidden |

### jormungandr_v2 — TOXIN_FANG_OS
*His attacks deal +4 power per Poison stack on the target.*

| Patch | What changes | Draft sentence | Status |
|---|---|---|---|
| AMPLIFIER | +4 → +6 power per Poison stack. | "Jörmungandr's attacks deal +6 power per Poison stack on the target instead of +4." | ok |
| RELAY | Every ally's attacks get the bonus. | "Every ally's attacks deal +4 power per Poison stack on the target, not only Jörmungandr's." | ok |
| REPEATER, SPLITTER, FAILSAFE | Nothing. | — | hidden |
| OVERCLOCK | Body. | "Every stack Jörmungandr holds counts as one more when a card cashes it." | ok |

### ratatoskr_v1 — GOSSIP_NODE
*Whenever an ally plays a 0-cost program, that ally heals 2.5% of their max HP.*

| Patch | What changes | Draft sentence | Status |
|---|---|---|---|
| AMPLIFIER | Heal power 10 → 11, so 2.5% → 2.75% of max HP. | "Each 0-cost card heals its caster 2.75% of max HP instead of 2.5%." | **check:** +0.25% is a change nobody will feel. AMPLIFIER adds 1 to a printed number, and on a 10-power heal that is a tenth. "Half again" (+50%, 3.75%) would be the multiplier's rule. |
| REPEATER, RELAY, SPLITTER, FAILSAFE | Nothing. | — | hidden |
| OVERCLOCK | Body. | "Every stack Ratatoskr holds counts as one more when a card cashes it." | ok |

### ratatoskr_v2 — INSTIGATOR_OS
*Whenever an ally plays a 0-cost card at an enemy, apply 1 stack of Dazed to the target.*

| Patch | What changes | Draft sentence | Status |
|---|---|---|---|
| AMPLIFIER | Dazed 1 → 2. | "Each 0-cost card an ally plays at an enemy applies 2 Dazed instead of 1." | ok |
| REPEATER, RELAY, SPLITTER, FAILSAFE | Nothing. | — | hidden |
| OVERCLOCK | Body. | "Every stack Ratatoskr holds counts as one more when a card cashes it." | ok |

### huldra_v1 — ALLURE_PROXY
*Whenever an ally applies a buff to an ally, Huldra mirrors it by applying 1 stack of Weakened to a random enemy.*

| Patch | What changes | Draft sentence | Status |
|---|---|---|---|
| AMPLIFIER | Weakened 1 → 2. | "Each buff an ally gives an ally applies 2 Weakened to a random enemy instead of 1." | ok |
| REPEATER, RELAY, SPLITTER, FAILSAFE | Nothing. | — | hidden |
| OVERCLOCK | Body. | "Every stack Huldra holds counts as one more when a card cashes it." | ok |

### huldra_v2 — BARK_SHIELD_OS
*At the end of Huldra's first turn, she raises a massive Bark Shield, and a smaller one around each ally.*

This firmware is hand-written code (`CustomFirmware.ts`) with no hook data, so no firmware patch can reach it.

| Patch | Draft sentence | Status |
|---|---|---|
| OVERCLOCK | "Every stack Huldra holds counts as one more when a card cashes it." | ok, and the only patch she is offered |
| the other five | — | hidden |

## OVERCLOCK's sentence is the same on everyone

OVERCLOCK does not touch the firmware. Its sentence only swaps in the monster's name. If Henry wants it to name the stack each firmware cares about (Sharp for fenrir_v2, Strengthened for fenrir_v1 and skoll_v1, Poison for jormungandr_v2 and so on), that is a wording choice, not a mechanic.

## Reproduce

```
npx vite-node scratch/t184_patch_matrix.ts        # every changed field, per cell
npx vite-node scratch/t184_ouroboros_patches.ts   # the three broken OUROBOROS_LOOP cells
npx vite-node scratch/t184_fenrir_relay.ts        # UNBOUND_KERNEL's RELAY / SPLITTER / AMPLIFIER / FAILSAFE
```
