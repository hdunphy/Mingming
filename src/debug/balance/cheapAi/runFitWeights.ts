/**
 * Entry point for the weight fit — ticket 177c.
 *
 *   npx vite-node src/debug/balance/cheapAi/runFitWeights.ts
 *   npx vite-node src/debug/balance/cheapAi/runFitWeights.ts -- --dry          # print, do not write
 *   npx vite-node src/debug/balance/cheapAi/runFitWeights.ts -- --dir results/cheap-ai --out src/engine/ai/cheap/weights.json
 */
import { DEFAULT_OUT_DIR } from './recordTeacher';
import { DEFAULT_WEIGHTS_PATH, fitFromDir } from './fitWeights';

const argv = process.argv.slice(2);
const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
};

fitFromDir(get('--dir') ?? DEFAULT_OUT_DIR, get('--out') ?? DEFAULT_WEIGHTS_PATH, !argv.includes('--dry'));
