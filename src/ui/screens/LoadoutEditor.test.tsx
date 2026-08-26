/**
 * THE LOADOUT EDITOR, RENDERED — ticket 62 Option F, and the four doors that open it.
 *
 * `runSlice.loadout.test.ts` covers what the buttons DO to the two slices — what a move costs, what
 * the floor refuses, where a benched member's engine goes. What is left, and is a different failure,
 * is whether the screen **says** any of it. This file is that half, and it exists because the editor
 * is the one screen in the run that four separate surfaces share: ticket 62's *"the same F editor
 * serves all four edit surfaces (market, workshop, boundary accept, pre-gauntlet)"*. A regression
 * here is not one screen's regression, it is the marketplace's AND the workshop's AND the boundary
 * alert's AND the pre-gauntlet's, which is exactly the leverage that makes the cases below worth
 * their length.
 *
 * The claims that are rulings rather than markup, and would each be re-broken by a well-meant patch:
 *
 * - **One tile per unique card, everywhere** (Henry's duplicate amendment). The run stores `IRunCard`
 *   INSTANCES because a sale, a move and the departure bookkeeping all key on `instanceId`, so the
 *   collapse happens at render and the `×N` badge is the count. The patch that breaks this is not a
 *   malicious one — it is somebody rendering `collection.map(...)` because that is what the field is
 *   — so the rule is asserted in BOTH panels, the book and the deck column, since they collapse
 *   through the same `groupByData` and a partial fix would restore only one of them.
 * - **Both numbers in the collection header** (`10 (9 unique)`). They are different facts. A player
 *   editing toward the floor needs the instance count; a player looking for a card needs the unique
 *   one. A header that printed either alone would be right about half of what the screen is for.
 * - **The floor is not enforced here.** `runSlice.moveCardToCollection` enforces it; this screen
 *   greys the rows and prints the pill. So the assertion is about the GREYING and the sentence
 *   beside it — ticket 20's precedent, that a silently inert control is indistinguishable from a
 *   bug — and NOT about whether an illegal deck can be produced, which is the reducer's test to
 *   fail. Both sides of that are pinned: at the floor every row is dead and says why, above it no
 *   row is dead at all.
 * - **Every affordance is a real `<button>`** (`RegionMap`, `MarketplaceNode` and `WorkshopNode` all
 *   follow it, so ticket 38 inherits screens that already work without a mouse). The mockup draws a
 *   196x252 card, and a card is the single easiest thing in the world to ship as a `<div onClick>`.
 *   The count is therefore spelled out from the fixture's own state rather than eyeballed, so a
 *   control added without a tab stop moves the number and fails here.
 *
 * Rendered to static markup, the shape the panel tests established: the repo has no
 * `@testing-library/react`, and `renderToStaticMarkup` runs no effects. That is also why
 * `initialPage` exists on the component at all — it is a declared test seam, for the same reason
 * `RanchScreen` takes `initialSection` and `WorkshopNode` takes `initialSpeciesId`: static markup
 * cannot click a pager, and the second page is where the paging rule is actually observable.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import LoadoutEditor, { CARDS_PER_PAGE } from './LoadoutEditor';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { createRun, minimumActiveDeck } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { GENERIC_HIT, GetMingmingData } from '../../engine/data/mingmingRegistry';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import type { IMingmingState } from '../../engine/types';
import type { IRanchMember, IRanchState, IRunCard, IRunState } from '../../engine/runTypes';

/**
 * `renderToStaticMarkup` escapes text, and card descriptions carry apostrophes and ampersands.
 * The twin of this helper lives in `MarketplaceNode.test.tsx` and `WorkshopNode.test.tsx` for the
 * reason worth repeating here: comparing a raw registry string against the markup passes for most
 * cards and silently skips exactly the ones with punctuation, which is the subset a truncation bug
 * would show up in first.
 */
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

/** mm1 is fielded; mm2 exists so a case can bench somebody without inventing a second fixture. */
const ROSTER: IRanchMember[] = [
    rosterMember('mm1', 'kraken', 'kraken_v1'),
    rosterMember('mm2', 'fenrir', 'fenrir_v1'),
];

