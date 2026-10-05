/**
 * TICKET 176c (M7) — the town's frame: a top bar, a rail of buildings down the left, the tab body,
 * and a dock along the bottom with the purse and the way out. The dock is hidden on the Loadout
 * tab, which takes the whole window the way it does everywhere else.
 */
import type { ReactNode } from 'react';

import type { TownTab } from '../../../engine/runTypes';
import { playSfx } from '../../audio/AudioEngine';
import { Icon } from '../../theme/Icon';
import { TOWN_BUILDINGS, TOWN_TAB_LABEL } from './townText';
import './TownNode.css';

export interface TownShellProps {
    readonly tab: TownTab;
    readonly scrap: number;
    readonly biomeName?: string;
    readonly visit: number;
    readonly onTab: (tab: TownTab) => void;
    readonly onLeave: () => void;
    readonly children: ReactNode;
}

export function TownShell({ tab, scrap, biomeName, visit, onTab, onLeave, children }: TownShellProps): ReactNode {
    const open = (next: TownTab): void => { playSfx('uiClick'); onTab(next); };

    return (
        <section className="town rs-frame rs-fixed" data-tab={tab}>
            <div className="rs-top">
                <span className="rs-title">TOWN{tab === 'square' ? '' : ` — ${TOWN_TAB_LABEL[tab].toUpperCase()}`}</span>
                <span className="rs-ctx">{(biomeName ?? 'THIS').toUpperCase()} BIOME · VISIT {visit}</span>
                <span className="rs-spacer" />
                <span className="rs-scrap" aria-label="Amber held">{scrap} <Icon name="scrap" size={12} /></span>
                {tab !== 'square' && (
                    <button type="button" className="rs-btn" onClick={() => open('square')}>
                        ← Town square
                    </button>
                )}
                <button type="button" className="rs-btn primary" onClick={() => { playSfx('uiClick'); onLeave(); }}>
                    LEAVE TOWN
                </button>
            </div>

            <div className="town-main">
                <nav className="town-rail" aria-label="Town buildings">
                    {TOWN_BUILDINGS.map((building) => (
                        <button
                            key={building}
                            type="button"
                            className={`town-tab ${tab === building ? 'on' : ''}`}
                            aria-pressed={tab === building}
                            onClick={() => open(building)}
                        >
                            {TOWN_TAB_LABEL[building]}
                        </button>
                    ))}
                </nav>
                <div className="town-body">{children}</div>
            </div>

            {tab !== 'loadout' && (
                <div className="town-dock" aria-label="Town dock">
                    <span className="town-dock-scrap">{scrap} <Icon name="scrap" size={12} /> amber</span>
                    <span className="rs-spacer" />
                    <button type="button" className="rs-btn primary" onClick={() => { playSfx('uiClick'); onLeave(); }}>
                        LEAVE TOWN
                    </button>
                </div>
            )}
        </section>
    );
}
