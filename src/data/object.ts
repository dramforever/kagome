import { ensureRun, Disposable } from "../basic";

export function setPropertyD<A, K extends keyof A>(
    target: A, key: K, value: A[K]
): Disposable {
    const oldValue: A[K] = target[key];
    target[key] = value;

    return ensureRun({
        dispose: () => {
            target[key] = oldValue;
        }
    });
}
