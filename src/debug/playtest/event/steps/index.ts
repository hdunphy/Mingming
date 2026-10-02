/** TICKET 180c — which step an outcome is, as `EventPickStep` switches on it. */
import type { Section } from '../../types';
import { cardPickStep } from './cardPickStep';
import { cardRowsStep } from './cardRowsStep';
import { blueprintPickStep, driverPickStep, giveBlueprintStep, patchStep, recruitStep, reflashStep } from './grantSteps';
import { macroPickStep } from './macroStep';
import type { StepInput } from './stepInput';

export function stepSection(input: StepInput): Section {
    const { outcome } = input;
    switch (outcome.type) {
        case 'CARD_PICK': return cardPickStep(input);
        case 'BLUEPRINT_PICK': return blueprintPickStep(input);
        case 'MACRO_PICK': return macroPickStep(input);
        case 'RECRUIT': return recruitStep(input);
        case 'GIVE_CARD': return cardRowsStep(input, 'give', outcome.count, outcome.rarity);
        case 'TRADE_UP': return cardRowsStep(input, 'trade', 1);
        case 'TRANSFORM': return cardRowsStep(input, 'recompile', 1);
        case 'DUPLICATE': return cardRowsStep(input, 'copy', 1);
        case 'GIVE_BLUEPRINT': return giveBlueprintStep(input);
        case 'DRIVER_PICK': return driverPickStep(input);
        case 'PATCH': return patchStep(input);
        case 'REFLASH': return reflashStep(input);
        default: return { lines: [], moves: [] };
    }
}
