import { Sentinel, Disposable, KEvent, EventEmitter, isSentinel, globalScheduler, registerHasRun } from "../basic";

export type AddSentinel<T> = T | (Sentinel<T> & Partial<Disposable>);

export type WithSentinel<T> = {
    [k in keyof T]: AddSentinel<T[k]>
};

export class Mapped<T> implements Sentinel<T>, Disposable {
    value: T;
    triggerEmitter: EventEmitter<T>;
    onTrigger: KEvent<T>;
    listenersD: Disposable[];

    constructor(public map: WithSentinel<T>) {
        this.triggerEmitter = new EventEmitter();
        this.onTrigger = this.triggerEmitter.event;
        this.listenersD = [];

        this.value = (Array.isArray(map) ? [] : {}) as T;
        for (const key in this.map) {
            const val = this.map[key];
            if (isSentinel(val)) {
                (this.value[key] as any) = val.value;
                registerHasRun(val);
                this.listenersD.push(val.onTrigger((newValue) =>
                    globalScheduler.add(() => {
                        (this.value[key] as any) = newValue;
                        this.triggerEmitter.fire(this.value);
                    })
                ));
            } else {
                (this.value[key] as any) = val;
            }
        }
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

export function mapped<T>(map: WithSentinel<T>): Mapped<T> {
    return new Mapped(map);
}
