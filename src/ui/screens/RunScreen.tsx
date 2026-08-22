/**
 * The run shell — ticket 09, with ticket 10's map and ticket 11's node trigger.
 *
 * This is the frame around a run: which leader you are challenging, where you are, the party and
 * its deck, and the way out. `RegionMap` (ticket 10) is the map itself and owns everything about
 * how the graph is drawn and travelled.
 *
 * # TRAVEL NOW TRIGGERS (ticket 11, part 2)
 *
 * Ticket 07, RULED: *"Entering a node triggers it again, always."* Until this ticket, travel moved
 * `currentNodeId`, bumped `visited` and deliberately fired nothing. The move itself is now
 * `runSlice.enterNode` — one action that walks, increments and sets the phase — and this component
 * is what the phase talks to.
 *
 * **The battle starts from an effect on `run.phase`, not from inside the click handler.** Two
 * reasons, and the second is the one that matters:
 *
 * 1. The encounter is rolled from the visit count *after* the increment (ticket 07's re-roll rule),
 *    so a handler firing the battle would have to duplicate the increment locally to know what to
 *    roll from. Reading the phase back out of the store means there is exactly one increment.
 * 2. It makes the fight a **property of the run's state rather than of a click**. An app close
 *    between stepping onto a wild and winning it resumes with `phase: 'encounter'`, and this effect
 *    re-rolls the identical fight from the identical seed — ticket 23's resume contract extended to
 *    encounters, for free, because nothing about the fight was ever held in a component.
 *
 * The three non-fight kinds do nothing yet and say so on screen. A node that fired and produced no
 * visible change is indistinguishable from a node that failed to fire.
 */

import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { buildBattleSetup, toMingmingState } from '../../engine/run/battleSetup';
import { RUN_ENEMY_MODE, isFightNode, rollEncounter } from '../../engine/run/encounter';
import { GYM_REGISTRY } from '../../engine/run/gyms';
import type { IRegionNode, NodeKind } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';
import { startBattle } from '../store/battleSlice';
import { clearRun, enterNode } from '../store/runSlice';
import type { RootState } from '../store/store';
import { playSfx } from '../audio/AudioEngine';
import RegionMap from './RegionMap';
import { NODE_ICON, NODE_LABEL } from './regionLayout';

/**
 * The three kinds that have no handler yet, and the ticket that gives them one.
 *
 * Named rather than lumped into one "coming soon" because the point of showing this at all is to be
 * checkable: standing on a workshop and reading "ticket 14" tells you the trigger fired and which
 * ticket owes you the rest. A silent node would look exactly like a broken one.
 */
const PENDING_NODE_TICKET: Partial<Record<NodeKind, number>> = {
    marketplace: 13,
    workshop: 14,
    event: 30,
};

export default function RunScreen(): ReactNode {
    const dispatch = useDispatch();
    const run = useSelector((s: RootState) => s.run.run);
    const ranch = useSelector((s: RootState) => s.game);
    const roster = ranch.roster;

    const byId = useMemo(() => new Map((run?.nodes ?? []).map((n) => [n.id, n])), [run]);
    const current = run ? byId.get(run.currentNodeId) : undefined;

    /**
     * Fire the encounter the run's phase is asking for.
     *
     * Guarded on `phase === 'encounter'` alone: `App` renders `BattleArena` instead of this screen
     * for the whole life of the battle, so there is no window in which this component is mounted
     * with a battle already up. The victory path (`resolveEncounter`) puts the phase back to
     * `'map'` in the same batch that clears the battle, so remounting does not re-fire.
     *
     * A party that resolves to nobody cannot start a fight — `createBattleState` throws on an empty
     * party. `reconcileLoadedState` makes that unreachable at load, so bailing quietly here is
     * guarding against a state nothing can produce rather than swallowing a real case.
     */
    useEffect(() => {
        if (!run || run.phase !== 'encounter') return;

        const node = run.nodes.find((n) => n.id === run.currentNodeId);
        if (!node || !isFightNode(node.kind)) return;

        const party: IMingmingState[] = [];
        for (const id of run.partyIds) {
            const member = roster.find((m) => m.id === id);
            if (member) party.push(toMingmingState(member));
        }
        if (party.length === 0) return;

        const encounter = rollEncounter({ run, node, party });

        dispatch(startBattle({
            setup: buildBattleSetup(ranch, run, encounter),
            // The pre-rolled encounter answers both of these; they are the pre-run generator's
            // parameters and this path does not use it.
            enemyIds: [],
            // Seeding the battle from the encounter's own seed is what makes the whole fight — the
            // shuffle and the opening hand included, not just the enemies — replay from the node.
            options: { seed: encounter.seed, enemyMode: RUN_ENEMY_MODE },
        }));
    }, [run, ranch, roster, dispatch]);

    if (!run || !current) return null;

    const gym = GYM_REGISTRY[run.gymId];
    const biome = run.biomes[current.biomeIndex];

    /**
     * Travel. Everything the move means lives in the reducer (`runSlice.enterNode`): the walk, the
     * visit increment ticket 07 rolls contents from, and the phase that starts the fight.
     */
    const travel = (target: IRegionNode): void => {
        dispatch(enterNode(target.id));
        playSfx('uiClick');
    };

    const abandon = (): void => {
        if (!window.confirm('Abandon this run? The run is lost. Your roster and blueprints are not.')) return;
        dispatch(clearRun());
        playSfx('uiError');
    };

    /**
     * The run is over — **PLACEHOLDER, ticket 19 replaces this whole panel.**
     *
     * Ticket 19 owns the run-end screen: what you banked, what you kept, how far you got, and the
     * offer to go again. Until it lands, an ended run must still be *leavable*, and it must say
     * something true. The two sentences below are the whole of it: the run is over, and the ranch —
     * the only irreplaceable half of the save (`runTypes.ts`) — is untouched. Saying so out loud
     * matters because the defeat screen used to lie about it: it printed "DATA WIPED" and then
     * wiped the save to match, which was correct when a save *was* the run and is catastrophic now
     * that it is the ranch.
     */
    if (run.phase === 'ended') {
        const won = run.outcome === 'victory';
        return (
            <div className="ranch-screen">
                <header className="ranch-header">
                    <h1>{won ? '🏛 Gym cleared' : '💀 Run over'}</h1>
                </header>
                <section className="ranch-section">
                    <p className="ranch-note">
                        {won
                            ? `You beat ${gym?.name ?? run.gymId}. The clear is recorded at the ranch.`
                            : `Your party fell in ${biome?.name ?? 'the region'}.`}
                        {' '}Fights resolved: {run.fightsResolved}. Your roster, blueprints and codex
                        are untouched — a run never costs you those.
                    </p>
                    <p className="ranch-note">The full run summary is ticket 19.</p>
                    <button
                        type="button"
                        className="ranch-button"
                        onClick={() => { dispatch(clearRun()); playSfx('uiClick'); }}
                    >
                        Return to the ranch
                    </button>
                </section>
            </div>
        );
    }

    const pendingTicket = PENDING_NODE_TICKET[current.kind];

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

                {pendingTicket !== undefined && (
                    <p className="ranch-note">
                        You are standing in the {NODE_LABEL[current.kind].toLowerCase()} — nothing
                        here yet (ticket {pendingTicket}). Entering it counted as a visit, so walking
                        back in later will roll it fresh.
                    </p>
                )}

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
