/**
 * A 2D CONTEXT FOR JSDOM — ticket 146a.
 *
 * jsdom does not implement `<canvas>`, and `getContext('2d')` both returns `null` and prints
 * *"Not implemented: HTMLCanvasElement's getContext() method"* through `console.error`. The second
 * half is what forced this file: `interaction.tsx` fails any test that writes to `console.error`,
 * so the moment `BattleStage` grew a particle canvas, four `App.loop` tests went red over a message
 * about a capability none of them care about.
 *
 * # WHY A STUB AND NOT THE `canvas` PACKAGE
 *
 * The real option is the `canvas` npm package, which gives jsdom a Cairo-backed surface. It is a
 * native build, it is tens of megabytes, and it would exist to render pixels that no assertion ever
 * reads — the particle layer's proof is a screenshot of a real browser, and its arithmetic is
 * covered by `vfx/particles.test.ts` with no DOM at all. Paying a native dependency for that is the
 * wrong trade.
 *
 * # WHY IT IS NOT SIMPLY `null`
 *
 * Returning `null` quietly would also silence the error, and `ParticleLayer` handles a null context
 * by doing nothing. But then the layer's effect, its resize path and its whole rAF loop would never
 * execute in ANY test, and the first time one of them threw, the place it surfaced would be a
 * browser. With this stub the loop actually runs during the interaction tests: it measures, spawns,
 * steps and draws, and a crash in any of that fails a test rather than a screenshot.
 *
 * The stub therefore records nothing and asserts nothing. It is a surface that accepts every call
 * the layer makes, which is exactly as much canvas as a headless test needs.
 */

/**
 * Every 2D method `particles.ts` and `ParticleLayer.tsx` reach for. Additions go here, loudly.
 *
 * A missing entry is a `TypeError` inside the rAF loop, which `interaction.tsx` reports as a failed
 * test — and that is the arrangement working, not a nuisance. `bezierCurveTo` was added exactly
 * that way: the flame silhouette started using it, `App.loop.test` went red the same run, and the
 * alternative was finding out from a blank canvas in a browser.
 */
const METHODS = [
    'setTransform', 'clearRect', 'fillRect', 'beginPath', 'closePath', 'arc', 'ellipse', 'fill',
    'stroke', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'save', 'restore',
    'translate', 'scale', 'rotate', 'drawImage',
] as const;

function makeContext(): CanvasRenderingContext2D {
    const ctx: Record<string, unknown> = {
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        fillStyle: '#000',
        strokeStyle: '#000',
        lineWidth: 1,
    };
    for (const name of METHODS) ctx[name] = () => undefined;
    // `createRadialGradient` is the one method whose RETURN is used — the ramp atlas calls
    // `addColorStop` on it — so a no-op would throw rather than do nothing.
    ctx.createRadialGradient = () => ({ addColorStop: () => undefined });
    return ctx as unknown as CanvasRenderingContext2D;
}

let installed = false;

/**
 * Give every canvas in this process a working-enough 2D context. Idempotent, and deliberately
 * global rather than per-test: a canvas created inside a React effect is not reachable from the
 * test that mounted it.
 */
export function installCanvasStub(): void {
    if (installed) return;
    if (typeof HTMLCanvasElement === 'undefined') return;
    installed = true;

    const context = makeContext();
    HTMLCanvasElement.prototype.getContext = function getContext(kind: string) {
        // Only '2d'. A test that asks for 'webgl' should still get the honest `null`, because
        // nothing in this app uses one and a silent success would hide that it had started to.
        return kind === '2d' ? context : null;
    } as HTMLCanvasElement['getContext'];
}
