import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { TypeChart, TypeChartPanel } from './TypeChart';
import { STAB_BONUS } from '../../engine/combatUtils';
import { formatMultiplier } from './elementMatchups';
import { iconNamesIn } from '../theme/iconMarkup';

/**
 * TICKET 205 - the type chart's DNA button and its STAB footer draw Tabler icons.
 *
 * The footer's old symbol was a bolt. The bolt means energy and nothing else (ticket 200, ruled), and
 * a same-element bonus is not energy, so the footer draws the circled plus instead.
 */
describe('the type chart button and footer (205)', () => {
    const button = (): string => /<button[\s\S]*?<\/button>/.exec(renderToStaticMarkup(<TypeChartPanel />))?.[0] ?? '';

    it('the toggle draws the DNA icon, and keeps its accessible name', () => {
        const markup = button();
        expect(iconNamesIn(markup)).toEqual(['dna']);
        expect(markup).toContain('aria-label="Type chart"');
    });

    it('the footer draws the circled plus, not the bolt, and keeps its sentence', () => {
        const footer = /<div class="tc-footer">[\s\S]*?<\/div>/.exec(renderToStaticMarkup(<TypeChart />))?.[0] ?? '';
        expect(iconNamesIn(footer)).toEqual(['circle-plus']);
        expect(footer).not.toContain('bolt');
        expect(footer.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').replace(/<!-- -->/g, '').trim())
            .toBe(`Same-element unit + card = ×${formatMultiplier(STAB_BONUS)} STAB`);
    });
});
