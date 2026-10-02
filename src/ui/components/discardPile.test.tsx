// @vitest-environment jsdom
/**
 * The discard viewer — Henry, 2026-09-25: "You should be able to see your cards when you click on
 * discard if you need to see what the last card did."
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import DiscardPileViewer from './DiscardPileViewer';
import { discardRows } from './discardPile';
import type { ProgramEntity } from '../../engine/types';

const card = (id: string, dataId: string): ProgramEntity =>
    ({ id, dataId, currentCost: 0, isPlayable: true }) as ProgramEntity;

describe('discardRows', () => {
    it('lists the LAST card in first — the question is "what did I just play"', () => {
        const rows = discardRows([card('a', 'ember_jab'), card('b', 'ignite'), card('c', 'cinder_lance')]);
        expect(rows.map((r) => r.name)).toEqual(['Cinder Lance', 'Ignite', 'Ember Jab']);
    });

    it('keeps two copies of a card as two rows, with their own keys and real text', () => {
        const rows = discardRows([card('t1', 'tackle'), card('t2', 'tackle')]);
        expect(rows.map((r) => r.id)).toEqual(['t2', 't1']);
        expect(rows[0]).toMatchObject({ name: 'Tackle', description: '12 power.', cost: 0 });
    });

    it('does not reorder the pile it was handed', () => {
        const pile = [card('a', 'ember_jab'), card('b', 'ignite')];
        discardRows(pile);
        expect(pile.map((c) => c.id)).toEqual(['a', 'b']);
    });
});

describe('DiscardPileViewer', () => {
    it('wraps the pile face in a button and starts closed', () => {
        const markup = renderToStaticMarkup(
            <DiscardPileViewer discard={[card('a', 'ember_jab')]}><span className="pile-stack">1</span></DiscardPileViewer>,
        );
        expect(markup).toContain('dpv-toggle');
        expect(markup).toContain('aria-expanded="false"');
        expect(markup).toContain('pile-stack');
        expect(markup).not.toContain('dpv-list');
    });
});

describe('DiscardPileViewer - Escape belongs to the list while it is open (09-26 review)', () => {
    it('closes on Escape and the battle never sees the key', async () => {
        const { act } = await import('react');
        const { createRoot } = await import('react-dom/client');
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        const host = document.createElement('div');
        document.body.appendChild(host);
        const root = createRoot(host);
        await act(async () => {
            root.render(<DiscardPileViewer discard={[card('a', 'ember_jab')]}><span>pile</span></DiscardPileViewer>);
        });
        // A stand-in for BattleArena's window listener, registered the way it registers.
        let battleSawEscape = false;
        const battle = (e: KeyboardEvent) => { if (e.key === 'Escape') battleSawEscape = true; };
        window.addEventListener('keydown', battle);

        await act(async () => { host.querySelector<HTMLButtonElement>('.dpv-toggle')!.click(); });
        expect(host.querySelector('.dpv-list')).not.toBeNull();
        await act(async () => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
        expect(host.querySelector('.dpv-list')).toBeNull();
        expect(battleSawEscape).toBe(false);

        // Closed, the list claims nothing: Escape reaches the battle as before.
        await act(async () => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
        expect(battleSawEscape).toBe(true);

        window.removeEventListener('keydown', battle);
        await act(async () => { root.unmount(); });
        host.remove();
    });
});
