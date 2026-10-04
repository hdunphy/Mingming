/**
 * The region map — ticket 10 (steam-release map), redrawn in ticket 176e.
 *
 * # WHAT THE PLAYER IS LOOKING AT
 *
 * Three biomes of towns joined by branching routes, drawn left to right: one column per row of the
 * graph (7 + 5 + 4 = 16), the nodes of a route stacked in the column, a town alone in its own. Travel
 * is ONE-WAY (ticket 176b): from where you stand you can go only along a road that leads right, so
 * the map is a decision about which branch to take, not a place to wander back through.
 *
 * # THE RULINGS THIS SCREEN HAS TO SHOW, NOT JUST OBEY
 *
 * 1. **Every node's type is visible from the start** (ticket 176d). There is no fog: routing is a
 *    decision about the whole road, so the whole road is on the page. What stays hidden is the
 *    SPECIES: which Mingmings wait in a fight shows only after a Ping Sweep or a Relay Tower Survey,
 *    for the fights of the biome it was fired in (`encounters`).
 * 2. **The path you walked is lit and the branches you left are dimmed.** There is no visit count any
 *    more: a node is entered once, so "×2" can not happen. What the map can usefully say is where you
 *    have been (a gold road) and what you can no longer reach (faded).
 * 3. **A detour is the optional long way.** It hangs off the route, joined by a dashed road, and
 *    costs one extra fight, which it says in words ("+1 fight") so it is not a surprise.
 * 4. **There are no rest nodes.** Full heal between regular nodes stands, so nothing here is a
 *    campfire and nothing needs a "heal" affordance.
 *
 * # ACCESSIBILITY: TWO RENDERINGS OF ONE THING
 *
 * The SVG is the picture and is `aria-hidden`. Beneath it is a real list of focusable buttons, one
 * per reachable node (the forward roads from where you stand), which is what a keyboard and a screen
 * reader actually use. That is deliberate rather than lazy: making an SVG `<g>` behave like a button
 * means hand-rolling focus, roles and key handling and still ending up with something a screen
 * reader narrates badly, whereas a button list is correct by construction.
 *
 * Sized in `viewBox` units with the picture scrolling inside its own container: the 16 columns are
 * wider than any frame, so the map pans sideways, and it scrolls itself to keep you in view.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import type { IRegionNode } from '../../engine/runTypes';
import { routeNumberOf } from '../../engine/run/regionGraph';
import {
    COL_W,
    FIGHT_KINDS,
    NODE_LABEL,
    PAD_X,
    canvasHeight,
    canvasWidth,
    centreOf,
    layoutRegion,
    nodeIconFor,
    nodeLabelFor,
    positionWord,
    shapeOf,
    type LaidOutNode,
} from './regionLayout';
import './RegionMap.css';
import { Icon } from '../theme/Icon';
import { iconPaths } from '../theme/icons';
import { resolveDriverStake } from '../../engine/run/driverStakes';
import { AMBUSH_RISK } from '../../engine/run/ambushRisk';
import { driverText } from '../labels/driverText';

const ELEMENT_COLOR: Record<string, string> = {
    Fire: 'var(--el-fire)',
    Water: 'var(--el-water)',
    Nature: 'var(--hp)',
};

/** How far the biome panels sit inside the canvas, top and bottom. */
const BAND_INSET_Y = 10;

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
     * TICKET 176d — who waits in a fight, by node id: "Sköll, Huldra". Present only for the fights
     * of a biome a map-reveal macro has surveyed, so with no reveal the map shows no species at all.
     * Passed in rather than rolled here: this component takes nodes and names, not a run, and the
     * answer is `previewEncounter` on the current party.
     */
    readonly encounters?: Readonly<Record<string, string>>;
    /**
     * TICKET 172 — the elements the party fields, so an Element Driver stake names the Driver a win
     * would actually pay this team (`resolveDriverStake`). Empty by default: the rolled stake.
     */
    readonly partyElements?: ReadonlyArray<string>;
    readonly onTravel: (node: IRegionNode) => void;
}

