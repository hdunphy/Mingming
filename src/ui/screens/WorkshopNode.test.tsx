/**
 * The workshop, rendered — ticket 14, rebuilt against ticket 65's ruled mockups.
 *
 * `engine/run/workshop.test.ts` covers the prices and who may be built; `runSlice.workshop.test.ts`
 * covers what the buttons do to the two slices. What is left, and is a different failure, is whether
 * the screen **says** any of it. Ticket 65 turned the node from a list of priced rows into a bay —
 * a blueprint rack, a lit assembly stage, a party column, and a reflash view that replaces the whole
 * body — so most of these cases moved, three of them died with the features they pinned, and five are
 * new. What did NOT move is the reason any of them exist:
 *
 * - **Both halves of the price.** The ranch charges a blueprint alone and this charges a blueprint
 *   plus scrap (Henry, 2026-08-21). A screen printing one number would look like the ranch and
 *   behave differently. The stage prints them as two chips now rather than as one sentence on a
 *   button, so the assertion follows the chips — but it is still "both, or the test fails".
 * - **Why a button is dead** (ticket 20's precedent): the scrap, the blueprint or the species clause,
 *   said out loud. A silently inert control is indistinguishable from a bug.
 * - **`power` must not appear** in the bay (standing law, map § Notes). The cheapest way to break
 *   that is not a price — it is a well-meant "show the card text" patch, since several card
 *   descriptions quote the internal number. `MarketplaceNode.test.tsx` keeps the *positive* form of
 *   this, at the screen that asks the player to choose between cards; a bay lists engines by name and
 *   cost, so here the law reads as an absence again.
 * - **And that the STRIP SECTION IS STILL GONE.** Henry deleted paid removal on 2026-08-26. The case
 *   that pinned the strip button's price is inverted rather than deleted, because a re-appearing
 *   20-scrap removal is precisely the well-meant patch this file exists to catch.
 *
 * What ticket 65 added, and what these cases are new for:
 *
 * - **The engine is the thing being bought, so the engine has to be on screen before you buy it.**
 *   `workshop.engineIdsForSpecies`' own header: *"choosing the firmware IS choosing the five cards,
 *   and a picker that named only the OS would be asking the player to choose blind."* The stage
 *   lists all five, payoff first, duplicates as ×N; the reflash view lists two engines side by side.
 *   Both are asserted **against `engineIdsFor` / `engineIdsForSpecies`** rather than against
 *   hard-coded card names, so a retag of a species' `startKits` moves the expectation with the
 *   screen instead of failing a test that was never about Skoll.
 * - **`??`, and it is a ruling rather than an oversight.** See the case itself.
 *
 * Rendered to static markup, the shape the panel tests established: the repo has no
 * `@testing-library/react`, and `renderToStaticMarkup` runs no effects. The stage and the reflash
 * comparison are reachable through `initialSpeciesId` and `initialReflash` for the same reason
 * `RanchScreen` takes `initialSection` — static markup cannot click, and those two views are where
 * the prices, the engines and the firmware are confirmed.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import WorkshopNode, { type ReflashTarget } from './WorkshopNode';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { RECRUIT_KIT_SIZE, createRun, minimumActiveDeck } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { PARTY_SIZE } from '../../engine/party';
import * as workshop from '../../engine/run/workshop';
import {
    WORKSHOP_ASSEMBLY_SCRAP,
    WORKSHOP_REFLASH_SCRAP,
    engineIdsFor,
    engineIdsForSpecies,
} from '../../engine/run/workshop';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import { cardFace } from './runShell';
import type { IMingmingState } from '../../engine/types';
import type { IRanchMember, IRanchState, IRunState } from '../../engine/runTypes';

/** `renderToStaticMarkup` escapes text; several firmware descriptions carry apostrophes. See the twin
 *  in `MarketplaceNode.test.tsx` — comparing raw registry strings silently skips exactly those. */
const escapeHtml = (text: string): string =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

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
    const node = run.nodes.find((n) => n.kind === 'workshop')!;
    return {
        ...run,
        scrap,
        currentNodeId: node.id,
        nodes: run.nodes.map((n) => (n.id === node.id ? { ...n, visited: n.visited + 1 } : n)),
        ...over,
    };
}

