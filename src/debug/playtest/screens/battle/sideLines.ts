/**
 * TICKET 180d — ONE SIDE OF THE BATTLE, as the stage plaques and HUD cards show it.
 *
 * Name, firmware, HP and max, shield (`tempHp`), energy and max, each status with its stacks, and for
 * an enemy the intent it has planned, with the numbers the intent tooltip prints (`Deals N damage.`
 * is `calculateDamage` against the unit the enemy will pick, the same call `MingmingUnit` makes).
 * A glossary line follows for each status in play, from the game's own `statusGlossary`.
 */
import { plain } from '../../../../ui/labels/labels';
import { calculateDamage } from '../../../../engine/combatUtils';
import { statusGlossary } from '../../../../engine/data/statusGlossary';
import type { IBattleEntity, IBattleState, ProgramData } from '../../../../engine/types';
import { getOSBehavior } from '../../../../engine/data/firmwareRegistry';

const round = (n: number): number => Math.round(n * 10) / 10;

function statusText(entity: IBattleEntity): string {
    return entity.statusEffects.length === 0
        ? ''
        : ` | ${entity.statusEffects.map((s) => `${statusGlossary[s.type]?.name ?? s.type} x${round(s.stacks)}`).join(', ')}`;
}

/** The unit the enemy's planned move will land on: the lowest HP standing, ties by id (as the HUD reads it). */
const aimOf = (state: IBattleState): IBattleEntity | undefined =>
    [...state.playerParty].filter((e) => e.currentHp > 0)
        .sort((a, b) => a.currentHp - b.currentHp || a.id.localeCompare(b.id))[0];

export function intentText(entity: IBattleEntity, state: IBattleState): string {
    const intent = entity.currentIntent;
    if (!intent) return '';
    const target = aimOf(state);
    const parts: string[] = [];
    for (const act of intent.actions) {
        if (act.type === 'ATTACK' && target) {
            const dummy = { element: act.element } as ProgramData;
            parts.push(`Deals ${Math.floor(calculateDamage(entity, target, dummy, act.power, state) * (act.count || 1))} damage.`);
        } else if (act.type === 'STATUS') parts.push(`Applies ${act.stacks} ${act.status}.`);
        else if (act.type === 'HEAL') parts.push(`Heals for ${act.power}.`);
    }
    return ` | intends ${intent.name}: ${parts.join(' ')}${target ? ` (aimed at ${target.name})` : ''}`;
}

/** `[Firmware]` for a unit that runs one the game has. Wild units carry a placeholder id that is no firmware, and show none. */
const firmwareTag = (entity: IBattleEntity): string => {
    const name = entity.activeOS === undefined ? undefined : getOSBehavior(entity.activeOS)?.name;
    return name === undefined ? '' : ` [${name}]`;
};

export function entityLine(entity: IBattleEntity, state: IBattleState, withIntent: boolean): string {
    if (entity.currentHp <= 0) return `  ${entity.name}${firmwareTag(entity)}: DOWN`;
    const shield = entity.tempHp > 0 ? ` shield ${round(entity.tempHp)}` : '';
    return `  ${entity.name}${firmwareTag(entity)}: HP ${entity.currentHp}/${entity.maxHp}${shield}, energy ${entity.currentEnergy}/${entity.maxEnergy}`
        + `${statusText(entity)}${withIntent ? intentText(entity, state) : ''}`;
}

export function sideLines(state: IBattleState): string[] {
    return [
        'YOUR SIDE:', ...state.playerParty.map((e) => entityLine(e, state, false)),
        'ENEMY SIDE:', ...state.enemyParty.map((e) => entityLine(e, state, true)),
    ];
}

/** One glossary line for each status on either side right now. */
export function statusLegend(state: IBattleState): string[] {
    const present = new Set<string>();
    for (const e of [...state.playerParty, ...state.enemyParty]) if (e.currentHp > 0) for (const s of e.statusEffects) present.add(s.type);
    return [...present].sort().flatMap((type) => {
        const entry = statusGlossary[type as keyof typeof statusGlossary];
        return entry ? [plain(`  ${entry.name}: ${entry.description}`)] : [];
    });
}
