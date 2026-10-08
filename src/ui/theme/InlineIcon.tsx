/**
 * TICKET 205 - A TABLER GLYPH AT TEXT SIZE. What a symbol character in a string became.
 *
 * Card effect lines, the TERMINATED stamp, a banner's warning and the Codex stars used to carry an
 * emoji or a symbol inside their text. A character is a font glyph the player's machine picks, and it
 * ignores `color`. This draws the Tabler icon instead, through the same `TablerGlyph` every other icon
 * uses: it is `1em` square so it scales with the text around it, it sits on the baseline, and it takes
 * the colour of that text (`currentColor`), so the text rules that coloured the symbol colour it still.
 *
 * It is a different job from `Icon`, which draws a NAMED icon of the closed `IconName` set at a pixel
 * size for chrome. Here a surface's own small map (card effects, intents, the type chart, `markIcons`)
 * names the Tabler icon, and each map is checked against the generated file by
 * `inlineIconMaps.test.ts`.
 *
 * `data-icon` and `data-variant` carry the name so a test can say which icon a line drew without
 * reading path data.
 */

import type { ReactElement } from 'react';

import { filledLayers, outlineLayers } from './glyphLayers';
import type { TablerFilledName, TablerOutlineName } from './tabler.generated';
import { TablerGlyph } from './TablerGlyph';

/** Which Tabler icon, and whether the filled drawing of it. Only icons Tabler ships filled can be filled. */
export type InlineIconRef =
    | { readonly name: TablerOutlineName; readonly filled?: false }
    | { readonly name: TablerFilledName; readonly filled: true };

export type InlineIconProps = InlineIconRef & {
    /** A CSS length. Default `1em`, the size of the text. A button label in small type asks for more. */
    readonly size?: string;
    /** An accessible name. Absent, the icon is decorative: the words beside it say the same thing. */
    readonly title?: string;
};

export function InlineIcon({ name, filled, size = '1em', title }: InlineIconProps): ReactElement {
    const layers = filled === true ? filledLayers(name as TablerFilledName) : outlineLayers(name);
    return (
        <TablerGlyph
            layers={layers}
            title={title}
            style={{ width: size, height: size, verticalAlign: '-0.15em', flexShrink: 0 }}
            data-icon={name}
            data-variant={filled === true ? 'filled' : 'outline'}
        />
    );
}
