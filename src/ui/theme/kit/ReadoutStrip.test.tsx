import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { HandCardPreviewFace } from '../../components/HandCardFace';
import { ReadoutStrip } from './ReadoutStrip';

const preview = (over: Partial<HandCardPreviewFace>): HandCardPreviewFace => ({
    damage: 0, healing: 0, absorbed: 0, lethal: false, hitCount: 1, effectiveness: 1, measuredOn: null, ...over,
});

describe('ReadoutStrip (183a)', () => {
    it('prints the true damage big, the target small, and a SUPER chip', () => {
        const html = renderToStaticMarkup(
            <ReadoutStrip element="Fire" preview={preview({ damage: 142, measuredOn: 'Huldra', effectiveness: 1.5 })} />);
        expect(html).toContain('>142<');
        expect(html).toContain('vs Huldra');
        expect(html).toContain('SUPER ×1.5');
        expect(html).toContain('--k-el:var(--el-fire)');
    });

    it('prints a heal as +N to the target', () => {
        const html = renderToStaticMarkup(
            <ReadoutStrip element="Nature" preview={preview({ healing: 15, measuredOn: 'Fenrir' })} />);
        expect(html).toContain('>+15<');
        expect(html).toContain('to Fenrir');
    });

    it('carries every chip the preview carries', () => {
        const html = renderToStaticMarkup(<ReadoutStrip element="Water"
            preview={preview({ damage: 30, effectiveness: 0.5, hitCount: 3, absorbed: 12.4, lethal: true })} />);
        for (const chip of ['RESIST ×0.5', '×3 HITS', 'ABS 12', 'LETHAL']) expect(html).toContain(chip);
        expect(html).not.toContain('SUPER');
    });

    it('draws nothing for a card with no figure', () => {
        expect(renderToStaticMarkup(<ReadoutStrip element="Fire" preview={preview({})} />)).toBe('');
    });
});
