/**
 * The workshop, rendered — ticket 14.
 *
 * `engine/run/workshop.test.ts` covers the prices and who may be built; `runSlice.workshop.test.ts`
 * covers what the buttons do to the two slices. What is left, and is a different failure, is whether
 * the screen **says** any of it:
 *
 * - **`N/3`, and that this is the only place it moves.** Ticket 06 rules the party grows here and
 *   nowhere else; a player who does not know that has no reason to spend scrap here rather than at
 *   the shop two nodes away, which is the whole route decision the ruling is built around.
 * - **Both halves of the price.** The ranch charges a blueprint alone and this charges a blueprint
 *   plus scrap (Henry, 2026-08-21). A screen printing one number would look like the ranch and
 *   behave differently.
 * - **Why a button is dead** (ticket 20's precedent): the scrap, the blueprint, the party slot or
 *   the species clause, said out loud. A silently inert control is indistinguishable from a bug.
 * - **`power` must not appear at all** (standing law, map § Notes). The cheapest way to break that is
 *   not a price — it is a well-meant "show the card text" patch, since several card descriptions
 *   quote the internal number out loud.
 *
 * Rendered to static markup, the shape the panel tests established: the repo has no
 * `@testing-library/react`, and `renderToStaticMarkup` runs no effects. The firmware picker is
 * reachable through `initialPending` for the same reason `RanchScreen` takes `initialSection` —
 * static markup cannot click, and the picker is where the price is confirmed.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import WorkshopNode, { type WorkshopPending } from './WorkshopNode';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { RECRUIT_KIT_SIZE, createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import {
    WORKSHOP_ASSEMBLY_SCRAP,
    WORKSHOP_REFLASH_SCRAP,
    WORKSHOP_REMOVAL_PRICE,
} from '../../engine/run/workshop';
import { GENERIC_HIT } from '../../engine/data/mingmingRegistry';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import type { IMingmingState } from '../../engine/types';

/** `renderToStaticMarkup` escapes text; several descriptions carry apostrophes. See the twin in
 *  `MarketplaceNode.test.tsx` — comparing raw strings silently skips exactly those cards. */
const escapeHtml = (text: string): string =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
import type { IRanchMember, IRanchState, IRunState } from '../../engine/runTypes';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

const rosterMember = (id: string, definitionId: string, activeOS: string): IRanchMember => ({
    id, definitionId, activeOS, attackIV: 10, defenseIV: 10, hpIV: 10,
});

const ROSTER: IRanchMember[] = [rosterMember('mm1', 'kraken', 'kraken_v1')];

function makeRun(scrap: number, over: Partial<IRunState> = {}): IRunState {
    const run = createRun({
        seed: 'workshop-render-seed',
        offer: offerGyms('offer-seed')[0],
        party: [KRAKEN],
        startedAt: 1_700_000_000_000,
    });
    const workshop = run.nodes.find((n) => n.kind === 'workshop')!;
    return {
        ...run,
        scrap,
        currentNodeId: workshop.id,
        nodes: run.nodes.map((n) => (n.id === workshop.id ? { ...n, visited: n.visited + 1 } : n)),
        ...over,
    };
}

function makeRanch(blueprints: Record<string, number>, roster: IRanchMember[] = ROSTER): IRanchState {
    return { ...createEmptyRanch(), roster, blueprints };
}

