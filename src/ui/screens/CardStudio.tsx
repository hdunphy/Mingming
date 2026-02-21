import React, { useState, useMemo } from 'react';
import { GetProgramData, getInflatedProgramRegistry } from '../../engine/data/programRegistry';
import type { ProgramData } from '../../engine/types';
import CardForm from './CardForm';
import './CardStudio.css';

interface PowerscaleResult {
    score: number;
    perEnergy: number;
}

const ACTION_WEIGHTS: Record<string, number> = {
    'ATTACK': 1,
    'HEAL': 1.5,
    'STATUS': 12,
    'REMOVE_STATUS': 8,
    'DRAW': 15,
    'ENERGY': 20,
};

const BUFFS = ['Strengthened', 'Regen', 'Energized', 'Haste', 'Protected'];
const DEBUFFS = ['Burn', 'Poison', 'Dazed', 'Stunned', 'Weakened', 'Asleep', 'Vulnerable'];

const calculatePowerscale = (card: ProgramData): PowerscaleResult => {
    let score = 0;

    // Baseline assumptions
    const ASSUMED_CARDS_PLAYED = 2.5;
    const ASSUMED_HP_PERCENT = 0.5;
    const ASSUMED_DISCARD_SIZE = 8;
    const ASSUMED_STATUS_COUNT = 3;

    // Actions
    card.actions.forEach(action => {
        let actionScore = 0;

        if (action.type === 'ATTACK') {
            let power = action.power || 0;
            if (action.scaling === 'CARDS_PLAYED') power *= ASSUMED_CARDS_PLAYED;
            else if (action.scaling === 'MISSING_HP' || action.scaling === 'HP_PERCENT') power *= ASSUMED_HP_PERCENT;
            else if (action.scaling === 'DISCARD_SIZE') power *= ASSUMED_DISCARD_SIZE;
            else if (action.scaling === 'STATUS_COUNT') power *= ASSUMED_STATUS_COUNT;

            actionScore = (power / 10.0) * 1.0;
        } else if (action.type === 'HEAL') {
            let power = action.power || action.healOverride || 0;
            actionScore = (power / 10.0) * 1.5;
        } else if (action.type === 'STATUS') {
            const stacks = action.stacks || 1;
            if (['Burn', 'Poison'].includes(action.status)) {
                actionScore = Math.abs(stacks) * 1.5;
            } else if (['Weakened', 'Dazed', 'Vulnerable'].includes(action.status)) {
                actionScore = Math.abs(stacks) * 2.0;
            } else if (['Stunned', 'Asleep'].includes(action.status)) {
                actionScore = 5.0 + Math.max(0, Math.abs(stacks) - 1) * 0.5;
            } else {
                actionScore = Math.abs(stacks) * 2.0;
            }
        } else if (action.type === 'DRAW') {
            const count = action.amount || action.count || 1;
            for (let i = 1; i <= count; i++) {
                if (i === 1) actionScore += 4.0;
                else if (i === 2) actionScore += 2.5;
                else actionScore += 1.0;
            }
        } else if (action.type === 'ENERGY') {
            const amount = action.amount || 0;
            actionScore = Math.abs(amount) * 6.0;
        }

        // Multi-hit scaling
        const hitCount = action.count || 1;
        if (hitCount > 1 && action.type === 'ATTACK') {
            actionScore *= hitCount;
        }

        // Target Scope Multiplier
        let scope = (action.target || card.target || '').toUpperCase();
        if (scope === 'SELF') actionScore *= 0.9;
        else if (scope === 'SIDE') actionScore *= 2.2;
        else if (scope === 'ALL') actionScore *= 4.0;
        else actionScore *= 1.0;

        // Condition Discount
        if (action.conditionals && action.conditionals.length > 0) {
            actionScore *= 0.7;
        }

        // Penalties
        if (action.type === 'ATTACK' && scope === 'SELF') {
            actionScore *= -1;
        } else if (action.type === 'STATUS') {
            const isBuff = BUFFS.includes(action.status);
            const isDebuff = DEBUFFS.includes(action.status);
            if (isDebuff && scope === 'SELF') actionScore *= -1;
            if (isBuff && scope !== 'SELF' && card.actions.some(a => a.type === 'ATTACK')) actionScore *= -1;
        } else if (action.type === 'ENERGY') {
            const amount = action.amount || 0;
            if (amount < 0 && scope === 'SELF') actionScore *= -1;
            if (amount > 0 && scope !== 'SELF' && card.actions.some(a => a.type === 'ATTACK')) actionScore *= -1;
        }

        score += actionScore;
    });

    // Daemon Premium
    if (card.category === 'Daemon') {
        score *= 1.5;
    }

    // Exhaust/Token Discount
    if (card.exhaust || card.isToken) {
        score *= 0.9;
    }

    const costFactor = Math.pow(Math.max(card.baseCost, 0.5), 1.25);
    const perEnergy = score / costFactor;

    return {
        score: Math.round(score * 10) / 10,
        perEnergy: Math.round(perEnergy * 10) / 10
    };
};

