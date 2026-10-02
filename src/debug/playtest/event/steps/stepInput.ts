/** TICKET 180c — what every event step is handed, so each step module stays a plain function. */
import type { EventContext } from '../../../../engine/run/events/eventContext';
import type { EventOutcome } from '../../../../engine/run/events/eventSchema';
import type { EventFlow } from '../../types';
import type { OutcomePick } from '../../../../ui/events/outcomePicks';
import type { World } from '../../types';

export interface StepInput {
    readonly world: World;
    readonly ctx: EventContext;
    readonly flow: EventFlow;
    readonly outcome: EventOutcome;
    /** The `choiceId:outcomeIndex` the offers are drawn under, so a step offers the same things every time. */
    readonly slot: string;
    /** Answer this step. */
    readonly take: (pick: OutcomePick) => void;
}
