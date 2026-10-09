/**
 * THE NODE ICON — ticket 183g. A white symbol on a navy disc inside a light ring, 60px (76px for an
 * elite gate and the gym). Where the fight's element is known the ring takes its colour, and an
 * elite or gym fills its disc with it, so the strongest fights are the loudest. A town is not a
 * disc: it is the slanted plate the mock draws, with the house and the word, and an optional line
 * under it (`Shop · Den`).
 *
 * Selected is a 4px yellow ring and the marker above is the caller's (it sits in the map's own
 * coordinates). `faded` is a node the party has passed or cannot reach: the whole piece at 40%.
 */
import type { CSSProperties, ReactElement } from 'react';

import '../../theme/kit/kit.css';
import './map.css';
import { iconLayers } from '../../theme/iconLayers';
import { elementVars } from '../../theme/kit/elementGlyphs';
import { TablerGlyph } from '../../theme/TablerGlyph';
import { NODE_ICON_NAME, NODE_SIZE, NODE_WORD, type NodeIconKind } from './nodeKinds';

export interface NodeIconProps {
    readonly kind: NodeIconKind;
    /** The fight's element, when the map knows it. Absent, a neutral light ring. */
    readonly element?: string;
    readonly selected?: boolean;
    readonly faded?: boolean;
    /** A town's second line. */
    readonly sub?: string;
}

/** The `icons.ts` icon for this kind: the one the live region map draws. */
function Glyph({ kind, size }: { readonly kind: NodeIconKind; readonly size: number }): ReactElement {
    return <TablerGlyph layers={iconLayers(NODE_ICON_NAME[kind])} size={size} className="k-node-glyph" />;
}

export function NodeIcon({ kind, element, selected, faded, sub }: NodeIconProps): ReactElement {
    const flags = {
        'data-kind': kind,
        'data-selected': selected ? 'true' : undefined,
        'data-faded': faded ? 'true' : undefined,
    };
    if (kind === 'town') {
        return (
            <div className="k-slant k-town-node" {...flags} style={{ ['--k-cut' as string]: '10px' } as CSSProperties}>
                <div className="k-slant k-town-body" style={{ ['--k-cut' as string]: '8px' } as CSSProperties}>
                    <span className="k-town-title k-display"><Glyph kind="town" size={18} />{NODE_WORD.town}</span>
                    {sub && <span className="k-town-sub">{sub}</span>}
                </div>
            </div>
        );
    }
    const size = NODE_SIZE[kind];
    const filled = (kind === 'elite' || kind === 'gym') && element !== undefined;
    return (
        <div
            className="k-node"
            {...flags}
            data-element={element !== undefined ? element : undefined}
            data-filled={filled ? 'true' : undefined}
            style={{ ...(element !== undefined ? elementVars(element) : {}), width: size, height: size }}
        >
            <div className="k-node-disc">
                <Glyph kind={kind} size={kind === 'elite' || kind === 'gym' ? 26 : 22} />
            </div>
        </div>
    );
}
