/* =========================================================================
   Animated architecture banner for the case-study pages.
   Each .proj-banner holds a wide and a tall <svg class="bn-svg" data-bn="…">.
   Whichever one is displayed runs its story (below) in a loop while the
   banner is on screen. Reduced motion: a single static, fully labelled state.
   Uses bn-* classes only, so assets/flow.js never touches these SVGs.
   ========================================================================= */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function Stop() {}
  function noop() {}
  function ease(u) { return u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---------- per-run context: every timer/packet dies with it ---------- */
  function Ctx(svg) {
    this.svg = svg; this.alive = true; this.timers = [];
    this.layer = svg.querySelector('.bn-packets');
    this.tall = svg.classList.contains('bn-svg--tall');
  }
  Ctx.prototype = {
    q: function (k) { return this.svg.querySelector('[data-k="' + k + '"]'); },
    cls: function (k, c, on) { var e = this.q(k); if (e) e.classList.toggle(c, on !== false); return e; },
    txt: function (k, s) { var e = this.q(k); if (e) e.textContent = s; return e; },
    later: function (fn, ms) { var self = this; var t = setTimeout(function () { if (self.alive) fn(); }, ms); this.timers.push(t); },
    every: function (ms, fn) {
      var self = this;
      (function tick() { if (!self.alive) return; fn(); self.later(tick, typeof ms === 'function' ? ms() : ms); })();
    },
    hit: function (k, ms) {
      var e = this.q(k); if (!e) return;
      e.classList.remove('bn-hit'); void e.getBBox(); e.classList.add('bn-hit');
      this.later(function () { e.classList.remove('bn-hit'); }, ms || 850);
    },
    sleep: function (ms) {
      var self = this;
      return new Promise(function (res, rej) {
        if (!self.alive) return rej(new Stop());
        self.timers.push(setTimeout(function () { self.alive ? res() : rej(new Stop()); }, ms));
      });
    },
    tween: function (ms, fn) {
      var self = this;
      return new Promise(function (res, rej) {
        if (!self.alive) return rej(new Stop());
        var t0 = performance.now();
        (function step(now) {
          if (!self.alive) return rej(new Stop());
          var u = Math.min(1, (now - t0) / ms);
          fn(u);
          if (u < 1) requestAnimationFrame(step); else res();
        })(t0);
      });
    },
    bar: function (k, f) {
      var e = this.q(k); if (!e) return;
      f = Math.max(0, Math.min(1, f));
      e.setAttribute('width', (parseFloat(e.getAttribute('data-w')) * f).toFixed(1));
    },
    /* glowing packet along an edge; resolves on arrival (or at once if the edge is absent) */
    packet: function (k, o) {
      o = o || {};
      var g = this.q(k), self = this;
      if (!g || !this.alive) return this.alive ? Promise.resolve() : Promise.reject(new Stop());
      var p = g.querySelector('path'), len = p.getTotalLength();
      var dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('r', o.r || 4.5);
      dot.setAttribute('class', 'bn-packet' + (o.cls ? ' ' + o.cls : ''));
      var s = p.getPointAtLength(o.rev ? len : 0);
      dot.setAttribute('cx', s.x); dot.setAttribute('cy', s.y);
      this.layer.appendChild(dot);
      var dur = o.dur || Math.max(260, len / (o.speed || .3));
      return this.tween(dur, function (u) {
        var pt = p.getPointAtLength((o.rev ? 1 - ease(u) : ease(u)) * len);
        dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
      }).then(function () { dot.remove(); if (o.hit) self.hit(o.hit); },
              function (e) { dot.remove(); throw e; });
    },
    /* fire-and-forget chain of packets */
    chain: function (keys, o) {
      var self = this, i = 0;
      (function next() {
        if (i >= keys.length) return;
        var k = keys[i++], opt = Object.assign({}, o);
        if (Array.isArray(k)) { opt.hit = k[1]; k = k[0]; }
        self.packet(k, opt).then(next, noop);
      })();
    },
    stop: function () {
      this.alive = false;
      this.timers.forEach(clearTimeout); this.timers = [];
      while (this.layer.firstChild) this.layer.removeChild(this.layer.firstChild);
    }
  };

  /* ====================================================================
     Stories. reset(c) sets the opening state, run(c) loops (async),
     still(c) is the static state shown under reduced motion.
     ==================================================================== */
  var S = {};

  /* ---------- 1 · blue-green on AKS ---------- */
  S.bluegreen = (function () {
    var st;
    var NAME = { b: 'blue', g: 'green' }, STEPS = ['build image', 'push to ACR', 'deploy ', 'analyse (Prometheus)', 'promote'];
    function other(x) { return x === 'b' ? 'g' : 'b'; }
    function pods(c, slot, on) { for (var i = 0; i < 4; i++) { var e = c.q('rs' + slot + '_p' + i); if (e) { e.classList.toggle('up', on); e.classList.remove('down'); } } }
    function step(c, i, name) {
      c.txt('step', 'STEP ' + (i + 1) + ' / 5');
      c.txt('stepname', name);
      for (var j = 0; j < 5; j++) c.cls('sb' + j, 'on', j <= i);
    }
    function edges(c) {
      ['b', 'g'].forEach(function (s) {
        c.cls('e_a_' + s, 'bn-dim', s !== st.A); c.cls('e_a_' + s, 'bn-live', s === st.A);
        c.cls('e_p_' + s, 'bn-dim', !(st.preview && s === other(st.A)));
        c.cls('e_argo_' + s, 'bn-dim', s === st.A);
      });
    }
    function rsState(c, slot, ver, role) {
      var k = 'rs' + slot;
      c.cls(k, 'bn-active', role === 'ACTIVE');
      c.txt(k + 'sub', ver ? 'v' + ver + ' · ' + role.toLowerCase() : 'idle · scaled to 0');
      var s = c.txt(k + 'stat', role === 'IDLE' ? '' : role);
      if (s) s.classList.toggle('bn-active-t', role === 'ACTIVE');
    }
    function traffic(c) {
      c.txt('traffic', 'active → ' + NAME[st.A] + ' · v' + st.v);
      c.txt('pct', NAME[st.A] + ' 100% · ' + NAME[other(st.A)] + ' 0%');
    }
    function reset(c) {
      st = { A: 'b', v: 1, next: 2, preview: false };
      pods(c, 'b', true); pods(c, 'g', false);
      rsState(c, 'b', 1, 'ACTIVE'); rsState(c, 'g', 0, 'IDLE');
      c.txt('acrsub', 'registry · app:v1'); c.txt('imgtag', 'app:v1');
      c.txt('promres', 'analysis gate'); c.cls('prom', 'bn-ok', false);
      edges(c); traffic(c); step(c, 0, STEPS[0]);
    }
    async function run(c) {
      // steady user traffic through Front Door → active Service → active ReplicaSet
      c.every(700, function () { c.chain(['e_users_afd', ['e_afd_a', 'svca'], 'e_a_' + st.A], { r: 3.2, speed: .42 }); });
      for (;;) {
        var N = other(st.A), ver = st.next;
        step(c, 0, STEPS[0]); c.hit('gh', 1200); await c.sleep(900);
        step(c, 1, STEPS[1]);
        await c.packet('e_gh_acr', { hit: 'acr' });
        c.txt('acrsub', 'registry · app:v' + ver); c.txt('imgtag', 'app:v' + ver);
        await c.sleep(450);
        step(c, 2, STEPS[2] + NAME[N]);
        await c.packet('e_acr_argo', { hit: 'argo' });
        await c.packet('e_argo_' + N, { hit: 'rs' + N });
        rsState(c, N, ver, 'PREVIEW');
        for (var i = 0; i < 4; i++) { c.cls('rs' + N + '_p' + i, 'up'); c.cls('rs' + N + '_p' + i, 'down', false); await c.sleep(260); }
        st.preview = true; edges(c);
        c.packet('e_p_' + N, { r: 3.2 }).catch(noop);
        await c.sleep(500);
        step(c, 3, STEPS[3]);
        c.txt('promres', 'checking success-rate…');
        await c.packet('e_argo_prom', { hit: 'prom' });
        c.packet('e_p_' + N, { r: 3.2 }).catch(noop);
        await c.sleep(900);
        c.cls('prom', 'bn-ok'); c.txt('promres', '✓ success-rate passed');
        await c.packet('e_prom_argo', { hit: 'argo', cls: 'bn-packet--ok' });
        step(c, 4, STEPS[4]);
        await c.sleep(300);
        var old = st.A, oldV = st.v;
        st.A = N; st.v = ver; st.next = ver + 1; st.preview = false;
        edges(c); traffic(c);
        rsState(c, N, ver, 'ACTIVE'); rsState(c, old, oldV, 'STANDBY');
        c.hit('svca', 1200);
        await c.sleep(1500);
        rsState(c, old, oldV, 'SCALING DOWN');
        for (var j = 3; j >= 0; j--) { c.cls('rs' + old + '_p' + j, 'down'); await c.sleep(220); }
        pods(c, old, false); rsState(c, old, 0, 'IDLE');
        c.cls('prom', 'bn-ok', false); c.txt('promres', 'analysis gate');
        await c.sleep(900);
      }
    }
    function still(c) {
      reset(c);
      pods(c, 'g', true); rsState(c, 'g', 2, 'PREVIEW');
      st.preview = true; edges(c);
      c.txt('acrsub', 'registry · app:v2'); c.txt('imgtag', 'app:v2');
      c.cls('prom', 'bn-ok'); c.txt('promres', '✓ success-rate passed');
      step(c, 3, 'analyse → promote');
    }
    return { reset: reset, run: run, still: still };
  })();

  /* ---------- 2 · Drone CI pipeline ---------- */
  S.drone = (function () {
    var n;
    function clearStages(c) {
      for (var i = 0; i < 7; i++) {
        var s = c.q('s' + i); if (s) s.classList.remove('bn-ok', 'bn-run', 'bn-bad', 'bn-wait');
        var l = c.q('l' + i); if (l) l.setAttribute('class', 'bn-led');
      }
      ['target', 'notify'].forEach(function (k) { var e = c.q(k); if (e) e.classList.remove('bn-ok', 'bn-bad'); });
      c.cls('e_pull', 'bn-rollback', false);
      c.txt('tgtsub', 'service');
    }
    function setStage(c, i, state) {
      var s = c.q('s' + i), l = c.q('l' + i);
      if (s) { s.classList.remove('bn-ok', 'bn-run', 'bn-bad', 'bn-wait'); if (state) s.classList.add('bn-' + state); }
      if (l) l.setAttribute('class', 'bn-led ' + ({ ok: 'on', run: 'run', bad: 'bad', wait: 'wait' }[state] || ''));
    }
    function tags(c) {
      c.txt('run', 'RUN #' + n);
      c.txt('tagnew', 'app:#' + n + (c.tall ? ' new' : '  (new)')); c.txt('tagold', 'app:#' + (n - 1) + (c.tall ? ' prev' : '  (previous)'));
      c.txt('pulllbl', 'pull app:#' + n + (c.tall ? '' : ' · the scanned tag'));
    }
    function reset(c) { n = 128; clearStages(c); tags(c); c.txt('runstat', 'waiting for push'); c.txt('conc', 'concurrency: limit 1'); }
    async function stage(c, i, label, ms) {
      setStage(c, i, 'run'); c.txt('runstat', label); c.hit('s' + i, ms);
      await c.sleep(ms); setStage(c, i, 'ok');
      if (i < 6) await c.packet('e' + i, { speed: .12 });
    }
    async function run(c) {
      for (var cycle = 0; ; cycle++) {
        clearStages(c); tags(c);
        var fail = cycle % 3 === 2;
        c.txt('conc', 'concurrency: limit 1 · 1 running');
        c.hit('push'); c.txt('runstat', 'git push → new run');
        await c.packet('e_push', { hit: 's0' });
        await stage(c, 0, 'clone', 450);
        await stage(c, 1, 'Kaniko build · no Docker daemon', 750);
        setStage(c, 2, 'run'); c.txt('runstat', 'push app:#' + n + ' to Harbor');
        await c.packet('e_push_h', { hit: 'harbor' });
        setStage(c, 2, 'ok'); await c.packet('e2', { speed: .12 });
        setStage(c, 3, 'run'); c.txt('runstat', 'Trivy: HIGH,CRITICAL → blocks on findings');
        await c.packet('e_h_scan', { hit: 's3' });
        await c.sleep(500);
        c.txt('runstat', 'Trivy: no blocking findings');
        setStage(c, 3, 'ok'); await c.packet('e3', { speed: .12 });
        setStage(c, 4, 'wait'); c.txt('runstat', 'manual gate · waiting for approval…');
        await c.sleep(1500);
        c.txt('runstat', 'approved → stage'); setStage(c, 4, 'ok');
        await c.packet('e4', { speed: .12 });
        setStage(c, 5, 'run'); c.txt('runstat', 'deploy over SSH via jump host');
        await c.packet('e_dep_jump', { hit: 'jump' });
        await c.packet('e_jump_tgt', { hit: 'target' });
        await c.packet('e_pull', { hit: 'target' });
        setStage(c, 5, 'ok'); await c.packet('e5', { speed: .12 });
        setStage(c, 6, 'run'); c.txt('runstat', 'post-deploy health check');
        await c.packet('e_health', { hit: 'target' });
        await c.sleep(300);
        if (!fail) {
          await c.packet('e_health', { rev: true, cls: 'bn-packet--ok' });
          setStage(c, 6, 'ok'); c.cls('target', 'bn-ok'); c.txt('tgtsub', 'healthy · app:#' + n);
          c.txt('runstat', 'run #' + n + ' · deployed · health ✓');
        } else {
          setStage(c, 6, 'bad'); c.cls('target', 'bn-bad'); c.txt('tgtsub', 'unhealthy');
          c.txt('runstat', 'health check failed → pipeline fails');
          await c.packet('e_notify', { hit: 'notify' });
          c.cls('notify', 'bn-bad');
          await c.sleep(500);
          c.cls('e_pull', 'bn-rollback');
          c.txt('pulllbl', (c.tall ? 'rollback → #' : 'tag rollback → app:#') + (n - 1));
          c.txt('runstat', 'tag rollback: re-deploy app:#' + (n - 1));
          await c.packet('e_pull', { hit: 'target', speed: .25 });
          c.cls('target', 'bn-bad', false); c.cls('target', 'bn-ok'); c.txt('tgtsub', 'healthy · app:#' + (n - 1));
          c.txt('runstat', 'rolled back to app:#' + (n - 1) + ' · no rebuild');
        }
        c.txt('conc', 'concurrency: limit 1 · idle');
        await c.sleep(2000);
        n++;
      }
    }
    function still(c) {
      reset(c);
      for (var i = 0; i < 4; i++) setStage(c, i, 'ok');
      setStage(c, 4, 'wait'); c.txt('runstat', 'manual gate · waiting for approval');
    }
    return { reset: reset, run: run, still: still };
  })();

  /* ---------- 3 · messaging and data stack ---------- */
  S.messaging = (function () {
    var q, rows, bars;
    function draw(c) {
      for (var i = 0; i < 3; i++) { c.bar('q' + i, .04 + q[i] / 40); c.txt('qd' + i, 'depth ' + q[i]); }
      c.txt('rows', 'rows +' + rows);
    }
    function ss(c) {
      for (var i = 0; i < 4; i++) {
        var e = c.q('ssb' + i); if (!e) continue;
        if (!e.dataset.base) { e.dataset.base = e.getAttribute('y'); e.dataset.h = e.getAttribute('height'); }
        var H = parseFloat(e.dataset.h), h = Math.max(4, H * bars[i]);
        e.setAttribute('y', (parseFloat(e.dataset.base) + H - h).toFixed(1)); e.setAttribute('height', h.toFixed(1));
      }
    }
    function reset(c) { q = [6, 3, 9]; rows = 0; bars = [.4, .7, .5, .8]; draw(c); ss(c); }
    async function run(c) {
      var burst = false;
      // producers → broker
      c.every(function () { return burst ? 150 : 520; }, function () {
        c.packet('e_prod', { r: 3.4, speed: .35 }).then(function () {
          var i = Math.floor(Math.random() * 3); q[i] = Math.min(36, q[i] + (burst ? 2 : 1)); draw(c);
        }, noop);
      });
      // consumers: Karaf/Camel routes and NiFi
      function consume(edge, led, then) {
        var i = q.indexOf(Math.max.apply(null, q));
        if (q[i] <= 0) return;
        q[i]--; draw(c);
        if (led) { c.cls(led, 'run'); c.later(function () { c.cls(led, 'run', false); }, 300); }
        c.packet(edge, { r: 3.4, speed: .35 }).then(then || noop, noop);
      }
      c.every(function () { return burst ? 520 : 300; }, function () {
        consume('e_amq_karaf', 'r' + Math.floor(Math.random() * 3));
      });
      c.every(function () { return burst ? 640 : 380; }, function () {
        consume('e_amq_nifi', null, function () {
          c.packet('e_nifi_pg', { r: 3.4, speed: .35 }).then(function () {
            rows++; draw(c);
            if (rows % 3 === 0) c.packet('e_pg_ss', { r: 3.4, speed: .3, hit: 'ss' }).then(function () {
              bars.shift(); bars.push(rnd(.3, 1)); ss(c);
            }, noop);
          }, noop);
        });
      });
      for (;;) {
        burst = true; c.txt('flow', c.tall ? 'flow: burst' : 'flow: burst · queues filling');
        await c.sleep(3200);
        burst = false; c.txt('flow', c.tall ? 'flow: draining' : 'flow: messages moving · draining');
        await c.sleep(4800);
      }
    }
    function still(c) { reset(c); q = [18, 9, 24]; rows = 42; draw(c); }
    return { reset: reset, run: run, still: still };
  })();

  /* ---------- 4 · observability and capacity ---------- */
  S.observability = (function () {
    var hb;
    function vol(c, gb) { c.bar('volbar', gb / 140); c.txt('volnum', Math.round(gb) + ' GB'); }
    function beats(c) { for (var i = 0; i < 12; i++) c.cls('hb' + i, 'bad', hb[i] === 0); }
    function chips(c, done) {
      c.cls('v1', 'bn-ok', false); c.cls('v1', 'bn-hit', false);
      c.cls('v2', 'bn-ok', done); c.cls('e_v12', 'bn-live', done);
      c.txt('esnote', done ? '7.17.28 ✓ · 8.x next, planned' : 'on 7.11.2 · 8.x needs 7.17 first');
    }
    function crisis(c, on) {
      c.cls('vol', 'bn-bad', on); var b = c.q('volbar'); if (b) b.classList.toggle('bn-good', !on);
      c.txt('ret', 'retention.time = ' + (on ? '1y' : '90d'));
      c.txt('volnote', on ? 'disk filling · 1 year of metrics' : '~108 GB freed · 90 days kept');
    }
    function reset(c) {
      hb = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]; beats(c);
      vol(c, 127); crisis(c, true); chips(c, false);
      c.txt('chatmsg', 'no alerts'); c.cls('cl2', 'bad', false); c.cls('cl2', 'on');
    }
    async function run(c) {
      var down = false;
      c.every(650, function () {
        var i = Math.floor(Math.random() * 4);
        c.chain([['e_c' + i, 'cad'], ['e_cad_prom', 'prom'], 'e_prom_vol'], { r: 3.4, speed: .32 });
      });
      c.every(800, function () { hb.shift(); hb.push(down ? 0 : 1); beats(c); c.packet('e_kuma_check', { r: 3, rev: false }).catch(noop); });
      for (;;) {
        await c.sleep(1400);
        c.txt('ret', 'retention.time = 1y → 90d'); c.hit('prom', 1200);
        await c.sleep(900);
        crisis(c, false);
        await c.tween(1800, function (u) { vol(c, 127 - 113 * ease(u)); });
        await c.sleep(700);
        c.hit('v1'); await c.packet('e_v12', { hit: 'v2', speed: .1 });
        chips(c, true);
        await c.sleep(1000);
        down = true; c.cls('cl2', 'on', false); c.cls('cl2', 'bad');
        await c.sleep(1100);
        c.hit('kuma');
        await c.packet('e_kuma_chat', { hit: 'chat', speed: .12 });
        c.cls('chat', 'bn-bad'); c.txt('chatmsg', 'alert · service DOWN');
        await c.sleep(1600);
        down = false; c.cls('cl2', 'bad', false); c.cls('cl2', 'on');
        await c.sleep(900);
        await c.packet('e_kuma_chat', { hit: 'chat', speed: .12, cls: 'bn-packet--ok' });
        c.cls('chat', 'bn-bad', false); c.cls('chat', 'bn-ok'); c.txt('chatmsg', 'resolved · service UP');
        await c.sleep(1800);
        c.cls('chat', 'bn-ok', false); c.txt('chatmsg', 'no alerts');
        // rewind the before/after for the next loop
        chips(c, false); crisis(c, true);
        await c.tween(700, function (u) { vol(c, 14 + 113 * ease(u)); });
      }
    }
    function still(c) { reset(c); vol(c, 14); crisis(c, false); chips(c, true); }
    return { reset: reset, run: run, still: still };
  })();

  /* ---------- 5 · GPU LLM/OCR serving (all values simulated) ---------- */
  S.gpu = (function () {
    var util, cache, hist, RES = [.26, .26, .34];
    function draw(c) {
      for (var i = 0; i < 3; i++) { c.bar('u' + i, util[i]); c.bar('m' + i, cache[i]); }
    }
    function gpuMem(c) {
      var t = c.q('gtrack'); if (!t) return;
      var x = +t.getAttribute('x'), W = +t.getAttribute('width');
      for (var i = 0; i < 3; i++) {
        var e = c.q('g' + i), w = W * RES[i] * (.97 + .03 * cache[i]);
        e.setAttribute('x', x.toFixed(1)); e.setAttribute('width', Math.max(2, w - 2).toFixed(1)); x += w;
      }
    }
    function spark(c) {
      var p = c.q('spark'); if (!p) return;
      var d = p.dataset; if (!d.x0) { var m = p.getAttribute('d').match(/M([\d.]+) ([\d.]+) L([\d.]+)/); d.x0 = m[1]; d.y0 = m[2]; d.x1 = m[3]; }
      var x0 = +d.x0, x1 = +d.x1, y0 = +d.y0, n = hist.length;
      p.setAttribute('d', hist.map(function (v, i) { return (i ? 'L' : 'M') + (x0 + (x1 - x0) * i / (n - 1)).toFixed(1) + ' ' + (y0 - v * 26).toFixed(1); }).join(' '));
    }
    function reset(c) { util = [.15, .1, .2]; cache = [.3, .25, .35]; hist = []; for (var i = 0, h = .3; i < 16; i++) { h = Math.max(.1, Math.min(.8, h + rnd(-.12, .12))); hist.push(h); } draw(c); gpuMem(c); spark(c); }
    async function run(c) {
      c.every(110, function () {
        for (var i = 0; i < 3; i++) { util[i] += (.12 - util[i]) * .05; cache[i] += (.25 - cache[i]) * .03; }
        draw(c);
      });
      c.every(function () { return rnd(260, 620); }, function () {
        var i = Math.random() < .62 ? Math.floor(Math.random() * 2) : 2;
        c.chain(['e_client', 'e_api_v' + i], { r: 3.4, speed: .4 });
        c.later(function () { util[i] = Math.min(.97, util[i] + rnd(.18, .32)); cache[i] = Math.min(.95, cache[i] + rnd(.08, .16)); }, 900);
      });
      c.every(1600, function () {
        ['e_gpu_dcgm', 'e_gpu_cad', 'e_gpu_node'].forEach(function (k, j) {
          c.chain([k, ['e_dcgm_p', 'e_cad_p', 'e_node_p'][j]], { r: 3, speed: .3 });
          if (j === 1) c.later(function () { c.hit('prom', 600); }, 700);
        });
        c.later(function () {
          c.packet('e_p_g', { r: 3, hit: 'graf' }).then(function () {
            hist.shift(); hist.push((util[0] + util[1] + util[2]) / 3); spark(c); gpuMem(c);
          }, noop);
        }, 900);
      });
      for (;;) await c.sleep(10000);
    }
    function still(c) { reset(c); util = [.62, .48, .71]; cache = [.55, .42, .66]; hist = [.3, .35, .5, .45, .6, .55, .7, .62, .5, .58, .66, .6, .52, .64, .7, .6]; draw(c); gpuMem(c); spark(c); }
    return { reset: reset, run: run, still: still };
  })();

  /* ---------- 6 · LSTM phishing detection (sample text illustrative) ---------- */
  S.lstm = (function () {
    var SAMPLES = [
      { lines: ['subject: urgent', 'verify account', 'click link now'], toks: ['urgent', 'verify', 'account', 'link'], score: .93, phish: true },
      { lines: ['subject: lunch', 'moved to friday', 'same place, 1pm'], toks: ['team', 'lunch', 'moved', 'friday'], score: .07, phish: false }
    ];
    function clear(c) {
      for (var i = 0; i < 3; i++) c.txt('em' + i, '');
      for (var t = 0; t < 4; t++) { c.cls('tk' + t, 'on', false); c.txt('tkt' + t, ''); }
      for (var v = 0; v < 6; v++) c.cls('vb' + v, 'on', false);
      for (var k = 0; k < 5; k++) c.cls('cell' + k, 'bn-on', false);
      c.bar('score', 0); c.txt('vtxt', '—');
      var vd = c.q('verdict'); if (vd) vd.classList.remove('bn-ok', 'bn-bad');
    }
    function vec(c) {
      for (var v = 0; v < 6; v++) {
        var e = c.q('vb' + v); if (!e) continue;
        if (!e.dataset.base) { e.dataset.base = e.getAttribute('y'); e.dataset.h = e.getAttribute('height'); }
        var H = +e.dataset.h, h = H * rnd(.25, 1);
        e.setAttribute('y', (+e.dataset.base + H - h).toFixed(1)); e.setAttribute('height', h.toFixed(1));
        e.classList.add('on');
      }
    }
    function verdict(c, s) {
      c.txt('vtxt', s.phish ? 'PHISHING' : 'LEGITIMATE');
      c.cls('verdict', s.phish ? 'bn-bad' : 'bn-ok');
    }
    function reset(c) { clear(c); c.txt('uires', 'result: —'); }
    async function run(c) {
      for (var n = 0; ; n++) {
        var s = SAMPLES[n % 2];
        clear(c); c.txt('uires', 'checking…'); c.hit('ui');
        await c.packet('e_ui_email', { hit: 'email' });
        for (var i = 0; i < 3; i++) { c.txt('em' + i, s.lines[i]); await c.sleep(160); }
        await c.packet('e_email_prep', { hit: 'prep' });
        for (var t = 0; t < 4; t++) { c.cls('tk' + t, 'on'); c.txt('tkt' + t, s.toks[t]); await c.sleep(170); }
        await c.packet('e_prep_emb', { hit: 'emb' });
        vec(c); await c.sleep(350);
        await c.packet('e_emb_lstm');
        for (var k = 0; k < 5; k++) {
          await c.packet('e_in' + k, { r: 3.4, speed: .25 });
          c.cls('cell' + k, 'bn-on'); c.hit('cell' + k, 500);
          if (k < 4) await c.packet('e_h' + k, { r: 3.4, speed: .12 });
        }
        await c.packet('e_lstm_cls', { hit: 'cls' });
        await c.tween(600, function (u) { c.bar('score', s.score * ease(u)); });
        await c.packet('e_cls_v', { hit: 'verdict' });
        verdict(c, s);
        await c.packet('e_v_ui', { hit: 'ui', cls: s.phish ? '' : 'bn-packet--ok' });
        c.txt('uires', 'result: ' + (s.phish ? 'phishing' : 'legitimate'));
        await c.sleep(2200);
      }
    }
    function still(c) {
      var s = SAMPLES[0]; clear(c);
      for (var i = 0; i < 3; i++) c.txt('em' + i, s.lines[i]);
      for (var t = 0; t < 4; t++) { c.cls('tk' + t, 'on'); c.txt('tkt' + t, s.toks[t]); }
      vec(c); for (var k = 0; k < 5; k++) c.cls('cell' + k, 'bn-on');
      c.bar('score', s.score); verdict(c, s); c.txt('uires', 'result: phishing');
    }
    return { reset: reset, run: run, still: still };
  })();

  /* ---------- runner: one per banner, only the displayed svg, only on screen ---------- */
  function shown(svg) { var r = svg.getBoundingClientRect(); return r.width > 0 && r.height > 0; }

  function Banner(el) {
    this.el = el; this.svgs = [].slice.call(el.querySelectorAll('svg.bn-svg')); this.ctx = null; this.inView = false;
  }
  Banner.prototype.current = function () { return this.svgs.filter(shown)[0] || null; };
  Banner.prototype.stop = function () { if (this.ctx) { this.ctx.stop(); this.ctx = null; } };
  Banner.prototype.start = function () {
    var svg = this.current();
    if (!svg || (this.ctx && this.ctx.svg === svg)) return;
    this.stop();
    var story = S[svg.getAttribute('data-bn')]; if (!story) return;
    var c = this.ctx = new Ctx(svg);
    story.reset(c);
    story.run(c).catch(function (e) { if (!(e instanceof Stop)) throw e; });
  };
  Banner.prototype.sync = function () { if (this.inView) this.start(); else this.stop(); };

  function init() {
    var banners = [].slice.call(document.querySelectorAll('.proj-banner.bn-banner'));
    if (!banners.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      banners.forEach(function (b) {
        [].slice.call(b.querySelectorAll('svg.bn-svg')).forEach(function (svg) {
          var st = S[svg.getAttribute('data-bn')]; if (st) st.still(new Ctx(svg));
        });
      });
      return;
    }
    var list = banners.map(function (el) { return new Banner(el); });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var b = list.filter(function (x) { return x.el === e.target; })[0];
        b.inView = e.isIntersecting; b.sync();
      });
    }, { threshold: 0.15 });
    list.forEach(function (b) { io.observe(b.el); });
    var mq = window.matchMedia('(max-width: 680px)');
    var onMq = function () { list.forEach(function (b) { b.stop(); b.sync(); }); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    document.addEventListener('visibilitychange', function () {
      list.forEach(function (b) { if (document.hidden) b.stop(); else b.sync(); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
