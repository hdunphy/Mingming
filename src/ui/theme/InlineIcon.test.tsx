/**
 * TICKET 205 - `InlineIcon`: a Tabler glyph drawn at the size of the text around it, in the colour of
 * the text around it. Replaces the emoji and symbol characters that sat in strings.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { InlineIcon } from './InlineIcon';
import { iconsIn } from './iconMarkup';
import { TABLER_FILLED, TABLER_OUTLINE } from './tabler.generated';

describe('InlineIcon (205)', () => {
    it('draws the named Tabler outline icon as an svg', () => {
        const markup = renderToStaticMarkup(<InlineIcon name="sword" />);
        expect(markup.startsWith('<svg')).toBe(true);
        expect(iconsIn(markup)).toEqual([{ name: 'sword', variant: 'outline' }]);
        // Tabler's own nodes, nothing else.
        expect(markup.match(/<path\b/g)).toHaveLength(TABLER_OUTLINE.sword.length);
    });

    it('is as big as the text: 1em square, sitting on the baseline, never shrunk by a flex row', () => {
        const markup = renderToStaticMarkup(<InlineIcon name="sword" />);
        expect(markup).toMatch(/style="[^"]*width:1em/);
        expect(markup).toMatch(/style="[^"]*height:1em/);
        expect(markup).toMatch(/vertical-align:/);
        expect(markup).toMatch(/flex-shrink:0/);
    });

    it('takes a size when the text around it is tiny (a button label)', () => {
        expect(renderToStaticMarkup(<InlineIcon name="dna" size="1.25em" />)).toMatch(/width:1\.25em/);
    });

    it('takes its colour from the text: currentColor, never a hex', () => {
        const markup = renderToStaticMarkup(<InlineIcon name="heart" />);
        expect(markup).toContain('stroke="currentColor"');
        expect(markup).not.toMatch(/(fill|stroke)="#/);
    });

    it('draws the FILLED variant in currentColor with no outline', () => {
        const markup = renderToStaticMarkup(<InlineIcon name="star" filled />);
        expect(iconsIn(markup)).toEqual([{ name: 'star', variant: 'filled' }]);
        expect(markup).toContain('fill="currentColor"');
        expect(markup).toContain('stroke="none"');
        expect(markup.match(/<path\b/g)).toHaveLength(TABLER_FILLED.star.length);
        // And the outline star is not the filled one.
        expect(renderToStaticMarkup(<InlineIcon name="star" />)).not.toContain('fill="currentColor"');
    });

    it('is decorative by default (the words beside it say it) and named only when asked', () => {
        expect(renderToStaticMarkup(<InlineIcon name="check" />)).toContain('aria-hidden="true"');
        const named = renderToStaticMarkup(<InlineIcon name="check" title="Met" />);
        expect(named).toContain('role="img"');
        expect(named).toContain('<title>Met</title>');
    });
});
