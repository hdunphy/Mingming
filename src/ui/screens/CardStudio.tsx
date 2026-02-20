import React, { useState, useMemo } from 'react';
import { InflatedProgramRegistry } from '../../engine/data/programRegistry';
import type { ProgramData, ProgramAction, ProgramConstraint } from '../../engine/types';
import './CardStudio.css';

interface PowerscaleResult {
    score: number;
    perEnergy: number;
}

const ACTION_WEIGHTS: Record<string, number> = {
    'ATTACK': 1,
    'HEAL': 1.5,
    'APPLY_STATUS': 12,
    'REMOVE_STATUS': 8,
    'DRAW': 15,
    'ENERGY': 20,
};

const BUFFS = ['Strengthened', 'Regen', 'Energized', 'Awoken', 'Haste', 'Protected'];
const DEBUFFS = ['Burn', 'Poison', 'Dazed', 'Stunned', 'Weakened', 'Asleep', 'Vulnerable'];

const calculatePowerscale = (card: ProgramData): PowerscaleResult => {
    let score = 0;
    const isAttackCard = card.actions.some(a => a.type === 'ATTACK');

    // Actions
    card.actions.forEach(action => {
        const baseWeight = ACTION_WEIGHTS[action.type] || 5;
        let actionScore = 0;

        if (action.type === 'ATTACK' || action.type === 'HEAL') {
            actionScore = (action.power || action.healOverride || 0) * baseWeight;

            // Recoil is a penalty
            if (action.type === 'ATTACK' && action.target === 'SELF') {
                actionScore *= -1;
            }
        } else if (action.type === 'APPLY_STATUS') {
            actionScore = (action.stacks || 1) * baseWeight;

            const isBuff = BUFFS.includes(action.status);
            const isDebuff = DEBUFFS.includes(action.status);

            // Only apply penalty inversion to offensive cards
            if (isAttackCard) {
                if (isDebuff && action.target === 'SELF') actionScore *= -1;
                if (isBuff && action.target === 'TARGET') actionScore *= -1;
            }
        } else if (action.type === 'DRAW') {
            actionScore = (action.count || 1) * baseWeight;
        } else if (action.type === 'ENERGY') {
            const amount = action.amount || 0;
            actionScore = Math.abs(amount) * baseWeight;

            // Penalty for losing own energy, or giving energy to enemy (if ever applicable)
            // But usually positive amount is 'gain' and negative is 'lose'.
            if (amount < 0 && action.target === 'SELF') actionScore *= -1;
            if (amount > 0 && action.target === 'TARGET' && isAttackCard) actionScore *= -1; // Giving energy to enemy is bad

            // Minor bonus for being able to target others with energy (utility)
            if (action.target === 'TARGET' && !isAttackCard) actionScore *= 1.2;
        } else {
            actionScore = baseWeight;
        }

        // Multi-hit scaling
        if (action.count && action.count > 1) {
            actionScore *= (1 + (action.count - 1) * 0.5);
        }

        score += actionScore;
    });

    // Hooks
    if (card.hooks) {
        score += card.hooks.length * 15;
    }

    // Constraints (Subtractive)
    // We don't subtract for BASE or standard constraints that are always there
    const meaningfulConstraints = card.constraints.filter(c => c.type !== 'BASE' && c.type !== 'NOT_STATUS');
    score -= meaningfulConstraints.length * 10;

    // Exhaust penalty/bonus? 
    // Usually Exhaust is used on powerful cards to prevent abuse, so maybe it doesn't affect raw power score but affects balance.

    const costFactor = Math.pow(Math.max(card.baseCost, 0.5), 1.25);
    const perEnergy = score / costFactor;

    return {
        score: Math.round(score),
        perEnergy: Math.round(perEnergy * 10) / 10
    };
};

type SortKey = keyof ProgramData | 'powerscale' | 'perEnergy';

