import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store/store';
import { addCardToDeck, removeCardFromDeck, setActiveDeck, addCardsToDeck, clearDeck } from '../store/gameSlice';
import { GetProgramData } from '../../engine/data/programRegistry';
import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { suggestDeckFill } from '../../engine/deckSuggest';
import { DECK_SIZE, MIN_DECK_SIZE } from '../../engine/gameTypes';
import { ELEMENTS } from '../../engine/types';
import type { ProgramData } from '../../engine/types';
import ProgramCard, { getElementColor, getElementIcon } from '../components/ProgramCard';
import { getElementAccent, getElementBadgeBg, getElementTextColor, badgeTextShadow } from '../utils/contrastText';
import './DeckTerminal.css';

type SortMode = 'name' | 'cost' | 'element';

interface CardGroup {
    dataId: string;
    instances: string[];
    data: ProgramData;
}

// Preferred display order for category chips (only shown when actually owned)
const CATEGORY_ORDER = ['Attack', 'Skill', 'Daemon', 'Heal', 'Status'];

const elementColor = (el: string) => (el === 'None' ? '#8a8a99' : getElementColor(el));

export default function DeckTerminal() {
    const dispatch = useDispatch();
    const { cardInventory, activeDeck, roster, activeParty } = useSelector((s: RootState) => s.game);

    const [elementFilter, setElementFilter] = useState<string>('All');
    const [categoryFilter, setCategoryFilter] = useState<string>('All');
    const [sortBy, setSortBy] = useState<SortMode>('name');
    const [search, setSearch] = useState('');
    const [clearArmed, setClearArmed] = useState(false);
    const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Create deck if none exists (kept from the original screen)
    useEffect(() => {
        if (!activeDeck) {
            dispatch(setActiveDeck({ id: crypto.randomUUID(), name: 'Main Deck', cards: [] }));
        }
    }, [activeDeck, dispatch]);

    useEffect(() => () => {
        if (clearTimer.current) clearTimeout(clearTimer.current);
    }, []);

    const deckCardIds = useMemo(() => new Set(activeDeck?.cards ?? []), [activeDeck]);
    const deckCount = activeDeck?.cards.length ?? 0;
    const isValid = deckCount >= MIN_DECK_SIZE && deckCount <= DECK_SIZE;

    // --- Party ---
    const partyMembers = useMemo(() =>
        activeParty
            .map(id => roster.find(m => m.id === id))
            .filter((m): m is NonNullable<typeof m> => Boolean(m))
            .map(m => ({ member: m, def: MingmingRegistry[m.definitionId] })),
        [activeParty, roster]);

    // --- ×1.5 STAB assist: which active party members match each card element ---
    // ('None' is excluded — every unit carries a 'None' secondary, so it carries no signal.)
    const stabMatchesByElement = useMemo(() => {
        const map: Record<string, { name: string; element: string }[]> = {};
        partyMembers.forEach(({ member, def }) => {
            if (!def) return;
            const name = member.nickname ?? def.name ?? member.definitionId;
            const seen = new Set<string>();
            [def.primaryElement, def.secondaryElement].forEach(el => {
                if (!el || el === 'None' || seen.has(el)) return;
                seen.add(el);
                (map[el] ??= []).push({ name, element: el });
            });
        });
        return map;
    }, [partyMembers]);

    // --- Suggestion (fill empty slots) ---
    const suggestion = useMemo(
        () => suggestDeckFill({ cardInventory, activeDeck, roster, activeParty }),
        [cardInventory, activeDeck, roster, activeParty]
    );

    // --- Inventory grouped by dataId ---
    const inventoryGroups = useMemo<CardGroup[]>(() => {
        const groups: Record<string, CardGroup> = {};
        cardInventory.forEach(c => {
            if (!groups[c.dataId]) {
                groups[c.dataId] = { dataId: c.dataId, instances: [], data: GetProgramData(c.dataId) };
            }
            groups[c.dataId].instances.push(c.instanceId);
        });
        return Object.values(groups);
    }, [cardInventory]);

    // --- Filter chip data (derived from what the player actually owns) ---
    const elementCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        inventoryGroups.forEach(g => {
            counts[g.data.element] = (counts[g.data.element] ?? 0) + g.instances.length;
        });
        return counts;
    }, [inventoryGroups]);

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        inventoryGroups.forEach(g => {
            counts[g.data.category] = (counts[g.data.category] ?? 0) + g.instances.length;
        });
        return counts;
    }, [inventoryGroups]);

    const ownedElements = ELEMENTS.filter(el => elementCounts[el] > 0);
    const ownedCategories = [
        ...CATEGORY_ORDER.filter(c => categoryCounts[c] > 0),
        ...Object.keys(categoryCounts).filter(c => !CATEGORY_ORDER.includes(c)).sort()
    ];

    // --- Filtered + sorted inventory ---
    const filteredInventory = useMemo(() => {
        let list = inventoryGroups;
        if (elementFilter !== 'All') list = list.filter(g => g.data.element === elementFilter);
        if (categoryFilter !== 'All') list = list.filter(g => g.data.category === categoryFilter);
        const q = search.trim().toLowerCase();
        if (q) list = list.filter(g => g.data.name.toLowerCase().includes(q));

        return [...list].sort((a, b) => {
            if (sortBy === 'cost') {
                if (a.data.baseCost !== b.data.baseCost) return a.data.baseCost - b.data.baseCost;
            } else if (sortBy === 'element') {
                const el = a.data.element.localeCompare(b.data.element);
                if (el !== 0) return el;
            }
            return a.data.name.localeCompare(b.data.name);
        });
    }, [inventoryGroups, elementFilter, categoryFilter, search, sortBy]);

    // --- Deck grouped by dataId, sorted by cost then name ---
    const deckGroups = useMemo<CardGroup[]>(() => {
        if (!activeDeck) return [];
        const groups: Record<string, CardGroup> = {};
        activeDeck.cards.forEach(instanceId => {
            const owned = cardInventory.find(c => c.instanceId === instanceId);
            if (!owned) return;
            if (!groups[owned.dataId]) {
                groups[owned.dataId] = { dataId: owned.dataId, instances: [], data: GetProgramData(owned.dataId) };
            }
            groups[owned.dataId].instances.push(instanceId);
        });
        return Object.values(groups).sort((a, b) => {
            if (a.data.baseCost !== b.data.baseCost) return a.data.baseCost - b.data.baseCost;
            return a.data.name.localeCompare(b.data.name);
        });
    }, [activeDeck, cardInventory]);

    // --- Mana curve buckets: 0 / 1 / 2 / 3+ ---
    const curve = useMemo(() => {
        const buckets = [0, 0, 0, 0];
        deckGroups.forEach(g => {
            const idx = Math.min(Math.max(g.data.baseCost, 0), 3);
            buckets[idx] += g.instances.length;
        });
        return buckets;
    }, [deckGroups]);
    const curveMax = Math.max(1, ...curve);

    // --- Element breakdown of the deck ---
    const deckElements = useMemo(() => {
        const counts: Record<string, number> = {};
        deckGroups.forEach(g => {
            counts[g.data.element] = (counts[g.data.element] ?? 0) + g.instances.length;
        });
        return ELEMENTS.filter(el => counts[el] > 0).map(el => ({ element: el, count: counts[el] }));
    }, [deckGroups]);

    // --- Actions ---
    const addFirstAvailable = (group: CardGroup) => {
        const nextId = group.instances.find(id => !deckCardIds.has(id));
        if (nextId && deckCount < DECK_SIZE) dispatch(addCardToDeck(nextId));
    };
    const removeFirstInDeck = (group: CardGroup) => {
        const inDeckId = group.instances.find(id => deckCardIds.has(id));
        if (inDeckId) dispatch(removeCardFromDeck(inDeckId));
    };

    const handleSuggestFill = () => {
        if (suggestion.length > 0) dispatch(addCardsToDeck(suggestion));
    };

    const handleClearClick = () => {
        if (!clearArmed) {
            setClearArmed(true);
            if (clearTimer.current) clearTimeout(clearTimer.current);
            clearTimer.current = setTimeout(() => setClearArmed(false), 2500);
        } else {
            if (clearTimer.current) clearTimeout(clearTimer.current);
            setClearArmed(false);
            dispatch(clearDeck());
        }
    };

    const suggestHint = suggestion.length > 0
        ? `Add ${suggestion.length} card${suggestion.length === 1 ? '' : 's'} tuned to your active party`
        : deckCount >= Math.min(MIN_DECK_SIZE * Math.max(1, partyMembers.length), DECK_SIZE)
            ? 'Deck already meets the suggested size for this party'
            : 'No eligible cards in inventory to add';

    return (
        <div className="deck-terminal dt-root">
            {/* ── Header ── */}
            <div className="dt-header">
                <h1 className="dt-title">⚡ DECK TERMINAL</h1>
                <div className="dt-header-right">
                    <div className={`dt-count ${isValid ? 'valid' : 'invalid'}`}>
                        <span className="dt-count-num">{deckCount}</span>
                        <span className="dt-count-sep">/</span>
                        <span className="dt-count-max">{DECK_SIZE}</span>
                        {isValid
                            ? <span className="dt-count-badge valid">✓ VALID</span>
                            : <span className="dt-count-badge invalid">MIN {MIN_DECK_SIZE}</span>}
                    </div>
                    <button
                        className="dt-btn dt-btn-suggest"
                        onClick={handleSuggestFill}
                        disabled={suggestion.length === 0}
                        title={suggestHint}
                    >
                        ⚡ SUGGEST FILL
                    </button>
                    <button
                        className={`dt-btn dt-btn-clear ${clearArmed ? 'armed' : ''}`}
                        onClick={handleClearClick}
                        disabled={deckCount === 0}
                        title={clearArmed ? 'Click again to confirm' : 'Empty the deck'}
                    >
                        {clearArmed ? '⚠ CONFIRM CLEAR?' : '🗑 CLEAR DECK'}
                    </button>
                </div>
            </div>

            {/* ── Party strip ── */}
            <div className="dt-party-strip">
                <span className="dt-party-label">BUILDING FOR</span>
                {partyMembers.length === 0 && (
                    <span className="dt-party-empty">No active party — assemble one in the Roster Terminal</span>
                )}
                {partyMembers.map(({ member, def }) => {
                    const name = member.nickname ?? def?.name ?? member.definitionId;
                    const el = def?.primaryElement ?? 'None';
                    return (
                        <div className="dt-party-chip" key={member.id} style={{ borderColor: `${elementColor(el)}66` }}>
                            <div className="dt-party-disc" style={{ background: `${elementColor(el)}33`, borderColor: elementColor(el), color: getElementAccent(el) }}>
                                {name.charAt(0).toUpperCase()}
                            </div>
                            <div className="dt-party-info">
                                <span className="dt-party-name">{name}</span>
                                <span className="dt-party-level">Lv. {member.level}</span>
                            </div>
                            <span className="dt-element-chip" style={{ background: `${elementColor(el)}22`, color: getElementAccent(el), borderColor: `${elementColor(el)}88` }}>
                                {getElementIcon(el)} {el}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="dt-body">
                {/* ── Left: Inventory ── */}
                <div className="dt-panel dt-inventory">
                    <div className="dt-panel-title">
                        <h2>📦 INVENTORY</h2>
                        <span className="dt-panel-hint">L-click: add · R-click: remove</span>
                    </div>

                    {cardInventory.length === 0 ? (
                        <div className="dt-empty">
                            <div className="dt-empty-glyph">▦</div>
                            <p>No programs in inventory.</p>
                            <p className="dt-empty-sub">Win battles or synthesize Mingmings to earn cards.</p>
                        </div>
                    ) : (
                        <>
                            <div className="dt-chip-row">
                                <button
                                    className={`dt-chip ${elementFilter === 'All' ? 'active' : ''}`}
                                    onClick={() => setElementFilter('All')}
                                >
                                    All <span className="dt-chip-count">{cardInventory.length}</span>
                                </button>
                                {ownedElements.map(el => (
                                    <button
                                        key={el}
                                        className={`dt-chip ${elementFilter === el ? 'active' : ''}`}
                                        style={elementFilter === el ? { borderColor: elementColor(el), color: getElementAccent(el) } : undefined}
                                        onClick={() => setElementFilter(f => f === el ? 'All' : el)}
                                    >
                                        <span className="dt-chip-dot" style={{ background: elementColor(el) }} />
                                        {el} <span className="dt-chip-count">{elementCounts[el]}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="dt-chip-row">
                                <button
                                    className={`dt-chip ${categoryFilter === 'All' ? 'active' : ''}`}
                                    onClick={() => setCategoryFilter('All')}
                                >
                                    All Types
                                </button>
                                {ownedCategories.map(cat => (
                                    <button
                                        key={cat}
                                        className={`dt-chip ${categoryFilter === cat ? 'active' : ''}`}
                                        onClick={() => setCategoryFilter(f => f === cat ? 'All' : cat)}
                                    >
                                        {cat} <span className="dt-chip-count">{categoryCounts[cat]}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="dt-toolbar">
                                <input
                                    className="dt-search"
                                    type="text"
                                    placeholder="Search programs…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                                <div className="dt-sort">
                                    <span className="dt-sort-label">SORT</span>
                                    {(['name', 'cost', 'element'] as SortMode[]).map(mode => (
                                        <button
                                            key={mode}
                                            className={`dt-sort-btn ${sortBy === mode ? 'active' : ''}`}
                                            onClick={() => setSortBy(mode)}
                                        >
                                            {mode.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="dt-card-grid">
                                {filteredInventory.length === 0 && (
                                    <div className="dt-empty dt-empty-inline">No cards match the current filters.</div>
                                )}
                                {filteredInventory.map(group => {
                                    const inDeckCount = group.instances.filter(id => deckCardIds.has(id)).length;
                                    const canAdd = inDeckCount < group.instances.length && deckCount < DECK_SIZE;
                                    return (
                                        <ProgramCard
                                            key={group.dataId}
                                            data={group.data}
                                            count={group.instances.length}
                                            showBadge={inDeckCount > 0 ? `${inDeckCount} IN DECK` : undefined}
                                            onAdd={() => addFirstAvailable(group)}
                                            onRemove={() => removeFirstInDeck(group)}
                                            addDisabled={!canAdd}
                                            removeDisabled={inDeckCount === 0}
                                            stabMatches={stabMatchesByElement[group.data.element]}
                                            onClick={() => addFirstAvailable(group)}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                removeFirstInDeck(group);
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* ── Right: Deck ── */}
                <div className="dt-panel dt-deck">
                    <div className="dt-panel-title">
                        <h2>🃏 ACTIVE DECK</h2>
                        <span className="dt-panel-hint">{activeDeck?.name ?? ''}</span>
                    </div>

                    {deckCount === 0 ? (
                        <div className="dt-empty">
                            <div className="dt-empty-glyph">▚</div>
                            <p>Deck is empty.</p>
                            <p className="dt-empty-sub">
                                Click cards on the left to add them — or hit <strong>⚡ SUGGEST FILL</strong> to auto-build around your party.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Mana curve */}
                            <div className="dt-stats-block">
                                <div className="dt-stats-label">MANA CURVE</div>
                                <div className="dt-curve">
                                    {curve.map((count, i) => (
                                        <div className="dt-curve-col" key={i}>
                                            <span className="dt-curve-value">{count > 0 ? count : ''}</span>
                                            <div className="dt-curve-bar-track">
                                                <div
                                                    className="dt-curve-bar"
                                                    style={{ height: `${Math.max(count > 0 ? 8 : 0, (count / curveMax) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="dt-curve-tick">{i < 3 ? i : '3+'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Element breakdown */}
                            <div className="dt-stats-block">
                                <div className="dt-stats-label">ELEMENTS</div>
                                <div className="dt-element-bar">
                                    {deckElements.map(({ element, count }) => (
                                        <div
                                            key={element}
                                            className="dt-element-segment"
                                            style={{ flexGrow: count, background: elementColor(element) }}
                                            title={`${element}: ${count}`}
                                        />
                                    ))}
                                </div>
                                <div className="dt-element-legend">
                                    {deckElements.map(({ element, count }) => (
                                        <span className="dt-legend-item" key={element}>
                                            <span className="dt-chip-dot" style={{ background: elementColor(element) }} />
                                            {element}: {count}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Deck rows */}
                            <div className="dt-deck-rows">
                                {deckGroups.map(group => {
                                    const inDeckCount = group.instances.length;
                                    const ownedTotal = cardInventory.filter(c => c.dataId === group.dataId).length;
                                    const canAddMore = ownedTotal > inDeckCount && deckCount < DECK_SIZE;
                                    return (
                                        <div
                                            className="dt-deck-row"
                                            key={group.dataId}
                                            style={{ borderLeftColor: elementColor(group.data.element) }}
                                        >
                                            <span
                                                className="dt-cost-gem"
                                                style={{
                                                    background: getElementBadgeBg(group.data.element),
                                                    borderColor: elementColor(group.data.element),
                                                    color: getElementTextColor(group.data.element),
                                                    textShadow: badgeTextShadow(getElementTextColor(group.data.element))
                                                }}
                                            >
                                                {group.data.baseCost}
                                            </span>
                                            <span className="dt-row-name" title={group.data.description}>{group.data.name}</span>
                                            <span className="dt-row-count">x{inDeckCount}</span>
                                            <div className="dt-row-actions">
                                                <button
                                                    className="dt-row-btn minus"
                                                    onClick={() => dispatch(removeCardFromDeck(group.instances[0]))}
                                                    title="Remove one copy"
                                                >
                                                    −
                                                </button>
                                                <button
                                                    className="dt-row-btn plus"
                                                    disabled={!canAddMore}
                                                    onClick={() => {
                                                        const spare = cardInventory.find(
                                                            c => c.dataId === group.dataId && !deckCardIds.has(c.instanceId)
                                                        );
                                                        if (spare && deckCount < DECK_SIZE) dispatch(addCardToDeck(spare.instanceId));
                                                    }}
                                                    title={canAddMore ? 'Add another owned copy' : (deckCount >= DECK_SIZE ? 'Deck is full' : 'No spare copies owned')}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {!isValid && deckCount < MIN_DECK_SIZE && (
                                <div className="dt-validity-footer">
                                    ⚠ Minimum {MIN_DECK_SIZE} cards required — add {MIN_DECK_SIZE - deckCount} more
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
