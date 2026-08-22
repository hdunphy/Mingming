/**
 * Run start — ticket 09 (steam-release map).
 *
 * # THE ORDER IS THE DESIGN
 *
 * Henry consolidated run start when he closed ticket 07: **three gym offers first, then the party.**
 * Not the other way round, and no fixed first-run order.
 *
 * That ordering is load-bearing, not cosmetic. Ticket 05 flagged a real risk in the Early Access
 * shape: the launch triangle (Fire > Nature > Water > Fire) is a *pure counter cycle*, so if the
 * player committed to a party before seeing where it was going, roughly a third of runs would open
 * into the biome that counters them — a coin flip disguised as a choice. Choosing the destination
 * first makes the counter cycle a *decision* instead: you can see the opening biome and pick the
 * starter that answers it.
 *
 * The generator holds up its half of that bargain — `offerGyms` guarantees the three offers open on
 * three different biomes, so the choice always exists.
 *
 * # WHAT A RUN STARTS WITH
 *
 * A seed, the region graph (ticket 07), the party, and **8 cards per member: 5 `startKit` tags + 3
 * generics** (ticket 08, tags ratified 2026-08-21). No scrap, no macros, no drivers. Everything
 * else is earned inside the run and thrown away at the end of it.
 */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { rollSeed } from '../../engine/core/SeedStream';
import { PARTY_SIZE, partyBlockFor } from '../../engine/party';
import { toMingmingState } from '../../engine/run/battleSetup';
import { createRun } from '../../engine/run/createRun';
import { FIRST_BATTLE_TIP_ID } from '../../engine/tips';
import { offerGyms, type IGymOffer } from '../../engine/run/gyms';
import type { IRanchMember } from '../../engine/runTypes';
import { startRun } from '../store/runSlice';
import type { RootState } from '../store/store';
import { playSfx } from '../audio/AudioEngine';

/**
 * The offer screen is rolled ONCE per visit and held in component state.
 *
 * Deliberately not re-rolled on every render, and deliberately not persisted: re-rolling would let
 * a player scrub for a favourable set by navigating away and back, and persisting it would mean
 * ticket 23's ranch save carrying something that is not ranch state. A visit is one hand of offers.
 */
function useOfferScreen(): ReadonlyArray<IGymOffer> {
    const [seed] = useState(() => rollSeed());
    return useMemo(() => offerGyms(seed), [seed]);
}

