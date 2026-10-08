/**
 * TICKET 195f — an event option that hands out a next-fight debuff says what the debuff does.
 *
 * "Gjöll Chill next fight." and "Barrow Mist next fight." told the player a name and nothing else
 * (sonnet, twice: "'Gjöll Chill' is not explained", "Barrow Mist did not visibly do anything"). The
 * clause is read from the debuff's own definition, never written by hand, so it cannot drift from what the
 * fight does.
 */
import { describe, expect, it } from 'vitest';

import { describeDriver } from '../../data/driverRegistry';
import { EVENTS } from './eventCatalogue';
import { choiceDetail } from './eventDetail';
import type { EventChoice, EventOutcome } from './eventSchema';

const tempDriversOf = (outcomes: ReadonlyArray<EventOutcome>): string[] =>
    outcomes.flatMap((o) => (o.type === 'TEMP_DRIVER' ? [o.driverId] : o.type === 'GAMBLE' ? tempDriversOf([...o.win, ...o.lose]) : []));

const withDebuff: Array<{ event: string; choice: EventChoice; drivers: string[] }> = EVENTS.flatMap((event) =>
    event.choices.flatMap((choice) => {
        const drivers = tempDriversOf(choice.outcomes);
        return drivers.length > 0 ? [{ event: event.id, choice, drivers }] : [];
    }));

describe('195f — choiceDetail', () => {
    it('finds the events that hand out a debuff (the premise: there are some)', () => {
        expect(withDebuff.length).toBeGreaterThanOrEqual(2);
        expect(withDebuff.map((w) => w.event)).toEqual(expect.arrayContaining(['scrap_cache', 'corrupted_stream']));
    });

    it.each(withDebuff.map((w) => [`${w.event}/${w.choice.id}`, w] as const))('%s carries the debuff\'s own rule text', (_name, w) => {
        const detail = choiceDetail(w.choice);
        for (const id of w.drivers) {
            const { name, description } = describeDriver(id);
            expect(description.length).toBeGreaterThan(10);
            expect(detail).toContain(description);
            expect(detail.toLowerCase()).toContain(name.toLowerCase());
        }
    });

    it('keeps what the detail already said, and says "next fight" once per debuff', () => {
        const dig = EVENTS.find((e) => e.id === 'scrap_cache')!.choices.find((c) => c.id === 'dig')!;
        const detail = choiceDetail(dig);
        expect(detail.startsWith('+50 scrap. ')).toBe(true);
        expect(detail.match(/next fight/g)).toHaveLength(1);
        expect(detail).toBe(`+50 scrap. Barrow Mist next fight: ${describeDriver('driver_static_haze').description}`);
    });

    it('leaves a choice with no debuff exactly as the data wrote it', () => {
        for (const event of EVENTS) {
            for (const choice of event.choices) {
                if (tempDriversOf(choice.outcomes).length === 0) expect(choiceDetail(choice), `${event.id}/${choice.id}`).toBe(choice.detail);
            }
        }
    });

    it('adds the clause even when the detail forgot to name the debuff', () => {
        const bare: EventChoice = { id: 'x', label: 'X', detail: '+5 scrap.', outcomes: [{ type: 'TEMP_DRIVER', driverId: 'driver_frayed_signal', fights: 1 }] };
        expect(choiceDetail(bare)).toBe(`+5 scrap. Gjöll Chill next fight: ${describeDriver('driver_frayed_signal').description}`);
    });
});
