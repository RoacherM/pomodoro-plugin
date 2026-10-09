window.__ModuleLoader__.load({
  id: '@local/dsh-pomodoro',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'local-pomodoro';
    const duration = { focus: 25 * 60 * 1000, break: 5 * 60 * 1000 };
    const initial = { mode: 'focus', remaining: duration.focus, deadline: null, rounds: 0, finished: false, expanded: false };

    function settle(state, now) {
      if (state.deadline === null) return state;
      const remaining = Math.max(0, state.deadline - now);
      if (remaining > 0) return { ...state, remaining };
      const mode = state.mode === 'focus' ? 'break' : 'focus';
      return { ...state, mode, remaining: duration[mode], deadline: null,
        rounds: state.rounds + (state.mode === 'focus' ? 1 : 0), finished: true };
    }

    function reduce(state, action) {
      if (action.type === 'reset') return { ...initial, rounds: state.rounds, expanded: state.expanded };
      if (action.type === 'tick') return settle(state, action.now);
      if (action.type === 'toggle') {
        if (state.deadline === null) return { ...state, deadline: action.now + state.remaining, finished: false };
        return { ...settle(state, action.now), deadline: null };
      }
      if (action.type === 'toggleExpand') return { ...state, expanded: !state.expanded };
      if (action.type === 'close') return state.expanded ? { ...state, expanded: false } : state;
      return state;
    }

    const css = `
      .dsh-pomodoro-trigger { display:flex; align-items:center; justify-content:center; width:32px; height:32px; border:none; border-radius:6px; padding:0; color:var(--dsw-alias-label-primary); background:transparent; cursor:pointer; position:relative; }
      .dsh-pomodoro-trigger:hover { background:var(--dsw-alias-interactive-bg-hover); }
      .dsh-pomodoro-trigger:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
      .dsh-pomodoro-trigger svg { width:18px; height:18px; fill:currentColor; }
      .dsh-pomodoro-trigger-dot { position:absolute; top:4px; right:4px; width:6px; height:6px; border-radius:50%; background:var(--dsh-pomodoro-accent); }
      .dsh-pomodoro-trigger-dot.is-finished { background:var(--dsw-alias-state-warning-primary); animation:dsh-pomodoro-pulse 1.2s ease-in-out infinite; }
      @keyframes dsh-pomodoro-pulse { 0%, 100% { transform:scale(1); } 50% { transform:scale(1.6); } }

      .dsh-pomodoro-panel { position:absolute; right:24px; bottom:24px; width:320px; border:1px solid var(--dsw-alias-border-l1); border-radius:12px; padding:0; background:var(--dsw-alias-bg-layer-1); box-shadow:0 8px 24px rgba(0,0,0,0.12); pointer-events:auto; animation:dsh-pomodoro-slide-in 0.2s ease-out; }
      @keyframes dsh-pomodoro-slide-in { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }

      .dsh-pomodoro-header { display:flex; align-items:center; justify-content:space-between; padding:16px 16px 12px; border-bottom:1px solid var(--dsw-alias-border-l1); }
      .dsh-pomodoro-header-title { display:flex; align-items:center; gap:8px; color:var(--dsw-alias-label-primary); font-size:14px; font-weight:600; }
      .dsh-pomodoro-header-title .dsh-pomodoro-dot { width:8px; height:8px; border-radius:50%; background:var(--dsh-pomodoro-accent); }
      .dsh-pomodoro-header button { border:none; padding:4px; color:var(--dsw-alias-label-secondary); background:transparent; cursor:pointer; border-radius:4px; }
      .dsh-pomodoro-header button:hover { background:var(--dsw-alias-interactive-bg-hover); }

      .dsh-pomodoro-body { padding:20px 16px 16px; text-align:center; }
      .dsh-pomodoro-time { display:block; color:var(--dsh-pomodoro-accent); font-size:48px; font-weight:700; font-variant-numeric:tabular-nums; letter-spacing:-1px; margin-bottom:12px; }
      .dsh-pomodoro-status { display:flex; align-items:center; justify-content:center; gap:8px; color:var(--dsw-alias-label-secondary); font-size:13px; margin-bottom:16px; }
      .dsh-pomodoro-rounds { color:var(--dsw-alias-label-tertiary); font-size:12px; margin-bottom:20px; }

      .dsh-pomodoro-progress { height:4px; margin:0 16px 16px; overflow:hidden; border-radius:2px; background:var(--dsw-alias-border-l1); }
      .dsh-pomodoro-progress > span { display:block; height:100%; transform-origin:left center; background:var(--dsh-pomodoro-accent); transition:transform 250ms linear; }

      .dsh-pomodoro-actions { display:flex; gap:8px; padding:0 16px 16px; }
      .dsh-pomodoro-actions button { flex:1; border:1px solid var(--dsw-alias-border-l1); border-radius:8px; padding:10px 16px; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-1); cursor:pointer; font:inherit; font-weight:500; transition:all 0.15s; }
      .dsh-pomodoro-actions button:hover { background:var(--dsw-alias-interactive-bg-hover); transform:translateY(-1px); }
      .dsh-pomodoro-actions button:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
      .dsh-pomodoro-actions .dsh-pomodoro-primary { border-color:var(--dsh-pomodoro-accent); background:var(--dsh-pomodoro-accent); color:white; }
      .dsh-pomodoro-actions .dsh-pomodoro-primary:hover { opacity:0.9; background:var(--dsh-pomodoro-accent); }

      .dsh-pomodoro-notice { padding:0 16px 16px; color:var(--dsw-alias-state-warning-primary); font-size:12px; text-align:center; }

      @media (max-width: 480px) {
        .dsh-pomodoro-panel { right:12px; bottom:12px; width:calc(100% - 24px); max-width:320px; }
      }
    `;

    const dictionaries = {
      en: {
        title:'Pomodoro', focus:'Focus', break:'Break', completed:'Completed', rounds:'rounds',
        start:'Start', pause:'Pause', reset:'Reset', close:'Close',
        startLabel:'Start timer', pauseLabel:'Pause timer', resetLabel:'Reset Pomodoro', closeLabel:'Close panel',
        openLabel:'Open Pomodoro timer',
        finished:'🎉 Time is up! Start the next stage when ready.',
      },
      zh: {
        title:'番茄钟', focus:'专注', break:'休息', completed:'完成', rounds:'轮',
        start:'开始', pause:'暂停', reset:'重置', close:'关闭',
        startLabel:'开始计时', pauseLabel:'暂停计时', resetLabel:'重置番茄钟', closeLabel:'关闭面板',
        openLabel:'打开番茄钟',
        finished:'🎉 时间到！准备好后开始下一阶段。',
      },
    };

    const accentOf = (state) => (state.mode === 'focus' ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-state-success-primary)');

    return {
      inject: ['slots', 'locale'],
      model: { duration, initial, reduce },
      apply(ctx) {
        for (const [language, dictionary] of Object.entries(dictionaries)) {
          ctx.effect(() => ctx.locale.register(NS, language, dictionary), 'pomodoro: dictionary ' + language);
        }
        const bound = ctx.locale.bind(NS);

        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = '@local/dsh-pomodoro';
          tag.textContent = css;
          document.head.appendChild(tag);
          return () => tag.remove();
        }, 'pomodoro: styles');

        // One timer per page: it outlives session switches and composer remounts, and the plugin owns its tick.
        const listeners = new Set();
        let state = initial;
        let ticker = null;
        const store = {
          get: () => state,
          subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
          dispatch(action) {
            const next = reduce(state, action);
            if (next === state) return;
            state = next;
            if (state.deadline !== null && ticker === null) ticker = setInterval(() => store.dispatch({ type: 'tick', now: Date.now() }), 250);
            if (state.deadline === null && ticker !== null) { clearInterval(ticker); ticker = null; }
            listeners.forEach((listener) => listener());
          },
        };
        ctx.effect(() => () => { if (ticker !== null) clearInterval(ticker); ticker = null; }, 'pomodoro: ticker');

        const useTimer = () => React.useSyncExternalStore(store.subscribe, store.get, store.get);
        const translator = (props) => (typeof props.t === 'function' ? props.t : bound);

        // Compact trigger in the composer tool row of every session.
        function PomodoroTrigger(props) {
          const t = translator(props);
          const s = useTimer();
          const running = s.deadline !== null;
          return h('button', {
            type: 'button', className: 'dsh-pomodoro-trigger', 'data-pomodoro-trigger': '',
            onClick: () => store.dispatch({ type: 'toggleExpand' }),
            'aria-label': t('openLabel'), title: t('title'), 'aria-expanded': s.expanded,
            style: { '--dsh-pomodoro-accent': accentOf(s) },
          },
            h('svg', { viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true },
              h('path', { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z' })),
            running || s.finished
              ? h('span', { className: 'dsh-pomodoro-trigger-dot' + (s.finished ? ' is-finished' : ''), 'aria-hidden': true })
              : null);
        }

        // Floating panel in the frame-wide overlay layer, mounted once per page.
        function PomodoroPanel(props) {
          const t = translator(props);
          const s = useTimer();
          const running = s.deadline !== null;

          React.useEffect(() => {
            if (!s.expanded) return undefined;
            const onKey = (event) => { if (event.key === 'Escape') store.dispatch({ type: 'close' }); };
            document.addEventListener('keydown', onKey);
            return () => document.removeEventListener('keydown', onKey);
          }, [s.expanded]);

          if (!s.expanded) return null;
          const seconds = Math.ceil(s.remaining / 1000);
          const time = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
          const progress = Math.min(1, Math.max(0, 1 - s.remaining / duration[s.mode]));

          return h('div', {
            className: 'dsh-pomodoro-panel', role: 'dialog', 'aria-label': t('title'),
            style: { '--dsh-pomodoro-accent': accentOf(s) },
          },
            h('div', { className: 'dsh-pomodoro-header' },
              h('div', { className: 'dsh-pomodoro-header-title' },
                h('span', { className: 'dsh-pomodoro-dot', 'aria-hidden': true }),
                h('span', null, t('title'))),
              h('button', { type: 'button', onClick: () => store.dispatch({ type: 'close' }), 'aria-label': t('closeLabel') }, '✕')),
            h('div', { className: 'dsh-pomodoro-body' },
              h('strong', { className: 'dsh-pomodoro-time', role: 'timer', 'aria-live': 'off' }, time),
              h('div', { className: 'dsh-pomodoro-status' }, h('span', null, t(s.mode))),
              h('div', { className: 'dsh-pomodoro-rounds' }, t('completed') + ' ' + s.rounds + ' ' + t('rounds'))),
            h('div', { className: 'dsh-pomodoro-progress', 'aria-hidden': true },
              h('span', { style: { transform: 'scaleX(' + progress + ')' } })),
            s.finished ? h('div', { className: 'dsh-pomodoro-notice', role: 'status' }, t('finished')) : null,
            h('div', { className: 'dsh-pomodoro-actions' },
              h('button', {
                type: 'button', className: 'dsh-pomodoro-primary',
                onClick: () => store.dispatch({ type: 'toggle', now: Date.now() }),
                'aria-label': t(running ? 'pauseLabel' : 'startLabel'),
              }, t(running ? 'pause' : 'start')),
              h('button', { type: 'button', onClick: () => store.dispatch({ type: 'reset' }), 'aria-label': t('resetLabel') }, t('reset'))));
        }

        ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
          name: 'conversation.input.right', id: 'dsh-pomodoro-trigger', order: 100, locale: NS, label: () => bound('title'),
        }, PomodoroTrigger));

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: 'dsh-pomodoro-panel', order: 50, locale: NS, label: () => bound('title'),
        }, PomodoroPanel));
      },
    };
  },
});