/**
 * Instance ids are minted by a counter rather than by `crypto.randomUUID()` so that a failing
 * assertion prints something a reader can find. Nothing in the editor reads the id's shape — the
 * component keys tiles on `dataId`, which is the duplicate ruling — so any unique string is honest
 * here, and a stable one keeps a diff of two runs of this file empty.
 */
let minted = 0;
const card = (dataId: string, ownerId: string | null = null): IRunCard => {
    minted += 1;
    return { instanceId: `fixture-card-${minted}`, dataId, ownerId };
};

/** `n` copies of one card — the duplicate ruling's fixture, written once. */
const copies = (dataId: string, n: number, ownerId: string | null = null): IRunCard[] =>
    Array.from({ length: n }, () => card(dataId, ownerId));

/**
 * Twelve distinct cards across three elements — one and a half pages at `CARDS_PER_PAGE`, which is
 * the smallest collection that can prove the book pages at all.
 *
 * Real registry ids rather than invented ones, because `cardFace` falls back to printing the raw
 * `dataId` when a card is unknown: a fixture of made-up ids would render, would look right, and
 * would quietly stop testing the registry lookup the tiles exist to perform. The guard below is
 * what keeps that from happening silently if one of these ids is ever retired.
 */
const COLLECTION_IDS = [
    'ragnarok_edge', 'blood_rite', 'berserk_rush', 'battle_rhythm', 'crimson_draw',
    'ink_stream', 'undertow', 'whirlpool_v2', 'hydro_blast',
    'healing_mist', 'seed_bomb_v2', 'echo_chamber_v2',
] as const;

/** Elements the filter row will offer for `COLLECTION_IDS` — `None` is excluded by the screen. */
const collectionElements = (ids: ReadonlyArray<string>): string[] =>
    [...new Set(ids.map((id) => ProgramRegistry[id]?.element ?? 'None'))]
        .filter((element) => element !== 'None')
        .sort();

