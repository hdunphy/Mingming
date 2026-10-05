/**
 * TICKET 193c — in a real session, a firmware's extra effect is filed as "explained", not "surprise".
 *
 * The same Whirlpool play on Kraken, with the agent expecting what the card text says (2 Dazed): the game
 * gave the foe 4, because ABYSSAL_INK_SYS fired on the draw. Before 193c that read as a wording bug in
 * every night's report. Now it is an `explained` finding that names the firmware, and the agent is told
 * so. A wrong prediction nothing explains is still a surprise.
 */
import { describe, it, expect } from 'vitest';
import { currentScreen } from './screen';
import { freshWorld } from './testKit';
import { applyMove } from './world';
import type { World } from './types';

/** Kraken's opening hand on this seed holds a Whirlpool (the test says so if the seed ever stops doing that). */
function krakenWithWhirlpool(): World {
    const world = freshWorld({ mode: 'turn', seed: 'ps1', starter: 'kraken_v1' });
    applyMove(world, { key: currentScreen(world).moves[0].key, why: 'into the fight' });
    expect(world.view.battle!.state.playerDeck.hand.some((c) => c.dataId === 'whirlpool')).toBe(true);
    return world;
}

const keyFor = (world: World): string => {
    const hand = world.view.battle!.state.playerDeck.hand;
    const move = currentScreen(world).moves.find((m) => {
        const card = hand.find((c) => m.key.startsWith(`battle:play:${c.id}:`));
        return card?.dataId === 'whirlpool';
    });
    if (!move) throw new Error('no Whirlpool play is offered');
    return move.key;
};

const ofKind = (world: World, kind: string) => world.findings.filter((f) => f.kind === kind);

describe('193c — expecting what a firmware-affected card\'s text says', () => {
    it('is explained, names the firmware, and is not a surprise', () => {
        const world = krakenWithWhirlpool();
        const foe = world.view.battle!.state.enemyParty[0].name;
        applyMove(world, { key: keyFor(world), why: 'test', expect: { status: { [foe]: { Dazed: 2 } } } });
        expect(ofKind(world, 'surprise')).toHaveLength(0);
        const [explained] = ofKind(world, 'explained');
        expect(explained).toBeDefined();
        if (explained.kind === 'explained') expect(explained.by).toContain('ABYSSAL_INK_SYS');
        expect(world.view.news.join('\n')).not.toMatch(/SURPRISE/);
        expect(world.view.news.join('\n')).toMatch(/ABYSSAL_INK_SYS/);
    });

    it('a prediction nothing explains is still a surprise', () => {
        const world = krakenWithWhirlpool();
        applyMove(world, { key: keyFor(world), why: 'test', expect: { hits: 9 } });
        expect(ofKind(world, 'surprise')).toHaveLength(1);
        expect(ofKind(world, 'explained')).toHaveLength(0);
    });
});
