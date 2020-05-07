import { KEvent, nullEvent, EventEmitter } from './event';
import { ensureRun, registerHasRun } from './debug';

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

    f<U>(func: (value: T) => U): PureSentinel<FuncSentinel<T, U>> {
        return pureS(ensureRun(new FuncSentinel(this, func)));
    }

    sf<U>(func: (value: T) => SentinelD<U>): PureSentinel<SentinelFuncSentinel<T, U>> {
        return pureS(ensureRun(new SentinelFuncSentinel(this, func)));
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
    return ensureRun(new PureSentinel(value));
}

export class FuncSentinel<S, T> extends SentinelExt<T> implements Disposable {
    value: T;
    triggerEmitter: EventEmitter<T>;
    onTrigger: KEvent<T>;
    listener: Disposable;

    constructor(
        public wrapped: SentinelD<S>,
        public func: (value: S) => T
    ) {
        super();

        registerHasRun(wrapped);
        this.value = func(wrapped.value);
        this.triggerEmitter = new EventEmitter();
        this.onTrigger = this.triggerEmitter.event;
        this.listener = wrapped.onTrigger((newVal) => {
            this.value = func(newVal);
            this.triggerEmitter.fire(func(newVal));
        })
    }

    dispose() {
        this.wrapped?.dispose?.();
        this.listener.dispose();
        this.triggerEmitter.dispose();
    }
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
        public func: (value: S) => SentinelD<T>
    ) {
        super();

        registerHasRun(wrapped);

        this.current = func(wrapped.value);
        this.value = this.current.value;

        this.triggerEmitter = new EventEmitter();
        this.onTrigger = this.triggerEmitter.event;

        registerHasRun(this.current);
        this.listener = this.current.onTrigger(this.handleNew.bind(this));

        this.wrapped.onTrigger((newInput) => {
            this.listener.dispose();
            this.current = func(newInput);
            registerHasRun(this.current);
            this.listener = this.current.onTrigger(this.handleNew.bind(this));
        })
    }

    handleNew(newVal: T) {
        this.value = newVal;
        this.triggerEmitter.fire(newVal);
    }

    dispose() {
        this.wrapped?.dispose?.();
        this.listener.dispose();
        this.current?.dispose?.();
        this.triggerEmitter.dispose();
    }
}
