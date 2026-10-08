/**
 * The 183g pieces laid out the way `research/183-mocks/183-map.html` and `183-town-square.html`
 * lay them out, so the screenshots can be held against the mocks. Not the real map: 176 composes
 * the pieces; this is only a proof that they draw.
 */
import type { ReactElement } from 'react';

import { BiomePanel } from '../../ui/components/map/BiomePanel';
import { NodeIcon } from '../../ui/components/map/NodeIcon';
import { RouteLine } from '../../ui/components/map/RouteLine';
import { TownButton } from '../../ui/components/map/TownButton';
import { NODE_WORD, type NodeIconKind } from '../../ui/components/map/nodeKinds';

interface Spot { readonly id: string; readonly x: number; readonly y: number; readonly kind: NodeIconKind; readonly element?: string; readonly faded?: boolean; readonly selected?: boolean }

const SPOTS: ReadonlyArray<Spot> = [
    { id: 'a', x: 70, y: 321, kind: 'start' },
    { id: 'b', x: 214, y: 321, kind: 'fight', element: 'Water' },
    { id: 'c', x: 358, y: 266, kind: 'rival', faded: true },
    { id: 'd', x: 358, y: 376, kind: 'fight', element: 'Water' },
    { id: 'e', x: 502, y: 211, kind: 'fight', element: 'Fire', faded: true },
    { id: 'f', x: 502, y: 431, kind: 'fight', element: 'Water' },
    { id: 'g', x: 430, y: 145, kind: 'detour', faded: true },
    { id: 'h', x: 646, y: 321, kind: 'town' },
    { id: 'i', x: 790, y: 266, kind: 'event', selected: true },
    { id: 'j', x: 790, y: 376, kind: 'event', faded: true },
    { id: 'k', x: 934, y: 321, kind: 'elite', element: 'Fire' },
];
const ROADS: ReadonlyArray<readonly [string, string, 'taken' | 'ahead' | 'passed' | 'detour']> = [
    ['a', 'b', 'taken'], ['b', 'c', 'passed'], ['b', 'd', 'taken'], ['d', 'f', 'taken'], ['f', 'h', 'taken'],
    ['c', 'e', 'passed'], ['h', 'i', 'taken'], ['h', 'j', 'passed'], ['i', 'k', 'ahead'], ['c', 'g', 'detour'], ['g', 'e', 'detour'],
];
const at = (id: string) => SPOTS.find((s) => s.id === id)!;

export function MapPieces(): ReactElement {
    return (
        <div style={{ position: 'relative', width: 1280, height: 800, overflow: 'hidden', background: 'var(--panel)' }}>
            <div style={{ position: 'absolute', left: 10, top: 96 }}>
                <BiomePanel element="Water" label="Biome 1 · Brinehollow" width={996} height={540} />
            </div>
            <div style={{ position: 'absolute', left: 1018, top: 96 }}>
                <BiomePanel element="Nature" label="Biome 2 · Rootmire" width={708} height={540} />
            </div>
            <svg style={{ position: 'absolute', left: 0, top: 0 }} width="1280" height="800" viewBox="0 0 1280 800">
                {ROADS.map(([from, to, state]) => (
                    <RouteLine
                        key={`${from}${to}`}
                        from={at(from)}
                        to={at(to)}
                        state={state}
                        element={state === 'ahead' ? 'Fire' : undefined}
                    />
                ))}
            </svg>
            {SPOTS.map((spot) => {
                const w = spot.kind === 'town' ? 150 : spot.kind === 'elite' ? 76 : 60;
                const h = spot.kind === 'town' ? 70 : w;
                return (
                    <div key={spot.id} style={{ position: 'absolute', left: spot.x - w / 2, top: spot.y - h / 2 }}>
                        <NodeIcon
                            kind={spot.kind}
                            element={spot.element}
                            faded={spot.faded}
                            selected={spot.selected}
                            sub={spot.kind === 'town' ? 'Shop · Den' : undefined}
                        />
                        {spot.kind !== 'town' && (
                            <div
                                className="k-display"
                                style={{ position: 'absolute', left: -30, top: h + 4, width: w + 60, textAlign: 'center', fontSize: 12, color: 'var(--ink)', opacity: spot.faded ? 0.45 : 0.9 }}
                            >
                                {NODE_WORD[spot.kind]}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export function TownPieces(): ReactElement {
    return (
        <div data-biome="nature" style={{ position: 'relative', width: 1280, height: 800, overflow: 'hidden', background: 'var(--sky)' }}>
            <div style={{ position: 'absolute', left: 0, top: 160, width: 1280, height: 200, background: 'var(--near)' }} />
            <div style={{ position: 'absolute', left: 0, top: 300, width: 1280, height: 500, background: 'var(--ground)' }} />
            <div style={{ position: 'absolute', left: 40, top: 128 }}>
                <TownButton building="shop" status="8 cards · Kraken trace · runes" />
            </div>
            <div style={{ position: 'absolute', left: 660, top: 128 }}>
                <TownButton building="upgrades" status="3 left this visit" />
            </div>
            <div style={{ position: 'absolute', left: 40, top: 436 }}>
                <TownButton building="den" status="Sköll ready to Summon" ready />
            </div>
            <div style={{ position: 'absolute', left: 660, top: 436 }}>
                <TownButton building="loadout" status="13 cards · floor 13" />
            </div>
        </div>
    );
}
