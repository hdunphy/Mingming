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
