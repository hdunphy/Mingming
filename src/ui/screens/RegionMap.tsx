/**
 * The region map — ticket 10 (steam-release map).
 *
 * # WHAT THE PLAYER IS LOOKING AT
 *
 * Three sequential biomes of five layers, drawn left to right, with every edge walkable both ways.
 * Ticket 07: "the graph is genuinely explorable, not a frontier picker" — so this is a map you route
 * across, not a row of next-step buttons. Backtracking is legal and sometimes correct: a marketplace
 * two layers behind is reachable at the price of re-fighting the wilds between here and there.
 *
 * # THE THREE RULINGS THIS SCREEN HAS TO SHOW, NOT JUST OBEY
 *
 * 1. **Visibility is one layer ahead** — types visible, contents hidden. Fog hides a node's *kind*,
 *    never the node: you can see that a fork exists four layers out, you just cannot see what is on
 *    it. Anywhere you have already stood stays revealed.
 * 2. **Entering a node triggers it AGAIN, always.** So the map must never show a node as spent.
 *    There is no dead/alive state here — there is a **visit count**, and a wild you have cleared
 *    twice says "×2" rather than greying out. Farming is fine (ticket 07), and the screen should
 *    not imply otherwise.
 * 3. **There are no rest nodes.** Full heal between regular nodes stands, so nothing here is a
 *    campfire and nothing needs a "heal" affordance.
 *
 * # ACCESSIBILITY: TWO RENDERINGS OF ONE THING
 *
 * The SVG is the picture and is `aria-hidden`. Beneath it is a real list of focusable buttons, one
 * per reachable node, which is what a keyboard and a screen reader actually use. That is deliberate
 * rather than lazy: making an SVG `<g>` behave like a button means hand-rolling focus, roles and
 * key handling and still ending up with something a screen reader narrates badly, whereas a button
 * list is correct by construction and stays correct when ticket 34 restyles the picture. Ticket 38
 * (accessibility) inherits a screen that already works without a mouse.
 *
 * Sized in `viewBox` units with the picture scrolling inside its own container, so the 1280x800
 * Steam Deck frame (ticket 37) is a smaller window onto the same map rather than a broken layout.
 */

import { useMemo } from 'react';
import type { ReactNode } from 'react';

import type { IRegionNode } from '../../engine/runTypes';
import { describeDriver } from '../../engine/data/driverRegistry';
import {
    FIGHT_KINDS,
    NODE_LABEL,
    isRunStart,
    layoutRegion,
    nodeIconFor,
    nodeLabelFor,
    type LaidOutNode,
} from './regionLayout';
import type { IconName } from '../theme/icons';
import './RegionMap.css';
import { Icon } from '../theme/Icon';
import { iconPaths } from '../theme/icons';

const ELEMENT_COLOR: Record<string, string> = {
    Fire: '#e8734a',
    Water: '#4aa3e8',
    Nature: '#5fc27e',
};

// Geometry, in viewBox units. Relative sizing lives in the stylesheet.
const COL_W = 96;
const ROW_H = 74;
const PAD_X = 52;
const PAD_Y = 40;
const R = 21;

/**
 * TICKET 34 part two — how far a node may lean off its lane.
 *
 * The ruled reference is `research/64-map-proto/map_N_route.svg`: *"OPTION N — WINDING ROUTE
 * (overworld feel)"*. Its nodes are visibly off-lattice, and that is the whole of the difference
 * between a flowchart and a route — a grid tells you the graph is generated, a wander tells you it
 * is a place.
 *
 * A quarter of the lane each way, and the two numbers are not equal on purpose. **X is the tighter
 * one**: columns carry the run's ordering (you walk left to right, and the fog is measured in
 * columns), so a node that wanders far enough to look like it belongs to the next layer would be
 * lying about the graph. Y has no such meaning — a column's rows are just a stacking order — so it
 * gets the looser lean and does most of the visible work.
 */
/** How far the biome panels sit inside the canvas, top and bottom. */
const BAND_INSET_Y = 10;

const WANDER_X = COL_W * 0.20;
const WANDER_Y = ROW_H * 0.26;

function cx(column: number, wander = 0): number {
    return PAD_X + column * COL_W + wander * WANDER_X;
}

function cy(row: number, rowsInColumn: number, maxRows: number, wander = 0): number {
    const span = (maxRows - rowsInColumn) / 2;
    return PAD_Y + (row + span) * ROW_H + R + wander * WANDER_Y;
}

