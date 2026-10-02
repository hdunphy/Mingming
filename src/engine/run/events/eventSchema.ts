/**
 * TICKET 168a — the shape of `data/events.json`, checked at load.
 *
 * An event is DATA: a name, a line of fiction, and a list of choices, each of which is a list of
 * OUTCOMES. The engine knows what an outcome means (`ui/events/applyOutcome.ts` turns one into
 * dispatches), and the file never contains a function, so the twenty events can be read, diffed and
 * re-tuned without touching code. A bad file throws at load rather than showing the player a
 * button that does nothing — the pattern `scenarioSchema.ts` set for the debug toolkit.
 *
 * Costs are outcomes too: a NEGATIVE `SCRAP` is a price, so a choice's cost is derived from its
 * outcomes (`choiceScrapCost`) instead of being a second field that could disagree with them.
 */

import { z } from 'zod';

export const EVENT_RARITIES = ['Common', 'Uncommon', 'Rare'] as const;
export type EventRarity = (typeof EVENT_RARITIES)[number];

/** The two things the power cap counts (ticket 168, rule 5). */
export const EVENT_GRANTS = ['driver', 'patch'] as const;
export type EventGrant = (typeof EVENT_GRANTS)[number];

const CardRarity = z.enum(['Common', 'Uncommon', 'Rare']);

/** Every outcome that is not a gamble. A gamble holds these, one level down and no further. */
const LeafOutcomeSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('SCRAP'), amount: z.number().int() }),
    z.object({ type: z.literal('CARD_PICK'), count: z.number().int().min(1), rarities: z.array(CardRarity).min(1) }),
    z.object({ type: z.literal('UPGRADE'), count: z.number().int().min(1) }),
    z.object({ type: z.literal('BLUEPRINT_PICK'), count: z.number().int().min(1) }),
    z.object({ type: z.literal('MAP_REVEAL') }),
    z.object({ type: z.literal('TEMP_DRIVER'), driverId: z.string().min(1), fights: z.number().int().min(1) }),
    z.object({ type: z.literal('JUNK') }),
    z.object({ type: z.literal('MACRO_PICK'), count: z.number().int().min(1) }),
    z.object({ type: z.literal('TRADE_UP') }),
    z.object({ type: z.literal('DUPLICATE') }),
    z.object({ type: z.literal('TRANSFORM') }),
    z.object({ type: z.literal('RECRUIT') }),
    z.object({ type: z.literal('FIGHT'), scrapMultiplier: z.number().int().min(1) }),
    z.object({ type: z.literal('DRIVER_PICK'), count: z.number().int().min(1) }),
    z.object({ type: z.literal('PATCH') }),
    z.object({ type: z.literal('REFLASH') }),
    z.object({ type: z.literal('GIVE_CARD'), count: z.number().int().min(1), rarity: CardRarity.optional() }),
    z.object({ type: z.literal('GIVE_BLUEPRINT') }),
]);

const GambleSchema = z.object({
    type: z.literal('GAMBLE'),
    /** Percent chance of `win`, printed on the button (rule 8). */
    chance: z.number().int().min(1).max(99),
    win: z.array(LeafOutcomeSchema),
    lose: z.array(LeafOutcomeSchema),
});

export const EventOutcomeSchema = z.union([LeafOutcomeSchema, GambleSchema]);

export const EventChoiceSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    /** One line under the label: what it does, in the player's words. May be empty (Leave). */
    detail: z.string(),
    outcomes: z.array(EventOutcomeSchema),
});

export const EventDefinitionSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    rarity: z.enum(EVENT_RARITIES),
    text: z.string().min(1),
    grants: z.array(z.enum(EVENT_GRANTS)),
    choices: z.array(EventChoiceSchema).min(1),
});

export type EventOutcome = z.infer<typeof EventOutcomeSchema>;
export type EventChoice = z.infer<typeof EventChoiceSchema>;
export type EventDefinition = z.infer<typeof EventDefinitionSchema>;

/** Parse the whole file. Throws (with the path of the fault) on a bad file or a duplicate id. */
export function parseEvents(raw: unknown): ReadonlyArray<EventDefinition> {
    const events = z.array(EventDefinitionSchema).parse(raw);
    const seen = new Set<string>();
    for (const event of events) {
        if (seen.has(event.id)) throw new Error(`events.json: duplicate event id "${event.id}"`);
        seen.add(event.id);
    }
    return events;
}

/** What a choice costs in scrap, read off its outcomes (the negative `SCRAP` ones). */
export function choiceScrapCost(choice: EventChoice): number {
    return choice.outcomes.reduce((total, outcome) => (
        outcome.type === 'SCRAP' && outcome.amount < 0 ? total - outcome.amount : total
    ), 0);
}

/**
 * Which of the power cap's two grants a choice actually makes. Only the CHOICE grants, not the
 * event: the Driver Shrine's Leave grants nothing, so it must not spend the run's one Driver.
 */
export function choiceGrants(choice: EventChoice): EventGrant[] {
    const grants: EventGrant[] = [];
    if (choice.outcomes.some((outcome) => outcome.type === 'DRIVER_PICK')) grants.push('driver');
    if (choice.outcomes.some((outcome) => outcome.type === 'PATCH')) grants.push('patch');
    return grants;
}
