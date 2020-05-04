import { Process, process, ensureRun, pureS, Runnable } from "../basic";
import { WithSentinel, mapped, AddSentinel } from "../data";

type IntrinsicElementsMapping = {
        [K in keyof HTMLElementTagNameMap]:
            KagomeProps<HTMLElementTagNameMap[K]>
    } & {
        [K in keyof HTMLElementDeprecatedTagNameMap]:
            KagomeProps<HTMLElementDeprecatedTagNameMap[K]>
    };

type DOMElement = Element;

export namespace JSX {
    export type Element = Runnable<DOMElement>;
    export interface IntrinsicElements extends IntrinsicElementsMapping {}
}

type KagomeNullChild = boolean | undefined | null;
type KagomeChild = Node | Node[] | string | number | KagomeNullChild;
type KagomeChildSentinel = AddSentinel<KagomeChild>

type KagomePropsSimple<El> =
    { [k in keyof El]: El[k] }
    | { [k in Exclude<string, keyof El>]: string };

type KagomeProps<El> = WithSentinel<KagomePropsSimple<El>>;

function genChild(range: Range, ch: KagomeChild): void {
    range.deleteContents();

    if (typeof ch === 'boolean'
        || ch === undefined
        || ch === null) {
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

export function kagomeElement<K extends keyof HTMLElementTagNameMap>(
    tag: K, props: KagomeProps<HTMLElementTagNameMap[K]>, ...children: KagomeChildSentinel[]
): Process<HTMLElementTagNameMap[K]>;
export function kagomeElement<K extends keyof HTMLElementDeprecatedTagNameMap>(
    tag: K, props: KagomeProps<HTMLElementDeprecatedTagNameMap[K]>, ...children: KagomeChildSentinel[]
): Process<HTMLElementDeprecatedTagNameMap[K]>;
export function kagomeElement(
    tag: string, props: KagomeProps<HTMLElement>, ...children: KagomeChildSentinel[]
): Process<HTMLElement> {
    const proc = process((run) => {
        type CacheElement = {
            ch: KagomeChild,
            range: Range
        };

        const cache: CacheElement[] = run(() => pureS([]));

        const element = run(() => pureS(document.createElement(tag)));
        const res = run(() => mapped({
            props: mapped<KagomePropsSimple<typeof element>>(props),
            children: mapped(children)
        }));

        for (const [k, v] of Object.entries(res.props)) {
            if (! props.hasOwnProperty(k)) continue;

            if (k in element) {
                (element as any)[k] = v;
            } else {
                element.setAttribute(k, v as string);
            }
        }

        if (children.length > 0) {
            if (cache.length === 0) {
                for (const ch of res.children) {
                    const range = document.createRange();
                    range.selectNodeContents(element);
                    range.setStart(range.endContainer, range.endOffset);
                    genChild(range, ch);
                    cache.push({ ch, range });
                }
            } else {
                res.children.forEach((ch, i) => {
                    if (ch === cache[i].ch
                        || Array.isArray(ch)
                            && Array.isArray(cache[i].ch)
                            && arrayEquals(ch, cache[i].ch as Node[])) {
                        return;
                    }
                    cache[i].ch = ch;
                    genChild(cache[i].range, ch);
                })
            }
        }

        return element;
    });

    // Element will never change
    proc.onTrigger = () => { return { dispose: () => {} }};
    return ensureRun(proc);
}
