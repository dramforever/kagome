/* @jsx K.kagomeElement */

import * as K from './index';

export function __kagomeDemo(container: Node) {
    return K.toplevel((run) => {
        for (let i = 0;; i ++) {
            const id = 'inp-' + Math.random().toString().slice(2);

            const inp = run(() => <input id={id}/>) as HTMLInputElement;

            const para = run(() =>
                <p>
                    <label for={id}>Please type {i}: </label>
                    {inp}
                </p>
            );

            run(() => K.appendChildD(container, para));

            run(() => K.listenS(K.domEvent(inp, 'input')));

            if (inp.value !== i.toString()) {
                run(() => K.setAttributeD(inp, 'class', 'wrong'))
                if (inp.value !== '') {
                    const prompt = run(() =>
                        <p class="prompt">{inp.value} isn't right</p>
                    );
                    run(() => K.appendChildD(container, prompt));
                }
                return;
            } else {
                run(() => K.setAttributeD(inp, 'class', 'ok'))
            }
        }
    });
}
