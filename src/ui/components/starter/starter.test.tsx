// @vitest-environment jsdom
/**
 * TICKET 183f — the starter cards: the real `CardFace`, the monster's three stats where a card
 * prints its rules, and a button the keyboard can use without help.
 */
import { describe, expect, it } from 'vitest';

import MainMenuView from '../MainMenuView';
import { GetMingmingData } from '../../../engine/data/mingmingRegistry';
import { makeStore, mount, click } from '../../../testing/interaction';
import { STARTER_STAT_SCALE, starterStats } from './starterStats';

const IDS = ['kraken', 'fenrir', 'ratatoskr'] as const;

describe('183f the starter cards', () => {
    it('are three card faces, one button each, in the element\'s colour', async () => {
        const host = await mount(makeStore(), <MainMenuView />);
        for (const id of IDS) {
            const card = host.querySelector<HTMLElement>(`[data-testid="starter-${id}"]`)!;
            expect(card.tagName).toBe('BUTTON');
            expect(card.className).toContain('rs-card');
            expect(card.querySelector('.rs-body .rs-hd')).not.toBeNull();
            expect(card.querySelector('.rs-elbar')).not.toBeNull();
            expect(card.style.getPropertyValue('--el')).not.toBe('');
        }
    });

    it('print HP, Attack and Defense where the rules text goes, and no firmware text', async () => {
        const host = await mount(makeStore(), <MainMenuView />);
        for (const id of IDS) {
            const card = host.querySelector<HTMLElement>(`[data-testid="starter-${id}"]`)!;
            expect(card.querySelector('.rs-desc')).toBeNull();
            const rows = [...card.querySelectorAll('.starter-stat')];
            expect(rows.map((row) => row.getAttribute('data-stat'))).toEqual(['hp', 'attack', 'defense']);
            const base = GetMingmingData(id).baseStats;
            expect(rows.map((row) => row.querySelector('.starter-stat-value')!.textContent))
                .toEqual([String(base.hp), String(base.attack), String(base.defense)]);
            expect(card.textContent).not.toMatch(/firmware|_OS\b|_SYS\b|KERNEL/i);
        }
    });

    it('draw every bar inside its track', () => {
        for (const id of IDS) {
            for (const stat of starterStats(id)) {
                expect(stat.value).toBeGreaterThan(0);
                expect(stat.value).toBeLessThan(STARTER_STAT_SCALE);
            }
        }
    });

    it('answer a click, and are reachable by keyboard because they are buttons', async () => {
        const store = makeStore();
        const host = await mount(store, <MainMenuView />);
        const card = host.querySelector<HTMLElement>('[data-testid="starter-fenrir"]')!;
        expect(card.getAttribute('type')).toBe('button');
        expect(card.tabIndex).toBe(0);
        await click(card);
        // A new save has not played the intro, so a pick builds the starter and starts it.
        expect(store.getState().game.roster.map((m) => m.definitionId)).toEqual(['fenrir']);
        expect(store.getState().run.run).not.toBeNull();
    });
});
