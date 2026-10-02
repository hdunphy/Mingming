import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { statusGlossary } from '../../../engine/data/statusGlossary';
import type { StatusType } from '../../../engine/types';
import { StatusIcon } from './StatusIcon';
import { STATUS_ICON_PATHS } from './statusIconPaths';

const STATUSES = Object.keys(statusGlossary) as StatusType[];

describe('the status icons (183b)', () => {
    it('draws an icon for every status the glossary lists - and there are fourteen', () => {
        expect(STATUSES).toHaveLength(14);
        for (const status of STATUSES) {
            expect(STATUS_ICON_PATHS[status], status).toMatch(/^M/);
        }
        expect(Object.keys(STATUS_ICON_PATHS).sort()).toEqual([...STATUSES].sort());
    });

    it('renders an svg and never an emoji', () => {
        const emoji = /\p{Extended_Pictographic}/u;
        for (const status of STATUSES) {
            const html = renderToStaticMarkup(<StatusIcon status={status} />);
            expect(html).toContain('<svg');
            expect(html).toContain(`data-status-icon="${status}"`);
            expect(emoji.test(html), status).toBe(false);
        }
    });

    it('no two statuses share a drawing', () => {
        expect(new Set(Object.values(STATUS_ICON_PATHS)).size).toBe(STATUSES.length);
    });
});
