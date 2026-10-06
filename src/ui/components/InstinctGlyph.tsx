/**
 * TICKET 199 — draws an Instinct's glyph. One component for every place an Instinct is named, so a
 * player learns one picture per Instinct (194j: "Maybe a glyph that players will learn").
 *
 * It takes `currentColor` from where it is placed, so the chip tints it by element. An Instinct whose
 * glyph is not drawn yet gets the generic firmware icon, so the other 21 can arrive one at a time.
 */
import type { CSSProperties, ReactElement } from 'react';

import { instinctGlyphKey, instinctGlyphMarkup } from '../labels/instinctGlyphs';
import { Icon } from '../theme/Icon';

export interface InstinctGlyphProps {
    /** A body's `activeOS` (a species id such as `fenrir_v1`) or an Instinct registry id. */
    readonly instinct: string | null | undefined;
    /** Rendered square. 16 on a chip, 20 in a tooltip header. */
    readonly size?: number;
    readonly className?: string;
    readonly style?: CSSProperties;
    /** An accessible name. Omit it when the Instinct's name sits beside the glyph. */
    readonly title?: string;
}

const WRAP: CSSProperties = { display: 'inline-flex', lineHeight: 0, flex: 'none' };

export function InstinctGlyph({ instinct, size = 16, className, style, title }: InstinctGlyphProps): ReactElement {
    const key = instinctGlyphKey(instinct);
    const markup = instinctGlyphMarkup(instinct);
    return (
        <span className={className} style={{ ...WRAP, ...style }} data-instinct-glyph={key ?? 'generic'}>
            {markup === null ? (
                <Icon name="firmware" size={size} title={title} />
            ) : (
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    overflow="visible"
                    color="currentColor"
                    role={title ? 'img' : undefined}
                    aria-label={title}
                    aria-hidden={title ? undefined : true}
                    focusable="false"
                    // The file's own shapes, read from `src/ui/assets/instinct-glyphs` at build time.
                    dangerouslySetInnerHTML={{ __html: markup }}
                />
            )}
        </span>
    );
}
