/* @jsx K.kagomeElement */

import * as K from './index';

export function __kagomeDemo(main: Node) {
    const interact = () => K.process((run) => {
        const container = run(() => <div />);

        for (let i = 0;; i ++) {
            const id = run(() => K.pureS('inp-' + Math.random().toString().slice(2)));

            const para = run(() =>
                <p><label for={id}>Please type {i}: </label></p>
            );

            const inp = run(() => <input id={id}/>) as HTMLInputElement;

            run(() => K.appendChildD(para, inp));
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
                break;
            } else {
                run(() => K.setAttributeD(inp, 'class', 'ok'))
            }
        }

        return container;
    });

    return K.toplevel((run) => {
        const app = run(() =>
            <div class="main">
                {interact()}
                {K.mapped([interact(), interact()])}
            </div>
        );

        run(() => K.appendChildD(main, app));
    })
}
