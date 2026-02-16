import React, { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store/store';
import { addCardToDeck, removeCardFromDeck, setActiveDeck } from '../store/gameSlice';
import { GetProgramData } from '../../engine/data/programRegistry';
import { DECK_SIZE } from '../../engine/gameTypes';
import type { Element, ProgramCategory } from '../../engine/types';

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
    const isValid = deckCount === DECK_SIZE;

    // Enriched inventory with program data
    const enrichedCards = useMemo(() => {
        return cardInventory.map(c => ({
            ...c,
            data: GetProgramData(c.dataId)
        }));
    }, [cardInventory]);

    // Filtered + sorted cards
    const filteredCards = useMemo(() => {
        let cards = enrichedCards;
        if (elementFilter !== 'All') {
            cards = cards.filter(c => c.data.element === elementFilter);
        }
        if (categoryFilter !== 'All') {
            cards = cards.filter(c => c.data.category === categoryFilter);
        }
        return cards.sort((a, b) => {
            if (sortBy === 'cost') return a.data.baseCost - b.data.baseCost;
            if (sortBy === 'element') return a.data.element.localeCompare(b.data.element);
            return a.data.name.localeCompare(b.data.name);
        });
    }, [enrichedCards, elementFilter, categoryFilter, sortBy]);

    // Deck cards enriched
    const deckCards = useMemo(() => {
        if (!activeDeck) return [];
        return activeDeck.cards
            .map(instanceId => {
                const owned = cardInventory.find(c => c.instanceId === instanceId);
                if (!owned) return null;
                return { ...owned, data: GetProgramData(owned.dataId) };
            })
            .filter(Boolean) as typeof enrichedCards;
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
                    {deckCount} / {DECK_SIZE}
                    {isValid && <span className="valid-badge">✓ VALID</span>}
                </div>
            </div>

            <div className="deck-terminal-body">
                {/* Left: Inventory */}
                <div className="deck-panel inventory-panel">
                    <h2>📦 Inventory</h2>

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
                        {filteredCards.length === 0 && (
                            <div className="empty-state">No cards in inventory. Win battles to earn cards!</div>
                        )}
                        {filteredCards.map(card => {
                            const inDeck = deckCardIds.has(card.instanceId);
                            return (
                                <div
                                    key={card.instanceId}
                                    className={`deck-card ${inDeck ? 'in-deck' : ''}`}
                                    style={{ borderColor: elementColor(card.data.element) }}
                                    onClick={() => {
                                        if (inDeck) {
                                            dispatch(removeCardFromDeck(card.instanceId));
                                        } else if (deckCount < DECK_SIZE) {
                                            dispatch(addCardToDeck(card.instanceId));
                                        }
                                    }}
                                >
                                    <div className="deck-card-cost">{card.data.baseCost}</div>
                                    <div className="deck-card-name">{card.data.name}</div>
                                    <div className="deck-card-element" style={{ color: elementColor(card.data.element) }}>
                                        {card.data.element}
                                    </div>
                                    <div className="deck-card-category">{card.data.category}</div>
                                    {inDeck && <div className="deck-card-badge">IN DECK</div>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Current Deck */}
                <div className="deck-panel deck-list-panel">
                    <h2>🃏 Active Deck</h2>
                    <div className="deck-list">
                        {deckCards.length === 0 && (
                            <div className="empty-state">Click cards from inventory to add them</div>
                        )}
                        {deckCards.map((card, i) => (
                            <div
                                key={card.instanceId}
                                className="deck-list-item"
                                onClick={() => dispatch(removeCardFromDeck(card.instanceId))}
                            >
                                <span className="deck-list-num">{i + 1}.</span>
                                <span className="deck-list-cost" style={{ color: elementColor(card.data.element) }}>{card.data.baseCost}⚡</span>
                                <span className="deck-list-name">{card.data.name}</span>
                                <span className="deck-list-remove">✕</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
