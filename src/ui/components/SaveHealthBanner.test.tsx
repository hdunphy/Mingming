import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import SaveHealthBanner from './SaveHealthBanner';
import { reportSaveResult, resetSaveHealth } from '../store/saveHealth';
import { iconsIn } from '../theme/iconMarkup';

/** TICKET 205 - the banner's warning mark is a Tabler triangle, not a character. */
describe('the save-health banner (205)', () => {
    beforeEach(() => {
        resetSaveHealth();
    });

    it('draws nothing while saving works', () => {
        expect(renderToStaticMarkup(<SaveHealthBanner />)).toBe('');
    });

    it('draws the warning triangle before the headline when a save fails', () => {
        reportSaveResult({ success: false, kind: 'quota', error: 'storage is full' });
        const markup = renderToStaticMarkup(<SaveHealthBanner />);
        expect(iconsIn(markup)).toEqual([{ name: 'alert-triangle', variant: 'outline' }]);
        expect(markup).toContain('NOT SAVING');
        expect(markup.indexOf('<svg')).toBeLessThan(markup.indexOf('NOT SAVING'));
    });
});
