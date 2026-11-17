/* =====================================================================
   Live DevOps terminal — window.initTerminal(el, { base: '' })
   - el:   an empty container element (e.g. <div id="term"></div>)
   - base: path prefix for site links (projects/, blog/, resume.pdf).
           '' on index.html; '../' from a page one folder deep.
           Can also be given as data-base="../" on the element.
   All content is static and factual; output is built with DOM nodes only.
   ===================================================================== */
(function () {
  'use strict';

  var USER = 'nishanth@portfolio', CWD = '~';

  /* ---------------- data (keep factual) ---------------- */
  var EXPERIENCE = [
    ['Jan 2026 – Present', 'Associate DevOps Engineer', true],
    ['Jun – Dec 2025', 'Junior DevOps Engineer'],
    ['Jan – May 2025', 'SRE Trainee'],
    ['Jul – Dec 2024', 'SRE Intern']
  ];
  var SKILLS = [
    ['CI/CD', 'Drone CI, Jenkins, Kaniko, Harbor, Trivy, Git'],
    ['Containers', 'Docker, Docker Compose'],
    ['Cloud', 'AWS (EC2, IAM, S3)'],
    ['Observability', 'Prometheus, Grafana, ELK, OpenTelemetry, Uptime Kuma, DCGM exporter'],
    ['Databases', 'PostgreSQL, MariaDB, MongoDB, Redis, ClickHouse'],
    ['AI infra', 'vLLM, NVIDIA A100'],
    ['Scripting', 'Python, Bash, Linux']
  ];
  var PROJECTS = [
    ['blue-green-aks', 'In-progress', 'personal'],
    ['drone-pipeline-hardening', 'Running', 'work'],
    ['messaging-data-stack', 'Running', 'work'],
    ['observability-capacity', 'Running', 'work'],
    ['gpu-llm-ocr-serving', 'Running', 'work'],
    ['lstm-phishing-detection', 'Completed', 'academic']
  ];
  var STATS = [
    ['Environment provisioning', '2 days → 7–8 hours'],
    ['Database provisioning', 'under 5 minutes'],
    ['Production incidents', '1–2/month as primary responder'],
    ['Prometheus retention fix', 'freed ~108 GB']
  ];
  var POSTS = [
    ['blog/elasticsearch-7-11-to-7-17-upgrade.html', 'Elasticsearch 7.11.2 → 7.17.28: the required stop before 8.x'],
    ['blog/prometheus-retention-108gb.html', 'How Prometheus retention ate 108 GB, and the one-line fix'],
    ['blog/jenkins-to-drone-migration.html', 'Moving from Jenkins to Drone CI: what changed, and what I’d do again']
  ];
  var HELP = [
    ['ls', 'list what is here'],
    ['cd experience', 'roles at SMI Tech Group'],
    ['cd skills', 'tools I work with'],
    ['cd projects', 'projects (cd projects/<name> for a case study)'],
    ['cd stats', 'numbers from real work'],
    ['cd blog', 'write-ups'],
    ['cd contact', 'email, GitHub, LinkedIn'],
    ['cat resume.pdf', 'link to my résumé (PDF)'],
    ['whoami', 'who I am'],
    ['github', 'live data from GitHub'],
    ['pwd', 'where you are'],
    ['cd ..', 'go back home'],
    ['history', 'previous commands (↑/↓ also work)'],
    ['clear', 'clear the screen']
  ];
  var DIRS = ['experience', 'skills', 'projects', 'stats', 'blog', 'contact'];
  var COMPLETIONS = ['help', 'whoami', 'ls', 'pwd', 'cd ..', 'cd ~', 'cat resume.pdf', 'kubectl get projects', 'ssh contact', 'github', 'clear', 'history']
    .concat(DIRS.map(function (d) { return 'cd ' + d; }));

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* tiny DOM builder: h('span', 'cls', [children|text], {attr: v}) */
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
  function ext(href, text) { return h('a', null, text || href.replace(/^https?:\/\/(www\.)?/, ''), { href: href, target: '_blank', rel: 'noopener noreferrer' }); }
  function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

  function relTime(ts) {
    if (window.liveRelTime) return window.liveRelTime(ts);
    var s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  function initTerminal(el, opts) {
    if (!el || el.__ltInit) return;
    el.__ltInit = true;
    opts = opts || {};
    var base = opts.base != null ? opts.base : (el.getAttribute('data-base') || '');
    var uid = 'lt' + Math.random().toString(36).slice(2, 8);
    function site(p) { return base + p; }
    var cwd = '';                                   // '' = home (~), else one of DIRS
    function cwdLabel() { return cwd ? '~/' + cwd : CWD; }
    function setCwd(d) {
      cwd = d;
      var old = line.querySelector('.lt-prompt'); if (old) old.replaceWith(promptNode());
      var t = term.querySelector('.lt-title'); if (t) t.textContent = USER + ': ' + cwdLabel();
    }

    /* ---------- build the window ---------- */
    var log = h('div', 'lt-log', null, { role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', 'aria-label': 'Terminal output' });
    var input = h('input', 'lt-input', null, {
      id: uid + '-in', type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off',
      spellcheck: 'false', enterkeyhint: 'send', 'aria-describedby': uid + '-hint'
    });
    var cursor = h('span', 'lt-cursor', null, { 'aria-hidden': 'true' });
    var line = h('form', 'lt-line is-busy', [
      h('label', 'lt-sr', 'Terminal command', { for: uid + '-in' }),
      promptNode(), cursor, input
    ], { autocomplete: 'off' });
    var hint = h('p', 'lt-sr', 'Type a command such as help, then press Enter. Tab completes, up and down arrows browse history.', { id: uid + '-hint' });
    var body = h('div', 'lt-body', [log, line, hint]);
    var term = h('div', 'lt-term', [
      h('div', 'lt-bar', [
        h('span', 'lt-dot', null, { 'aria-hidden': 'true' }),
        h('span', 'lt-dot', null, { 'aria-hidden': 'true' }),
        h('span', 'lt-dot', null, { 'aria-hidden': 'true' }),
        h('span', 'lt-title', USER + ': ' + CWD)
      ]),
      body
    ], { role: 'region', 'aria-label': 'Interactive terminal' });
    el.textContent = '';
    el.appendChild(term);

    function promptNode() {
      return h('span', 'lt-prompt', [h('span', 'lt-p-user', USER), h('span', 'lt-p-sep', ':' + cwdLabel() + '$ ')], { 'aria-hidden': 'true' });
    }
    function scrollEnd() { body.scrollTop = body.scrollHeight; }   // internal scroll only — never moves the page
    function row(kids, cls) { return h('div', 'lt-row' + (cls ? ' ' + cls : ''), kids); }
    function print(node) { log.appendChild(node); scrollEnd(); return node; }
    function echo(cmd) {
      return print(row([promptNode(), h('span', 'lt-sr', '$ '), h('span', 'lt-cmd', cmd)], 'lt-cmdline'));
    }
    function block(kids) { return print(h('div', 'lt-block', kids)); }
    function kv(pairs, stack) {
      var dl = h('dl', 'lt-kv' + (stack ? ' lt-kv-stack' : ''));
      pairs.forEach(function (p) { dl.appendChild(h('dt', null, p[0])); dl.appendChild(h('dd', null, p[1])); });
      return dl;
    }
    function chip(cmd, label) {
      var b = h('button', 'lt-chip', label || cmd, { type: 'button', 'aria-label': 'Run ' + cmd });
      b.addEventListener('click', function (e) { e.stopPropagation(); finishIntro(); run(cmd); });
      return b;
    }

    /* ---------- commands ---------- */
    var C = {};
    C.help = function () {
      block([
        row(h('span', 'lt-muted', 'Available commands (click or type):')),
        (function () { var d = kv(HELP.map(function (x) { return [chip(x[0]), h('span', 'lt-muted', x[1])]; })); d.classList.add('lt-kv-help'); return d; })()
      ]);
    };
    C.whoami = function () {
      block([
        row([h('span', 'lt-strong', 'Nishanth M'), ' — DevOps Engineer | SRE']),
        row(h('span', 'lt-muted', 'SMI Tech Group · Madurai, Tamil Nadu'))
      ]);
    };
    C.experience = function () {
      block([
        row(h('span', 'lt-muted', '# SMI Tech Group — newest first')),
        kv(EXPERIENCE.map(function (x) {
          return [h('span', x[2] ? 'lt-ok' : 'lt-muted', (x[2] ? '● ' : '○ ') + x[0]), h('span', x[2] ? 'lt-strong' : null, x[1])];
        }), true)
      ]);
    };
    C.skills = function () { block([kv(SKILLS.map(function (x) { return [x[0], x[1]]; }), true)]); };
    C.projects = function () {
      var w0 = 26, w1 = 13;
      var pre = h('div', 'lt-table');
      pre.appendChild(h('div', 'lt-th', pad('NAME', w0) + pad('STATUS', w1) + 'TYPE'));
      PROJECTS.forEach(function (p) {
        var stCls = p[1] === 'Running' ? 'lt-ok' : p[1] === 'Completed' ? 'lt-muted' : 'lt-warn';
        pre.appendChild(h('div', null, [
          h('a', null, p[0], { href: site('projects/' + p[0] + '.html') }),
          pad('', w0 - p[0].length),
          h('span', stCls, pad(p[1], w1)),
          p[2]
        ]));
      });
      block([pre]);
    };
    C.stats = function () { block([kv(STATS.map(function (x) { return [x[0], h('span', 'lt-strong', x[1])]; }), true)]); };
    C.blog = function () {
      block(POSTS.map(function (p) {
        return row([h('span', 'lt-red', '→ '), h('a', null, p[1], { href: site(p[0]) })]);
      }).concat([row([h('span', 'lt-muted', 'all posts: '), h('a', null, 'blog/', { href: site('blog/') })])]));
    };
    C.contact = function () {
      block([kv([
        ['email', h('a', null, 'imnishanth23@gmail.com', { href: 'mailto:imnishanth23@gmail.com' })],
        ['github', ext('https://github.com/mnishanth23', 'github.com/mnishanth23')],
        ['linkedin', ext('https://www.linkedin.com/in/mnishanth23', 'linkedin.com/in/mnishanth23')]
      ])]);
    };
    C.resume = function () {
      block([
        row(h('span', 'lt-muted', 'Nishanth M — résumé (PDF, opens in a new tab):')),
        row([h('span', 'lt-red', '→ '), h('a', null, 'resume.pdf', { href: site('resume.pdf'), target: '_blank', rel: 'noopener' })])
      ]);
    };
    C.github = function () {
      if (typeof window.getLiveData !== 'function') {
        block([row(['Find my code at ', ext('https://github.com/mnishanth23', 'github.com/mnishanth23')])]);
        return;
      }
      var wait = block([row(h('span', 'lt-muted', 'GET api.github.com/users/mnishanth23 …'))]);
      window.getLiveData().then(function (d) {
        wait.textContent = '';
        var kids = [];
        if (d.publicRepos != null) kids.push(row([h('span', 'lt-strong', String(d.publicRepos)), ' public repositories']));
        if (d.repos && d.repos.length) {
          kids.push(row(h('span', 'lt-muted', 'recently pushed:')));
          kids.push(kv(d.repos.slice(0, 3).map(function (r) {
            return [ext(r.url, r.name), h('span', 'lt-muted', (r.lang ? r.lang + ' · ' : '') + 'updated ' + relTime(r.pushed))];
          }), true));
        }
        if (d.lastDeploy) kids.push(row([h('span', 'lt-muted', 'last deploy of this site: '), relTime(d.lastDeploy)]));
        kids.push(row([h('span', 'lt-muted', 'profile: '), ext('https://github.com/mnishanth23', 'github.com/mnishanth23')]));
        kids.forEach(function (k) { wait.appendChild(k); });
        scrollEnd();
      }, function () {
        wait.textContent = '';
        wait.appendChild(row([h('span', 'lt-warn', 'GitHub API unavailable right now'), ' — see ', ext('https://github.com/mnishanth23', 'github.com/mnishanth23')]));
        scrollEnd();
      });
    };
    C.history = function () {
      if (!hist.length) { block([row(h('span', 'lt-muted', 'no history yet'))]); return; }
      block(hist.map(function (c, i) { return row([h('span', 'lt-muted', pad(String(i + 1), 4)), c]); }));
    };
    C.clear = function () { log.textContent = ''; };
    C.ls = function () {
      if (cwd && C[cwd]) { C[cwd](); return; }    // inside a folder: show its contents
      var kids = []; DIRS.forEach(function (d) { kids.push(chip('cd ' + d, d + '/'), '  '); });
      kids.push(h('a', null, 'resume.pdf', { href: site('resume.pdf'), target: '_blank', rel: 'noopener' }));
      block([row(kids)]);
    };
    C.pwd = function () { block([row('/home/nishanth' + (cwd ? '/' + cwd : ''))]); };
    function cd(arg) {
      arg = (arg || '').replace(/\/+$/, '').replace(/^~\/?/, '').replace(/^\.\//, '');
      if (!arg || arg === '/' ) { setCwd(''); return; }
      if (arg === '..') { setCwd(''); return; }
      var parts = arg.split('/');
      var dir = parts[0], sub = parts[1];
      if (cwd === 'projects' && !sub && DIRS.indexOf(dir) < 0) { sub = dir; dir = 'projects'; }
      if (DIRS.indexOf(dir) < 0) { block([row([h('span', 'lt-err', 'cd: no such directory: '), arg, ' — try ', chip('ls')])]); return; }
      if (sub && dir === 'projects') {
        var p = PROJECTS.filter(function (x) { return x[0] === sub; })[0];
        if (!p) { block([row([h('span', 'lt-err', 'cd: no such project: '), sub, ' — try ', chip('cd projects')])]); return; }
        setCwd('projects');
        block([row([h('span', 'lt-muted', 'case study → '), h('a', null, 'projects/' + p[0] + '.html', { href: site('projects/' + p[0] + '.html') })])]);
        return;
      }
      setCwd(dir);
      C[dir]();
    }

    var ALIASES = {
      'cat experience': 'experience', 'ls skills': 'skills', 'kubectl get projects': 'projects',
      'kubectl get project': 'projects', 'ssh contact': 'contact', 'cat resume': 'resume', 'cat resume.pdf': 'resume',
      'man': 'help', '?': 'help', 'cls': 'clear', 'ls -la': 'ls', 'ls -l': 'ls', 'dir': 'ls'
    };

    function run(raw) {
      var cmd = String(raw).replace(/\s+/g, ' ').trim();
      var start = echo(cmd);
      if (!cmd) return;
      exec(cmd);
      // long output (help, skills…): keep the start of it in view, like scrolling back up to read it
      var off = start.getBoundingClientRect().top - body.getBoundingClientRect().top - 8;
      if (start.parentNode && off < 0) body.scrollTop += off;
    }
    function exec(cmd) {
      if (hist[hist.length - 1] !== cmd) hist.push(cmd);
      if (hist.length > 50) hist.shift();
      hIdx = hist.length;
      var low = cmd.toLowerCase();
      if (/^sudo(\s|$)/.test(low)) {
        block([
          row(h('span', 'lt-muted', '[sudo] password for visitor: ********')),
          row([h('span', 'lt-err', 'Permission denied:'), ' nice try 🙂 — but you can hire me instead → ', chip('contact')])
        ]);
        return;
      }
      if (/^rm(\s|$)/.test(low)) {
        block([row([h('span', 'lt-err', 'rm: refusing to remove that.'), ' This portfolio runs with strict change management — nothing gets deleted from prod on my watch.'])]);
        return;
      }
      if (low === 'exit' || low === 'logout') {
        block([row(['There’s no escape — but there is ', chip('contact'), ' 🙂'])]);
        return;
      }
      var m = /^cd(?:\s+(.*))?$/.exec(low);
      if (m) { cd(m[1]); return; }
      if (low === 'cat resume.pdf' || low === 'open resume.pdf') { C.resume(); return; }
      var key = ALIASES[low] || low;
      if (Object.prototype.hasOwnProperty.call(C, key)) { C[key](); return; }
      block([row([h('span', 'lt-err', 'command not found: '), cmd.split(' ')[0], ' — type ', chip('help')])]);
    }

    /* ---------- input handling ---------- */
    var hist = [], hIdx = 0, draft = '';
    line.addEventListener('submit', function (e) {
      e.preventDefault();
      if (introRunning) finishIntro();
      var v = input.value;
      input.value = '';
      syncLine();
      run(v);
    });
    input.addEventListener('keydown', function (e) {
      if (introRunning) finishIntro();
      if (e.key === 'ArrowUp') {
        if (!hist.length) return;
        e.preventDefault();
        if (hIdx === hist.length) draft = input.value;
        hIdx = Math.max(0, hIdx - 1);
        setVal(hist[hIdx]);
      } else if (e.key === 'ArrowDown') {
        if (hIdx >= hist.length) return;
        e.preventDefault();
        hIdx++;
        setVal(hIdx === hist.length ? draft : hist[hIdx]);
      } else if (e.key === 'Tab' && !e.shiftKey && input.value.trim()) {
        // only trap Tab while completing, so keyboard users can still Tab out of an empty prompt
        var cur = input.value.replace(/^\s+/, '').toLowerCase();
        var m = COMPLETIONS.filter(function (c) { return c.indexOf(cur) === 0; });
        if (!m.length) return;
        e.preventDefault();
        if (m.length === 1) { setVal(m[0] + ' '); return; }
        var common = m.reduce(function (a, b) { var i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); });
        if (common.length > cur.length) setVal(common);
        else { echo(input.value); block([row(m.join('  '))]); }
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault(); C.clear();
      } else if (e.key === 'c' && e.ctrlKey && input.selectionStart === input.selectionEnd) {
        e.preventDefault(); echo(input.value + '^C'); setVal('');
      }
    });
    function setVal(v) {
      input.value = v;
      try { input.setSelectionRange(v.length, v.length); } catch (err) {}
      syncLine();
    }
    function syncLine() { line.classList.toggle('has-text', !!input.value); }
    input.addEventListener('input', syncLine);
    input.addEventListener('focus', function () { line.classList.add('is-active'); if (introRunning) finishIntro(); });
    input.addEventListener('blur', function () { line.classList.remove('is-active'); });

    // click anywhere in the body focuses the prompt (but not when selecting text or clicking a link)
    body.addEventListener('click', function (e) {
      if (e.target.closest('a, button, input')) return;
      if (!introDone) finishIntro();
      var sel = window.getSelection && window.getSelection();
      if (sel && String(sel).length) return;
      try { input.focus({ preventScroll: true }); } catch (err) { input.focus(); }
    });

    /* ---------- intro: types `whoami` once the terminal is on screen ---------- */
    var introRunning = false, introDone = false, timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function introOutput() {
      C.whoami();
      block([row(['Type ', chip('ls'), ' then ', chip('cd projects'), ' — or ', chip('help'), ' for everything.'])]);
    }
    function finishIntro() {
      if (introDone) return;
      introDone = true; introRunning = false;
      timers.forEach(clearTimeout); timers = [];
      log.textContent = '';
      echo('whoami');
      introOutput();
      log.removeAttribute('aria-busy');
      line.classList.remove('is-busy');
    }
    function startIntro() {
      if (introRunning || introDone) return;
      if (reducedMotion()) { finishIntro(); return; }
      introRunning = true;
      log.setAttribute('aria-busy', 'true');
      var typed = h('span', 'lt-cmd');
      var cur = h('span', 'lt-cursor', null, { 'aria-hidden': 'true' });
      print(row([promptNode(), typed, cur], 'lt-cmdline'));
      var word = 'whoami', i = 0;
      later(function step() {
        if (i < word.length) { typed.textContent += word[i++]; later(step, 70 + Math.random() * 60); return; }
        later(function () {
          cur.remove();
          introOutput();
          introRunning = false; introDone = true;
          log.removeAttribute('aria-busy');
          line.classList.remove('is-busy');
          scrollEnd();
        }, 380);
      }, 700);
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); startIntro(); }
      }, { threshold: 0.25 });
      io.observe(term);
    } else startIntro();

    return { run: run, focus: function () { try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } }, el: term };
  }

  window.initTerminal = initTerminal;
})();