function render(run: IRunState, ranch: IRanchState, initialPending?: WorkshopPending): string {
    const store = configureStore({
        reducer: { game: gameReducer, run: runReducer },
        preloadedState: { game: ranch, run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
    return renderToStaticMarkup(
        <Provider store={store}>
            <WorkshopNode run={run} node={node} ranch={ranch} initialPending={initialPending} />
        </Provider>,
    );
}

describe('WorkshopNode — the header', () => {
    it('shows the scrap balance, the party count and the fact that this is where it grows', () => {
        const markup = render(makeRun(140), makeRanch({}));

        expect(markup).toContain('140 scrap');
        expect(markup).toContain('party: 1/3');
        expect(markup).toContain('only place the party grows');
        // Both halves of the price, in the header note, before any button is read.
        expect(markup).toContain(`${WORKSHOP_ASSEMBLY_SCRAP} scrap`);
        expect(markup).toContain('blueprint');
    });

    it('says the recruit brings its whole kit and no filler — the 2026-08-24 ruling', () => {
        // Was "four cards ... and one generic". Henry recruited Ratatoskr into a Fenrir run, got
        // three of his five tagged cards plus a Tackle, and reported *"it felt really bad to play
        // Rat without his kit"*. The screen has to quote the rule it is charging 25 scrap for.
        const markup = render(makeRun(140), makeRanch({}));
        expect(markup).toContain(`${RECRUIT_KIT_SIZE}-card start kit`);
        expect(markup).toContain('no filler');
    });

    it('counts a grown party honestly', () => {
        const run = makeRun(140, { partyIds: ['mm1', 'mm2'] });
        const ranch = makeRanch({}, [...ROSTER, rosterMember('mm2', 'fenrir', 'fenrir_v1')]);
        expect(render(run, ranch)).toContain('party: 2/3');
    });
});

describe('WorkshopNode — assembling', () => {
    it('lists a held blueprint with its count and offers it at both prices', () => {
        const markup = render(makeRun(400), makeRanch({ fenrir: 2 }));

        expect(markup).toContain('Fenrir');
        expect(markup).toContain('blueprints ×2');
        expect(markup).toContain(`Assemble — 1 blueprint + ${WORKSHOP_ASSEMBLY_SCRAP} scrap`);
    });

    it('disables what the player cannot afford AND says what they are short', () => {
        const markup = render(makeRun(10), makeRanch({ fenrir: 1 }));

        expect(markup).toContain('disabled');
        expect(markup).toContain(`Assemble (${WORKSHOP_ASSEMBLY_SCRAP}) — ${WORKSHOP_ASSEMBLY_SCRAP - 10} scrap short`);
        expect(markup).not.toContain(`Assemble — 1 blueprint`);
    });

    it('shows a blueprint the species clause refuses, with the reason rather than not at all', () => {
        // A blueprint you are holding but cannot spend HERE is news, so it is listed with its
        // refusal. The party already fields a kraken; the roster may hold ten.
        const markup = render(makeRun(400), makeRanch({ kraken: 3 }));

        expect(markup).toContain('Kraken');
        expect(markup).toContain('Already on the team');
        expect(markup).toContain('disabled');
    });

    it('says the party is full rather than going quiet', () => {
        const run = makeRun(400, { partyIds: ['mm1', 'mm2', 'mm3'] });
        const ranch = makeRanch({ jormungandr: 1 }, [
            ...ROSTER,
            rosterMember('mm2', 'fenrir', 'fenrir_v1'),
            rosterMember('mm3', 'ratatoskr', 'ratatoskr_v1'),
        ]);
        const markup = render(run, ranch);

        expect(markup).toContain('Party full — 3/3');
        expect(markup).toContain('party: 3/3');
    });

    it('says what an empty blueprint shelf means, and points at the bench that is still open', () => {
        const markup = render(makeRun(400), makeRanch({}));
        expect(markup).toContain('No blueprints');
        expect(markup).toContain('alpha nodes');
        // The floor Henry's amendment gives the node: removal needs no blueprint.
        expect(markup).toContain(`Strip — ${WORKSHOP_REMOVAL_PRICE} scrap`);
    });
});

describe('WorkshopNode — reflashing', () => {
    it('lists the party with the firmware each member runs, at both prices', () => {
        const markup = render(makeRun(400), makeRanch({ kraken: 1 }));

        expect(markup).toContain('Reflash firmware');
        expect(markup).toContain(`Reflash — 1 blueprint + ${WORKSHOP_REFLASH_SCRAP} scrap`);
    });

    it('names the blueprint it is missing rather than dying quietly', () => {
        const markup = render(makeRun(400), makeRanch({ fenrir: 1 }));
        expect(markup).toContain('No Kraken blueprint');
        expect(markup).toContain('disabled');
    });

    it('says what the player is short when the scrap is the problem', () => {
        const markup = render(makeRun(5), makeRanch({ kraken: 1 }));
        expect(markup).toContain(`Reflash (${WORKSHOP_REFLASH_SCRAP}) — ${WORKSHOP_REFLASH_SCRAP - 5} scrap short`);
    });
});

describe('WorkshopNode — stripping a card', () => {
    it('lists every deck card with the marketplace’s removal price', () => {
        const run = makeRun(400);
        const markup = render(run, makeRanch({}));

        expect(markup).toContain(`Strip a card (${run.deck.length})`);
        expect(markup.match(new RegExp(`Strip — ${WORKSHOP_REMOVAL_PRICE} scrap`, 'g'))?.length)
            .toBe(run.deck.length);
        // Said out loud, because a second price for the same service would be the obvious guess.
        expect(markup).toContain('one sink');
    });

    it('tags the generic filler, because it is what removal is for', () => {
        const run = makeRun(400);
        const markup = render(run, makeRanch({}));
        expect(markup.match(/generic filler<\/span>/g)?.length)
            .toBe(run.deck.filter((c) => c.dataId === GENERIC_HIT).length);
    });

    it('disables the strip button and says the shortfall', () => {
        const markup = render(makeRun(0), makeRanch({}));
        expect(markup).toContain(`Strip (${WORKSHOP_REMOVAL_PRICE}) — ${WORKSHOP_REMOVAL_PRICE} short`);
    });

    it('renders an empty deck without crashing', () => {
        const markup = render(makeRun(50, { deck: [] }), makeRanch({}));
        expect(markup).toContain('Nothing to strip');
        expect(markup).toContain('Strip a card (0)');
    });
});

describe('WorkshopNode — the firmware picker', () => {
    it('offers every OS the species has when assembling, and names both prices on the button', () => {
        const markup = render(
            makeRun(400),
            makeRanch({ fenrir: 1 }),
            { kind: 'assemble', speciesId: 'fenrir', osId: 'fenrir_v1' },
        );

        expect(markup).toContain('Choose firmware for Fenrir');
        expect(markup).toContain(`Spend 1 blueprint + ${WORKSHOP_ASSEMBLY_SCRAP} scrap`);
        expect(markup).toContain('aria-pressed="true"');
    });

    it('offers only the OTHER firmware when reflashing, and prices it as a reflash', () => {
        const markup = render(
            makeRun(400),
            makeRanch({ kraken: 1 }),
            { kind: 'reflash', memberId: 'mm1', osId: 'kraken_v2' },
        );

        expect(markup).toContain('Reflash Kraken');
        expect(markup).toContain(`Spend 1 blueprint + ${WORKSHOP_REFLASH_SCRAP} scrap`);
        // The member is running kraken_v1, so the picker must not offer it back to them: exactly one
        // option, and it is not the firmware already installed. (The rows print the OS's *name* from
        // the firmware registry, never the raw id — ticket 15's fix, read rather than assumed.)
        expect(markup.match(/<button type="button" class="ws-os-option/g)?.length).toBe(1);
        expect(markup).not.toContain('ABYSSAL_INK_SYS</strong>');
        expect(markup).toContain('cards already in the deck stay');
    });
});

describe('WorkshopNode — the standing laws', () => {
    it('prints what every strippable card DOES, so the cut is a comparison', () => {
        /*
         * INVERTED 2026-08-24, exactly as `MarketplaceNode.test.tsx`'s twin was, and for the same
         * two reasons: Henry's 2026-08-23 amendment to the standing law (power stays in card
         * descriptions, or cards cannot be compared) and then the playtest report that the shops
         * were unreadable without it. Removal is one sink at one price on two counters; the two
         * counters must not show the player different things.
         *
         * The old assertion was `not.toMatch(/power/i)`, which the screen satisfied by printing no
         * card text at all.
         */
        const markup = render(makeRun(400), makeRanch({ fenrir: 1, kraken: 1 }));
        const run = makeRun(400);
        for (const card of run.deck) {
            const description = ProgramRegistry[card.dataId]?.description;
            if (!description) continue;
            expect(markup).toContain(escapeHtml(description));
        }
    });

    it('makes every affordance a real <button>', () => {
        // `RegionMap` and `MarketplaceNode` set the precedent; ticket 38 should inherit screens that
        // already work without a mouse rather than screens that need retrofitting.
        const run = makeRun(400);
        const markup = render(run, makeRanch({ fenrir: 1 }));
        // One assemble row, one reflash row, one strip button per deck card.
        expect(markup.match(/<button/g)?.length).toBe(2 + run.deck.length);
    });
});
