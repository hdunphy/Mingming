/**
 * TICKET 193c — WHICH DIFFERENCES THE GAME ITSELF EXPLAINS.
 *
 * Ticket 186d ruled: *card text stays clean, and the combat log says what a firmware adds.* The
 * prediction check compares an agent's expectation with the printed card text, so a firmware's extra
 * Dazed or an Aura's extra hit reads as a wording bug every night, the ruling's own intended behaviour.
 *
 * A difference is **explained** when a hook carried by one of the battle's units fired during the play
 * (its own log line is among the lines the play added) AND that hook has an effect of the same kind as
 * the difference: a hook that applies a status explains a `status` difference, one that attacks
 * explains `hits` and `kills`, and so on. A difference no fired hook can account for is still a
 * surprise. The one thing this accepts is that a real card bug hidden under a firmware effect of the
 * same kind in the same play would be filed as explained; the report keeps a count, so it is visible.
 */
import { GetProgramData } from '../../../engine/data/programRegistry';
import type { IBattleEntity, IBattleState } from '../../../engine/types';
import type { Difference } from './compare';
import type { PlayRecord } from './outcome';
import { hookById, hooksOfOwner, type IndexedHook } from './hookIndex';

/** Which prediction keys an effect of each hook-action type can change. */
const KEYS_BY_ACTION: Readonly<Record<string, ReadonlyArray<string>>> = {
    STATUS: ['status', 'self'],
    ATTACK: ['hits', 'kills'],
    DRAW: ['draw'],
    ENERGY: ['energy'],
    GENERATE_CARD: ['created'],
};

export interface Explanation {
    readonly explained: ReadonlyArray<Difference>;
    readonly unexplained: ReadonlyArray<Difference>;
    /** The firmware, Aura or Driver names that fired and account for the explained differences. */
    readonly by: ReadonlyArray<string>;
}

function hooksCarriedBy(unit: IBattleEntity): IndexedHook[] {
    const carried = new Map<string, IndexedHook>();
    const add = (hook: IndexedHook | undefined) => { if (hook) carried.set(hook.id, hook); };
    for (const id of unit.hooks ?? []) add(hookById(id));
    if (unit.activeOS) for (const hook of hooksOfOwner(unit.activeOS)) add(hook);
    for (const daemon of unit.daemons ?? []) for (const id of GetProgramData(daemon.dataId)?.hooks ?? []) add(hookById(id));
    return [...carried.values()];
}

/** A hook's log line as a pattern: its `{owner}`, `{target}` and `{source}` stand for any name. */
function logPattern(text: string): RegExp {
    const escaped = text.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(owner|target|source)\}/g, '.+?');
    return new RegExp(`^${escaped}$`);
}

function addedLogLines(before: IBattleState, after: IBattleState): string[] {
    return after.logs.slice(before.logs.length).map((line) => line.trim()).filter((line) => line.length > 0);
}

/** The hooks whose own log line the play added: the ones that demonstrably fired. */
export function firedHooks(play: PlayRecord): IndexedHook[] {
    const lines = addedLogLines(play.before, play.after);
    if (lines.length === 0) return [];
    const fired: IndexedHook[] = [];
    for (const unit of [...play.before.playerParty, ...play.before.enemyParty, ...play.after.playerParty, ...play.after.enemyParty]) {
        for (const hook of hooksCarriedBy(unit)) {
            if (fired.includes(hook)) continue;
            const patterns = hook.actions.filter((a) => a.type === 'LOG' && a.text).map((a) => logPattern(a.text!));
            if (patterns.some((p) => lines.some((line) => p.test(line)))) fired.push(hook);
        }
    }
    return fired;
}

export function explainDifferences(play: PlayRecord, differences: ReadonlyArray<Difference>): Explanation {
    const fired = firedHooks(play);
    const explained: Difference[] = [];
    const unexplained: Difference[] = [];
    const by = new Set<string>();
    for (const difference of differences) {
        const causes = fired.filter((hook) => hook.actions.some((a) => KEYS_BY_ACTION[a.type]?.includes(difference.key)));
        if (causes.length === 0) { unexplained.push(difference); continue; }
        explained.push(difference);
        for (const cause of causes) by.add(cause.ownerName);
    }
    return { explained, unexplained, by: [...by] };
}
