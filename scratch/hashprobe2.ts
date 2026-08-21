/** Is FIRMWARE_REGISTRY populated at the moment cellCache reads it? */
import { FIRMWARE_REGISTRY } from '../src/engine/data/firmwareRegistry';
console.error('BEFORE any getOSBehavior call:');
console.error('  FIRMWARE_REGISTRY keys:', Object.keys(FIRMWARE_REGISTRY).length);
console.error('  sleipnir_v1 =', JSON.stringify(FIRMWARE_REGISTRY['sleipnir_v1'] ?? null).slice(0, 60));
const { getOSBehavior } = await import('../src/engine/data/firmwareRegistry');
getOSBehavior('sleipnir_v1');
console.error('AFTER getOSBehavior:');
console.error('  FIRMWARE_REGISTRY keys:', Object.keys(FIRMWARE_REGISTRY).length);
