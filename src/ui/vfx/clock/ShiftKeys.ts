/**
 * THE TWO SHIFT KEYS — ticket 190a. Henry, 2026-10-03: *"Make it the right shift button and left
 * shift does the targeting."*
 *
 * Shift was already the ally-targeting modifier (Shift+W/E/R, and Shift+Tab to cycle back). Holding
 * a Shift to fast-forward would have sped the screen up every time a heal was aimed. The browser
 * tells the two keys apart with `KeyboardEvent.code`, so:
 *
 * - **Right Shift** held = fast-forward (x3, see the speed policy);
 * - **Left Shift** = the ally modifier, as before.
 *
 * `shiftKey` alone is true for either, so this remembers which was pressed. It is deliberately
 * forgiving about what it did not see: if no Shift went down while this was listening (focus
 * arrived with Shift already held, or a test sends a bare `shiftKey`) the event's own `shiftKey`
 * counts as the ally modifier, which is what every caller did before.
 */

interface KeyLike {
    readonly code: string;
}
interface ShiftLike {
    readonly shiftKey: boolean;
}

export const LEFT_SHIFT_CODE = 'ShiftLeft';
export const RIGHT_SHIFT_CODE = 'ShiftRight';

export class ShiftKeys {
    private left = false;
    private right = false;

    /** `onFastForward` is told every time the held state of the fast-forward key changes. */
    constructor(private readonly onFastForward: (held: boolean) => void) {}

    get fastForwardHeld(): boolean {
        return this.right;
    }

    keyDown(event: KeyLike): void {
        if (event.code === LEFT_SHIFT_CODE) this.left = true;
        else if (event.code === RIGHT_SHIFT_CODE && !this.right) {
            this.right = true;
            this.onFastForward(true);
        }
    }

    keyUp(event: KeyLike): void {
        if (event.code === LEFT_SHIFT_CODE) this.left = false;
        else if (event.code === RIGHT_SHIFT_CODE && this.right) {
            this.right = false;
            this.onFastForward(false);
        }
    }

    /** Window blur or unmount: a key released outside the window never sends its keyup. */
    reset(): void {
        this.left = false;
        if (this.right) {
            this.right = false;
            this.onFastForward(false);
        }
    }

    /** Is this keypress's Shift the ally-targeting one? */
    isAllyModifier(event: ShiftLike): boolean {
        if (!event.shiftKey) return false;
        // Only Right Shift is known to be down: that one is fast-forward, not targeting.
        return !(this.right && !this.left);
    }
}