function makeRun(over: Partial<IRunState> = {}): IRunState {
    const run = createRun({
        seed: 'loadout-render-seed',
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
 * The editor's seams, named once. `context` and `onClose` have no defaults on the component and
 * none here either: an editor with no way out and no idea which door it came through is not a state
 * `RunScreen` can produce, so the harness always supplies both.
 */
function render(run: IRunState, ranch: IRanchState = makeRanch(), initialPage?: number): string {
    const store = configureStore({
        reducer: { run: runReducer, game: gameReducer },
        preloadedState: { game: ranch, run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    return renderToStaticMarkup(
        <Provider store={store}>
            <LoadoutEditor
                run={run}
                ranch={ranch}
                context="WORKSHOP · NATURE BIOME · 143 SCRAP"
                onClose={() => undefined}
                initialPage={initialPage}
            />
        </Provider>,
    );
}

/** The names printed on the big tiles, in the order the book laid them out. */
const tileNames = (markup: string): string[] =>
    [...markup.matchAll(/<span class="rs-cnm">([^<]*)<\/span>/g)].map((match) => match[1]);

/**
 * Every `<button>` whose class list starts with `cls`, as raw markup chunks.
 *
 * Counting `disabled=""` across the whole document is the obvious thing and it is wrong: the pager's
 * two arrows are disabled at the ends of the book, so a document-wide count of dead controls would
 * change with the size of the fixture's collection and quietly stop being a claim about the deck.
 */
const buttonsOfClass = (markup: string, cls: string): string[] =>
    markup.split('<button').filter((chunk) => chunk.startsWith(` type="button" class="${cls}`));

/** The unique-card count of a pile, computed the way the ruling states it rather than counted by eye. */
const uniqueCount = (cards: ReadonlyArray<IRunCard>): number =>
    new Set(cards.map((c) => c.dataId)).size;

describe('LoadoutEditor — the top bar', () => {
    it('prints the context line it was handed, verbatim, and offers exactly one way out', () => {
        /*
         * The component *knows nothing* about where it was opened from — ticket 62 put the gating in
         * the screens rather than here, on the argument that a component checking `node.kind` would
         * have to be taught every new surface and the list of surfaces has already moved twice. What
         * survives of "where am I" is this one string, built by the caller
         * (`RunScreen.contextLine`), so it has to arrive on screen unedited: a screen that
         * upper-cased it, truncated it or dropped the scrap half would be silently deciding a thing
         * its own header says it must not decide.
         *
         * CONFIRM is the only exit, and it is a real button rather than a scrim click, because the
         * editor is a full-frame surface (`rs-frame rs-fixed`) with nothing behind it to click.
         */
        const markup = render(makeRun());

        expect(markup).toContain('<span class="rs-ctx">WORKSHOP · NATURE BIOME · 143 SCRAP</span>');
        expect(markup).toContain('<span class="rs-title">LOADOUT</span>');
        expect(markup).toContain('>CONFIRM</button>');
    });

    it('shows the deck against its floor, computed rather than printed as a guess', () => {
        /*
         * `minimumActiveDeck` is *"the team is the deck, as a floor"* — 8 / 13 / 18 by party size,
         * the party's own base contribution rather than the flat 16 an earlier spec named. The pill
         * is asserted against that function rather than against the number it returns today, so
         * changing `START_KIT_SIZE` moves this expectation with the rule instead of failing a test
         * that was never about the constant.
         *
         * The `at-floor` class is the second half and it is not decoration: it is how the pill and
         * the greyed rows below it are visibly the SAME fact. A solo run opens exactly on its floor
         * (5 engine cards + 3 generics = 8), which is the state most players will first meet this
         * screen in, so both renders are pinned — on the floor and one card above it.
         */
        const run = makeRun();
        const floor = minimumActiveDeck(run.partyIds.length);
        expect(run.deck.length).toBe(floor);

        const atFloor = render(run);
        expect(atFloor).toContain(`<span class="rs-pill at-floor">DECK <b>${floor}</b> / floor ${floor}</span>`);

        const above = makeRun({ deck: [...run.deck, card('hydro_blast', 'mm1')] });
        const markup = render(above);
        expect(markup).toContain(`DECK <b>${floor + 1}</b> / floor ${floor}`);
        expect(markup).not.toContain('at-floor');
    });
});

describe('LoadoutEditor — the roster strip', () => {
    it('draws the party and the bench in one strip, and marks which is which', () => {
        /*
         * Ticket 61 §3: *"a benched member is still yours"*. The strip is the one place in the run
         * where those two populations are drawn side by side, and the distinction has to survive
         * being looked at for half a second — a benched member you mistake for a fielded one is a
         * player walking into the next biome one engine short and not knowing it.
         *
         * So three things are asserted per chip and not one: the member is named from the ranch
         * roster (never the raw definition id), the party chip carries its live deck contribution
         * (`n in deck`, which is what makes benching a legible trade rather than a shrug), and the
         * benched chip carries the `benched` class the CSS greys AND the word itself. Class alone
         * would be a claim about a stylesheet; the word is the claim about the player.
         */
        const run = makeRun({ bench: ['mm2'] });
        const markup = render(run);

        expect(markup).toContain(`<span class="rs-mnm">${GetMingmingData('kraken').name}</span>`);
        expect(markup).toContain('<span class="rs-os">kraken_v1</span>');
        expect(markup).toContain(`<span class="rs-meta">${run.deck.length} in deck</span>`);

        expect(markup).toContain('class="rs-mem benched ');
        expect(markup).toContain(`<span class="rs-mnm">${GetMingmingData('fenrir').name}</span>`);
        expect(markup).toContain('<span class="rs-meta">benched</span>');
        expect(markup).toContain('aria-pressed="false"');

        /*
         * And the other half of the same strip, because every run starts with nobody benched: this
         * is the state the strip is in the first time anybody opens the editor, and an empty
         * half-row reads as a screen that failed to load. The copy has to teach the verb too, since
         * benching is the ONLY thing a party chip does and nothing else on the chip says so — click
         * a member, their five engine cards go to the collection with them. That sentence is the
         * whole of ticket 61 §3's routing story, and it is the only place the editor states it.
         */
        const pair = makeRun({ partyIds: ['mm1', 'mm2'] });
        const empty = render(pair);
        expect(empty).toContain('Nobody benched.');
        expect(empty).toContain('their five engine cards');
        expect(empty).not.toContain('class="rs-mem benched');
        // The verb is on the chip as well as in the hint, so a player who reads one and not the
        // other still finds it.
        expect(empty).toContain('in deck · bench');
    });

    it('refuses to invite a bench a party of one cannot perform', () => {
        /*
         * `benchPartyMember` refuses to empty the party, and **a run OPENS solo** — so the very
         * first editor most players ever see is the one case where the chip's only verb is
         * unavailable. Before this it rendered enabled under a hint reading "click a party member
         * to bench them", and answered the click with a beep.
         *
         * That is precisely the silently inert control ticket 20's precedent forbids, and it was
         * inconsistent with the deck rows two panels over, which DO grey out at the floor and say
         * why. The chip is disabled and the hint names the workshop, which is where the bench
         * actually opens (ticket 06: the party grows there and only there).
         */
        const solo = render(makeRun());

        expect(solo).toContain('A party of one has nobody to bench');
        expect(solo).toContain('a workshop is where the team grows');
        expect(solo).not.toContain('Click a party member to bench them');
        // Disabled, not merely unhelpful — the half a copy-only fix would leave broken.
        const chip = solo.split('<button').find((chunk) => chunk.includes('rs-mem'));
        expect(chip).toBeDefined();
        expect(chip).toContain('disabled=""');
    });
});

describe('LoadoutEditor — the run collection', () => {
    it('heads the book with BOTH counts, because they are two different facts', () => {
        /*
         * `RUN COLLECTION · 10 (9 unique)`. The instance count is what a player editing toward a
         * floor is arithmetic-ing against; the unique count is how many tiles they are about to
         * scroll through. Collapsing them to one number is the tempting simplification and it loses
         * whichever question the reader actually had.
         *
         * The fixture is deliberately lopsided — four instances of one card — so a screen that
         * printed the same number twice cannot pass by coincidence.
         */
        const collection = [...copies('blood_rite', 4), card('undertow'), card('hydro_blast')];
        const markup = render(makeRun({ collection }));

        expect(collection.length).toBe(6);
        expect(uniqueCount(collection)).toBe(3);
        expect(markup).toContain('<h2>RUN COLLECTION · 6 (3 unique)</h2>');
        // And the ALL filter chip counts INSTANCES, matching the first number rather than the tiles.
        expect(markup).toContain('>ALL 6</button>');
    });

    it('stacks duplicates into one tile with a ×N badge — the ruling, in the book', () => {
        /*
         * Henry's amendment, in the panel it was written for: *"one tile per unique card,
         * everywhere."* Four `blood_rite` instances are four rows in `run.collection` and must be ONE
         * tile wearing `×4`. The failure this catches is not exotic — it is `collection.map(...)`,
         * written by somebody reading the field's type, which produces a book that is four-fifths
         * the same card and looks like a data bug rather than a rendering one.
         *
         * Asserted from both ends: the tile count equals the unique count (so nothing was rendered
         * twice), and the badge is absent on the singletons (so nothing prints `×1`, which would be
         * a screen that had noticed instances and then said so uselessly).
         */
        const collection = [...copies('blood_rite', 4), card('undertow'), card('hydro_blast')];
        const markup = render(makeRun({ collection }));

        expect(buttonsOfClass(markup, 'rs-card').length).toBe(uniqueCount(collection));
        expect(markup).toContain('<span class="rs-nbadge">×4</span>');
        expect(markup.match(/rs-nbadge/g)?.length).toBe(1);
        expect(markup).not.toContain('×1<');
    });

    it('prints cost, banner and the FULL card text on every tile', () => {
        /*
         * Henry's 2026-08-23 amendment and its 2026-08-24 follow-up, which `MarketplaceNode` already
         * carries the other half of: *"we need power in the card descriptions otherwise you can't
         * compare cards in the deck builder"*, and then *"I don't like the marketplace UI. You can't
         * see the card descriptions."* This screen IS the deck builder that argument named, so the
         * text is not a nicety — it is the entire reason the mockup's card is 196x252 rather than a
         * row. Henry's requirement was stated as a size claim: energy cost, attack-vs-skill and the
         * full description, readable on every card.
         *
         * The description is compared as the whole `rs-desc` span against the registry string, so a
         * truncated, ellipsised or hover-only implementation fails rather than passing on a prefix.
         * The banner is asserted across all three of `bannerFor`'s outputs in one fixture, including
         * the case that is a ruling rather than a mapping: a `Heal` reads SKILL, because *"a heal is
         * a skill you cast"* and a fourth colour would be three shades of the same idea.
         */
        const ids = ['ink_stream', 'undertow', 'echo_chamber_v2', 'healing_mist'];
        const markup = render(makeRun({ collection: ids.map((id) => card(id)) }));

        for (const id of ids) {
            const data = ProgramRegistry[id];
            expect(data).toBeDefined();
            expect(markup).toContain(`<span class="rs-cnm">${escapeHtml(data.name)}</span>`);
            expect(markup).toContain(`<span class="rs-desc">${escapeHtml(data.description)}</span>`);
        }
        expect(markup).toContain('<span class="rs-typ ATTACK">ATTACK</span>');
        expect(markup).toContain('<span class="rs-typ DAEMON">DAEMON</span>');
        // `undertow` is a Skill and `healing_mist` is a Heal: two categories, one banner.
        expect(markup.match(/<span class="rs-typ SKILL">SKILL<\/span>/g)?.length).toBe(2);
        expect(markup).toContain('<span class="rs-gem">0</span>');
        expect(markup).toContain('<span class="rs-gem">2</span>');
    });

    it('tags a tile by what it is FOR — payoff, generic, benched, or a pick', () => {
        /*
         * The tag line is ordered by what the player is scanning for, and the order is an argument:
         * *"whether it is the engine of somebody who is not on the field is the thing that decides a
         * boundary swap."* All four tags exist for the same reason — every one of them is a fact the
         * card's own name and text cannot tell you.
         *
         * - `payoff` is positional, read from `startKits[os][0]` through `isPayoff`, never from a
         *   second list that could disagree with the registry. `ragnarok_edge` leads `fenrir_v1`.
         * - `benched` is the boundary-swap fact above: mm2 is off the field, so its engine is sitting
         *   in the collection rather than being playable.
         * - `generic` marks `GENERIC_HIT`, the run's filler, so a player editing toward a floor can
         *   see at a glance which cards are the padding they were dealt rather than choices.
         * - `pick` is the negative of all of it: nobody's engine, not filler, therefore something the
         *   run went and got — a reward, a purchase or an event grant.
         *
         * The `payoff` CLASS is asserted alongside the word, because the tile's border is how the
         * mockup makes a payoff findable in a book of eight, and a tag line with no border is a
         * label nobody reads at card size.
         */
        const collection = [
            card('ragnarok_edge', 'mm2'),
            card('blood_rite', 'mm2'),
            card(GENERIC_HIT, 'mm1'),
            card('seed_bomb_v2', null),
        ];
        const markup = render(makeRun({ collection, bench: ['mm2'] }));

        expect(GetMingmingData('fenrir').startKits?.fenrir_v1[0]).toBe('ragnarok_edge');
        expect(markup).toContain('<span class="rs-tags">payoff · benched</span>');
        expect(markup).toContain('<span class="rs-tags">benched</span>');
        expect(markup).toContain('<span class="rs-tags">generic</span>');
        expect(markup).toContain('<span class="rs-tags">pick</span>');
        expect(markup).toContain('class="rs-card payoff"');
        // Exactly one payoff among the four: the tag is a position in an engine, not an adjective.
        expect(markup.match(/class="rs-card payoff"/g)?.length).toBe(1);
    });

    it('says an empty collection is empty, and says how one is filled', () => {
        /*
         * A blank 4x2 grid is indistinguishable from a screen that failed to load, and this is not a
         * rare state — a run that has bought nothing, benched nobody and stored no reward has an
         * empty collection, which is every run until its first real decision. So the empty state has
         * to name all three of the routes in, because "store a card from a fight" is a verb most
         * players will not have met yet at the moment they first see this panel.
         *
         * The pager stays on screen and reads `page 1 / 1` rather than vanishing: `pageCount` is
         * `Math.max(1, ...)` precisely so that an empty book still says where you are. A pager that
         * disappeared would make the empty state look like a different screen.
         */
        const markup = render(makeRun({ collection: [] }));

        expect(markup).toContain('<h2>RUN COLLECTION · 0 (0 unique)</h2>');
        expect(markup).toContain('Nothing here.');
        expect(markup).toContain('buy at a market land in the collection');
        expect(buttonsOfClass(markup, 'rs-card').length).toBe(0);
        expect(markup).toContain('page 1 / 1');
    });
});

describe('LoadoutEditor — the pager', () => {
    it('fills one page and no more, and counts the pages honestly', () => {
        /*
         * `CARDS_PER_PAGE` is the mockup's 4x2 book and it is exported for exactly this: the number
         * is a layout decision (196x252 cards at an 18/16 gap, which is what makes the description
         * legible), so a test that hard-coded 8 would fail for the right reason and read as the
         * wrong one when the card size is next re-argued.
         *
         * Twelve cards is the smallest fixture that proves a book pages at all — eight would render
         * identically whether or not the slice exists.
         */
        const collection = COLLECTION_IDS.map((id) => card(id));
        expect(collection.length).toBeGreaterThan(CARDS_PER_PAGE);

        const markup = render(makeRun({ collection }));

        expect(buttonsOfClass(markup, 'rs-card').length).toBe(CARDS_PER_PAGE);
        expect(markup).toContain('page 1 / 2');
        expect(markup).toContain('duplicates stack with ×N — one tile per unique card');

        /*
         * `shown = page >= pageCount ? 0 : page` is a small line carrying a real state, and it
         * belongs to the same claim: the page index survives a filter, a search and a card being
         * added or removed, and every one of those can shrink the book under the reader's feet.
         * Sending a card back to the deck from page two of a nine-card collection leaves `page` at 1
         * with one page left, and the honest options are "show page one" or "show nothing at all".
         *
         * It shows page one, and the counter agrees with what is on screen — the half that matters,
         * since a book showing cards over the words `page 3 / 1` is worse than either failure.
         */
        const shrunk = [card('ink_stream'), card('undertow')];
        const stale = render(makeRun({ collection: shrunk }), makeRanch(), 4);
        expect(stale).toContain('page 1 / 1');
        expect(buttonsOfClass(stale, 'rs-card').length).toBe(shrunk.length);
    });

    it('shows genuinely different cards on page two — the seam, doing its job', () => {
        /*
         * `initialPage` is a declared test seam and this is the case it was declared for. What is
         * being proved is not that a number changed: it is that the second page holds OTHER cards.
         * A screen that paged the counter but sliced from zero every time would satisfy every
         * assertion about `page 2 / 2` and show the player the same eight cards forever, which in a
         * collection screen is a bug that reads as "I never got the card I bought".
         *
         * So the two pages are compared as SETS, and the union is required to be the whole
         * collection — that catches the slice being off by one at the seam as well as the slice not
         * moving. Deliberately not asserted against a hand-written expected order: the book sorts by
         * cost then name, and a test that restated that sort would be testing its own copy of it.
         */
        const collection = COLLECTION_IDS.map((id) => card(id));
        const first = tileNames(render(makeRun({ collection })));
        const second = tileNames(render(makeRun({ collection }), makeRanch(), 1));

        expect(first.length).toBe(CARDS_PER_PAGE);
        expect(second.length).toBe(collection.length - CARDS_PER_PAGE);
        expect(second.some((name) => first.includes(name))).toBe(false);
        expect(new Set([...first, ...second]).size).toBe(collection.length);
        expect(render(makeRun({ collection }), makeRanch(), 1)).toContain('page 2 / 2');
    });

});

describe('LoadoutEditor — the active deck column', () => {
    it('stacks duplicates in the deck too — the same ruling, the other panel', () => {
        /*
         * *"One tile per unique card, EVERYWHERE."* The deck column is 27px rows rather than 196px
         * tiles, which is exactly why it is the panel most likely to be "fixed" back to one row per
         * instance: rows are cheap, a list of them looks fine, and three separate `Tackle` rows read
         * as a deck with three Tackles in it — which is TRUE and is still the wrong screen, because
         * the player cannot then see the eleven other cards without scrolling past their own filler.
         *
         * A starting solo deck is the perfect fixture and needed no construction: five engine cards
         * plus `STARTER_GENERICS` copies of `GENERIC_HIT`, so the pile is 8 cards in 5 rows with two
         * different multiplicities in it (`pressure_point` ×2 from the kit, the generic ×3).
         */
        const run = makeRun();
        const markup = render(run);
        const rows = buttonsOfClass(markup, 'rs-row');

        expect(run.deck.length).toBeGreaterThan(uniqueCount(run.deck));
        expect(rows.length).toBe(uniqueCount(run.deck));
        expect(markup).toContain(`<h2>ACTIVE DECK · ${run.deck.length} / floor ${minimumActiveDeck(1)}</h2>`);

        for (const [dataId, count] of countByData(run.deck)) {
            const name = escapeHtml(ProgramRegistry[dataId].name);
            expect(markup).toContain(`<span class="rs-rnm">${name}</span>`);
            if (count > 1) {
                expect(rows.find((row) => row.includes(`>${name}<`)))
                    .toContain(`<span class="rs-x">×${count}</span>`);
            }
        }
        // The kit's payoff is tagged in this column too — one row, and only one.
        expect(markup).toContain('<span class="rs-t">payoff</span>');
        expect(markup.match(/>payoff</g)?.length).toBe(1);
    });

    it('greys every row at the floor AND says why — above it, nothing is dead', () => {
        /*
         * The floor is enforced in `runSlice.moveCardToCollection`, not here, and this screen's job
         * is the half the reducer cannot do: telling the player BEFORE they click. Ticket 20's
         * precedent — *a silently inert control is indistinguishable from a bug* — is why the
         * sentence is beside the rows rather than in a tooltip, and why it names both the number and
         * the two ways out of it (bench somebody, or add cards first).
         *
         * Both directions are pinned, and the second is the one a "helpful" patch would break. It is
         * very easy to grey the rows unconditionally, or on `>=` where the rule is `<=`, and a deck
         * one card above its floor that cannot be edited is a screen that has silently stopped being
         * an editor. So: at the floor EVERY row is dead, one above it NO row is — asserted over the
         * `rs-row` buttons alone, because the pager's own arrows are legitimately disabled at the
         * ends of the book and would poison a document-wide count of `disabled`.
         */
        const run = makeRun();
        const floor = minimumActiveDeck(run.partyIds.length);

        const atFloor = render(run);
        const deadRows = buttonsOfClass(atFloor, 'rs-row').filter((row) => row.includes('disabled=""'));
        expect(deadRows.length).toBe(uniqueCount(run.deck));
        expect(atFloor).toContain(`At the floor — ${floor} is what your party itself brings.`);
        expect(atFloor).toContain('Bench a member or add cards before removing any.');

        const above = render(makeRun({ deck: [...run.deck, card('hydro_blast', 'mm1')] }));
        expect(buttonsOfClass(above, 'rs-row').filter((row) => row.includes('disabled=""')).length).toBe(0);
        expect(above).toContain('click a row to send it back. Nothing here costs scrap.');
        expect(above).not.toContain('At the floor');
    });
});

describe('LoadoutEditor — the standing laws', () => {
    it('makes every affordance a real <button>, counted from the state', () => {
        /*
         * `RegionMap`, `MarketplaceNode` and `WorkshopNode` all set this precedent, and ticket 38
         * should inherit screens that already work without a mouse rather than screens that need
         * retrofitting. This screen makes it a bigger claim than any of them: the mockup draws a
         * 196x252 card with an art box, a gem and a badge, and the drag interaction it describes was
         * deliberately shipped as click-to-select then click-to-swap so that the keyboard path
         * exists FIRST. Drag can be added on top of that later; it cannot be retrofitted underneath.
         *
         * The count is spelled out from the fixture rather than eyeballed — CONFIRM, one chip per
         * party and bench member, the ALL chip plus one per element plus the three type chips plus
         * the sort chip, one tile per card on the page, the two pager arrows, one deck row per unique
         * card — so a control added without a tab stop moves the number and fails here rather than
         * shipping as a div somebody clicks with a mouse.
         *
         * The search box is the one control that is legitimately not a button, and it is a real
         * `<input type="search">` rather than a styled div for the same reason.
         */
        const run = makeRun({ collection: COLLECTION_IDS.map((id) => card(id)), bench: ['mm2'] });
        const markup = render(run);

        const filters = 1 + collectionElements(COLLECTION_IDS).length + 3 + 1;
        const expected = 1
            + run.partyIds.length + (run.bench?.length ?? 0)
            + filters
            + CARDS_PER_PAGE
            + 2
            + uniqueCount(run.deck);

        expect(markup.match(/<button/g)?.length).toBe(expected);
        // Every one of them typed explicitly — a bare `<button>` inside a form is a submit, and this
        // screen is one `<form>` away from being one.
        expect(markup.match(/<button type="button"/g)?.length).toBe(expected);
        expect(markup).toContain('<input class="rs-search" type="search"');
        // And nothing faking a control: no ARIA-painted div, no anchor standing in for an action.
        expect(markup).not.toContain('role="button"');
        expect(markup).not.toContain('<a ');
    });

    it('offers a filter per element the collection actually holds, and none it does not', () => {
        /*
         * The chips are derived from the collection rather than from the element table, and the
         * difference is the point: a row of eight elements, five of them matching nothing, is a
         * filter bar that mostly empties the book. `None` is excluded because the only None cards in
         * a run are the generics and `capacitor`-shaped neutrals, and "filter to the filler" is not
         * a question anybody asks — the `generic` tag already answers it on the tile.
         *
         * Asserted in both directions. A screen that printed every element in `ELEMENT_COLOR` passes
         * the positive half alone, which is why the absent one is named too.
         */
        const collection = [card('ink_stream'), card('undertow'), card(GENERIC_HIT, 'mm1')];
        const markup = render(makeRun({ collection }));

        expect(markup).toContain('>WATER</button>');
        expect(markup).not.toContain('>FIRE</button>');
        expect(markup).not.toContain('>NONE</button>');
        // The type chips are fixed, and BENCHED is spelled out — "the engine of somebody not on the
        // field" is the boundary-swap question, and `BENCHED` alone would read as a member filter.
        expect(markup).toContain('>ATTACKS</button>');
        expect(markup).toContain('>SKILLS</button>');
        expect(markup).toContain('>BENCHED ENGINE</button>');
    });
});

/**
 * Instances per `dataId`, in the pile's own order — the count the `×N` badge is claiming.
 *
 * Written here rather than reached for through the screen's own `groupByData` on the same argument
 * `MarketplaceNode.test.tsx` makes about `cardFace`: a test that grouped the cards the way the
 * component groups them could not catch the component grouping them wrongly.
 */
function countByData(cards: ReadonlyArray<IRunCard>): Array<[string, number]> {
    const counts = new Map<string, number>();
    for (const c of cards) counts.set(c.dataId, (counts.get(c.dataId) ?? 0) + 1);
    return [...counts.entries()];
}
