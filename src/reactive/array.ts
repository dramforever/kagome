import { Register } from "./register";
import { Sentinel, KEvent, globalScheduler, EventEmitter, ensureRun, pureS, isSentinel, Disposable, SentinelExt, PureSentinel, SentinelD, registerHasRun } from "../basic";

export type ArrayPatch<T> =
    {
        type: 'splice',
        start: number, deleteCount: number,
        inserted: T[]
    } | {
        type: 'update',
        index: number, value: T
    };

export type ArrayChange<T> = ArrayPatch<T>[];

export interface ArraySentinel<T> extends Sentinel<T[]> {
    onArrayChange: KEvent<ArrayChange<T>>;
}

export type ArraySentinelD<T> = ArraySentinel<T> & Partial<Disposable>;
export type AddArraySentinel<T> = T | ArraySentinelD<T>;

export function isArraySentinel(value: any): value is ArraySentinel<any> {
    return isSentinel(value) && ('onArrayChange' in value);
}

export abstract class ArraySentinelExt<T>
    extends SentinelExt<T[]>
    implements ArraySentinel<T> {
    abstract onArrayChange: KEvent<ArrayChange<T>>;

    fa<U>(func: (value: T) => U): PureSentinel<FuncArraySentinel<T, U>> {
        return pureS(ensureRun(new FuncArraySentinel(this, func)));
    }

    sfa<U>(func: (value: T) => SentinelD<U>): PureSentinel<SentinelFuncArraySentinel<T, U>> {
        return pureS(ensureRun(new SentinelFuncArraySentinel(this, func)));
    }
}

export class ArrayRegister<T> extends ArraySentinelExt<T>
    implements Disposable {

    wrapped: Register<T[]>;
    arrayChangeEmitter: EventEmitter<ArrayChange<T>>;
    onArrayChange: KEvent<ArrayChange<T>>;

    changeCache: ArrayChange<T>

    get value(): T[] { return this.wrapped.value; }
    get onTrigger(): KEvent<T[]> { return this.wrapped.onTrigger; }

    constructor(initial: T[]) {
        super();

        this.wrapped = new Register(initial);

        this.arrayChangeEmitter = new EventEmitter();
        this.onArrayChange = this.arrayChangeEmitter.event;

        this.changeCache = [];
    }

    notifyPatch(patch: ArrayPatch<T>) {
        const shouldNotify = this.changeCache.length === 0;
        this.changeCache.push(patch);
        if (shouldNotify) {
            globalScheduler.add(() => {
                const savedCache = this.changeCache;
                this.changeCache = [];
                this.arrayChangeEmitter.fire(savedCache);
            })
        }
    }

    splice(start: number, deleteCount: number, ...items: T[]) {
        const deleted = this.value.splice(start, deleteCount, ...items);
        this.wrapped.setDirectly(this.value);
        this.notifyPatch({
            type: 'splice',
            start, deleteCount,
            inserted: items
        });
        return deleted;
    }

    setDirectly(value: T[]) {
        const oldLength = this.value.length;
        this.wrapped.setDirectly(value);

        this.notifyPatch({
            type: 'splice',
            start: 0, deleteCount: oldLength,
            inserted: this.value
        })
    }

    getIndex(index: number) {
        return this.value[index];
    }

    setIndex(index: number, value: T) {
        this.value[index] = value;

        this.notifyPatch({
            type: 'update',
            index, value
        })
    }

    get length(): number {
        return this.value.length;
    }

    push(value: T) {
        this.splice(this.length, 0, value);
    }

    pop(): T | undefined {
        if (this.length > 0)
            return this.splice(this.length, 1)[0];
        else
            return undefined;
    }

    unshift(value: T) {
        this.splice(0, 0, value);
    }

    shift(): T | undefined {
        if (this.length > 0)
            return this.splice(0, 1)[0];
        else
            return undefined;
    }

    dispose() {
        this.wrapped.dispose();
        this.arrayChangeEmitter.dispose();
    }
}

const arrayRegisterHandlers: ProxyHandler<ArrayRegister<any>> = {
    get(target, index, receiver) {
        if (typeof index === 'number') {
            return target.value[index];
        } else {
            return Reflect.get(target, index, receiver);
        }
    },

    set(target, index, value, receiver) {
        if (typeof index === 'number') {
            target.setIndex(index, value);
            return true;
        } else {
            return Reflect.set(target, index, value, receiver);
        }
    }
};

export function array<T>(initial: T[] = []): PureSentinel<ArrayRegister<T>> {
    const areg = new ArrayRegister(initial);
    const wrapped = new Proxy(areg, arrayRegisterHandlers);
    return ensureRun(pureS(wrapped));
}

