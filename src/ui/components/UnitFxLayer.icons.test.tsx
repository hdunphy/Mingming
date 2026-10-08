// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { FxFloats, TerminatedStamp } from './UnitFxLayer';
import { iconsIn } from '../theme/iconMarkup';
import type { CombatFloat, UnitFx } from '../hooks/useBattleVfx';

/**
 * TICKET 205 - the TERMINATED stamp and the absorbed float draw Tabler icons, not characters.
 *
 * The stamp used a skull character; the skull is Poison's, so it is the grave now (ruled in ticket
 * 200 for the chrome "lost" icon). The absorbed float read `-14` and a shield emoji; the number stays
 * text and the shield is a glyph the float carries by name.
 */

const fxOf = (floats: CombatFloat[]): UnitFx => ({
    floats, hitKey: 0, hitIntensity: 0, flashKey: 0, healKey: 0, statusKey: 0, statusColor: '#fff', lungeKey: 0,
});

describe('the TERMINATED stamp (205)', () => {
    it('draws the grave, then the word', () => {
        const markup = renderToStaticMarkup(<TerminatedStamp visible glitching={false} />);
        expect(iconsIn(markup)).toEqual([{ name: 'grave-2', variant: 'outline' }]);
        expect(markup).toContain('TERMINATED');
        expect(markup.indexOf('<svg')).toBeLessThan(markup.indexOf('TERMINATED'));
    });

    it('draws nothing while the unit is alive', () => {
        expect(renderToStaticMarkup(<TerminatedStamp visible={false} glitching={false} />)).not.toContain('<svg');
    });

    it('does not draw the skull: that one is Poison\'s', () => {
        expect(renderToStaticMarkup(<TerminatedStamp visible glitching={false} />)).not.toContain('data-icon="skull"');
    });
});

describe('the absorbed float (205)', () => {
    const absorbed = (extra: Partial<CombatFloat> = {}): CombatFloat =>
        ({ id: 1, kind: 'absorbed', text: '-14', color: '#fff', slot: 0, ...extra });

    it('a float that carries an icon draws it after the number', () => {
        const markup = renderToStaticMarkup(<FxFloats fx={fxOf([absorbed({ icon: 'absorbed' })])} />);
        expect(iconsIn(markup)).toEqual([{ name: 'shield', variant: 'outline' }]);
        expect(markup.indexOf('-14')).toBeLessThan(markup.indexOf('<svg'));
    });

    it('a float without one draws only its words (ABSORBED, SUPER EFFECTIVE, a damage number)', () => {
        const markup = renderToStaticMarkup(<FxFloats fx={fxOf([absorbed({ text: 'ABSORBED' })])} />);
        expect(markup).not.toContain('<svg');
        expect(markup).toContain('ABSORBED');
    });
});