const getEfficiencyStyle = (cost: number, score: number): React.CSSProperties => {
    if (cost === 0) {
        if (score > 3.5) return { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 'bold' };
        if (score < 1.0) return { backgroundColor: 'rgba(234, 179, 8, 0.2)', color: '#eab308' };
    } else if (cost === 1) {
        if (score > 7.0) return { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 'bold' };
        if (score < 4.0) return { backgroundColor: 'rgba(234, 179, 8, 0.2)', color: '#eab308' };
    } else if (cost === 2) {
        if (score > 13.0) return { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 'bold' };
        if (score < 9.0) return { backgroundColor: 'rgba(234, 179, 8, 0.2)', color: '#eab308' };
    } else if (cost >= 3) {
        if (score > 18.0) return { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 'bold' };
    }
    return {};
};

type SortKey = keyof ProgramData | 'powerscale' | 'perEnergy';

const CardStudio: React.FC = () => {
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [showForm, setShowForm] = useState(false);

    const cards = useMemo(() => Object.values(getInflatedProgramRegistry()) as ProgramData[], []);

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

    const handleSaveCard = (newCard: ProgramData) => {
        console.log('--- GENERATED CARD JSON ---');
        console.log(JSON.stringify(newCard, null, 4));
        console.log('--- END JSON ---');
        alert('Card JSON generated! Antigravity will now persist this to programs.json.');
        setShowForm(false);
    };

    return (
        <div className="card-studio">
            <header className="studio-header">
                <div className="header-content">
                    <h1>CARD STUDIO</h1>
                    <p>Advanced balancing and powerscale analysis.</p>
                </div>
                <div className="header-actions">
                    <button className="add-button" onClick={() => setShowForm(true)}>
                        + ADD NEW CARD
                    </button>
                    <button className="export-button" onClick={exportToCSV}>
                        EXPORT CSV
                    </button>
                </div>
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
                                                {a.error ? 'MISSING' : (a.id || a.type)}
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
                                                {c.error ? 'MISSING' : (c.id || c.type)}
                                            </span>
                                        ))}
                                    </td>
                                    <td className="pills-cell">
                                        {card.hooks?.map((h, i) => (
                                            <span key={i} className="pill hook-pill">{h}</span>
                                        ))}
                                    </td>
                                    <td className="score-cell" style={getEfficiencyStyle(card.baseCost, score)}>{score}</td>
                                    <td className="score-cell per-energy" style={getEfficiencyStyle(card.baseCost, score)}>{perEnergy}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {showForm && (
                <CardForm
                    onSave={handleSaveCard}
                    onCancel={() => setShowForm(false)}
                />
            )}
        </div>
    );
};

export default CardStudio;
