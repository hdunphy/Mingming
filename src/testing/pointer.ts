/**
 * A pointer event with coordinates, through React's delegation — for tests of things that follow the
 * mouse (ticket 167f's card tooltip). `interaction.fire` takes a plain `EventInit`, which has no
 * `clientX`, so this is the one place a test can say where the pointer is.
 */
import { act } from 'react';

export async function fireAt(
    target: Element,
    type: 'mouseover' | 'mousemove' | 'mouseout',
    clientX: number,
    clientY: number,
): Promise<void> {
    await act(async () => {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY }));
    });
}
