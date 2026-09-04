/**
 * THE LOADOUT EDITOR — ticket 62 Option F, built to the mockup.
 *
 * `research/62-editor-proto/editor_F_big_paged.html` is the spec, and it is a pixel spec: the card
 * is 196x252 with a 78px art box, the book is 4x2 with an 18/16 gap, the deck rows are 27px. Those
 * numbers are in `LoadoutEditor.css` transcribed rather than approximated, because "Hearthstone
 * collection feel" is a claim about size — Henry's requirement was that **energy cost, attack-vs-skill
 * and the full description are readable on every card**, and each of those is a font size that only
 * works at that card size.
 *
 * # ONE SURFACE, FOUR DOORS
 *
 * Ticket 62: *"the same F editor serves all four edit surfaces (market, workshop, boundary accept,
 * pre-gauntlet)."* So this component takes a `context` label and knows nothing else about where it
 * was opened from. The gating — which nodes may open it — belongs to the screens, not here; a
 * component that checked the node kind would have to be taught every new surface, and the list of
 * surfaces is a design decision that has already moved twice.
 *
 * # THE DUPLICATE RULE IS A RENDERING RULE, NOT A DATA RULE
 *
 * Henry's amendment: *"one tile per unique card, everywhere."* The run holds `IRunCard` INSTANCES —
 * it has to, because `instanceId` is what a sale, a move and the departure bookkeeping all key on —
 * so the grouping happens at render and the ×N badge is the count. Adding or removing a duplicate
 * moves one instance and the badge follows. The header prints both numbers ("10 (9 unique)") because
 * the two are different facts and a player editing to a floor needs the first one.
 *
 * # CLICK, NOT DRAG
 *
 * The mockup says *"drag a benched mingming onto a party slot to swap"*. This ships click-to-select
 * then click-to-swap, and every affordance is a real `<button>` — the standing rule `RegionMap`,
 * `MarketplaceNode` and `WorkshopNode` all follow, so that ticket 38 inherits screens that already
 * work without a mouse. Drag can be added ON TOP of this later; it cannot be retrofitted underneath.
 *
 * # THE FLOOR IS NOT ENFORCED HERE
 *
 * It is enforced in `runSlice.moveCardToCollection`. This screen greys the rows that would break it
 * and prints the pill, but a screen that forgets to grey something still cannot produce an illegal
 * deck. Same argument ticket 20 made for affordability living beside the payment.
 */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useDispatch } from 'react-redux';

import { GetMingmingData, GENERIC_HIT } from '../../engine/data/mingmingRegistry';
import { minimumActiveDeck } from '../../engine/run/createRun';
import type { IRanchMember, IRanchState, IRunCard, IRunState } from '../../engine/runTypes';
import { playSfx } from '../audio/AudioEngine';
import {
    benchPartyMember,
    moveCardToCollection,
    moveCardToDeck,
    swapBenchMember,
} from '../store/runSlice';
import { cardFace, colorFor, groupByData, isPayoff, type Banner } from './runShell';
import './runShell.css';
import './LoadoutEditor.css';
import { ElementMark, EnergyPips, TypeMark } from './CardChassis';

/** Eight big cards, four across and two down. The mockup's page size, and the reason it pages. */
export const CARDS_PER_PAGE = 8;

/** One tile: a unique dataId, its instances, and everything the tile prints. */
interface Stack {
    readonly dataId: string;
    readonly instances: ReadonlyArray<IRunCard>;
    readonly name: string;
    readonly description: string;
    readonly element: string;
    readonly cost: number;
    readonly banner: Banner;
    readonly payoff: boolean;
    readonly tags: string;
}

export interface LoadoutEditorProps {
    readonly run: IRunState;
    readonly ranch: IRanchState;
    /** "WORKSHOP · NATURE BIOME · 143 SCRAP" — the mockup's context line, built by the caller. */
    readonly context: string;
    readonly onClose: () => void;
    /** Test seam: `renderToStaticMarkup` cannot click a pager. */
    readonly initialPage?: number;
}

type ElementFilter = 'ALL' | string;
type TypeFilter = 'ALL' | 'ATTACKS' | 'SKILLS' | 'BENCHED';
type Sort = 'COST' | 'NAME';

