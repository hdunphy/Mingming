/**
 * TICKET 180a — A WON FIGHT'S PAY, ROLLED AND CLAIMED THE WAY THE ARENA DOES IT.
 *
 * `BattleArena` rolls `rollDropTable` once the player has won, banks the blueprints straight away
 * (so a reload on the reward screen cannot lose one), and claims the rest when the player presses
 * Continue: scrap, then the patch, then the macro, then the picked cards, then the Driver, then
 * `resolveEncounter` (or, in the gauntlet, `advanceGauntlet` / `finishGauntlet`). This is that
 * sequence over the playtester's moves.
 *
 * The decisions the player is asked are, in order: one per card choice (take it for the deck, send
 * it to the collection, or skip), then the patch (take one or none), then the macro (take one or
 * none, and say which slot to replace when the rack is full). A fight that offers none of them is
 * claimed at once.
 */
import {
    addBlueprint, markGymCleared, recordGymTierClear, recordTierCleared,
} from '../../ui/store/gameSlice';
import {
    addDriver, addRunCards, addRunCollection, addRunScrap, advanceGauntlet, endRun, finishGauntlet, fitPatch,
    recordBankedBlueprint, recordCardOffer, recordFightBlueprintOutcome, resolveEncounter, takeRewardMacro,
} from '../../ui/store/runSlice';
import { gymClearBlueprints, rollDropTable } from '../../engine/RewardSystem';
import { ownedCardIdsOf } from '../../engine/rewards/ownedCards';
import { authoredBossFor } from '../../engine/run/bosses';
import { fightBonusFor } from '../../engine/run/fightBonus';
import { eventFightScrapMultiplier, fightKindOf } from '../../engine/run/eventFight';
import { paysDriver, partyElementsOf, resolveDriverStake } from '../../engine/run/driverStakes';
import { MACRO_SLOTS, type IRegionNode, type IRunCard } from '../../engine/runTypes';
import type { IBattleState } from '../../engine/types';
import { cardName, macroName, memberName, patchName, speciesName } from './gameText';
import type { RewardAnswer, RewardFlow, World } from './types';
import { runOf } from './types';

/** How many decisions a flow asks in all. */
export const decisionCount = (flow: RewardFlow): number =>
    flow.cardChoices.length + (flow.patchOffers.length > 0 ? 1 : 0) + (flow.macroOffers.length > 0 ? 1 : 0);

export type Decision =
    | { readonly kind: 'card'; readonly index: number }
    | { readonly kind: 'patch' }
    | { readonly kind: 'macro' };

/** The decision the player is on, or null when every one is answered. */
export function nextDecision(flow: RewardFlow): Decision | null {
    const n = flow.answers.length;
    if (n < flow.cardChoices.length) return { kind: 'card', index: n };
    let at = flow.cardChoices.length;
    if (flow.patchOffers.length > 0) {
        if (n === at) return { kind: 'patch' };
        at += 1;
    }
    if (flow.macroOffers.length > 0 && n === at) return { kind: 'macro' };
    return null;
}

/** Roll what a win pays, bank its blueprints, and open the claim. Called once, right after the win. */
export function startRewards(world: World, node: IRegionNode, battle: IBattleState, carried?: RewardFlow['carried']): void {
    const run = runOf(world);
    const ranch = world.store.getState().game;
    const nodeKind = fightKindOf(run, node);
    const scrapMultiplier = eventFightScrapMultiplier(run, node);
    const driverStake = paysDriver(nodeKind) && node.driverStake
        ? resolveDriverStake(node.driverStake, partyElementsOf(battle.playerParty))
        : undefined;
    const bonus = fightBonusFor({
        nodeKind, biomeIndex: node.biomeIndex, biomeCount: run.biomes.length, gauntlet: run.gauntlet,
    });
    const rolled = rollDropTable({
        defeated: battle.enemyParty,
        nodeKind,
        party: battle.playerParty,
        seed: battle.seed,
        dryFights: run.blueprintDryFights ?? 0,
        firstRun: (ranch.runsCompleted ?? 0) === 0,
        ...(bonus === undefined ? {} : { bonus }),
        heldPatches: run.patches ?? {},
        ownedCardIds: ownedCardIdsOf(run),
        recentOffers: run.recentOffers ?? [],
    });

    world.store.dispatch(recordFightBlueprintOutcome({ dropped: rolled.blueprints.length > 0 }));
    for (const species of rolled.blueprints) {
        world.store.dispatch(addBlueprint(species));
        world.store.dispatch(recordBankedBlueprint(species));
    }

    const flow: RewardFlow = {
        nodeId: node.id,
        ...(carried === undefined ? {} : { carried }),
        scraps: rolled.scraps * scrapMultiplier,
        blueprints: [...rolled.blueprints],
        driver: driverStake ?? rolled.driver ?? null,
        cardChoices: rolled.cardChoices.map((choice) => ({
            from: choice.sourceEntityName,
            options: choice.options.map((o) => ({ instanceId: o.instanceId, dataId: o.dataId })),
        })),
        patchOffers: (rolled.patchChoices ?? []).map((p) => ({ memberId: p.memberId, patchId: p.patchId })),
        macroOffers: [...(rolled.macroChoices ?? [])],
        answers: [],
    };
    world.view.reward = flow;
    if (decisionCount(flow) === 0) claimRewards(world);
}

