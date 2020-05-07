import { ensureRun, Runnable, Sentinel, Disposable, nullEvent, KEvent, isSentinel } from "../basic";
import { WithSentinel, AddSentinel } from "../data";

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
        return ensureRun(new KagomeIntrinsic(
            type, props as Props<HTMLElement>, children
        ));
    } else {
        return type((props ?? {}) as P, ... children);
    }
}

type PropsSave = { [K: string]: any };

export class KagomeIntrinsic implements Sentinel<Element>, Disposable {
    value: Element;
    listenersD: Disposable[];
    onTrigger: KEvent<Element>;

    childOffsets: number[];
    propsSave: PropsSave;
    childrenCache: Child[];

    constructor(
        public type: string,
        public props: Props<HTMLElement>,
        public children: ChildOrSentinel[]
    ) {
        this.listenersD = [];
        this.onTrigger = nullEvent();
        this.propsSave = {};

        this.value = document.createElement(type);

        this.childrenCache = Array(children.length);
        this.childOffsets = Array(children.length + 1);
        this.childOffsets[0] = 0;

        this.populateProps(props);
        this.populateChildren(children);
    }

    populateProps(props: Props<HTMLElement>) {
        for (const [k, v] of Object.entries(props ?? {})) {
            if (isSentinel(v)) {
                applyProp(this.value, k as any, v.value as any, this.propsSave);
                this.listenersD.push(v.onTrigger((newVal: any) => {
                    applyProp(this.value, k as any, newVal, this.propsSave);
                }));
            }
            else {
                applyProp(this.value, k as any, v as any, this.propsSave);
            }
        }
    }

    populateChildren(children: ChildOrSentinel[]) {
        const range = document.createRange();
        range.setStart(this.value, 0);
        range.setEnd(this.value, 0);
        for (let i = 0; i != children.length; i++) {
            if (isSentinel(children[i])) {
                const child = children[i] as Sentinel<Child>;
                this.childrenCache[i] = child.value;
                genChild(range, child.value);
                this.listenersD.push(child.onTrigger((newVal) => {
                    const isCached = cacheEqual(newVal, this.childrenCache[i]);
                    this.childrenCache[i] = newVal;
                    if (isCached)
                        return;
                    const newRange = document.createRange();
                    newRange.setStart(this.value, this.childOffsets[i]);
                    newRange.setEnd(this.value, this.childOffsets[i + 1]);
                    genChild(newRange, newVal);
                    const delta = newRange.endOffset - this.childOffsets[i + 1];
                    for (let j = i + 1; j != children.length; j++)
                        this.childOffsets[j] += delta;
                }));
            }
            else {
                genChild(range, children[i] as Child);
            }
            this.childOffsets[i + 1] = range.endOffset;
            range.setStart(range.endContainer, range.endOffset);
        }
    }

    dispose() {
        this.listenersD.forEach(x => x.dispose());

        if (this.props !== null) {
            for (const val in Object.values(this.props)) {
                if (isSentinel(val))
                    (val as any)?.dispose();
            }
        }

        for (const child in this.children) {
            if (isSentinel(child))
                (child as any)?.dispose();
        }
    }
}

function arrayEquals<T>(a: T[], b: T[]): boolean {
    return a.length == b.length && a.every((val, i) => val == b[i]);
}

function cacheEqual(newVal: Child, cached: Child) {
    return (
        newVal === cached
        || Array.isArray(newVal)
        && Array.isArray(cached)
        && arrayEquals(newVal, cached as Element[])
    );
}

function applyProp<El extends Element, K extends keyof PropsSimple<El>>(
    element: El,
    prop: K,
    value: PropsSimple<El>[K],
    propsSave: PropsSave
) {
    if (value === undefined) {
        if (prop in propsSave) {
            const saved = propsSave[prop];
            if (prop in element) {
                (element as any)[prop] = saved;
            } else {
                if (saved === null)
                    element.removeAttribute(prop);
                else
                    element.setAttribute(prop, saved);
            }
            delete propsSave[prop];
        }
    } else {
        if (prop in element) {
            if (! (prop in propsSave))
                propsSave[prop] = (element as any)[prop];
            (element as any)[prop] = value;
        } else {
            if (! (prop in propsSave))
                propsSave[prop] = element.getAttribute(prop);
            element.setAttribute(prop, value as string);
        }
    }
}

function genChild(range: Range, ch: Child): void {
    range.deleteContents();

    if (typeof ch === 'boolean'
        || ch === undefined
        || ch === null
        || ch === '') {
        /* Nothing */
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
