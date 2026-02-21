/**
 * Epic 3: Save System with Zod Validation
 * Handles save/load to localStorage with schema validation.
 */

import { z } from 'zod';
import type { IPlayerSave } from './gameTypes';

const SAVE_KEY = 'mingming_save';

// --- Zod Schemas ---

const MingmingInstanceSchema = z.object({
    id: z.string(),
    definitionId: z.string(),
    nickname: z.string().optional(),
    level: z.number().int().min(1),
    experience: z.number().int().min(0),
    activeOS: z.string().optional(),
    blueprintsCollected: z.number().int().min(0),
    attackIV: z.number().int().min(0).max(31),
    defenseIV: z.number().int().min(0).max(31),
    hpIV: z.number().int().min(0).max(31),
});

const OwnedProgramSchema = z.object({
    instanceId: z.string(),
    dataId: z.string(),
});

const ActiveDeckSchema = z.object({
    id: z.string(),
    name: z.string(),
    cards: z.array(z.string()),
});

const BlueprintSchema = z.object({
    architectureId: z.string(),
    name: z.string(),
    compileCost: z.number().int().min(0),
});

const GauntletStateSchema = z.object({
    type: z.enum(['Gym', 'Sector']),
    element: z.string(),
    currentBattleIndex: z.number(),
    totalBattles: z.number(),
    persistedStats: z.record(z.string(), z.object({
        hp: z.number(),
        energy: z.number()
    }))
});

export const PlayerSaveSchema = z.object({
    version: z.number().int().min(1),
    roster: z.array(MingmingInstanceSchema),
    activeParty: z.array(z.string()).max(3),
    cardInventory: z.array(OwnedProgramSchema),
    activeDeck: ActiveDeckSchema.nullable(),
    scrapCount: z.number().int().min(0),
    blueprints: z.array(BlueprintSchema),
    relics: z.array(z.string()).catch([]),
    gauntlet: GauntletStateSchema.nullable().catch(null),
    unlockedSectors: z.array(z.string()).catch([])
});

// --- Save/Load Functions ---

export function saveGame(state: IPlayerSave): { success: boolean; error?: string } {
    try {
        // Validate before saving
        PlayerSaveSchema.parse(state);
        const json = JSON.stringify(state);
        localStorage.setItem(SAVE_KEY, json);
        return { success: true };
    } catch (err) {
        if (err instanceof z.ZodError) {
            const messages = (err as any).issues.map((e: any) =>
                `[${e.path.join('.')}] ${e.message}`
            ).join('\n');
            console.error('Save validation failed:\n' + messages);
            return { success: false, error: messages };
        }
        return { success: false, error: String(err) };
    }
}

export function loadGame(): { data: IPlayerSave | null; error?: string } {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return { data: null };

        const parsed = JSON.parse(raw);
        const validated = PlayerSaveSchema.parse(parsed);
        return { data: validated as IPlayerSave };
    } catch (err) {
        if (err instanceof z.ZodError) {
            const messages = (err as any).issues.map((e: any) =>
                `[${e.path.join('.')}] ${e.message}`
            ).join('\n');
            console.error('Load validation failed:\n' + messages);
            return { data: null, error: messages };
        }
        if (err instanceof SyntaxError) {
            console.error('Corrupted save data (invalid JSON)');
            return { data: null, error: 'Corrupted save data (invalid JSON)' };
        }
        return { data: null, error: String(err) };
    }
}

export function deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
}

export function hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
}
