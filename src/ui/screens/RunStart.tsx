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
import { gymSignatures } from '../../engine/run/gauntlet';
import { TIERS, tierRule } from '../../engine/run/tiers/tierRegistry';
import { leaderDriverTierLine } from '../../engine/run/tiers/tierText';
import { clearsByGym, modifiersUnlocked, unlockedTiers } from '../../engine/run/tiers/tierUnlocks';
import { MODIFIERS } from '../../engine/run/modifiers/modifierRegistry';
import { offerGyms, pathElementsFor, type IGymOffer } from '../../engine/run/gyms';
import type { IRanchMember } from '../../engine/runTypes';
import { startRun } from '../store/runSlice';
import type { RootState } from '../store/store';
import { playSfx } from '../audio/AudioEngine';
import { Icon } from '../theme/Icon';
import ModifierChip from '../components/ModifierChip';

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
    const offers = useOfferScreen();
    const [chosen, setChosen] = useState<IGymOffer | null>(null);
    const [partyIds, setPartyIds] = useState<string[]>([]);
    const ranch = useSelector((s: RootState) => s.game);

    /*
     * TICKET 169e — THE TIER PICKER. Tier 0 is always open; a clear at tier N opens tier N+1 for every
     * gym (`tierUnlocks`). The screen opens on the HIGHEST unlocked tier (default D3), and the choice
     * is component state like `chosen`: not saved, so a new visit opens on the highest again.
     */
    const unlocked = useMemo(() => unlockedTiers(ranch), [ranch]);
    const clears = useMemo(() => clearsByGym(ranch), [ranch]);
    const [pickedTier, setPickedTier] = useState<number | null>(null);
    // Ticket 169f: the modifiers switched on. Locked until the first gym clear (default D2), and a
    // locked ranch launches with none whatever this holds.
    const modifiersOpen = modifiersUnlocked(ranch);
    const [pickedModifiers, setPickedModifiers] = useState<string[]>([]);
    const toggleModifier = (id: string): void => {
        setPickedModifiers((held) => (held.includes(id) ? held.filter((m) => m !== id) : [...held, id]));
        playSfx('uiClick');
    };
    const selectedTier =
        pickedTier !== null && unlocked.includes(pickedTier) ? pickedTier : unlocked[unlocked.length - 1];

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
            // Ticket 169e: the tier picked above. It is fixed for the whole run.
            tier: selectedTier,
            // Ticket 169f: only what is switched on, and only once modifiers are unlocked.
            modifiers: modifiersOpen ? MODIFIERS.map((m) => m.id).filter((id) => pickedModifiers.includes(id)) : [],
            // Ticket 11: the roster holds `IRanchMember`s. `toMingmingState` adds the one field
            // combat's shape still demands — `blueprintsCollected`, which is vestigial; see its
            // doc comment.
            party: party.map(toMingmingState),
            startedAt: Date.now(),
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
                        ‹ Back to offers
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
                    <p className="ranch-note">
                        {/* Ticket 142c: the four-link chain a player has to hold — biome decides who
                            you fight, the fight drops the blueprint, the blueprint is what a workshop
                            can build. Stated once, here, because the workshop is the end of that chain
                            and has no element of its own to show. */}
                        One wild in three is a <strong>rival</strong> walking the same road, and it fields
                        the two elements that road needs rather than the biome&apos;s — so the blueprint
                        for the body you are missing can be won in any biome, not just its own.
                    </p>
                    {/* Ticket 169e: the tier row. A locked tier is disabled and says how to open it. */}
                    <div className="ranch-tier-picker" role="group" aria-label="Difficulty tier">
                        <div className="ranch-tier-row">
                            {TIERS.map((row) => {
                                const open = unlocked.includes(row.tier);
                                return (
                                    <div key={row.tier} className="ranch-tier-slot">
                                        <button
                                            type="button"
                                            className={`ranch-button ${selectedTier === row.tier ? '' : 'subtle'}`}
                                            aria-pressed={selectedTier === row.tier}
                                            disabled={!open}
                                            onClick={() => { setPickedTier(row.tier); playSfx('uiClick'); }}
                                        >
                                            Tier {row.tier}
                                        </button>
                                        {!open && (
                                            <span className="ranch-tier-lock">
                                                Beat any gym on Tier {row.tier - 1} to unlock.
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="ranch-tier-blurb">
                            <strong>{tierRule(selectedTier).name}</strong>
                            <span>{tierRule(selectedTier).description}</span>
                        </div>
                    </div>
                    <div className="ranch-offer-grid">
                        {offers.map((offer) => (
                            <button
                                key={offer.gym.id}
                                type="button"
                                className="ranch-offer"
                                onClick={() => { setChosen(offer); playSfx('uiClick'); }}
                            >
                                <div className="ranch-offer-name">{offer.gym.name}</div>
                                {/* Ticket 169e: the tier is chosen in the row above, so the old "tier 1" label
                                    (which counted from 1 while every other screen counts from 0) is gone. */}
                                <div className="ranch-offer-meta">{offer.gym.element} gym</div>
                                {(clears[offer.gym.id]?.length ?? 0) > 0 && (
                                    <div className="ranch-offer-cleared">Cleared: {clears[offer.gym.id].join(' ')}</div>
                                )}
                                <ol className="ranch-offer-route">
                                    {offer.biomes.map((biome, i) => (
                                        <li key={biome.id}>
                                            <span className="ranch-offer-step">{i + 1}</span>
                                            {biome.name}
                                            <span className="ranch-offer-element">{biome.elements.join(' / ')}</span>
                                        </li>
                                    ))}
                                </ol>
                                {/*
                                  * TICKET 142c — THE PAIR THE ROAD FIELDS, on the screen where the
                                  * road is chosen.
                                  *
                                  * Ticket 68 ruling 4 put the leader's signature here and gave the
                                  * reason: the route is the run's one irreversible choice, so what
                                  * you need to answer it belongs on THIS screen and no later. The
                                  * path pair is the same kind of fact — it is what one wild in three
                                  * will field in every biome, and it is fully determined by the gym
                                  * you are about to pick.
                                  *
                                  * Henry played the first Rootfall run and asked *"I thought I would
                                  * see nature in the workshop somehow"*. Nothing on any screen had
                                  * ever said the pair out loud, so the mechanic could only be found
                                  * by walking into it and inferring it from an enemy party.
                                  */}
                                <div className="ranch-offer-path">
                                    <span className="ranch-offer-path-label">Rivals field</span>
                                    {pathElementsFor(offer.gym.element).map((element) => (
                                        <span key={element} className="ranch-offer-element">{element}</span>
                                    ))}
                                </div>
                                {/*
                                  * TICKET 68 ruling 4 — THE TELEGRAPH.
                                  *
                                  * The leader's signature passive, stated before the party is
                                  * chosen. It belongs on THIS screen and no later: the route is
                                  * the run's one irreversible choice, and a boss built around an
                                  * escalating aura is a boss you answer at party selection or not
                                  * at all. `gymSignatures` gives one Driver for an authored gym
                                  * and the three relic texts for a gym ruling 6 has not migrated.
                                  */}
                                <div className="ranch-offer-signature">
                                    {gymSignatures(offer.gym.id, offer.biomes).map((signature) => (
                                        <div key={signature.id} className="ranch-offer-driver">
                                            <span className="ranch-offer-driver-name">{signature.name}</span>
                                            <span className="ranch-offer-driver-rule">{signature.description}</span>
                                        </div>
                                    ))}
                                    {leaderDriverTierLine(selectedTier) && (
                                        <div className="ranch-offer-tier-driver">{leaderDriverTierLine(selectedTier)}</div>
                                    )}
                                </div>
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
                                        <span><Icon name="attack" size={12} /> {member.attackIV}</span>
                                        <span><Icon name="defense" size={12} /> {member.defenseIV}</span>
                                        <span><Icon name="hp" size={12} /> {member.hpIV}</span>
                                    </div>
                                    {picked && <div className="ranch-card-badge">Deploying</div>}
                                    {/* 2026-09-05: the clause is species + firmware, so the copy
                                        names the BUILD — a second kraken is welcome on another OS. */}
                                    {block === 'duplicate-build' && <div className="ranch-card-block">Already fielding this OS</div>}
                                    {block === 'party-full' && <div className="ranch-card-block">Party is full</div>}
                                </button>
                            );
                        })}
                    </div>

                    {/* Ticket 169f: opt-in run modifiers. They earn nothing but a label. */}
                    <div className="ranch-modifier-row" role="group" aria-label="Run modifiers">
                        <span className="ranch-modifier-title">Modifiers</span>
                        {MODIFIERS.map((modifier) => (
                            <ModifierChip
                                key={modifier.id}
                                name={modifier.name}
                                description={modifier.description}
                                on={modifiersOpen && pickedModifiers.includes(modifier.id)}
                                disabled={!modifiersOpen}
                                onToggle={() => toggleModifier(modifier.id)}
                            />
                        ))}
                        {!modifiersOpen && <span className="ranch-modifier-lock">Beat a gym to unlock modifiers.</span>}
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
