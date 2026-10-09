/* eslint-disable react-refresh/only-export-components -- a dev entry file: it mounts, it does not export. */
/**
 * The card sheet's entry — ticket 183c. Dev only: `cards.html` is not a Vite build input, so it is
 * served by `npm run dev` at `/Mingming/cards.html` and never reaches `dist/`.
 *
 * Every surface that draws a full card, mounted for real so the screenshots show the shipped
 * markup and not a mock: `?view=shop` (stall tiles, a SOLD one, a SHORT one, the upgrade bench),
 * `loadout` (the collection grid with ×N and tags, and the deck rows whose hover is the peek),
 * `reward` (the post-battle pick: one face-down, three face-up, one selected), `event` (the
 * event's card pick).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import '../../index.css';
import MarketplaceNode from '../../ui/screens/MarketplaceNode';
import LoadoutEditor from '../../ui/screens/LoadoutEditor';
import RewardCardFace from '../../ui/components/RewardCardFace';
import RevealCard from '../../ui/components/RevealCard';
import gameReducer, { addToRoster, createEmptyRanch } from '../../ui/store/gameSlice';
import runReducer, { setRun } from '../../ui/store/runSlice';
import uiReducer from '../../ui/store/uiSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { BUILT_EVENTS } from '../../engine/run/events/eventDraw';
import EventNode from '../../ui/screens/EventNode';
import { SeedStream } from '../../engine/core/SeedStream';
import { createRanchMember } from '../../engine/gameTypes';
import { isMarketNode, rollMarketStock } from '../../engine/run/marketplace';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import type { IMingmingState } from '../../engine/types';
import type { IRunCard, IRunState } from '../../engine/runTypes';

const params = new URLSearchParams(window.location.search);
const view = params.get('view') ?? 'shop';

const PARTY: IMingmingState[] = [
    { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
];
const RANCH_PARTY = [{ definitionId: 'kraken', activeOS: 'kraken_v1' }];
const ROSTER = [
    { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 },
    { id: 'mm2', definitionId: 'fenrir', activeOS: 'fenrir_v1', attackIV: 10, defenseIV: 10, hpIV: 10 },
];

let minted = 0;
const card = (dataId: string, ownerId: string | null = null): IRunCard => {
    minted += 1;
    return { instanceId: `dev-card-${minted}`, dataId, ownerId };
};

function baseRun(scrap: number): IRunState {
    const run = createRun({
        seed: 'card-sheet-seed',
        offer: offerGyms('offer-seed')[0],
        party: PARTY,
        startedAt: 1_700_000_000_000,
    });
    const market = run.nodes.find((n) => isMarketNode(n.kind))!;
    return {
        ...run,
        scrap,
        currentNodeId: market.id,
        nodes: run.nodes.map((n) => (n.id === market.id ? { ...n, visited: n.visited + 1 } : n)),
    };
}

const store = configureStore({
    reducer: { run: runReducer, game: gameReducer, ui: uiReducer },
    preloadedState: undefined,
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
});

function Shop() {
    const scrap = Number(params.get('scrap') ?? 70);
    let run = baseRun(scrap);
    const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
    const sold = rollMarketStock({ run, node, party: RANCH_PARTY }).offers[0];
    // A tile bought (SOLD) and an upgradeable deck so the bench has a pair to peek.
    const upgradable = ['ember_jab', 'cinder_lance', 'ignite'].filter((id) => ProgramRegistry[id] !== undefined);
    run = { ...run, deck: [...run.deck, sold.card, ...upgradable.map((id) => card(id, 'mm1'))] };
    store.dispatch(setRun(run));
    return (
        <MarketplaceNode
            run={run}
            node={node}
            party={RANCH_PARTY}
            biomeName="Waterfall"
            onEditLoadout={() => undefined}
            onLeave={() => undefined}
        />
    );
}

const COLLECTION = [
    'ragnarok_edge', 'blood_rite', 'berserk_rush', 'battle_rhythm', 'crimson_draw',
    'ink_stream', 'undertow', 'whirlpool', 'hydro_blast', 'tend', 'seed_bomb', 'echo_chamber',
];

function Loadout() {
    const base = baseRun(120);
    const deck = [...COLLECTION.slice(0, 8).map((id) => card(id, 'mm1')), card('ink_stream', 'mm1'), card('ink_stream', 'mm1')];
    const spare = ['ignite', 'ember_jab', 'cinder_lance', 'ragnarok_edge', 'blood_rite', 'whirlpool', 'undertow', 'ink_stream']
        .filter((id) => ProgramRegistry[id] !== undefined);
    const collection = [...COLLECTION.slice(8).map((id) => card(id)), card('tend'), card('tend'), ...spare.map((id) => card(id))];
    const run: IRunState = { ...base, deck, collection };
    store.dispatch(setRun(run));
    return <LoadoutEditor run={run} ranch={{ ...createEmptyRanch(), roster: ROSTER }} context="WORKSHOP · WATER BIOME · 143 SCRAP" onClose={() => undefined} />;
}

/** The event node with only Scattered Verses left to draw: its `pick` choice opens the three-card offer. */
function EventView() {
    const base = createRun({ seed: 'card-sheet-event', offer: offerGyms('offer-seed')[0], party: PARTY, startedAt: 1 });
    const target = base.nodes.find((n) => n.kind === 'event' && n.id !== base.currentNodeId)
        ?? base.nodes.find((n) => n.id !== base.currentNodeId)!;
    const run: IRunState = {
        ...base,
        currentNodeId: target.id,
        nodes: base.nodes.map((n) => (n.id === target.id ? { ...n, kind: 'event' as const, visited: 1 } : n)),
        eventHistory: [...BUILT_EVENTS].filter((id) => id !== 'data_fragments').map((eventId, i) => (
            { nodeId: `other${i}`, eventId, choiceId: 'leave', grants: [] }
        )),
    };
    store.dispatch(setRun(run));
    store.dispatch(addToRoster({ ...createRanchMember('kraken', 'kraken_v1', new SeedStream('mm1-roll')), id: 'mm1' }));
    return <EventNode run={run} node={target} ranch={store.getState().game} biomeName="Waterfall" onLeave={() => undefined} />;
}

const REWARD_IDS = ['ignite', 'ink_stream', 'tend', 'cinder_lance'];

function Reward() {
    const datas = REWARD_IDS.map((id) => ProgramRegistry[id]).filter((d) => d !== undefined);
    return (
        <div style={{ padding: 40, background: 'var(--bg, #0b1020)', minHeight: '100vh' }}>
            <h2 style={{ color: 'var(--ink-on-dark, #fff)' }}>Pick a card</h2>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }} data-testid="reveal-row">
                {datas.map((d, i) => (
                    <RevealCard key={d.id} data={d} revealDelayMs={i * 60} isSelected={i === 1} onSelect={() => undefined} />
                ))}
                <RevealCard key="facedown" data={datas[0]} revealDelayMs={600000} />
            </div>
            <h2 style={{ color: 'var(--ink-on-dark, #fff)', marginTop: 32 }}>Same face, no flip</h2>
            <div style={{ display: 'flex', gap: 24 }}>
                {datas.map((d, i) => <RewardCardFace key={d.id} data={d} isSelected={i === 2} />)}
            </div>
        </div>
    );
}

const body = view === 'loadout' ? Loadout() : view === 'reward' ? <Reward /> : view === 'event' ? EventView() : Shop();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Provider store={store}>{body}</Provider>
    </StrictMode>,
);
