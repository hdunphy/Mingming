/**
 * OS AND DAEMON TELLS — ticket 146g.
 *
 * Ruling 8: *"OS should have some unique VFX for each effect to help with the trigger."* The
 * complaint underneath it is specific: an OS fires, something changes — a card gets cheaper, a unit
 * takes extra damage — and the player has no way to attribute the change to the thing that caused
 * it. The combat log says so in prose, which is the same "look away and read" problem the played-
 * card reveal was built to fix.
 *
 * # TWO LAYERS, SO NOTHING SHIPS WITHOUT A TELL
 *
 * §2g: a **family default** for every OS and daemon, and an authored **signature** for the twelve
 * that have one. The roster is 51 firmware entries; authoring 51 tells before any of them works is
 * how a row like this stalls, and shipping twelve and nothing else would mean thirty-nine OSes that
 * silently do things. The default answers "why did that happen" on its own — the owner's chip
 * flashes and a puff in its element leaves its sprite — and a signature makes it specific.
 *
 * The signatures are DATA, in `hooks.json`. See `OSDefinition.vfx` for why.
 */

import { getOSBehavior, type OSVfx, type OSVfxShape } from '../../engine/data/firmwareRegistry';
import { GetProgramData } from '../../engine/data/programRegistry';
import { getElementAccent } from '../utils/contrastText';
import type { IBattleEntity } from '../../engine/types';
import { anchorFor, emit, plaqueFor, type EmitAt } from './emit';

interface Rgb { r: number; g: number; b: number }

const hexToRgb = (hex: string): Rgb | null => {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) return null;
    const n = parseInt(match[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

const FALLBACK: Rgb = { r: 200, g: 205, b: 212 };

/**
 * The chip flash, as a DOM signal rather than React state.
 *
 * The alternative is a piece of state per unit lifted to `BattleArena` and threaded back down
 * through the stage to the plaque, re-rendering six plaques to flash one chip — for an effect that
 * lasts 300ms and cannot affect anything. A class toggle touches the one element that changes.
 *
 * `data-os-flash` rather than a class so the stylesheet's own naming stays with the component.
 */
function flashChip(ownerId: string): void {
    if (typeof document === 'undefined') return;
    const chip = document.querySelector<HTMLElement>(`[data-os-chip="${ownerId}"]`);
    if (!chip) return;
    chip.removeAttribute('data-os-flash');
    // Force a reflow so a second trigger inside the animation restarts it rather than being
    // swallowed — an OS that fires twice in a turn must flash twice.
    void chip.offsetWidth;
    chip.setAttribute('data-os-flash', 'on');
    window.setTimeout(() => chip.removeAttribute('data-os-flash'), 320);
}

/**
 * Play one signature shape. Each is spelled out of 146a's particle vocabulary — §2g's list is a
 * vocabulary of MOTIONS, not of new particles, which is what keeps twelve tells from becoming
 * twelve rendering paths.
 */
function playShape(shape: OSVfxShape, color: Rgb, owner: EmitAt, target: EmitAt | null): void {
    switch (shape) {
        case 'pulse':
            // One ring on the owner. The quietest tell there is, for an OS that did something to
            // itself (OUROBOROS closing a loop on the draw).
            emit('ring', owner, { color, intensity: 1 });
            return;
        case 'rise':
            // Motes going up off the owner — a gain. TREACHERY_KERNEL's Strengthened, GOSSIP_NODE's
            // heal on the ally.
            emit('puff', owner, { color, intensity: 7 });
            return;
        case 'arc':
            // Owner to target: this OS reached out and did something to somebody. ALLURE_PROXY's
            // mirrored hex, INSTIGATOR passing Dazed on.
            if (target) emit('streak', owner, { color, toward: target, intensity: 1 });
            else emit('puff', owner, { color, intensity: 5 });
            return;
        case 'drain':
            // The same arc, backwards — TOXIN_FANG pulls off the bitten. Direction IS the meaning
            // here, which is why `at` exists in the data at all.
            if (target) emit('streak', target, { color, toward: owner, intensity: 1 });
            else emit('puff', owner, { color, intensity: 5 });
            return;
        case 'crack':
            // A ring that shatters: something BROKE. BARK_SHIELD failing, REBIRTH_CYCLE's reshuffle.
            emit('ring', owner, { color, intensity: 1 });
            emit('spark', owner, { color, intensity: 10 });
            return;
        case 'swirl':
            // Particles around the owner rather than off it — ABYSSAL_INK's Dazed cloud.
            emit('puff', owner, { color, intensity: 9 });
            return;
        case 'spark':
            // A burst, for an OS whose effect is a hit (UNBOUND_KERNEL's free attack).
            emit('spark', owner, { color, intensity: 12 });
            return;
        case 'ring':
        default:
            emit('ring', owner, { color, intensity: 1 });
    }
}

/**
 * THE FAMILY DEFAULT — §2g: *"the owner's plaque firmware chip flashes in the element colour, a
 * `puff` in that colour leaves the owner's sprite, and the combat-log line the top bar shows is the
 * trigger text. That alone answers 'why did that happen'."*
 *
 * The log line is already the top bar's; this supplies the other two.
 */
function playDefault(owner: IBattleEntity, at: EmitAt): void {
    const color = hexToRgb(getElementAccent(owner.primaryElement)) ?? FALLBACK;
    emit('puff', at, { color, intensity: 5 });
}

/**
 * A hook fired. Called from the `HOOK_FIRED` subscription with whatever the event carried.
 *
 * `daemonId` takes the daemon's card colour per §2g, which is the right read: a daemon is a program
 * the player installed, and its tell should look like the card it came from rather than like the
 * unit hosting it.
 */
export function emitHookTell(
    owner: IBattleEntity | undefined,
    osId: string | undefined,
    daemonId: string | undefined,
    targetId: string | undefined,
): void {
    if (!owner) return;
    const at = anchorFor(owner.id);
    if (!at) return;

    // The chip flash is the half of the family default that happens on EVERY tell, authored or
    // not — it is what ties whatever just played to the OS that did it.
    flashChip(owner.id);

    const signature: OSVfx | undefined = osId ? getOSBehavior(osId)?.vfx : undefined;
    if (!signature) {
        if (daemonId) {
            const data = GetProgramData(daemonId);
            const color = hexToRgb(getElementAccent(data.element ?? 'None')) ?? FALLBACK;
            emit('puff', at, { color, intensity: 5 });
            return;
        }
        playDefault(owner, at);
        return;
    }

    const color = (signature.color ? hexToRgb(signature.color) : null)
        ?? hexToRgb(getElementAccent(owner.primaryElement))
        ?? FALLBACK;

    const other = targetId ? anchorFor(targetId) : null;
    const plaque = plaqueFor(owner.id);

    switch (signature.at) {
        case 'target':
            playShape(signature.shape, color, other ?? at, at);
            return;
        case 'owner-to-target':
            playShape(signature.shape, color, at, other);
            return;
        case 'target-to-owner':
            playShape(signature.shape, color, at, other);
            return;
        default:
            // `owner`, and the default when the data says nothing. The plaque is used for `pulse`
            // only: a ring on the chip reads as "this OS", where a ring on the body reads as
            // something happening to the unit.
            playShape(signature.shape, color, signature.shape === 'pulse' ? (plaque ?? at) : at, other);
    }
}
