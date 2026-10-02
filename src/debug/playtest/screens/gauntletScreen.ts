/**
 * TICKET 180c — THE GYM GATE AND THE GAUNTLET BETWEEN FIGHTS.
 *
 * `GauntletNode`: the leader's name, which fight of how many, each member's HP as carried (with the
 * repair between fights, 173), who is down, the macro rack, and what is coming (types known and
 * names hidden; the boss fight's own team has signature firmware). Before the FIRST fight only, the
 * gate offers its free patch (a choice of two), one free upgrade, and the last chance to edit the
 * loadout. "Begin" needs someone standing. Run mode plays the fight with the game's AI.
 */
import { GetMingmingData } from '../../../engine/data/mingmingRegistry';
import { toMingmingState } from '../../../engine/run/battleSetup';
import { withEffectiveOS } from '../../../engine/run/effectiveOS';
import { GAUNTLET_ENEMY_COUNT, gauntletOpponentElements, isBossFight } from '../../../engine/run/gauntlet';
import { GAUNTLET_HEAL_PERCENT } from '../../../engine/run/gauntletHeal';
import { GYM_REGISTRY } from '../../../engine/run/gyms';
import { initializeBattleEntity } from '../../../engine/types';
import { playGauntletFight } from '../gauntletFlow';
import { macroLine } from '../gameText';
import { memberName } from '../gameText';
import { hereNode } from '../stalls';
import type { Move, Screen, World } from '../types';
import { runOf } from '../types';
import { openLoadout } from './loadoutScreen';
import { patchSection } from './patchBench';
import { upgradeSection } from './upgradeBench';

export function gauntletScreen(world: World): Screen {
    const run = runOf(world);
    const node = hereNode(world);
    const gauntlet = run.gauntlet!;
    const roster = world.store.getState().game.roster;
    const first = gauntlet.fightIndex === 0;
    const boss = isBossFight(gauntlet.fightIndex, gauntlet.totalFights);

    const lines = [`${GYM_REGISTRY[run.gymId]?.name ?? run.gymId} gauntlet, fight ${gauntlet.fightIndex + 1} of ${gauntlet.totalFights}. Between fights every member still standing repairs ${GAUNTLET_HEAL_PERCENT}% of its max HP; the rest of the damage carries.`];
    lines.push('PARTY:');
    let standing = 0;
    for (const id of run.partyIds) {
        const member = roster.find((m) => m.id === id);
        if (!member) continue;
        const entity = initializeBattleEntity(toMingmingState(withEffectiveOS(run, member)), GetMingmingData(member.definitionId));
        const hp = gauntlet.persistedHp[id] ?? entity.maxHp;
        const down = gauntlet.downedMemberIds.includes(id);
        if (!down) standing += 1;
        const healed = gauntlet.healedHp?.[id] ?? 0;
        lines.push(`  ${memberName(member)} ${hp}/${entity.maxHp}${down ? ' (down)' : ''}${!down && healed > 0 ? ` (+${healed} repaired)` : ''}`);
    }
    lines.push(`MACROS: ${run.macros.map((id) => (id === null ? 'empty' : macroLine(id))).join(' | ')}`);
    const elements = gauntletOpponentElements({ run, node, fightIndex: gauntlet.fightIndex });
    lines.push(`${boss ? 'THE LEADER\'S OWN TEAM (signature firmware)' : 'NEXT OPPONENT (type known, names hidden)'}: ${GAUNTLET_ENEMY_COUNT} of them: ${elements.join(', ')}`);

    const moves: Move[] = [];
    if (first) {
        const patch = patchSection(world, { venue: 'gate', benchKey: `patch:${node.id}:${node.visited}` });
        const upgrade = upgradeSection(world, { benchKey: `${node.id}:${node.visited}`, allowance: 1, free: true, keyPrefix: 'gate' });
        lines.push(...patch.lines, ...upgrade.lines);
        moves.push(...patch.moves, ...upgrade.moves, openLoadout);
    }
    if (standing > 0) {
        moves.push({ key: 'gauntlet:begin', label: `Begin fight ${gauntlet.fightIndex + 1} of ${gauntlet.totalFights}`, apply: playGauntletFight });
    } else {
        lines.push('Every member is down: nothing left to send in.');
    }
    return { id: 'gauntlet', body: lines, moves };
}
