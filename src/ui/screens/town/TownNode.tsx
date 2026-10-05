/**
 * TICKET 176c (M7) — a town: one node that is both the market and the workshop, behind a square
 * and four tabs. This component only decides which tab is open; every tab body is today's screen.
 *
 * Which tab is open lives on the run (`IRunState.townTab`), not in a component, so a reload
 * reopens the same tab. The Shop tab mounts the market's shelves only when it is opened, so ticket
 * 171b's freeze of the shop's party happens then.
 */
import type { ReactNode } from 'react';
import { useDispatch } from 'react-redux';

import type { IRewardPartyMember } from '../../../engine/RewardSystem';
import { upgradeAllowanceFor, upgradeBenchKeyFor } from '../../../engine/run/marketplace';
import type { IRanchState, IRegionNode, IRunState, TownTab } from '../../../engine/runTypes';
import { setTownTab } from '../../store/runSlice';
import LoadoutEditor from '../LoadoutEditor';
import MarketplaceNode from '../MarketplaceNode';
import { UpgradeBench } from '../UpgradeBench';
import WorkshopNode from '../WorkshopNode';
import { TownShell } from './TownShell';
import { TownSquare } from './TownSquare';
import { townTabOf } from './townStatus';
import { upgradeHeading } from './townText';

export interface TownNodeProps {
    readonly run: IRunState;
    /** The town being stood in, already visit-incremented by `runSlice.enterNode`. */
    readonly node: IRegionNode;
    readonly party: ReadonlyArray<IRewardPartyMember>;
    readonly ranch: IRanchState;
    readonly biomeName?: string;
    readonly onLeave: () => void;
}

export default function TownNode({ run, node, party, ranch, biomeName, onLeave }: TownNodeProps): ReactNode {
    const dispatch = useDispatch();
    const tab = townTabOf(run, node.id);
    const open = (next: TownTab): void => { dispatch(setTownTab({ nodeId: node.id, tab: next })); };

    const context = `TOWN · ${(biomeName ?? 'BIOME').toUpperCase()} · ${run.scrap} AMBER`;
    const allowance = upgradeAllowanceFor(node);

    return (
        <>
            <TownShell
                tab={tab}
                scrap={run.scrap}
                biomeName={biomeName}
                visit={node.visited}
                onTab={open}
                onLeave={onLeave}
            >
                {tab === 'square' && <TownSquare run={run} node={node} ranch={ranch} onOpen={open} />}
                {tab === 'shop' && (
                    <MarketplaceNode
                        inTown
                        run={run}
                        node={node}
                        party={party}
                        biomeName={biomeName}
                        ranch={ranch}
                        onEditLoadout={() => open('loadout')}
                        onLeave={onLeave}
                    />
                )}
                {tab === 'upgrades' && (
                    <div className="town-upgrades">
                        <UpgradeBench
                            run={run}
                            benchKey={upgradeBenchKeyFor(node)}
                            allowance={allowance}
                            heading={upgradeHeading(allowance)}
                        />
                    </div>
                )}
                {tab === 'workshop' && (
                    <WorkshopNode
                        inTown
                        run={run}
                        node={node}
                        ranch={ranch}
                        biomeName={biomeName}
                        onEditLoadout={() => open('loadout')}
                        onLeave={onLeave}
                    />
                )}
            </TownShell>
            {tab === 'loadout' && (
                <LoadoutEditor run={run} ranch={ranch} context={context} onClose={() => open('square')} />
            )}
        </>
    );
}
