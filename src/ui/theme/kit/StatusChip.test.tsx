import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StatusChip } from './StatusChip';

describe('StatusChip (183a)', () => {
    it('shows the status icon and the stack count past one', () => {
        const html = renderToStaticMarkup(<StatusChip status="Burn" count={4} />);
        expect(html).toContain('data-status-icon="Burn"');
        expect(html).toContain('×4');
        expect(html).toContain('data-status="Burn"');
    });

    it('shows no count for a single stack, and opens no tooltip until hovered', () => {
        const html = renderToStaticMarkup(<StatusChip status="Burn" count={1} />);
        expect(html).not.toContain('×');
        expect(html).not.toContain('os-tooltip-portal');
    });
});
