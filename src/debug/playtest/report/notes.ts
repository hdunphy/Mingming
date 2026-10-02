/**
 * TICKET 180f — SORTING THE AGENT'S NOTES: by card, Mingming, event, or the screen it was on.
 *
 * A note is free text. It is filed under the first thing from the game's own registries that its
 * text names (a card, then a Mingming species, then an event), and otherwise under the screen the
 * agent was on. The names come from the registries, never from a list written here, so a rename in
 * the game follows by itself.
 */
import { MingmingRegistry } from '../../../engine/data/mingmingRegistry';
import { ProgramRegistry } from '../../../engine/data/programRegistry';
import { EVENTS } from '../../../engine/run/events/eventCatalogue';
import type { NoteFact } from './facts';

export interface NoteGroup {
    readonly label: string;
    readonly notes: ReadonlyArray<string>;
}

let namesCache: ReadonlyArray<{ readonly kind: string; readonly name: string }> | null = null;

/** Longest names first, so "Glass Cannon" is found before a shorter name inside it. */
function knownNames(): ReadonlyArray<{ readonly kind: string; readonly name: string }> {
    if (namesCache) return namesCache;
    const all = [
        ...Object.values(ProgramRegistry).map((c) => ({ kind: 'card', name: c.name ?? '' })),
        ...Object.values(MingmingRegistry).map((m) => ({ kind: 'Mingming', name: m.name ?? '' })),
        ...EVENTS.map((e) => ({ kind: 'event', name: e.name })),
    ].filter((n) => n.name.length >= 4);
    namesCache = all.sort((a, b) => b.name.length - a.name.length);
    return namesCache;
}

const KIND_ORDER = ['card', 'Mingming', 'event'];

export function labelFor(note: NoteFact): string {
    const text = note.text.toLowerCase();
    for (const kind of KIND_ORDER) {
        const hit = knownNames().find((n) => n.kind === kind && text.includes(n.name.toLowerCase()));
        if (hit) return `${kind}: ${hit.name}`;
    }
    return `screen: ${note.screen}`;
}

export function groupNotes(notes: ReadonlyArray<NoteFact>): NoteGroup[] {
    const groups = new Map<string, string[]>();
    for (const note of notes) {
        const label = labelFor(note);
        groups.set(label, [...(groups.get(label) ?? []), note.text]);
    }
    return [...groups.entries()]
        .map(([label, texts]) => ({ label, notes: texts }))
        .sort((a, b) => b.notes.length - a.notes.length || (a.label < b.label ? -1 : 1));
}
