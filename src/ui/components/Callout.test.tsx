// @vitest-environment jsdom
/**
 * The tip toast — ticket 24, turned from a panel into a toast by ticket 182a.
 *
 * It is one line, it has no buttons, and it goes away by itself (a few seconds) or on the next
 * click. It still marks its tip seen, once ever, so the lesson does not come back. "Skip tips" is
 * gone with the buttons: a toast does not need skipping.
 */

import { act } from 'react';
import { useSelector } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';

import Callout, { TOAST_MS } from './Callout';
import { TIP_REGISTRY, RANCH_BLUEPRINT_TIP, type Tip } from '../../engine/tips';
import type { RootState } from '../store/store';
import { makeStore, mount } from '../../testing/interaction';

const types = TIP_REGISTRY.get('map:types')!;
const gym = TIP_REGISTRY.get('map:gym')!;

function staticRender(tip: Tip | null): string {
    return renderToStaticMarkup(<Provider store={makeStore()}><Callout tip={tip} /></Provider>);
}

/** Hands the toast "the first of these tips the save has not seen", as the screens do. */
function Harness({ tips }: { tips: ReadonlyArray<Tip> }) {
    const seen = useSelector((s: RootState) => s.game.seenTips);
    return <Callout tip={tips.find((t) => !seen.includes(t.id)) ?? null} />;
}

describe('Callout (the tip toast)', () => {
    it('renders the tip as one line, with no buttons and no heading', () => {
        const markup = staticRender(RANCH_BLUEPRINT_TIP);
        expect(markup).toContain(RANCH_BLUEPRINT_TIP.body);
        expect(markup).not.toContain('Got it');
        expect(markup).not.toContain('Skip tips');
        expect(markup).not.toContain('<button');
        expect(markup).not.toContain('<h4');
    });

    it('is not a <p>, so a toast never counts against a screen\'s copy budget', () => {
        expect(staticRender(RANCH_BLUEPRINT_TIP)).not.toContain('<p');
    });

    it('renders nothing at all for a null tip', () => {
        expect(staticRender(null)).toBe('');
    });

    it('is announced rather than silently drawn', () => {
        const markup = staticRender(RANCH_BLUEPRINT_TIP);
        expect(markup).toContain('role="status"');
        expect(markup).toContain(`aria-label="Tip: ${RANCH_BLUEPRINT_TIP.title}"`);
    });

    it('carries the placement class the caller asked for', () => {
        const withPlacement = (placement: 'battle' | 'panel') =>
            renderToStaticMarkup(
                <Provider store={makeStore()}><Callout tip={RANCH_BLUEPRINT_TIP} placement={placement} /></Provider>,
            );
        expect(withPlacement('battle')).toContain('callout-battle');
        expect(withPlacement('panel')).toContain('callout-panel');
    });

    it('never prints a power figure at the player', () => {
        for (const tip of TIP_REGISTRY.values()) expect(staticRender(tip)).not.toMatch(/power/i);
    });

    describe('over time', () => {
        beforeEach(() => { vi.useFakeTimers(); });
        afterEach(() => { vi.useRealTimers(); });

        it('marks its tip seen the moment it shows, and goes away on its own', async () => {
            const store = makeStore();
            const host = await mount(store, <Harness tips={[types]} />);

            expect(host.textContent).toContain(types.body);
            expect(store.getState().game.seenTips).toContain(types.id);

            await act(async () => { vi.advanceTimersByTime(TOAST_MS + 50); });
            expect(host.textContent).not.toContain(types.body);
        });

        it('goes away on the next click', async () => {
            const store = makeStore();
            const host = await mount(store, <Harness tips={[types]} />);
            expect(host.textContent).toContain(types.body);

            await act(async () => {
                document.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
            });
            expect(host.textContent).not.toContain(types.body);
        });

        it('shows one at a time: the next tip waits until the first has gone', async () => {
            const store = makeStore();
            const host = await mount(store, <Harness tips={[types, gym]} />);

            // The first is marked seen on show, so the parent now offers the second; the toast
            // keeps the first on screen until it has gone.
            expect(host.textContent).toContain(types.body);
            expect(host.textContent).not.toContain(gym.body);

            await act(async () => { vi.advanceTimersByTime(TOAST_MS + 50); });
            expect(host.textContent).toContain(gym.body);
            expect(store.getState().game.seenTips).toEqual(expect.arrayContaining([types.id, gym.id]));
        });
    });
});
