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
 * # THE MARKETPLACE IS A PANEL, NOT A ROUTE (ticket 13), AND SO IS THE WORKSHOP (ticket 14)
 *
 * Standing on a market renders `MarketplaceNode` inside this screen, with the map still underneath
 * it. That is a deliberate difference from the fight path, which swaps the whole screen for
 * `BattleArena`: a market is not a mode you are trapped in, it is a thing at the place you are
 * standing, and ticket 07 makes leaving it a matter of walking to a neighbour on the map that is
 * already on screen. There is no "leave the shop" button because there is nothing to leave.
 *
 * `WorkshopNode` takes the same shape for the same reasons, plus one of its own: the workshop writes
 * the **ranch** as well as the run (an assembled individual joins the permanent roster), so it is
 * handed `ranch` alongside `run` where the market needs only the party.
 *
 * # THE GYM IS THE EXCEPTION, AND IT IS AN EXCEPTION ON PURPOSE (ticket 18)
 *
 * `GauntletNode` renders **instead of** the map, not over it. The gauntlet is three fights with no
 * way out but through (`exploration-map.md`: *"three fights, NO healing between them"*), so leaving
 * the region map on screen would offer a walk the run has no rule for. It is also the one node whose
 * fight does not start by itself: stepping on it calls `beginGauntlet` and the Pit Stop takes over,
 * because the whole value of a between-fights screen is that the player gets to look first.
 *
 * The one remaining non-fight kind does nothing yet and says so on screen. A node that fired and
 * produced no visible change is indistinguishable from a node that failed to fire.
 *
 * # THE RUN ENDS IN ONE PLACE (ticket 19)
 *
 * `phase: 'ended'` renders `RunSummary`, whatever ended it. Ticket 11's placeholder panel is gone,
 * and so is abandon's private exit: **abandoning now dispatches `endRun('abandoned')`** and arrives
 * at the same screen a defeat and a gym clear do. That is the ticket's central instruction — three
 * endings that unwind separately are three endings that drift — and it is why nothing in this file
 * touches the ranch on the way out any more. `ui/store/runTeardown.ts` is the only thing that does.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { buildBattleSetup, toMingmingState } from '../../engine/run/battleSetup';
import { RUN_ENEMY_MODE, isFightNode, rollEncounter } from '../../engine/run/encounter';
import { isMarketNode } from '../../engine/run/marketplace';
import { isWorkshopNode } from '../../engine/run/workshop';
import { GYM_REGISTRY } from '../../engine/run/gyms';
import type { IRegionNode, NodeKind } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';
import { getMacro, isBiomeRevealed, revealedBiomesFrom } from '../../engine/data/macroRegistry';
import { startBattle } from '../store/battleSlice';
import { beginGauntlet, endRun, enterNode, fireMapReveal } from '../store/runSlice';
import type { RootState } from '../store/store';
import { playSfx } from '../audio/AudioEngine';
import GauntletNode from './GauntletNode';
import MarketplaceNode from './MarketplaceNode';
import RegionMap from './RegionMap';
import Callout from '../components/Callout';
import { nextMapTip } from '../../engine/tips';
import RunSummary from './RunSummary';
import WorkshopNode from './WorkshopNode';
import { NODE_ICON, NODE_LABEL } from './regionLayout';

/**
 * The kinds that have no handler yet, and the ticket that gives them one.
 *
 * Named rather than lumped into one "coming soon" because the point of showing this at all is to be
 * checkable: standing on a workshop and reading "ticket 14" tells you the trigger fired and which
 * ticket owes you the rest. A silent node would look exactly like a broken one.
 *
 * **`marketplace` left this table in ticket 13 and `workshop` in ticket 14** — both have screens
 * now, so neither is pending. The entries are removed rather than pointed at the landed tickets,
 * because the table's meaning is "nothing happens here", and a kind that renders a shop or a bench
 * would be a false entry in it.
 */
const PENDING_NODE_TICKET: Partial<Record<NodeKind, number>> = {
    event: 30,
};

