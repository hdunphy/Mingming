import { type HookDefinition, type HookContext, type HookResult, type MutationRequest, resolveCounterKey } from './HookTypes';
import type { IBattleState, IBattleEntity } from '../types';
import { StatusType } from '../types';
import { applyMutations } from '../resolutionEngine';
import { numericBaseCost } from '../types';
import { resolveProgramFree } from '../actions/ActionExecutors';
import { GetProgramData } from '../data/programRegistry';
import { PRNG } from './PRNG';

/** Decided in the OS design review (deck-archetypes ticket 09): 50% of maxHP. */
const HULDRA_V2_SHIELD_PERCENT = 50;

/**
 * UNDERWORLD_GATEWAY (hel_v2), ticket 57 — throttled blood, %-denominated.
 *
 * "Hel's Dark spells cost 5% of her max HP per Energy of their printed cost instead of Energy.
 *  She can spend at most 20% of her max HP this way each turn."
 *
 * WHY IT MOVED OUT OF hooks.json. The old version was two data hooks: a blanket
 * `onCostCalculated` multiplier of 0 (every card free) plus an `onActionStart` HP toll with
 * `escalatePerPlay: 1.25`. The cap this ticket adds needs arithmetic a data hook cannot express -
 * "would THIS cast, at ITS printed cost, take me past the turn's budget" compares a per-card
 * quantity against a running counter, and `when.counter` can only compare a counter to a
 * constant. Expressing it in data would take one blocking hook per cost tier.
 *
 * WHY THE COST HOOK RATHER THAN A CONSTRAINT. A blocked cast has to be UNAFFORDABLE, not
 * cancelled, and it has to look unaffordable to BOTH cost consumers (HANDOFF 8d): the reducer's
 * `handlePlayProgram` and `TacticalAI`, which both price a card through `executeCostCalculated`.
 * Returning a sentinel cost there means the AI never proposes the card and the reducer would
 * reject it anyway - no third code path, and the UI cost pip greys out for free.
 *
 * DENOMINATED IN %maxHp, deliberately: a flat HP price drifts with level (the rev-3 statuses
 * precedent). The counter is kept in PERCENT units - 5 per Energy point - so the cap reads as the
 * same 20 the OS text says, at every level.
 *
 * SCOPE NOTE, reported in the ticket: the approved text says "Hel's DARK spells", where the old
 * implementation zeroed the cost of every card she played. Her 1-Energy Light/None cards
 * (`dawnstrike` x2, `squirrel_away`) therefore pay ENERGY again - which is what stops the 20% cap
 * being a hard stop on her turn, and incidentally revives a stat this OS had made dead.
 */
const HEL_BLOOD_PCT_PER_ENERGY = 5;
const HEL_BLOOD_CAP_PCT = 20;
/** Any cost the frame cannot pay. Hel has 2 Energy; this is "unaffordable", not "expensive". */
const HEL_BLOOD_BLOCKED_COST = 999;

/** Percent of max HP this cast would spend, or 0 if it is not a blood cast at all. */
function helBloodPct(context: HookContext, owner: IBattleEntity): number {
    const program = context.program;
    if (!program || context.source?.id !== owner.id) return 0;
    if (program.element !== 'Dark') return 0;
    // An X-cost card has no printed Energy cost to convert; it keeps the normal Energy price.
    if (program.baseCost === 'X') return 0;
    const printed = numericBaseCost(program.baseCost);
    if (printed <= 0) return 0;
    return printed * HEL_BLOOD_PCT_PER_ENERGY;
}

