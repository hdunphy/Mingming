// @vitest-environment jsdom
/**
 * THE FIRST CLICK A PLAYER EVER MAKES.
 *
 * Reported 2026-08-24: *"I tried to run it and the buttons don't do anything."* They did — the
 * starter cards dispatched `addBlueprint` exactly as written. What did nothing was the screen:
 * `App` chose the picker on `roster.length === 0`, and a blueprint is not a roster member, so the
 * picker re-rendered itself identically and quietly stacked another blueprint on every press.
 *
 * That bug was unreachable from the test suite as it stood. Every other UI test in this repo uses
 * `renderToStaticMarkup`, which runs no effects and cannot click — a soft-lock is *precisely* the
 * class of defect a one-frame static render cannot see, because the frame it renders is correct.
 * Ticket 58 made the jsdom + `createRoot` + dispatched-`MouseEvent` harness this file first borrowed
 * from `App.errorBoundary.test.tsx` a shared module, `testing/interaction`; the click-level walk of
 * the whole loop is `App.loop.test.tsx`. What stays here is the picker's GATE — the four states it
 * must and must not appear in.
 *
 * The assertion is deliberately about the *transition*, not about `state.game.blueprints`. A unit
 * test on the reducer would have passed all along.
 */

import { describe, expect, it } from 'vitest';

import { addBlueprint, addToRoster } from './ui/store/gameSlice';
import { createRanchMember } from './engine/gameTypes';
import { click, makeStore, mountApp, pressKey } from './testing/interaction';
import { GetMingmingData } from './engine/data/mingmingRegistry';
import { getOSBehavior } from './engine/data/firmwareRegistry';

/** The starter cards are `motion.div`s, not buttons, so they are found by their test id. */
function starterCard(host: HTMLElement, name: string): HTMLElement {
    // TICKET 172: the card no longer prints a "starter card"; it is found by its test id.
    const card = host.querySelector<HTMLElement>(`[data-testid="starter-${name.toLowerCase()}"]`);
    if (!card) throw new Error(`no starter card for ${name}`);
    return card;
}

describe('the starter picker', () => {
    it('is what a brand-new save opens on', async () => {
        const host = await mountApp(makeStore());
        expect(host.textContent).toContain('Choose your starter');
    });

    it('shows each starter\'s two firmware, as the assembly bay will, and no alpha "starter card"', async () => {
        // TICKET 172 — Henry: "The text here like starter card and the descriptions don't make sense."
        const host = await mountApp(makeStore());
        expect(host.textContent).not.toContain('STARTER CARD');
        for (const species of ['kraken', 'fenrir', 'ratatoskr']) {
            const card = starterCard(host, species);
            for (const os of GetMingmingData(species).availableOS) {
                expect(card.textContent).toContain(getOSBehavior(os)!.name);
                expect(card.textContent).toContain(getOSBehavior(os)!.description);
            }
        }
    });

    it('lets go of the screen when a starter is picked, and lands on the Assembly bay', async () => {
        const store = makeStore();
        const host = await mountApp(store);

        await click(starterCard(host, 'KRAKEN'));

        // The regression: this used to still say Choose your starter.
        expect(host.textContent).not.toContain('Choose your starter');
        expect(store.getState().game.blueprints.kraken).toBe(1);
        // And it lands somewhere the blueprint can actually be spent, rather than on Expedition
        // telling the player to go and find it.
        expect(host.textContent).toContain('Assembly bay');
    });

    it('does not come back for a player who holds a blueprint but has assembled nothing', async () => {
        // The exact state the old gate mis-read: this is a player mid-first-session, not a new one.
        const store = makeStore();
        store.dispatch(addBlueprint('fenrir'));
        const host = await mountApp(store);
        expect(host.textContent).not.toContain('Choose your starter');
    });

    it('does not come back for a player with a roster and no blueprints left', async () => {
        const store = makeStore();
        store.dispatch(addToRoster(createRanchMember('ratatoskr')));
        const host = await mountApp(store);
        expect(host.textContent).not.toContain('Choose your starter');
    });

    it('does come back after a wipe — nothing held, nothing built', async () => {
        // `wipeSave` leaves exactly this: the picker is the right thing to show, and the branch
        // reads both halves rather than remembering a "has onboarded" flag that a wipe could miss.
        const host = await mountApp(makeStore());
        expect(host.textContent).toContain('Choose your starter');
    });
});

describe('38 — the first interaction in the game answers a KEYBOARD', () => {
    /*
     * ══ THE BUG THIS FILE COULD NOT SEE, AND WHY. ══
     *
     * A keyboard-only run measured in Chromium got no further than this screen. The starter card is
     * a `motion.div` with an `onClick`; framer-motion's `whileTap` gives it a tabindex of its own,
     * so the Tab ring REACHED it — and Enter did nothing, because a `div` with a click handler has
     * no keyboard semantics.
     *
     * That is the worst of the three states. Not focusable is at least honest; reachable-but-inert
     * puts a focus ring on something that refuses to answer, on the first screen of the game.
     *
     * **Every case above dispatches `click`, which a `div` answers to perfectly well** — so this
     * whole file was green while the game could not be started without a mouse. And **axe could not
     * have caught it either**: it reads an element's properties, and the element had a tabindex.
     * Whether Enter does anything is behaviour, which is why ticket 38's done-when asks for a
     * keyboard RUN and not only a scan.
     */
    it('starts the game on Enter, not only on a click', async () => {
        const store = makeStore();
        const host = await mountApp(store);
        await pressKey(starterCard(host, 'KRAKEN'), 'Enter');
        expect(host.textContent).not.toContain('Choose your starter');
    });

    it('starts the game on Space too, because that is what a button answers to', async () => {
        // A player who has tabbed to a card will try whichever of the two they habitually use, and
        // a real `<button>` takes both. Half a fix here would be a coin flip for the player.
        const store = makeStore();
        const host = await mountApp(store);
        await pressKey(starterCard(host, 'FENRIR'), ' ');
        expect(host.textContent).not.toContain('Choose your starter');
    });

    it('announces itself as a button, so the focus ring is a promise it can keep', async () => {
        // `role` and `tabIndex` are what make the Tab stop legible; the handler above is what makes
        // it true. Both are asserted, because either alone is the broken state.
        const store = makeStore();
        const host = await mountApp(store);
        const card = starterCard(host, 'RATATOSKR');
        expect(card.getAttribute('role')).toBe('button');
        expect(card.getAttribute('tabindex')).toBe('0');
        expect(card.getAttribute('aria-label')).toMatch(/Ratatoskr/i);
    });
});
