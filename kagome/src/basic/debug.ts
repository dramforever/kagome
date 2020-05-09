import StackTrace from 'stacktrace-js';
import StackTraceGPS from 'stacktrace-gps';

export const debugConfig = {
    debugProcessRun: false,
    debugProcessControlFlow: false
}

const hasRunSet: WeakSet<any> = new WeakSet();
const stackTraceGPS: any = new StackTraceGPS();

export function registerHasRun(target: any) {
    hasRunSet.add(target);
}

export function ensureRun<A extends object>(target: A): A {
    if (debugConfig.debugProcessRun) {
        const stack = StackTrace.getSync();
        (async () => {
            await Promise.resolve();
            if (hasRunSet.has(target)) return;
            const better = stackTraceGPS.pinpoint.bind(stackTraceGPS) as
                (stackframe: StackTrace.StackFrame)
                => Promise<StackTrace.StackFrame>;
            try {
                const betterStack = await Promise.all(stack.map(better)) as
                    StackTrace.StackFrame[];
                console.warn(
                    'Created but not run: %o\n%o',
                    target,
                    betterStack.map(x => x.toString()).join('\n')
                );
            } catch (err) {
                console.error('Error while improving call stack\n', err);
                console.warn(
                    'Created but not run: %o\n',
                    target,
                    stack.map(x => x.toString()).join('\n')
                );
            }
        })().catch((err) => console.error(err));
    }

    return target;
}
