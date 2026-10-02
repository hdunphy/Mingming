import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EnergyHex } from './EnergyHex';

describe('EnergyHex (183a)', () => {
    it('prints the number and says it in words', () => {
        const html = renderToStaticMarkup(<EnergyHex n={3} />);
        expect(html).toContain('>3<');
        expect(html).toContain('aria-label="Energy 3"');
        expect(html).toContain('k-hex');
    });

    it('adds /max for a plaque', () => {
        const html = renderToStaticMarkup(<EnergyHex n={2} max={2} size={20} />);
        expect(html).toContain('title="Energy 2/2"');
        expect(html).toContain('/2');
        expect(html).toContain('height:20px');
    });
});
