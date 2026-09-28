import { getBestAction } from '../../engine/ai/TacticalAI';
import type { AiWorkerRequest, AiWorkerResponse } from './aiProtocol';

export function answerAiRequest(request: AiWorkerRequest): AiWorkerResponse {
    if (request.kind === 'ping') return { kind: 'pong' };
    try {
        return { kind: 'decided', requestId: request.requestId, action: getBestAction(request.state) };
    } catch (error) {
        return { kind: 'failed', requestId: request.requestId, message: String(error) };
    }
}
