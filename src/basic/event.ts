// Interface stolen from VSCode api
// https://code.visualstudio.com/api/references/vscode-api#Event

import { Disposable } from "./types";

export type KEvent<T> =
    (
        listener: (x: T) => void,
        thisArg?: any,
        disposables?: Disposable[]
    ) => Disposable;

export class EventEmitter<T> implements Disposable {
    event: KEvent<T>;

    counter: number;
    listeners: Map<number, {
        listener: (x: T) => void,
        disposables: Disposable[] | undefined
    }>;

    constructor() {
        this.counter = 0;
        this.listeners = new Map();

        this.event = (listener, thisArg?, disposables?) => {
            const num = this.counter ++;
            this.listeners.set(num, {
                listener: listener.bind(thisArg),
                disposables
            })

            return {
                dispose: () => {
                    if (! this.listeners.has(num)) return;

                    this.listeners.get(num)!.disposables
                        ?.forEach(x => x.dispose);
                    this.listeners.delete(num);
                }
            }
        };
    }

    fire(x: T) {
        for (const [, {listener}] of this.listeners) {
            listener(x);
        }
    }

    dispose() {
        for (const [, {disposables}] of this.listeners) {
            disposables?.forEach(x => x.dispose());
        }
        this.listeners.clear();
    }
}
