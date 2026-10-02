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
import { click, findText, makeStore, mountApp } from './testing/interaction';
import { GetMingmingData } from './engine/data/mingmingRegistry';

/** The starter cards are found by their test id. */
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

    it('shows each starter\'s three stats, in the slot a card keeps for its rules, and no alpha "starter card"', async () => {
        // TICKET 172 — Henry: "The text here like starter card and the descriptions don't make sense."
        // TICKET 183f: the card is a `CardFace` with the species' three stats; the instincts are
        // chosen at the Summon bay, not here (182c cut their text from the picker).
        const host = await mountApp(makeStore());
        expect(host.textContent).not.toContain('STARTER CARD');
        for (const species of ['kraken', 'fenrir', 'ratatoskr']) {
            const card = starterCard(host, species);
            expect(card.textContent).toContain(GetMingmingData(species).name);
            const stats = [...card.querySelectorAll('[data-stat]')].map((el) => el.getAttribute('data-stat'));
            expect(stats).toHaveLength(3);
        }
    });

    it('lets go of the screen when a starter is picked, and lands on the Summon bay', async () => {
        const store = makeStore();
        const host = await mountApp(store);

        // TICKET 182d: a new save plays the intro first (App.intro.test.tsx); this is the other path.
        await click(findText(host, 'Skip intro', 'label').querySelector('input')!);
        await click(starterCard(host, 'KRAKEN'));

        // The regression: this used to still say Choose your starter.
        expect(host.textContent).not.toContain('Choose your starter');
        expect(store.getState().game.blueprints.kraken).toBe(1);
        // And it lands somewhere the blueprint can actually be spent, rather than on Expedition
        // telling the player to go and find it.
        expect(host.textContent).toContain('Summon bay');
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
    it('is a real button, so Enter and Space start the game in a browser', async () => {
        // Chromium turns Enter and Space on a focused `<button>` into a click; jsdom does not, so the
        // test asserts the element is one (and reachable by Tab) and the click it answers to is
        // covered by 'lets go of the screen when a starter is picked' above.
        const host = await mountApp(makeStore());
        for (const species of ['kraken', 'fenrir', 'ratatoskr']) {
            const card = starterCard(host, species);
            expect(card.tagName).toBe('BUTTON');
            expect(card.getAttribute('type')).toBe('button');
            expect(card.hasAttribute('disabled')).toBe(false);
            expect(card.getAttribute('tabindex')).not.toBe('-1');
        }
    });

    it('names itself for a screen reader', async () => {
        const host = await mountApp(makeStore());
        expect(starterCard(host, 'RATATOSKR').getAttribute('aria-label')).toMatch(/Ratatoskr/i);
    });
});
