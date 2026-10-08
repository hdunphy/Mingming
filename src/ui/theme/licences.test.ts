/**
 * TICKET 200e - the licences ship with the game. Tabler's MIT licence is a condition of using its
 * icons; it lives in `public/licenses/` (copied into the build by vite) next to Barlow's OFL.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('the shipped licences (200e)', () => {
    it('includes Tabler Icons\' MIT licence, the same text the package carries', () => {
        const shipped = readFileSync(resolve('public/licenses/tabler-icons-MIT.txt'), 'utf8');
        const packaged = readFileSync(resolve('node_modules/@tabler/icons/LICENSE'), 'utf8');
        expect(shipped.replace(/\r\n/g, '\n')).toBe(packaged.replace(/\r\n/g, '\n'));
        expect(shipped).toContain('MIT License');
        expect(shipped).toContain('Paweł Kuna');
    });

    it('keeps Barlow\'s OFL beside it', () => {
        const ofl = readFileSync(resolve('public/licenses/OFL-Barlow.txt'), 'utf8');
        expect(ofl).toContain('SIL OPEN FONT LICENSE');
    });
});
