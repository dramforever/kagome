/* @jsx K.kagomeElement */

import * as K from './index';

export function __kagomeDemo(main: Node) {
    function Input(props: {
        id: string,
        valueEmitter: K.EventEmitter<string>
    }): K.Process<HTMLInputElement> {
        return K.process((run) => {
            const inp = run(() => <input id={props.id} />) as HTMLInputElement;
            run(() => K.domEvent(inp, 'input')(
                () => props.valueEmitter.fire(inp.value)
            ));
            return inp;
        });
    }

    const interact = () => K.process((run) => {
        const container = run(() => <div />);

        for (let i = 0;; i ++) {
            const id = run(() => K.pureS('inp-' + Math.random().toString().slice(2)));

            const valueEmitter = new K.EventEmitter<string>();
            const inp = run(() => Input({id, valueEmitter}));
            const para = run(() =>
                <p>
                    <label for={id}>Please type {i}: </label>
                    {inp}
                </p>
            );

            run(() => K.appendChildD(container, para));

            const value = run(() => K.listenS(valueEmitter.event));

            if (value !== i.toString()) {
                run(() => K.setAttributeD(inp, 'class', 'wrong'))
                if (value !== undefined && value !== '') {
                    const prompt = run(() =>
                        <p class="prompt">{value} isn't right</p>
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
