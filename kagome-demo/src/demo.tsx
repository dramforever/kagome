/* @jsx K.kagomeElement */
/// <reference path="../../kagome/kagome.d.ts" />

import K = Kagome;

K.debugConfig.debugProcessRun = true;

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
    (props: {
        id: number,
        blocks: K.ArrayRegister<number>
    }) => K.Process<HTMLDivElement> =
    ({ id, blocks }) => K.process((run) => {

    const removeSelf = () => {
        const at = blocks.value.indexOf(id);
        blocks.splice(at, 1);
    };

    const container = run(() =>
        <div>
            <button onclick={removeSelf}>Remove {id}</button>
        </div>
    );


    for (let i = 0;; i ++) {
        const id = run(() =>
            K.pureS(`inp-${Math.random() * Math.pow(2, 52)}`)
        );

        const valueR = run(() => K.reg(''));

        const filteredS = run(() => valueR.f(x => x.trim()));
        const correctS = run(() => filteredS.f(x => x === i.toString()));
        const tooMuchS = run(() => filteredS.f(x =>
            x.length - i.toString().length > 10))

        const classS = run(() => correctS.f(val => val ? 'ok' : 'wrong'));
        const promptS = run(() => filteredS.sf(val =>
            val !== undefined && val !== '' && val !== i.toString()
            ? <p class="prompt">{valueR} isn't right</p>
            : K.pureS(null)
        ));
        const extraS = run(() => tooMuchS.sf(val =>
            val
            ? <p class="prompt">Forget about it</p>
            : K.pureS(null)
        ));
        run(() => tooMuchS.onTrigger(val => console.log(i, val)));
        run(() => extraS.onTrigger(val => console.log(i, val)));

        const part = run(() =>
            <div>
                <label for={id}>Please type {i}: </label>
                <Input id={id} class={classS} valueR={valueR} hidden={tooMuchS} />
                {promptS}
                {extraS}
            </div>
        );

        run(() => K.appendChildD(container, part));

        if(! run(() => correctS)) {
            break;
        }
    }

    return container as HTMLDivElement;
});

K.toplevel((run) => {
    const blocks = run(() => K.array<number>());
    const blocksView = run(() => blocks.sfa(id =>
        <Interact id={id} blocks={blocks}/>
    ));

    const counter = run(() => K.pureS({ value: 0 }));

    const addBlock = () => {
        const id = counter.value ++;
        blocks.push(id);
    }

    const app = run(() =>
        <div class="main">
            <div>
                <button onclick={addBlock}>Add a block</button>
            </div>
            {blocksView}
        </div>
    );

    run(() => K.appendChildD(document.body, app));
});
