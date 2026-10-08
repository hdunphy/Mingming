/**
 * TICKET 180a — A SCREEN AS COMPACT TEXT, NOT JSON.
 *
 * Every screen starts with one status line (biome, scrap, party with HP, deck size, macros, tier),
 * then what the last move did, then what the screen offers, then the numbered moves. Card text is
 * printed exactly as the game builds it, and the target is under about 1,000 tokens a screen
 * (`render.test.ts` measures it as characters divided by four).
 */
import { GYM_REGISTRY } from '../../engine/run/gyms';
import { tracesHeld } from '../../engine/run/workshop';
import { countedDeckSize } from '../../engine/run/junk';
import { forecastFor } from './forecastBlock';
import { hpNote } from './hpNote';
import { runLabel } from './runLabel';
import { currentScreen } from './screen';
import { firmwareName, macroName, memberName } from './gameText';
import type { Screen, World } from './types';
import { runOf } from './types';

export function statusLine(world: World): string {
    const run = runOf(world);
    const { roster } = world.store.getState().game;
    const node = run.nodes.find((n) => n.id === run.currentNodeId);
    const biome = run.biomes[node?.biomeIndex ?? 0];
    const gym = GYM_REGISTRY[run.gymId];

    const party = run.partyIds.map((id) => {
        const member = roster.find((m) => m.id === id);
        if (!member) return id;
        const carried = run.gauntlet?.persistedHp?.[id];
        return `${memberName(member)} [${firmwareName(member.activeOS)}] HP ${carried === undefined ? 'full' : carried}`;
    });
    const label = runLabel(world);
    const stored = run.collection?.length ?? 0;
    const benched = run.bench?.length ?? 0;
    return [
        `${biome ? `${biome.name} (${biome.elements.join(' + ')})` : 'no biome'}`,
        `gym: ${gym?.name ?? run.gymId}`,
        `amber ${run.scrap}`,
        `traces ${tracesHeld(world.store.getState().game, run)}`,
        `party: ${party.join('; ')}${benched > 0 ? `; ${benched} on the bench` : ''}${party.some((p) => p.endsWith('HP full')) && hpNote(run) ? ` ${hpNote(run)}` : ''}`,
        `deck ${countedDeckSize(run.deck)}${stored > 0 ? ` (+${stored} in the collection)` : ''}`,
        `draughts: ${run.macros.map((m) => macroName(m)).join(', ')}`,
        `tier ${run.tier}`,
        ...(label === null ? [] : [label]),
    ].join(' | ');
}

export function renderScreen(world: World, screen: Screen = currentScreen(world)): string {
    const lines: string[] = [`[${statusLine(world)}]`];
    // 193j: the run forecast, on the first screen of a session only.
    const forecast = forecastFor(world);
    if (forecast) lines.push(forecast);
    if (world.view.news.length > 0) lines.push(...world.view.news);
    lines.push(...screen.body);
    if (screen.moves.length > 0) {
        lines.push('Moves:');
        screen.moves.forEach((move, i) => lines.push(`${i + 1}. ${move.label}`));
    } else {
        lines.push('(no moves: the run is over)');
    }
    return lines.join('\n');
}

export function screenJson(world: World, screen: Screen = currentScreen(world)): unknown {
    return {
        screen: screen.id,
        status: statusLine(world),
        news: world.view.news,
        body: screen.body,
        moves: screen.moves.map((move, i) => ({ n: i + 1, key: move.key, label: move.label })),
    };
}

/** A rough token count: characters divided by four. Good enough to keep screens small. */
export const roughTokens = (text: string): number => Math.ceil(text.length / 4);