export default function RunScreen(): ReactNode {
    const dispatch = useDispatch();
    const run = useSelector((s: RootState) => s.run.run);
    const ranch = useSelector((s: RootState) => s.game);
    const roster = ranch.roster;

    /**
     * Whether the abandon button is showing its second step (ticket 19). Component state rather
     * than run state on purpose: this is a half-pressed button, not a fact about the run, and
     * writing it into `IRunState` would persist a UI hesitation into the save file.
     *
     * Declared above the early return, as hooks must be.
     */
    const [confirmingAbandon, setConfirmingAbandon] = useState(false);

    const byId = useMemo(() => new Map((run?.nodes ?? []).map((n) => [n.id, n])), [run]);
    const current = run ? byId.get(run.currentNodeId) : undefined;

    /**
     * The party, for anything that needs to know what species are on the team — today the
     * marketplace's stock pool (ticket 13), which draws by the same rule as a reward pick.
     *
     * Memoised because it is a fresh array every render otherwise, and `MarketplaceNode` keys its
     * stock roll on it: a new array identity every render would re-roll a deterministic stock over
     * and over for nothing. Declared above the early return, as hooks must be.
     */
    const marketParty = useMemo(
        () => (run?.partyIds ?? [])
            .map((id) => roster.find((m) => m.id === id))
            .filter((m): m is (typeof roster)[number] => m !== undefined),
        [run, roster],
    );

    /**
     * Which biomes a map-reveal macro has surveyed (ticket 15).
     *
     * Memoised for `marketParty`'s reason and one more: `RegionMap` keys its layout `useMemo` on
     * this array, so a fresh identity every render would re-lay-out the whole graph on every render
     * for nothing. Declared above the early return, as hooks must be.
     */
    const revealedBiomes = useMemo(() => revealedBiomesFrom(run?.modifiers ?? []), [run]);

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

        /*
         * TICKET 18: THE GYM IS A FIGHT KIND, BUT IT IS NOT *A* FIGHT.
         *
         * `enterNode` sets `phase: 'encounter'` for every kind in `FIGHT_KINDS`, the gym included —
         * which was right when the gym was one battle. It is three now, so the gym's arm of this
         * effect hands the run to `beginGauntlet` instead of rolling an encounter: that reducer sets
         * `phase: 'gauntlet'` and the Pit Stop below takes it from there. Rolling a fight here as
         * well would start battle one twice over.
         *
         * `beginGauntlet` is idempotent (it refuses when a gauntlet is already in progress), which
         * is what makes this safe under `StrictMode`'s double-invoked effects.
         */
        if (node.kind === 'gym') {
            dispatch(beginGauntlet());
            return;
        }

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

    /**
     * Abandon — **ticket 19 routed it through the same teardown as the other two endings.**
     *
     * It used to be `clearRun()` behind a `window.confirm`, which was two problems. The first is the
     * one the ticket names: a third way out of a run that unwinds by itself is a third way out that
     * drifts from the other two — it skipped the codex merge, and it would have skipped anything a
     * later ticket adds to teardown. It now does exactly what a defeat does: `endRun('abandoned')`,
     * which marks the run ended without clearing it, and the summary takes over from there.
     *
     * # AND THE CONFIRM
     *
     * `window.confirm` is gone, replaced by a two-step inline confirm. The ticket asks whether a
     * confirm is still right when the summary is the confirmation, and the answer is that **the
     * summary is not a confirmation** — by the time it renders the run has already ended, and there
     * is no button on it that puts you back on the map. So something still has to stand between one
     * stray click and forty minutes.
     *
     * What that something should not be is `window.confirm`: it is a native modal in a game that
     * draws its own UI, it blocks the whole renderer, it cannot be styled or reached by a gamepad
     * (ticket 38), and it cannot be tested. The two-step below is the same protection expressed as
     * ordinary buttons — the second one names the consequence, and "Keep going" is right beside it.
     */
    const abandon = (): void => {
        setConfirmingAbandon(false);
        dispatch(endRun('abandoned'));
        playSfx('uiError');
    };

    /**
     * The abandon control, in whichever of its two states it is in. Rendered in both the map header
     * and the gauntlet header, which is why it is a local function rather than duplicated markup:
     * quitting a run is always allowed, and the two headers must offer the identical affordance.
     */
    const abandonControl = (): ReactNode => (confirmingAbandon ? (
        <span className="ranch-run-abandon">
            <button type="button" className="ranch-button subtle" onClick={abandon}>
                Abandon — the run is lost
            </button>
            <button
                type="button"
                className="ranch-button subtle"
                onClick={() => { setConfirmingAbandon(false); playSfx('uiClick'); }}
            >
                Keep going
            </button>
        </span>
    ) : (
        <button
            type="button"
            className="ranch-button subtle"
            onClick={() => { setConfirmingAbandon(true); playSfx('uiClick'); }}
        >
            Abandon run
        </button>
    ));

    /**
     * The run is over — victory, defeat or abandon, all three land here.
     *
     * Ticket 11 left a placeholder panel that said the run was over and that the ranch was intact,
     * and pointed at this ticket for the rest. `RunSummary` is the rest: what the run cost, what it
     * banked, how long it took, and the one path back to the ranch. The outcome only changes the
     * words — the teardown behind that button is identical for all three, which is the whole reason
     * they share a screen.
     */
    if (run.phase === 'ended') {
        return <RunSummary run={run} />;
    }

    /**
     * The gauntlet takes the whole screen — **ticket 18.**
     *
     * Not a panel over the map like the shop and the bench, because the gauntlet is the one node you
     * cannot walk away from: `exploration-map.md` makes the gym three fights with no healing
     * between them, and a live map underneath would offer a walk that has no rule behind it. The
     * header stays (which gym, how far in, how much scrap) and so does **Abandon run** — quitting a
     * run is always allowed, it just costs the run.
     */
    if (run.phase === 'gauntlet') {
        return (
            <div className="ranch-screen">
                <header className="ranch-header">
                    <h1>🏛 {gym?.name ?? run.gymId}</h1>
                    <div className="ranch-run-meta">
                        Biome {current.biomeIndex + 1}/3 · {biome?.name} ({biome?.elements.join(' / ')}) ·
                        {' '}{run.fightsResolved} fights · {run.scrap} scrap
                    </div>
                    {abandonControl()}
                </header>

                <section className="ranch-section ranch-section-wide">
                    <GauntletNode run={run} node={current} ranch={ranch} />
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

                {/*
                  * The market's stock is rolled from the node the player is standing on, which
                  * `enterNode` has already visit-incremented — the same count `rollEncounter` reads,
                  * and the reason a re-entered market is a genuinely different stall.
                  *
                  * The party is passed as roster members: `IRewardPartyMember` needs only
                  * `definitionId` + `activeOS`, which `IRanchMember` already satisfies structurally,
                  * so there is nothing to map and no second shape of "the party" to keep in step.
                  */}
                {isMarketNode(current.kind) && (
                    <MarketplaceNode run={run} node={current} party={marketParty} />
                )}

                {/*
                  * The workshop reads the same visit-incremented node — the individual it offers is
                  * rolled from it, exactly as a market's stock is (ticket 07 / `nodeSeed`), so a
                  * resumed run is standing in the same workshop it left.
                  *
                  * It gets the whole `ranch` rather than the mapped party, because an assembly spends
                  * a blueprint and writes the roster: this is the one node that changes the half of
                  * the save that outlives the run.
                  */}
                {isWorkshopNode(current.kind) && (
                    <WorkshopNode run={run} node={current} ranch={ranch} />
                )}

                {/*
                  * THE MACRO RACK, ON THE MAP — ticket 15.
                  *
                  * Battle macros are fired from `BattleArena`'s rack; what belongs *here* is the one
                  * macro that has no battle behaviour at all. Ticket 07's amendment: a map-reveal
                  * consumable, *"reveals the current biome's node types"*. `canFireMacro` refuses it
                  * inside a battle on purpose, so this button is its only firing path.
                  *
                  * The rest of the rack is still listed rather than hidden, because a consumable the
                  * player cannot see is a consumable they forget they bought — the same argument
                  * behind naming the pending node's ticket above.
                  */}
                <h2 className="ranch-subhead">Macros</h2>
                <div className="ranch-roster-grid">
                    {run.macros.map((macroId, slot) => {
                        const macro = getMacro(macroId);
                        if (!macro) {
                            return (
                                <div key={slot} className="ranch-card">
                                    <div className="ranch-card-name">Slot {slot + 1}</div>
                                    <div className="ranch-card-species">empty</div>
                                </div>
                            );
                        }
                        const isMap = macro.targeting === 'MAP';
                        const alreadySurveyed = isMap && isBiomeRevealed(run, current.biomeIndex);
                        return (
                            <div key={slot} className="ranch-card">
                                <div className="ranch-card-name">{macro.name}</div>
                                <div className="ranch-card-species">{macro.description}</div>
                                {isMap && (
                                    <button
                                        type="button"
                                        className="ranch-button"
                                        disabled={alreadySurveyed}
                                        onClick={() => {
                                            dispatch(fireMapReveal(slot));
                                            playSfx('rewardClaim');
                                        }}
                                    >
                                        {alreadySurveyed
                                            ? 'This biome is already surveyed'
                                            : `Survey ${biome?.name ?? 'this biome'}`}
                                    </button>
                                )}
                                {!isMap && <div className="ranch-card-species">Fires in battle.</div>}
                            </div>
                        );
                    })}
                </div>

                {/*
                  * ONBOARDING — ticket 24. Above the map rather than inside it: `RegionMap` takes
                  * props and touches no store (its test renders it with no `<Provider>` at all), and
                  * reaching into the store from in there to read `seenTips` would spend that
                  * property on one strip.
                  */}
                <Callout tip={nextMapTip(run, ranch.seenTips)} />

                <RegionMap
                    nodes={run.nodes}
                    currentNodeId={run.currentNodeId}
                    biomeNames={run.biomes.map((b) => b.name)}
                    biomeElements={run.biomes.map((b) => b.elements[0])}
                    // Ticket 15: the fog's third clause. Derived here rather than inside the map,
                    // because `regionLayout` is a pure function of the node set and knows nothing
                    // about a run — see its header.
                    revealedBiomes={revealedBiomes}
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
