/**
 * THE STATIC GALLERY — ticket 34 part two.
 *
 * `scripts/screenshots.mjs` walks a real production build and photographs what it can reach. Three
 * screens it CANNOT reach are the marketplace, the workshop and the run summary: the first two need
 * a run walked to that node, and reaching one means winning fights, which a click-script cannot do.
 * Ticket 34 part one recorded them as gaps.
 *
 * This closes the first of the three, by the route the UI tests already use: render the screen to
 * static markup against a hand-built run, drop it into a page carrying the BUILT stylesheet, and
 * photograph that. It is not a substitute for the walked capture — no hover, no focus, no
 * interaction — but for a screen whose whole job is a shelf of card faces, a still of the shelf is
 * exactly the artifact ticket 45 wants.
 *
 * Usage, from the repo root:
 *
 *     npm run build
 *     npx vite-node scripts/screenshot-gallery.tsx     # writes /tmp/gallery-body.html
 *
 * then inline it into a page with `dist/assets/*.css` and screenshot it. The seed is fixed, so the
 * stock is the same shelf every time and two captures are comparable.
 */

import { writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import MarketplaceNode from '../src/ui/screens/MarketplaceNode';
import runReducer from '../src/ui/store/runSlice';
import { createRun } from '../src/engine/run/createRun';
import { offerGyms } from '../src/engine/run/gyms';
import type { IRanchMember, IRunState } from '../src/engine/runTypes';
import type { IMingmingState } from '../src/engine/types';

const member = (id: string, definitionId: string, activeOS: string): IMingmingState => ({
    id, definitionId, activeOS, blueprintsCollected: 0, attackIV: 12, defenseIV: 19, hpIV: 24,
});
const PARTY = [member('mm1', 'kraken', 'kraken_v1')];
const RANCH: IRanchMember[] = PARTY.map((m) => ({
    id: m.id, definitionId: m.definitionId, activeOS: m.activeOS!,
    attackIV: m.attackIV!, defenseIV: m.defenseIV!, hpIV: m.hpIV!,
}));

const offer = offerGyms('gallery-seed')[0];
const base = createRun({ seed: 'gallery-seed', offer, party: PARTY, startedAt: 0 });
const market = base.nodes.find((n) => n.kind === 'marketplace')!;
const run: IRunState = {
    ...base,
    scrap: 220,
    currentNodeId: market.id,
    nodes: base.nodes.map((n) => (n.id === market.id ? { ...n, visited: n.visited + 1 } : n)),
};

const store = configureStore({
    reducer: { run: runReducer },
    preloadedState: { run: { run } },
    middleware: (d) => d({ serializableCheck: false }),
});

const body = renderToStaticMarkup(
    <Provider store={store}>
        <MarketplaceNode
            run={run}
            node={run.nodes.find((n) => n.id === run.currentNodeId)!}
            party={RANCH}
            biomeName="Brinehollow"
            onEditLoadout={() => undefined}
            onLeave={() => undefined}
        />
    </Provider>,
);

writeFileSync('/tmp/gallery-body.html', body, 'utf8');
console.log('bytes', body.length);