function makeRanch(blueprints: Record<string, number>, roster: IRanchMember[] = ROSTER): IRanchState {
    return { ...createEmptyRanch(), roster, blueprints };
}

/**
 * The screen's test seams, named once so a case reads as the *state the player is standing in*
 * rather than as a prop list. `onEditLoadout` and `onLeave` are required props with no default:
 * a workshop with no way out is not a state the app can reach, so the harness always supplies both.
 */
interface Seams {
    readonly biomeName?: string;
    readonly initialSpeciesId?: string;
    readonly initialReflash?: ReflashTarget;
}

function render(run: IRunState, ranch: IRanchState, seams: Seams = {}): string {
    const store = configureStore({
        reducer: { game: gameReducer, run: runReducer },
        preloadedState: { game: ranch, run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
    return renderToStaticMarkup(
        <Provider store={store}>
            <WorkshopNode
                run={run}
                node={node}
                ranch={ranch}
                onEditLoadout={() => {}}
                onLeave={() => {}}
                {...seams}
            />
        </Provider>,
    );
}

/**
 * The engine as the screen is obliged to print it: one row per distinct card, in engine order, with
 * the count beside anything held twice.
 *
 * Written out rather than compared as a flat list of names because the collapse is the part that has
 * historically gone wrong — `kraken_v2` is `hydro_blast, capacitor, capacitor, surge_protection,
 * surge_protection`, which is five cards in three rows, and a screen that printed five rows or three
 * cards would both "contain every name".
 */
function expectedEngineRows(ids: ReadonlyArray<string>): Array<{ name: string; n: number }> {
    const rows: Array<{ name: string; n: number }> = [];
    for (const id of ids) {
        const name = cardFace(id).name;
        const seen = rows.find((row) => row.name === name);
        if (seen) seen.n += 1;
        else rows.push({ name, n: 1 });
    }
    return rows;
}

describe('WorkshopNode — the top bar', () => {
    it('prints the scrap it is about to charge, labelled for a screen reader', () => {
        // The bay's whole proposition is "a blueprint AND scrap", and the scrap half is a number the
        // player has to be able to check against the chips on the stage without leaving the screen.
        // `aria-label` because the readout is an ICON since ticket 34 — it reads as nothing aloud, and
        // ticket 38 should inherit screens that already say what their numbers are.
        const markup = render(makeRun(140), makeRanch({}));

        expect(markup).toContain('aria-label="Scrap held"');
        expect(markup).toContain('140 <svg');
    });

    it('names the biome it is standing in, and falls back rather than printing "undefined"', () => {
        // The context line is how a player reading a screenshot knows which of the run's three
        // workshops this is. `biomeName` is optional because `RunScreen` cannot always name the
        // biome (a debug launch has no offer behind it), so the fallback is asserted too: a bay that
        // printed `UNDEFINED BIOME · ASSEMBLY BAY` would be a bug that only ever shipped to players.
        expect(render(makeRun(140), makeRanch({}), { biomeName: 'Ashfall' }))
            .toContain('ASHFALL BIOME · ASSEMBLY BAY');
        expect(render(makeRun(140), makeRanch({}))).toContain('THIS BIOME · ASSEMBLY BAY');
        expect(render(makeRun(140), makeRanch({}))).not.toMatch(/UNDEFINED/i);
    });

    it('counts the party AND the bench, because the bench is now a place members live', () => {
        // Ticket 06 rules the party grows here and nowhere else, so `n/3` has always had to be on
        // screen. Ticket 61 §3 added a second number beside it: `ASSEMBLE → BENCH` is a verb, and a
        // player who cannot see that they already hold two benched members has no way to know why
        // the species clause is refusing a blueprint they are holding.
        const run = makeRun(140, { partyIds: ['mm1', 'mm2'], bench: ['mm3'] });
        const ranch = makeRanch({}, [
            ...ROSTER,
            rosterMember('mm2', 'fenrir', 'fenrir_v1'),
            rosterMember('mm3', 'ratatoskr', 'ratatoskr_v1'),
        ]);

        expect(render(run, ranch)).toContain(`PARTY 2/${PARTY_SIZE} · BENCH 1`);
        expect(render(makeRun(140), makeRanch({}))).toContain(`PARTY 1/${PARTY_SIZE} · BENCH 0`);
    });

    it('shows the deck against its floor, computed rather than printed as a guess', () => {
        // `minimumActiveDeck` is *"the team is the deck, as a floor"* — the party's own contribution,
        // which is why it is a function of the party size and not the flat 16 an earlier spec named.
        // The pill is asserted against that function rather than against the number it returns today,
        // so changing `START_KIT_SIZE` moves the expectation with the rule instead of failing here.
        const run = makeRun(140);
        const markup = render(run, makeRanch({}));

        expect(markup).toContain(`DECK <b>${run.deck.length}</b> / floor ${minimumActiveDeck(run.partyIds.length)}`);
        // Ticket 61 §3's four edit surfaces all reach the same editor, and this is one of the doors.
        expect(markup).toContain('>EDIT LOADOUT</button>');
        expect(markup).toContain('>LEAVE</button>');
    });
});

describe('WorkshopNode — the blueprint rack', () => {
    it('lists every held blueprint with its count', () => {
        // The rack is the shelf: what the run has picked up off alphas and wilds, in one column, so
        // the "spend it here or carry it home to the ranch" decision is made against what is actually
        // in hand rather than against a memory of the last drop.
        const markup = render(makeRun(400), makeRanch({ fenrir: 2, skoll: 1 }));

        expect(markup).toContain('>Fenrir</span>');
        expect(markup).toContain('blueprints ×2');
        expect(markup).toContain('>Skoll</span>');
        expect(markup).toContain('blueprints ×1');
    });

    it('shelves a species spent down to zero, greyed and dead — ticket 65\'s Skoll row', () => {
        /*
         * Mockup I draws a fourth rack row for a species with `no blueprints`, greyed and
         * unclickable, and `workshopSpecies` stopped filtering `count > 0` so that it can.
         *
         * The distinction the rack is drawing is **spent versus never seen**. A species the ranch
         * has never met has no key in `ranch.blueprints` at all and still does not appear, so this
         * is an inventory rather than a catalogue — a rack of every species in the registry would be
         * a wall of refusals. But a species you *had* and used is the one thing a rack of what you
         * can spend cannot tell you, and "I built a Ratatoskr at the last workshop" is exactly the
         * fact that decides whether walking to this one is worth the wilds in between.
         *
         * The row is disabled, which is the half a "helpful" patch would break: a greyed row that
         * still opens the stage would offer an assembly with nothing to spend on it.
         */
        const markup = render(makeRun(400), makeRanch({ fenrir: 2, ymir: 0 }));

        expect(markup).toContain('>Fenrir</span>');
        expect(markup).toContain('blueprints \u00d72');

        // Present, labelled, and dead — all three, in the one row.
        const ymirRow = markup
            .split('<button')
            .find((chunk) => chunk.includes('>Ymir</span>'));
        expect(ymirRow).toBeDefined();
        expect(ymirRow).toContain('no blueprints');
        expect(ymirRow).toContain('disabled=""');
    });

    it('shows a blueprint the species clause refuses, with the reason rather than not at all', () => {
        // A blueprint you are holding but cannot spend HERE is news, so it is listed with its
        // refusal. The party already fields a kraken; the roster may hold ten. Said in the player's
        // terms — *"already on the team"* — because "illegal" explains nothing (ticket 20).
        const markup = render(makeRun(400), makeRanch({ kraken: 3 }));

        expect(markup).toContain('>Kraken</span>');
        expect(markup).toContain('blueprints ×3 · already on the team');
    });

    it('says what an empty shelf means rather than going quiet', () => {
        // An empty column with no sentence in it reads as a screen that failed to load. It is also
        // the most common state of the first workshop a run walks into, so it is the copy most
        // players see first.
        const markup = render(makeRun(400), makeRanch({}));

        expect(markup).toContain('No species in the registry offer blueprints yet.');
        expect(markup).toContain('Blueprints are consumable');
        // And the stage says the same thing from its own side, priced, rather than sitting blank.
        expect(markup).toContain('SELECT A BLUEPRINT');
        expect(markup).toContain('This is the only place the party grows');
        expect(markup).toContain(`${WORKSHOP_ASSEMBLY_SCRAP} scrap`);
    });
});

describe('WorkshopNode — the assembly stage', () => {
    it('prints BOTH halves of the price as its own chips', () => {
        // The standing law of 2026-08-21, and the one this file was originally opened for: the ranch
        // charges a blueprint, the road charges a blueprint AND scrap. Mid-run recruiting is supposed
        // to compete with the marketplace for the same purse, and it cannot compete if the screen
        // only quotes the half the ranch also charges.
        const markup = render(makeRun(400), makeRanch({ skoll: 1 }), { initialSpeciesId: 'skoll' });

        expect(markup).toContain('<span class="rs-chip">1 × BLUEPRINT</span>');
        expect(markup).toContain(`<span class="rs-chip">${WORKSHOP_ASSEMBLY_SCRAP} <svg`);
        expect(markup).toContain('ASSEMBLE → PARTY');
        expect(markup).toContain('ASSEMBLE → BENCH');
    });

    it('lists the whole 5-card engine, payoff first, duplicates collapsed to ×N', () => {
        /*
         * Ticket 65: *"choosing the firmware IS choosing the five cards, and a picker that named only
         * the OS would be asking the player to choose blind."* Skoll's v1 engine is a payoff plus a
         * doubled enabler, which is the shape that catches both failures at once — a screen that
         * dropped the duplicate would print four cards for a five-card price, and one that listed
         * five rows would say the player is buying five different cards.
         *
         * Asserted against `engineIdsForSpecies` rather than against card names, because the point is
         * that the stage prints the engine the run will actually mint: retagging Skoll's `startKits`
         * must move this expectation, not break it.
         */
        const ids = engineIdsForSpecies('skoll', 'skoll_v1');
        expect(ids.length).toBe(RECRUIT_KIT_SIZE);

        const markup = render(makeRun(400), makeRanch({ skoll: 1 }), { initialSpeciesId: 'skoll' });

        expect(markup).toContain(`ITS ${RECRUIT_KIT_SIZE}-CARD ENGINE`);
        for (const { name, n } of expectedEngineRows(ids)) {
            expect(markup).toContain(`<span class="rs-rnm">${escapeHtml(name)}</span>`);
            if (n > 1) {
                expect(markup).toContain(
                    `<span class="rs-rnm">${escapeHtml(name)}</span><span class="rs-x">×${n}</span>`,
                );
            }
        }
        // Position IS the tag (ticket 61's engine table), so the payoff is the FIRST row and the only
        // one wearing the label — a second `payoff` would mean the order had stopped meaning anything.
        expect(markup).toContain(
            `<span class="rs-rnm">${escapeHtml(cardFace(ids[0]).name)}</span><span class="rs-t">payoff</span>`,
        );
        expect(markup.match(/>payoff</g)?.length).toBe(1);
    });

    it('offers every firmware the species has, inline, with exactly one marked chosen', () => {
        /*
         * The old `OsPicker` modal is gone: the choice is on the stage beside the engine it changes,
         * which is the whole of mockup I's argument for moving it. So "every OS the species offers"
         * is now a property of the stage rather than of a dialog nobody can see until they commit.
         *
         * Read from `availableOS` and printed as the firmware's NAME from the registry, never the raw
         * id — ticket 15's fix, asserted rather than assumed.
         */
        const definition = GetMingmingData('skoll');
        expect(definition.availableOS.length).toBeGreaterThan(1);

        const markup = render(makeRun(400), makeRanch({ skoll: 1 }), { initialSpeciesId: 'skoll' });

        for (const osId of definition.availableOS) {
            const name = getOSBehavior(osId)?.name;
            expect(name).toBeTruthy();
            expect(markup).toContain(`<span class="rs-rnm">${escapeHtml(name!)}</span>`);
            expect(markup).not.toContain(`>${osId}<`);
        }
        expect(markup.match(/<button type="button" class="rs-row/g)?.length).toBe(definition.availableOS.length);
        expect(markup.match(/>chosen</g)?.length).toBe(1);
    });

    it('shows ?? for the stat roll — the ruling, not an oversight', () => {
        /*
         * Mockup I puts VIT/PWR/DEF on the stage under *"stats roll at assembly — this is the reveal
         * moment"*, and the tempting reading is that the boxes hold a preview of what you would get.
         * They do not, and must not: `workshop.planRecruit` is explicit that **the roll is never
         * previewed — the player sees the stats after paying, exactly as at the ranch**, and the
         * consequence is that walking away and back re-rolls the individual at the price of
         * re-fighting the wilds between. That is `vision.md`'s *"re-assembly is the re-roll"* mid-run.
         * A previewed roll makes it free and turns every workshop into a button to mash.
         *
         * So this case is here to stop a future reader "fixing" the `??` — it is the ruling rendered.
         * If Henry ever means the preview literally, this test is the thing to change first, and the
         * economy consequence above is what to weigh; it is not a markup detail.
         */
        const markup = render(makeRun(400), makeRanch({ skoll: 1 }), { initialSpeciesId: 'skoll' });

        expect(markup.match(/<span class="ws-stat-v">\?\?<\/span>/g)?.length).toBe(3);
        expect(markup).toContain('ws-stat unrolled');
        expect(markup).toContain('They are not shown before you pay');
        expect(markup).toContain('VIT');
        expect(markup).toContain('PWR');
        expect(markup).toContain('DEF');
    });

    it('disables an assembly the purse cannot cover AND says what it is short', () => {
        // Ticket 20's precedent, unchanged by the rebuild: a silently inert control is
        // indistinguishable from a bug, so the shortfall is on the button rather than in a tooltip.
        // Both destinations are refused, because both cost the same 25 — a bench recruit is not a
        // discount, it is a different place to put the body.
        const short = WORKSHOP_ASSEMBLY_SCRAP - 10;
        const markup = render(makeRun(10), makeRanch({ skoll: 1 }), { initialSpeciesId: 'skoll' });

        expect(markup).toContain(`ASSEMBLE → PARTY — ${short} SHORT`);
        expect(markup.match(/<button[^>]* disabled=""/g)?.length).toBe(2);
        expect(markup).toContain('<span class="rs-chip">1 × BLUEPRINT</span>');
    });

    it('refuses a duplicate species on the button, in the clause\'s own words', () => {
        // The species clause is the one refusal a full purse cannot buy its way out of, so the button
        // stops naming a price at all and names the rule instead. Still on screen, still disabled,
        // still explained — the same contract as the shortfall above.
        const markup = render(makeRun(400), makeRanch({ kraken: 1 }), { initialSpeciesId: 'kraken' });

        expect(markup).toContain('ALREADY ON THE TEAM');
        expect(markup).toContain('disabled=""');
        expect(markup).not.toContain('ASSEMBLE → PARTY —');
    });

    it('asks who to bench instead of refusing a full party', () => {
        /*
         * This case is INVERTED, and the inversion is the ticket. It used to assert `Party full —
         * 3/3` and a dead button, which was right when the run had nowhere to put a fourth body.
         * Ticket 61 §3 gave it a bench and mockup I ruled the consequence: *"Party is full —
         * ASSEMBLE → PARTY asks who to bench."* So a full party is no longer a refusal; it is a
         * second question, and the button has to say which question it is about to ask.
         */
        const run = makeRun(400, { partyIds: ['mm1', 'mm2', 'mm3'] });
        const ranch = makeRanch({ jormungandr: 1 }, [
            ...ROSTER,
            rosterMember('mm2', 'fenrir', 'fenrir_v1'),
            rosterMember('mm3', 'ratatoskr', 'ratatoskr_v1'),
        ]);
        const markup = render(run, ranch, { initialSpeciesId: 'jormungandr' });

        expect(markup).toContain(`PARTY ${PARTY_SIZE}/${PARTY_SIZE}`);
        expect(markup).toContain('ASSEMBLE → PARTY (SWAP)');
        expect(markup).toContain('ASSEMBLE → PARTY asks who to bench');
        // Affordable and legal, so nothing on the stage is dead: the swap is a route, not a block.
        expect(markup).not.toContain('disabled=""');
    });
});

describe('WorkshopNode — the reflash comparison', () => {
    it('shows both engines side by side, and they are genuinely different decks', () => {
        /*
         * Mockup J's central point, and the reason the old `OsPicker` modal could not survive: a
         * reflash swaps the OS **and its five cards, 5 for 5** (`workshop.planReflash`), so it is a
         * choice between two decks. A picker naming only the firmware was asking the player to bet 15
         * scrap and a blueprint on a name.
         *
         * The two id lists are asserted to DIFFER before either is looked for in the markup. Without
         * that guard a screen that rendered the current engine twice — the easiest possible bug in a
         * two-panel layout, and an invisible one in a screenshot — would satisfy every `toContain`
         * below.
         */
        const current = engineIdsFor(rosterMember('mm1', 'kraken', 'kraken_v1'));
        const offered = engineIdsForSpecies('kraken', 'kraken_v2');
        expect(offered).not.toEqual(current);

        const markup = render(
            makeRun(400),
            makeRanch({ kraken: 1 }),
            { initialReflash: { memberId: 'mm1', targetOS: 'kraken_v2' } },
        );

        expect(markup).toContain('ws-oscard current');
        expect(markup).toContain('ws-oscard offer');
        expect(markup).toContain('ENGINE IN DECK NOW');
        expect(markup).toContain('ENGINE THAT REPLACES IT');
        for (const ids of [current, offered]) {
            for (const { name, n } of expectedEngineRows(ids)) {
                expect(markup).toContain(`<span class="rs-rnm">${escapeHtml(name)}</span>`);
                if (n > 1) {
                    expect(markup).toContain(
                        `<span class="rs-rnm">${escapeHtml(name)}</span><span class="rs-x">×${n}</span>`,
                    );
                }
            }
        }
        // One payoff per panel: the comparison is payoff-against-payoff or it is two piles of cards.
        expect(markup.match(/>payoff</g)?.length).toBe(2);
    });

    it('names both firmwares and prints what each one does', () => {
        // The firmware's own text is half of what is being compared — `rewardCardPool` and
        // `rollMarketStock` both read `activeOS`, so a reflash re-aims every card the rest of the run
        // will offer. Names come from the registry, never the raw id (ticket 15).
        const from = getOSBehavior('kraken_v1');
        const to = getOSBehavior('kraken_v2');
        expect(from?.description).toBeTruthy();
        expect(to?.description).toBeTruthy();

        const markup = render(
            makeRun(400),
            makeRanch({ kraken: 1 }),
            { initialReflash: { memberId: 'mm1', targetOS: 'kraken_v2' } },
        );

        expect(markup).toContain(escapeHtml(from!.name));
        expect(markup).toContain(escapeHtml(to!.name));
        expect(markup).toContain(escapeHtml(from!.description));
        expect(markup).toContain(escapeHtml(to!.description));
        expect(markup).toContain(' · CURRENT');
        expect(markup).toContain(' · AFTER REFLASH');
        expect(markup).not.toContain('>kraken_v1<');
        expect(markup).not.toContain('>kraken_v2<');
    });

    it('names both halves of its price, and says the old engine is not destroyed', () => {
        /*
         * The same 2026-08-21 law as the assembly, at the other price — and one clause more, which is
         * the clause that makes 15 scrap a re-aim rather than a gamble: *"Nothing is destroyed by a
         * reflash: the five retired cards are still owned, still sellable at a stall, and still
         * addable back into the deck"* (`planReflash`). A player who believes the old engine is
         * binned is being asked to make a bet the game is not actually offering them.
         *
         * `5 for 5` is asserted from `RECRUIT_KIT_SIZE` because it is the same fact as the floor:
         * the swap is legal at a deck sitting on its minimum precisely because the count does not move.
         */
        const markup = render(
            makeRun(400),
            makeRanch({ kraken: 1 }),
            { initialReflash: { memberId: 'mm1', targetOS: 'kraken_v2' } },
        );

        expect(markup).toContain('<span class="rs-chip">1 × KRAKEN BLUEPRINT</span>');
        expect(markup).toContain(`<span class="rs-chip">${WORKSHOP_REFLASH_SCRAP} <svg`);
        expect(markup).toContain('old engine cards → run collection');
        expect(markup).toContain(`${RECRUIT_KIT_SIZE} for ${RECRUIT_KIT_SIZE}`);
        expect(markup).toContain('floor unchanged');
    });

    it('disables a reflash the purse cannot cover AND says what it is short', () => {
        // Ticket 20 again, at the second counter. The blueprint IS held here, so the shortfall the
        // button names is unambiguously the scrap — a case that gave the player neither would be
        // testing "the button is dead", which is the thing this precedent exists to forbid.
        const markup = render(
            makeRun(5),
            makeRanch({ kraken: 1 }),
            { initialReflash: { memberId: 'mm1', targetOS: 'kraken_v2' } },
        );

        expect(markup).toContain(`REFLASH — ${WORKSHOP_REFLASH_SCRAP - 5} SHORT`);
        expect(markup).toContain('disabled=""');
    });

    it('swaps LEAVE for BACK, because the comparison replaced the bay rather than covering it', () => {
        // Mockup J replaces the whole body, so the top bar's exit is now the exit from the
        // COMPARISON. A LEAVE that walked the player off the node from here would be a lost run's
        // worth of surprise, and there is no other way back — the view is not a modal with a scrim.
        const markup = render(
            makeRun(400),
            makeRanch({ kraken: 1 }),
            { initialReflash: { memberId: 'mm1', targetOS: 'kraken_v2' } },
        );

        expect(markup).toContain('>BACK</button>');
        expect(markup).not.toContain('>LEAVE</button>');
        expect(markup).toContain('WORKSHOP — REFLASH — KRAKEN');
        // The bay is genuinely gone, not hidden behind it.
        expect(markup).not.toContain('BLUEPRINTS</h2>');
        expect(markup).not.toContain('ASSEMBLE → PARTY');
    });
});

describe('WorkshopNode — the party and bench column', () => {
    it('offers a reflash on a party member, and says when the blueprint is missing', () => {
        // The column is the reflash entry point now — there is no separate priced list — so the row
        // has to carry both what the member is running and whether this node can do anything about
        // it. `no blueprints` is the rack's label doing its live work here.
        const withBlueprint = render(makeRun(400), makeRanch({ kraken: 1 }));
        expect(withBlueprint).toContain('ABYSSAL_INK_SYS · reflash');
        expect(withBlueprint).toContain(`1 blueprint + ${WORKSHOP_REFLASH_SCRAP} scrap`);

        const without = render(makeRun(400), makeRanch({}));
        expect(without).toContain('ABYSSAL_INK_SYS · no blueprints');
    });

    it('shows a benched member in the same column, and reflashes it too', () => {
        /*
         * Ticket 61 §3: *"a benched member is still yours"*. The bench is not a holding pen the
         * workshop declines to serve — a player who benched a Fenrir to make room and then found the
         * blueprint for it has exactly the reflash this node sells, and hiding the member would make
         * the blueprint look unspendable.
         *
         * Asserted in both halves: the row exists in the bay, and the comparison view opens on it.
         * `initialReflash` is the seam because static markup cannot click the row.
         */
        const run = makeRun(400, { bench: ['mm2'] });
        const ranch = makeRanch({ fenrir: 1 }, [...ROSTER, rosterMember('mm2', 'fenrir', 'fenrir_v1')]);

        const bay = render(run, ranch);
        expect(bay).toContain(`PARTY 1/${PARTY_SIZE} · BENCH 1`);
        expect(bay).toContain('ws-bpc benched');
        expect(bay).toContain('benched · reflash');
        expect(bay).toContain('>Fenrir</span>');

        const view = render(run, ranch, { initialReflash: { memberId: 'mm2', targetOS: 'fenrir_v2' } });
        expect(view).toContain('WORKSHOP — REFLASH — FENRIR');
        expect(view).toContain('<span class="rs-chip">1 × FENRIR BLUEPRINT</span>');
        expect(view).toContain('>REFLASH</button>');
        expect(view).not.toContain('disabled=""');
    });
});

describe('WorkshopNode — the standing laws', () => {
    it('sells no strip: no section, no button, no removal price anywhere', () => {
        /*
         * This case pinned a service the screen no longer sells, and it is kept INVERTED rather than
         * deleted. Henry removed paid removal on 2026-08-26 — *"a card leaves the active deck for the
         * run collection for FREE, and a workshop is one of the four surfaces where that editing
         * happens"* — and a deleted test proves nothing about a re-appearing 20-scrap button. This one
         * fails on it, in any of the shapes it was printed in.
         */
        const markup = render(makeRun(400), makeRanch({ fenrir: 1, kraken: 1 }));

        expect(markup).not.toMatch(/Strip/i);
        expect(markup).not.toContain('20 scrap');
        expect(markup).not.toContain('one sink');
        expect(Object.keys(workshop)).not.toContain('WORKSHOP_REMOVAL_PRICE');
        // What replaced it: the free editor, reachable from the top bar on every one of the four
        // surfaces (ticket 61 §3).
        expect(markup).toContain('EDIT LOADOUT');
    });

    it('prints no card description in the bay, and therefore no power number', () => {
        /*
         * Inverted twice already, and back where it started for a reason that has held throughout.
         * It began as `not.toMatch(/power/i)`; Henry's 2026-08-23 amendment (power stays in card
         * descriptions, or cards cannot be compared) turned it into "print every strippable card's
         * text"; the strip section then went, and with it the comparison that needed the text.
         *
         * A bay lists engines by NAME and COST — that is what an engine row is — so the law reads as
         * an absence here again. Asserted over the descriptions the run's deck actually holds rather
         * than as "no card list", so a partial re-appearance fails too, and `MarketplaceNode.test.tsx`
         * keeps the positive form at the screen that still asks the player to choose between cards.
         */
        const run = makeRun(400);
        const markup = render(run, makeRanch({ fenrir: 1, kraken: 1 }), { initialSpeciesId: 'fenrir' });
        const described = run.deck
            .map((card) => ProgramRegistry[card.dataId]?.description)
            .filter((text): text is string => Boolean(text));
        // Guards the absence below from passing on a deck of cards with no descriptions.
        expect(described.length).toBeGreaterThan(0);
        for (const description of described) {
            expect(markup).not.toContain(escapeHtml(description));
        }
        expect(markup).not.toMatch(/power/i);
    });

    it('makes every affordance a real <button>', () => {
        /*
         * `RegionMap` and `MarketplaceNode` set the precedent; ticket 38 should inherit screens that
         * already work without a mouse rather than screens that need retrofitting. The rebuild made
         * this a bigger claim than it was — a blueprint rack, an inline OS picker and a party column
         * are all click targets that a mockup draws as tiles, and a tile is the easiest thing in the
         * world to ship as a `<div onClick>`.
         *
         * So the count is spelled out from the state rather than eyeballed: two in the top bar, one
         * per rack row, one per firmware, the two ASSEMBLE verbs, and one per party or bench member.
         * A control added without a tab stop moves that number and fails here.
         */
        const ranch = makeRanch({ fenrir: 2, skoll: 1 });
        const markup = render(makeRun(400), ranch, { initialSpeciesId: 'skoll' });

        const expected = 2 + Object.keys(ranch.blueprints).length
            + GetMingmingData('skoll').availableOS.length + 2 + 1;
        expect(markup.match(/<button/g)?.length).toBe(expected);
        // Every one of them a real button with an explicit type — a bare `<button>` inside a form is
        // a submit, and this screen will one day live inside one.
        expect(markup.match(/<button type="button"/g)?.length).toBe(expected);
        // And nothing faking one: no ARIA-painted div, no anchor standing in for an action.
        expect(markup).not.toContain('role="button"');
        expect(markup).not.toContain('<a ');
    });
});