export const CustomFirmware: Record<string, HookDefinition[]> = {
    "fafnir_v1": [
        {
            id: "fafnir_v1_hoard",
            priority: 40,
            onTurnEnd: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                // Only hoard at the END of the OWNER's own turn (onTurnEnd fires
                // for hooks on both sides; context.source is the ending entity).
                if (context.source?.id === owner.id && owner.currentEnergy > 0) {
                    const energyToHoard = owner.currentEnergy;
                    state = applyMutations(state, [
                        { type: 'STATUS', targetId: owner.id, sourceId: owner.id, payload: { status: 'Energized', stacks: energyToHoard } },
                        { type: 'COUNTER', targetId: '', payload: { key: resolveCounterKey('fafnir_hoard', 'OWNER', owner), operator: 'SET', amount: energyToHoard } },
                        { type: 'LOG', targetId: '', payload: `${owner.name}'s HOARD_PROTOCOL retains ${energyToHoard} Energy!` }
                    ]);
                }
                return { state };
            }
        },
        {
            id: "fafnir_v1_recoil",
            priority: 40,
            onTurnStart: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                // Recoil lands at the START of the owner's next turn — the moment
                // the hoarded Energy is cashed in (1% max HP per point, min 1).
                const hoardKey = resolveCounterKey('fafnir_hoard', 'OWNER', owner);
                const hoarded = state.counters[hoardKey] || 0;
                if (context.source?.id === owner.id && hoarded > 0) {
                    const recoilDamage = Math.max(1, Math.floor(owner.maxHp * 0.01 * hoarded));
                    state = applyMutations(state, [
                        { type: 'HP', targetId: owner.id, payload: { amount: recoilDamage } },
                        { type: 'COUNTER', targetId: '', payload: { key: hoardKey, operator: 'RESET' } },
                        { type: 'LOG', targetId: '', payload: `${owner.name}'s hoarded Energy burns its core for ${recoilDamage} damage!` }
                    ]);
                }
                return { state };
            }
        }
    ],
    // NOTE: gullinbursti_v1 / gullinbursti_v2 / audhumbla_v1 used to have hand-written
    // implementations here with DIFFERENT hook ids than the hooks.json versions, so both
    // registered and both fired (double Sharp damage bonus, two competing discount systems,
    // double max-energy gains). The data-driven hooks.json versions match the OS
    // descriptions, so the custom duplicates were removed.
    // NOTE (ticket 07, 2026-08-05): fafnir_v2 previously had a hand-written duplicate here
    // with the SAME id as the hooks.json version ("fafnir_v2_corrupted") — only the Set-dedup
    // in hook collection prevented double energy. The data-driven hooks.json version is the
    // survivor, matching the gullinbursti/audhumbla cleanup above.
    //
    // NOTE (ticket 07, 2026-08-05): hraesvelgr_v1's no-op onActionStart stub was deleted —
    // the real GALE_FORCE_OS hook lives in hooks.json (trigger: onDiscarded) and is fully
    // wired; it just has no enabler cards in the pool yet (see deck-archetypes map).
    "hraesvelgr_v2": [
        {
            id: "hraesvelgr_v2_updraft",
            priority: 40,
            onCardDraw: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                // deck_shuffles is genuinely global (one shared deck per side);
                // the once-only guard is namespaced per owner so two Hraesvelgrs
                // each get their own +1 Max Energy.
                const guardKey = resolveCounterKey('hraesvelgr_max_energy', 'OWNER', owner);
                if ((state.counters['deck_shuffles'] || 0) > 0 && !(state.counters[guardKey] || 0)) {
                    state = applyMutations(state, [
                        { type: 'MAX_ENERGY', targetId: owner.id, payload: { amount: 1 } },
                        { type: 'COUNTER', targetId: '', payload: { key: guardKey, operator: 'SET', amount: 1 } },
                        { type: 'LOG', targetId: '', payload: `${owner.name}'s UPDRAFT_KERNEL increases Max Energy by 1!` }
                    ]);
                }
                return { state };
            }
        }
    ],
    /**
     * Ticket 53 - VALHALLA_UPLINK, replaced. The old firmware healed an ALLY 5% of max HP
     * whenever Valkyrie buffed them, behind a `context.target.id !== owner.id` guard: in a 1v1
     * battle there is no other ally, so it PROVABLY never fired, which is most of why valkyrie
     * lost 94-95% to the control. The einherjar rise each evening instead:
     *
     *   "At the end of Valkyrie's turn, play a random card from her discard pile for free."
     *
     * Free means free - no Energy, no constraint check, no hand move. The card stays in the
     * discard (so it can come back again, and so the deck does not thin), the exhaust pile is
     * excluded by construction (exhausted cards never enter the discard), and the pick is
     * seeded off `state.seed` with the advanced seed threaded back.
     *
     * One proc per turn, guarded on the turn number rather than a reset counter, so a second
     * onTurnEnd dispatch in the same turn cannot double-fire it.
     */
    "valkyrie_v1": [
        {
            id: "valkyrie_v1_uplink",
            priority: 40,
            onTurnEnd: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                if (context.source?.id !== owner.id) return { state };

                const guardKey = resolveCounterKey('valkyrie_uplink_turn', 'OWNER', owner);
                if ((state.counters[guardKey] || 0) === state.turn) return { state };

                const isPlayer = state.playerParty.some((e: IBattleEntity) => e.id === owner.id);
                const deck = isPlayer ? state.playerDeck : state.enemyDeck;
                if (deck.discard.length === 0) return { state };

                const { value: index, nextSeed } = new PRNG(state.seed).nextInt(0, deck.discard.length - 1);
                const chosen = deck.discard[index];
                state = { ...state, seed: nextSeed };

                const programData = GetProgramData(chosen.dataId);
                state = applyMutations(state, [
                    { type: 'COUNTER', targetId: '', payload: { key: guardKey, operator: 'SET', amount: state.turn } },
                    { type: 'LOG', targetId: '', payload: `${owner.name}'s VALHALLA_UPLINK calls ${programData.name} back from the fallen!` }
                ]);
                state = resolveProgramFree(state, owner.id, chosen.id, programData, { ...context, state, program: programData });

                return { state };
            }
        }
    ],
    "huldra_v2": [
        // Ticket 07 fixed two real defects here (the `state.turn === 1` guard never matched
        // player-side, and BarkShield stacks ARE a percent of maxHp so `floor(maxHp * 0.5)` made
        // the shield quadratic). Its fix granted the shield at the owner's FIRST turn boundary
        // via TWO hooks - `bark_start` (onTurnStart) and `bark_end` (onTurnEnd) - sharing a
        // once-per-battle counter, on the reasoning that enemy-side Huldra would take it at her
        // turn-1 pre-turn and player-side Huldra at the end of turn 1.
        //
        // TICKET 55 AMENDMENT 1 MEASURED THAT AND IT IS FALSE. The liveness sweep
        // (`src/debug/balance/liveness.ts`) recorded `bark_start` at **0 effects across 10,649
        // calls**, with `bark_end` taking 100% of the grants - because a battle opens mid-turn-1
        // in the ACTION phase, so EVERY unit's first boundary is a turn END, on both sides.
        // `bark_start` was dead code and is deleted; the shield's behaviour is unchanged.
        //
        // KNOWN BUFF LEVER (Henry, ticket-55 review): making the grant land at turn START is not
        // a neutral restoration of intent - per HANDOFF 8-SHIELD-TIMING a start-of-turn shield
        // protects the owner's own actions and an end-of-turn one does not, so it is a real buff.
        // huldra_v2 sits at a healthy ~71% field and does not need it. If it ever does, this is
        // the cheapest lever on the deck: move this hook to `onTurnStart`.
        {
            id: "huldra_v2_bark_end",
            priority: 40,
            onTurnEnd: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                const guardKey = resolveCounterKey('huldra_shield_init', 'OWNER', owner);
                if (!state.counters[guardKey]) {
                    // BarkShield stacks are a percent of maxHp (see StatusBehaviors), so this is a
                    // flat percent and not a scaled one. HULDRA_V2_SHIELD_PERCENT = 50 was the
                    // value confirmed by the OS design review (deck-archetypes ticket 09).
                    state = applyMutations(state, [
                        { type: 'STATUS', targetId: owner.id, sourceId: owner.id, payload: { status: 'BarkShield', stacks: HULDRA_V2_SHIELD_PERCENT } },
                        { type: 'COUNTER', targetId: '', payload: { key: guardKey, operator: 'SET', amount: 1 } },
                        { type: 'LOG', targetId: '', payload: `${owner.name}'s BARK_SHIELD_OS activates a massive temporary shield!` }
                    ]);
                }
                return { state };
            }
        }
    ],
    // Ticket 53: valkyrie_v2's CRUSADER_KERNEL firmware (+10% Light damage per distinct
    // positive status) was DELETED here and the slot became REBIRTH_CYCLE_OS, a data hook in
    // hooks.json on the newly-dispatched `onDeckShuffled` trigger. EINHERJAR_RALLY lives on as
    // the `einherjar_standard` team daemon card (still unused - needs ticket 05).
    "hel_v2": [
        {
            id: "hel_v2_underworld_cost",
            priority: 40,
            onCostCalculated: (cost: number, context: HookContext, owner: IBattleEntity): number => {
                const pct = helBloodPct(context, owner);
                if (pct === 0) return cost;
                const spent = (context.state.counters || {})[resolveCounterKey('hel_blood_spent', 'OWNER', owner)] || 0;
                // The cap is checked against what this cast WOULD take the total to, so a 3-Energy
                // spell is refused at 10% spent even though 10 is under 20.
                if (spent + pct > HEL_BLOOD_CAP_PCT) return HEL_BLOOD_BLOCKED_COST;
                return 0;
            }
        },
        {
            id: "hel_v2_underworld_toll",
            priority: 40,
            onActionStart: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                const pct = helBloodPct({ ...context, state }, owner);
                if (pct === 0) return { state };

                // Floor of 1: a cast always costs blood, however small the frame.
                const hpCost = Math.max(1, Math.ceil(owner.maxHp * (HEL_BLOOD_PCT_PER_ENERGY / 100)) * (pct / HEL_BLOOD_PCT_PER_ENERGY));
                const spentKey = resolveCounterKey('hel_blood_spent', 'OWNER', owner);
                state = applyMutations(state, [
                    { type: 'HP', targetId: owner.id, sourceId: owner.id, payload: { amount: hpCost } },
                    { type: 'COUNTER', targetId: '', payload: { key: spentKey, operator: 'ADD', amount: pct } },
                    { type: 'LOG', targetId: '', payload: `${owner.name}'s UNDERWORLD_GATEWAY pays ${hpCost} HP in blood!` }
                ]);
                return { state };
            }
        },
        {
            id: "hel_v2_underworld_reset",
            priority: 50,
            onTurnEnd: (context: HookContext, owner: IBattleEntity): HookResult => {
                if (context.source?.id !== owner.id) return { state: context.state };
                return {
                    state: applyMutations(context.state, [
                        { type: 'COUNTER', targetId: '', payload: { key: resolveCounterKey('hel_blood_spent', 'OWNER', owner), operator: 'RESET' } }
                    ])
                };
            }
        }
    ],
    "ymir_v2": [
        {
            id: "ymir_v2_glacial",
            priority: 40,
            onDamageCalculated: (currentDamage: number, context: HookContext, owner: IBattleEntity): number => {
                if (context.source?.id === owner.id && context.program?.element === 'Ice') {
                    // Ice cards deal more base damage. Ticket 09 softened 50% -> 35%; ticket 50
                    // takes it to 25%, because the `maxCardsPerTurn: 2` drawback that was meant
                    // to pay for it is INERT: at 2 Energy with no 0-cost cards the most Ymir can
                    // play in a turn is already 2, so the cap never binds. That is why v2 won 97%
                    // of 96 decided games against v1 on an identical deck. The cap stays as a
                    // guard against a future 0e-heavy build; the multiplier is priced as the pure
                    // bonus it actually is.
                    //
                    // NOTE: powerscale cannot see this - it is firmware, not card data - so every
                    // Ice card in ymir_v2 is worth 25% more than its printed score says.
                    return currentDamage + Math.floor(currentDamage * 0.25);
                }
                return currentDamage;
            }
        }
    ]
};
