import { type HookDefinition, type HookContext, type HookResult, resolveCounterKey } from './HookTypes';
import type { IBattleState, IBattleEntity, ProgramData } from '../types';
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
/**
 * Ticket 79: the OS dials for the four decks at the top of the field, exported as knobs so a
 * sweep can move them without a rebuild. Shipped values are the ones written here.
 *
 * `hel.pctPerEnergy` / `hel.capPct` - UNDERWORLD_GATEWAY's blood price and its per-turn cap.
 *
 * Ticket 80: price 5 -> 6, cap 20 -> **25**.
 * Henry: *"I really don't like adding arbitrary caps... move to 6% energy cost but remove the
 * 20% cap."* Measured, the cap was inert anyway - `soul_tithe` costs exactly 15% so a cap of
 * 20 or 15 blocked nothing it was meant to, and only ever stopped a rare second Dark cast.
 * The price is the honest lever: it charges for every cast instead of forbidding one of them.
 *
 * REMOVING THE CAP ENTIRELY WAS TRIED FIRST AND MADE HER STRONGER, not weaker: 81.4% ->
 * **87.0%** field. Uncapped she chains Dark casts all turn and the OS's +50% healing refunds
 * the blood faster than the price takes it, so the extra volume beat the extra cost. Henry
 * anticipated exactly this ("if she is too OP try 25% and back to 20%"). At 6% a cap of 25
 * allows four Energy-points of Dark a turn (24%) and lands her at 71.0%; a cap of 20 allows
 * three (18%) and lands at 70.0% - one point apart, inside noise at this sample, so 25 keeps
 * the looser texture. **A cap of 18 is identical to 20** at this price, which is worth knowing
 * before anyone tunes it again: the knob moves in Energy-point steps, not percent steps.
 * `ymir.iceBonus`               - GLACIAL_PACE_OS's Ice damage bonus.
 * `hraes.shufflesNeeded`        - how many deck cycles UPDRAFT_KERNEL waits for before it
 *                                 pays out its permanent +1 max Energy. Ticket 81 took it
 *                                 from 1 to 2: the OS was worth +64 points and paid out on
 *                                 turn ~2 on an 8-card deck carrying four draw cards.
 */
export const OS_KNOBS = { hel: { pctPerEnergy: 6, capPct: 25 }, ymir: { iceBonus: 0.25 }, hraes: { shufflesNeeded: 2 }, fenrir: { berserkPct: 0.5 } };

/**
 * Any cost the frame cannot pay. Hel has 2 Energy; this is "unaffordable", not "expensive".
 *
 * TICKET 105: this leaked straight into the UI as the literal string "999" - Henry, at 23 HP:
 * *"Last Rites says it costs 999 energy/HP? Would it kill me and thats why I can't play it?"*
 * Exported now, with `isUnaffordableCost` as the check and `blockedCostReason` as the words,
 * so the card face can say WHY instead of printing an internal sentinel at the player.
 */
export const UNAFFORDABLE_COST = 999;

/** Is this cost the block sentinel rather than a real price? */
export const isUnaffordableCost = (cost: number): boolean => cost >= UNAFFORDABLE_COST;

/**
 * Why a cast is blocked, in the player's words - or null if it is not blocked.
 *
 * Lives next to the rule that produces the block so the two cannot drift: any new blocking
 * cost hook adds its reason here, and the card face picks it up for free.
 */
export function blockedCostReason(
    state: IBattleState, source: IBattleEntity, program: ProgramData
): string | null {
    if (source.activeOS !== 'hel_v2') return null;
    const pct = helBloodPct({ state, source, program, triggerDepth: 0 } as HookContext, source);
    if (pct === 0) return null;
    const hpCost = helBloodHpCost(pct, source);
    if (hpCost >= source.currentHp) {
        return `Would cost ${hpCost} HP in blood - more than you have left`;
    }
    const spent = (state.counters || {})[resolveCounterKey('hel_blood_spent', 'OWNER', source)] || 0;
    if (spent + pct > OS_KNOBS.hel.capPct) {
        return `Blood budget spent this turn (${spent}% of ${OS_KNOBS.hel.capPct}%)`;
    }
    return null;
}

/** Percent of max HP this cast would spend, or 0 if it is not a blood cast at all. */
function helBloodPct(context: HookContext, owner: IBattleEntity): number {
    const program = context.program;
    if (!program || context.source?.id !== owner.id) return 0;
    if (program.element !== 'Dark') return 0;
    // An X-cost card has no printed Energy cost to convert; it keeps the normal Energy price.
    if (program.baseCost === 'X') return 0;
    const printed = numericBaseCost(program.baseCost);
    if (printed <= 0) return 0;
    return printed * OS_KNOBS.hel.pctPerEnergy;
}