export class FuncArraySentinel<S, T>
    extends ArraySentinelExt<T>
    implements Disposable {
    value: T[];
    arrayChangeEmitter: EventEmitter<ArrayChange<T>>;
    onArrayChange: KEvent<ArrayChange<T>>;
    triggerEmitter: EventEmitter<T[]>;
    onTrigger: KEvent<T[]>;
    listener: Disposable;

    constructor(
        public wrapped: ArraySentinelD<S>,
        public func: (value: S) => T
    ) {
        super();

        registerHasRun(wrapped);
        this.value = this.wrapped.value.map(func);

        this.arrayChangeEmitter = new EventEmitter();
        this.onArrayChange = this.arrayChangeEmitter.event;

        this.triggerEmitter = new EventEmitter();
        this.onTrigger = this.triggerEmitter.event;

        this.listener = this.wrapped.onArrayChange(
            this.handleChange.bind(this)
        );
    }

    handleChange(change: ArrayChange<S>) {
        const newChange: ArrayChange<T> = change.map((patch) => {
            if (patch.type === 'splice') {
                const newItems = patch.inserted.map(this.func);
                this.value.splice(patch.start, patch.deleteCount, ...newItems);
                return {
                    type: 'splice',
                    start: patch.start,
                    deleteCount: patch.deleteCount,
                    inserted: newItems
                };
            } else if (patch.type === 'update') {
                this.value[patch.index] = this.func(patch.value);
                return {
                    type: 'update',
                    index: patch.index,
                    value: this.value[patch.index]
                };
            } else {
                const impossible: never = patch;
                return impossible;
            }
        });

        this.arrayChangeEmitter.fire(newChange);
        this.triggerEmitter.fire(this.value);
    }

    dispose() {
        this.arrayChangeEmitter.dispose();
        this.triggerEmitter.dispose();
        this.listener.dispose();
    }
}

export class SentinelFuncArraySentinel<S, T>
    extends ArraySentinelExt<T>
    implements Disposable {
    current: SentinelD<T>[];
    currentListeners: Disposable[];
    value: T[];
    arrayChangeEmitter: EventEmitter<ArrayChange<T>>;
    onArrayChange: KEvent<ArrayChange<T>>;
    triggerEmitter: EventEmitter<T[]>;
    onTrigger: KEvent<T[]>;
    listener: Disposable;

    constructor(
        public wrapped: ArraySentinelD<S>,
        public func: (value: S) => SentinelD<T>
    ) {
        super();

        registerHasRun(wrapped);
        this.current = this.wrapped.value.map(func);
        this.value = this.current.map(sen => sen.value);
        this.currentListeners = this.current.map(
            this.handleSentinel.bind(this)
        );

        this.arrayChangeEmitter = new EventEmitter();
        this.onArrayChange = this.arrayChangeEmitter.event;

        this.triggerEmitter = new EventEmitter();
        this.onTrigger = this.triggerEmitter.event;

        this.listener = this.wrapped.onArrayChange(
            this.handleChange.bind(this)
        );
    }

    handleChange(change: ArrayChange<S>) {
        const newChange: ArrayChange<T> = change.map((patch) => {
            if (patch.type === 'splice') {
                const newSentinels = patch.inserted.map(this.func);
                this.current.splice(
                    patch.start, patch.deleteCount,
                    ...newSentinels
                ).forEach(sen => sen?.dispose?.());

                const newListeners = newSentinels.map((sen, i) =>
                    this.handleSentinel(sen, i + patch.start)
                );
                this.currentListeners.splice(
                    patch.start, patch.deleteCount,
                    ...newListeners
                ).forEach(l => l.dispose());

                const newValues = newSentinels.map(sen => sen.value)
                this.value.splice(
                    patch.start, patch.deleteCount,
                    ...newValues
                );

                return {
                    type: 'splice',
                    start: patch.start,
                    deleteCount: patch.deleteCount,
                    inserted: newValues
                };
            } else if (patch.type === 'update') {
                this.currentListeners[patch.index].dispose();
                this.current[patch.index].dispose?.();

                const sen = this.func(patch.value);
                this.current[patch.index] = sen;
                this.handleSentinel(sen, patch.index);
                this.value[patch.index] = sen.value;

                return {
                    type: 'update',
                    index: patch.index,
                    value: this.value[patch.index]
                };
            } else {
                const impossible: never = patch;
                return impossible;
            }
        });

        this.arrayChangeEmitter.fire(newChange);
        this.triggerEmitter.fire(this.value);
    }

    handleSentinel(sen: Sentinel<T>, i: number) {
        registerHasRun(sen);

        return sen.onTrigger((newVal) => {
            this.value[i] = newVal;
            this.triggerEmitter.fire(this.value);
        })
    }

    dispose() {
        this.arrayChangeEmitter.dispose();
        this.triggerEmitter.dispose();
        this.listener.dispose();
        this.current.forEach(x => x.dispose?.());
        this.currentListeners.forEach(x => x.dispose());
    }
}
