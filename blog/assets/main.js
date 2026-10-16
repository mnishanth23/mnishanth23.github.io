/* ==========================================================================
   Nishanth M — DevOps / SRE portfolio
   js/main.js  ·  all site behaviour, vanilla JS, no dependencies.
   Every feature is progressive: the site is fully usable with JS off.

   CONTENTS
   0. Config (contact form endpoint)
   1. Helpers
   2. Mobile menu (burger → full-screen overlay)
   3. Scroll reveal (IntersectionObserver)
   4. Hero terminal typing line
   5. Hero canvas node network
   6. Project filter with FLIP animation
   7. Reading progress bar + table-of-contents highlight
   8. Code block copy buttons
   9. Contact form (validation, Formspree or mailto fallback)
   ========================================================================== */

/* --------------------------------------------------------------------------
   0. CONFIG — CONTACT FORM ENDPOINT
   --------------------------------------------------------------------------
   GitHub Pages cannot run server code, so the form needs a form backend.

   To receive messages in your inbox (recommended):
     1. Sign up free at https://formspree.io
     2. Create a new form, set its email to imnishanth23@gmail.com
     3. Copy the endpoint it gives you, e.g. https://formspree.io/f/abcdwxyz
     4. Paste it below:  const FORM_ENDPOINT = 'https://formspree.io/f/abcdwxyz';
     5. Submit the form once on the live site and confirm the first message
        from Formspree's verification email.

   While FORM_ENDPOINT is empty the form falls back to opening the visitor's
   email app with a pre-filled message (mailto:). It NEVER claims a message
   was sent unless the endpoint returned success.
   -------------------------------------------------------------------------- */
const FORM_ENDPOINT = '';
const CONTACT_EMAIL = 'imnishanth23@gmail.com';

