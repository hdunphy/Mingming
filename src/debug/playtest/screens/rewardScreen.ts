/**
 * TICKET 180a — THE REWARD SCREEN: what the fight paid, and the one decision the claim is waiting on.
 *
 * Scrap and blueprints are shown as paid. Each card choice shows its three options with their full
 * text and offers: take one for the deck, send one to the collection, or skip. A patch offer and a
 * macro offer are shown the same way. Moves are one per option, which is why the numbers here are
 * the moves' numbers and not option numbers.
 */
import { MACRO_SLOTS } from '../../../engine/runTypes';
import { firstFreeMacroSlot } from '../../../engine/data/macroRegistry';
import { FIRST_TRACE_LINE } from '../firstTrace';
import { answerReward, nextDecision } from '../rewards';
import { cardLine, cardName, driverLine, macroLine, macroName, memberName, patchLine, speciesName } from '../gameText';
import type { Move, Screen, World } from '../types';
import { runOf } from '../types';
import { fightReportLines } from './fightReportLines';

export function rewardScreen(world: World): Screen {
    const flow = world.view.reward!;
    const run = runOf(world);
    const decision = nextDecision(flow)!;
    const body: string[] = [];

    if (world.view.fight) body.push(...fightReportLines(world.view.fight));
    if (flow.answers.length === 0) {
        const paid = [`${flow.scraps} scrap`, ...flow.blueprints.map((b) => `a ${speciesName(b)} blueprint`)];
        if (flow.driver) paid.push(`the driver ${driverLine(flow.driver)}`);
        body.push(`REWARDS: ${paid.join('; ')}.`);
        if (flow.firstTrace) body.push(FIRST_TRACE_LINE);
    }

    const moves: Move[] = [];
    if (decision.kind === 'card') {
        const choice = flow.cardChoices[decision.index];
        body.push(`CARD CHOICE ${decision.index + 1} of ${flow.cardChoices.length}, from ${choice.from}:`);
        choice.options.forEach((option, i) => body.push(`  option ${i + 1}: ${cardLine(option.dataId)}`));
        choice.options.forEach((option, i) => moves.push({
            key: `card:${decision.index}:take:${i}`,
            label: `Take option ${i + 1} (${cardName(option.dataId)}) into the deck`,
            apply: (w) => answerReward(w, { kind: 'card', picked: i, store: false }),
            about: { verb: 'take', items: [cardName(option.dataId)] },
        }));
        choice.options.forEach((option, i) => moves.push({
            key: `card:${decision.index}:store:${i}`,
            label: `Send option ${i + 1} (${cardName(option.dataId)}) to the collection`,
            apply: (w) => answerReward(w, { kind: 'card', picked: i, store: true }),
            about: { verb: 'store', items: [cardName(option.dataId)] },
        }));
        moves.push({
            key: `card:${decision.index}:skip`,
            label: 'Skip this choice',
            apply: (w) => answerReward(w, { kind: 'card', picked: null, store: false }),
            about: { verb: 'skip', items: choice.options.map((option) => cardName(option.dataId)) },
        });
    } else if (decision.kind === 'patch') {
        const roster = world.store.getState().game.roster;
        body.push('PATCH OFFER (take one for a team member, or none):');
        for (const offer of flow.patchOffers) {
            const member = roster.find((m) => m.id === offer.memberId);
            body.push(`  ${member ? memberName(member) : offer.memberId}: ${patchLine(member?.activeOS, offer.patchId)}`);
            moves.push({
                key: `patch:take:${offer.memberId}`,
                label: `Fit it to ${member ? memberName(member) : offer.memberId}`,
                apply: (w) => answerReward(w, { kind: 'patch', memberId: offer.memberId }),
            });
        }
        moves.push({ key: 'patch:skip', label: 'Take no patch', apply: (w) => answerReward(w, { kind: 'patch', memberId: null }) });
    } else {
        const rackFull = firstFreeMacroSlot(run.macros) === -1;
        body.push(`MACRO OFFER (take one, or none)${rackFull ? '; the rack is full, so taking one replaces a slot' : ''}:`);
        for (const macroId of flow.macroOffers) body.push(`  ${macroLine(macroId)}`);
        for (const macroId of flow.macroOffers) {
            if (!rackFull) {
                moves.push({
                    key: `macro:take:${macroId}`,
                    label: `Take ${macroName(macroId)}`,
                    apply: (w) => answerReward(w, { kind: 'macro', macroId }),
                });
                continue;
            }
            for (let slot = 0; slot < MACRO_SLOTS; slot += 1) {
                moves.push({
                    key: `macro:take:${macroId}:${slot}`,
                    label: `Take ${macroName(macroId)} in place of ${macroName(run.macros[slot])} (slot ${slot + 1})`,
                    apply: (w) => answerReward(w, { kind: 'macro', macroId, replaceSlot: slot }),
                });
            }
        }
        moves.push({ key: 'macro:skip', label: 'Take no macro', apply: (w) => answerReward(w, { kind: 'macro', macroId: null }) });
    }

    return { id: 'reward', body, moves };
}
