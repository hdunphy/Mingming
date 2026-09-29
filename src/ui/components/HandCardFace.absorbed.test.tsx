import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import HandCardFace, { type HandCardPreviewFace } from './HandCardFace';
import type { ProgramData } from '../../engine/types';

/**
 * TICKET 167i — Henry, 2026-09-27: *"Barkshield numbers need to be fixed either to an int or 2
 * decimals. It currently reads as 1.3248929838928 when you hover over the target with barkshield."*
 * Bark Shield is a share of max HP, so what it absorbs is almost never whole. The engine keeps the
 * exact figure; the SCREEN shows a whole number.
 */
const CARD = {
    id: 'test_hit', name: 'Test Hit', category: 'ATTACK', element: 'Fire', cost: 1,
    description: 'Deal damage.', actions: [{ type: 'ATTACK', power: 10, target: 'ENEMY' }],
} as unknown as ProgramData;

const face = (absorbed: number): HandCardPreviewFace => ({
    damage: 20, healing: 0, absorbed, lethal: false, hitCount: 1, effectiveness: 1, measuredOn: 'SKOLL',
});
const html = (absorbed: number) =>
    renderToStaticMarkup(<HandCardFace data={CARD} displayCost={1} preview={face(absorbed)} />);

describe('167i — the ABS chip on a hand card', () => {
    it('shows a whole number for a fractional absorbed amount', () => {
        expect(html(13.7)).toContain('ABS 14');
    });

    it('never prints a decimal point for the figure Henry saw', () => {
        const out = html(1.3248929838928);
        expect(out).toContain('ABS 1<');
        expect(out).not.toContain('1.32');
    });

    it('does not draw the chip when the amount is zero', () => {
        expect(html(0)).not.toContain('ABS');
    });
});
