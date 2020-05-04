import { Sentinel, Disposable, Runnable } from "./types";
import { KEvent, EventEmitter } from './event';
import { registerHasRun, ensureRun } from "./debug";

export type ProcessFunction<T> =
    (run: <A>(sen: () => Runnable<A>) => A) => T

interface StateElement {
    cache: Runnable<unknown>;
    handleD: Disposable | null;
}

export class Process<T> implements Sentinel<T>, Disposable {
    state: StateElement[] = [];

    value: T;

    changeEmitter: EventEmitter<T>;
    onTrigger: KEvent<T>;

    constructor(
        public pf: ProcessFunction<T>
    ) {
        this.changeEmitter = new EventEmitter();
        this.onTrigger = this.changeEmitter.event;
        this.value = this.run();
    }

    run(): T {
        return this.pf(this.makeWorker());
    }

    makeWorker(): <A>(sen: () => Runnable<A>) => A {
        let curIndex = 0;

        return <A>(sen: () => Runnable<A>): A => {
            const index = curIndex ++;

            if (index >= this.state.length) {
                const val = sen();
                registerHasRun(val);

                const handleD =
                    val.onTrigger?.(() => {
                        for (const se of this.state.splice(index)) {
                            se.handleD?.dispose();
                            se.cache.dispose?.();
                        }
                        this.value = this.run();
                        this.changeEmitter.fire(this.value);
                    });

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
        for (const se of this.state) {
            se.handleD?.dispose();
            se.cache.dispose?.();
        }

        this.changeEmitter.dispose();

        this.state.length = 0;
    }
}

export function process<T>(pf: ProcessFunction<T>): Process<T> {
    return ensureRun(new Process(pf));
}

export function toplevel<T>(p: ProcessFunction<T> | Process<T>) {
    const proc = p instanceof Process ? p : process(p);
    registerHasRun(proc);
}
