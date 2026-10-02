import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SlantPanel } from './SlantPanel';

describe('SlantPanel (183a)', () => {
    it('is the light-edge shape with the navy body inside it and its children in the body', () => {
        const html = renderToStaticMarkup(<SlantPanel><span>hello</span></SlantPanel>);
        expect(html).toContain('k-slant k-panel');
        expect(html).toContain('k-panel-body');
        expect(html).toContain('<span>hello</span>');
        expect(html).toContain('--k-cut:8px');
        expect(html).not.toContain('slant-slash');
    });

    it('takes a skew, and an element slash on the face asked for', () => {
        const html = renderToStaticMarkup(<SlantPanel cut={5} slash="right" element="Fire" data-testid="p" />);
        expect(html).toContain('--k-cut:5px');
        expect(html).toContain('k-slash-right');
        expect(html).toContain('--k-el:var(--el-fire)');
        expect(html).toContain('data-testid="p"');
    });
});
