/**
 * TICKET 180e — THE RUN'S OWN INVARIANTS.
 *
 * The run state must still satisfy the schema the save system parses it with (`RunStateSchema`), and
 * no card instance id may appear twice among the cards the player owns (deck and collection).
 */
import { RunStateSchema, type IRunState } from '../../../engine/runTypes';
import type { Violation } from './violations';

export function runInvariants(run: IRunState): Violation[] {
    const found: Violation[] = [];
    const parsed = RunStateSchema.safeParse(run);
    if (!parsed.success) {
        const issues = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || '(run)'}: ${i.message}`);
        found.push({ name: 'run-schema', detail: `the run no longer parses as a RunState (${issues.join('; ')})` });
    }
    const seen = new Set<string>();
    for (const card of [...run.deck, ...(run.collection ?? [])]) {
        if (seen.has(card.instanceId)) found.push({ name: 'duplicate-card-id', detail: `card instance ${card.instanceId} (${card.dataId}) appears twice among the owned cards` });
        seen.add(card.instanceId);
    }
    return found;
}
