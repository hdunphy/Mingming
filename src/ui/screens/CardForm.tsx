import React, { useState } from 'react';
import type { ProgramData, Element, TargetType, ProgramCategory, ProgramAction, ProgramConstraint, Rarity } from '../../engine/types';
import { ELEMENTS, TARGET_TYPES, PROGRAM_CATEGORIES, RARITIES } from '../../engine/types';
import actionsLib from '../../engine/data/lib/actions.json';
import constraintsLib from '../../engine/data/lib/constraints.json';
import hooksLib from '../../engine/data/lib/hooks.json';
import './CardForm.css';

const ACTIONS_LIB = actionsLib as Record<string, any>;
const CONSTRAINTS_LIB = constraintsLib as Record<string, any>;
const AVAILABLE_HOOKS = Object.values(hooksLib as Record<string, any>).flatMap(root => root.hooks?.map((h: any) => h.id) || []);



interface CardFormProps {
    onSave: (card: ProgramData) => void;
    onCancel: () => void;
}

const CardForm: React.FC<CardFormProps> = ({ onSave, onCancel }) => {
    const [card, setCard] = useState<Partial<ProgramData>>({
        id: '',
        name: '',
        description: '',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        rarity: 'Common',
        baseCost: 1,
        actions: [],
        constraints: [],
        hooks: [],
        exhaust: false,
        isToken: false,
        artReference: ''
    });

    const handleChange = (field: keyof ProgramData, value: any) => {
        setCard(prev => ({ ...prev, [field]: value }));
    };

    const addAction = () => {
        const newActions = [...(card.actions || []), { type: 'ATTACK', target: 'TARGET' }];
        handleChange('actions', newActions);
    };

    const updateAction = (index: number, updates: Partial<ProgramAction>) => {
        const newActions = [...(card.actions || [])];
        newActions[index] = { ...newActions[index], ...updates };
        handleChange('actions', newActions);
    };

    const removeAction = (index: number) => {
        const newActions = card.actions?.filter((_, i) => i !== index);
        handleChange('actions', newActions);
    };

    const addConstraint = () => {
        const newConstraints = [...(card.constraints || []), { type: 'BASE' as any, target: 'SELF', value: '' }];
        handleChange('constraints', newConstraints);
    };

    const updateConstraint = (index: number, updates: Partial<ProgramConstraint>) => {
        const newConstraints = [...(card.constraints || [])];
        newConstraints[index] = { ...newConstraints[index], ...updates };
        handleChange('constraints', newConstraints);
    };

    const removeConstraint = (index: number) => {
        const newConstraints = card.constraints?.filter((_, i) => i !== index);
        handleChange('constraints', newConstraints);
    };

    const addHook = () => {
        const newHooks = [...(card.hooks || []), ''];
        handleChange('hooks', newHooks);
    };

    const updateHook = (index: number, value: string) => {
        const newHooks = [...(card.hooks || [])];
        newHooks[index] = value;
        handleChange('hooks', newHooks);
    };

    const removeHook = (index: number) => {
        const newHooks = card.hooks?.filter((_, i) => i !== index);
        handleChange('hooks', newHooks);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(card as ProgramData);
    };

    return (
        <div className="card-form-overlay">
            <div className="card-form-container">
                <header className="form-header">
                    <h2>NEW PROGRAM INITIALIZATION</h2>
                    <button className="close-btn" onClick={onCancel}>&times;</button>
                </header>

                <form onSubmit={handleSubmit} className="actual-form">
                    <div className="form-grid">
                        <section className="basic-info">
                            <div className="form-group">
                                <label>Program ID</label>
                                <input
                                    type="text"
                                    placeholder="e.g. thunder_strike"
                                    value={card.id}
                                    onChange={e => handleChange('id', e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Thunder Strike"
                                    value={card.name}
                                    onChange={e => handleChange('name', e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    placeholder="Description of the effect..."
                                    value={card.description}
                                    onChange={e => handleChange('description', e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Element</label>
                                    <select value={card.element} onChange={e => handleChange('element', e.target.value)}>
                                        {ELEMENTS.map(el => <option key={el} value={el}>{el}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Cost</label>
                                    <input
                                        type="number"
                                        value={card.baseCost}
                                        onChange={e => handleChange('baseCost', parseInt(e.target.value))}
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Category</label>
                                    <select value={card.category} onChange={e => handleChange('category', e.target.value)}>
                                        {PROGRAM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Target Type</label>
                                    <select value={card.target} onChange={e => handleChange('target', e.target.value)}>
                                        {TARGET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Rarity</label>
                                    <select value={card.rarity} onChange={e => handleChange('rarity', e.target.value)}>
                                        {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div className="form-group checkbox-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={card.exhaust}
                                            onChange={e => handleChange('exhaust', e.target.checked)}
                                        />
                                        Exhaust
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={card.isToken}
                                            onChange={e => handleChange('isToken', e.target.checked)}
                                        />
                                        Token
                                    </label>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Art Reference (Path)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. assets/cards/card_art.png"
                                    value={card.artReference || ''}
                                    onChange={e => handleChange('artReference', e.target.value)}
                                />
                            </div>
                        </section>

                        <section className="actions-constraints">
                            <div className="section-header">
                                <h3>Actions</h3>
                                <button type="button" className="add-btn" onClick={addAction}>+ Add Action</button>
                            </div>
                            <div className="list-container">
                                {card.actions?.map((action, i) => (
                                    <div key={i} className="list-item">
                                        <div className="item-row">
                                            <select
                                                value={action.id || ''}
                                                onChange={e => {
                                                    const id = e.target.value;
                                                    if (id === '') {
                                                        const { id: _, ...rest } = action;
                                                        updateAction(i, { ...rest, id: undefined });
                                                    } else {
                                                        updateAction(i, { id });
                                                    }
                                                }}
                                            >
                                                <option value="">(Custom Action)</option>
                                                {Object.keys(ACTIONS_LIB).map(id => <option key={id} value={id}>{id}</option>)}
                                            </select>
                                            <button type="button" className="delete-btn" onClick={() => removeAction(i)}>&times;</button>
                                        </div>
                                        {!action.id && (
                                            <div className="inline-fields">
                                                <input
                                                    type="text"
                                                    placeholder="Type"
                                                    value={action.type}
                                                    onChange={e => updateAction(i, { type: e.target.value as any })}
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="Power"
                                                    value={action.power || ''}
                                                    onChange={e => updateAction(i, { power: parseInt(e.target.value) })}
                                                />
                                            </div>
                                        )}
                                        {action.id && (
                                            <div className="override-fields">
                                                <input
                                                    type="number"
                                                    placeholder="Override Power..."
                                                    onChange={e => updateAction(i, { power: parseInt(e.target.value) })}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="section-header" style={{ marginTop: '1.5rem' }}>
                                <h3>Constraints</h3>
                                <button type="button" className="add-btn" onClick={addConstraint}>+ Add Constraint</button>
                            </div>
                            <div className="list-container">
                                {card.constraints?.map((c, i) => (
                                    <div key={i} className="list-item">
                                        <div className="item-row">
                                            <select
                                                value={c.id || ''}
                                                onChange={e => {
                                                    const id = e.target.value;
                                                    if (id === '') {
                                                        const { id: _, ...rest } = c;
                                                        updateConstraint(i, { ...rest, id: undefined });
                                                    } else {
                                                        updateConstraint(i, { id });
                                                    }
                                                }}
                                            >
                                                <option value="">(Custom Constraint)</option>
                                                {Object.keys(CONSTRAINTS_LIB).map(id => <option key={id} value={id}>{id}</option>)}
                                            </select>
                                            <button type="button" className="delete-btn" onClick={() => removeConstraint(i)}>&times;</button>
                                        </div>
                                        {!c.id && (
                                            <div className="inline-fields">
                                                <select value={c.type} onChange={e => updateConstraint(i, { type: e.target.value as any })}>
                                                    <option value="HAS_STATUS">HAS_STATUS</option>
                                                    <option value="NOT_STATUS">NOT_STATUS</option>
                                                    <option value="HEALTH_THRESHOLD">HEALTH</option>
                                                    <option value="BASE">BASE</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    placeholder="Value"
                                                    value={c.value}
                                                    onChange={e => updateConstraint(i, { value: e.target.value })}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="section-header" style={{ marginTop: '1.5rem' }}>
                                <h3>Daemon Hooks</h3>
                                <button type="button" className="add-btn" onClick={addHook}>+ Add Hook</button>
                            </div>
                            <datalist id="available-hooks">
                                {AVAILABLE_HOOKS.map(h => <option key={h} value={h} />)}
                            </datalist>
                            <div className="list-container">
                                {card.hooks?.map((hook, i) => (
                                    <div key={i} className="item-row">
                                        <input
                                            type="text"
                                            list="available-hooks"
                                            placeholder="Hook ID (e.g. recursion_daemon_hook)"
                                            value={hook}
                                            onChange={e => updateHook(i, e.target.value)}
                                        />
                                        <button type="button" className="delete-btn" onClick={() => removeHook(i)}>&times;</button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <footer className="form-footer">
                        <button type="button" className="cancel-btn" onClick={onCancel}>ABORT</button>
                        <button type="submit" className="save-btn">INITIALIZE PROGRAM</button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default CardForm;
