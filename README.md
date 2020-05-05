# Kagome

*A framework for imperative reactive programming. **Very much work in
progress.***

## Current progress

Relatively low level primitives are available to create reactive applications.
There is basic JSX support for creating elements more easily and for combining
elements.

## A glimpse of Kagome

(The following are code fragments. For a complete example see `src/demo.ts`.)

Import Kagome, using `K` as the shorthand prefix:

```jsx
import * as K from 'kagome';
```

Create a process using `K.process`:

```jsx
const interact = () => K.process((run) => {
```

Processes must be pure, when disregarding calls to `run`. Wrap impure things to
avoid recomputation: (In general, impurity must be used with caution.)

```jsx
    const id = run(() => K.pureS('inp-' + Math.random().toString().slice(2)));
```

Creating your own components:

```jsx
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
```

Composing and creating elements and components using JSX syntax:

```jsx
    const valueEmitter = new K.EventEmitter<string>();
    const inp = run(() => Input({id, valueEmitter}));
    const para = run(() =>
        <p>
            <label for={id}>Please type {i}: </label>
            {inp}
        </p>
    );
```

Running actions:

```jsx
    run(() => K.appendChildD(container, para));
```

So far, nothing out of the ordinary. This is about to change.

Listening to events:

```jsx
    const value = run(() => K.listenS(valueEmitter.event));
```

You saw it right: **listening events work like function calls**. What's going
on?

As promised, Kagome is a framework for imperative reactive programming. The
basic premise is as follows:

- A process runs from start to finish, without needing to care about how to
  update everything.
- The Kagome runtime tracks checkpoint objects (`Runnable` type). (Checkpoint
  objects are those returned by the **thunk**, which is the function passed to
  `run`)
- Each checkpoint object can either have a value and a trigger event, or has an
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

Effectively, you can write your code only thinking in the forward direction,
generating output from input, and the chore of updating the output according to
input changes is turned into a straightforward time travelling mechanism.

But how is this time travelling event handler possible, given that JavaScript
has no advanced control flow features like continuations?

This is where the funny syntax of `run(() => ...)` comes into play. Essentially,
when it is needed to restart a process from a certain point in the middle, we
instead restart it from the beginning. We count the number of calls to `run` and
return *cached* results until we reach the desired number. That is why `run`
needed to be pure.

Since a process does exactly what was needed to move from one history to the
next, there is no need for a virtual DOM and a difference algorithm. `container`
is a native `HTMLDivElement`:

```jsx
    return container;
});
```

We can also show off some composition:

```jsx
K.toplevel((run) => {
    const app = run(() =>
        <div class="main">
            {interact()}
            {K.mapped([interact(), interact()])}
        </div>
    );

    run(() => K.appendChildD(main, app));
});
```

## Origin of the name 'Kagome'

> Kagome Kagome (`かごめかごめ`, or `籠目籠目`) is a Japanese children's game
> and the song associated with it. &mdash; [*Wikipedia: Kagome
> Kagome*][wp-kagome]

[wp-kagome]: https://en.wikipedia.org/wiki/Kagome_Kagome

The 'kagome' is chosen to mean 'caged bird' in this context. It is a reference
to the *Capturing the Future by Replaying the Past* technique (See [Functional
Pearl][capture]), which Kagome implements a part of. (Kagome's implementation is
not based on the published one as the full feature set of delimited
continuations is not required.)

[capture]: https://arxiv.org/abs/1710.10385
