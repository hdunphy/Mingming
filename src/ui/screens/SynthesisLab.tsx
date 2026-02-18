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
import ProgramCard from '../components/ProgramCard';

export default function SynthesisLab() {
    const dispatch = useDispatch();
    const { cardInventory, scrapCount, blueprints } = useSelector((s: RootState) => s.game);
    const [selectedCards, setSelectedCards] = useState<Map<string, string[]>>(new Map()); // dataId -> instanceIds
    const [lastCompiled, setLastCompiled] = useState<string | null>(null);

    const selectedScrap = useMemo(() => {
        let total = 0;
        selectedCards.forEach(ids => {
            total += ids.length * getScrapYield();
        });
        return total;
    }, [selectedCards]);

    const addOne = (dataId: string, availableIds: string[]) => {
        setSelectedCards(prev => {
            const next = new Map(prev);
            const current = next.get(dataId) || [];
            if (current.length < availableIds.length) {
                // Find an ID not already selected
                const nextId = availableIds.find(id => !current.includes(id));
                if (nextId) next.set(dataId, [...current, nextId]);
            }
            return next;
        });
    };

    const removeOne = (dataId: string) => {
        setSelectedCards(prev => {
            const next = new Map(prev);
            const current = next.get(dataId) || [];
            if (current.length > 0) {
                const updated = current.slice(0, -1);
                if (updated.length === 0) next.delete(dataId);
                else next.set(dataId, updated);
            }
            return next;
        });
    };

    const scrapSelected = () => {
        selectedCards.forEach(ids => {
            ids.forEach(id => dispatch(removeCardFromInventory(id)));
        });
        dispatch(addScrap(selectedScrap));
        setSelectedCards(new Map());
    };

    const compileMingming = (architectureId: string, cost: number) => {
        if (scrapCount < cost) return;
        dispatch(spendScrap(cost));
        const newMm = createMingmingInstance(architectureId, 1);
        dispatch(addToRoster(newMm));
        setLastCompiled(architectureId);
        setTimeout(() => setLastCompiled(null), 2000);
    };

    const groupedCardInventory = useMemo(() => {
        const groups: Record<string, { dataId: string; instances: string[]; data: any }> = {};
        cardInventory.forEach(c => {
            if (!groups[c.dataId]) {
                groups[c.dataId] = { dataId: c.dataId, instances: [], data: GetProgramData(c.dataId) };
            }
            groups[c.dataId].instances.push(c.instanceId);
        });
        return Object.values(groups);
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
                        {groupedCardInventory.length === 0 && (
                            <div className="empty-state">No cards to scrap</div>
                        )}
                        {groupedCardInventory.map(group => {
                            const selectedIds = selectedCards.get(group.dataId) || [];
                            return (
                                <ProgramCard
                                    key={group.dataId}
                                    data={group.data}
                                    count={group.instances.length}
                                    showBadge={selectedIds.length > 0 ? `${selectedIds.length} MARKED` : undefined}
                                    onClick={() => {
                                        addOne(group.dataId, group.instances);
                                    }}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        removeOne(group.dataId);
                                    }}
                                />
                            );
                        })}
                    </div>

                    <p style={{ fontSize: '0.8rem', opacity: 0.5, textAlign: 'center' }}>
                        Left Click: Add to scrap | Right Click: Remove from scrap
                    </p>

                    {selectedScrap > 0 && (
                        <button className="scrap-button" onClick={scrapSelected}>
                            🔥 Scrap Identified Programs → +{selectedScrap} ⚙️
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
