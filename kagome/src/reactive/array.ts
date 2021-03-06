import { Register } from "./register";
import { Sentinel, KEvent, globalScheduler, EventEmitter, pureS, isSentinel, Disposable, SentinelExt, PureSentinel, SentinelD, SentinelFuncSentinel, nullEvent } from "../basic";

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
        const func1 = (value: T) => pureS([func(value)]);
        return pureS(new FuncArraySentinel(this, func1));
    }

    sfa<U>(func: (value: T) => SentinelD<U>): PureSentinel<FuncArraySentinel<T, U>> {
        const func1 = (value: T) => {
            const sen = func(value);
            return new SentinelFuncSentinel(sen, x => pureS([x]), [sen]);
        };
        return pureS(new FuncArraySentinel(this, func1));
    }

    asfa<U>(func: (value: T) => SentinelD<U[]>): PureSentinel<FuncArraySentinel<T, U>> {
        return pureS(new FuncArraySentinel(this, func));
    }

    dfa(func: (value: T) => Partial<Disposable>): PureSentinel<DisposeFuncArraySentinel<T>> {
        return pureS(new DisposeFuncArraySentinel(this, func));
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

    setD(value: T[]): Disposable {
        const oldValue = this.value;
        this.setDirectly(value);

        return {
            dispose: () => {
                this.setDirectly(oldValue);
            }
        }
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
    return pureS(wrapped);
}

export class FuncArraySentinel<S, T>
    extends ArraySentinelExt<T>
    implements Disposable {
    current: SentinelD<T[]>[];
    offsets: number[];
    currentListeners: Disposable[];
    value: T[];
    arrayChangeEmitter: EventEmitter<ArrayChange<T>>;
    onArrayChange: KEvent<ArrayChange<T>>;
    triggerEmitter: EventEmitter<T[]>;
    onTrigger: KEvent<T[]>;
    changeCache: ArrayChange<T>;
    listener: Disposable;

    constructor(
        public wrapped: ArraySentinelD<S>,
        public func: (value: S) => SentinelD<T[]>,
        public disposables: Partial<Disposable>[] = []
    ) {
        super();
        this.changeCache = [];

        this.current = this.wrapped.value.map(func);
        this.offsets = Array(this.current.length + 1);
        this.offsets[0] = 0;
        this.value = [];

        for (let i = 0; i != this.current.length; i ++) {
            this.value.push(... this.current[i].value);
            this.offsets[i + 1] = this.value.length;
        }

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

    emitChange(change: ArrayChange<T>) {
        const shouldFire = this.changeCache.length === 0;
        this.changeCache.push(... change);
        if (shouldFire)
            globalScheduler.add(() => {
                const savedCache = this.changeCache;
                this.changeCache = [];
                this.arrayChangeEmitter.fire(savedCache);
                this.triggerEmitter.fire(this.value);
            })
    }

    handleChange(change: ArrayChange<S>) {
        const newChange: ArrayChange<T> = change.map((patch) => {
            if (patch.type === 'splice') {
                const newSentinels = patch.inserted.map(this.func);
                this.current.splice(
                    patch.start, patch.deleteCount,
                    ...newSentinels
                ).forEach(sen => sen?.dispose?.());

                const newListeners = newSentinels.map((sen) =>
                    this.handleSentinel(sen)
                );
                this.currentListeners.splice(
                    patch.start, patch.deleteCount,
                    ...newListeners
                ).forEach(l => l.dispose());

                const newValues = newSentinels.map(sen => sen.value)
                const start = this.offsets[patch.start];
                const deleteCount = this.offsets[patch.start + patch.deleteCount] - start;

                const newOffsets = Array(newValues.length);
                const newValuesFlat = [];

                for (let i = 0; i != newValues.length; i ++) {
                    newValuesFlat.push(... newValues[i]);
                    newOffsets[i] = newValuesFlat.length + start;
                }

                this.value.splice(
                    start,
                    deleteCount,
                    ...newValuesFlat
                );

                this.offsets.splice(patch.start + 1, patch.deleteCount, ...newOffsets);

                const delta = newValuesFlat.length - deleteCount;

                if (delta !== 0) {
                    for (let j = patch.start + newOffsets.length + 1;
                        j != this.offsets.length;
                        j ++)
                        this.offsets[j] += delta;
                }

                return {
                    type: 'splice',
                    start: start,
                    deleteCount,
                    inserted: newValuesFlat
                };
            } else if (patch.type === 'update') {
                this.currentListeners[patch.index].dispose();
                this.current[patch.index].dispose?.();

                const sen = this.func(patch.value);
                this.current[patch.index] = sen;
                this.handleSentinel(sen);
                this.replaceSegment(patch.index, sen.value);

                return {
                    type: 'update',
                    index: patch.index,
                    value: this.value[patch.index]
                };
            } else {
                throw new Error('Wrong patch type attribute');
            }
        });

        this.emitChange(newChange);
    }

    handleSentinel(sen: Sentinel<T[]>) {
        return sen.onTrigger((newVal) => {
            const index = this.current.indexOf(sen);
            const change: ArrayChange<T> = [{
                type: 'splice',
                start: this.offsets[index],
                deleteCount: this.offsets[index + 1] - this.offsets[index],
                inserted: newVal
            }];
            this.replaceSegment(index, newVal);
            this.emitChange(change);
        })
    }

    replaceSegment(i: number, newVal: T[]) {
        this.value.splice(
            this.offsets[i],
            this.offsets[i + 1] - this.offsets[i],
            ...newVal
        );
        const delta = newVal.length - (this.offsets[i + 1] - this.offsets[i]);
        if (delta !== 0) {
            for (let j = i + 1; j != this.offsets.length; j++)
                this.offsets[j] += delta;
        }
    }

    dispose() {
        this.arrayChangeEmitter.dispose();
        this.triggerEmitter.dispose();
        this.listener.dispose();
        this.current.forEach(x => x.dispose?.());
        this.currentListeners.forEach(x => x.dispose());
        this.disposables.forEach(x => x.dispose?.());
    }
}

export class DisposeFuncArraySentinel<T> implements Disposable {
    current: Partial<Disposable>[];
    listenerD: Disposable;

    constructor(
        public wrapped: ArraySentinel<T>,
        public func: (value: T) => Partial<Disposable>
    ) {
        this.current = this.wrapped.value.map(func);
        this.listenerD = this.wrapped.onArrayChange(this.handle.bind(this));
    }

    handle(change: ArrayChange<T>) {
        for (const patch of change) {
            if (patch.type === 'splice') {
                const newItems = patch.inserted.map(this.func);
                this.current.splice(
                    patch.start,
                    patch.deleteCount,
                    ...newItems
                ).forEach(x => x.dispose?.());
            } else if (patch.type === 'update') {
                this.current[patch.index].dispose?.();
                this.current[patch.index] = this.func(patch.value);
            }
        }
    }

    dispose() {
        this.listenerD.dispose();
        this.current.forEach(x => x.dispose?.());
    }
}
