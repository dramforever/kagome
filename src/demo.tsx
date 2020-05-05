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
            const hiddenR = run(() => K.reg(false));

            const part = run(() =>
                <div>
                    <label for={id}>Please type {i}: </label>
                    <Input id={id} class={classR} valueR={valueR}/>
                    <p class="prompt" hidden={hiddenR}>{valueR} isn't right</p>
                </div>
            );

            run(() => K.appendChildD(container, part));

            const value = run(() => valueR);

            if (value !== i.toString()) {
                run(() => classR.setD('wrong'));

                if (value === undefined || value === '') {
                    // Input is empty
                    run(() => hiddenR.setD(true));
                }
                break;
            } else {
                run(() => hiddenR.setD(true));
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
