import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HpBar } from './HpBar';
import { hpStep } from './hpSteps';
import { statusGlossary } from '../../../engine/data/statusGlossary';

describe('the HP steps (183a)', () => {
    it('goes green above 50%, yellow from 50% to 20%, red under 20%', () => {
        expect(hpStep(51, 100)).toBe('hi');
        expect(hpStep(50, 100)).toBe('mid');
        expect(hpStep(20, 100)).toBe('mid');
        expect(hpStep(19, 100)).toBe('low');
        expect(hpStep(0, 100)).toBe('low');
    });

    it('turns at the same place whatever the max, and survives over-heal and a zero max', () => {
        expect(hpStep(563, 1125)).toBe('hi');
        expect(hpStep(100, 200)).toBe('mid');
        expect(hpStep(500, 100)).toBe('hi');
        expect(hpStep(5, 0)).toBe('low');
    });
});

describe('HpBar (183a)', () => {
    it('fills to the ratio in the step\'s colour', () => {
        const html = renderToStaticMarkup(<HpBar cur={414} max={1125} />);
        expect(html).toContain('data-step="mid"');
        expect(html).toContain('width:36.8%');
        expect(html).toContain('aria-valuenow="414"');
        expect(html).not.toContain('hp-shield');
    });

    it('lays Bark Shield over the bar from the end of the fill, with its HP on it', () => {
        const html = renderToStaticMarkup(<HpBar cur={50} max={100} shield={20} />);
        expect(html).toContain('left:50%');
        expect(html).toContain('width:20%');
        expect(html).toContain('>20<');
        expect(html).toContain(statusGlossary.BarkShield.description);
    });

    it('pushes a shield wider than the room back over the end of the fill, so it is always seen', () => {
        const html = renderToStaticMarkup(<HpBar cur={100} max={100} shield={30} />);
        expect(html).toContain('left:70%');
        expect(html).toContain('width:30%');
    });

    it('draws no band for no shield', () => {
        expect(renderToStaticMarkup(<HpBar cur={10} max={100} shield={0} />)).not.toContain('hp-shield');
    });
});

describe('HpBar ghost chunk (189c)', () => {
    it('draws a pale chunk out to where the bar was, behind the fill', () => {
        const html = renderToStaticMarkup(<HpBar cur={70} max={100} ghost={100} />);
        expect(html).toContain('data-testid="hp-ghost"');
        expect(html).toContain('width:100%');
        // Behind the fill: it comes first in the markup.
        expect(html.indexOf('k-hp-ghost')).toBeLessThan(html.indexOf('k-hp-fill'));
    });

    it('draws none when the ghost has drained, or was never given', () => {
        expect(renderToStaticMarkup(<HpBar cur={70} max={100} ghost={70} />)).not.toContain('hp-ghost');
        expect(renderToStaticMarkup(<HpBar cur={70} max={100} />)).not.toContain('hp-ghost');
    });

    it('keeps the step colour of the NEW value, not the ghost\'s', () => {
        expect(renderToStaticMarkup(<HpBar cur={10} max={100} ghost={90} />)).toContain('data-step="low"');
    });
});
