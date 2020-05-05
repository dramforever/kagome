import { Sentinel, Disposable, EventEmitter, KEvent, pureS, ensureRun } from "../basic";

let counter = 0;

export class Register<T> implements Sentinel<T>, Disposable {
    triggerEmitter: EventEmitter<T>;
    onTrigger: KEvent<T>;
    num: number;

    constructor(public value: T) {
        this.triggerEmitter = new EventEmitter();
        this.onTrigger = this.triggerEmitter.event;
        this.num = counter ++;
    }

    setDirectly(value: T) {
        this.value = value;
        this.triggerEmitter.fire(value);
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

export function reg<T>(value: T): Sentinel<Register<T>> {
    return ensureRun(pureS(new Register(value)));
}