/**
 * A card's tag line. Ordered by what a player is actually scanning for: whether it is the engine of
 * somebody who is not on the field is the thing that decides a boundary swap.
 */
function tagsFor(card: IRunCard, payoff: boolean, bench: ReadonlyArray<string>): string {
    const parts: string[] = [];
    if (payoff) parts.push('payoff');
    if (card.dataId === GENERIC_HIT) parts.push('generic');
    if (card.ownerId && bench.includes(card.ownerId)) parts.push('benched');
    else if (!card.ownerId && card.dataId !== GENERIC_HIT) parts.push('pick');
    return parts.join(' \u00b7 ');
}

/**
 * The collection and the deck as tiles — `groupByData` does the duplicate collapsing that every
 * screen shares, and this adds the two facts only the editor prints: whether the stack is somebody's
 * payoff, and the tag line above.
 *
 * A module-level pure function rather than a closure over component state: a closure is rebuilt
 * every render, so the `useMemo`s that call it could never actually memoize.
 */
function stacksOf(
    cards: ReadonlyArray<IRunCard>,
    bench: ReadonlyArray<string>,
    roster: ReadonlyArray<IRanchMember>,
): Stack[] {
    return groupByData(cards).map(({ dataId, instances }) => {
        const payoff = instances.some((card) => isPayoff(card, roster));
        return {
            ...cardFace(dataId),
            instances,
            payoff,
            tags: tagsFor(instances[0], payoff, bench),
        };
    });
}

