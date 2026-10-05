/**
 * TICKET 195f — THE LINE UNDER AN EVENT OPTION, WITH ITS DEBUFF EXPLAINED.
 *
 * An option's `detail` in `events.json` names a next-fight debuff in the player's words ("+50 scrap. Static
 * Haze next fight."). That is a name and no rule, so the player cannot weigh it. This reads the rule from the
 * debuff's own definition (`describeDriver`, the hook text the fight runs) and puts it after the name:
 * "Static Haze next fight: At the start of your first turn, each member gains 2 Weakened." The game's event
 * screen and the playtest tool both print this, so the two say the same sentence.
 */
import { describeDriver } from '../../data/driverRegistry';
import type { EventChoice, EventOutcome } from './eventSchema';

/** Every next-fight debuff an outcome list hands out, a gamble's branches included, each once. */
function tempDriverIds(outcomes: ReadonlyArray<EventOutcome>, into: string[] = []): string[] {
    for (const outcome of outcomes) {
        if (outcome.type === 'TEMP_DRIVER') { if (!into.includes(outcome.driverId)) into.push(outcome.driverId); }
        else if (outcome.type === 'GAMBLE') tempDriverIds([...outcome.win, ...outcome.lose], into);
    }
    return into;
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const titleCase = (text: string): string => text.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** The detail line of a choice: as the data wrote it, with each next-fight debuff's rule text after its name. */
export function choiceDetail(choice: EventChoice): string {
    let detail = choice.detail;
    for (const driverId of tempDriverIds(choice.outcomes)) {
        const { name, description } = describeDriver(driverId);
        if (description === '') continue;
        const named = new RegExp(`${escapeRegExp(name)} next fight\\.?`, 'i');
        const clause = `${titleCase(name)} next fight: ${description}`;
        detail = named.test(detail) ? detail.replace(named, clause) : `${detail}${detail === '' || detail.endsWith(' ') ? '' : ' '}${clause}`;
    }
    return detail;
}
