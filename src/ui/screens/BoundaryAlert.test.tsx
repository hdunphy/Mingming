/**
 * THE BIOME-BOUNDARY ALERT, RENDERED — ticket 62's round-1 Option C, the fourth edit surface.
 *
 * `runSlice`'s boundary cases cover when the debt is raised and when it is cleared; this file is the
 * other failure, which is whether the modal that debt exists to open **says** the thing it was added
 * for. Henry added this surface after the other three (2026-08-25): *"I think after defeating the
 * elite that gates the next biome you should be able to manage your deck and team."* Its whole claim
 * is timing rather than convenience — **the biome boundary is the moment the player learns what
 * element they are walking into**. Everywhere else "remove Rat for the fire biome" is hindsight;
 * here it is a decision with the information in front of it. So the case that the next biome's name
 * and elements are on screen is not a copy test. It is the reason the component exists, and a modal
 * that fired here without them would be a worse version of the workshop's EDIT LOADOUT button.
 *
 * Three rulings are load-bearing enough that a patch would have to argue with them rather than
 * "improve" them, and each has a case below:
 *
 * - **IT IS AN ALERT, NOT A SCREEN.** *"An alert offers the edit screen; player accepts or
 *   ignores."* A screen you must clear is a toll; a modal with a real IGNORE is an offer. The
 *   tempting patch is the one every modal attracts — make the primary action the only action, since
 *   "why would you not want to edit?" — and it converts an offer into a tax on every biome
 *   transition of every run. Both buttons are asserted, and asserted to be exactly two, because a
 *   third action here would mean the alert had started making decisions the map owns.
 * - **IT SUGGESTS THE BENCH AND NOTHING CLEVERER.** A recommender that ranked cards against the
 *   coming biome would be a second opinion about matchups the type chart already states, and it
 *   would be wrong in exactly the cases a player cares about (a deck built around one payoff).
 *   Naming what is *available but not fielded* is the only fact this modal knows that the player
 *   cannot read off the map. Hence the two selection cases: a party member's card is NOT suggested,
 *   and the column stops at `SUGGESTION_LIMIT`.
 * - **NOTHING HERE IS ENFORCED.** The suggested column is advice. That is why it is asserted as a
 *   list of names and costs rather than as anything with a verb on it, and why the empty state still
 *   sends the player to the editor rather than to nowhere.
 *
 * Rendered to static markup, the shape the panel tests established: the repo has no
 * `@testing-library/react`, and `renderToStaticMarkup` runs no effects. This modal needs no test
 * seam of its own — it holds no state at all, which is itself the ruling that it is a debt the RUN
 * owes (`IRunState.boundaryBiome`) rather than a flag a screen happens to be holding.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import BoundaryAlert, { SUGGESTION_LIMIT } from './BoundaryAlert';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { createRun, minimumActiveDeck } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import { ELEMENT_COLOR } from './runShell';
import type { IMingmingState } from '../../engine/types';
import type { IRanchMember, IRanchState, IRunCard, IRunState } from '../../engine/runTypes';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

const rosterMember = (id: string, definitionId: string, activeOS: string): IRanchMember => ({
    id, definitionId, activeOS, attackIV: 10, defenseIV: 10, hpIV: 10,
});

/** mm1 is fielded, mm2 is the member every bench case benches. */
const ROSTER: IRanchMember[] = [
    rosterMember('mm1', 'kraken', 'kraken_v1'),
    rosterMember('mm2', 'fenrir', 'fenrir_v1'),
];

let minted = 0;
const card = (dataId: string, ownerId: string | null): IRunCard => {
    minted += 1;
    return { instanceId: `fixture-card-${minted}`, dataId, ownerId };
};

function makeRun(over: Partial<IRunState> = {}): IRunState {
    const run = createRun({
        seed: 'boundary-render-seed',
        offer: offerGyms('offer-seed')[0],
        party: [KRAKEN],
        startedAt: 1_700_000_000_000,
    });
    return { ...run, ...over };
}

function makeRanch(roster: IRanchMember[] = ROSTER): IRanchState {
    return { ...createEmptyRanch(), roster };
}

/**
 * The alert as `RunScreen` fires it: over the map, naming the biome AHEAD rather than the one just
 * cleared. `nextBiomeElements` is a 1-or-2 list because `IBiome.elements` is (mono-element at EA
 * launch, friendly pairs deferred rather than cancelled), so the default fixture uses two — the
 * shape that can catch a screen printing only `elements[0]` and calling it the biome.
 */
