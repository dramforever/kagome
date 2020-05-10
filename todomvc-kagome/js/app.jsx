(function (window, K, React) {
	'use strict';

	const KEY = { ENTER: 13, ESCAPE: 27 };

	class Todo {
		constructor(initial) {
			this.completedR = new K.Register(initial.completed ?? false);
			this.textR = new K.Register(initial.text ?? '');
			this.destroyedEmitter = new K.EventEmitter();
			this.onDestroyed = this.destroyedEmitter.event;
		}

		destroy() { this.destroyedEmitter.fire(); }

		dump() {
			return {
				completed: this.completedR.value,
				text: this.textR.value
			}
		}

		serializeS() {
			return K.processAll((run) => {
				return run(() => K.mapped({
					completed: this.completedR,
					text: this.textR
				}));
			})
		}

		dispose() {
			this.completedR.dispose();
			this.textR.dispose();
			this.destroyedEmitter.dispose();
		}
	}

	const todoList = () => K.process((run) => {
		const todoA = run(() => K.array([]));
		const serializedA = run(() => todoA.sfa(todo => todo.serializeS()));
		run(() => localStorageSync(todoA, serializedA));

		function destroyTodo(todo) {
			todoA.splice(todoA.value.indexOf(todo), 1)
		}

		run(() => todoA.dfa((todo) => todo));

		run(() => todoA.dfa((todo) =>
			todo.onDestroyed(() => destroyTodo(todo))));

		return todoA;
	})

	const newTodoView = (todo, selectedS) => K.process((run) => {
		const editingR = run(() => K.reg(false));

		function commit() {
			// Blur due to Escape
			if (! editingR.value) return;

			editingR.setDirectly(false);
			const text = input.value.trim();
			if (text === '')
				todo.destroy();
			else
				todo.textR.setDirectly(text);
		}

		function handleKey(event) {
			if (event.keyCode === KEY.ENTER) {
				commit();
			} else if (event.keyCode == KEY.ESCAPE) {
				editingR.setDirectly(false);
			}
		}

		function beginEdit() {
			input.value = todo.textR.value;
			editingR.setDirectly(true);
			input.focus();
		}

		const input = run(() => <input
			class="edit"
			onkeydown={handleKey} onblur={commit} />);

		function handleCheck() {
			todo.completedR.setDirectly(this.checked)
		}

		const classVal = run(() => K.mapped({
			editing: editingR,
			completed: todo.completedR
		}).f((obj) => {
			const enabled = Object.entries(obj).filter(x => x[1]).map(x => x[0]);
			return enabled.length > 0 ? enabled.join(' ') : undefined;
		}));

		const filteredViewS = run(() => K.mapped({
			completed: todo.completedR,
			selected: selectedS
		}).sf(({ completed, selected }) =>
			selected.includes(completed)
			? <li class={classVal}>
				<div class="view">
					<input class="toggle" type="checkbox"
						checked={todo.completedR}
						onclick={handleCheck} />
					<label ondblclick={beginEdit}>{todo.textR}</label>
					<button class="destroy" onclick={() => todo.destroy()} />
				</div>
				{input}
			</li>
			: K.pureS(null)
		));

		return run(() => filteredViewS);
	});

	const LOCAL_STORAGE_KEY = 'todos-kagome';
	const localStorageSync = (reg, serializedA) => K.process((run) => {
		const initial = localStorage.getItem(LOCAL_STORAGE_KEY);
		if (initial !== null) run(() => reg.setD(
			JSON.parse(initial).map(dat => new Todo(dat))));
		run(() => serializedA.onTrigger((newVal) =>
			localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newVal))));
	})

	const locationHashRouter = () => K.process((run) => {
		const reg = run(() => K.reg(window.location.hash));
		run(() => K.domEvent(window, 'hashchange')(() =>
			reg.setDirectly(window.location.hash)));
		return reg;
	})


	K.toplevel((run) => {
		const todoA = run(() => todoList());

		const todoapp = run(() => K.pureS(document.querySelector('.todoapp')));
		const locationHashS = run(() => locationHashRouter());

		const selectedS = run(() => locationHashS.f(hash => {
			const page = hash.split('/')[1];
			if (page === 'active') return [false];
			else if (page === 'completed') return [true];
			else return [true, false];
		}));

		const todoViewsA = run(() => todoA.sfa(todo => newTodoView(todo, selectedS)));

		const input = run(() =>
			<input
				placeholder="What needs to be done?"
				class="new-todo" autofocus
				onkeypress={newTodo} />);

		function newTodo(event) {
			if (event.keyCode !== KEY.ENTER) return;
			const text = input.value.trim();
			if (text === '') return;
			todoA.push(new Todo({ text }));
			input.value = '';
		}

		function clearCompleted() {
			for (const todo of todoA.value.slice()) {
				if (todo.completedR.value) todo.destroy();
			}
		}

		function toggleAll() {
			const val = this.checked;
			for (const todo of todoA.value) {
				todo.completedR.setDirectly(val);
			}
		}

		const header = run(() =>
			<header class="header">
				<h1>todos</h1>
				{input}
			</header>);

		const completedAS = run(() => todoA.sfa(val => val.completedR));
		const numS = run(() => completedAS.f(val =>
			val.filter(comp => !comp).length));

		const itemsS = run(() => numS.f(len =>
			len === 1 ? 'item': 'items'));
		const todoEmptyS = run(() => todoA.f(val => val.length === 0));

		const allCompletedS = run(() => numS.f(num => num === 0));
		const noCompletedS = run(() => K.mapped({
			left: numS,
			completed: completedAS
		}).f(({ left, completed }) => left === completed.length));

		const main = run(() =>
			<section class="main" hidden={todoEmptyS}>
				<input id="toggle-all" class="toggle-all" type="checkbox"
					onclick={toggleAll} checked={allCompletedS} />
				<label for="toggle-all">Mark all as complete</label>
				<ul class="todo-list">{todoViewsA}</ul>
			</section>);

		const Tab = ({href}, ...children) => K.process((run) => {
			const classS = run(() => locationHashS.f(hash =>
				hash === href ? 'selected' : undefined));
			const item = run(() => <li>
				<a class={classS} href={href}>{children}</a>
			</li>);

			return item;
		})

		const footer = run(() =>
			<footer class="footer" hidden={todoEmptyS}>
				<span class="todo-count">
					<strong>{numS}</strong> {itemsS} left</span>
				<ul class="filters">
					<Tab href="#/">All</Tab>
					<Tab href="#/active">Active</Tab>
					<Tab href="#/completed">Completed</Tab>
				</ul>
				<button class="clear-completed" hidden={noCompletedS}
					onclick={clearCompleted}>
					Clear completed
				</button>
			</footer>);

		run(() => K.appendChildD(todoapp, header));
		run(() => K.appendChildD(todoapp, main));
		run(() => K.appendChildD(todoapp, footer));
	});
})(window, Kagome, { createElement: Kagome.kagomeElement });
