/**
 * TICKET 202h — the session's transcript, with the time on every line.
 *
 * Everything the driver prints (its stream of JSON lines on stdout, anything on stderr) is appended
 * to `driver.log` beside the session, each complete line prefixed with the wall-clock time it
 * arrived. On 2026-10-07 four sessions lost up to 27 minutes and nothing said where; with this, a
 * gap between two lines is the answer. Partial lines wait for their newline; `flush` writes what is
 * left when the driver exits.
 */
import fs from 'node:fs';

export function createDriverLog(logPath, { now = () => new Date(), append = (file, text) => fs.appendFileSync(file, text) } = {}) {
    const pending = { out: '', err: '' };
    const write = (stream, chunk) => {
        pending[stream] += String(chunk);
        const lines = pending[stream].split('\n');
        pending[stream] = lines.pop();
        const tag = stream === 'err' ? ' [stderr]' : '';
        if (lines.length > 0) append(logPath, lines.map((line) => `${now().toISOString()}${tag} ${line.replace(/\r$/, '')}\n`).join(''));
    };
    return {
        out: (chunk) => write('out', chunk),
        err: (chunk) => write('err', chunk),
        note: (text) => append(logPath, `${now().toISOString()} [night] ${text}\n`),
        flush: () => { for (const stream of ['out', 'err']) if (pending[stream]) write(stream, '\n'); },
    };
}
