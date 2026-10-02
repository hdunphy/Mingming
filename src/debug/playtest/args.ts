/** TICKET 180a — a tiny argument parser: `command positional... --flag value`. */
export interface ParsedArgs {
    readonly command: string | undefined;
    readonly positional: ReadonlyArray<string>;
    readonly flags: Readonly<Record<string, string | true>>;
}

export function parseArgs(argv: ReadonlyArray<string>): ParsedArgs {
    const flags: Record<string, string | true> = {};
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const name = arg.slice(2);
            const next = argv[i + 1];
            if (next === undefined || next.startsWith('--')) flags[name] = true;
            else { flags[name] = next; i += 1; }
        } else {
            positional.push(arg);
        }
    }
    return { command: positional[0], positional: positional.slice(1), flags };
}