/** A laid-out node's centre, wander included. The one place the two are combined. */
const centreOf = (laid: LaidOutNode, maxRows: number): { x: number; y: number } => ({
    x: cx(laid.column, laid.wanderX),
    y: cy(laid.row, laid.rowsInColumn, maxRows, laid.wanderY),
});

export interface RegionMapProps {
    readonly nodes: ReadonlyArray<IRegionNode>;
    readonly currentNodeId: string;
    readonly biomeNames: ReadonlyArray<string>;
    readonly biomeElements: ReadonlyArray<string>;
    /**
     * TICKET 142c — what a RIVAL in each biome fields, off-biome element first, indexed by biome.
     *
     * A rival is the one fight kind that ignores the biome it stands in, and until this prop it was
     * drawn and described with the biome's element like every other fight — so the only node on the
     * map deliberately off-element was the only node labelled with the wrong one. Henry found the
     * mechanic by walking into it, which is the definition of a node that does not read as a choice.
     *
     * Passed in rather than derived: this component takes nodes and names, not a run (see
     * `regionLayout`'s header), and the pair is a function of the run's GYM, which it has no view of.
     * Empty by default so a caller with no run behind it draws the ordinary biome colouring.
     */
    readonly rivalElements?: ReadonlyArray<ReadonlyArray<string>>;
    /**
     * Biome indices a map-reveal macro has surveyed (ticket 15). Optional, and empty by default, so
     * a caller that has no run behind it draws the ordinary one-layer fog.
     */
    readonly revealedBiomes?: ReadonlyArray<number>;
    readonly onTravel: (node: IRegionNode) => void;
}

const NO_REVEALS: ReadonlyArray<number> = [];
const NO_RIVAL_ELEMENTS: ReadonlyArray<ReadonlyArray<string>> = [];