function render(
    run: IRunState,
    ranch: IRanchState = makeRanch(),
    elements: ReadonlyArray<string> = ['Fire', 'Ice'],
): string {
    const store = configureStore({
        reducer: { run: runReducer, game: gameReducer },
        preloadedState: { game: ranch, run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    return renderToStaticMarkup(
        <Provider store={store}>
            <BoundaryAlert
                run={run}
                ranch={ranch}
                nextBiomeName="Ashfall"
                nextBiomeElements={elements}
                onIgnore={() => undefined}
                onEdit={() => undefined}
            />
        </Provider>,
    );
}

/** The names printed down the suggested column, in the order it chose to print them. */
const suggestedNames = (markup: string): string[] =>
    [...markup.matchAll(/<span class="ba-cnm">([^<]*)<\/span>/g)].map((match) => match[1]);

describe('BoundaryAlert — the offer itself', () => {
    it('is a dialog with exactly two ways out, and IGNORE is one of them', () => {
        /*
         * The ruling in one case: *"an alert offers the edit screen; player accepts or ignores."*
         *
         * A modal you cannot dismiss would be the bug — this fires at every biome transition of
         * every run, so a forced editor is a toll charged two or three times a run on players who
         * had already decided their deck was fine. IGNORE is therefore asserted FIRST and by its
         * full label, because the label is doing the work: `IGNORE — CONTINUE` says that ignoring
         * moves you on rather than closing something you will have to answer again.
         *
         * `role="dialog"` plus `aria-modal` plus a name, because ticket 38 should inherit screens
         * that already announce themselves — a modal with no role is an unlabelled div stack that a
         * screen reader walks straight past into the map underneath it.
         *
         * And EXACTLY two buttons, which is the assertion a future feature has to argue with rather
         * than slip past. A third action here (a quick-swap, a "don't show this again", an autofix)
         * would be this modal deciding something the editor or the map owns, and both of those have
         * their own screens and their own tests.
         */
        const markup = render(makeRun());

        expect(markup).toContain('role="dialog"');
        expect(markup).toContain('aria-modal="true"');
        expect(markup).toContain('aria-label="Biome boundary"');
        expect(markup).toContain('>IGNORE — CONTINUE</button>');
        expect(markup).toContain('>EDIT LOADOUT</button>');
        expect(markup.match(/<button/g)?.length).toBe(2);
        expect(markup.match(/<button type="button"/g)?.length).toBe(2);
        // Nothing faking a third: no ARIA-painted div, no anchor standing in for an action.
        expect(markup).not.toContain('role="button"');
        expect(markup).not.toContain('<a ');
        // The scrim is a sibling rather than a click handler on the body — dimming the map is what
        // makes this read as an offer laid over the run instead of as the next screen of it.
        expect(markup).toContain('class="ba-scrim"');
    });

    it('names the biome ahead and every element it runs — the whole reason it fires here', () => {
        /*
         * This is the information that justifies the surface existing at all. `MarketplaceNode` and
         * `WorkshopNode` also open the editor, and a player standing in either of them does not yet
         * know what the next biome is; that is precisely why ticket 62 put a fourth door here rather
         * than telling players to plan ahead at the stall.
         *
         * The elements are asserted as the JOINED list rather than as "contains Fire", because
         * `IBiome.elements` is a 1-or-2 list — mono-element at EA launch with friendly pairs
         * deferred, not cancelled, and save v4 has no migration path — so a screen that printed
         * `elements[0]` would look correct today and would silently hide half of a two-element biome
         * on the day those ship, which is exactly the day nobody would be re-reading this file.
         *
         * The lead element also tints the biome's name, which is the one place on this modal the
         * type chart is quoted at all. `ELEMENT_COLOR` is read from `runShell` rather than restated
         * as a hex literal here: there are two element palettes in the game today (flagged for
         * ticket 38), and a test carrying its own copy of one of them would be a third.
         */
        const markup = render(makeRun(), makeRanch(), ['Fire', 'Ice']);

        expect(markup).toContain('BIOME BOUNDARY — ADJUST YOUR LOADOUT?');
        expect(markup).toContain(`<b style="color:${ELEMENT_COLOR.Fire}">Ashfall</b>`);
        expect(markup).toContain('wilds here run Fire / Ice decks');
        expect(markup).toContain('You may edit your party and deck now, or continue as-is.');

        // A mono-element biome reads as one element and no stray separator.
        const mono = render(makeRun(), makeRanch(), ['Nature']);
        expect(mono).toContain('wilds here run Nature decks');
        expect(mono).not.toContain(' / ');
    });
});

describe('BoundaryAlert — the party column', () => {
    it('draws the fielded party and the bench together, and marks which is which', () => {
        /*
         * The column answers "what am I walking in with", which is the question the elements above it
         * just made urgent. Both populations are drawn because a benched member is still yours
         * (ticket 61 §3) — a column that showed only the party would be describing the run as
         * unchangeable at the exact moment the modal is offering to change it.
         *
         * Each chip carries the member's name from the ranch roster, its firmware, and its element,
         * and that third one is the join with the sentence above: the player is comparing what the
         * biome runs against what they field, and doing it on one screen is the whole point.
         *
         * The benched chip additionally says where the swap happens — *"on the bench — swap in the
         * editor"*. That sentence is load-bearing rather than decorative, because these chips are
         * NOT controls: the modal's two buttons are its only actions, so a benched chip that looked
         * clickable and did nothing would be exactly the silently-inert control ticket 20 forbids.
         */
        const markup = render(makeRun({ bench: ['mm2'] }));

        /*
         * The heading reads "who is on the field", not the mockup's "quick swap". The modal HAS no
         * swap: its only two controls are IGNORE and EDIT LOADOUT, and the benched chip's own hint
         * points one screen over. A column headed with a verb it cannot perform sends the player
         * hunting for a control that is not there, which is the same failure as a silently inert
         * button — so the heading names what the column shows instead of what it cannot do.
         */
        expect(markup).toContain('PARTY · who is on the field');
        expect(markup).not.toContain('quick swap');
        expect(markup).toContain(`<span class="ba-nm">${GetMingmingData('kraken').name}</span>`);
        expect(markup).toContain('<span class="ba-os">kraken_v1</span>');
        expect(markup).toContain(`<span class="ba-en">${GetMingmingData('kraken').primaryElement}</span>`);

        expect(markup).toContain('class="ba-member benched"');
        expect(markup).toContain(`<span class="ba-nm">${GetMingmingData('fenrir').name}</span>`);
        expect(markup).toContain('on the bench — swap in the editor');
        // And the hint names the control that performs it, for the heading's reason above.
        expect(markup).toContain('EDIT LOADOUT swaps them');
    });

    it('says an empty bench is empty, and says where members come from', () => {
        /*
         * Nobody is benched at run start, and a party only grows at a workshop — so for most runs
         * the first boundary alert has an empty bench, and this copy is the one most players will
         * read. Two failures it is written against: a column that silently omitted the hint would
         * read as a modal that failed to load half of itself, and a hint that just said "nobody
         * benched" would leave a player who has never met the bench with no idea whether that is a
         * thing they did wrong. The sentence names the workshop instead, which is true and is the
         * only actionable thing to say at this moment.
         *
         * The same run with the same collection is asserted NOT to draw a benched chip, because the
         * bench is the modal's whole selection rule and a chip drawn from `partyIds` with the wrong
         * flag would corrupt the suggested column too.
         */
        const markup = render(makeRun({ collection: [card('ragnarok_edge', 'mm2')] }));

        expect(markup).toContain('Nobody benched. A workshop is where the party grows.');
        expect(markup).not.toContain('class="ba-member benched"');
        expect(markup).toContain('class="ba-member "');
    });
});

describe('BoundaryAlert — the suggested column', () => {
    it('suggests a benched member\'s cards, cheapest first, priced and named', () => {
        /*
         * *"Naming what is available but not fielded is the fact the player cannot see from the
         * map"* — the modal's only claim to knowing anything. Cost order rather than power order or
         * registry order, because the column is being read against a deck the player is about to
         * edit under a floor, and cost is the axis they will make that trade on; power ordering
         * would be the recommender this component's header explicitly refuses to be.
         *
         * Each row prints cost, name and the `benched` tag. The tag matters even though every row
         * in this column is benched by construction: the column is advice, and advice that does not
         * say WHY it is advising is indistinguishable from a list of cards the game picked at random.
         */
        const collection = [
            card('hydro_blast', 'mm2'),   // 3e, listed last
            card('blood_rite', 'mm2'),    // 1e
            card('undertow', 'mm2'),      // 0e, listed first
        ];
        const markup = render(makeRun({ collection, bench: ['mm2'] }));

        expect(markup).toContain('DECK CHANGES · suggested');
        expect(suggestedNames(markup)).toEqual([
            ProgramRegistry.undertow.name,
            ProgramRegistry.blood_rite.name,
            ProgramRegistry.hydro_blast.name,
        ]);
        expect(markup).toContain('<span class="ba-cost">0</span>');
        expect(markup).toContain('<span class="ba-cost">3</span>');
        expect(markup.match(/<span class="ba-tag">benched<\/span>/g)?.length).toBe(3);
        expect(markup).toContain('Full editor opens on accept.');
    });

    it('suggests ONLY benched cards — a party member\'s card is not advice', () => {
        /*
         * The selection rule, stated as the thing it excludes, which is the half that can break
         * silently. A card owned by a FIELDED member is already in the deck being played; suggesting
         * it would be the modal advising the player to add a card they cannot add, and the tempting
         * patch that produces it is a one-character one — dropping the `bench.includes` clause, or
         * inverting it, still yields a full-looking column of real cards with real costs.
         *
         * Both non-benched cases are in the fixture because they fail differently. A party member's
         * card (`mm1`) is excluded by ownership; a bought or drafted card has `ownerId: null` and is
         * excluded by the null check that guards the same clause — `IRunCard.ownerId` is nullable
         * precisely because the marketplace and events mint cards nobody brought. A column that
         * suggested unowned collection cards would not be wrong about availability, but it would
         * have stopped being about the bench, which is the only question this modal is qualified to
         * answer.
         */
        const collection = [
            card('blood_rite', 'mm2'),
            card('ink_stream', 'mm1'),
            card('seed_bomb_v2', null),
        ];
        const markup = render(makeRun({ collection, bench: ['mm2'] }));

        expect(suggestedNames(markup)).toEqual([ProgramRegistry.blood_rite.name]);
        expect(markup).not.toContain(ProgramRegistry.ink_stream.name);
        expect(markup).not.toContain(ProgramRegistry.seed_bomb_v2.name);
    });

    it('stops at SUGGESTION_LIMIT rather than pouring the collection into a modal', () => {
        /*
         * The mockup's column holds five, and `SUGGESTION_LIMIT` is exported so this case can be
         * about the ruling rather than about the number: it is a 700px modal at 290/170 over the
         * map, and a column that grew with the collection would push the two buttons — the actual
         * decision — off the bottom of the thing the player is being asked to decide on. A benched
         * three-member party can hold ten cards in the collection easily, so this is not a
         * hypothetical overflow.
         *
         * Eight benched cards go in and the cheapest five come out, which pins the cap and the sort
         * TOGETHER. That pairing is the point: a cap applied before the sort would show five
         * arbitrary cards and still count correctly, and "five of the ten" is only useful advice if
         * they are the five the player is most likely to be able to afford playing.
         */
        const cheapest = ['undertow', 'healing_mist', 'blood_rite', 'berserk_rush', 'battle_rhythm'];
        const dearest = ['ragnarok_edge', 'seed_bomb_v2', 'hydro_blast'];
        const collection = [...dearest, ...cheapest].map((id) => card(id, 'mm2'));
        expect(collection.length).toBeGreaterThan(SUGGESTION_LIMIT);

        const markup = render(makeRun({ collection, bench: ['mm2'] }));
        const names = suggestedNames(markup);

        expect(names.length).toBe(SUGGESTION_LIMIT);
        expect(new Set(names)).toEqual(new Set(cheapest.map((id) => ProgramRegistry[id].name)));
        for (const id of dearest) {
            expect(markup).not.toContain(ProgramRegistry[id].name);
        }
    });

    it('explains an empty column instead of drawing one, and still names the floor', () => {
        /*
         * With nothing benched there is nothing to suggest, and an empty column beside a full one
         * reads as a modal that failed halfway. What it says instead is the more useful thing: the
         * editor opens anyway. That is the sentence that keeps EDIT LOADOUT meaningful for the
         * majority of runs, where the player has benched nobody but may still want to cut the
         * generics they were dealt before walking into a counter-element biome.
         *
         * It quotes the deck floor from `minimumActiveDeck` rather than a literal, for the same
         * reason the editor's own pill does: the floor is *"the team is the deck, as a floor"* — a
         * function of party size, 8 / 13 / 18 — so a modal that promised a number the editor would
         * then refuse to honour would be lying about the only rule it mentions.
         */
        const run = makeRun({ collection: [card('ink_stream', 'mm1')] });
        const markup = render(run);

        expect(suggestedNames(markup)).toEqual([]);
        expect(markup).toContain('Nothing benched to bring in.');
        expect(markup).toContain(`the deck floor (${minimumActiveDeck(run.partyIds.length)}) are both there`);
        expect(markup).not.toContain('class="ba-cardc"');
    });
});
