/**
 * The onboarding strip — ticket 24.
 *
 * `renderToStaticMarkup`, the shape every UI test in this repo uses (no `@testing-library/react`;
 * a lockfile change is forbidden). That decides what this file can and cannot claim:
 *
 * - **Can:** the strip renders the tip it was handed, renders nothing when handed `null`, offers
 *   both exits, and is announced to a screen reader.
 * - **Cannot:** that clicking "Got it" advances to the next tip. No effects run and no event can be
 *   dispatched, so the closest honest test is the reducer (`gameSlice.test.ts`, "records a tip once
 *   and never twice") plus the selector (`engine/tips.test.ts`, the whole sequence). Between them
 *   the only untested link is the `onClick` line itself.
 */

import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import Callout from './Callout';
import { RANCH_BLUEPRINT_TIP, TIP_REGISTRY } from '../../engine/tips';
import battleReducer from '../store/battleSlice';
import gameReducer from '../store/gameSlice';
import runReducer from '../store/runSlice';

function render(node: React.ReactNode): string {
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    return renderToStaticMarkup(<Provider store={store}>{node}</Provider>);
}

describe('Callout', () => {
    it('renders the tip it is handed, with both exits', () => {
        const markup = render(<Callout tip={RANCH_BLUEPRINT_TIP} />);

        expect(markup).toContain(RANCH_BLUEPRINT_TIP.title);
        expect(markup).toContain('Got it');
        expect(markup).toContain('Skip tips');
    });

    it('renders nothing at all for a null tip', () => {
        // Callers pass `nextBattleTip(...)` straight in, so `null` is the ordinary case — the one
        // that holds for the whole game after onboarding is over. It must not leave an empty box.
        expect(render(<Callout tip={null} />)).toBe('');
    });

    it('is announced rather than silently drawn', () => {
        const markup = render(<Callout tip={RANCH_BLUEPRINT_TIP} />);
        expect(markup).toContain('role="note"');
        expect(markup).toContain(`aria-label="Tip: ${RANCH_BLUEPRINT_TIP.title}"`);
    });

    it('carries the placement class the caller asked for', () => {
        // The battle strip is absolutely positioned so it costs the console none of the 30px of
        // vertical slack ticket 22 measured; the panel one sits in the flow. That is the only
        // difference between them, and it is a class name.
        expect(render(<Callout tip={RANCH_BLUEPRINT_TIP} placement="battle" />)).toContain('callout-battle');
        expect(render(<Callout tip={RANCH_BLUEPRINT_TIP} />)).toContain('callout-panel');
    });

    it('never prints a power figure at the player', () => {
        // The standing law, held at the surface that renders the copy as well as at the copy
        // itself (`tips.test.ts`) — ticket 22's lesson was that a law tested in one layer can be
        // false in the layer that actually reaches the screen.
        for (const tip of TIP_REGISTRY.values()) {
            expect(render(<Callout tip={tip} />)).not.toMatch(/power/i);
        }
    });
});
