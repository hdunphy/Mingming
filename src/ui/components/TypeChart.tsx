import React from 'react';
import { STAB_BONUS } from '../../engine/combatUtils';
import { ELEMENTS } from '../../engine/types';
import type { Element } from '../../engine/types';
import { getElementAccent } from '../utils/contrastText';
import { getElementIcon } from './cardIcons';
import { formatMultiplier, getMatchupMultiplier } from './elementMatchups';

/**
 * The 8 combat elements. 'None' is deliberately excluded from the chart:
 * its ElementalMatrix row is empty and no element targets it, so a None
 * row/column would be a full rank of dashes — wasted space in a chart
 * that has to stay ~420-520px wide. (ElementMatchupTooltip already tells
 * the player "Neutral — no matchups, no STAB" when they hover a None chip.)
 */
export const CHART_ELEMENTS: Element[] = ELEMENTS.filter(e => e !== 'None');

/** Compact cell text: 2 → "×2", 0.5 → "×½", other non-1 values → "×<n>". */
const cellLabel = (mult: number): string =>
    mult === 0.5 ? '×½' : `×${formatMultiplier(mult)}`;

const cellClass = (mult: number): string =>
    mult > 1 ? 'tc-cell tc-strong' : mult < 1 ? 'tc-cell tc-weak' : 'tc-cell tc-neutral';

/** Icon + 3-letter code, tinted with the element's dark-readable accent. */
const ElementTag: React.FC<{ el: Element }> = ({ el }) => (
    <span className="tc-el-tag" style={{ color: getElementAccent(el) }} title={el}>
        <span className="tc-el-icon" aria-hidden="true">{getElementIcon(el)}</span>
        <span className="tc-el-abbr">{el.slice(0, 3).toUpperCase()}</span>
    </span>
);

/**
 * Full elemental matchup matrix (rows = ATTACKING element, columns =
 * DEFENDING element), derived at render time from ElementalMatrix.
 */
export const TypeChart: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
    <div className="type-chart" style={style}>
        <div className="tc-row tc-head-row">
            <div className="tc-corner">
                <span className="tc-axis">ATK ▼</span>
                <span className="tc-axis">DEF ▶</span>
            </div>
            {CHART_ELEMENTS.map(def => (
                <div key={def} className="tc-col-head"><ElementTag el={def} /></div>
            ))}
        </div>
        {CHART_ELEMENTS.map(atk => (
            <div key={atk} className="tc-row">
                <div className="tc-row-head"><ElementTag el={atk} /></div>
                {CHART_ELEMENTS.map(def => {
                    const mult = getMatchupMultiplier(atk, def);
                    return (
                        <div key={def} className={cellClass(mult)} title={`${atk} → ${def}: ×${formatMultiplier(mult)}`}>
                            {mult === 1 ? '·' : cellLabel(mult)}
                        </div>
                    );
                })}
            </div>
        ))}
        <div className="tc-footer">⚡ Same-element unit + card = ×{formatMultiplier(STAB_BONUS)} STAB</div>
    </div>
);

/**
 * Collapsible wrapper: a small chip-styled 'TYPE CHART' toggle (closed by
 * default) that reveals the chart. Each screen mounts its own instance, so
 * open state is remembered per screen while the screen stays mounted.
 */
export const TypeChartPanel: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
    const [open, setOpen] = React.useState(false);
    return (
        <div className="type-chart-panel" style={style}>
            <button
                type="button"
                className={`type-chart-toggle ${open ? 'open' : ''}`}
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
            >
                🧬 TYPE CHART {open ? '▲' : '▼'}
            </button>
            {open && <TypeChart />}
        </div>
    );
};

export default TypeChart;
