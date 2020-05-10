# Kagome

<div align="center">
    <p><img src="images/icon.svg" alt="Kagome icon">
    <p><em>A framework for imperative reactive programming.</em>
</div>

***Very much work in
progress.***

## Current progress

Relatively low level primitives are available to create reactive applications.
There is basic JSX support for creating elements more easily and for combining
elements.

## A glimpse of Kagome

(The following are code fragments from `kagome-demo/src/demo.ts`. They are meant
to show what code using Kagome looks like, so they might not make sense. Check
the full demo file for details)

Import Kagome, using `K` as the shorthand prefix:

```tsx
import * as K from 'kagome';
```

Creating a process using `K.process`:

```tsx
const Interact:
    (props?: {}) => K.Process<HTMLDivElement> =
    () => K.process((run) => {
```

Processes must be pure, when disregarding calls to `run`. Wrap impure things to
avoid recomputation: (In general, impurity must be used with caution.)

```tsx
    const id = run(() =>
        K.pureS(`inp-${Math.random() * Math.pow(2, 52)}`)
    );
```

Creating writable reactive values called *registers*:

```tsx
    const classR = run(() => K.reg<string | undefined>(undefined));
```

Creating derived read-only reactive values using combinators. `f` means applying a function, and `s` prefix means the function itself returns something reactive (`s` for `Sentinel`, basically another thing that can `run` and returns a value).

```tsx
    const filteredS = run(() => valueR.f(x => x.trim()));
    const correctS = run(() => filteredS.f(x => x === i.toString()));
    const tooMuchS = run(() => filteredS.f(x =>
        x.length - i.toString().length > 10))

    const classS = run(() => correctS.f(val => val ? 'ok' : 'wrong'));
    const promptS = run(() => filteredS.sf(val =>
        val !== undefined && val !== '' && val !== i.toString()
        ? <p class="prompt">{filteredS} isn't right</p>
        : K.pureS(null)
    ));
    const extraS = run(() => tooMuchS.sf(val =>
        val
        ? <p class="prompt">Forget about it</p>
        : K.pureS(null)
    ));
```

Creating and composing elements and components using JSX syntax. Note how
attributes are allowed to be reactive values, and how the reactive values are distributed among UI elements.

```tsx
    const part = run(() =>
        <div>
            <label for={id}>Please type {i}: </label>
            <Input id={id} class={classS} valueR={valueR} hidden={tooMuchS} />
            {promptS}
            {extraS}
        </div>
    );
```

`Input` is a wrapper component over HTML `input`. Note how `rest` passes through
HTML attributes:

```tsx
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
```

Running actions:

```tsx
    run(() => K.appendChildD(container, part));
```

So far, nothing out of the ordinary. This is about to change.

You can read a reactive register by running it:

```tsx
    const value = run(() => valueR);
```

You saw it right: **You can work with reactive values without dealing with event
handlers**. You can literally just ask for its value.

Effectively, you can write your code only thinking in the
forward direction, generating output from input, and Kagome will take care of
switching between branches of history. For example:

```tsx
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
```

Note that when the input value (`valueR`) changes and `value !== i.toString()`
is still true, if the new value is not empty, `hiddenR` will automatically
revert to the previous value. There is no need to handle this case explicitly.

Since a process does exactly what was needed to move from one history to the
next, there is no need for a virtual DOM. `container` is a native
`HTMLDivElement` and can be used elsewhere:

(The assertion is needed due to a limitation in TypeScript's JSX support.)

```tsx
    return container as HTMLDivElement;
});
```

The following shows some composition capabilities, using both JSX and plain JS
syntax together, and a combinator `K.mapped` for running actions in parallel:

```tsx
K.toplevel((run) => {
    const app = run(() =>
        <div class="main">
            {<Interact />}
            {K.mapped([Interact(), <Interact />])}
        </div>
    );

    run(() => K.appendChildD(main, app));
});
```

## What's going on under the hoods?

As promised, Kagome is a framework for imperative reactive programming, and it
works by tracking a history. The basics are as follows:

- A process runs from start to finish, without needing to care about how to
  update everything due to changes.
- The Kagome runtime tracks checkpoint objects (`Runnable` type). (Checkpoint
  objects are those returned by the *thunk*, which is the function passed to
  `run`)
- Each checkpoint object can either have a value and a trigger event, or have an
  'undo' action, or have both.
    - The value and trigger event usually means some dynamic value (Called
      `Sentinel` since it 'watches' something changing). When `run` the process
      listens to the trigger event.
    - An 'undo' action can correspond to destroying a resource (like
      unregistering a listener) or literally undoing something (like
      `appendChild`).
- When a `Sentinel` triggers, the whole process is *unwound* to the point after
  the `Sentinel` was sent to `run`, the new value of the `Sentinel` is used, and
  execution restarts there.
    - Unwinding in this case means undoing every checkpoint object and
      unlistening to `Sentinels` in reverse order until the desired position is
      reached.

But how is this time travel event handling possible, given that JavaScript has
no advanced control flow features like continuations?

This is where the funny syntax of `run(() => ...)` comes into play. Essentially,
when it is needed to restart a process from a certain point in the middle, we
instead restart it from the beginning. We count the number of calls to `run` and
return *cached* results until we reach the desired number. That is why the
process needed to be pure. Specifically, all resource-creating actions must be
wrapped in `run(() => K.pureS(...))` to avoid getting a new version every time.

## Some common suffixes

- `S` means `Sentinel`
- `D` means `Disposable`
- `R` means `Register`

## Origin of the name 'Kagome'

> Kagome Kagome (`かごめかごめ`, or `籠目籠目`) is a Japanese children's game
> and the song associated with it. &mdash; [*Wikipedia: Kagome
> Kagome*][wp-kagome]

[wp-kagome]: https://en.wikipedia.org/wiki/Kagome_Kagome

The 'kagome' is chosen to mean 'caged bird' in this context. It is a reference
to the word 'capturing' in the *Capturing the Future by Replaying the Past*
technique (See [Functional Pearl][capture]), which Kagome implements a part of.
(Kagome's implementation is not based on the published one as the full feature
set of delimited continuations is not required.)

[capture]: https://arxiv.org/abs/1710.10385

Disclaimer: No bird has been caged or otherwise made to suffer in the making of
this framework.
