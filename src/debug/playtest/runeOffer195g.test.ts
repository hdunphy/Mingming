/**
 * TICKET 195g — a Rune offer names its body, and is fitted to a body that is really on the team.
 *
 * Sonnet r30 (2026-10-05): "Patch offer is Fehu again, which Kraken already has; the screen does not say whether
 * it stacks, and shows the unit as an id (mm_0jbxbmp_1) not a name." The tool rolled the elite's Rune offer from
 * the fight's battle entities, whose ids the fight builder makes up; the game's own battle keeps the roster ids.
 * So the offer named a body that is not on the team, skipped the "one Rune a body" check against the Runes the
 * team really holds, and taking it fitted nothing. The game was never wrong; only the tool read the wrong ids.
 */
import { describe, expect, it } from 'vitest';

import { fightNodeFor } from '../../engine/run/eventFight';
import { rollEncounter } from '../../engine/run/encounter';
import { setRun } from '../../ui/store/runSlice';
import { buildFight } from './fightFlow';
import { patchName } from './gameText';
import { partyOf } from './party';
import { startRewards } from './rewards';
import { currentScreen } from './screen';
import { freshWorld } from './testKit';
import { standAt } from './walkKit';
import { applyMove } from './world';
import type { World } from './types';
import { runOf } from './types';

/** A won elite fight, rewards open: the reward flow the tool shows. */
function wonElite(seed: string, held: Record<string, string[]> = {}): World {
    const world = freshWorld({ seed, starter: 'kraken_v2' });
    // The last elite (any elite in the final biome) is the one that pays a Rune (166e).
    const elites = runOf(world).nodes.filter((n) => n.kind === 'elite');
    const last = elites.findIndex((n) => n.biomeIndex === runOf(world).biomes.length - 1);
    const elite = standAt(world, 'elite', last);
    if (Object.keys(held).length > 0) world.store.dispatch(setRun({ ...runOf(world), patches: held }));
    const encounter = rollEncounter({ run: runOf(world), node: fightNodeFor(runOf(world), elite), party: partyOf(world) });
    const opening = buildFight(world, encounter);
    startRewards(world, elite, { ...opening, enemyParty: opening.enemyParty.map((e) => ({ ...e, currentHp: 0 })) });
    return world;
}

/** Skip the card choices until the Rune offer is the decision on screen. */
function toRuneOffer(world: World): void {
    for (let guard = 0; guard < 8 && !currentScreen(world).body.some((l) => l.startsWith('RUNE OFFER')); guard += 1) {
        const skip = currentScreen(world).moves.find((m) => m.key.startsWith('card:') && m.key.endsWith(':skip'));
        if (!skip) return;
        applyMove(world, { key: skip.key, why: 'test' });
    }
}

describe('195g — the Rune offer', () => {
    it('is for bodies on the team: every offer names a party member', () => {
        const world = wonElite('rune-195g-a');
        const flow = world.view.reward!;
        expect(flow.patchOffers.length).toBeGreaterThan(0);
        for (const offer of flow.patchOffers) expect(runOf(world).partyIds, offer.memberId).toContain(offer.memberId);
    });

    it('says the body by its species name, not by an id', () => {
        const world = wonElite('rune-195g-b');
        toRuneOffer(world);
        const text = currentScreen(world).body.join('\n') + currentScreen(world).moves.map((m) => m.label).join('\n');
        expect(text).not.toMatch(/mm_\w+/);
        expect(text).toMatch(/RUNE OFFER/);
        expect(text).toContain('Fit it to ');
    });

    it('offers nothing to a body that already carries a Rune (one a body)', () => {
        const probe = wonElite('rune-195g-c');
        const [member] = runOf(probe).partyIds;
        const world = wonElite('rune-195g-c', { [member]: ['amplifier'] });
        expect(world.view.reward!.patchOffers.map((o) => o.memberId)).not.toContain(member);
    });

    it('taking the offer really fits the Rune, and the news says so only then', () => {
        const world = wonElite('rune-195g-d');
        toRuneOffer(world);
        const offer = world.view.reward!.patchOffers[0];
        const fit = currentScreen(world).moves.find((m) => m.key === `patch:take:${offer.memberId}`)!;
        applyMove(world, { key: fit.key, why: 'test' });
        // Any remaining reward decisions are skipped.
        for (let guard = 0; guard < 6 && world.view.reward; guard += 1) {
            const skip = currentScreen(world).moves.find((m) => m.key.endsWith(':skip'));
            if (!skip) break;
            applyMove(world, { key: skip.key, why: 'test' });
        }
        expect(runOf(world).patches?.[offer.memberId]).toEqual([offer.patchId]);
        expect(world.view.news.join('\n')).not.toContain('Nothing happened');
    });
});

describe('195g — the shop and gate benches', () => {
    it('list a body that already carries its Rune as such, by name, and offer it no second', () => {
        const world = freshWorld({ seed: 'rune-195g-e', starter: 'kraken_v2' });
        standAt(world, 'marketplace');
        const [member] = runOf(world).partyIds;
        world.store.dispatch(setRun({ ...runOf(world), patches: { [member]: ['amplifier'] }, scrap: 500 }));
        const screen = currentScreen(world);
        expect(screen.body.join('\n')).toContain(`Kraken: already has ${patchName('amplifier')}`);
        expect(screen.moves.some((m) => m.key.startsWith('patch:shop:'))).toBe(false);
        expect(screen.body.join('\n')).not.toMatch(/mm_\w+/);
    });
});
