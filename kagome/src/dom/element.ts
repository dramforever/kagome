import { Disposable, ensureRun } from "../basic";

export function generalElementMovementD(
    node: Node, action: () => void
): Disposable {
    const oldParent = node.parentNode;
    const oldNextSibling = node.nextSibling;
    action();

    return ensureRun({
        dispose: () => {
            if (oldParent)
                oldParent.insertBefore(oldParent, oldNextSibling);
            else
                node.parentNode!.removeChild(node);
        }
    });
}

export function appendChildD(parent: Node, child: Node): Disposable {
    return generalElementMovementD(child, () => {
        parent.appendChild(child);
    })
}
