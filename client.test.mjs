import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const TRIGGER = 'conversation.input.right';
const PANEL = 'shell.overlay';

/** Load client.js as the page's module loader would, with a recorded interval clock. */
function mount() {
  let plugin;
  const intervals = new Map();
  let nextId = 1;
  const head = [];
  const document = {
    head: { appendChild: (tag) => head.push(tag) },
    createElement: () => { const tag = { dataset: {}, remove: () => head.splice(head.indexOf(tag), 1) }; return tag; },
    addEventListener() {}, removeEventListener() {},
  };
  vm.runInNewContext(readFileSync(new URL('./client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: (entry) => {
      assert.equal(entry.id, '@local/dsh-pomodoro');
      plugin = entry.factory((id) => { assert.equal(id, 'react'); return React; });
    } } },
    document,
    setInterval: (fn) => { intervals.set(nextId, fn); return nextId++; },
    clearInterval: (id) => intervals.delete(id),
    Date,
  });
  const disposers = [], dictionaries = new Map(), views = new Map();
  plugin.apply({
    effect: (fn) => disposers.push(fn()),
    locale: {
      register: (ns, lang, dict) => { assert.equal(ns, 'local-pomodoro'); dictionaries.set(lang, dict); return () => dictionaries.delete(lang); },
      bind: () => (key) => dictionaries.get('zh')[key],
    },
    slots: { inject: (name, fn) => fn(), register: (options, view) => { views.set(options.name, { options, view }); } },
  });
  const t = (key) => dictionaries.get('zh')[key];
  const render = (slot) => renderToStaticMarkup(React.createElement(views.get(slot).view, { t }));
  /** Call a view as a plain function (effects skipped) to reach its event handlers. */
  const shallow = (slot) => {
    const { useEffect, useSyncExternalStore } = React;
    React.useEffect = () => {};
    React.useSyncExternalStore = (subscribe, get) => get();
    try { return views.get(slot).view({ t }); } finally { Object.assign(React, { useEffect, useSyncExternalStore }); }
  };
  const openPanel = () => shallow(TRIGGER).props.onClick();
  const primary = () => shallow(PANEL).props.children.at(-1).props.children[0].props.onClick();
  return { plugin, head, intervals, disposers, dictionaries, views, render, openPanel, primary };
}

test('registers the trigger in the composer and the panel in the overlay layer, and disposes everything', () => {
  const m = mount();
  assert.deepEqual([...m.views.keys()], [TRIGGER, PANEL]);
  assert.equal(m.views.get(TRIGGER).options.id, 'dsh-pomodoro-trigger');
  assert.equal(m.views.get(PANEL).options.id, 'dsh-pomodoro-panel');
  assert.equal(m.views.get(PANEL).options.label(), '番茄钟');
  assert.equal(m.head.length, 1);
  assert.deepEqual(Object.keys(m.dictionaries.get('en')).sort(), Object.keys(m.dictionaries.get('zh')).sort());
  m.disposers.forEach((dispose) => dispose());
  assert.equal(m.head.length, 0);
  assert.equal(m.dictionaries.size, 0);
});

test('the overlay panel is hidden until the composer trigger opens it', () => {
  const m = mount();
  assert.equal(m.render(PANEL), '');
  assert.match(m.render(TRIGGER), /aria-label="打开番茄钟"[^>]*aria-expanded="false"/);
  m.openPanel();
  assert.match(m.render(TRIGGER), /aria-expanded="true"/);
  const panel = m.render(PANEL);
  assert.match(panel, /role="dialog" aria-label="番茄钟"/);
  assert.match(panel, /25:00/);
  assert.match(readFileSync(new URL('./client.js', import.meta.url), 'utf8'), /\.dsh-pomodoro-panel \{[^}]*pointer-events:auto/);
});

test('timer state lives in the page, so every trigger instance sees the running countdown', () => {
  const m = mount();
  m.openPanel();
  m.primary(); // start
  assert.match(m.render(TRIGGER), /dsh-pomodoro-trigger-dot/);
  assert.match(m.render(TRIGGER), /dsh-pomodoro-trigger-dot/); // a second (remounted) instance too
  assert.match(m.render(PANEL), />暂停</);
});

test('the plugin owns one ticker: running only while counting down, cleared on pause and dispose', () => {
  const m = mount();
  m.openPanel();
  assert.equal(m.intervals.size, 0);
  m.primary();
  assert.equal(m.intervals.size, 1);
  m.primary(); // pause
  assert.equal(m.intervals.size, 0);
  m.primary(); // resume
  assert.equal(m.intervals.size, 1);
  m.disposers.forEach((dispose) => dispose());
  assert.equal(m.intervals.size, 0);
});

test('deadline accounts for background delay; pause and resume preserve exact remaining time', () => {
  const { reduce: r, initial } = mount().plugin.model;
  let s = r(initial, { type: 'toggle', now: 1000 });
  s = r(s, { type: 'tick', now: 61123 });
  assert.equal(s.remaining, 1439877);
  s = r(s, { type: 'toggle', now: 61500 });
  assert.equal(s.deadline, null);
  assert.equal(s.remaining, 1439500);
  s = r(s, { type: 'toggle', now: 100000 });
  assert.equal(s.deadline, 1539500);
});

test('focus completion counts once, keeps the panel open, waits for user, then completes break', () => {
  const { reduce: r, initial } = mount().plugin.model;
  let s = r(r(initial, { type: 'toggleExpand' }), { type: 'toggle', now: 0 });
  s = r(s, { type: 'tick', now: 1600000 });
  assert.equal(s.mode, 'break'); assert.equal(s.rounds, 1);
  assert.equal(s.expanded, true);
  assert.equal(s.finished, true);
  assert.equal(s.remaining, 300000); assert.equal(s.deadline, null);
  assert.equal(r(s, { type: 'tick', now: 1700000 }), s);
  s = r(s, { type: 'toggle', now: 1800000 });
  s = r(s, { type: 'tick', now: 2100000 });
  assert.equal(s.mode, 'focus'); assert.equal(s.rounds, 1);
  assert.equal(s.remaining, 1500000);
  assert.equal(r(s, { type: 'reset' }).finished, false);
});

test('reducer is pure, repeated inputs do not double-count, and close is idempotent', () => {
  const { reduce: r, initial } = mount().plugin.model;
  const s = Object.freeze(r(initial, { type: 'toggle', now: 0 }));
  assert.deepEqual(r(s, { type: 'tick', now: 1500000 }), r(s, { type: 'tick', now: 1500000 }));
  assert.equal(s.rounds, 0);
  assert.equal(r(initial, { type: 'close' }), initial);
});
