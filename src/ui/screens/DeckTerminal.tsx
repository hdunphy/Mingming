import React, { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store/store';
import { addCardToDeck, removeCardFromDeck, setActiveDeck } from '../store/gameSlice';
import { GetProgramData } from '../../engine/data/programRegistry';
import { DECK_SIZE, MIN_DECK_SIZE } from '../../engine/gameTypes';
import type { Element, ProgramCategory } from '../../engine/types';
import ProgramCard from '../components/ProgramCard';

type FilterElement = Element | 'All';
type FilterCategory = ProgramCategory | 'All';

export default function DeckTerminal() {
    const dispatch = useDispatch();
    const { cardInventory, activeDeck } = useSelector((s: RootState) => s.game);

    const [elementFilter, setElementFilter] = useState<FilterElement>('All');
    const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('All');
    const [sortBy, setSortBy] = useState<'name' | 'cost' | 'element'>('name');

    // Create deck if none exists
    React.useEffect(() => {
        if (!activeDeck) {
            dispatch(setActiveDeck({ id: crypto.randomUUID(), name: 'Main Deck', cards: [] }));
        }
    }, [activeDeck, dispatch]);

    const deckCardIds = new Set(activeDeck?.cards ?? []);
    const deckCount = activeDeck?.cards.length ?? 0;
    const isValid = deckCount >= MIN_DECK_SIZE && deckCount <= DECK_SIZE;

    // Enriched inventory with program data
    const enrichedCards = useMemo(() => {
        return cardInventory.map(c => ({
            ...c,
            data: GetProgramData(c.dataId)
        }));
    }, [cardInventory]);

    // Filtered + sorted cards grouped by dataId
    const groupedInventory = useMemo(() => {
        const groups: Record<string, { dataId: string; instances: string[]; data: any }> = {};

        enrichedCards.forEach(c => {
            if (!groups[c.dataId]) {
                groups[c.dataId] = { dataId: c.dataId, instances: [], data: c.data };
            }
            groups[c.dataId].instances.push(c.instanceId);
        });

        const list = Object.values(groups);
        let filtered = list;
        if (elementFilter !== 'All') {
            filtered = filtered.filter(g => g.data.element === elementFilter);
        }
        if (categoryFilter !== 'All') {
            filtered = filtered.filter(g => g.data.category === categoryFilter);
        }

        return filtered.sort((a, b) => {
            if (sortBy === 'cost') return a.data.baseCost - b.data.baseCost;
            if (sortBy === 'element') return a.data.element.localeCompare(b.data.element);
            return a.data.name.localeCompare(b.data.name);
        });
    }, [enrichedCards, elementFilter, categoryFilter, sortBy]);

    // Deck cards stacked
    const stackedDeck = useMemo(() => {
        if (!activeDeck) return [];
        const groups: Record<string, { dataId: string; instances: string[]; data: any }> = {};

        activeDeck.cards.forEach(instanceId => {
            const owned = cardInventory.find(c => c.instanceId === instanceId);
            if (!owned) return;
            const data = GetProgramData(owned.dataId);
            if (!groups[owned.dataId]) {
                groups[owned.dataId] = { dataId: owned.dataId, instances: [], data };
            }
            groups[owned.dataId].instances.push(instanceId);
        });
        return Object.values(groups);
    }, [activeDeck, cardInventory]);

    const elementColor = (el: string) => {
        const map: Record<string, string> = {
            Fire: 'var(--fire)', Water: 'var(--water)', Nature: 'var(--nature)',
            Earth: 'var(--earth)', Air: 'var(--air)', Ice: 'var(--ice)',
            Light: 'var(--light)', Dark: 'var(--dark)', None: '#888'
        };
        return map[el] ?? '#888';
    };

    return (
        <div className="deck-terminal">
            <div className="deck-terminal-header">
                <h1>⚡ Deck Terminal</h1>
                <div className="deck-counter" style={{ color: isValid ? 'var(--hp-green)' : 'var(--hp-red)' }}>
                    {deckCount} / {MIN_DECK_SIZE}
                    {isValid && <span className="valid-badge">✓ VALID</span>}
                    {!isValid && deckCount < MIN_DECK_SIZE && <span className="invalid-badge" style={{ fontSize: '0.8rem', marginLeft: '10px' }}> (Min {MIN_DECK_SIZE} req.)</span>}
                </div>
            </div>

            <div className="deck-terminal-body">
                {/* Left: Inventory */}
                <div className="deck-panel inventory-panel">
                    <h2>📦 Inventory</h2>
                    <p className="synthesis-hint">
                        Left Click: Add to deck | Right Click: Remove from deck
                    </p>

                    <div className="filter-bar">
                        <select value={elementFilter} onChange={e => setElementFilter(e.target.value as FilterElement)}>
                            <option value="All">All Elements</option>
                            {['Fire', 'Water', 'Nature', 'Earth', 'Air', 'Ice', 'Light', 'Dark', 'None'].map(el => (
                                <option key={el} value={el}>{el}</option>
                            ))}
                        </select>
                        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as FilterCategory)}>
                            <option value="All">All Types</option>
                            {['Attack', 'Heal', 'Status', 'Special'].map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
                            <option value="name">Sort: Name</option>
                            <option value="cost">Sort: Cost</option>
                            <option value="element">Sort: Element</option>
                        </select>
                    </div>

                    <div className="card-grid">
                        {groupedInventory.length === 0 && (
                            <div className="empty-state">No cards in inventory. Win battles to earn cards!</div>
                        )}
                        {groupedInventory.map(group => {
                            const inDeckCount = group.instances.filter(id => deckCardIds.has(id)).length;
                            const isFullyInDeck = inDeckCount === group.instances.length;

                            return (
                                <ProgramCard
                                    key={group.dataId}
                                    data={group.data}
                                    count={group.instances.length}
                                    showBadge={inDeckCount > 0 ? `${inDeckCount} IN DECK` : undefined}
                                    onClick={() => {
                                        // Find first instance NOT in deck
                                        const nextId = group.instances.find(id => !deckCardIds.has(id));
                                        if (nextId && deckCount < DECK_SIZE) {
                                            dispatch(addCardToDeck(nextId));
                                        }
                                    }}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        // Find first instance IN deck
                                        const inDeckId = group.instances.find(id => deckCardIds.has(id));
                                        if (inDeckId) {
                                            dispatch(removeCardFromDeck(inDeckId));
                                        }
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Right: Current Deck */}
                <div className="deck-panel deck-list-panel">
                    <h2>🃏 Active Deck</h2>
                    <div className="deck-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {stackedDeck.length === 0 && (
                            <div className="empty-state">Click cards from inventory to add them</div>
                        )}
                        {stackedDeck.map((group) => (
                            <div
                                key={group.dataId}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>{group.instances.length}x</span>
                                    <span>{group.data.name}</span>
                                </div>
                                <button
                                    onClick={() => dispatch(removeCardFromDeck(group.instances[0]))}
                                    style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}
                                >
                                    REMOVE
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
