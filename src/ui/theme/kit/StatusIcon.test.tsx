import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { statusGlossary } from '../../../engine/data/statusGlossary';
import type { StatusType } from '../../../engine/types';
import { StatusIcon } from './StatusIcon';
import { STATUS_ICON_NAMES } from './statusIconPaths';
import { TABLER_OUTLINE } from '../tabler.generated';

const STATUSES = Object.keys(statusGlossary) as StatusType[];

describe('the status icons (183b, 200d)', () => {
    it('draws an icon for every status the glossary lists - and there are fourteen', () => {
        expect(STATUSES).toHaveLength(14);
        for (const status of STATUSES) {
            expect(TABLER_OUTLINE[STATUS_ICON_NAMES[status]], status).toBeDefined();
        }
        expect(Object.keys(STATUS_ICON_NAMES).sort()).toEqual([...STATUSES].sort());
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
        expect(new Set(Object.values(STATUS_ICON_NAMES)).size).toBe(STATUSES.length);
    });
});
