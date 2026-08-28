import { describe, it, expect } from 'vitest';
import { GetProgramData, InternalTestRegistry } from './programRegistry';

describe('ProgramRegistry Inflation', () => {
    it('should inflate a basic attack from the library', () => {
        // Create a mock card that uses library IDs
        const mockId = 'inflation_test_1';
        (InternalTestRegistry as any)[mockId] = {
            id: mockId,
            name: 'Inflation Test',
            actions: [{ id: 'basic_attack' }],
            constraints: [{ id: 'not_stunned' }]
        };

        const data = GetProgramData(mockId);

        // Verify action inflation
        expect(data.actions[0].type).toBe('ATTACK');
        expect(data.actions[0].power).toBe(10);
        expect(data.actions[0].target).toBe('TARGET');

        // Verify constraint inflation
        expect(data.constraints[0].type).toBe('NOT_STATUS');
        expect(data.constraints[0].value).toBe('Stunned');
    });

    it('should allow overriding library values', () => {
        const mockId = 'inflation_test_2';
        (InternalTestRegistry as any)[mockId] = {
            id: mockId,
            name: 'Override Test',
            actions: [{ id: 'basic_attack', power: 50 }], // Overriding power
            constraints: [{ id: 'energy_base' }]
        };

        const data = GetProgramData(mockId);

        expect(data.actions[0].type).toBe('ATTACK');
        expect(data.actions[0].power).toBe(50); // Should be 50, not 10 from library
    });

    it('should inflate nested conditionals', () => {
        const mockId = 'inflation_test_3';
        (InternalTestRegistry as any)[mockId] = {
            id: mockId,
            name: 'Nested Test',
            actions: [{
                id: 'draw_card',
                conditionals: [{ id: 'target_burned' }]
            }]
        };

        const data = GetProgramData(mockId);

        expect(data.actions[0].type).toBe('DRAW');
        expect(data.actions[0].conditionals![0].type).toBe('HAS_STATUS');
        expect(data.actions[0].conditionals![0].value).toBe('Burn');
    });

    it('should log an error and return error property if action ID is missing', () => {
        const mockId = 'error_test_1';
        (InternalTestRegistry as any)[mockId] = {
            id: mockId,
            name: 'Error Test Action',
            actions: [{ id: 'non_existent_action' }]
        };

        const data = GetProgramData(mockId);
        expect(data.actions[0].error).toContain('Missing action: non_existent_action');
    });

    it('should log an error and return error property if constraint ID is missing', () => {
        const mockId = 'error_test_2';
        (InternalTestRegistry as any)[mockId] = {
            id: mockId,
            name: 'Error Test Constraint',
            constraints: [{ id: 'non_existent_constraint' }]
        };

        const data = GetProgramData(mockId);
        expect(data.constraints[0].error).toContain('Missing constraint: non_existent_constraint');
    });

    it('should load feedback_token from programs.json', () => {
        const data = GetProgramData('feedback_token');
        console.log("Feedback Token Data:", data);
        expect(data.id).toBe('feedback_token');
        expect(data.name).toBe('Feedback');
    });
});