export default function LoadoutEditor({
    run, ranch, context, onClose, initialPage = 0,
}: LoadoutEditorProps): ReactNode {
    const dispatch = useDispatch();
    const [page, setPage] = useState(initialPage);
    const [element, setElement] = useState<ElementFilter>('ALL');
    const [type, setType] = useState<TypeFilter>('ALL');
    const [sort, setSort] = useState<Sort>('COST');
    const [search, setSearch] = useState('');
    /** The benched member awaiting a party slot to swap into. Null is the ordinary state. */
    const [swapping, setSwapping] = useState<string | null>(null);

    // Memoized because `?? []` mints a new array every render, which would defeat every `useMemo`
    // below it — the lint rule that catches this is doing real work, not being fussy.
    const collection = useMemo(() => run.collection ?? [], [run.collection]);
    const bench = useMemo(() => run.bench ?? [], [run.bench]);
    const floor = minimumActiveDeck(run.partyIds.length);
    const atFloor = run.deck.length <= floor;

    const memberOf = (id: string): IRanchMember | undefined => ranch.roster.find((m) => m.id === id);

    const collectionStacks = useMemo(
        () => stacksOf(collection, bench, ranch.roster), [collection, bench, ranch.roster]);
    const deckStacks = useMemo(
        () => stacksOf(run.deck, bench, ranch.roster), [run.deck, bench, ranch.roster]);

    const visible = useMemo(() => {
        const query = search.trim().toLowerCase();
        return collectionStacks
            .filter((s) => (element === 'ALL' ? true : s.element === element))
            .filter((s) => {
                if (type === 'ALL') return true;
                if (type === 'ATTACKS') return s.banner === 'ATTACK';
                if (type === 'SKILLS') return s.banner !== 'ATTACK';
                return s.instances.some((c) => c.ownerId !== null && bench.includes(c.ownerId));
            })
            .filter((s) => (query === '' ? true : s.name.toLowerCase().includes(query)))
            .sort((a, b) => (sort === 'COST' ? a.cost - b.cost || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)));
    }, [collectionStacks, element, type, sort, search, bench]);

    const pageCount = Math.max(1, Math.ceil(visible.length / CARDS_PER_PAGE));
    const shown = page >= pageCount ? 0 : page;
    const pageCards = visible.slice(shown * CARDS_PER_PAGE, shown * CARDS_PER_PAGE + CARDS_PER_PAGE);

    const elements = useMemo(
        () => [...new Set(collectionStacks.map((s) => s.element))].filter((e) => e !== 'None').sort(),
        [collectionStacks],
    );

    const add = (stack: Stack): void => {
        dispatch(moveCardToDeck(stack.instances[0].instanceId));
        playSfx('uiClick');
    };

    const send = (stack: Stack): void => {
        if (atFloor) { playSfx('uiError'); return; }
        dispatch(moveCardToCollection(stack.instances[0].instanceId));
        playSfx('uiClick');
    };

    /**
     * Can this chip be clicked at all? A party of one cannot bench its only member — `benchPartyMember`
     * refuses it — and a run OPENS solo, so this is the first editor most players ever see.
     *
     * Computed rather than left to the handler's `playSfx('uiError')`, because ticket 20's precedent
     * is that a dead control says what it is short of: a chip that renders enabled under a hint
     * reading *"click a party member to bench them"* and then only beeps is exactly the silently
     * inert button that reads as a bug. Swapping a benched member IN is always allowed, so the
     * refusal is scoped to the bench-outright verb.
     */
    const canBench = run.partyIds.length > 1;

    const onPartyChip = (memberId: string): void => {
        if (swapping) {
            dispatch(swapBenchMember({ outId: memberId, inId: swapping }));
            setSwapping(null);
            playSfx('rewardClaim');
            return;
        }
        // No benched member selected: benching outright is the other verb this chip carries.
        if (!canBench) { playSfx('uiError'); return; }
        dispatch(benchPartyMember(memberId));
        playSfx('uiClick');
    };

    const memberCardCount = (memberId: string): number =>
        run.deck.filter((card) => card.ownerId === memberId).length;

    return (
        <div className="led rs-frame rs-fixed">
            <div className="rs-top">
                <span className="rs-title">LOADOUT</span>
                <span className="rs-ctx">{context}</span>
                <span className="rs-spacer" />
                <span className={`rs-pill ${atFloor ? 'at-floor' : ''}`}>
                    DECK <b>{run.deck.length}</b> / floor {floor}
                </span>
                <button type="button" className="rs-btn primary" onClick={() => { playSfx('uiClick'); onClose(); }}>
                    CONFIRM
                </button>
            </div>

            <div className="led-roster">
                {run.partyIds.map((id) => {
                    const member = memberOf(id);
                    if (!member) return null;
                    const data = GetMingmingData(member.definitionId);
                    return (
                        <button
                            key={id}
                            type="button"
                            className={`rs-mem ${swapping ? 'led-target' : ''}`}
                            style={{ ['--el' as string]: colorFor(data.primaryElement) }}
                            disabled={!swapping && !canBench}
                            onClick={() => onPartyChip(id)}
                        >
                            <span className="rs-dot">{data.name.charAt(0)}</span>
                            <span className="rs-mem-text">
                                <span className="rs-mnm">{member.nickname ?? data.name}</span>
                                <span className="rs-os">{member.activeOS}</span>
                            </span>
                            <span className="rs-meta">
                                {swapping
                                    ? 'swap in ⇄'
                                    : canBench
                                        ? `${memberCardCount(id)} in deck · bench`
                                        : `${memberCardCount(id)} in deck`}
                            </span>
                        </button>
                    );
                })}
                {bench.map((id) => {
                    const member = memberOf(id);
                    if (!member) return null;
                    const data = GetMingmingData(member.definitionId);
                    return (
                        <button
                            key={id}
                            type="button"
                            className={`rs-mem benched ${swapping === id ? 'sel' : ''}`}
                            style={{ ['--el' as string]: colorFor(data.primaryElement) }}
                            aria-pressed={swapping === id}
                            onClick={() => { setSwapping(swapping === id ? null : id); playSfx('uiClick'); }}
                        >
                            <span className="rs-dot">{data.name.charAt(0)}</span>
                            <span className="rs-mem-text">
                                <span className="rs-mnm">{member.nickname ?? data.name}</span>
                                <span className="rs-os">{member.activeOS}</span>
                            </span>
                            <span className="rs-meta">{swapping === id ? 'pick a slot' : 'benched'}</span>
                        </button>
                    );
                })}
                {bench.length === 0 && (
                    <span className="rs-hint led-bench-hint">
                        {canBench
                            ? 'Nobody benched. Click a party member to bench them — their five engine cards go to the collection with them.'
                            : 'A party of one has nobody to bench — a workshop is where the team grows, and the bench opens with it.'}
                    </span>
                )}
            </div>

            <div className="led-body">
                <div className="rs-panel led-center">
                    <h2>
                        RUN COLLECTION · {collection.length} ({collectionStacks.length} unique)
                    </h2>

                    <div className="led-filters">
                        <button type="button" className={`rs-f ${element === 'ALL' ? 'on' : ''}`} onClick={() => setElement('ALL')}>
                            ALL {collection.length}
                        </button>
                        {elements.map((el) => (
                            <button key={el} type="button" className={`rs-f ${element === el ? 'on' : ''}`} onClick={() => setElement(el)}>
                                {el.toUpperCase()}
                            </button>
                        ))}
                        {(['ATTACKS', 'SKILLS', 'BENCHED'] as const).map((t) => (
                            <button key={t} type="button" className={`rs-f ${type === t ? 'on' : ''}`} onClick={() => setType(type === t ? 'ALL' : t)}>
                                {t === 'BENCHED' ? 'BENCHED ENGINE' : t}
                            </button>
                        ))}
                        <span className="rs-spacer" />
                        <button type="button" className="rs-f" onClick={() => setSort(sort === 'COST' ? 'NAME' : 'COST')}>
                            SORT: {sort} ▾
                        </button>
                        <input
                            className="rs-search"
                            type="search"
                            placeholder="search"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                        />
                    </div>

                    <div className="led-grid">
                        {pageCards.map((stack) => (
                            <button
                                key={stack.dataId}
                                type="button"
                                className={`rs-card ${stack.payoff ? 'payoff' : ''}`}
                                style={{ ['--el' as string]: colorFor(stack.element) }}
                                onClick={() => add(stack)}
                            >
                                <EnergyPips cost={stack.cost} />
                                <TypeMark banner={stack.banner} />
                                <span className="rs-art" />
                                <span className="rs-cnm">{stack.name}</span>
                                <span className="rs-desc">{stack.description}</span>
                                <span className="rs-tags">
                                    <ElementMark element={stack.element} />
                                    {stack.tags && <span className="rs-tg">{stack.tags}</span>}
                                </span>
                                {stack.instances.length > 1 && (
                                    <span className="rs-nbadge">×{stack.instances.length}</span>
                                )}
                                <span className="rs-elbar" />
                            </button>
                        ))}
                        {pageCards.length === 0 && (
                            <span className="led-empty">
                                {/* Two different empty books, and telling a player holding twelve
                                    cards that nothing has landed in their collection yet is the
                                    kind of wrong that makes them stop trusting the screen. The
                                    filter is the only thing between them and their cards, so the
                                    copy names it. */}
                                {collectionStacks.length === 0
                                    ? 'Nothing here. Cards you store from a fight, bench with a member, or buy at a market land in the collection.'
                                    : `Nothing matches. Your collection holds ${collection.length} cards — clear the filters or the search to see them.`}
                            </span>
                        )}
                    </div>

                    <div className="led-pager">
                        <button type="button" className="led-page-btn" disabled={shown === 0} onClick={() => setPage(shown - 1)}>◀</button>
                        <span>page {shown + 1} / {pageCount}</span>
                        <button type="button" className="led-page-btn" disabled={shown >= pageCount - 1} onClick={() => setPage(shown + 1)}>▶</button>
                        <span className="rs-hint">duplicates stack with ×N — one tile per unique card</span>
                    </div>
                </div>

                <div className="rs-panel led-deck">
                    <h2>ACTIVE DECK · {run.deck.length} / floor {floor}</h2>
                    <div className="led-rows">
                        {deckStacks
                            .slice()
                            .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
                            .map((stack) => (
                                <button
                                    key={stack.dataId}
                                    type="button"
                                    className="rs-row"
                                    style={{ ['--el' as string]: colorFor(stack.element) }}
                                    disabled={atFloor}
                                    onClick={() => send(stack)}
                                >
                                    <span className="rs-g">{stack.cost}</span>
                                    <ElementMark element={stack.element} compact />
                                    <span className="rs-rnm">{stack.name}</span>
                                    {stack.tags && <span className="rs-t">{stack.tags}</span>}
                                    {stack.instances.length > 1 && <span className="rs-x">×{stack.instances.length}</span>}
                                </button>
                            ))}
                    </div>
                    <p className="rs-hint led-foot">
                        {atFloor
                            ? `At the floor — ${floor} is what your party itself brings. Bench a member or add cards before removing any.`
                            : 'Click a card in the collection to add it · click a row to send it back. Nothing here costs scrap.'}
                    </p>
                </div>
            </div>
        </div>
    );
}
