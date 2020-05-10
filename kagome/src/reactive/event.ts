import { KEvent, EventEmitter, Disposable, SentinelExt } from "../basic";

export class ListeningSentinel<T>
    extends SentinelExt<T | undefined> implements Disposable {
    value: T | undefined;
    eventEmitter: EventEmitter<T>;
    onTrigger: KEvent<T>;
    eventDisposable: Disposable;

    constructor(event: KEvent<T>) {
        super();

        this.value = undefined;
        this.eventEmitter = new EventEmitter();
        this.onTrigger = this.eventEmitter.event;

        this.eventDisposable = event((x) => {
            this.value = x;
            this.eventEmitter.fire(x);
        });
    }

    dispose() {
        this.eventDisposable.dispose();
        this.eventEmitter.dispose();
    }
}

export function listenS<T>(event: KEvent<T>): ListeningSentinel<T> {
    return new ListeningSentinel(event);
}
