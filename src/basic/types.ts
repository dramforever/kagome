import { KEvent } from './event';

export interface Disposable {
    dispose: () => void;
}

// TODO: Decorator for sentinel-creating functions, check if sentinel is run
export interface Sentinel<T> {
    value: T;
    onHasValueChanged: KEvent<T>;
}

export type Runnable<T> =
    Sentinel<T> & Partial<Disposable>
    | (void extends T
        ? Partial<Sentinel<void>> & Disposable
        : never)

export function pureS<T>(value: T): Sentinel<T> {
    return {
        value,
        onHasValueChanged: () => ({ dispose: () => {} })
    };
}
