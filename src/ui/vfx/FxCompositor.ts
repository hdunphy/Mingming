/**
 * TICKET 198b-1 — WHY THE LAB'S LIGHT WORKS ON A LIGHT STAGE.
 *
 * The lab draws its light additively (`lighter`) over a dark navy stage: where a hundred flame
 * particles overlap, the sums run up through orange and yellow to white, which is the hot core of
 * its flame column. The game's stages are sand and pale grey-blue, and additive light over a
 * near-white backdrop adds nothing (white plus anything is white), which is why 190 switched the
 * blending to ordinary and 194k-3 then put a dark rim round everything to get contrast back. Both
 * were answers to the stage; neither looked like the lab.
 *
 * The answer that keeps the lab's look is to separate the two blends. Each frame the effects are
 * drawn exactly as the lab draws them — additive among THEMSELVES — onto this transparent offscreen
 * canvas, so overlaps still sum to white. The finished picture is then laid over the stage in
 * ORDINARY blending, like a sprite: its dense parts cover the backdrop and its thin edges blend into
 * it, on sand or on navy alike. Over a dark stage the result is the lab's to within a rounding.
 *
 * One `drawImage` of a stage-sized bitmap per frame, which is well inside the budget the layer
 * measured for 146a. If a context cannot be had (a headless test), the effects draw straight onto
 * the layer's own context, as before.
 */

export type DrawFx = (ctx: CanvasRenderingContext2D) => void;

export class FxCompositor {
    private readonly offscreen: HTMLCanvasElement | null;
    private readonly fx: CanvasRenderingContext2D | null;
    private cssW = 1;
    private cssH = 1;

    constructor(private readonly stage: CanvasRenderingContext2D) {
        const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
        this.offscreen = canvas;
        this.fx = canvas?.getContext('2d') ?? null;
    }

    /** Has its own canvas (false means the effects draw straight onto the stage context). */
    get offscreenReady(): boolean {
        return this.fx !== null;
    }

    /** Match the layer's canvas: `ratio` is the device pixel ratio the stage context is scaled by. */
    resize(cssW: number, cssH: number, ratio: number): void {
        this.cssW = cssW;
        this.cssH = cssH;
        if (!this.offscreen || !this.fx) return;
        this.offscreen.width = Math.max(1, Math.round(cssW * ratio));
        this.offscreen.height = Math.max(1, Math.round(cssH * ratio));
        this.fx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    /** Clear, let `draw` paint the frame additively, then lay it over the stage. */
    frame(draw: DrawFx): void {
        const { stage } = this;
        stage.clearRect(0, 0, this.cssW, this.cssH);
        if (!this.offscreen || !this.fx) {
            draw(stage);
            return;
        }
        this.fx.clearRect(0, 0, this.cssW, this.cssH);
        draw(this.fx);
        this.fx.globalAlpha = 1;
        this.fx.globalCompositeOperation = 'source-over';
        stage.globalCompositeOperation = 'source-over';
        stage.globalAlpha = 1;
        // Device pixels to device pixels: both canvases carry the same ratio, so draw it unscaled.
        stage.save();
        stage.setTransform(1, 0, 0, 1, 0, 0);
        stage.drawImage(this.offscreen, 0, 0);
        stage.restore();
    }
}
