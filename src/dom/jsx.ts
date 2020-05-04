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
type KagomeChild = Node | Node[] | string | KagomeNullChild;
type KagomeChildSentinel = AddSentinel<KagomeChild>

type KagomePropsSimple<El> =
    { [k in keyof El]: El[k] }
    | { [k in Exclude<string, keyof El>]: string };

type KagomeProps<El> = WithSentinel<KagomePropsSimple<El>>;

export function kagomeElement<K extends keyof HTMLElementTagNameMap>(
    tag: K, props: KagomeProps<HTMLElementTagNameMap[K]>, ...children: KagomeChildSentinel[]
): Process<HTMLElementTagNameMap[K]>;
export function kagomeElement<K extends keyof HTMLElementDeprecatedTagNameMap>(
    tag: K, props: KagomeProps<HTMLElementDeprecatedTagNameMap[K]>, ...children: KagomeChildSentinel[]
): Process<HTMLElementDeprecatedTagNameMap[K]>;
export function kagomeElement(
    tag: string, props: KagomeProps<HTMLElement>, ...children: KagomeChildSentinel[]
): Process<HTMLElement> {
    return ensureRun(process((run) => {
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

        const frag = new DocumentFragment();

        for (const ch of res.children) {
            if (typeof ch === 'boolean' || ch === undefined || ch === null)
                continue;

            if (Array.isArray(ch)) {
                frag.append(... ch);
            } else {
                frag.append(ch);
            }
        }

        // TODO Is this the best way?
        element.innerHTML = '';
        element.appendChild(frag);

        return element;
    }));
}
