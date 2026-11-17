/* =====================================================================
   Live GitHub + uptime data
   window.initLive(el)         → glass panel "Live from GitHub"
   window.initStatusPill(el)   → small "● All systems operational" pill
   window.getLiveData()        → Promise<data> (shared, cached; used by the terminal's `github`)
   window.liveRelTime(iso)     → "3d ago"

   Unauthenticated GitHub REST API (60 req/h/IP). One fetch round = 4 requests,
   cached in localStorage for 30 min; failures are remembered for 5 min so a
   rate-limited visitor doesn't keep hammering the API. Nothing here blocks render.
   ===================================================================== */
(function () {
  'use strict';

  var GH_USER = 'mnishanth23';
  var SITE_REPO = 'mnishanth23.github.io';
  var API = 'https://api.github.com';
  var WORKFLOW = 'uptime.yml';
  var WORKFLOW_URL = 'https://github.com/' + GH_USER + '/' + SITE_REPO + '/actions/workflows/' + WORKFLOW;
  var CACHE_KEY = 'live-gh-v2';
  var TTL = 30 * 60 * 1000, FAIL_TTL = 5 * 60 * 1000, TIMEOUT = 8000;
  var STRIP = 30;

  var LANG_COLORS = {
    HCL: '#844FBA', Shell: '#89E051', JavaScript: '#F1E05A', TypeScript: '#3178C6', Python: '#3572A5',
    PHP: '#4F5D95', HTML: '#E34C26', CSS: '#663399', Go: '#00ADD8', Dockerfile: '#384D54',
    'Jupyter Notebook': '#DA5B0B', Java: '#B07219', YAML: '#CB171E'
  };

  /* ---------------- helpers ---------------- */
  function relTime(ts) {
    var t = new Date(ts).getTime();
    if (!isFinite(t)) return '';
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 86400 * 30) return Math.floor(s / 86400) + 'd ago';
    if (s < 86400 * 365) return Math.floor(s / (86400 * 30)) + 'mo ago';
    return Math.floor(s / (86400 * 365)) + 'y ago';
  }
  function h(tag, cls, kids, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (kids != null) {
      if (!Array.isArray(kids)) kids = [kids];
      kids.forEach(function (c) {
        if (c == null || c === false) return;
        n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return n;
  }
  // a <time> whose text stays fresh ("12 min ago" → "13 min ago")
  function ago(ts, prefix) {
    return h('time', 'lv-ago', (prefix || '') + relTime(ts), { datetime: ts, 'data-ts': ts, 'data-prefix': prefix || '', title: new Date(ts).toLocaleString() });
  }
  var ticker = null;
  function startTicker() {
    if (ticker) return;
    ticker = setInterval(function () {
      var els = document.querySelectorAll('time.lv-ago[data-ts]');
      if (!els.length) return;
      for (var i = 0; i < els.length; i++) els[i].textContent = els[i].getAttribute('data-prefix') + relTime(els[i].getAttribute('data-ts'));
    }, 60000);
  }

  function readCache() { try { var c = JSON.parse(localStorage.getItem(CACHE_KEY)); return c && c.t ? c : null; } catch (e) { return null; } }
  function writeCache(obj) { try { obj.t = Date.now(); localStorage.setItem(CACHE_KEY, JSON.stringify(obj)); } catch (e) {} }

  function getJSON(path) {
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, TIMEOUT);
    return fetch(API + path, { signal: ctrl ? ctrl.signal : undefined, credentials: 'omit' }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (r.status === 404) return { __notFound: true };
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }
  function soft(p) { return p.then(function (x) { return x; }, function () { return null; }); }

  function normalize(user, repos, commits, runs) {
    var d = { publicRepos: null, repos: [], lastDeploy: null, deployUrl: null, uptime: null };
    if (user && !user.__notFound && typeof user.public_repos === 'number') d.publicRepos = user.public_repos;
    if (Array.isArray(repos)) {
      d.repos = repos.filter(function (r) { return r && r.name && r.name.toLowerCase() !== SITE_REPO; })
        .slice(0, 3)
        .map(function (r) { return { name: r.name, url: r.html_url, lang: r.language || null, pushed: r.pushed_at }; });
    }
    if (Array.isArray(commits) && commits[0] && commits[0].commit) {
      d.lastDeploy = (commits[0].commit.committer || commits[0].commit.author || {}).date || null;
      d.deployUrl = commits[0].html_url || null;
    }
    // runs: null = request failed (unknown); 404 / no runs = monitor not started yet
    if (runs && runs.__notFound) d.uptime = { checks: [] };
    else if (runs && Array.isArray(runs.workflow_runs)) {
      d.uptime = {
        checks: runs.workflow_runs
          .filter(function (r) { return r.path === '.github/workflows/' + WORKFLOW || r.name === 'Uptime'; })
          .slice(0, 50)
          .filter(function (r) { return r.status === 'completed' && (r.conclusion === 'success' || r.conclusion === 'failure'); })
          .map(function (r) { return { ok: r.conclusion === 'success', t: r.updated_at || r.run_started_at || r.created_at, url: r.html_url }; })
      };   // API order: newest first
    }
    return d;
  }

  var inflight = null;
  function getLiveData() {
    var c = readCache(), age = c ? Date.now() - c.t : Infinity;
    if (c && c.d && age < TTL) return Promise.resolve(c.d);
    if (c && c.fail && age < FAIL_TTL) return Promise.reject(new Error('GitHub data unavailable (cached failure)'));
    if (inflight) return inflight;
    if (!window.fetch) return Promise.reject(new Error('fetch unsupported'));
    var stale = c && c.d ? c.d : null;
    inflight = Promise.all([
      soft(getJSON('/users/' + GH_USER)),
      soft(getJSON('/users/' + GH_USER + '/repos?sort=pushed&per_page=6')),
      soft(getJSON('/repos/' + GH_USER + '/' + SITE_REPO + '/commits?per_page=1')),
      // scheduled runs of the repo, filtered to uptime.yml below. (The per-workflow endpoint
      // /actions/workflows/uptime.yml/runs 404s — a console error — until the workflow exists.)
      soft(getJSON('/repos/' + GH_USER + '/' + SITE_REPO + '/actions/runs?event=schedule&per_page=60'))
    ]).then(function (res) {
      inflight = null;
      var d = normalize(res[0], res[1], res[2], res[3]);
      if (d.publicRepos == null && !d.repos.length && !d.lastDeploy) {
        if (stale) return stale;               // rate-limited / offline: fall back to old data
        writeCache({ fail: true });
        throw new Error('GitHub data unavailable');
      }
      writeCache({ d: d });
      return d;
    });
    return inflight;
  }

  function uptimeSummary(u) {
    if (!u) return null;
    var n = u.checks.length;
    if (!n) return { n: 0 };
    var okN = u.checks.filter(function (c) { return c.ok; }).length;
    var pct = okN / n * 100;
    var txt = okN === n ? '100%' : (Math.floor(pct * 10) / 10).toFixed(1) + '%';   // floor: never round 99.96 up to 100
    return { n: n, ok: okN, pct: pct, txt: txt, latest: u.checks[0] };
  }

  /* ---------------- panel ---------------- */
  function skeleton() {
    return h('div', 'lv-skel', [h('span'), h('span'), h('span'), h('span')], { 'aria-hidden': 'true' });
  }

  function initLive(el) {
    if (!el || el.__lvInit) return;
    el.__lvInit = true;
    var lvl = el.getAttribute('data-heading-level') || '3';
    var uid = 'lv' + Math.random().toString(36).slice(2, 8);
    var content = h('div', 'lv-content', skeleton());
    var panel = h('section', 'lv-panel', [
      h('div', 'lv-head', [
        h('span', 'lv-pulse', null, { 'aria-hidden': 'true' }),
        h('h' + lvl, 'lv-title', 'Live from GitHub', { id: uid + '-t' }),
        h('a', 'lv-handle', '@' + GH_USER, { href: 'https://github.com/' + GH_USER, target: '_blank', rel: 'noopener noreferrer' })
      ]),
      content
    ], { 'aria-labelledby': uid + '-t', 'aria-busy': 'true' });
    el.textContent = '';
    el.appendChild(panel);

    getLiveData().then(function (d) {
      content.textContent = '';
      panel.removeAttribute('aria-busy');

      var kpis = h('div', 'lv-kpis');
      if (d.publicRepos != null) kpis.appendChild(h('div', 'lv-kpi', [h('span', 'lv-num', String(d.publicRepos)), h('span', 'lv-lab', 'public repos')]));
      if (d.lastDeploy) {
        var dep = d.deployUrl ? h('a', 'lv-num lv-num-sm', ago(d.lastDeploy), { href: d.deployUrl, target: '_blank', rel: 'noopener noreferrer' }) : h('span', 'lv-num lv-num-sm', ago(d.lastDeploy));
        kpis.appendChild(h('div', 'lv-kpi', [dep, h('span', 'lv-lab', 'last deploy of this site')]));
      }
      if (kpis.childNodes.length) content.appendChild(kpis);

      if (d.repos.length) {
        content.appendChild(h('p', 'lv-sub', 'Recently pushed'));
        var ul = h('ul', 'lv-repos');
        d.repos.forEach(function (r) {
          ul.appendChild(h('li', null, [
            h('a', 'lv-repo', r.name, { href: r.url, target: '_blank', rel: 'noopener noreferrer' }),
            h('span', 'lv-meta', [
              r.lang ? h('span', 'lv-lang', [h('i', null, null, { style: 'background:' + (LANG_COLORS[r.lang] || 'var(--muted, #8E8E94)'), 'aria-hidden': 'true' }), r.lang]) : null,
              ago(r.pushed, 'updated ')
            ])
          ]));
        });
        content.appendChild(ul);
      }

      var u = uptimeSummary(d.uptime);
      if (u) content.appendChild(uptimeBlock(d.uptime, u));
      startTicker();
    }, function () {
      panel.removeAttribute('aria-busy');
      panel.classList.add('is-error');
      content.textContent = '';
      content.appendChild(h('p', 'lv-error', ['GitHub data unavailable right now — ',
        h('a', null, 'view profile', { href: 'https://github.com/' + GH_USER, target: '_blank', rel: 'noopener noreferrer' })]));
    });
    return panel;
  }

  function uptimeBlock(up, u) {
    var wrap = h('div', 'lv-uptime');
    if (!u.n) {
      wrap.appendChild(h('p', 'lv-up-row', [h('span', 'lv-lab', 'Uptime'), h('span', 'lv-up-wait', 'Uptime monitor starting…')]));
      return wrap;
    }
    wrap.appendChild(h('p', 'lv-up-row', [
      h('span', 'lv-lab', 'Uptime (last ' + u.n + ' check' + (u.n === 1 ? '' : 's') + ')'),
      h('a', 'lv-up-pct' + (u.pct < 99 ? ' is-low' : ''), u.txt, { href: WORKFLOW_URL, target: '_blank', rel: 'noopener noreferrer' })
    ]));
    var last = up.checks.slice(0, STRIP).reverse();     // oldest → newest, left → right
    var fails = last.filter(function (c) { return !c.ok; }).length;
    var strip = h('div', 'lv-strip', null, { role: 'img', 'aria-label': 'Last ' + last.length + ' checks: ' + (last.length - fails) + ' passed, ' + fails + ' failed' });
    for (var i = last.length; i < STRIP; i++) strip.appendChild(h('span', 'lv-bar is-empty'));
    last.forEach(function (c) {
      strip.appendChild(h('span', 'lv-bar ' + (c.ok ? 'is-ok' : 'is-fail'), null, { title: (c.ok ? 'OK' : 'Failed') + ' · ' + new Date(c.t).toLocaleString() }));
    });
    wrap.appendChild(strip);
    wrap.appendChild(h('p', 'lv-up-foot', [ago(u.latest.t, 'last checked '), h('span', null, ' · every 30 min via GitHub Actions')]));
    return wrap;
  }

  /* ---------------- status pill ---------------- */
  function initStatusPill(el) {
    if (!el || el.__lvPill) return;
    el.__lvPill = true;
    el.hidden = true;                     // only appears once there is something true to say
    getLiveData().then(function (d) {
      var u = uptimeSummary(d.uptime);
      if (!u) return;
      var state, text;
      if (!u.n) { state = 'pending'; text = 'Uptime monitor starting'; }
      else if (u.latest.ok) { state = 'ok'; text = 'All systems operational'; }
      else { state = 'down'; text = 'Degraded'; }
      el.textContent = '';
      el.appendChild(h('a', 'lv-pill is-' + state, [h('span', 'lv-pill-dot', null, { 'aria-hidden': 'true' }), h('span', null, text)], {
        href: WORKFLOW_URL, target: '_blank', rel: 'noopener noreferrer',
        title: u.n ? 'Uptime ' + u.txt + ' over the last ' + u.n + ' checks' : 'Uptime checks run every 30 minutes'
      }));
      el.hidden = false;
    }, function () { /* stay hidden */ });
  }

  window.getLiveData = getLiveData;
  window.liveRelTime = relTime;
  window.initLive = initLive;
  window.initStatusPill = initStatusPill;
})();
