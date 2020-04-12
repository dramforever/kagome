import * as K from './index';

export function demo() {
    return K.process((run) => {
        const container = run(() => K.pureS(document.createElement('div')));
        run(() => K.appendChildD(document.body, container));

        for (let i = 0;; i ++) {
            const para = run(() => K.pureS(document.createElement('p')));

            const inp = run(() => K.pureS(document.createElement('input')));
            const id = run(() => K.pureS(
                'inp-' + Math.random().toString().slice(2)));
            run(() => K.setPropertyD(inp, 'id', id));

            const label = run(() => K.pureS(document.createElement('label')));
            run(() => K.setPropertyD(label, 'innerText', `Please type ${i}: `));
            run(() => K.setPropertyD(label, 'htmlFor', id));

            run(() => K.appendChildD(para, label));
            run(() => K.appendChildD(para, inp));
            run(() => K.appendChildD(container, para));

            run(() => K.listenS(K.domEvent(inp, 'input')));

            if (inp.value !== i.toString())
                return;
        }
    });
}
