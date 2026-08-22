/**
 * The run shell — ticket 09, with ticket 10's map dropped in.
 *
 * This is the frame around a run: which leader you are challenging, where you are, the party and
 * its deck, and the way out. `RegionMap` (ticket 10) is the map itself and owns everything about
 * how the graph is drawn and travelled.
 *
 * **Travel still does not TRIGGER anything.** Ticket 07 rules that entering a node triggers it
 * again, always — wilds re-fight, markets restock — and **ticket 11 owns the trigger**. What
 * happens here is the state that the trigger will read: `currentNodeId` moves and the destination's
 * `visited` count goes up. The count is a count rather than a flag precisely so a second visit can
 * roll a second encounter instead of replaying a cached one.
 */

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { GYM_REGISTRY } from '../../engine/run/gyms';
import type { IRegionNode } from '../../engine/runTypes';
import { clearRun, setRun } from '../store/runSlice';
import type { RootState } from '../store/store';
import { playSfx } from '../audio/AudioEngine';
import RegionMap from './RegionMap';
import { NODE_ICON, NODE_LABEL } from './regionLayout';

export default function RunScreen(): ReactNode {
    const dispatch = useDispatch();
    const run = useSelector((s: RootState) => s.run.run);
    const roster = useSelector((s: RootState) => s.game.roster);

    const byId = useMemo(() => new Map((run?.nodes ?? []).map((n) => [n.id, n])), [run]);
    const current = run ? byId.get(run.currentNodeId) : undefined;

    if (!run || !current) return null;

    const gym = GYM_REGISTRY[run.gymId];
    const biome = run.biomes[current.biomeIndex];

    /**
     * Travel. `visited` is a COUNT, not a flag, because ticket 07 rules that re-entering a node
     * triggers it again — the count is what the content roll will read so a second visit rolls a
     * second encounter rather than replaying a cached one.
     */
    const travel = (target: IRegionNode): void => {
        dispatch(setRun({
            ...run,
            currentNodeId: target.id,
            nodes: run.nodes.map((n) => (n.id === target.id ? { ...n, visited: n.visited + 1 } : n)),
        }));
        playSfx('uiClick');
    };

    const abandon = (): void => {
        if (!window.confirm('Abandon this run? The run is lost. Your roster and blueprints are not.')) return;
        dispatch(clearRun());
        playSfx('uiError');
    };

    return (
        <div className="ranch-screen">
            <header className="ranch-header">
                <h1>🗺 {gym?.name ?? run.gymId}</h1>
                <div className="ranch-run-meta">
                    Biome {current.biomeIndex + 1}/3 · {biome?.name} ({biome?.elements.join(' / ')}) ·
                    layer {current.layer} · {run.fightsResolved} fights · {run.scrap} scrap
                </div>
                <button type="button" className="ranch-button subtle" onClick={abandon}>Abandon run</button>
            </header>

            <section className="ranch-section ranch-section-wide">
                <div className="ranch-section-head">
                    <h2>{NODE_ICON[current.kind]} {NODE_LABEL[current.kind]}{current.pocket ? ' (pocket)' : ''}</h2>
                </div>

                <RegionMap
                    nodes={run.nodes}
                    currentNodeId={run.currentNodeId}
                    biomeNames={run.biomes.map((b) => b.name)}
                    biomeElements={run.biomes.map((b) => b.elements[0])}
                    onTravel={travel}
                />

                <h2 className="ranch-subhead">Party</h2>
                <div className="ranch-roster-grid">
                    {run.partyIds.map((id) => {
                        const member = roster.find((m) => m.id === id);
                        const cards = run.deck.filter((c) => c.ownerId === id).length;
                        return (
                            <div key={id} className="ranch-card">
                                <div className="ranch-card-name">
                                    {member?.nickname ?? (member ? GetMingmingData(member.definitionId).name : id)}
                                </div>
                                <div className="ranch-card-species">{cards} cards</div>
                            </div>
                        );
                    })}
                </div>
                <p className="ranch-note">Run deck: {run.deck.length} cards. Seed <code>{run.seed}</code>.</p>
            </section>
        </div>
    );
}
