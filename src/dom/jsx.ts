import { ensureRun, Runnable, Sentinel, Disposable, nullEvent, KEvent, isSentinel, AddSentinel, WithSentinel, SentinelExt, registerHasRun } from "../basic";
import { AddArraySentinel, isArraySentinel, ArraySentinel, ArrayPatch } from "../reactive";

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
    export interface ElementChildrenAttribute { children: {}; }

    // These are just more JSX related stuff
    export type FunctionComponent<P> =
        (props: P, ... children: ChildOrSentinel[]) => Element;
    export type ElementProps<El> = Props<El>;
}

type NullChild = boolean | undefined | null;
type Child = Element | Element[] | string | number | NullChild;
export type ChildOrSentinel = AddArraySentinel<Child> | AddSentinel<Child>;

type PropsSimple<El> =
    { [k in Exclude<keyof El, 'children'>]?: El[k] | undefined }
    | { [k in Exclude<string, keyof El | 'children'>]?: string | undefined };

type Props<El> = WithSentinel<PropsSimple<El>> | null;
type PropsChildren<El> = { children?: ChildOrSentinel | ChildOrSentinel[] } & WithSentinel<PropsSimple<El>>;

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

export class KagomeIntrinsic extends SentinelExt<Element> implements Disposable {
    value: Element;
    listenersD: Disposable[];
    onTrigger: KEvent<Element>;

    childOffsets: number[];
    propsSave: PropsSave;

    constructor(
        public type: string,
        public props: Props<HTMLElement>,
        public children: ChildOrSentinel[]
    ) {
        super();
        this.listenersD = [];
        this.onTrigger = nullEvent();
        this.propsSave = {};

        this.value = document.createElement(type);

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
            const child = children[i];
            if (isArraySentinel(child)) {
                this.genArraySentinel(range, i, child as ArraySentinel<Child>);
            } else if (isSentinel(child)) {
                this.genSentinel(range, i, child as Sentinel<Child>);
            } else {
                genChild(range, child as Child);
            }
            this.childOffsets[i + 1] = range.endOffset;
            range.setStart(range.endContainer, range.endOffset);
        }
    }

    genSentinel(range: Range, i: number, child: Sentinel<Child>) {
        genChild(range, child.value);
        registerHasRun(child);
        this.listenersD.push(child.onTrigger((newVal) => {
            const newRange = document.createRange();
            newRange.setStart(this.value, this.childOffsets[i]);
            newRange.setEnd(this.value, this.childOffsets[i + 1]);
            genChild(newRange, newVal);
            const delta = newRange.endOffset - this.childOffsets[i + 1];
            if (delta !== 0) {
                for (let j = i + 1; j != this.childOffsets.length; j ++)
                    this.childOffsets[j] += delta;
            }
        }));
    }

    genArraySentinel(range: Range, i: number, child: ArraySentinel<Child>) {
        const offset = Array(child.value.length + 1);
        offset[0] = 0;
        const childRange = range.cloneRange();
        for (let j = 0; j != child.value.length; j++) {
            const piece = child.value[j];
            genChild(childRange, piece);
            offset[j + 1] = childRange.endOffset - range.startOffset;
            childRange.setStart(childRange.endContainer, childRange.endOffset);
        }

        registerHasRun(child);
        this.listenersD.push(child.onArrayChange((change) => {
            const base = this.childOffsets[i];

            const workSplice = ({
                start, deleteCount, inserted
            }: {
                start: number;
                deleteCount: number;
                inserted: Child[];
            }) => {
                const newRange = document.createRange();
                newRange.setStart(
                    this.value,
                    base + offset[start]
                );
                newRange.setEnd(
                    this.value,
                    base + offset[start + deleteCount]
                );
                newRange.deleteContents();

                const newOffsets = Array(inserted.length);
                for (let i = 0; i != inserted.length; i ++) {
                    genChild(newRange, inserted[i]);
                    newOffsets[i] = newRange.endOffset - base;
                }

                const delta = newRange.endOffset - base - offset[start + deleteCount];
                offset.splice(start + 1, deleteCount, ...newOffsets);

                if (delta !== 0) {
                    for (let j = start + inserted.length + 1; j != offset.length; j ++)
                        offset[j] += delta;
                }
            };

            for (const patch of change) {
                if (patch.type === 'splice') {
                    workSplice(patch)
                } else if (patch.type === 'update') {
                    workSplice({
                        start: patch.index,
                        deleteCount: 0,
                        inserted: [patch.value]
                    });
                }
            }

            const delta = offset[offset.length - 1] - this.childOffsets[i + 1];
            if (delta !== 0) {
                for (let j = i + 1; j != this.childOffsets.length; j ++)
                    this.childOffsets[j] += delta;
            }
        }));
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
