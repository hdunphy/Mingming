/**
 * TICKET 168d/168e — the step of an event that asks the player a question, one outcome at a time.
 *
 * A choice can carry several questions ("offer two cards", then "pick a Driver"); the event screen
 * walks them in order and this picks the small screen for the one it is on. Nothing here dispatches:
 * each screen hands back its answer and `EventNode` applies the whole choice at the end.
 */

import type { ReactNode } from 'react';

import type { EventContext } from '../../engine/run/events/eventContext';
import { offerBlueprints } from '../../engine/run/events/eventBlueprints';
import { offerDrivers } from '../../engine/run/events/eventDrivers';
import { offerMacros } from '../../engine/run/events/eventMacros';
import type { EventOutcome } from '../../engine/run/events/eventSchema';
import type { IRunState } from '../../engine/runTypes';
import type { OutcomePick } from '../events/outcomePicks';
import EventBlueprintPick from './EventBlueprintPick';
import EventCardPicker from './EventCardPicker';
import EventDriverPick from './EventDriverPick';
import EventGiveBlueprint from './EventGiveBlueprint';
import EventMacroPick from './EventMacroPick';
import EventPatchPick from './EventPatchPick';
import EventReflashPick from './EventReflashPick';
import EventRecruitPick from './EventRecruitPick';

export interface EventPickStepProps {
    readonly outcome: EventOutcome;
    /** `choiceId:outcomeIndex`, so two questions in one event draw from separate seeds. */
    readonly slot: string;
    readonly ctx: EventContext;
    readonly run: IRunState;
    readonly onTake: (answer: OutcomePick) => void;
    readonly onBack: () => void;
}

/** The question screen for an outcome, or `null` for one that asks nothing (or is not a question EventNode owns). */
export default function EventPickStep({ outcome, slot, ctx, run, onTake, onBack }: EventPickStepProps): ReactNode {
    switch (outcome.type) {
        case 'BLUEPRINT_PICK':
            return <EventBlueprintPick species={offerBlueprints(ctx, outcome.count, slot)} onTake={onTake} onBack={onBack} />;
        case 'MACRO_PICK':
            return <EventMacroPick choices={offerMacros(ctx, outcome.count, slot)} rack={run.macros} onTake={onTake} onBack={onBack} />;
        case 'RECRUIT':
            return <EventRecruitPick run={run} onTake={onTake} onBack={onBack} />;
        case 'GIVE_CARD':
            return <EventCardPicker ctx={ctx} mode="give" count={outcome.count} rarity={outcome.rarity} onTake={onTake} onBack={onBack} />;
        case 'TRADE_UP':
            return <EventCardPicker ctx={ctx} mode="trade" count={1} onTake={onTake} onBack={onBack} />;
        case 'TRANSFORM':
            return <EventCardPicker ctx={ctx} mode="recompile" count={1} onTake={onTake} onBack={onBack} />;
        case 'DUPLICATE':
            return <EventCardPicker ctx={ctx} mode="copy" count={1} onTake={onTake} onBack={onBack} />;
        case 'GIVE_BLUEPRINT':
            return <EventGiveBlueprint blueprints={ctx.ranch.blueprints} onTake={onTake} onBack={onBack} />;
        case 'DRIVER_PICK':
            return <EventDriverPick drivers={offerDrivers(ctx, outcome.count, slot)} onTake={onTake} onBack={onBack} />;
        case 'PATCH':
            return <EventPatchPick ctx={ctx} onTake={onTake} onBack={onBack} />;
        case 'REFLASH':
            return <EventReflashPick ctx={ctx} onTake={onTake} onBack={onBack} />;
        default:
            return null;
    }
}
