/* =========================================================================
   Diagram flow animation for the case-study pages.
   A glowing packet travels each connector of the architecture diagram in
   order (connectors that start from the same point run together, e.g. one
   service fanning out to two), and each box lights up when the packet
   arrives. Loops while the diagram is on screen; off for reduced motion.
   ========================================================================= */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var NS = 'http://www.w3.org/2000/svg';
  var SPEED = 0.22;            // px of diagram per ms
  var PAUSE = 260;             // ms a box stays lit before the next hop
  var LOOP_GAP = 1400;         // ms between full runs

  function visible(svg) { return svg.getClientRects().length > 0 && getComputedStyle(svg).display !== 'none'; }

  function setup(svg) {
    var paths = [].slice.call(svg.querySelectorAll('path.d-arrow, path.d-dash'));
    if (!paths.length) return null;
    var rects = [].slice.call(svg.querySelectorAll('rect.d-box')).filter(function (r) { return !r.classList.contains('d-box--ghost'); });
    function boxAt(pt) {
      var best = null, bd = 1e9;
      rects.forEach(function (r) {
        var b = r.getBBox(), dx = Math.max(b.x - pt.x, 0, pt.x - (b.x + b.width)), dy = Math.max(b.y - pt.y, 0, pt.y - (b.y + b.height));
        var d = Math.hypot(dx, dy);
        if (d < bd) { bd = d; best = r; }
      });
      return bd < 30 ? best : null;
    }
    // group connectors into steps: same start point as the previous connector = same step
    var steps = [];
    paths.forEach(function (p) {
      var len = p.getTotalLength(), a = p.getPointAtLength(0), b = p.getPointAtLength(len);
      var hop = { path: p, len: len, from: boxAt(a), to: boxAt(b), start: a };
      var last = steps[steps.length - 1];
      if (last && Math.hypot(last[0].start.x - a.x, last[0].start.y - a.y) < 4) last.push(hop); else steps.push([hop]);
    });
    var layer = document.createElementNS(NS, 'g');
    layer.setAttribute('class', 'd-packets');
    svg.appendChild(layer);
    return { svg: svg, steps: steps, layer: layer, rects: rects };
  }

  function light(rect) {
    if (!rect) return;
    rect.classList.remove('d-hit'); void rect.getBBox(); rect.classList.add('d-hit');
    setTimeout(function () { rect.classList.remove('d-hit'); }, 900);
  }

  function run(d, done) {
    var i = 0;
    if (d.steps[0] && d.steps[0][0].from) light(d.steps[0][0].from);
    (function next() {
      if (!d.on) return;
      if (i >= d.steps.length) return setTimeout(done, LOOP_GAP);
      var step = d.steps[i++], left = step.length;
      step.forEach(function (hop) {
        var dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('r', 5); dot.setAttribute('class', 'd-packet');
        d.layer.appendChild(dot);
        var t0 = performance.now(), dur = Math.max(380, hop.len / SPEED);
        (function move(now) {
          var u = Math.min(1, (now - t0) / dur), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          var p = hop.path.getPointAtLength(e * hop.len);
          dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
          if (u < 1 && d.on) return requestAnimationFrame(move);
          dot.remove(); light(hop.to);
          if (--left === 0) setTimeout(next, PAUSE);
        })(t0);
      });
    })();
  }

  function init() {
    var svgs = [].slice.call(document.querySelectorAll('svg.diagram-svg--wide, svg.diagram-svg--tall'));
    svgs.forEach(function (svg) {
      var d = null;
      var io = new IntersectionObserver(function (es) {
        var inView = es[0].isIntersecting && visible(svg);
        if (inView && !d) d = setup(svg);
        if (!d) return;
        if (inView && !d.on) { d.on = true; (function loop() { if (d.on) run(d, loop); })(); }
        else if (!inView) d.on = false;
      }, { threshold: 0.25 });
      io.observe(svg);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
