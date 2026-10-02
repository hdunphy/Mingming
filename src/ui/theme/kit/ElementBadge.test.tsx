import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ElementBadge } from './ElementBadge';

describe('ElementBadge (183a)', () => {
    it('is the symbol alone without a label', () => {
        const html = renderToStaticMarkup(<ElementBadge element="Water" />);
        expect(html).toContain('--k-el:var(--el-water)');
        expect(html).not.toContain('k-badge-word');
    });

    it('prints the word when asked, and the word is its own for a grey element', () => {
        const html = renderToStaticMarkup(<ElementBadge element="Dark" label="DARK" />);
        expect(html).toContain('>DARK<');
        expect(html).toContain('var(--el-none)');
    });
});
