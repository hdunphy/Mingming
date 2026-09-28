import { answerAiRequest } from './aiWorkerCore';
import type { AiWorkerRequest, AiWorkerResponse } from './aiProtocol';

// The project's tsconfig uses the DOM lib, not the WebWorker lib, so `self` is typed as a Window.
// This narrow cast is the whole of what the worker needs from its global scope.
const scope = self as unknown as {
    onmessage: ((event: MessageEvent<AiWorkerRequest>) => void) | null;
    postMessage(message: AiWorkerResponse): void;
};

scope.onmessage = (event) => {
    scope.postMessage(answerAiRequest(event.data));
};
