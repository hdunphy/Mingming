
/**
 * Balance Laboratory - the UI over `engine/sim/Simulator.ts`.
 *
 * A FAST APPROXIMATION, NOT BALANCE TRUTH: the model behind every number on this screen is
 * closed-form TTK over zero-IV units with no statuses, hooks, cards or AI (see that file's
 * header). It is kept, and kept unchanged, because it is instant - live recompute as a
 * slider drags is the entire reason this panel is usable, and a real batch is seconds per
 * matchup.
 *
 * The real numbers come from `npm run balance` and land in
 * `docs/balance/balance_report.json`. The banner below says so on screen, because two
 * balance tools that disagree without explaining why read as a bug.
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { simulate1v1, runBatchSimulation } from '../../engine/sim/Simulator';
import type { BatchReport } from '../../engine/sim/Simulator';
import './BalanceTester.css';

const BalanceTester: React.FC = () => {
    const [idA, setIdA] = useState(Object.keys(MingmingRegistry)[0]);
    const [idB, setIdB] = useState(Object.keys(MingmingRegistry)[1]);
    const [power, setPower] = useState(40);
    const [batchReport, setBatchReport] = useState<BatchReport | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [avgSortConfig, setAvgSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [modalTab, setModalTab] = useState<'summary' | 'matchups'>('summary');

    const ids = Object.keys(MingmingRegistry);

    const results = useMemo(() => {
        try {
            return simulate1v1(idA, idB, power);
        } catch {
            return null;
        }
    }, [idA, idB, power]);

    const sortedMatchups = useMemo(() => {
        if (!batchReport || !sortConfig) return batchReport?.results || [];

        return [...batchReport.results].sort((a, b) => {
            let valA: string | number, valB: string | number;
            switch (sortConfig.key) {
                case 'attacker': valA = MingmingRegistry[a.sideA.attackerId].name; valB = MingmingRegistry[b.sideA.attackerId].name; break;
                case 'target': valA = MingmingRegistry[a.sideA.targetId].name; valB = MingmingRegistry[b.sideA.targetId].name; break;
                case 'damage': valA = a.sideA.damage; valB = b.sideA.damage; break;
                case 'ttk': valA = a.sideA.ttk; valB = b.sideA.ttk; break;
                default: return 0;
            }

            // Name columns sort as strings, damage/ttk as numbers; `<`/`>` reject the union at
            // type level, so the comparison goes through an erased cast and behaves as before.
            const cmpA = valA as number, cmpB = valB as number;
            if (cmpA < cmpB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (cmpA > cmpB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [batchReport, sortConfig]);

    const sortedAverages = useMemo(() => {
        if (!batchReport || !avgSortConfig) return batchReport?.attackerAverages || [];

        return [...batchReport.attackerAverages].sort((a, b) => {
            let valA: string | number, valB: string | number;
            switch (avgSortConfig.key) {
                case 'name': valA = MingmingRegistry[a.id].name; valB = MingmingRegistry[b.id].name; break;
                case 'damage': valA = a.avgDamage; valB = b.avgDamage; break;
                case 'ttk': valA = a.avgTTK; valB = b.avgTTK; break;
                default: return 0;
            }

            // Same erased cast as `sortedMatchups` above - see the note there.
            const cmpA = valA as number, cmpB = valB as number;
            if (cmpA < cmpB) return avgSortConfig.direction === 'asc' ? -1 : 1;
            if (cmpA > cmpB) return avgSortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [batchReport, avgSortConfig]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const requestAvgSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (avgSortConfig && avgSortConfig.key === key && avgSortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setAvgSortConfig({ key, direction });
    };

    const runBatch = () => {
        const report = runBatchSimulation(power);
        setBatchReport(report);
        setModalTab('summary');
        setAvgSortConfig(null);
    };

    const getSortIcon = (key: string, isAvg = false) => {
        const config = isAvg ? avgSortConfig : sortConfig;
        if (config?.key !== key) return '↕️';
        return config.direction === 'asc' ? '🔼' : '🔽';
    };

    const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportAverages = () => {
        if (!batchReport) return;
        const headers = ['Mingming', 'Avg Damage', 'Avg TTK'];
        const rows = sortedAverages.map(avg => [
            MingmingRegistry[avg.id].name,
            avg.avgDamage.toFixed(2),
            avg.avgTTK.toFixed(2)
        ]);
        downloadCSV(`averages_pwr${power}.csv`, headers, rows);
    };

    const exportMatchups = () => {
        if (!batchReport) return;
        const headers = ['Attacker', 'Target', 'Damage', 'TTK'];
        const rows = sortedMatchups.map(r => [
            MingmingRegistry[r.sideA.attackerId].name,
            MingmingRegistry[r.sideA.targetId].name,
            r.sideA.damage,
            r.sideA.ttk
        ]);
        downloadCSV(`matchups_pwr${power}.csv`, headers, rows);
    };

    return (
        <div className="balance-tester">
            <header className="tester-header">
                <h1>⚖️ Balance Laboratory</h1>
                <p>Iterate and simulate combat matchups to ensure fairness.</p>
            </header>

            <div className="approximation-notice" role="note">
                <strong>Fast approximation — not balance truth.</strong> This is a closed-form
                time-to-kill model: one damage roll per side against zero-IV units, then
                <code> ttk = ceil(maxHp / damage)</code>. No statuses, no daemon hooks, no cards,
                no energy, no AI, no turn order. It exists because it is instant, which is the
                only reason the sliders above can recompute live.
                <br />
                The balance verdict comes from the seeded batch simulator:
                <code> npm run balance</code> → <code>docs/balance/balance_report.json</code>.
                When the two disagree, that file is right and this panel is the approximation.
            </div>

            <div className="tester-grid">
                {/* Unit A Selection */}
                <section className="tester-panel">
                    <div className="panel-header">Unit A (Attacker)</div>
                    <div className="control-group">
                        <label>Species</label>
                        <select value={idA} onChange={(e) => setIdA(e.target.value)}>
                            {ids.map(id => <option key={id} value={id}>{MingmingRegistry[id].name}</option>)}
                        </select>
                    </div>
                    <div className="control-group">
                    </div>
                    <div className="stats-preview">
                        <div className="stat">HP: {results?.sideB.hp}</div>
                    </div>
                </section>

                {/* Global Controls */}
                <section className="tester-panel central-panel">
                    <div className="panel-header">Combat Config</div>
                    <div className="control-group">
                        <label>Attack Power: {power}</label>
                        <input type="range" min="1" max="150" value={power} onChange={(e) => setPower(parseInt(e.target.value))} />
                    </div>
                    <button className="primary-button" onClick={runBatch}>Run All Matchups</button>
                </section>

                {/* Unit B Selection */}
                <section className="tester-panel">
                    <div className="panel-header">Unit B (Target)</div>
                    <div className="control-group">
                        <label>Species</label>
                        <select value={idB} onChange={(e) => setIdB(e.target.value)}>
                            {ids.map(id => <option key={id} value={id}>{MingmingRegistry[id].name}</option>)}
                        </select>
                    </div>
                    <div className="control-group">
                    </div>
                    <div className="stats-preview">
                        <div className="stat">HP: {results?.sideA.hp}</div>
                    </div>
                </section>
            </div>

            {/* Results Display */}
            <AnimatePresence mode="wait">
                {results && (
                    <motion.div
                        className="results-container"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <div className="ttk-card">
                            <h3>{MingmingRegistry[idA].name} vs {MingmingRegistry[idB].name}</h3>
                            <div className="ttk-grid">
                                <div className="ttk-stat">
                                    <span className="label">Damage dealt by A</span>
                                    <span className="value">{results.sideA.damage}</span>
                                </div>
                                <div className="ttk-stat highlight">
                                    <span className="label">Turns to Kill B</span>
                                    <span className="value">{results.sideA.ttk}</span>
                                </div>
                                <div className="ttk-divider">vs</div>
                                <div className="ttk-stat">
                                    <span className="label">Damage dealt by B</span>
                                    <span className="value">{results.sideB.damage}</span>
                                </div>
                                <div className="ttk-stat highlight">
                                    <span className="label">Turns to Kill A</span>
                                    <span className="value">{results.sideB.ttk}</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Batch Report Modal */}
            <AnimatePresence>
                {batchReport && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setBatchReport(null)}
                    >
                        <motion.div
                            className="report-modal"
                            onClick={e => e.stopPropagation()}
                            layoutId="report"
                        >
                            <div className="modal-header">
                                <div className="modal-title-row">
                                    <h2>Matchup Analysis (Pwr {power})</h2>
                                    <button className="close-icon" onClick={() => setBatchReport(null)}>✕</button>
                                </div>

                                <div className="report-summary">
                                    <div className="summary-item">
                                        <span className="label">Average TTK</span>
                                        <span className="value">{batchReport.averageTTK.toFixed(2)}</span>
                                    </div>
                                    <div className="summary-item best">
                                        <span className="label">Fastest Kill</span>
                                        <span className="value">{batchReport.bestMatchup.ttk} turns</span>
                                        <span className="detail">{MingmingRegistry[batchReport.bestMatchup.pair[0]].name} → {MingmingRegistry[batchReport.bestMatchup.pair[1]].name}</span>
                                    </div>
                                    <div className="summary-item worst">
                                        <span className="label">Slowest Kill</span>
                                        <span className="value">{batchReport.worstMatchup.ttk} turns</span>
                                        <span className="detail">{MingmingRegistry[batchReport.worstMatchup.pair[0]].name} → {MingmingRegistry[batchReport.worstMatchup.pair[1]].name}</span>
                                    </div>
                                </div>

                                <nav className="modal-tabs">
                                    <button
                                        className={`modal-tab-btn ${modalTab === 'summary' ? 'active' : ''}`}
                                        onClick={() => setModalTab('summary')}
                                    >
                                        Averages by Attacker
                                    </button>
                                    <button
                                        className={`modal-tab-btn ${modalTab === 'matchups' ? 'active' : ''}`}
                                        onClick={() => setModalTab('matchups')}
                                    >
                                        All Matchups ({batchReport.results.length})
                                    </button>
                                </nav>
                            </div>

                            <div className="modal-body">
                                {modalTab === 'summary' && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="tab-content"
                                    >
                                        <div className="averages-section">
                                            <div className="section-header">
                                                <h3>Aggregated Stats</h3>
                                                <button className="export-btn" onClick={exportAverages}>📥 Export Averages (.csv)</button>
                                            </div>
                                            <div className="table-scroll summary-table">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th onClick={() => requestAvgSort('name')} className="sortable">Mingming {getSortIcon('name', true)}</th>
                                                            <th onClick={() => requestAvgSort('damage')} className="sortable">Avg Damage {getSortIcon('damage', true)}</th>
                                                            <th onClick={() => requestAvgSort('ttk')} className="sortable">Avg TTK {getSortIcon('ttk', true)}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {sortedAverages.map(avg => (
                                                            <tr key={avg.id}>
                                                                <td>{MingmingRegistry[avg.id].name}</td>
                                                                <td>{avg.avgDamage.toFixed(1)}</td>
                                                                <td>{avg.avgTTK.toFixed(2)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {modalTab === 'matchups' && (
                                    <motion.div
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="tab-content"
                                    >
                                        <div className="matchup-list">
                                            <div className="section-header">
                                                <h3>All Pairings</h3>
                                                <button className="export-btn" onClick={exportMatchups}>📥 Export Matchups (.csv)</button>
                                            </div>
                                            <div className="table-scroll large-table">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th onClick={() => requestSort('attacker')} className="sortable">Attacker {getSortIcon('attacker')}</th>
                                                            <th onClick={() => requestSort('target')} className="sortable">Target {getSortIcon('target')}</th>
                                                            <th onClick={() => requestSort('damage')} className="sortable">Damage {getSortIcon('damage')}</th>
                                                            <th onClick={() => requestSort('ttk')} className="sortable">TTK {getSortIcon('ttk')}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {sortedMatchups.map((r, i) => (
                                                            <tr key={i}>
                                                                <td>{MingmingRegistry[r.sideA.attackerId].name}</td>
                                                                <td>{MingmingRegistry[r.sideA.targetId].name}</td>
                                                                <td>{r.sideA.damage}</td>
                                                                <td>{r.sideA.ttk}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button className="close-button" onClick={() => setBatchReport(null)}>Close Laboratory Report</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BalanceTester;
