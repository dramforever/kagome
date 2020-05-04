import { Disposable, ensureRun } from "../basic";

export function setAttributeD(
    target: Element, name: string, value: any
): Disposable {
    const oldValue = target.getAttribute(name);
    target.setAttribute(name, value);

    return ensureRun({
        dispose: () => {
            if (oldValue)
                target.setAttribute(name, oldValue);
            else
                target.removeAttribute(name);
        }
    })
}
