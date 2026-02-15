
import { describe, it, vi } from 'vitest';
import { runSimulation } from './SimRunner';

describe('Headless Simulation', () => {
    it('should run a full game without crashing', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

        try {
            runSimulation();
            // If we get here, it didn't crash.
            // We can check if game over logic was reached
            const calls = consoleSpy.mock.calls.map(c => c.join(' '));
            const gameOver = calls.some(c => c.includes('=== Game Over ==='));
            if (!gameOver) {
                console.error("Game did not finish in max turns?");
            }
        } finally {
            consoleSpy.mockRestore();
        }
    });
});
