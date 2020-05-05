import { process, ensureRun, pureS, Runnable } from "../basic";
import { WithSentinel, mapped, AddSentinel } from "../data";

type DOMElement = Element;

type IntrinsicElementsMapping = {
    [K in keyof HTMLElementTagNameMap]:
        PropsChildren<HTMLElementTagNameMap[K]>
} & {
    [K in keyof HTMLElementDeprecatedTagNameMap]:
        PropsChildren<HTMLElementDeprecatedTagNameMap[K]>
};

export namespace JSX {
    // Special components: these types are special in that TypeScript JSX will
    // check the types based on these types
    export type Element = Runnable<DOMElement>;
    export interface IntrinsicElements extends IntrinsicElementsMapping {}
    export interface ElementChildrenAttribute { children: any; }

    // These are just more JSX related stuff
    export type FunctionComponent<P> =
        (props: P, ... children: ChildOrSentinel[]) => Element;
    export type ElementProps<El> = Props<El>;
}

type NullChild = boolean | undefined | null;
type Child = Element | Element[] | string | number | NullChild;
type ChildSentinel<T> = T extends T ? (T | AddSentinel<T>) : never;
export type ChildOrSentinel = ChildSentinel<Child>;

type PropsSimple<El> =
    { [k in keyof El]?: El[k] | undefined }
    | { [k in Exclude<string, keyof El>]?: string | undefined };

type Props<El> = WithSentinel<PropsSimple<El>> | null;
type PropsChildren<El> =
    { children?: ChildOrSentinel[] }
    | WithSentinel<PropsSimple<El>>
    | null;

export function kagomeElement<K extends keyof IntrinsicElementsMapping>(
    type: K, props: Props<IntrinsicElementsMapping[K]>, ...children: ChildOrSentinel[]
): Runnable<IntrinsicElementsMapping[K]>;
export function kagomeElement(
    type: string, props: Props<HTMLElement>, ...children: ChildOrSentinel[]
): Runnable<HTMLElement>;
export function kagomeElement<P>(
    type: JSX.FunctionComponent<P>, props: P | null, ...children: ChildOrSentinel[]
): Runnable<Element>;

export function kagomeElement<P>(
    type: string | JSX.FunctionComponent<P>,
    props: Props<HTMLElement> | P | null,
    ...children: ChildOrSentinel[]
): Runnable<Element> {
    if (typeof type === 'string') {
        return kagomeIntrinsic(type, props as Props<HTMLElement>, children);
    } else {
        return kagomeFunction(type, props as P | null, children);
    }
}

function kagomeFunction<P>(
    type: JSX.FunctionComponent<P>, props: P | null, children: ChildOrSentinel[]
): Runnable<Element> {
    return type(props ?? {} as P, ... children);
}

function kagomeIntrinsic(
    type: string, props: Props<HTMLElement>, children: ChildOrSentinel[]
): Runnable<Element> {
    const proc = process((run) => {
        type CacheElement = {
            ch: Child,
            range: Range
        };

        const cache: CacheElement[] = run(() => pureS([]));
        const propSave: { [K in keyof typeof props]?: Props<HTMLElement>[K] } =
            run(() => pureS({}));

        const element = run(() => pureS(document.createElement(type)));

        const res: {
            props: PropsSimple<Element> | null,
            children: Child[]
        } = run(() => mapped({
            props: props && mapped<PropsSimple<Element>>(props),
            children: mapped(children)
        }));

        if (res.props !== null)
            applyProps(element, res.props, propSave);

        applyChildren(element, cache, res.children);

        return element;
    });

    // Element will never change
    proc.onTrigger = () => { return { dispose: () => {} }};
    return ensureRun(proc);
}

function applyProps<El extends Element>(
    element: El,
    props: PropsSimple<El>,
    propSave: { [K in keyof typeof props]?: PropsSimple<El>[K] }
) {
    for (const [k, v] of Object.entries(props)) {
        if (! props.hasOwnProperty(k)) continue;

        if (v === undefined) {
            if (k in propSave) {
                const saved = (propSave as any)[k];
                if (k in element) {
                    (element as any)[k] = saved;
                } else {
                    if (saved === null)
                        element.removeAttribute(k);
                    else
                        element.setAttribute(k, saved);
                }
                delete (propSave as any)[k];
            }
        } else {
            if (k in element) {
                if (! (k in propSave))
                    (propSave as any)[k] = (element as any)[k];
                (element as any)[k] = v;
            } else {
                if (! (k in propSave))
                    (propSave as any)[k] = element.getAttribute(k);
                element.setAttribute(k, v as string);
            }
        }
    }
}

type SimpleRange = {
    startContainer: Node, startOffset: number,
    endContainer: Node, endOffset: number
}

function simplifyRange(range: Range): SimpleRange {
    const { startContainer, startOffset, endContainer, endOffset } = range;
    return { startContainer, startOffset, endContainer, endOffset };
}

function unsimplifyRange(simpleRange: SimpleRange): Range {
    const range = document.createRange();
    range.setStart(simpleRange.startContainer, simpleRange.startOffset);
    range.setEnd(simpleRange.endContainer, simpleRange.endOffset);
    return range;
}

function applyChildren(
    element: Element,
    cache: { ch: Child; range: SimpleRange; }[],
    children: Child[]
) {
    if (children.length === 0) return;

    if (cache.length === 0) {
        for (const ch of children) {
            const range = document.createRange();
            range.selectNodeContents(element);
            range.setStart(range.endContainer, range.endOffset);
            genChild(range, ch);
            cache.push({ ch, range: simplifyRange(range) });
        }
    }
    else {
        children.forEach((ch, i) => {
            if (ch === cache[i].ch
                || Array.isArray(ch)
                && Array.isArray(cache[i].ch)
                && arrayEquals(ch, cache[i].ch as Element[])) {
                return;
            }
            cache[i].ch = ch;
            genChild(unsimplifyRange(cache[i].range), ch);
        });
    }
}

function genChild(range: Range, ch: Child): void {
    range.deleteContents();

    if (typeof ch === 'boolean'
        || ch === undefined
        || ch === null
        || ch === '') {
        const comment = document.createComment(String(ch));
        range.insertNode(comment);
    } else if (Array.isArray(ch)) {
        const frag = document.createDocumentFragment();
        ch.forEach(x => frag.append(x));
        range.insertNode(frag);
    } else if (typeof ch === 'string' || typeof ch === 'number') {
        const text = document.createTextNode(String(ch));
        range.insertNode(text);
    } else {
        range.insertNode(ch);
    }
}

function arrayEquals<T>(a: T[], b: T[]): boolean {
    return a.length == b.length && a.every((val, i) => val == b[i]);
}
