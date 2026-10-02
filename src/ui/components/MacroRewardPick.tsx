import React from 'react';
import { getMacro } from '../../engine/data/macroRegistry';
import { plain } from '../labels/labels';

export interface MacroRewardPickProps {
    readonly choices: ReadonlyArray<string>;          // bundle.macroChoices
    readonly rack: ReadonlyArray<string | null>;     // run.macros
    readonly value: { macroId: string; replaceSlot?: number } | null;
    readonly onChange: (value: { macroId: string; replaceSlot?: number } | null) => void;
}

export const MacroRewardPick: React.FC<MacroRewardPickProps> = ({
    choices,
    rack,
    value,
    onChange,
}) => {
    if (!choices || choices.length === 0) return null;

    const isRackFull = !rack.some((slot) => slot === null);
    const selectedMacroId = value?.macroId ?? null;

    const handleChoiceClick = (macroId: string) => {
        if (selectedMacroId === macroId) {
            onChange(null);
        } else {
            onChange({ macroId });
        }
    };

    const handleDropClick = (slotIndex: number) => {
        if (!selectedMacroId) return;
        onChange({ macroId: selectedMacroId, replaceSlot: slotIndex });
    };

    return (
        <div
            style={{
                padding: '12px 14px',
                background: 'rgba(0, 210, 255, 0.08)',
                borderRadius: '8px',
                border: '1px solid rgba(0, 210, 255, 0.4)',
            }}
        >
            <div
                style={{
                    fontSize: '0.75rem',
                    color: 'var(--panel-edge)',
                    fontWeight: 'bold',
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                }}
            >
                DRAUGHT — TAKE ONE
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-mute)', marginBottom: '10px' }}>
                Optional. Single use, fired from the rack in a fight.
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '10px',
                }}
            >
                {choices.map((macroId) => {
                    const macro = getMacro(macroId);
                    const isSelected = selectedMacroId === macroId;
                    return (
                        <button
                            key={macroId}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => handleChoiceClick(macroId)}
                            style={{
                                textAlign: 'left',
                                padding: '12px',
                                background: isSelected ? 'rgba(0, 210, 255, 0.25)' : 'rgba(0, 0, 0, 0.4)',
                                border: `2px solid ${isSelected ? 'var(--panel-edge)' : 'rgba(255, 255, 255, 0.1)'}`,
                                borderRadius: '8px',
                                cursor: 'pointer',
                                color: 'inherit',
                                font: 'inherit',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ color: 'var(--text)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                    {macro?.name ?? macroId}
                                </div>
                                {macro?.rarity && (
                                    <div style={{ color: 'var(--panel-edge)', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                        {macro.rarity}
                                    </div>
                                )}
                            </div>
                            <div style={{ color: 'var(--text-mute)', fontSize: '0.72rem', lineHeight: '1.4', marginTop: '6px' }}>
                                {plain(macro?.description)}
                            </div>
                        </button>
                    );
                })}
            </div>

            {isRackFull && selectedMacroId && (
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--amber)', fontWeight: 'bold', marginBottom: '4px' }}>
                        Your rack is full — drop one to make room:
                    </div>
                    {value?.replaceSlot === undefined && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-mute)', marginBottom: '8px' }}>
                            Nothing is dropped unless you pick one; the new draught is left behind.
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {rack.map((heldId, index) => {
                            if (!heldId) return null;
                            const heldMacro = getMacro(heldId);
                            const isChosenDrop = value?.replaceSlot === index;
                            return (
                                <button
                                    key={index}
                                    type="button"
                                    aria-pressed={isChosenDrop}
                                    onClick={() => handleDropClick(index)}
                                    style={{
                                        padding: '8px 12px',
                                        background: isChosenDrop ? 'rgba(255, 75, 75, 0.25)' : 'rgba(0, 0, 0, 0.4)',
                                        border: `2px solid ${isChosenDrop ? 'var(--hp-low)' : 'rgba(255, 255, 255, 0.1)'}`,
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        color: isChosenDrop ? 'var(--hp-low)' : 'var(--text)',
                                        fontWeight: 'bold',
                                        fontSize: '0.8rem',
                                    }}
                                >
                                    {heldMacro?.name ?? heldId}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
