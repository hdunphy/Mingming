/**
 * THE BIOME PANEL — ticket 183g. `BiomeBackdrop` (183b) at map scale: the same five flat bands, in
 * a slanted panel with a label chip, behind a stretch of the map. The backdrop is a stretch-to-fit
 * SVG, so the panel only owes it a box; the colours come from the biome's token set, stamped here
 * as `data-biome` exactly as the battle stage does.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';

import '../../theme/kit/kit.css';
import './map.css';
import '../stage/stage.css';
import { ElementMark } from '../../theme/kit/ElementMark';
import { BiomeBackdrop } from '../stage/BiomeBackdrop';

export interface BiomePanelProps {
    /** The biome's element: `Fire`, `Water`, `Nature`, or `None`. */
    readonly element: string;
    /** The label chip, e.g. `Biome 1 · Brinehollow`. */
    readonly label: string;
    readonly width: number;
    readonly height: number;
    readonly children?: ReactNode;
}

export function BiomePanel({ element, label, width, height, children }: BiomePanelProps): ReactElement {
    return (
        <div
            className="k-slant k-biome"
            data-testid="biome-panel"
            data-biome={element.toLowerCase()}
            style={{ ['--k-cut' as string]: '10px', width, height } as CSSProperties}
        >
            <BiomeBackdrop />
            <div className="k-slant k-biome-label k-display" style={{ ['--k-cut' as string]: '6px' } as CSSProperties}>
                <ElementMark element={element} size={16} />
                {label}
            </div>
            {children}
        </div>
    );
}