const NO_ENCOUNTERS: Readonly<Record<string, string>> = {};
const NO_ELEMENTS: ReadonlyArray<string> = [];
const NO_RIVAL_ELEMENTS: ReadonlyArray<ReadonlyArray<string>> = [];

export default function RegionMap({
    nodes,
    currentNodeId,
    biomeNames,
    biomeElements,
    rivalElements = NO_RIVAL_ELEMENTS,
    encounters = NO_ENCOUNTERS,
    partyElements = NO_ELEMENTS,
    onTravel,
}: RegionMapProps): ReactNode {
    const stakeName = (stake: string): string => driverText(resolveDriverStake(stake, partyElements)).name;
    const layout = useMemo(
        () => layoutRegion(nodes, currentNodeId),
        [nodes, currentNodeId],
    );

    const width = canvasWidth(layout);
    const height = canvasHeight(layout);

    // TICKET 176e: keep the player in view. The map is wider than the frame, so after each step it
    // scrolls to put the node you are standing on near the middle (a plain assignment, so it also
    // works where `scrollTo` does not exist).
    const canvasRef = useRef<HTMLDivElement>(null);
    const here = layout.byId.get(currentNodeId);
    const hereX = here ? centreOf(here).x : 0;
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.scrollLeft = Math.max(0, hereX - canvas.clientWidth / 2);
    }, [hereX, currentNodeId]);

    // Every road once, in the direction it can be walked. `edges` is forward-only since 176b, so
    // this is just the edge lists; a road is lit when both its ends are on the path walked, and
    // faded when either end can no longer be reached.
    const lines = useMemo(() => {
        const out: Array<{ key: string; a: LaidOutNode; b: LaidOutNode }> = [];
        for (const laid of layout.nodes) {
            for (const otherId of laid.node.edges) {
                const other = layout.byId.get(otherId);
                if (!other) continue;
                out.push({ key: `${laid.node.id}>${otherId}`, a: laid, b: other });
            }
        }
        return out;
    }, [layout]);

    /*
     * TICKET 34 — THE BIOME BACKDROPS.
     *
     * The map is a walk through three mono-element biomes in a ruled order (`gyms.offerGyms`), so
     * the picture itself carries the routing information: each biome's span of columns gets a band
     * tinted with its element, fading out downward so the nodes and roads stay the brightest thing
     * on screen. Derived from the laid-out columns, so a band is exactly as wide as the nodes it
     * stands behind.
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
                x: PAD_X + span.min * COL_W - COL_W / 2,
                width: (span.max - span.min + 1) * COL_W,
            }));
    }, [layout, biomeElements]);

    /** Which biome the player is in, so that panel's name is the one that lights up. */
    const currentBiome = here?.node.biomeIndex ?? 0;

    const reachable = layout.nodes.filter((n) => n.reachable);

    // TICKET 182a: the legend key, "You are here" and the bullet lines are cut. The node hover (below)
    // says what a node is, and the Travel list says it for screen readers.
    const hasStakes = layout.nodes.some((n) => n.node.driverStake);

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
    const baseDescribe = (laid: LaidOutNode): string => {
        const elements = elementsOf(laid.node);
        // Ticket 142c: the scout takes over an ordinary fight node rather than being its own kind,
        // so it has to be said rather than inferred from the icon.
        let kind = laid.node.scout ? `Scout ${NODE_LABEL[laid.node.kind].toLowerCase()}` : nodeLabelFor(laid.node);
        // TICKET 176e: a detour says what it costs, right next to its name - "Alpha (detour, +1 fight)".
        if (laid.node.detour) kind = `${kind} (detour, +1 fight)`;
        // TICKET 176d: after a survey the fight names who waits in it - "Rival: Sköll, Huldra".
        const species = encounters[laid.node.id];
        const parts = [species ? `${kind}: ${species}` : kind];
        // BOTH elements on a rival, off-biome first (Henry's ruling): the pair IS the information —
        // "Fire" alone on a Rootfall rival in the Fire biome is exactly the label that hid it.
        if (FIGHT_KINDS.includes(laid.node.kind) && elements.length > 0) {
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
        if (laid.node.kind === 'ambush') parts.push(AMBUSH_RISK);
        if (laid.node.driverStake) {
            parts.push(`${laid.node.kind === 'ambush' ? 'bonus' : 'stakes'}: ${stakeName(laid.node.driverStake)}`);
        }
        parts.push(`biome ${laid.node.biomeIndex + 1}`);
        const route = routeNumberOf(laid.node);
        if (route !== null) parts.push(`route ${route}`);
        return parts.join(', ');
    };

    /**
     * TICKET 186c: two nodes of one column can describe themselves with the very same words, and then
     * the Travel list and the hover name two places alike. Identical words get where each sits in its
     * column, top to bottom; a description that is already its own is left as it was.
     */
    const describe = (laid: LaidOutNode): string => {
        const base = baseDescribe(laid);
        const twins = layout.nodes
            .filter((other) => other.column === laid.column && baseDescribe(other) === base)
            .sort((a, b) => a.row - b.row);
        if (twins.length < 2) return base;
        const place = twins.indexOf(laid);
        return `${base}, ${positionWord(twins.length, place)}`;
    };

    /**
     * TICKET 182a — what a node says when you hover it, now that the key line and "You are here"
     * are gone. The same words the Travel list reads out; a rival adds the one line that explains
     * it (142c: it fields the elements the road needs, not the biome's).
     */
    const hoverOf = (laid: LaidOutNode): string =>
        laid.node.kind === 'rival'
            ? `${describe(laid)}. A rival fields the elements this road needs.`
            : describe(laid);

    /** The short name written on the map under a node. */
    const captionOf = (laid: LaidOutNode): string => {
        const name = laid.node.scout ? `${nodeLabelFor(laid.node)} (scout)` : nodeLabelFor(laid.node);
        return laid.node.detour ? `${name} · detour +1 fight` : name;
    };

    return (
        <div className="rm">
            {/* TICKET 182a: the biome tab strip is gone; each band on the map names its biome. */}

            {/*
              * TICKET 38 — THE PANNABLE CANVAS HAS TO BE FOCUSABLE, OR THE PAN IS MOUSE-ONLY.
              *
              * The map is wider than a 1280×800 frame, so it PANS rather than shrinking its nodes
              * below a readable size, and before ticket 38 a keyboard-only player had no way to move
              * it. `tabIndex={0}` plus a name and a role is the whole fix — a focused scroll
              * container is arrow-scrollable by the browser, so no key handler is needed.
              *
              * The SVG inside stays `aria-hidden`: it is the picture, and the nodes it draws are
              * already real buttons elsewhere in this screen. The travel list is the accessible
              * path to a node; this is the accessible path to SEEING the rest of the map.
              */}
            <div
                ref={canvasRef}
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
                                <stop offset="0%" stopColor={ELEMENT_COLOR[band.element] ?? 'var(--el-water)'} stopOpacity={0.16} />
                                <stop offset="70%" stopColor={ELEMENT_COLOR[band.element] ?? 'var(--el-water)'} stopOpacity={0.03} />
                                <stop offset="100%" stopColor={ELEMENT_COLOR[band.element] ?? 'var(--el-water)'} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>
                    {/*
                      * Rounded, inset panels rather than full-bleed bands — the reference draws
                      * each biome as a PLACE with edges, not as a stripe behind the graph.
                      */}
                    {bands.map((band) => (
                        <g key={band.biomeIndex}>
                            <rect
                                className="rm-biome-band"
                                x={band.x + 3} y={BAND_INSET_Y}
                                width={band.width - 6} height={height - BAND_INSET_Y * 2}
                                rx={16}
                                fill={`url(#rm-biome-${band.biomeIndex})`}
                                stroke={ELEMENT_COLOR[band.element] ?? 'var(--el-water)'}
                            />
                            <text
                                className={`rm-band-label ${band.biomeIndex === currentBiome ? 'here' : ''}`}
                                x={band.x + 18} y={BAND_INSET_Y + 22}
                                style={{ fill: ELEMENT_COLOR[band.element] ?? undefined }}
                            >
                                {biomeNames[band.biomeIndex] ?? band.element}
                            </text>
                        </g>
                    ))}
                    {bands.slice(1).map((band) => (
                        <line
                            key={`seam-${band.biomeIndex}`}
                            className="rm-biome-seam"
                            x1={band.x} y1={BAND_INSET_Y} x2={band.x} y2={height - BAND_INSET_Y}
                            stroke={ELEMENT_COLOR[band.element] ?? 'var(--el-water)'}
                        />
                    ))}
                    {/* "Route 1" to "Route 5", along the bottom of the picture. */}
                    {layout.routes.map((route) => (
                        <text
                            key={route.route}
                            className="rm-route-label"
                            x={PAD_X + ((route.firstColumn + route.lastColumn) / 2) * COL_W}
                            y={height - 30}
                            textAnchor="middle"
                        >
                            {`Route ${route.route}`}
                        </text>
                    ))}
                    {/*
                      * The roads. Thick and solid (they were dotted footsteps when the map could be
                      * walked both ways): the gold ones are the path walked, the faded ones lead to
                      * or from a node that can no longer be reached, and a dashed one is a detour.
                      */}
                    {lines.map(({ key, a, b }) => {
                        const from = centreOf(a);
                        const to = centreOf(b);
                        return (
                            <line
                                key={key}
                                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                                className={[
                                    'rm-edge',
                                    a.taken && b.taken ? 'taken' : '',
                                    a.passed || b.passed ? 'faded' : '',
                                    a.node.detour || b.node.detour ? 'detour' : '',
                                ].filter(Boolean).join(' ')}
                            />
                        );
                    })}
                    {layout.nodes.map((laid) => {
                        const { x, y } = centreOf(laid);
                        const shape = shapeOf(laid.node);
                        // Half the node's height, for the things that hang off its top or bottom.
                        const halfH = shape.kind === 'box' ? shape.h / 2 : shape.r;
                        const r = shape.kind === 'disc' ? shape.r : 0;
                        // The leading element: the biome's for an ordinary fight, and for a rival the
                        // OFF-BIOME half, because that is the one that makes it worth routing toward.
                        const nodeElements = elementsOf(laid.node);
                        const element = nodeElements[0];
                        const secondElement = nodeElements[1];
                        const isFight = FIGHT_KINDS.includes(laid.node.kind);
                        const species = encounters[laid.node.id];
                        // A detour hanging above the route is captioned above itself, so the caption
                        // does not sit on the road down to the next row.
                        const captionAbove = laid.side === 'up';
                        const captionY = captionAbove ? y - halfH - 10 : y + halfH + 18;
                        return (
                            <g
                                key={laid.node.id}
                                className={[
                                    'rm-node',
                                    laid.isCurrent ? 'current' : '',
                                    laid.reachable ? 'reachable' : '',
                                    laid.taken ? 'taken' : '',
                                    laid.passed ? 'passed' : '',
                                    laid.node.detour ? 'detour' : '',
                                    laid.node.kind === 'town' ? 'town' : '',
                                    // Ticket 17: the ambush's high-risk tint, and the stake ring.
                                    laid.node.kind === 'ambush' ? 'risk' : '',
                                    laid.node.driverStake ? 'staked' : '',
                                ].filter(Boolean).join(' ')}
                                onClick={laid.reachable ? () => onTravel(laid.node) : undefined}
                            >
                                {/* TICKET 182a: the key line is gone, so every node says what it is on hover. */}
                                <title>{hoverOf(laid)}</title>
                                {shape.kind === 'box' ? (
                                    <>
                                        <rect
                                            x={x - shape.w / 2} y={y - shape.h / 2}
                                            width={shape.w} height={shape.h} rx={18}
                                            className="rm-node-disc rm-town-box"
                                        />
                                        <text x={x} y={y - 6} textAnchor="middle" className="rm-town-name">Town</text>
                                        <text x={x} y={y + 16} textAnchor="middle" className="rm-town-sub">Market · Den</text>
                                    </>
                                ) : (
                                    <>
                                        <circle
                                            cx={x} cy={y} r={r}
                                            className="rm-node-disc"
                                            style={isFight ? { stroke: ELEMENT_COLOR[element] ?? undefined } : undefined}
                                        />
                                        {/*
                                          * TICKET 34: a nested `<svg>` rather than a `<text>` glyph. The
                                          * icon inherits `currentColor` from `.rm-node-icon`, which is what
                                          * lets a fight node take its biome's element colour.
                                          */}
                                        <svg
                                            x={x - r * 0.45} y={y - r * 0.45} width={r * 0.9} height={r * 0.9}
                                            viewBox="0 0 24 24" className="rm-node-icon"
                                            fill="none" stroke="currentColor" strokeWidth={1.8}
                                            strokeLinecap="round" strokeLinejoin="round"
                                            style={isFight ? { color: ELEMENT_COLOR[element] ?? undefined } : undefined}
                                        >
                                            {iconPaths(nodeIconFor(laid.node)).map((d) => <path key={d} d={d} />)}
                                        </svg>
                                    </>
                                )}
                                {/*
                                  * TICKET 142c — THE SECOND ELEMENT, and the scout ring.
                                  *
                                  * A rival carries two elements and the disc can only be stroked in
                                  * one, so the second gets a dot on the node's lower shoulder. The
                                  * stroke is the OFF-BIOME half — the reason to walk here — and the
                                  * dot is the half the biome would have given you anyway.
                                  *
                                  * The scout gets an outer ring rather than an icon, because it is
                                  * not a kind: it takes over whatever fight was already there.
                                  */}
                                {secondElement && shape.kind === 'disc' && (
                                    <circle
                                        cx={x - r + 6} cy={y + r - 5} r={5}
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
                                {laid.node.driverStake && shape.kind === 'disc' && (
                                    <circle
                                        cx={x} cy={y} r={r + 5}
                                        className="rm-node-stake-ring"
                                    >
                                        <title>{`Totem at stake: ${stakeName(laid.node.driverStake)}`}</title>
                                    </circle>
                                )}
                                {laid.node.scout && shape.kind === 'disc' && (
                                    <circle
                                        cx={x} cy={y} r={r + 5}
                                        className="rm-node-scout-ring"
                                        style={isFight ? { stroke: ELEMENT_COLOR[element] ?? undefined } : undefined}
                                    />
                                )}
                                {/* What it is, written under (or, for a detour above the route, over) the node. */}
                                {shape.kind === 'disc' && (
                                    <text x={x} y={captionY} textAnchor="middle" className="rm-node-caption">
                                        {captionOf(laid)}
                                    </text>
                                )}
                                {species && shape.kind === 'disc' && (
                                    <text x={x} y={captionAbove ? captionY - 15 : captionY + 15} textAnchor="middle" className="rm-node-species">
                                        {species}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Ticket 17: the stake ring and the ambush tint, explained once, and only when there is one. */}
            {hasStakes && (
                <div className="rm-legend">
                    <span className="rm-legend-stakes">
                        a <strong>violet ring</strong> is a Totem at stake — win the fight, keep the Totem for the run;
                        a red <strong>ambush</strong> outnumbers you and pays one as a bonus
                    </span>
                </div>
            )}

            {/*
              * The keyboard and screen-reader surface. Not a fallback for the picture — it is the
              * primary control, and the SVG is the illustration of it. Only the roads that lead
              * forward from where you stand are offered, because that is all you can walk.
              */}
            <nav className="rm-travel sr-only" aria-label="Travel">
                <h3 className="rm-travel-head">Travel</h3>
                <ul className="rm-travel-list">
                    {reachable.map((laid) => (
                        <li key={laid.node.id}>
                            <button type="button" className="rm-travel-button" onClick={() => onTravel(laid.node)}>
                                <span aria-hidden="true" className="rm-travel-icon">
                                    <Icon name={nodeIconFor(laid.node)} size={15} />
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
