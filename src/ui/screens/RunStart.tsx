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
import { partyBlockFor } from '../../engine/party';
import { toMingmingState } from '../../engine/run/battleSetup';
import { createRun } from '../../engine/run/createRun';
import { withOpeningFight } from '../../engine/run/openingFight';
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
import DraftStart from './DraftStart';
import { RUN_START_PARTY_TEXT } from './partyRuleText';
import { useAdvancedContent } from '../settings/useAdvancedContent';
import { plain } from '../labels/labels';

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

/**
 * TICKET 182a — everything a gym card used to print under its route, as one hover.
 *
 * The leader's signature passive (ticket 68 ruling 4, the telegraph), the tier line (169e) and the
 * pair the rivals field (142c). It is the same information; the card face is now a name, an element
 * and three biome names.
 */
function offerHover(offer: IGymOffer, tier: number): string {
    const lines = gymSignatures(offer.gym.id, offer.biomes).map((s) => plain(`${s.name}: ${s.description}`));
    const tierLine = leaderDriverTierLine(tier);
    if (tierLine) lines.push(tierLine);
    lines.push(`Rivals field: ${pathElementsFor(offer.gym.element).join(' / ')}`);
    return plain(lines.join('\n'));
}

export default function RunStart(): ReactNode {
    const dispatch = useDispatch();
    const roster = useSelector((s: RootState) => s.game.roster);
    const offers = useOfferScreen();
    const [chosen, setChosen] = useState<IGymOffer | null>(null);
    const [partyIds, setPartyIds] = useState<string[]>([]);
    const ranch = useSelector((s: RootState) => s.game);
    // TICKET 182b: each rule below is `empty && !advanced`.
    const advanced = useAdvancedContent();

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

    // TICKET 182b: with ONE Mingming on the roster there is nothing to pick - it is the party.
    const soloRoster = roster.length === 1 && !advanced;
    const effectivePartyIds = useMemo(
        () => (soloRoster ? roster.map((m) => m.id) : partyIds),
        [soloRoster, roster, partyIds],
    );
    // TICKET 182b: nothing above tier 0 is unlocked (and so no modifiers either) until a gym is cleared.
    const showTiers = advanced || unlocked.length > 1 || modifiersOpen;

    const party = useMemo(
        () => effectivePartyIds.map((id) => roster.find((m) => m.id === id)).filter((m): m is IRanchMember => !!m),
        [effectivePartyIds, roster],
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

    /**
     * TICKET 169i: with Draft Start on, Launch opens the draft instead of starting the run. The seed
     * is rolled ONCE, here, and held, so the draft's offers and the run that follows share it. It is
     * component state and nothing else: Back (or closing the app) throws the draft away.
     */
    const [draftSeed, setDraftSeed] = useState<string | null>(null);
    // Ticket 169f: only what is switched on, and only once modifiers are unlocked.
    const activeModifierIds = modifiersOpen ? MODIFIERS.map((m) => m.id).filter((id) => pickedModifiers.includes(id)) : [];

    const launch = (): void => {
        if (!chosen || party.length === 0) return;
        if (activeModifierIds.includes('draft_start')) {
            setDraftSeed(rollSeed());
            playSfx('uiClick');
            return;
        }
        startWith(rollSeed());
    };

    const startWith = (seed: string, startKitOverrides?: Record<string, string[]>): void => {
        if (!chosen) return;
        // The run seed is rolled at launch and threaded through everything downstream — the graph, the
        // card instance ids, and (later) encounter contents. One roll, so a run replays from one
        // string. `startedAt` is injected for the same reason the engine never calls `Date.now()`:
        // a module that reads the clock cannot be tested deterministically.
        // Henry, 2026-10-03: the run opens on its first fight (`withOpeningFight`).
        dispatch(startRun(withOpeningFight(createRun({
            seed,
            offer: chosen,
            // Ticket 169e: the tier picked above. It is fixed for the whole run.
            tier: selectedTier,
            modifiers: activeModifierIds,
            // Ticket 169i: the drafted kits, when Draft Start is on.
            startKitOverrides,
            // Ticket 11: the roster holds `IRanchMember`s. `toMingmingState` adds the one field
            // combat's shape still demands — `blueprintsCollected`, which is vestigial; see its
            // doc comment.
            party: party.map(toMingmingState),
            startedAt: Date.now(),
        }))));
        playSfx('breach');
    };

    if (chosen && draftSeed !== null) {
        return (
            <DraftStart
                seed={draftSeed}
                party={party.map(toMingmingState)}
                onDone={(kits) => startWith(draftSeed, kits)}
                onBack={() => setDraftSeed(null)}
            />
        );
    }

    if (roster.length === 0) {
        return (
            <section className="ranch-section">
                <h2>No mingmings</h2>
                <p className="ranch-note">
                    A run needs at least one summoned mingming. Spend a trace in <strong>Summon</strong>.
                </p>
            </section>
        );
    }

    return (
        <section className="ranch-section">
            <div className="ranch-section-head">
                <h2>{chosen ? 'Choose your party' : 'Choose a gym'}</h2>
                {chosen && (
                    <button type="button" className="ranch-button k-button is-quiet subtle" onClick={() => { setChosen(null); playSfx('uiClick'); }}>
                        ‹ Back to offers
                    </button>
                )}
            </div>

            {!chosen && (
                <>
                    {/* TICKET 182a: one line. The two paragraphs on routes and rivals are gone (the
                        rivals' elements are on each gym's hover, and the map's rival node explains
                        itself, 142c). */}
                    <p className="ranch-note">Beat the gym leader at the end of the road.</p>
                    {/* Ticket 169e: the tier row. A locked tier is disabled and says how to open it.
                        TICKET 182b: not drawn until a tier above 0 is unlocked. */}
                    {showTiers && (
                    <div className="ranch-tier-picker" role="group" aria-label="Difficulty tier">
                        <div className="ranch-tier-row">
                            {TIERS.map((row) => {
                                const open = unlocked.includes(row.tier);
                                return (
                                    <div key={row.tier} className="ranch-tier-slot">
                                        <button
                                            type="button"
                                            className={`ranch-button k-button ${selectedTier === row.tier ? '' : 'is-quiet subtle'}`}
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
                        {/* TICKET 182a: Tier 0 is "Standard — The game as it is." and says nothing. */}
                        {selectedTier > 0 && (
                            <div className="ranch-tier-blurb">
                                <strong>{plain(tierRule(selectedTier).name)}</strong>
                                <span>{plain(tierRule(selectedTier).description)}</span>
                            </div>
                        )}
                    </div>
                    )}
                    <div className="ranch-offer-grid">
                        {offers.map((offer) => (
                            <button
                                key={offer.gym.id}
                                type="button"
                                className="ranch-offer k-plate"
                                title={offerHover(offer, selectedTier)}
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
                                        </li>
                                    ))}
                                </ol>
                                {/*
                                  * TICKET 182a — the telegraph and the rivals' pair moved to the hover
                                  * (`offerHover`). They were on the card face for tickets 68 (ruling 4)
                                  * and 142c; the facts are the same, one hover away, so the card shows
                                  * a name, an element and three biomes.
                                  */}
                            </button>
                        ))}
                    </div>
                </>
            )}

            {chosen && (
                <>
                    {/* TICKET 182b/a: one sentence; the party rule is its hover (and absent for a one-member roster). */}
                    <p className="ranch-note" title={soloRoster ? undefined : RUN_START_PARTY_TEXT}>
                        Opening biome: <strong>{chosen.biomes[0].name} ({chosen.biomes[0].elements.join(' / ')})</strong>.
                    </p>
                    {!soloRoster && (
                    <div className="ranch-roster-grid">
                        {roster.map((member) => {
                            const picked = partyIds.includes(member.id);
                            const block = picked ? null : partyBlockFor(member, party);
                            return (
                                <button
                                    key={member.id}
                                    type="button"
                                    className={`ranch-card k-plate ${picked ? 'active is-on' : ''} ${block ? 'blocked' : ''}`}
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
                                    {block === 'duplicate-build' && <div className="ranch-card-block">Already fielding this instinct</div>}
                                    {block === 'party-full' && <div className="ranch-card-block">Party is full</div>}
                                </button>
                            );
                        })}
                    </div>
                    )}

                    {/* Ticket 169f: opt-in run modifiers. They earn nothing but a label.
                        TICKET 182b: not drawn until the first gym clear. */}
                    {(advanced || modifiersOpen) && (
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
                    )}

                    <div className="ranch-modal-actions">
                        <button
                            type="button"
                            className="ranch-button k-button"
                            disabled={party.length === 0}
                            onClick={launch}
                        >
                            {party.length === 0
                                ? 'Pick at least one member'
                                : 'Start run'}
                        </button>
                    </div>
                </>
            )}
        </section>
    );
}
