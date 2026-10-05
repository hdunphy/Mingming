/**
 * TICKET 180e — WHAT A CARD OR MACRO ACTUALLY DID, from the state before, the state after and the
 * hits the step recorded (the ledger, `battleSim.step`).
 *
 * Nothing here knows a card: it only compares two states, so a card whose text and effect disagree
 * shows up as a surprise without the tool needing to understand either. Definitions:
 *
 * - `hits`: separate damage hits that landed on an enemy (self-damage is not counted).
 * - `kills`: enemies standing before and down after.
 * - `status`: net stacks gained (+) or lost (-) per unit other than the caster, ticks of the move only.
 * - `self`: the same for the caster.
 * - `draw`: cards that came into the hand from the draw pile or discard.
 * - `energy`: the caster's Energy after minus before (a 2-Energy card is -2).
 * - `created`: cards that exist in no pile before and one after. `exhausted`: growth of the exhaust pile.
 */
import type { BattleAction } from '../../../engine/battleReducer';
import type { IBattleEntity, IBattleState, ProgramEntity } from '../../../engine/types';
import type { HitTotal } from '../battleSim';
import { fightName } from '../sideTag';

export interface PlayRecord {
    readonly action: BattleAction;
    readonly before: IBattleState;
    readonly after: IBattleState;
    readonly hits: ReadonlyArray<HitTotal>;
}

export interface Outcome {
    readonly hits: number;
    readonly kills: ReadonlyArray<string>;
    readonly status: Readonly<Record<string, Readonly<Record<string, number>>>>;
    readonly self: Readonly<Record<string, number>>;
    readonly draw: number;
    readonly energy: number;
    readonly created: number;
    readonly exhausted: number;
}

const everyone = (s: IBattleState): IBattleEntity[] => [...s.playerParty, ...s.enemyParty];
const pilesOf = (s: IBattleState): ProgramEntity[] => {
    const d = s.playerDeck;
    return [...d.hand, ...d.drawpile, ...d.discard, ...d.exhaust];
};

function stacksOf(entity: IBattleEntity): Map<string, number> {
    const held = new Map<string, number>();
    for (const s of entity.statusEffects) held.set(s.type, (held.get(s.type) ?? 0) + s.stacks);
    return held;
}

/** Net stack changes between two views of one unit, zero changes left out, stacks rounded to a tenth. */
function statusDelta(before: IBattleEntity | undefined, after: IBattleEntity | undefined): Record<string, number> {
    const was = before ? stacksOf(before) : new Map<string, number>();
    const now = after ? stacksOf(after) : new Map<string, number>();
    const delta: Record<string, number> = {};
    for (const type of new Set([...was.keys(), ...now.keys()])) {
        const change = Math.round(((now.get(type) ?? 0) - (was.get(type) ?? 0)) * 10) / 10;
        if (change !== 0) delta[type] = change;
    }
    return delta;
}

export function outcomeOf(play: PlayRecord): Outcome {
    const { before, after, action } = play;
    const casterId = action.type === 'PLAY_PROGRAM' || action.type === 'FIRE_MACRO' ? action.payload.sourceId : '';
    const enemyNames = new Set(before.enemyParty.map((e) => fightName(before, e.id)));

    const status: Record<string, Record<string, number>> = {};
    let self: Record<string, number> = {};
    for (const unit of everyone(before)) {
        const delta = statusDelta(unit, everyone(after).find((e) => e.id === unit.id));
        if (Object.keys(delta).length === 0) continue;
        if (unit.id === casterId) self = delta;
        else status[unit.name] = { ...(status[unit.name] ?? {}), ...delta };
    }

    const idsBefore = new Set(pilesOf(before).map((c) => c.id));
    const reserve = new Set([...before.playerDeck.drawpile, ...before.playerDeck.discard, ...before.playerDeck.exhaust].map((c) => c.id));
    const handBefore = new Set(before.playerDeck.hand.map((c) => c.id));
    const arrived = after.playerDeck.hand.filter((c) => !handBefore.has(c.id));
    const caster = before.playerParty.find((e) => e.id === casterId);
    const casterAfter = after.playerParty.find((e) => e.id === casterId);

    return {
        hits: play.hits.filter((h) => enemyNames.has(h.target)).reduce((n, h) => n + h.times, 0),
        kills: before.enemyParty.filter((e) => e.currentHp > 0 && (after.enemyParty.find((a) => a.id === e.id)?.currentHp ?? 0) <= 0).map((e) => e.name),
        status,
        self,
        draw: arrived.filter((c) => reserve.has(c.id)).length,
        energy: (casterAfter?.currentEnergy ?? 0) - (caster?.currentEnergy ?? 0),
        created: pilesOf(after).filter((c) => !idsBefore.has(c.id)).length,
        exhausted: after.playerDeck.exhaust.length - before.playerDeck.exhaust.length,
    };
}