/** Record one answer; when the last is in, claim everything. */
export function answerReward(world: World, answer: RewardAnswer): void {
    const flow = world.view.reward;
    if (!flow) return;
    const next: RewardFlow = { ...flow, answers: [...flow.answers, answer] };
    world.view.reward = next;
    if (nextDecision(next) === null) claimRewards(world);
}

/** The arena's `handleContinue`. */
export function claimRewards(world: World): void {
    const flow = world.view.reward;
    if (!flow) return;
    const { store } = world;
    const news = world.view.news;

    if (flow.scraps > 0) {
        store.dispatch(addRunScrap(flow.scraps));
        news.push(`Claimed ${flow.scraps} scrap.`);
    }
    for (const species of flow.blueprints) news.push(`Banked a blueprint: ${speciesName(species)}.`);

    const cardAnswers = flow.answers.filter((a): a is Extract<RewardAnswer, { kind: 'card' }> => a.kind === 'card');
    const forDeck: IRunCard[] = [];
    const forCollection: IRunCard[] = [];
    flow.cardChoices.forEach((choice, index) => {
        // Ticket 185e: shown cards, taken or skipped, are left out of the next two offers.
        store.dispatch(recordCardOffer(choice.options.map((o) => o.dataId)));
        const answer = cardAnswers[index];
        if (!answer || answer.picked === null) { news.push('Skipped a card choice.'); return; }
        const option = choice.options[answer.picked];
        const card: IRunCard = { instanceId: option.instanceId, dataId: option.dataId, ownerId: null };
        (answer.store ? forCollection : forDeck).push(card);
        news.push(`${answer.store ? 'Sent to the collection' : 'Added to the deck'}: ${cardName(option.dataId)}.`);
    });

    const patch = flow.answers.find((a): a is Extract<RewardAnswer, { kind: 'patch' }> => a.kind === 'patch');
    if (patch?.memberId) {
        const offer = flow.patchOffers.find((o) => o.memberId === patch.memberId);
        if (offer) {
            store.dispatch(fitPatch({ memberId: offer.memberId, patchId: offer.patchId }));
            const member = store.getState().game.roster.find((m) => m.id === offer.memberId);
            news.push(`Fitted ${patchName(offer.patchId)} to ${member ? memberName(member) : offer.memberId}.`);
        }
    }
    const macro = flow.answers.find((a): a is Extract<RewardAnswer, { kind: 'macro' }> => a.kind === 'macro');
    if (macro?.macroId) {
        store.dispatch(takeRewardMacro({
            macroId: macro.macroId,
            ...(macro.replaceSlot === undefined ? {} : { replaceSlot: macro.replaceSlot }),
        }));
        news.push(`Took the macro ${macroName(macro.macroId)}.`);
    }
    if (forDeck.length > 0) store.dispatch(addRunCards(forDeck));
    if (forCollection.length > 0) store.dispatch(addRunCollection(forCollection));
    if (flow.driver) store.dispatch(addDriver(flow.driver));

    settleEncounter(world, flow);
    world.view.reward = null;
}

/**
 * The arena's tail of `handleContinue`: a gauntlet fight advances the gauntlet (carrying HP) or, the
 * last one, finishes it, banks the leader's blueprints, records the clear and ends the run in
 * victory; any other fight is resolved. Order is the arena's.
 */
function settleEncounter(world: World, flow: RewardFlow): void {
    const { store } = world;
    const run = runOf(world);
    const gauntlet = run.gauntlet;
    if (!gauntlet) { store.dispatch(resolveEncounter()); return; }
    if (gauntlet.fightIndex < gauntlet.totalFights - 1) { store.dispatch(advanceGauntlet(flow.carried ?? [])); return; }

    store.dispatch(finishGauntlet());
    for (const speciesId of gymClearBlueprints((authoredBossFor(run.gymId)?.members ?? []).map((m) => m.species))) {
        store.dispatch(addBlueprint(speciesId));
        store.dispatch(recordBankedBlueprint(speciesId));
    }
    store.dispatch(markGymCleared(run.gymId));
    store.dispatch(recordTierCleared(run.tier));
    store.dispatch(recordGymTierClear({ gymId: run.gymId, tier: run.tier }));
    store.dispatch(endRun('victory'));
}

/** How many macro slots a rack has, for the replace-a-slot moves. */
export const rackSlots = (): ReadonlyArray<number> => Array.from({ length: MACRO_SLOTS }, (_, i) => i);
