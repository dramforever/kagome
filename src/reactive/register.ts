import { Sentinel, Disposable, EventEmitter, KEvent, pureS, ensureRun, globalScheduler } from "../basic";

let counter = 0;

export class Register<T> implements Sentinel<T>, Disposable {
    triggerEmitter: EventEmitter<T>;
    onTrigger: KEvent<T>;
    num: number;
    pending: boolean;

    constructor(public value: T) {
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
        return ensureRun({
            dispose: () => this.setDirectly(oldValue)
        });
    }

    dispose() {
        this.triggerEmitter.dispose();
    }
}

export function reg<T>(value: T): Sentinel<Register<T>> {
    return ensureRun(pureS(new Register(value)));
}
