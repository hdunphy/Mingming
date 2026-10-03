/**
 * TICKET 180b — THE MARKET: the shelf, macros, blueprint, patch, upgrade bench, sell list and the
 * way out. Composed from `screens/market/` and the shared benches; this module only stacks them and
 * adds the refresh. The stock is rolled for the team the stall was first seen with (171b).
 */
import { MARKET_REFRESH_PRICE, upgradeAllowanceFor, upgradeBenchKeyFor } from '../../../engine/run/marketplace';
import { shopPrice } from '../../../engine/run/modifiers/shopPrice';
import { rerollMarketStock } from '../../../ui/store/runSlice';
import { dispatchChecked, hereNode, leaveStall, liveRanchParty, priceNote } from '../stalls';
import type { Move, Screen, World } from '../types';
import { runOf } from '../types';
import { nodeLabel } from '../gameText';
import { blueprintShelf } from './market/blueprintShelf';
import { cardShelf } from './market/cardShelf';
import { macroShelf } from './market/macroShelf';
import { sellList } from './market/sellList';
import { openLoadout } from './loadoutScreen';
import { patchSection } from './patchBench';
import { upgradeSection } from './upgradeBench';
import { townDoors } from './townScreen';

export function marketScreen(world: World): Screen {
    const node = hereNode(world);
    const run = runOf(world);
    const refreshPrice = shopPrice(run, MARKET_REFRESH_PRICE);

    const cards = cardShelf(world);
    const macros = macroShelf(world);
    const blueprint = blueprintShelf(world);
    const patches = patchSection(world, { venue: 'shop' });
    const upgrades = upgradeSection(world, { benchKey: upgradeBenchKeyFor(node), allowance: upgradeAllowanceFor(node), free: false, keyPrefix: 'market' });
    const sell = sellList(world);

    const refresh: Move[] = run.scrap < refreshPrice ? [] : [{
        key: 'market:refresh',
        label: `Refresh the stall (${refreshPrice} scrap)`,
        apply: (w) => {
            const party = liveRanchParty(w);
            if (dispatchChecked(w, rerollMarketStock({ nodeId: node.id, price: refreshPrice, party }), 'refresh')) w.view.news.push('The stall was restocked.');
        },
    }];
    const leave: Move = { key: 'leave', label: node.kind === 'town' ? 'Leave the town' : 'Leave the market', apply: leaveStall };

    return {
        id: 'market',
        body: [
            `${nodeLabel(node)}, visit ${node.visited}. Scrap: ${run.scrap}. This stock is fixed for the run; a refresh is ${priceNote(world, refreshPrice)}.`,
            ...cards.lines, ...blueprint.lines, ...macros.lines, ...patches.lines, ...upgrades.lines, ...sell.lines,
        ],
        moves: [...cards.moves, ...blueprint.moves, ...macros.moves, ...refresh, ...patches.moves, ...upgrades.moves, ...sell.moves, ...townDoors(world, 'shop'), openLoadout, leave],
    };
}
