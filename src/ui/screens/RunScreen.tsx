/**
 * The run shell — ticket 09.
 *
 * # WHAT THIS IS, AND WHAT IT IS NOT
 *
 * A run exists in state now: it has a seed, a generated region, a party, a deck and a position.
 * This screen is what proves that — it reads the run, shows where you are, and lets you walk an
 * edge or abandon. It is **not** the region map.
 *
 * **Ticket 10 builds `ui/screens/RegionMap.tsx`** — the rendered graph with node icons, element
 * badges, fog at one layer ahead, visit counts, click-to-travel and keyboard navigation — and drops
 * it into the `<!-- map goes here -->` slot below. What is here instead is a plain list of the
 * current node's neighbours: enough to demonstrate that the graph is walkable and that a run
 * survives an app close, and deliberately not enough to be mistaken for the finished screen.
 *
 * Travel does not trigger anything yet either. Ticket 07 rules that **entering a node triggers it
 * again, always** — wilds re-fight, markets restock — and ticket 11 owns that. Here, travel moves
 * `currentNodeId` and increments `visited`, which is the state the trigger will read.
 */

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { GYM_REGISTRY } from '../../engine/run/gyms';
import type { IRegionNode, NodeKind } from '../../engine/runTypes';
import { clearRun, setRun } from '../store/runSlice';
import type { RootState } from '../store/store';
import { playSfx } from '../audio/AudioEngine';

/** Icons match the prototype's SVG legend so a screenshot and a debug dump read the same. */
const NODE_ICON: Record<NodeKind, string> = {
    wild: '⚔',
    elite: '☠',
    alpha: '👑',
    ambush: '🕳',
    marketplace: '🛒',
    workshop: '🔧',
    event: '❓',
    gym: '🏛',
};

const NODE_LABEL: Record<NodeKind, string> = {
    wild: 'Wild',
    elite: 'Elite',
    alpha: 'Alpha',
    ambush: 'Ambush',
    marketplace: 'Marketplace',
    workshop: 'Workshop',
    event: 'Event',
    gym: 'Gym',
};

export default function RunScreen(): ReactNode {
    const dispatch = useDispatch();
    const run = useSelector((s: RootState) => s.run.run);
    const roster = useSelector((s: RootState) => s.game.roster);

    const byId = useMemo(() => new Map((run?.nodes ?? []).map((n) => [n.id, n])), [run]);
    const current = run ? byId.get(run.currentNodeId) : undefined;

    if (!run || !current) return null;

    const gym = GYM_REGISTRY[run.gymId];
    const biome = run.biomes[current.biomeIndex];
    const neighbours = current.edges
        .map((id) => byId.get(id))
        .filter((n): n is IRegionNode => !!n);

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

            <section className="ranch-section">
                <div className="ranch-section-head">
                    <h2>{NODE_ICON[current.kind]} {NODE_LABEL[current.kind]}{current.pocket ? ' (pocket)' : ''}</h2>
                </div>
                <p className="ranch-note">
                    <strong>Ticket 10 replaces everything below with the rendered region map</strong> — node
                    icons, fog at one layer ahead, click-to-travel and keyboard routing. This list exists to
                    prove the graph is walkable and that a run survives an app close; entering a node does
                    not trigger it yet, which is ticket 11.
                </p>

                <div className="ranch-roster-grid">
                    {neighbours.map((node) => (
                        <button key={node.id} type="button" className="ranch-card" onClick={() => travel(node)}>
                            <div className="ranch-card-name">{NODE_ICON[node.kind]} {NODE_LABEL[node.kind]}</div>
                            <div className="ranch-card-species">
                                biome {node.biomeIndex + 1} · layer {node.layer}
                                {node.pocket ? ' · pocket' : ''}
                            </div>
                            {node.visited > 0 && (
                                <div className="ranch-card-block">visited ×{node.visited}</div>
                            )}
                        </button>
                    ))}
                </div>

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
