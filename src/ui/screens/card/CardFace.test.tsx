/**
 * TICKET 183c — THE CARD FACE, AS RENDERED.
 *
 * Static markup, the convention the other component tests set. The hand's own states (STAB, the
 * selected ring, the readout against a real preview) are asserted in `CardHand.test.tsx`, where the
 * attributes are set; this holds the face itself to the ticket's order and to D3.
 */
import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { STAB_BONUS } from '../../../engine/combatUtils';
import { stabTitle } from '../../components/stabText';
import { ReadoutStrip } from '../../theme/kit/ReadoutStrip';
import { CardFace } from '../CardChassis';

const FACE = { name: 'Ember Jab', description: 'Deal 8. Apply 1 Burn.', element: 'Fire', cost: 2 };
const html = (node: React.ReactElement): string => renderToStaticMarkup(node);

describe('CardFace (183c)', () => {
    it('draws header, art slot, rules text and foot, in that order', () => {
        const markup = html(<CardFace face={FACE} target="ENEMY" />);
        const order = ['rs-hd', 'rs-art', 'rs-desc', 'rs-elbar'].map((c) => markup.indexOf(`class="${c}"`));
        expect(order.every((i) => i >= 0)).toBe(true);
        expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it('puts the element mark, the name and the energy hexagon in the header', () => {
        const header = /<span class="rs-hd">([\s\S]*?)<\/span><span class="rs-art">/.exec(html(<CardFace face={FACE} />))![1];
        expect(header.indexOf('k-mark')).toBeGreaterThanOrEqual(0);
        expect(header.indexOf('rs-cnm')).toBeGreaterThan(header.indexOf('k-mark'));
        expect(header.indexOf('k-energy')).toBeGreaterThan(header.indexOf('rs-cnm'));
        expect(header).toContain('aria-label="Energy 2"');
        expect(header).toContain('aria-label="Fire"');
    });

    it('has no type mark and no energy pips (D3)', () => {
        const markup = html(<CardFace face={FACE} target="ENEMY" />);
        expect(markup).not.toContain('rs-typ');
        expect(markup).not.toContain('rs-pips');
        expect(markup).not.toMatch(/[▲✦◆●]/);
    });

    it('says the target as an icon on the art slot, with the words as its hover', () => {
        const markup = html(<CardFace face={FACE} target="SELF" />);
        expect(markup).toContain('title="Targets: self"');
        expect(markup.indexOf('rs-tgt')).toBeGreaterThan(markup.indexOf('class="rs-art"'));
        expect(html(<CardFace face={FACE} target="—" />)).not.toContain('rs-tgt');
        expect(html(<CardFace face={FACE} />)).not.toContain('rs-tgt');
    });

    it('ends in the 5px element bar with no figure, and in the readout strip with one', () => {
        expect(html(<CardFace face={FACE} />)).toContain('class="rs-elbar"');
        const strip = <ReadoutStrip element="Fire" preview={{ damage: 64, healing: 0, absorbed: 0, lethal: false, hitCount: 1, effectiveness: 1.5, measuredOn: 'Huldra' }} />;
        const withFigure = html(<CardFace face={FACE} readout={strip} />);
        expect(withFigure).toContain('data-testid="readout-strip"');
        expect(withFigure).not.toContain('rs-elbar');
    });

    it('paints a lit clause behind the selection yellow, and leaves the rest as plain text', () => {
        const lit = [{ start: 14, end: 21 }];
        const markup = html(<CardFace face={FACE} lit={lit} />);
        expect(markup).toContain('class="rs-lit"');
        expect(markup).toContain('Deal 8. ');
    });

    it('prints the ×N badge outside the clipped body, so the slant cannot cut it', () => {
        const markup = html(<CardFace face={FACE} count={3} />);
        expect(markup).toContain('<span class="rs-nbadge">×3</span>');
        expect(markup.indexOf('rs-nbadge')).toBeGreaterThan(markup.lastIndexOf('rs-elbar'));
        expect(html(<CardFace face={FACE} count={1} />)).not.toContain('rs-nbadge');
    });

    it('draws no energy hexagon for a body that is not a card (a blueprint)', () => {
        const markup = html(<CardFace face={{ name: 'Fenrir', description: 'A blueprint.', element: 'Fire' }} />);
        expect(markup).not.toContain('k-energy');
    });
});

describe('the STAB sentence (183c)', () => {
    it('is the ruled text, with the multiplier read from STAB_BONUS', () => {
        expect(stabTitle()).toBe(
            `STAB: Same Type Attack Bonus. This card matches the caster's element: ×${STAB_BONUS} power.`,
        );
    });
});

describe('card.css (183c)', () => {
    const css = readFileSync('src/ui/screens/card/card.css', 'utf8');

    it('turns the frame the element colour on data-stab, and rings a selected card in yellow', () => {
        expect(css).toMatch(/\.rs-card\[data-stab\]\s*\{\s*--frame:\s*var\(--el\)/);
        expect(css).toMatch(/\.rs-card\[data-selected\][\s\S]*var\(--select\)/);
        expect(css).toMatch(/\.rs-card\s*\{[^}]*--frame:\s*var\(--ink\)/);
    });

    it('draws no glow, no blur and no rounded corner', () => {
        expect(css).not.toMatch(/blur\(/);
        expect(css).not.toMatch(/box-shadow:[^;]*\d+px\s+\d+px\s+[1-9]\d*px/);
        expect(css).not.toMatch(/border-radius:\s*[1-9]/);
    });
});
