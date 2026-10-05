/**
 * TICKET 195e-1 — the playtest tool says the new words everywhere a player's screen does.
 *
 * Ticket 193 renamed names and the combat log only, so the agent still read "scrap 45", "workshop", "macro" and
 * "blueprint" in the tool's own lines and in the event text, and a night's notes said it never saw "amber" as a
 * currency. This test renders every screen a session can reach, and every event in `events.json` with every
 * choice taken, and fails on any old word. Ids, saves and the walker's output keep their old names; the move
 * KEYS (`workshop:assemble:...`) are ids and are not read.
 */
import { describe, expect, it } from 'vitest';

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { MODIFIER_IDS } from '../../engine/run/modifiers/modifierRegistry';
import { EVENTS } from '../../engine/run/events/eventCatalogue';
import { playableChoices } from '../../engine/run/events/eventChoices';
import { OLD_WORDS } from '../../ui/labels/labels';
import { chooseChoice } from './event/flow';
import { visitKeyOf } from './event/arrival';
import { renderScreen, screenJson } from './render';
import { currentScreen } from './screen';
import { eaStarters } from '../balance/runWalker';
import { freshWorld } from './testKit';
import { giveBlueprint, routineMove, setScrap, standAt, worldAt } from './walkKit';
import { hereNode } from './stalls';
import { applyMove } from './world';
import type { World } from './types';
import { runOf } from './types';

/** The old words a rendered screen still prints, each with its line. */
export function oldWordsInText(text: string): string[] {
    const found: string[] = [];
    for (const line of text.split('\n')) {
        OLD_WORDS.lastIndex = 0;
        const hits = line.match(OLD_WORDS);
        if (hits) found.push(`${[...new Set(hits.map((h) => h.toLowerCase()))].join(',')}: ${line.slice(0, 140)}`);
    }
    return [...new Set(found)];
}

/** What the agent is shown for one screen: the text, and the JSON form's labels and body. */
function shown(world: World): string {
    const screen = currentScreen(world);
    const json = screenJson(world, screen) as { status: string; body: string[]; news: string[]; moves: Array<{ label: string }> };
    return [renderScreen(world, screen), json.status, ...json.news, ...json.body, ...json.moves.map((m) => m.label)].join('\n');
}

function playRun(starter: string, seed: string, maxMoves: number, into: string[], ids: Set<string>, mode: 'run' | 'turn' = 'run', modifiers: string[] = []): void {
    const world = freshWorld({ seed, starter, mode, modifiers });
    into.push(shown(world));
    ids.add(currentScreen(world).id);
    for (let i = 0; i < maxMoves; i += 1) {
        const run = runOf(world);
        if (run.phase === 'ended') break;
        const screen = currentScreen(world);
        if (screen.moves.length === 0) break;
        const key = routineMove(screen, new Set(), world);
        applyMove(world, { key, why: 'sweep' });
        into.push(shown(world));
        ids.add(currentScreen(world).id);
    }
}

describe('195e — the tool prints no old word', () => {
    it('on the screens of whole runs: map, town, shop, den, rewards, battle, event, end', () => {
        const texts: string[] = [];
        const ids = new Set<string>();
        const starters = eaStarters();
        playRun(starters[0], 'sweep-a', 500, texts, ids);
        playRun(starters[4], 'sweep-b', 500, texts, ids);
        playRun(starters[8], 'sweep-c', 500, texts, ids);
        // Turn mode plays the fights, so the battle screen and its hand lines are read too.
        playRun(starters[2], 'sweep-d', 400, texts, ids, 'turn');
        // The sweep is only worth its name if the runs got to these screens.
        for (const id of ['map', 'reward', 'battle', 'town', 'market', 'workshop', 'event', 'end']) expect(ids, id).toContain(id);
        const found = new Set<string>();
        for (const t of texts) for (const f of oldWordsInText(t)) found.add(f);
        expect([...found]).toEqual([]);
    }, 300_000);

    it('on every stall, standing at it with some Traces and Amber', () => {
        const found = new Set<string>();
        const read: string[] = [];
        for (const kind of ['marketplace', 'workshop', 'town'] as const) {
            const world = freshWorld({ seed: 'sweep-stalls', starter: eaStarters()[1] });
            const mine = world.store.getState().game.roster.map((m) => m.definitionId);
            for (const id of Object.keys(MingmingRegistry).filter((s) => !mine.includes(s)).slice(0, 3)) giveBlueprint(world, id);
            setScrap(world, 400);
            standAt(world, kind);
            read.push(shown(world));
            // And the Den's other half, when the stall has one.
            if (kind === 'town') {
                for (const door of ['town:shop', 'town:workshop']) {
                    const screen = currentScreen(world);
                    if (screen.moves.some((m) => m.key === door)) { applyMove(world, { key: door, why: 'sweep' }); read.push(shown(world)); }
                }
            }
        }
        for (const text of read) for (const f of oldWordsInText(text)) found.add(f);
        const all = read.join('\n');
        for (const marker of ['TRACES (a summon costs', 'RETRAIN (', 'Amber:', 'TRACE (one body', 'DRAUGHTS (single use']) expect(all, marker).toContain(marker);
        expect([...found]).toEqual([]);
    });

    it('under every modifier the tool can play: the forecast and the opening screens', () => {
        const texts: string[] = [];
        const played = MODIFIER_IDS.filter((id) => id !== 'draft_start');
        for (const id of played) playRun(eaStarters()[3], `sweep-mod-${id}`, 25, texts, new Set<string>(), 'run', [id]);
        expect(played.length).toBeGreaterThan(2);
        expect([...new Set(texts.flatMap(oldWordsInText))]).toEqual([]);
    }, 300_000);

    it('on the gym gate and the loadout editor', () => {
        const world = worldAt('gym');
        const read = [shown(world)];
        applyMove(world, { key: 'loadout:open', why: 'sweep' });
        read.push(shown(world));
        const found = read.flatMap(oldWordsInText);
        expect(read.join('\n')).toContain('DRAUGHTS:');
        expect(found).toEqual([]);
    });

    it('on every event in events.json: its text, each choice, and what taking it says', () => {
        const found = new Set<string>();
        let seen = 0;
        for (const event of EVENTS) {
            for (const choice of playableChoices(event)) {
                const world = freshWorld({ seed: `sweep-event-${event.id}`, starter: eaStarters()[2] });
                standAt(world, 'event');
                const node = hereNode(world);
                world.view.event = { visitKey: visitKeyOf(node), event, choiceId: null, outcomeIndex: 0, picks: {}, selected: [], upgrading: false };
                const texts: string[] = [shown(world)];
                chooseChoice(world, node, world.view.event, choice);
                for (let guard = 0; guard < 10; guard += 1) {
                    const screen = currentScreen(world);
                    texts.push(shown(world));
                    if (screen.id !== 'event' || screen.moves.length === 0) break;
                    applyMove(world, { key: routineMove(screen, new Set(), world), why: 'sweep' });
                }
                texts.push(shown(world));
                for (const t of texts) for (const f of oldWordsInText(t)) found.add(`${event.id}/${choice.id} ${f}`);
                seen += 1;
            }
        }
        expect(seen).toBeGreaterThan(30);
        expect([...found]).toEqual([]);
    }, 300_000);
});
