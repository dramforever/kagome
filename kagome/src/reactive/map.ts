import { Sentinel, Disposable, KEvent, EventEmitter, isSentinel, globalScheduler, registerHasRun, WithSentinel, SentinelExt } from "../basic";
import { ArraySentinel, ArrayChange } from "./array";

export class Mapped<T> extends SentinelExt<T> implements Disposable {
    value: T;
    triggerEmitter: EventEmitter<T>;
    onTrigger: KEvent<T>;
    listenersD: Disposable[];

    constructor(public map: WithSentinel<T>) {
        super();
        this.triggerEmitter = new EventEmitter();
        this.onTrigger = this.triggerEmitter.event;
        this.listenersD = [];

        this.value = (Array.isArray(map) ? [] : {}) as T;
        for (const key in this.map) {
            const val = this.map[key];
            if (isSentinel(val)) {
                (this.value[key] as any) = val.value;
                registerHasRun(val);
                this.listenersD.push(val.onTrigger((newValue) => {
                    this.updateHook(key, newValue as T[typeof key]);
                    globalScheduler.add(() => {
                        (this.value[key] as any) = newValue;
                        this.triggerEmitter.fire(this.value);
                    })
                }));
            } else {
                (this.value[key] as any) = val;
            }
        }
    }

    updateHook(key: keyof T, _value: T[typeof key]) {
        // Nothing
    }

    dispose() {
        this.listenersD.forEach(x => x.dispose());

        for (const key in this.map) {
            const val = this.map[key];
            if (isSentinel(val))
                (val as any)?.dispose();
        }
    }
}

export class MappedArray<T> extends Mapped<T[]> implements ArraySentinel<T> {
    arrayChangeEmitter: EventEmitter<ArrayChange<T>>;
    onArrayChange: KEvent<ArrayChange<T>>;

    constructor(map: T[]) {
        super(map);
        this.arrayChangeEmitter = new EventEmitter();
        this.onArrayChange = this.arrayChangeEmitter.event;
    }

    updateHook(index: number, value: T) {
        this.arrayChangeEmitter.fire([{
            type: 'update',
            index, value
        }]);
    }
}

export function mapped<T>(map: WithSentinel<T[]>): MappedArray<T>;
export function mapped<T>(map: WithSentinel<T>): Mapped<T>;
export function mapped<T>(map: WithSentinel<T>): MappedArray<T> | Mapped<T> {
    if (Array.isArray(map))
        return new MappedArray(map);
    else
        return new Mapped(map);
}
