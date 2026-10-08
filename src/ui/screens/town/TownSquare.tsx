/**
 * TICKET 176c (M7) — the town square: the way into a town, with one button per building and a
 * status line on each saying what is waiting inside. The square is where a town opens.
 */
import type { ReactNode } from 'react';

import { minimumActiveDeck } from '../../../engine/run/createRun';
import { upgradeAllowanceFor } from '../../../engine/run/marketplace';
import { tracesHeld } from '../../../engine/run/workshop';
import type { IRanchState, IRegionNode, IRunState, TownTab } from '../../../engine/runTypes';
import type { TownBuilding } from '../../components/map/townBuildings';
import { TOWN_ICON } from '../../components/map/townIcons';
import { outlineLayers } from '../../theme/glyphLayers';
import { TablerGlyph } from '../../theme/TablerGlyph';
import { denTagLine } from '../../labels/denTagLine';
import { junkNote, readDeckFloor } from '../deckFloor';
import { TOWN_BUILDINGS, TOWN_TAB_LABEL } from './townText';
import { upgradesLeftAt } from './townStatus';

export interface TownSquareProps {
    readonly run: IRunState;
    readonly node: IRegionNode;
    readonly ranch: IRanchState;
    readonly onOpen: (tab: TownTab) => void;
}

/** The town's tabs are the map's buildings; the Den is the tab the engine calls `workshop` (ticket 200d). */
const BUILDING_OF_TAB = { shop: 'shop', upgrades: 'upgrades', workshop: 'den', loadout: 'loadout' } as const satisfies Record<(typeof TOWN_BUILDINGS)[number], TownBuilding>;

export function TownSquare({ run, node, ranch, onOpen }: TownSquareProps): ReactNode {
    const allowance = upgradeAllowanceFor(node);
    const left = upgradesLeftAt(run, node);
    const traces = tracesHeld(ranch, run);
    const reading = readDeckFloor(run);

    const status: Readonly<Record<(typeof TOWN_BUILDINGS)[number], string>> = {
        shop: 'Cards, a trace, draughts and runes. Sells your spares.',
        upgrades: left > 0 ? `${left} of ${allowance} upgrades left this visit` : `All ${allowance} upgrades used this visit`,
        workshop: denTagLine(traces) ?? `${traces} traces held · party ${run.partyIds.length}`,
        loadout: `Deck ${reading.counted} / floor ${minimumActiveDeck(run.partyIds.length)}${junkNote(reading)}`,
    };

    return (
        <div className="town-square" role="group" aria-label="Town square">
            <p className="town-say">The road opens onto a small square. Pick a building.</p>
            <div className="town-buildings">
                {TOWN_BUILDINGS.map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        className="town-building"
                        data-tab={tab}
                        onClick={() => onOpen(tab)}
                    >
                        <TablerGlyph layers={outlineLayers(TOWN_ICON[BUILDING_OF_TAB[tab]])} size={26} />
                        <span className="town-building-nm">{TOWN_TAB_LABEL[tab]}</span>
                        <span className="town-building-st">{status[tab]}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
