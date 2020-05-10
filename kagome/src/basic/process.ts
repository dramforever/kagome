import { Disposable, Runnable, SentinelExt } from "./types";
import { KEvent, EventEmitter } from './event';
import { globalScheduler } from "./scheduler";

export type ProcessFunction<T> =
    (run: <A>(sen: () => Runnable<A>) => A) => T

interface StateElement {
    cache: Runnable<unknown>;
    handleD: Disposable | null;
}

export class Process<T> extends SentinelExt<T> implements Disposable {
    state: StateElement[] = [];

    value: T;

    triggerEmitter: EventEmitter<T>;
    onTrigger: KEvent<T>;

    constructor(
        public pf: ProcessFunction<T>,
        public checkNew: (oldVal: T, newVal: T) => boolean
    ) {
        super();

        this.triggerEmitter = new EventEmitter();
        this.onTrigger = this.triggerEmitter.event;
        this.value = this.run();
    }

    run(): T {
        const res = this.pf(this.makeWorker());
        return res;
    }

    makeWorker(): <A>(sen: () => Runnable<A>) => A {
        let curIndex = 0;

        return <A>(sen: () => Runnable<A>): A => {
            const index = curIndex ++;

            if (index >= this.state.length) {
                const val = sen();

                const handleD =
                    val.onTrigger?.(() =>
                        globalScheduler.add(() => {
                            for (const se of this.state.splice(index + 1).reverse()) {
                                se.handleD?.dispose();
                                se.cache.dispose?.();
                            }
                            const newVal = this.run();
                            const shouldTrigger = this.checkNew(this.value, newVal);
                            this.value = newVal;
                            if (shouldTrigger)
                                this.triggerEmitter.fire(this.value);
                        })
                    );

                this.state.push({
                    cache: val as Runnable<unknown>,
                    handleD: handleD ?? null
                });
            }

            // TODO: Add call stack check for cached
            return this.state[index].cache.value as A;
        }
    }

    dispose() {
        for (const se of this.state.reverse()) {
            se.handleD?.dispose();
            se.cache.dispose?.();
        }

        this.triggerEmitter.dispose();

        this.state.length = 0;
    }
}

export function process<T>(pf: ProcessFunction<T>): Process<T> {
    return new Process(pf, (o, n) => o !== n);
}

export function processAll<T>(pf: ProcessFunction<T>): Process<T> {
    return new Process(pf, () => true);
}

export function toplevel<T>(p: ProcessFunction<T> | Process<T>): Process<T> {
    return p instanceof Process ? p : process(p);
}