export default function RunStart(): ReactNode {
    const dispatch = useDispatch();
    const roster = useSelector((s: RootState) => s.game.roster);
    // Ticket 24: "has this player been taught a fight yet?" is one question with one answer, and it
    // lives in `seenTips`. The first battle tip is the proxy for the whole set because it is the one
    // that fires unconditionally — every other tip waits for a moment that may never arrive.
    const seenTips = useSelector((s: RootState) => s.game.seenTips);

    const offers = useOfferScreen();
    const [chosen, setChosen] = useState<IGymOffer | null>(null);
    const [partyIds, setPartyIds] = useState<string[]>([]);

    const party = useMemo(
        () => partyIds.map((id) => roster.find((m) => m.id === id)).filter((m): m is IRanchMember => !!m),
        [partyIds, roster],
    );

    const toggle = (memberId: string): void => {
        if (partyIds.includes(memberId)) {
            setPartyIds(partyIds.filter((id) => id !== memberId));
            playSfx('uiClick');
            return;
        }
        const member = roster.find((m) => m.id === memberId);
        if (!member || partyBlockFor(member, party) !== null) {
            playSfx('uiError');
            return;
        }
        setPartyIds([...partyIds, memberId]);
        playSfx('uiClick');
    };

    const launch = (): void => {
        if (!chosen || party.length === 0) return;
        // The run seed is rolled here and threaded through everything downstream — the graph, the
        // card instance ids, and (later) encounter contents. One roll, so a run replays from one
        // string. `startedAt` is injected for the same reason the engine never calls `Date.now()`:
        // a module that reads the clock cannot be tested deterministically.
        dispatch(startRun(createRun({
            seed: rollSeed(),
            offer: chosen,
            // Ticket 11: the roster holds `IRanchMember`s. `toMingmingState` adds the one field
            // combat's shape still demands — `blueprintsCollected`, which is vestigial; see its
            // doc comment.
            party: party.map(toMingmingState),
            startedAt: Date.now(),
            onboarding: !seenTips.includes(FIRST_BATTLE_TIP_ID),
        })));
        playSfx('breach');
    };

    if (roster.length === 0) {
        return (
            <section className="ranch-section">
                <h2>No mingmings</h2>
                <p className="ranch-note">
                    A run needs at least one assembled mingming. Spend a blueprint in <strong>Assembly</strong>.
                </p>
            </section>
        );
    }

    return (
        <section className="ranch-section">
            <div className="ranch-section-head">
                <h2>{chosen ? 'Choose your party' : 'Choose a gym'}</h2>
                {chosen && (
                    <button type="button" className="ranch-button subtle" onClick={() => { setChosen(null); playSfx('uiClick'); }}>
                        ← Back to offers
                    </button>
                )}
            </div>

            {!chosen && (
                <>
                    <p className="ranch-note">
                        Three leaders are taking challengers. Each run walks all three biomes in the order
                        shown and ends at the leader&apos;s own region. <strong>You pick the route first and
                        the party second</strong> — the three offers always open on three different biomes,
                        so a counter is always available.
                    </p>
                    <div className="ranch-offer-grid">
                        {offers.map((offer) => (
                            <button
                                key={offer.gym.id}
                                type="button"
                                className="ranch-offer"
                                onClick={() => { setChosen(offer); playSfx('uiClick'); }}
                            >
                                <div className="ranch-offer-name">{offer.gym.name}</div>
                                <div className="ranch-offer-meta">
                                    {offer.gym.element} gym · tier {offer.gym.tier + 1}
                                </div>
                                <ol className="ranch-offer-route">
                                    {offer.biomes.map((biome, i) => (
                                        <li key={biome.id}>
                                            <span className="ranch-offer-step">{i + 1}</span>
                                            {biome.name}
                                            <span className="ranch-offer-element">{biome.elements.join(' / ')}</span>
                                        </li>
                                    ))}
                                </ol>
                            </button>
                        ))}
                    </div>
                </>
            )}

            {chosen && (
                <>
                    <p className="ranch-note">
                        Opening biome: <strong>{chosen.biomes[0].name} ({chosen.biomes[0].elements.join(' / ')})</strong>.
                        Up to {PARTY_SIZE} members, one per species. Each brings 8 cards — 5 from its kit and 3
                        generics — and the whole party&apos;s cards form one shared deck.
                    </p>
                    <div className="ranch-roster-grid">
                        {roster.map((member) => {
                            const picked = partyIds.includes(member.id);
                            const block = picked ? null : partyBlockFor(member, party);
                            return (
                                <button
                                    key={member.id}
                                    type="button"
                                    className={`ranch-card ${picked ? 'active' : ''} ${block ? 'blocked' : ''}`}
                                    onClick={() => toggle(member.id)}
                                    aria-pressed={picked}
                                >
                                    <div className="ranch-card-name">{member.nickname ?? GetMingmingData(member.definitionId).name}</div>
                                    <div className="ranch-card-species">
                                        {GetMingmingData(member.definitionId).name} · {GetMingmingData(member.definitionId).primaryElement}
                                    </div>
                                    <div className="ranch-ivs">
                                        <span>⚔ {member.attackIV}</span>
                                        <span>🛡 {member.defenseIV}</span>
                                        <span>💚 {member.hpIV}</span>
                                    </div>
                                    {picked && <div className="ranch-card-badge">Deploying</div>}
                                    {block === 'duplicate-species' && <div className="ranch-card-block">Already fielding this species</div>}
                                    {block === 'party-full' && <div className="ranch-card-block">Party is full</div>}
                                </button>
                            );
                        })}
                    </div>

                    <div className="ranch-modal-actions">
                        <button
                            type="button"
                            className="ranch-button"
                            disabled={party.length === 0}
                            onClick={launch}
                        >
                            {party.length === 0
                                ? 'Pick at least one member'
                                : `Begin run — ${party.length} member${party.length === 1 ? '' : 's'}, ${party.length * 8} cards`}
                        </button>
                    </div>
                </>
            )}
        </section>
    );
}
