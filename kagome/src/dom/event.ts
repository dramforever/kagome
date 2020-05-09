import { KEvent } from "../basic";

export interface HasDomEvent<Name, T> {
    addEventListener(
        type: Name,
        listener: (event: T) => void,
        options?: boolean | AddEventListenerOptions
    ): void;

    removeEventListener(
        type: Name,
        listener: (event: T) => void,
        options?: boolean | AddEventListenerOptions
    ): void;
}

export function domEvent<Name, T>(
    target: HasDomEvent<Name, T>,
    name: Name,
    options?: boolean | AddEventListenerOptions
): KEvent<T> {
    return (listener, thisArg?, disposables?) => {
        // Note: listen should probably be new each time
        const listen = (event: T) => listener.call(thisArg, event);
        target.addEventListener(name, listen, options);

        return {
            dispose() {
                target.removeEventListener(name, listen, options);
                disposables?.forEach(x => x.dispose());
            }
        }
    }
}
