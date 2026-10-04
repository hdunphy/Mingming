/**
 * The playtester says the game's words, not the registry's.
 *
 * Tickets 183h and 192 renamed things on the screens (Instinct, Aura, Den, the Norse names) with the
 * UI's own `plain()`. The tool printed registry text raw, so an agent read `Kraken [ABYSSAL_INK_SYS]`
 * and a card text that said "daemon" while a player reads "Abyssal Ink" and "Aura". Every name and
 * rule text the tool prints from the game's data now goes through the same `plain()`, in `gameText.ts`
 * (the one seam) and on the combat-log lines it relays.
 */
import { describe, expect, it } from 'vitest';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { GetProgramData } from '../../engine/data/programRegistry';
import { plain } from '../../ui/labels/labels';
import { cardLine, cardName, firmwareName, firmwareText, macroLine, patchLine } from './gameText';
import { logLines } from './battle/news';
import { createSparseBattleState } from '../scenarios/scenarioTestSupport';

describe('the tool reads the game\'s words', () => {
    it('a firmware is named as the player reads it, not by its registry id', () => {
        const raw = getOSBehavior('kraken_v1')!.name;
        expect(raw).toMatch(/_SYS$/);
        expect(firmwareName('kraken_v1')).toBe(plain(raw));
        expect(firmwareName('kraken_v1')).not.toMatch(/_SYS/);
        expect(firmwareText('kraken_v1')).toBe(plain(getOSBehavior('kraken_v1')!.description));
    });

    it('a card is named and described as its face prints it', () => {
        const data = GetProgramData('feedback_loop_daemon');
        expect(cardName('feedback_loop_daemon')).toBe(plain(data.name));
        expect(cardLine('feedback_loop_daemon')).toBe(plain(`${data.name} (${data.baseCost}e, ${data.element ?? 'None'}): ${data.description ?? ''}`.trimEnd()));
        expect(cardLine('feedback_loop_daemon')).not.toMatch(/daemon/i);
    });

    it('macros and patches go through it too', () => {
        expect(macroLine('nope')).toBe('nope');
        expect(patchLine('kraken_v1', 'nope')).toBe(plain(patchLine('kraken_v1', 'nope')));
    });

    it('the combat-log lines it relays are the lines the log panel shows', () => {
        const before = createSparseBattleState({ logs: [] });
        const after = createSparseBattleState({ logs: ['  → Kraken resisted Dazed (StableOS Active)'] });
        const [, line] = logLines(before, after);
        expect(line.trim()).toBe(plain('→ Kraken resisted Dazed (StableOS Active)'));
    });
});
