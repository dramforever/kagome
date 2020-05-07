/* @jsx K.kagomeElement */

import * as K from './index';

export function __kagomeDemo(main: Node) {
    const Input:
        (props: { valueR: K.Register<string> }
            & K.JSX.ElementProps<HTMLInputElement>)
            => K.Process<HTMLInputElement> =
        ({ valueR, ...rest }) => K.process((run) => {

        const inp = run(() => <input {... rest} />) as HTMLInputElement;
        run(() => K.domEvent(inp, 'input')(
            () => valueR.setDirectly(inp.value)
        ));
        return inp;
    });

    const Interact:
        (props?: {}) => K.Process<HTMLDivElement> =
        () => K.process((run) => {

        const container = run(() => <div />);

        for (let i = 0;; i ++) {
            const id = run(() =>
                K.pureS(`inp-${Math.random() * Math.pow(2, 52)}`)
            );

            const classR = run(() => K.reg<string | undefined>(undefined));
            const valueR = run(() => K.reg(''));
            const hidePromptR = run(() => K.reg(false));
            const hideInputR = run(() => K.reg(false));
            const extraMessageR = run(() => K.reg(''));

            const part = run(() =>
                <div>
                    <label for={id}>Please type {i}: </label>
                    <Input id={id} class={classR} valueR={valueR} hidden={hideInputR}/>
                    <p class="prompt" hidden={hidePromptR}>{valueR} isn't right</p>
                    <p class="prompt" hidden={hidePromptR}>{extraMessageR}</p>
                </div>
            );

            run(() => K.appendChildD(container, part));

            const value = run(() => valueR);

            if (value !== i.toString()) {
                run(() => classR.setD('wrong'));

                if (value === undefined || value === '') {
                    // Input is empty
                    run(() => hidePromptR.setD(true));
                }

                if (value.length - i.toString().length > 10) {
                    run(() => hideInputR.setD(true));
                    run(() => extraMessageR.setD('Forget about it'));
                }

                break;
            } else {
                run(() => hidePromptR.setD(true));
                run(() => classR.setD('ok'));
            }
        }

        return container as HTMLDivElement;
    });

    return K.toplevel((run) => {
        const app = run(() =>
            <div class="main">
                {<Interact />}
                {K.mapped([Interact(), <Interact />])}
            </div>
        );

        run(() => K.appendChildD(main, app));
    });
}
