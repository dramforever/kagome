export function setPropertyD<A, K extends keyof A>(
    target: A, key: K, value: A[K]
) {
    const oldValue: A[K] = target[key];
    target[key] = value;

    return {
        dispose: () => {
            target[key] = oldValue;
        }
    }
}
