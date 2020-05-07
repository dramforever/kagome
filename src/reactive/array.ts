import { Register } from "./register";
import { Sentinel, KEvent, globalScheduler, EventEmitter, ensureRun, pureS, isSentinel, Disposable, SentinelExt, PureSentinel } from "../basic";

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

export type AddArraySentinel<T> = T | (ArraySentinel<T> & Partial<Disposable>);

export function isArraySentinel(value: any): value is ArraySentinel<any> {
    return isSentinel(value) && ('onArrayChange' in value);
}

export abstract class ArraySentinelExt<T>
    extends SentinelExt<T[]>
    implements ArraySentinel<T> {
    abstract onArrayChange: KEvent<ArrayChange<T>>;

}

export class ArrayRegister<T> extends ArraySentinelExt<T>
    implements ArraySentinel<T>, Disposable {

    wrapped: Register<T[]>;
    arrayChangeEmitter: EventEmitter<ArrayChange<T>>;
    onArrayChange: KEvent<ArrayChange<T>>;

    changeCache: ArrayChange<T>

    get value(): T[] { return this.wrapped.value; }
    get onTrigger(): KEvent<T[]> { return this.wrapped.onTrigger; }
    get triggerEmitter(): EventEmitter<T[]> { return this.wrapped.triggerEmitter; }

    constructor(initial: T[]) {
        super();

        this.wrapped = new Register(initial);

        this.arrayChangeEmitter = new EventEmitter();
        this.onArrayChange = this.arrayChangeEmitter.event;

        this.changeCache = [];
    }

    notifyPatch(patch: ArrayPatch<T>) {
        console.log('notify', patch);
        const shouldNotify = this.changeCache.length === 0;
        this.changeCache.push(patch);
        if (shouldNotify) {
            globalScheduler.add(() => {
                const savedCache = this.changeCache;
                this.changeCache = [];
                this.arrayChangeEmitter.fire(savedCache);
                this.triggerEmitter.fire(this.value);
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
