import { Sentinel, Disposable, Runnable } from "./types";
import { KEvent, EventEmitter } from './event';

export type ProcessFunction<T> =
    (run: <A>(sen: () => Runnable<A>) => A) => T

export class Process<T> implements Sentinel<T>, Disposable {
    cache: Runnable<unknown>[] = [];
    handlerDisposables: Disposable[] = [];

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

            if (index >= this.cache.length) {
                const val = sen();
                this.cache.push(val as Runnable<unknown>);
                if (val.onTrigger) {
                    this.handlerDisposables.push(
                        val.onTrigger(() => {
                            this.handlerDisposables.splice(index)
                                .forEach(x => x.dispose());
                            this.cache.splice(index)
                                .forEach(x => x.dispose?.());
                            this.value = this.run();
                            this.changeEmitter.fire(this.value);
                        }));
                }
            }
            // TODO: Add call stack check for cached

            return this.cache[index].value as A;
        }
    }

    dispose() {
        this.handlerDisposables.forEach(x => x.dispose());
        this.cache.forEach(x => x.dispose?.());
        this.changeEmitter.dispose();

        this.cache.length = 0;
        this.handlerDisposables.length = 0;
    }
}

export function process<T>(pf: ProcessFunction<T>): Process<T> {
    return new Process(pf);
}