const CardStudio: React.FC = () => {
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const cards = useMemo(() => Object.values(InflatedProgramRegistry) as ProgramData[], []);

    const sortedCards = useMemo(() => {
        return [...cards].sort((a, b) => {
            let valA: any;
            let valB: any;

            if (sortKey === 'powerscale') {
                valA = calculatePowerscale(a).score;
                valB = calculatePowerscale(b).score;
            } else if (sortKey === 'perEnergy') {
                valA = calculatePowerscale(a).perEnergy;
                valB = calculatePowerscale(b).perEnergy;
            } else {
                valA = (a as any)[sortKey];
                valB = (b as any)[sortKey];
            }

            if (valA === undefined || valA === null) valA = '';
            if (valB === undefined || valB === null) valB = '';

            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [cards, sortKey, sortDir]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const exportToCSV = () => {
        const headers = ['Name', 'ID', 'Element', 'Target', 'Category', 'Exhaust', 'Rarity', 'Cost', 'Actions', 'Constraints', 'Score', 'Score/E'];
        const rows = sortedCards.map(card => {
            const { score, perEnergy } = calculatePowerscale(card);
            const actionsStr = card.actions.map(a => `${a.type}${a.error ? '(ERR)' : ''}`).join('; ');
            const constraintsStr = card.constraints.map(c => `${c.type}${c.error ? '(ERR)' : ''}`).join('; ');

            return [
                `"${card.name}"`,
                `"${card.id}"`,
                card.element,
                card.target,
                card.category,
                card.exhaust ? 'YES' : 'NO',
                card.rarity,
                card.baseCost,
                `"${actionsStr}"`,
                `"${constraintsStr}"`,
                score,
                perEnergy
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `mingming_cards_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="card-studio">
            <header className="studio-header">
                <div className="header-content">
                    <h1>CARD STUDIO</h1>
                    <p>Advanced balancing and powerscale analysis.</p>
                </div>
                <button className="export-button" onClick={exportToCSV}>
                    EXPORT CSV
                </button>
            </header>

            <div className="studio-table-container">
                <table className="studio-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('name')}>Name {sortKey === 'name' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                            <th onClick={() => handleSort('description')}>Description</th>
                            <th onClick={() => handleSort('element')}>Element</th>
                            <th onClick={() => handleSort('target')}>Target</th>
                            <th onClick={() => handleSort('category')}>Category</th>
                            <th onClick={() => handleSort('exhaust')}>Exhaust</th>
                            <th onClick={() => handleSort('rarity')}>Rarity</th>
                            <th onClick={() => handleSort('baseCost')}>Cost</th>
                            <th>Actions</th>
                            <th>Constraints</th>
                            <th>Hooks</th>
                            <th onClick={() => handleSort('powerscale')}>Powerscale</th>
                            <th onClick={() => handleSort('perEnergy')}>Score/E</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedCards.map(card => {
                            const { score, perEnergy } = calculatePowerscale(card);
                            return (
                                <tr key={card.id}>
                                    <td className="card-name-cell">
                                        <div className="card-name">{card.name}</div>
                                        <div className="card-id">{card.id}</div>
                                    </td>
                                    <td className="desc-cell">{card.description}</td>
                                    <td>
                                        <span className={`pill element-${card.element.toLowerCase()}`}>
                                            {card.element}
                                        </span>
                                    </td>
                                    <td>{card.target}</td>
                                    <td>{card.category}</td>
                                    <td className="center-cell">{card.exhaust ? 'YES' : 'NO'}</td>
                                    <td>
                                        <span className={`rarity-${card.rarity.toLowerCase()}`}>
                                            {card.rarity}
                                        </span>
                                    </td>
                                    <td className="cost-cell">{card.baseCost}</td>
                                    <td className="pills-cell">
                                        {card.actions.map((a, i) => (
                                            <span
                                                key={i}
                                                className={`pill action-pill ${a.error ? 'pill-error' : ''}`}
                                                title={a.error || ''}
                                            >
                                                {a.error ? 'MISSING' : a.type}
                                            </span>
                                        ))}
                                    </td>
                                    <td className="pills-cell">
                                        {card.constraints.map((c, i) => (
                                            <span
                                                key={i}
                                                className={`pill constraint-pill ${c.error ? 'pill-error' : ''}`}
                                                title={c.error || ''}
                                            >
                                                {c.error ? 'MISSING' : c.type}
                                            </span>
                                        ))}
                                    </td>
                                    <td className="pills-cell">
                                        {card.hooks?.map((h, i) => (
                                            <span key={i} className="pill hook-pill">{h}</span>
                                        ))}
                                    </td>
                                    <td className="score-cell">{score}</td>
                                    <td className="score-cell per-energy">{perEnergy}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CardStudio;
