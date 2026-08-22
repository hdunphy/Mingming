import React, { useState, useMemo } from 'react';
import { getInflatedProgramRegistry } from '../../engine/data/programRegistry';
import type { ProgramData } from '../../engine/types';
import { budgetBandFor, calculatePowerscale } from '../balance/powerscale';
import CardForm from '../../ui/screens/CardForm';
import './CardStudio.css';
import { numericBaseCost } from '../../engine/types';

/** Section 1.3 redline: more score than the cost is supposed to buy. */
const OVER_BUDGET_STYLE: React.CSSProperties = { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 'bold' };

/** Advisory only - the auditor never redlines an underperforming card. */
const UNDER_BUDGET_STYLE: React.CSSProperties = { backgroundColor: 'rgba(234, 179, 8, 0.2)', color: '#eab308' };

/**
 * Colour a score against its energy band. The bands come from `balance/powerscale`, so
 * this table and `docs/balance/balance_report.json` cannot disagree about what "over
 * budget" means.
 */
const getEfficiencyStyle = (cost: number, score: number): React.CSSProperties => {
    const band = budgetBandFor(cost);
    if (score > band.over) return OVER_BUDGET_STYLE;
    if (band.under !== null && score < band.under) return UNDER_BUDGET_STYLE;
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
                                    <td className="score-cell" style={getEfficiencyStyle(numericBaseCost(card.baseCost), score)}>{score}</td>
                                    <td className="score-cell per-energy" style={getEfficiencyStyle(numericBaseCost(card.baseCost), score)}>{perEnergy}</td>
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
