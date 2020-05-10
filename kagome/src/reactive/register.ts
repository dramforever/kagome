import { Disposable, EventEmitter, KEvent, pureS, globalScheduler, PureSentinel, SentinelExt } from "../basic";

let counter = 0;

export class Register<T> extends SentinelExt<T> implements Disposable {
    triggerEmitter: EventEmitter<T>;
    onTrigger: KEvent<T>;
    num: number;
    pending: boolean;

    constructor(public value: T) {
        super();
        this.triggerEmitter = new EventEmitter();
        this.onTrigger = this.triggerEmitter.event;
        this.num = counter ++;
        this.pending = false;
    }

    setDirectly(value: T) {
        this.value = value;
        if (this.pending) return;

        this.pending = true;
        globalScheduler.add(() => {
            this.pending = false;
            this.triggerEmitter.fire(this.value);
        });
    }

    setD(value: T): Disposable {
        const oldValue = this.value;
        this.setDirectly(value);
        return {
            dispose: () => this.setDirectly(oldValue)
        };
    }

    dispose() {
        this.triggerEmitter.dispose();
    }
}

export function reg<T>(value: T): PureSentinel<Register<T>> {
    return pureS(new Register(value));
}