(() => {
  'use strict';

  /* 1. Helpers ------------------------------------------------------------ */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reduceMQ.matches;

  /* 2. Mobile menu ---------------------------------------------------------
     Burger toggles #menu (a full-screen overlay outside the header).
     Locks body scroll (html.menu-open), makes the page behind inert,
     closes on Esc / link click, and returns focus to the burger. */
  const toggle = $('.nav-toggle');
  const menu = $('#menu');
  if (toggle && menu) {
    const behind = $$('main, .site-footer, .skip-link');
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.classList.toggle('open', open);
      menu.setAttribute('aria-hidden', String(!open));
      menu.inert = !open;
      document.documentElement.classList.toggle('menu-open', open);
      behind.forEach((el) => { el.inert = open; });
      if (open) { const first = $('a', menu); first && first.focus({ preventScroll: true }); }
    };
    menu.inert = true;
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('open')) { setOpen(false); toggle.focus(); }
    });
    // Leaving mobile width with the menu open: close it
    window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
  }

  /* 3. Scroll reveal -------------------------------------------------------
     Elements with .reveal start hidden (CSS, only under html.js) and get
     .in when they enter the viewport. Stagger is set in markup via --d.
     Elements already on screen at load are revealed immediately so that
     view-transition snapshots and back-navigation never show blank cards. */
  const reveals = $$('.reveal');
  if (reveals.length) {
    if (reduced() || !('IntersectionObserver' in window)) {
      reveals.forEach((el) => el.classList.add('in'));
    } else {
      const vh = window.innerHeight;
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      // One batched read of positions, then writes (no layout thrash)
      const tops = reveals.map((el) => el.getBoundingClientRect().top);
      reveals.forEach((el, i) => { if (tops[i] < vh * 0.92) el.classList.add('in'); else io.observe(el); });
    }
  }

  /* 4. Hero terminal typing line ------------------------------------------
     <span class="typed" data-text="…">…</span>: the full text is already in
     the HTML (no-JS / screen readers via aria-label); JS re-types it. */
  const typed = $('.term .typed');
  if (typed && !reduced()) {
    const text = typed.dataset.text || typed.textContent;
    typed.textContent = '';
    let i = 0;
    const tick = () => {
      typed.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(tick, text[i - 1] === ' ' ? 70 : 38 + Math.random() * 40);
    };
    setTimeout(tick, 700);
  }

  /* 5. Hero canvas node network -------------------------------------------
     Lightweight 2D canvas: drifting nodes linked when close, a few red.
     Pauses when the hero is off-screen or the tab is hidden; draws one
     static frame under reduced motion. */
  const canvas = $('.hero-net');
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, nodes = [], raf = 0, visible = true;
    const LINK = 130;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(70, (w * h) / 16000));
      nodes = Array.from({ length: count }, (_, k) => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
        hot: k % 9 === 0,
      }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let a = 0; a < nodes.length; a++) {
        const n = nodes[a];
        for (let b = a + 1; b < nodes.length; b++) {
          const m = nodes[b], dx = n.x - m.x, dy = n.y - m.y, d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const o = 1 - Math.sqrt(d2) / LINK;
            ctx.strokeStyle = (n.hot || m.hot) ? `rgba(255,59,60,${o * 0.35})` : `rgba(255,255,255,${o * 0.12})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y); ctx.stroke();
          }
        }
      }
      nodes.forEach((n) => {
        ctx.fillStyle = n.hot ? '#FF3B3C' : 'rgba(255,255,255,.45)';
        const s = n.hot ? 3 : 2;
        ctx.fillRect(n.x - s / 2, n.y - s / 2, s, s); // square nodes: sharp, on-brand
      });
    };
    const step = () => {
      nodes.forEach((n) => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      });
      draw();
      raf = requestAnimationFrame(step);
    };
    const start = () => { if (!raf && visible && !document.hidden && !reduced()) raf = requestAnimationFrame(step); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    resize(); draw(); start();
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); draw(); }, 150); });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(canvas);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    reduceMQ.addEventListener('change', () => { stop(); draw(); start(); });
  }

  /* 6. Project filter with FLIP -------------------------------------------
     Markup: .chip[data-filter] buttons, cards with data-cat="a b".
     FLIP: First (measure) → Last (apply filter, measure) → Invert + Play
     (WAAPI transform from old to new position). Hash (#cicd) is kept in
     sync and honoured on load. Result count announced via aria-live. */
  const chips = $$('.chip[data-filter]');
  const grid = $('.proj-grid');
  const countEl = $('#result-count');
  if (chips.length && grid) {
    const cards = $$('.card', grid);
    const keys = chips.map((c) => c.dataset.filter);
    const labelOf = (k) => (chips.find((c) => c.dataset.filter === k) || chips[0]).dataset.label;
    // Fill per-chip counts
    chips.forEach((c) => {
      const n = c.dataset.filter === 'all' ? cards.length : cards.filter((card) => card.dataset.cat.split(' ').includes(c.dataset.filter)).length;
      const span = $('.n', c); if (span) span.textContent = n;
    });
    const apply = (key, animate) => {
      if (!keys.includes(key)) key = 'all';
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === key)));
      const first = new Map(cards.filter((c) => !c.hidden).map((c) => [c, c.getBoundingClientRect()]));
      let shown = 0;
      cards.forEach((c) => {
        const show = key === 'all' || c.dataset.cat.split(' ').includes(key);
        c.hidden = !show; if (show) { shown++; c.classList.add('in'); }
      });
      if (countEl) countEl.textContent = `Showing ${shown} project${shown === 1 ? '' : 's'}${key === 'all' ? '' : ' in ' + labelOf(key)}`;
      if (!animate || reduced() || !Element.prototype.animate) return;
      cards.filter((c) => !c.hidden).forEach((c) => {
        const last = c.getBoundingClientRect();
        const prev = first.get(c);
        if (prev) {
          const dx = prev.left - last.left, dy = prev.top - last.top;
          if (dx || dy) c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' });
        } else {
          c.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' });
        }
      });
    };
    chips.forEach((c) => c.addEventListener('click', () => {
      const key = c.dataset.filter;
      history.replaceState(null, '', key === 'all' ? location.pathname + location.search : '#' + key);
      apply(key, true);
    }));
    window.addEventListener('hashchange', () => apply(location.hash.slice(1) || 'all', true));
    apply(location.hash.slice(1) || 'all', false);
  }

  /* 7. Reading progress + TOC highlight -----------------------------------
     .progress > span is scaled with transform (compositor only) from one
     rAF-throttled scroll handler. TOC links (.toc a[href^="#"]) get .active
     for the heading most recently scrolled past. */
  const bar = $('.progress span');
  const article = $('.prose[data-article]');
  if (bar && article) {
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = article.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.6;
      const p = Math.min(1, Math.max(0, -r.top / (total > 0 ? total : 1)));
      bar.style.transform = `scaleX(${p})`;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }
  const tocLinks = $$('.toc a[href^="#"]');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const map = new Map(tocLinks.map((a) => [document.getElementById(decodeURIComponent(a.hash.slice(1))), a]).filter(([h]) => h));
    const headings = Array.from(map.keys());
    const setActive = (h) => tocLinks.forEach((a) => a.classList.toggle('active', map.get(h) === a));
    const tio = new IntersectionObserver(() => {
      // Active = last heading whose top is above 30% of the viewport
      const line = window.innerHeight * 0.3;
      let current = headings[0];
      headings.forEach((h) => { if (h.getBoundingClientRect().top < line) current = h; });
      setActive(current);
    }, { rootMargin: '0px 0px -60% 0px', threshold: [0, 1] });
    headings.forEach((h) => tio.observe(h));
  }

  /* 8. Code copy buttons ---------------------------------------------------
     Adds a "Copy" button to every <figure class="code">'s .code-head. */
  $$('figure.code').forEach((fig) => {
    const head = $('.code-head', fig); const code = $('pre code', fig);
    if (!head || !code || !navigator.clipboard) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'copy-btn'; btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy code to clipboard');
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.innerText);
        btn.textContent = 'Copied ✓'; btn.classList.add('done');
      } catch { btn.textContent = 'Press Ctrl+C'; }
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('done'); }, 1800);
    });
    head.appendChild(btn);
  });

  /* 9. Contact form ---------------------------------------------------------
     Inline accessible validation (aria-invalid + aria-describedby → .field-err),
     honeypot check, animated submit states via data-state on the button:
       idle → sending → sent | error        (FORM_ENDPOINT set)
       idle → opened                         (mailto fallback)                */
  const form = $('#contact-form');
  if (form) {
    const btn = $('.btn-submit', form);
    const status = $('.form-status', form);
    const fields = {
      name: { el: form.elements.name, check: (v) => (v.trim().length >= 2 ? '' : 'Please enter your name.') },
      email: { el: form.elements.email, check: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Please enter a valid email address, e.g. you@company.com.') },
      topic: { el: form.elements.topic, check: (v) => (v ? '' : 'Please choose what this is about.') },
      message: { el: form.elements.message, check: (v) => (v.trim().length >= 10 ? '' : 'Please write a message (at least 10 characters).') },
    };
    const showErr = (f) => {
      const msg = f.check(f.el.value);
      const err = document.getElementById(f.el.getAttribute('aria-describedby').split(' ')[0]);
      f.el.setAttribute('aria-invalid', String(!!msg));
      if (err) err.textContent = msg;
      return !msg;
    };
    // Validate on blur once touched, live-clear errors while typing
    Object.values(fields).forEach((f) => {
      f.el.addEventListener('blur', () => { if (f.el.value) showErr(f); });
      f.el.addEventListener('input', () => { if (f.el.getAttribute('aria-invalid') === 'true') showErr(f); });
    });
    const setState = (s) => { btn.dataset.state = s; btn.disabled = s === 'sending'; };
    const setStatus = (html, cls) => { status.className = 'form-status ' + (cls || ''); status.innerHTML = html; };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (btn.dataset.state === 'sending') return;
      const results = Object.values(fields).map(showErr);
      const firstBad = Object.values(fields)[results.indexOf(false)];
      if (firstBad) { firstBad.el.focus(); setStatus('Please fix the highlighted fields.', 'bad'); return; }
      // Honeypot filled → silently pretend nothing happened (likely a bot)
      if (form.elements._gotcha && form.elements._gotcha.value) return;

      const data = new FormData(form);
      if (FORM_ENDPOINT) {
        setState('sending'); setStatus('Sending…');
        try {
          const res = await fetch(FORM_ENDPOINT, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          setState('sent'); form.reset();
          setStatus('Thanks — your message was delivered. I usually reply within a couple of days.', 'ok');
        } catch (err) {
          setState('error');
          setStatus(`Sorry, the message could not be sent. Please email me directly at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.`, 'bad');
          setTimeout(() => setState('idle'), 4000);
        }
        return;
      }

      // Fallback: hand off to the visitor's email app. Nothing is "sent" here.
      const subject = `[Portfolio] ${data.get('topic')} — ${data.get('name')}`;
      const body = `${data.get('message')}\n\n— ${data.get('name')}${data.get('company') ? ', ' + data.get('company') : ''}\n${data.get('email')}`;
      const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setState('opened');
      setStatus(`Your email app should have opened with this message pre-filled — press send there to deliver it. Nothing opened? <a href="${href}" id="mailto-fallback">Try again</a> or email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.`, 'ok');
      window.location.href = href;
      setTimeout(() => setState('idle'), 5000);
    });
  }
})();
