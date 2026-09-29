// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { FxFloats } from './UnitFxLayer';
import type { CombatFloat, FloatKind, UnitFx } from '../hooks/useBattleVfx';

/**
 * TICKET 167h — Henry, 2026-09-27: *"The damage numbers cover each other and move away too fast. It's
 * hard to read them."* Floats used to fan out SIDEWAYS in six slots and rise 1 s; they now stack
 * UPWARD from a vertical offset per slot, and statuses get a column of their own.
 */

const fxOf = (floats: CombatFloat[]): UnitFx => ({
    floats, hitKey: 0, hitIntensity: 0, healKey: 0, statusKey: 0, statusColor: '#fff', lungeKey: 0,
});
const float = (id: number, kind: FloatKind, slot: number): CombatFloat =>
    ({ id, kind, text: `f${id}`, color: '#fff', slot });

/** The `<div class="hud-float ...">` open tags, in render order. */
function floatTags(floats: CombatFloat[]): string[] {
    const html = renderToStaticMarkup(<FxFloats fx={fxOf(floats)} />);
    return html.match(/<div class="hud-float[^>]*>/g) ?? [];
}
const left = (tag: string) => /left:([^;"]+)/.exec(tag)?.[1] ?? '';
/** The first translateY in the tag's transform: where the float STARTS. */
const startY = (tag: string) => Number(/translateY\((-?[\d.]+)px\)/.exec(tag)?.[1] ?? NaN);

describe('167h — floating numbers stack instead of fanning out', () => {
    it('two damage floats on one unit start at different heights and share a left', () => {
        const [a, b] = floatTags([float(1, 'damage', 0), float(2, 'damage', 1)]);
        expect(startY(a)).not.toBeNaN();
        expect(startY(b)).not.toBeNaN();
        expect(startY(b)).not.toBe(startY(a));
        expect(left(a)).toBe(left(b));
        expect(left(a)).toBe('50%');
    });

    it('each slot starts 22 px further below the default start than the last', () => {
        const tags = floatTags([float(1, 'damage', 0), float(2, 'damage', 1), float(3, 'damage', 5)]);
        expect(startY(tags[1]) - startY(tags[0])).toBe(22);
        expect(startY(tags[2]) - startY(tags[0])).toBe(22 * 5);
    });

    it('a status float sits in its own column, left of the damage column', () => {
        const [damage, status] = floatTags([float(1, 'damage', 0), float(2, 'status', 1)]);
        expect(left(status)).not.toBe(left(damage));
        expect(left(status)).toBe('calc(50% - 70px)');
    });

    it('no longer takes a slotSpacing: the sideways fan is gone', () => {
        const html = renderToStaticMarkup(<FxFloats fx={fxOf([float(1, 'damage', 3)])} />);
        expect(html).not.toContain('calc(50% +');
    });
});
