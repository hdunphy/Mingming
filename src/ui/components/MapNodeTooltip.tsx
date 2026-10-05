/**
 * THE MAP NODE TOOLTIP — ticket 194m.
 *
 * The map's nodes used to answer a hover with an SVG `<title>`, which is the browser's own grey
 * tooltip, unstyled and a second late. This is the same words in a plate of the game's own: portalled
 * to the body (so the pannable canvas's overflow never clips it) and placed over the node, the way
 * `StatusTooltipPortal` places a status. It is a pure view: the map decides when it is open and where.
 *
 * `lines[0]` is what the node is ("Rival: Sköll, Huldra, Fire + Water"); every line after it is a note
 * (a rival's reason, the Totem at stake). The screen-reader text is not here: the picture is
 * `aria-hidden` and the Travel list beneath it is the accessible path, so the same words live there.
 */
import React from 'react';
import { createPortal } from 'react-dom';

import type { AnchoredRect } from '../hooks/useAnchoredRect';
import { placeTip, TIP_WIDTH_PX } from './tipPlacement';
import './MapNodeTooltip.css';

export const MapNodeTooltip: React.FC<{ lines: readonly string[]; rect: AnchoredRect }> = ({ lines, rect }) => {
    if (lines.length === 0) return null;
    const { left, top, below } = placeTip(rect, window.innerWidth);
    const [head, ...notes] = lines;
    return createPortal(
        <div
            className="map-tip"
            role="presentation"
            style={{ left, top, transform: below ? 'translateX(-50%)' : 'translate(-50%, -100%)', width: TIP_WIDTH_PX }}
        >
            <div className="map-tip-head">{head}</div>
            {notes.map((note) => <div key={note} className="map-tip-note">{note}</div>)}
        </div>,
        document.body,
    );
};
