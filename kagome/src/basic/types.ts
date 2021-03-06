import { KEvent, nullEvent, EventEmitter } from './event';

export interface Disposable {
    dispose: () => void;
}

export interface Sentinel<T> {
    value: T;
    onTrigger: KEvent<T>;
}

export type SentinelD<T> = Sentinel<T> & Partial<Disposable>;

export type AddSentinel<T> = T | (SentinelD<T>);

export type WithSentinel<T> = {
    [k in keyof T]: AddSentinel<T[k]>
};

export function isSentinel(val: any): val is Sentinel<unknown> {
    return (
        typeof val === 'object'
        && val !== null
        && 'onTrigger' in val
        && 'value' in val
    );
}

export type Runnable<T> =
    SentinelD<T>
    | (void extends T ? Partial<Sentinel<void>> & Disposable : never)

export abstract class SentinelExt<T> implements SentinelExt<T> {
    abstract value: T;
    abstract onTrigger: KEvent<T>;

    f<U>(func: (value: T) => U): PureSentinel<SentinelFuncSentinel<T, U>> {
        const func1 = (value: T) => pureS(func(value));
        return pureS(new SentinelFuncSentinel(this, func1));
    }

    sf<U>(func: (value: T) => SentinelD<U>): PureSentinel<SentinelFuncSentinel<T, U>> {
        return pureS(new SentinelFuncSentinel(this, func));
    }

    df(func: (value: T) => Partial<Disposable>): PureSentinel<DisposeFuncSentinel<T>> {
        return pureS(new DisposeFuncSentinel(this, func));
    }
}

export class PureSentinel<T> extends SentinelExt<T> {
    onTrigger: KEvent<T>;

    constructor(public value: T) {
        super();

        this.onTrigger = nullEvent();
    }
}

export function pureS<T>(value: T): PureSentinel<T> {
    return new PureSentinel(value);
}

export class SentinelFuncSentinel<S, T> extends SentinelExt<T>
    implements Disposable {
    current: SentinelD<T>;
    value: T;
    triggerEmitter: EventEmitter<T>;
    onTrigger: KEvent<T>;
    listener: Disposable;

    constructor(
        public wrapped: SentinelD<S>,
        public func: (value: S) => SentinelD<T>,
        public disposables: Partial<Disposable>[] = []
    ) {
        super();

        this.current = func(wrapped.value);
        this.value = this.current.value;

        this.triggerEmitter = new EventEmitter();
        this.onTrigger = this.triggerEmitter.event;

        this.listener = this.current.onTrigger(this.handleNew.bind(this));

        this.wrapped.onTrigger((newInput) => {
            this.listener.dispose();
            this.current = func(newInput);
            this.handleNew(this.current.value);
            this.listener = this.current.onTrigger(this.handleNew.bind(this));
        })
    }

    handleNew(newVal: T) {
        this.value = newVal;
        this.triggerEmitter.fire(newVal);
    }

    dispose() {
        this.listener.dispose();
        this.current?.dispose?.();
        this.triggerEmitter.dispose();
        this.disposables.forEach(x => x.dispose?.());
    }
}

export class DisposeFuncSentinel<T> implements Disposable {
    current: Partial<Disposable>;
    listenerD: Disposable;

    constructor(
        public wrapped: Sentinel<T>,
        public func: (value: T) => Partial<Disposable>
    ) {
        this.current = func(this.wrapped.value);
        this.listenerD = this.wrapped.onTrigger(this.handle.bind(this));
    }

    handle(newValue: T) {
        this.current.dispose?.();
        this.current = this.func(newValue);
    }

    dispose() {
        this.listenerD.dispose();
        this.current.dispose?.();
    }
}