export default function RegionMap({
    nodes,
    currentNodeId,
    biomeNames,
    biomeElements,
    rivalElements = NO_RIVAL_ELEMENTS,
    revealedBiomes = NO_REVEALS,
    onTravel,
}: RegionMapProps): ReactNode {
    const layout = useMemo(
        () => layoutRegion(nodes, currentNodeId, revealedBiomes),
        [nodes, currentNodeId, revealedBiomes],
    );

    const width = PAD_X * 2 + (layout.columnCount - 1) * COL_W;
    const height = PAD_Y * 2 + layout.maxRows * ROW_H;

    // Each undirected edge once. `edges` holds both halves by construction (ticket 07), so drawing
    // straight from the arrays would paint every line twice — harmless to look at, wasteful in the
    // DOM, and misleading to anyone counting elements in a test.
    const lines = useMemo(() => {
        const seen = new Set<string>();
        const out: Array<{ key: string; a: LaidOutNode; b: LaidOutNode }> = [];
        for (const laid of layout.nodes) {
            for (const otherId of laid.node.edges) {
                const key = [laid.node.id, otherId].sort().join('|');
                if (seen.has(key)) continue;
                const other = layout.byId.get(otherId);
                if (!other) continue;
                seen.add(key);
                out.push({ key, a: laid, b: other });
            }
        }
        return out;
    }, [layout]);

    /*
     * TICKET 34 — THE BIOME BACKDROPS.
     *
     * The map is a walk through three mono-element biomes in a ruled order (`gyms.offerGyms`), and
     * until now the only thing that said so was a strip of three labels above the picture. So the
     * picture itself now carries the routing information: each biome's span of columns gets a band
     * tinted with its element, fading out downward so the nodes and edges stay the brightest thing
     * on screen.
     *
     * Derived from the laid-out columns rather than from `REGION_PARAMS.layersPerBiome`, because the
     * layout owns where a column ends up and a second opinion about it would drift the day a pocket
     * changes the column count. A band is exactly as wide as the nodes it stands behind.
     *
     * The strip above the picture stays. It names the biome and states its element in words, and a
     * colour is not a label — ticket 38's accessibility pass would have to put the words back.
     */
    const bands = useMemo(() => {
        const spans = new Map<number, { min: number; max: number }>();
        for (const laid of layout.nodes) {
            const span = spans.get(laid.node.biomeIndex);
            if (!span) spans.set(laid.node.biomeIndex, { min: laid.column, max: laid.column });
            else { span.min = Math.min(span.min, laid.column); span.max = Math.max(span.max, laid.column); }
        }
        return [...spans.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([biomeIndex, span]) => ({
                biomeIndex,
                element: biomeElements[biomeIndex] ?? 'None',
                // Half a column of margin either side, so neighbouring bands meet cleanly between
                // the last node of one biome and the first of the next rather than under either.
                x: cx(span.min) - COL_W / 2,
                width: (span.max - span.min + 1) * COL_W,
            }));
    }, [layout, biomeElements]);

    /**
     * TICKET 34 part two: where the player is, relative to each band.
     *
     * The reference labels its three panels `NATURE ✓` / `FIRE — CURRENT` / `WATER — AHEAD`, and
     * that is the one piece of information the picture was missing: the strip above says *which*
     * biomes the run walks, and this says *how far through them you are*. It is a state word rather
     * than the biome name repeated, because the name is already on the strip and a map that prints
     * everything twice is a map nobody reads.
     */
    const currentBiome = layout.byId.get(currentNodeId)?.node.biomeIndex ?? 0;
    const bandState = (biomeIndex: number): string =>
        biomeIndex < currentBiome ? 'WALKED' : biomeIndex === currentBiome ? 'CURRENT' : 'AHEAD';

    const reachable = layout.nodes.filter((n) => n.reachable);

    /** The map key: one entry per icon on show, revealed nodes only, in layout order. */
    const legendKey: ReadonlyArray<{ icon: IconName; label: string }> = (() => {
        const seen = new Map<string, { icon: IconName; label: string }>();
        for (const laid of layout.nodes) {
            if (!laid.revealed) continue;
            const label = nodeLabelFor(laid.node);
            if (!seen.has(label)) seen.set(label, { icon: nodeIconFor(laid.node), label });
        }
        return [...seen.values()];
    })();
    const current = layout.byId.get(currentNodeId);

    /**
     * The elements a fight node actually fields — the ONE place that decides it, so the colour, the
     * label and the legend cannot drift apart. A rival fields its run's path pair (142c deals the
     * off-biome one first, and that order is preserved here because it is the one that matters to a
     * route decision); every other fight fields its biome's.
     */
    const elementsOf = (node: IRegionNode): ReadonlyArray<string> => {
        if (node.kind === 'rival') {
            const pair = rivalElements[node.biomeIndex] ?? [];
            if (pair.length > 0) return pair;
        }
        const own = biomeElements[node.biomeIndex];
        return own ? [own] : [];
    };
    const describe = (laid: LaidOutNode): string => {
        const elements = elementsOf(laid.node);
        // Ticket 142c: the scout takes over an ordinary fight node rather than being its own kind,
        // so it has to be said rather than inferred from the icon. Before this, no UI file read the
        // flag at all and the one fight that previews the gauntlet was indistinguishable from an elite.
        const kind = laid.revealed
            ? (laid.node.scout ? `Scout ${NODE_LABEL[laid.node.kind].toLowerCase()}` : nodeLabelFor(laid.node))
            : 'Unknown';
        const parts = [kind];
        // BOTH elements on a rival, off-biome first (Henry's ruling): the pair IS the information —
        // "Fire" alone on a Rootfall rival in the Fire biome is exactly the label that hid it.
        if (laid.revealed && FIGHT_KINDS.includes(laid.node.kind) && elements.length > 0) {
            parts.push(elements.join(' + '));
        }
        /*
         * TICKET 17 — THE STAKES, said before the player commits. An elite or an ambush pays a
         * Driver and the node has known which one since the run was rolled; a map that hid it
         * would be asking the player to route toward a prize they cannot see. The ambush is also
         * MARKED: it is the one fight that outnumbers you by design (their 3 vs your 2), and Henry's
         * reading is that it is harder than the elite — so it says so, and calls the Driver its
         * bonus rather than its exam.
         */
        // 2026-09-25: the start is a wild underneath, and walking back into it fights like any re-entry.
        if (isRunStart(laid.node)) parts.push('walking back in is a Wild fight');
        if (laid.revealed && laid.node.kind === 'ambush') parts.push('HIGH RISK — they outnumber you');
        if (laid.revealed && laid.node.driverStake) {
            parts.push(`${laid.node.kind === 'ambush' ? 'bonus' : 'stakes'}: ${describeDriver(laid.node.driverStake).name}`);
        }
        parts.push(`biome ${laid.node.biomeIndex + 1}`, `layer ${laid.node.layer}`);
        if (laid.node.pocket) parts.push('dead end');
        if (laid.node.visited > 0) parts.push(`visited ${laid.node.visited}×`);
        return parts.join(', ');
    };

    return (
        <div className="rm">
            <div className="rm-biome-strip" aria-hidden="true">
                {biomeNames.map((name, i) => (
                    <div
                        key={i}
                        className={`rm-biome ${current && current.node.biomeIndex === i ? 'here' : ''}`}
                        style={{ borderColor: ELEMENT_COLOR[biomeElements[i]] ?? '#7a5cff' }}
                    >
                        <span className="rm-biome-name">{name}</span>
                        <span className="rm-biome-element">{biomeElements[i]}</span>
                    </div>
                ))}
            </div>

            {/*
              * TICKET 38 — THE PANNABLE CANVAS HAS TO BE FOCUSABLE, OR THE PAN IS MOUSE-ONLY.
              *
              * axe: `scrollable-region-focusable`, SERIOUS, and it is the direct cost of the
              * decision ticket 37 confirmed — a 15-column region is genuinely wider than a
              * 1280×800 frame, so the map PANS rather than shrinking its nodes below a readable
              * size. `scrollLeft` moves 210px at Deck resolution, and before this a keyboard-only
              * player had no way to move it: the div took no focus, so the arrow keys never
              * reached it.
              *
              * `tabIndex={0}` plus a name and a role is the whole fix — a focused scroll container
              * is arrow-scrollable by the browser, so no key handler is needed and none is added.
              * `group` rather than `region`, because `region` would ask for a landmark this is not.
              *
              * The SVG inside stays `aria-hidden`: it is the picture, and the nodes it draws are
              * already real buttons elsewhere in this screen. The travel list is the accessible
              * path to a node; this is the accessible path to SEEING the rest of the map.
              */}
            <div
                className="rm-canvas"
                tabIndex={0}
                role="group"
                aria-label="Region map — scroll or use the arrow keys to pan across the biomes"
            >
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    width={width}
                    height={height}
                    role="presentation"
                    aria-hidden="true"
                >
                    <defs>
                        {bands.map((band) => (
                            <linearGradient key={band.biomeIndex} id={`rm-biome-${band.biomeIndex}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={ELEMENT_COLOR[band.element] ?? '#7a5cff'} stopOpacity={0.16} />
                                <stop offset="70%" stopColor={ELEMENT_COLOR[band.element] ?? '#7a5cff'} stopOpacity={0.03} />
                                <stop offset="100%" stopColor={ELEMENT_COLOR[band.element] ?? '#7a5cff'} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>
                    {/*
                      * Rounded, inset panels rather than full-bleed bands — the reference draws
                      * each biome as a PLACE with edges, not as a stripe behind the graph. The
                      * inset is what makes them read as three panels on one board.
                      */}
                    {bands.map((band) => (
                        <g key={band.biomeIndex}>
                            <rect
                                className="rm-biome-band"
                                x={band.x + 3} y={BAND_INSET_Y}
                                width={band.width - 6} height={height - BAND_INSET_Y * 2}
                                rx={16}
                                fill={`url(#rm-biome-${band.biomeIndex})`}
                                stroke={ELEMENT_COLOR[band.element] ?? '#7a5cff'}
                            />
                            <text
                                className={`rm-band-label ${bandState(band.biomeIndex) === 'CURRENT' ? 'here' : ''}`}
                                x={band.x + 18} y={BAND_INSET_Y + 20}
                                style={{ fill: ELEMENT_COLOR[band.element] ?? undefined }}
                            >
                                {band.element.toUpperCase()} · {bandState(band.biomeIndex)}
                            </text>
                        </g>
                    ))}
                    {bands.slice(1).map((band) => (
                        <line
                            key={`seam-${band.biomeIndex}`}
                            className="rm-biome-seam"
                            x1={band.x} y1={BAND_INSET_Y} x2={band.x} y2={height - BAND_INSET_Y}
                            stroke={ELEMENT_COLOR[band.element] ?? '#7a5cff'}
                        />
                    ))}
                    {/*
                      * TICKET 34 part two — the trails.
                      *
                      * Dotted rather than solid, per the ruled reference: a solid line between two
                      * discs is a graph EDGE, and a dotted one is a path someone walked. It is the
                      * cheapest single change on this screen and it does most of the "overworld
                      * feel" the reference is named for.
                      *
                      * A trail that leads into the fog is DIMMER than one between two revealed
                      * nodes, which is information rather than decoration: it is the difference
                      * between a route you can plan and one you can only see the start of.
                      */}
                    {lines.map(({ key, a, b }) => {
                        const from = centreOf(a, layout.maxRows);
                        const to = centreOf(b, layout.maxRows);
                        return (
                            <line
                                key={key}
                                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                                className={`rm-edge ${a.revealed && b.revealed ? '' : 'faded'}`}
                            />
                        );
                    })}
                    {layout.nodes.map((laid) => {
                        const { x, y } = centreOf(laid, layout.maxRows);
                        // The leading element: the biome's for an ordinary fight, and for a rival the
                        // OFF-BIOME half, because that is the one that makes it worth routing toward.
                        const nodeElements = elementsOf(laid.node);
                        const element = nodeElements[0];
                        const secondElement = nodeElements[1];
                        const isFight = laid.revealed && FIGHT_KINDS.includes(laid.node.kind);
                        return (
                            <g
                                key={laid.node.id}
                                className={[
                                    'rm-node',
                                    laid.isCurrent ? 'current' : '',
                                    laid.reachable ? 'reachable' : '',
                                    laid.revealed ? '' : 'fogged',
                                    laid.node.pocket ? 'pocket' : '',
                                    // Ticket 17: the ambush's high-risk tint, and the stake ring.
                                    laid.revealed && laid.node.kind === 'ambush' ? 'risk' : '',
                                    laid.revealed && laid.node.driverStake ? 'staked' : '',
                                ].filter(Boolean).join(' ')}
                                onClick={laid.reachable ? () => onTravel(laid.node) : undefined}
                            >
                                <circle
                                    cx={x} cy={y}
                                    r={laid.node.kind === 'gym' && laid.revealed ? R + 5 : R}
                                    className="rm-node-disc"
                                    style={isFight ? { stroke: ELEMENT_COLOR[element] ?? undefined } : undefined}
                                />
                                {/*
                                  * TICKET 34: a nested `<svg>` rather than a `<text>` glyph. The
                                  * icon now inherits `currentColor` from `.rm-node-icon`, which is
                                  * what lets a revealed node take its biome's element colour — the
                                  * ruled mockup's behaviour, and undrawable with an emoji.
                                  */}
                                {laid.revealed ? (
                                    <svg
                                        x={x - 9} y={y - 9} width={18} height={18}
                                        viewBox="0 0 24 24" className="rm-node-icon"
                                        fill="none" stroke="currentColor" strokeWidth={1.8}
                                        strokeLinecap="round" strokeLinejoin="round"
                                        style={isFight ? { color: ELEMENT_COLOR[element] ?? undefined } : undefined}
                                    >
                                        {iconPaths(nodeIconFor(laid.node)).map((d) => <path key={d} d={d} />)}
                                    </svg>
                                ) : (
                                    <text x={x} y={y + 7} textAnchor="middle" className="rm-node-icon">·</text>
                                )}
                                {/*
                                  * The visit badge, per the reference: a gold disc pinned to the
                                  * node's shoulder rather than a bare "×2" floating beside it.
                                  * Ticket 07's re-roll rule makes the count meaningful — a node you
                                  * have stood on twice has been TWO different fights — so it earns
                                  * a badge rather than a footnote.
                                  */}
                                {/*
                                  * TICKET 142c — THE SECOND ELEMENT, and the scout ring.
                                  *
                                  * A rival carries two elements and the disc can only be stroked in
                                  * one, so the second gets a dot on the node's lower shoulder. The
                                  * stroke is the OFF-BIOME half — the reason to walk here — and the
                                  * dot is the half the biome would have given you anyway, which is
                                  * the right way round: the surprise is the one you can see from
                                  * across the map.
                                  *
                                  * The scout gets an outer ring rather than an icon, because it is
                                  * not a kind: it takes over whatever fight was already there, and
                                  * an icon would have to replace that node's own shape to say so.
                                  */}
                                {laid.revealed && secondElement && (
                                    <circle
                                        cx={x - R + 5} cy={y + R - 4} r={4}
                                        className="rm-node-second-element"
                                        style={{ fill: ELEMENT_COLOR[secondElement] ?? undefined }}
                                    />
                                )}
                                {/*
                                  * TICKET 17: the stake ring. A solid violet ring — the Driver chip's
                                  * colour, so the map and the battle bar say "Driver" in one voice — on
                                  * every node that pays one. The scout's ring is dashed and sits at the
                                  * same radius; a node can be both, and the two read as one annotation.
                                  */}
                                {laid.revealed && laid.node.driverStake && (
                                    <circle
                                        cx={x} cy={y} r={R + 4}
                                        className="rm-node-stake-ring"
                                    >
                                        <title>{`Driver at stake: ${describeDriver(laid.node.driverStake).name}`}</title>
                                    </circle>
                                )}
                                {laid.revealed && laid.node.scout && (
                                    <circle
                                        cx={x} cy={y} r={R + 4}
                                        className="rm-node-scout-ring"
                                        style={isFight ? { stroke: ELEMENT_COLOR[element] ?? undefined } : undefined}
                                    />
                                )}
                                {laid.node.visited > 0 && (
                                    <g className="rm-node-visits">
                                        <circle cx={x + R - 4} cy={y - R + 4} r={8.5} className="rm-visit-disc" />
                                        <text x={x + R - 4} y={y - R + 7.5} textAnchor="middle" className="rm-visit-count">
                                            {laid.node.visited}
                                        </text>
                                    </g>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>

            <div className="rm-legend">
                {/*
                  * THE ICON KEY — Henry, 2026-09-25: *"The node icons need a legend. It is unclear
                  * what they mean."* The icons were explained only by the `map:types` tip, which is
                  * once-ever, so from the second run on nothing on screen said what a node was.
                  * Built from the nodes the player can actually SEE on this map (fogged ones show
                  * their shape, not their kind), in the order they first appear, so the key never
                  * explains a kind this run does not have.
                  */}
                {legendKey.length > 0 && (
                    <span className="rm-legend-key" aria-label="Map key">
                        {legendKey.map(({ icon, label }) => (
                            <span key={label} className="rm-legend-key-item">
                                <Icon name={icon} size={13} /> {label}
                            </span>
                        ))}
                    </span>
                )}
                <span>You are here: <strong>{current ? describe(current) : '—'}</strong></span>
                {/*
                  * Ticket 142c: stated on the map rather than left to the tip, because the tip is
                  * once-ever (`seenTips` lives on the ranch save) and this is the sentence a player
                  * wants again on the run where it matters. Rendered only when the run HAS rivals,
                  * so a caller without them is not told about a node kind it never draws.
                  */}
                {rivalElements.length > 0 && (
                    <span className="rm-legend-rival">
                        · a <strong>rival</strong> fields the two elements your route needs, not this
                        biome&apos;s — the dot is its second element
                    </span>
                )}
                {/* Ticket 17: the stake ring and the ambush tint, explained once where the fog is. */}
                {layout.nodes.some((n) => n.revealed && n.node.driverStake) && (
                    <span className="rm-legend-stakes">
                        · a <strong>violet ring</strong> is a Driver at stake — win the fight, keep the Driver for the run;
                        a red <strong>ambush</strong> outnumbers you and pays one as a bonus
                    </span>
                )}
                <span className="rm-legend-fog">
                    · fogged nodes show their shape, not their kind — visibility is one layer ahead
                    {/* Ticket 15: a survey is a permanent change to what the map shows, so the
                        legend that explains the fog has to stop lying about it once one is spent. */}
                    {revealedBiomes.length > 0
                        && `, except biome${revealedBiomes.length > 1 ? 's' : ''} ${revealedBiomes.map((b) => b + 1).join(', ')} — surveyed`}
                </span>
            </div>

            {/*
              * The keyboard and screen-reader surface. Not a fallback for the picture — it is the
              * primary control, and the SVG is the illustration of it.
              */}
            <nav className="rm-travel" aria-label="Travel">
                <h3 className="rm-travel-head">Travel</h3>
                <ul className="rm-travel-list">
                    {reachable.map((laid) => (
                        <li key={laid.node.id}>
                            <button type="button" className="rm-travel-button" onClick={() => onTravel(laid.node)}>
                                <span aria-hidden="true" className="rm-travel-icon">
                                    {laid.revealed ? <Icon name={nodeIconFor(laid.node)} size={15} /> : '·'}
                                </span>
                                {describe(laid)}
                            </button>
                        </li>
                    ))}
                    {reachable.length === 0 && <li className="rm-travel-empty">Nowhere to go from here.</li>}
                </ul>
            </nav>
        </div>
    );
}