/**
 * The blood price in HP for a cast worth `pct` percent of max HP.
 *
 * TICKET 105: extracted so the COST hook and the TOLL hook cannot disagree. They used to
 * compute the same number in two places, and the cost hook only knew how to refuse a cast for
 * being over the turn budget - not for being LETHAL. Floor of 1: a cast always costs blood,
 * however small the frame.
 */
function helBloodHpCost(pct: number, owner: IBattleEntity): number {
    return Math.max(1, Math.ceil(owner.maxHp * (OS_KNOBS.hel.pctPerEnergy / 100)) * (pct / OS_KNOBS.hel.pctPerEnergy));
}

/**
 * SOLAR_OVERDRIVE_OS (skoll_v2), ticket 64 — the hoarding half of the wolf.
 *
 * "Skoll's attacks deal +15% damage per stack of Strength she holds." (Ticket 103 removed the
 * five-stack cap - see the constant below.)
 *
 * WHY IT IS HERE AND NOT IN hooks.json. The mechanism is `core_overclock_daemon`'s exactly —
 * an `onDamageCalculated` multiplier scaled by STRENGTH_STACKS — and that hook IS expressible
 * as data. What is not expressible is the CAP: `HookFactory.resolveScaling` hard-caps
 * STRENGTH_STACKS at `STRENGTH_STACK_CAP` (8), and this OS is specified at 5. A data hook
 * would read +120% at eight stacks where the design says +75% at five, and the difference is
 * not cosmetic on a deck built to hoard — `strength_burst` alone grants 5.
 *
 * Expressing it as data would have meant a new `scalingCap` field on the hook schema, which
 * per HANDOFF 8c2 means touching zod AND the TS unions in two places each, for one consumer.
 * Hand-written firmware is the precedent for exactly this (hel_v2's UNDERWORLD_GATEWAY, ymir_v2's
 * GLACIAL_HEART) and costs no schema surface.
 *
 * POOL WATCH-ITEM, recorded per the ticket rather than fixed: this OS and
 * `core_overclock_daemon` COMPOUND (HANDOFF 8-COMPOUND). The daemon leaves skoll's deck here
 * but stays in the registry, so a player build holding both gets 1.15^n x 1.2^n. Not fixed,
 * documented — the fix is a design call about whether firmware and daemons may stack at all.
 *
 * NOTE for anyone reading a skoll_v2 card score: powerscale cannot see firmware, so every
 * attack in this deck is worth up to 75% more than its printed score says.
 */
// Knob round 2 (ticket 64) tried 0.10 here and it FAILED in both directions: the dead-card
// gate it was aimed at got WORSE (36.9% -> 37.6%) because games barely lengthened (3.50 ->
// 3.63 turns), and it cost 12.7 field points and 20 control points. Reverted. The dead-card
// overage is a CURVE problem - three 2-cost cards on a 2-Energy frame - and no authorized
// knob reaches it. See the ticket-64 Resolution.
const SKOLL_V2_DAMAGE_PER_STRENGTH = 0.15;
/**
 * TICKET 103: THE CAP IS GONE. It was 5, and it was the reason the one deck built to hoard
 * Strength was the worst deck in the game after statuses became POWER: every other status deck
 * got paid for a big pile and skoll's OS stopped reading hers at five. Removing it, and nothing
 * else, took skoll_v2 from 34.5% field to 50.1% and cut her absolutes from 6 to 3.
 *
 * `Infinity` rather than a large number: a cap you cannot reach is still a cap somebody has to
 * reason about, and Henry's standing rule is that arbitrary caps are not a design shape here.
 * The valve is the duality cancel and the sheds, as it is for every other duality status.
 *
 * The `let` + setter is the balance sweep's seam (scratch/weak.ts measures cap values without a
 * rebuild). Nothing in the game calls the setter.
 */
let SKOLL_V2_STRENGTH_CAP = Infinity;
export function __setSkollStrengthCap(n: number): void { SKOLL_V2_STRENGTH_CAP = n; }

