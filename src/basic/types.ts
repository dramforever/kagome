import { KEvent, nullEvent } from './event';
import { ensureRun } from './debug';

export interface Disposable {
    dispose: () => void;
}
export interface Sentinel<T> {
    value: T;
    onTrigger: KEvent<T>;
}

export function isSentinel(val: any): val is Sentinel<unknown> {
    return (
        typeof val === 'object'
        && val !== null
        && 'onTrigger' in val
        && 'value' in val
    );
}

export type Runnable<T> =
    Sentinel<T> & Partial<Disposable>
    | (void extends T
        ? Partial<Sentinel<void>> & Disposable
        : never)

export function pureS<T>(value: T): Sentinel<T> {
    return ensureRun({
        value,
        onTrigger: nullEvent()
    });
}
