import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StatusChip } from './StatusChip';
import { statusGlossary } from '../../../engine/data/statusGlossary';

describe('StatusChip (183a)', () => {
    it('shows the glossary icon and the stack count past one', () => {
        const html = renderToStaticMarkup(<StatusChip status="Burn" count={4} />);
        expect(html).toContain(statusGlossary.Burn.icon);
        expect(html).toContain('×4');
        expect(html).toContain('data-status="Burn"');
    });

    it('shows no count for a single stack, and opens no tooltip until hovered', () => {
        const html = renderToStaticMarkup(<StatusChip status="Burn" count={1} />);
        expect(html).not.toContain('×');
        expect(html).not.toContain('os-tooltip-portal');
    });
});
