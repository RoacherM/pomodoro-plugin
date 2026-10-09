import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

function mount() {
  let plugin, component, reducer, initial, interval, cleared = false;
  const effects = [], dictionaries = new Map();
  const React = {
    createElement: (tag, props, ...children) => ({ tag, props, children }),
    useSyncExternalStore: (subscribe, snapshot) => snapshot(),
    useReducer: (fn, state) => { reducer = fn; initial = state; return [state, () => {}]; },
    useEffect: (fn) => effects.push(fn),
  };
  vm.runInNewContext(readFileSync(new URL('./client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: (entry) => {
      assert.equal(entry.id, '@local/dsh-pomodoro');
      plugin = entry.factory((id) => { assert.equal(id, 'react'); return React; });
    } } },
    setInterval: (fn) => { interval = fn; return 42; },
    clearInterval: (id) => { assert.equal(id, 42); cleared = true; },
    Date,
  });
  const disposers = [];
  plugin.apply({
    effect: (fn) => disposers.push(fn()),
    locale: {
      register: (ns, lang, dict) => { dictionaries.set(lang, dict); return () => dictionaries.delete(lang); },
      bind: () => (key) => dictionaries.get('zh-CN')[key],
      getSnapshot: () => ({ active: 'zh-CN', revision: 0 }), subscribe: () => () => {},
    },
    slots: {
      inject: (name, fn) => { assert.equal(name, 'conversation.composer.dock'); fn(); },
      register: (options, view) => { assert.equal(options.id, 'dsh-pomodoro'); component = view; },
    },
  });
  const tree = component();
  return { reducer, initial, tree, component, React, effects, disposers, dictionaries,
    hasInterval: () => !!interval, isCleared: () => cleared };
}

test('persistent factory applies without dynamic styles globals and registers component styles', () => {
  const m = mount();
  assert.equal(m.tree.children[0].tag, 'style');
  assert.equal(m.tree.props['aria-label'], '番茄钟');
  m.disposers.forEach((dispose) => dispose());
  assert.equal(m.dictionaries.size, 0);
});
test('deadline accounts for background delay; pause and resume preserve exact remaining time', () => {
  const { reducer: r, initial } = mount();
  let s = r(initial, {type:'toggle', now:1000});
  s = r(s, {type:'tick', now:61123});
  assert.equal(s.remaining, 1439877);
  s = r(s, {type:'toggle', now:61500});
  assert.equal(s.deadline, null);
  assert.equal(s.remaining, 1439500);
  s = r(s, {type:'toggle', now:100000});
  assert.equal(s.deadline, 1539500);
});
test('focus completion counts once, waits for user, then completes break', () => {
  const { reducer: r, initial } = mount();
  let s = r(initial, {type:'toggle', now:0});
  s = r(s, {type:'tick', now:1600000});
  assert.equal(s.mode, 'break'); assert.equal(s.rounds, 1);
  assert.equal(s.remaining, 300000); assert.equal(s.deadline, null);
  assert.equal(r(s, {type:'tick', now:1700000}), s);
  s = r(s, {type:'toggle', now:1800000});
  s = r(s, {type:'tick', now:2100000});
  assert.equal(s.mode, 'focus'); assert.equal(s.rounds, 1);
  assert.equal(s.remaining, 1500000);
  assert.equal(r(s, {type:'reset'}).finished, false);
});
test('reducer is pure and repeated inputs do not double-count', () => {
  const { reducer: r, initial } = mount();
  const s = Object.freeze(r(initial, {type:'toggle', now:0}));
  assert.deepEqual(r(s, {type:'tick', now:1500000}), r(s, {type:'tick', now:1500000}));
  assert.equal(s.rounds, 0);
});
test('running effect owns and disposes interval', () => {
  const m = mount();
  m.React.useReducer = () => [{...m.initial, deadline: Date.now() + 1500000}, () => {}];
  m.component();
  const cleanup = m.effects.at(-1)();
  assert.equal(m.hasInterval(), true);
  cleanup(); assert.equal(m.isCleared(), true);
});
