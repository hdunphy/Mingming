// @vitest-environment jsdom
/**
 * TICKET 182a — the ranch and run start, cut to what a player needs.
 *
 * Expedition says one line and shows three gym cards (name, element, three biome names; the
 * field-effect text is a hover). The run starts with "Start run". The Assembly bay says nothing
 * above its list, and the player's very first build, their starter, goes in on its v1 firmware with
 * no firmware modal (R3); later builds keep the modal with v1 picked. The Roster has no paragraph,
 * and the type chart is a small icon button.
 */

import { describe, expect, it } from 'vitest';

import RanchScreen from './RanchScreen';
import { createRanchMember } from '../../engine/gameTypes';
import { addBlueprint, addToRoster } from '../store/gameSlice';
import { click, clickText, findText, makeStore, mount } from '../../testing/interaction';

type Section = 'expedition' | 'roster' | 'assembly';

async function ranch(section: Section, setup: (store: ReturnType<typeof makeStore>) => void = () => {}) {
    const store = makeStore();
    setup(store);
    const host = await mount(store, <RanchScreen initialSection={section} />);
    return { store, host };
}

const withKraken = (store: ReturnType<typeof makeStore>): void => {
    store.dispatch(addToRoster(createRanchMember('kraken', 'kraken_v1')));
};

describe('Expedition (182a)', () => {
    it('says one line, not two paragraphs', async () => {
        const { host } = await ranch('expedition', withKraken);
        const paragraphs = [...host.querySelectorAll('p')].map((p) => p.textContent?.trim());
        expect(paragraphs).toEqual(['Beat the gym leader at the end of the road.']);
        expect(host.textContent).not.toContain('Three leaders');
        expect(host.textContent).not.toContain('One wild in three');
    });

    it('has no "Standard — The game as it is." label', async () => {
        const { host } = await ranch('expedition', withKraken);
        expect(host.textContent).not.toContain('The game as it is');
        expect(host.textContent).not.toMatch(/Standard/);
    });

    it('gym cards show name, element and three biome names; the field-effect text is a hover', async () => {
        const { host } = await ranch('expedition', withKraken);
        const cards = [...host.querySelectorAll<HTMLElement>('.ranch-offer')];
        expect(cards).toHaveLength(3);
        for (const card of cards) {
            expect(card.querySelector('.ranch-offer-name')?.textContent?.length).toBeGreaterThan(0);
            expect(card.querySelector('.ranch-offer-meta')?.textContent).toMatch(/^(Fire|Water|Nature) gym$/);
            expect(card.querySelectorAll('li')).toHaveLength(3);
            // Not on the card face...
            expect(card.textContent).not.toContain('Rivals field');
            expect(card.querySelector('.ranch-offer-signature')).toBeNull();
            // ...but still one hover away.
            expect(card.getAttribute('title')?.length ?? 0).toBeGreaterThan(20);
        }
    });

    it('the run starts with "Start run", not "Begin run — 1 member, 8 cards"', async () => {
        const { host } = await ranch('expedition', withKraken);
        await click(host.querySelector('.ranch-offer')!);
        await click(host.querySelector('.ranch-roster-grid button')!);
        const start = findText(host, 'Start run');
        expect(start.textContent?.trim()).toBe('Start run');
        expect(host.textContent).not.toContain('Begin run');
    });
});

describe('Assembly (182a)', () => {
    const holdingKraken = (store: ReturnType<typeof makeStore>): void => {
        store.dispatch(addBlueprint('kraken'));
    };

    it('opens with its list, not the "Assembly costs one blueprint" paragraph', async () => {
        const { host } = await ranch('assembly', holdingKraken);
        expect(host.textContent).not.toContain('Assembly costs');
        expect(host.textContent).not.toContain('Re-assembly is the re-roll');
        expect(host.querySelectorAll('p')).toHaveLength(0);
    });

    it('builds the starter on its v1 firmware at once, with no firmware modal', async () => {
        const { store, host } = await ranch('assembly', holdingKraken);
        await clickText(host, 'Assemble (1 blueprint)');
        expect(host.querySelector('[role="dialog"]')).toBeNull();
        const { roster, blueprints } = store.getState().game;
        expect(roster).toHaveLength(1);
        expect(roster[0].activeOS).toBe('kraken_v1');
        expect(blueprints.kraken).toBeUndefined();
    });

    it('a later build keeps the firmware choice, with v1 picked by default', async () => {
        const { store, host } = await ranch('assembly', (s) => { withKraken(s); holdingKraken(s); });
        await clickText(host, 'Assemble (1 blueprint)');
        const dialog = host.querySelector('[role="dialog"]')!;
        expect(dialog).not.toBeNull();
        const options = [...dialog.querySelectorAll<HTMLElement>('.ranch-os-option')];
        expect(options.map((o) => o.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
        await clickText(host, 'Spend blueprint');
        expect(store.getState().game.roster).toHaveLength(2);
        expect(store.getState().game.roster[1].activeOS).toBe('kraken_v1');
    });
});

describe('Roster (182a)', () => {
    it('has no paragraph about everything you have ever assembled', async () => {
        const { host } = await ranch('roster', withKraken);
        expect(host.textContent).not.toContain('Everything you have ever assembled');
        expect(host.textContent).not.toContain('The party is chosen at run start');
        expect(host.querySelectorAll('p')).toHaveLength(0);
    });

    it('the type chart is a small icon button', async () => {
        const { host } = await ranch('roster', withKraken);
        const toggle = host.querySelector<HTMLElement>('.type-chart-toggle')!;
        expect(toggle.getAttribute('aria-label')).toBe('Type chart');
        expect(toggle.textContent).not.toMatch(/TYPE CHART/i);
        expect(toggle.textContent?.trim().length).toBeLessThanOrEqual(3);
    });
});