/**
 * UNBOUND_KERNEL (fenrir_v1), ticket 84 - the half of the OS that was missing.
 *
 * "Attack programs apply 1 Strengthened and deal 2% Max HP recoil damage. Fire attacks deal up to
 *  50% more damage, scaled by how much of your max HP is missing."
 *
 * WHY THE CLAUSE EXISTS. Ticket 83 measured the original OS as a price with no product. On a 66 HP
 * frame the recoil is `max(1, floor(66 * 0.02))` = ONE HP - and 1% floors to the same 1, so the
 * price has no second setting - which across a game supplies ~8% missing HP, worth +5.6 power on
 * `ragnarok_edge`. The OS sold ~5.5 HP of her health for ~1.9 HP of damage, and `berserk_rush`
 * needs 50% missing, so it never switched that card on at all. Ticket 82 had removed the recoil
 * because it could not find anything the recoil bought; this pays for it instead.
 *
 * WHY IT IS SCALED AND NOT FLAT. Both were measured at the same +20% ceiling: FLAT read 34.8%
 * field, BELOW the recoil-less build, because a flat bonus is a power increase that prices in
 * against every opponent equally. Scaled by missing HP read 40.1% and halved her 0% cells (11 ->
 * 6): it pays exactly where a 66 HP deck spends its games, so it turns hopeless cells into
 * contests instead of making good matchups better.
 *
 * WHY IT IS HERE AND NOT IN hooks.json. `HookFactory.resolveScaling`'s `MISSING_HP` key resolves
 * the TARGET's missing HP - the defender's - and this bonus keys off the OWNER's. Expressing it as
 * data would mean a new scaling key for one consumer; hand-written firmware is the precedent
 * (hel_v2, ymir_v2, skoll_v2).
 *
 * DO NOT RAISE THE RECOIL to make the berserk state reachable. It was measured: 8% (5 HP an attack)
 * collapses her to 20.2% with 19 zero cells, games a turn and a half shorter. On the smallest frame
 * in the roster the missing HP has to come from the enemy.
 *
 * NOTE: `powerscale` cannot see this - it is firmware, not card data - so every Fire card in
 * fenrir_v1 is worth more than its printed score says, the same blind spot ymir_v2's Ice bonus has.
 */
export const CustomFirmware: Record<string, HookDefinition[]> = {
    "fenrir_v1": [
        {
            id: "fenrir_v1_berserk",
            priority: 40,
            onDamageCalculated: (currentDamage: number, context: HookContext, owner: IBattleEntity): number => {
                if (context.source?.id === owner.id && context.program?.element === 'Fire') {
                    const missing = 1 - owner.currentHp / Math.max(1, owner.maxHp);
                    return currentDamage + Math.floor(currentDamage * OS_KNOBS.fenrir.berserkPct * missing);
                }
                return currentDamage;
            }
        }
    ],
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
                if ((state.counters['deck_shuffles'] || 0) >= OS_KNOBS.hraes.shufflesNeeded && !(state.counters[guardKey] || 0)) {
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
        //
        // RE-CONFIRMED 2026-08-24. Henry hit this in a playtest and read it as a bug: *"Huldra_V2
        // didn't start with a temp shield, she got it on her turn, so I could get free damage
        // without her blocking it."* He was reading the OS description, which said "starts every
        // battle with a massive, temporary shield" and had been lying since ticket 07 moved the
        // grant to a turn boundary. His ruling: **fix the copy** - the shield stays at turn end.
        // `hooks.json`'s description now says when it actually lands.
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
                if (spent + pct > OS_KNOBS.hel.capPct) return UNAFFORDABLE_COST;
                // TICKET 105: a price you cannot survive is a price you cannot pay. Without this,
                // the toll below killed her mid-cast and the card resolved anyway - Henry's
                // "I died first yet still got the victory". `>=` not `>`: paying your last point
                // of HP is death, not a bargain.
                if (helBloodHpCost(pct, owner) >= owner.currentHp) return UNAFFORDABLE_COST;
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

                const hpCost = helBloodHpCost(pct, owner);
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
                    return currentDamage + Math.floor(currentDamage * OS_KNOBS.ymir.iceBonus);
                }
                return currentDamage;
            }
        }
    ],
    "skoll_v2": [
        {
            id: "skoll_v2_solar_overdrive",
            priority: 40,
            onDamageCalculated: (currentDamage: number, context: HookContext, owner: IBattleEntity): number => {
                if (context.source?.id !== owner.id) return currentDamage;
                const strength = owner.statusEffects.find(s => s.type === 'Strengthened')?.stacks ?? 0;
                if (strength <= 0) return currentDamage;
                const stacks = Math.min(strength, SKOLL_V2_STRENGTH_CAP);
                // Floored, like every other firmware damage bonus, so the OS can never add a
                // fractional point the UI cannot show. Compounds with Strengthened's OWN
                // 2%/stack modifier rather than replacing it (8-COMPOUND) - that is the
                // intended reading of "hoards her Strength": the pile pays twice.
                return currentDamage + Math.floor(currentDamage * (SKOLL_V2_DAMAGE_PER_STRENGTH * stacks));
            }
        }
    ]
};
