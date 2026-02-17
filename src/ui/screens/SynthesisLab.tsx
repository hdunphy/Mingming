import React, { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store/store';
import {
    removeCardFromInventory,
    addScrap,
    spendScrap,
    addToRoster,
    addBlueprint
} from '../store/gameSlice';
import { getScrapYield } from '../../engine/RewardSystem';
import { GetProgramData } from '../../engine/data/programRegistry';
import { createMingmingInstance } from '../../engine/gameTypes';

export default function SynthesisLab() {
    const dispatch = useDispatch();
    const { cardInventory, scrapCount, blueprints } = useSelector((s: RootState) => s.game);
    const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
    const [lastCompiled, setLastCompiled] = useState<string | null>(null);

    // Calculate total scrap from selected cards
    const selectedScrap = useMemo(() => {
        let total = 0;
        for (const id of selectedCards) {
            total += getScrapYield(); // Default Common for now
        }
        return total;
    }, [selectedCards]);

    const toggleCard = (instanceId: string) => {
        setSelectedCards(prev => {
            const next = new Set(prev);
            if (next.has(instanceId)) next.delete(instanceId);
            else next.add(instanceId);
            return next;
        });
    };

    const scrapSelected = () => {
        for (const instanceId of selectedCards) {
            dispatch(removeCardFromInventory(instanceId));
        }
        dispatch(addScrap(selectedScrap));
        setSelectedCards(new Set());
    };

    const compileMingming = (architectureId: string, cost: number) => {
        if (scrapCount < cost) return;
        dispatch(spendScrap(cost));
        const newMm = createMingmingInstance(architectureId, 1);
        dispatch(addToRoster(newMm));
        setLastCompiled(architectureId);
        setTimeout(() => setLastCompiled(null), 2000);
    };

    const enrichedCards = useMemo(() => {
        return cardInventory.map(c => ({ ...c, data: GetProgramData(c.dataId) }));
    }, [cardInventory]);

    return (
        <div className="synthesis-lab">
            <div className="synthesis-header">
                <h1>🔬 Synthesis Lab</h1>
                <div className="scrap-balance">
                    <span className="scrap-icon">⚙️</span>
                    <span className="scrap-count">{scrapCount}</span>
                    <span className="scrap-label">Scrap</span>
                </div>
            </div>

            <div className="synthesis-body">
                {/* Left: Deconstruction */}
                <div className="synthesis-panel">
                    <h2>🔥 Deconstruct Programs</h2>
                    <p className="synthesis-hint">Select cards to scrap for materials</p>

                    <div className="card-grid">
                        {enrichedCards.length === 0 && (
                            <div className="empty-state">No cards to scrap</div>
                        )}
                        {enrichedCards.map(card => {
                            const isSelected = selectedCards.has(card.instanceId);
                            return (
                                <div
                                    key={card.instanceId}
                                    className={`deck-card scrap-card ${isSelected ? 'selected-scrap' : ''}`}
                                    onClick={() => toggleCard(card.instanceId)}
                                >
                                    <div className="deck-card-cost">{card.data.baseCost}</div>
                                    <div className="deck-card-name">{card.data.name}</div>
                                    <div className="deck-card-category">{card.data.category}</div>
                                    {isSelected && <div className="deck-card-badge scrap-badge">SCRAP</div>}
                                </div>
                            );
                        })}
                    </div>

                    {selectedCards.size > 0 && (
                        <button className="scrap-button" onClick={scrapSelected}>
                            🔥 Scrap {selectedCards.size} cards → +{selectedScrap} ⚙️
                        </button>
                    )}
                </div>

                {/* Right: Compilation */}
                <div className="synthesis-panel">
                    <h2>🛠️ Compile MingMing</h2>
                    <p className="synthesis-hint">Use Blueprints + Scrap to create units</p>

                    <div className="blueprint-grid">
                        {blueprints.length === 0 && (
                            <div className="empty-state">No blueprints found. Defeat enemies for rare drops!</div>
                        )}
                        {blueprints.map(bp => {
                            const canAfford = scrapCount >= bp.compileCost;
                            return (
                                <div
                                    key={bp.architectureId}
                                    className={`blueprint-card ${canAfford ? 'affordable' : 'locked'}`}
                                    onClick={() => canAfford && compileMingming(bp.architectureId, bp.compileCost)}
                                >
                                    <div className="bp-name">{bp.name}</div>
                                    <div className="bp-cost">
                                        {bp.compileCost} ⚙️
                                    </div>
                                    {lastCompiled === bp.architectureId && (
                                        <div className="compile-flash">✨ Compiled!</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
